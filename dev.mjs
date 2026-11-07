#!/usr/bin/env node
/* Local dev server + CMS backend (no database - it reads/writes the JSON files in content/)

   Usage:  node dev.mjs            then open   http://localhost:3000        (the website, live-reloading)
                                               http://localhost:3000/admin/  (the CMS editor)
           PORT=4000 node dev.mjs  to change the port

   Safety:  listens on 127.0.0.1 only; write requests need a custom header + a local Origin;
            a save that would break the build is rolled back automatically;
            the previous version of every saved file is kept in content/.backups/ (last 30). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, ContentError, META } from './build.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const PAGES = path.join(CONTENT, 'pages');
const BACKUPS = path.join(CONTENT, '.backups');
const PORT = +process.env.PORT || 3000;
const HOST = '127.0.0.1';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const clients = new Set();
let lastError = null;
let suppressUntil = 0;           // ignore the file watcher right after the CMS saved a file itself

/* ------------------------------------------------------------------ build helpers */
function tryBuild() {
  try { build({ quiet: true }); lastError = null; return null; }
  catch (e) {
    lastError = e instanceof ContentError ? e.message : `Unexpected error: ${e.message}`;
    return lastError;
  }
}
const notify = () => { for (const res of clients) res.write('data: reload\n\n'); };
function rebuild(reason) {
  const err = tryBuild();
  console.log(err ? `✖ ${err}` : `✔ rebuilt (${reason})`);
  notify();
}

/* ------------------------------------------------------------------ CMS API */
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const safeName = n => typeof n === 'string' && /^[a-z0-9][a-z0-9_-]{0,40}$/.test(n);
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 2e6) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('Body is not valid JSON')); } });
    req.on('error', reject);
  });
}

function backup(file, previousText) {
  if (previousText == null) return;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const base = path.basename(file, '.json');
  fs.writeFileSync(path.join(BACKUPS, `${base}-${Date.now()}.json`), previousText);
  const mine = fs.readdirSync(BACKUPS).filter(f => f.startsWith(base + '-')).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - 30))) fs.unlinkSync(path.join(BACKUPS, old));
}

/* write -> rebuild -> roll back if the build fails, so the site can never be left broken */
function saveJson(file, data) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  suppressUntil = Date.now() + 1000;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  const err = tryBuild();
  if (err) {
    if (prev == null) fs.unlinkSync(file); else fs.writeFileSync(file, prev);
    suppressUntil = Date.now() + 1000;
    tryBuild();
    return { ok: false, error: err };
  }
  backup(file, prev);
  notify();
  return { ok: true };
}

function listPages() {
  const pages = {};
  for (const f of fs.readdirSync(PAGES).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()) pages[f.replace(/\.json$/, '')] = readJson(path.join(PAGES, f));
  return pages;
}

