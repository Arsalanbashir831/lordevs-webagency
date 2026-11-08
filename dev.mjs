#!/usr/bin/env node
/* Local dev server: serves the site and rebuilds + live-reloads when you save a content JSON file.

   Usage:  node dev.mjs            then open   http://localhost:3000
           PORT=4000 node dev.mjs  to change the port

   Listens on 127.0.0.1 only. (The CMS dashboard was removed - edit content/*.json by hand.
   It is still in git history if it is ever needed again.) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, ContentError } from './build.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const PORT = +process.env.PORT || 3000;
const HOST = '127.0.0.1';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

const clients = new Set();
let lastError = null;

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

/* ------------------------------------------------------------------ static server */
const RELOAD = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;
const errorPage = msg => `<!doctype html><meta charset=utf-8><title>Content error</title><body style="font:16px/1.6 system-ui;background:#0b0b0b;color:#eee;padding:48px"><h1 style="color:#ffc21a">Content problem</h1><pre style="white-space:pre-wrap;background:#1a1a1a;padding:20px;border-radius:12px;border:1px solid #333">${msg.replace(/</g, '&lt;')}</pre><p>Fix the JSON file and save - this page reloads automatically.</p>${RELOAD}`;

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (lastError && (url === '/' || url.endsWith('.html'))) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(errorPage(lastError)); return; }
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || /(^|\/)(node_modules|\.git)(\/|$)/.test(url)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(ext === '.html' ? data.toString().replace('</body>', RELOAD + '</body>') : data);
  });
}).listen(PORT, HOST, () => {
  console.log(`\n  Lordevs dev server\n  ─────────────────────────────────────────\n  Website  →  http://localhost:${PORT}\n\n  Edit content/*.json - the site rebuilds + reloads on save.\n`);
  rebuild('startup');
});

/* ------------------------------------------------------------------ file watching */
let timer;
const debounced = fn => { clearTimeout(timer); timer = setTimeout(fn, 120); };
fs.watch(CONTENT, { recursive: true }, (evt, f) => debounced(() => rebuild(f || 'content')));
fs.watch(path.join(ROOT, 'build.mjs'), () => debounced(() =>
  import('./build.mjs?' + Date.now()).then(m => { m.build({ quiet: true }); console.log('✔ rebuilt (build.mjs)'); notify(); }).catch(e => console.error('✖', e.message))));
for (const f of ['styles.css', 'script.js']) fs.watch(path.join(ROOT, f), () => debounced(notify));