async function api(req, res, url) {
  // CSRF / cross-site protection: custom header (forces a CORS preflight) + local origin only
  const origin = req.headers.origin;
  const localOrigin = o => !o || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  if (req.method !== 'GET' && (req.headers['x-cms'] !== '1' || !localOrigin(origin))) return json(res, 403, { ok: false, error: 'Forbidden' });
  if (!localOrigin(origin) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return json(res, 403, { ok: false, error: 'Forbidden' });

  try {
    if (req.method === 'GET' && url === '/api/content') {
      return json(res, 200, { site: readJson(path.join(CONTENT, 'site.json')), pages: listPages(), meta: META, error: lastError });
    }
    if (req.method === 'PUT' && url === '/api/site') {
      const body = await readBody(req);
      return json(res, 200, saveJson(path.join(CONTENT, 'site.json'), body));
    }
    let m = /^\/api\/pages\/([^/]+)$/.exec(url);
    if (m && req.method === 'PUT') {
      if (!safeName(m[1])) return json(res, 400, { ok: false, error: 'Invalid page name' });
      const file = path.join(PAGES, m[1] + '.json');
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: 'Page not found' });
      return json(res, 200, saveJson(file, await readBody(req)));
    }
    if (m && req.method === 'DELETE') {
      if (!safeName(m[1])) return json(res, 400, { ok: false, error: 'Invalid page name' });
      const file = path.join(PAGES, m[1] + '.json');
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: 'Page not found' });
      const page = readJson(file);
      if (page.output === 'index.html') return json(res, 400, { ok: false, error: 'The home page cannot be deleted' });
      backup(file, fs.readFileSync(file, 'utf8'));
      suppressUntil = Date.now() + 1000;
      fs.unlinkSync(file);
      const out = path.join(ROOT, page.output || '');
      if (page.output && /^[\w-]+\.html$/.test(page.output) && fs.existsSync(out)) fs.unlinkSync(out);
      tryBuild(); notify();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url === '/api/pages') {
      const { name, title, layout } = await readBody(req);
      if (!safeName(name)) return json(res, 400, { ok: false, error: 'Use only lowercase letters, numbers, - and _ for the page name' });
      const file = path.join(PAGES, name + '.json');
      if (fs.existsSync(file)) return json(res, 409, { ok: false, error: `A page called "${name}" already exists` });
      const legal = layout === 'legal';
      const page = {
        output: `${name}.html`, layout: legal ? 'legal' : 'default',
        meta: { title: title || name, description: 'Describe this page for search engines (about 150 characters).' },
        sections: [legal
          ? { type: 'legal', title: title || name, updated: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), blocks: [{ heading: 'First section', paragraphs: ['Write your text here.'] }] }
          : { type: 'faq', tag: 'FAQ', title: title || 'New page', items: [{ q: 'First question?', a: 'First answer.' }] }]
      };
      const result = saveJson(file, page);
      return json(res, result.ok ? 200 : 400, { ...result, name });
    }
    return json(res, 404, { ok: false, error: 'Unknown API route' });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
}

/* ------------------------------------------------------------------ static server */
const RELOAD = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;
const errorPage = msg => `<!doctype html><meta charset=utf-8><title>Content error</title><body style="font:16px/1.6 system-ui;background:#0b0b0b;color:#eee;padding:48px"><h1 style="color:#ffc21a">Content problem</h1><pre style="white-space:pre-wrap;background:#1a1a1a;padding:20px;border-radius:12px;border:1px solid #333">${msg.replace(/</g, '&lt;')}</pre><p>Fix the JSON file and save - this page reloads automatically.</p>${RELOAD}`;

http.createServer((req, res) => {
  const [rawPath, query = ''] = req.url.split('?');
  let url = decodeURIComponent(rawPath);

  if (url.startsWith('/api/')) { api(req, res, url); return; }
  if (url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (url === '/admin') { res.writeHead(302, { Location: '/admin/' }); res.end(); return; }
  const isAdmin = url.startsWith('/admin/');
  const isPreview = query.includes('cms-preview');
  if (lastError && !isAdmin && (url === '/' || url.endsWith('.html'))) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(errorPage(lastError)); return; }
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || /(^|\/)(node_modules|\.git|\.backups)(\/|$)/.test(url)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    // live-reload only on the real site - never inside the admin or its preview frame (the admin reloads the preview itself)
    res.end(ext === '.html' && !isAdmin && !isPreview ? data.toString().replace('</body>', RELOAD + '</body>') : data);
  });
}).listen(PORT, HOST, () => {
  console.log(`\n  Lordevs dev server\n  ─────────────────────────────────────────\n  Website  →  http://localhost:${PORT}\n  CMS      →  http://localhost:${PORT}/admin/\n\n  Edit content/*.json by hand or in the CMS - both rebuild + reload.\n`);
  rebuild('startup');
});

/* ------------------------------------------------------------------ file watching */
let timer;
const debounced = fn => { clearTimeout(timer); timer = setTimeout(fn, 120); };
fs.watch(CONTENT, { recursive: true }, (evt, f) => {
  if (Date.now() < suppressUntil || (f && f.includes('.backups'))) return;
  debounced(() => rebuild(f || 'content'));
});
fs.watch(path.join(ROOT, 'build.mjs'), () => debounced(() =>
  import('./build.mjs?' + Date.now()).then(m => { m.build({ quiet: true }); console.log('✔ rebuilt (build.mjs)'); notify(); }).catch(e => console.error('✖', e.message))));
for (const f of ['styles.css', 'script.js']) fs.watch(path.join(ROOT, f), () => debounced(notify));
