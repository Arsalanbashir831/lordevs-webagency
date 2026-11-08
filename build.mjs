#!/usr/bin/env node
/* =====================================================================
   Lordevs static site builder  -  no dependencies, no backend, no database

   content/site.json        shared settings (logo, contact, nav, footer, cookie banner)
   content/pages/*.json     one file per page (SEO meta + ordered list of sections)
   build.mjs                turns the JSON into the HTML pages (index.html, privacy.html, ...)
                            plus sitemap.xml and robots.txt

   Run:   node build.mjs          (build once)
          node dev.mjs            (local server that rebuilds + reloads when you save a JSON file)

   See content/README.md for the editing guide.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const PAGES_DIR = path.join(CONTENT, 'pages');

class ContentError extends Error {}
const fail = msg => { throw new ContentError(msg); };

/* ---------------------------------------------------------------- JSON loading */
function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try { return JSON.parse(raw); }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    let where = '';
    if (m) {
      const before = raw.slice(0, +m[1]);
      where = ` (around line ${before.split('\n').length})`;
    }
    fail(`${path.relative(ROOT, file)} is not valid JSON${where}. Check for a missing comma, quote or bracket.\n   ${e.message}`);
  }
}

/* ---------------------------------------------------------------- text helpers */
const ENTITY_AMP = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g;
const attr = s => String(s ?? '').replace(ENTITY_AMP, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SAFE_TAGS = new Set(['b', 'strong', 'i', 'em', 'br', 'mark', 'span', 'small']);

/* Text fields may contain a few inline tags: <b> <strong> <i> <em> <br> <mark> <span> <small>
   and <a href="..."> . Everything else is escaped, so a typo can't break the page. */
function rich(s) {
  if (s == null) return '';
  let out = String(s).replace(ENTITY_AMP, '&amp;');
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)>/g, (m, slash, tag, attrs) => {
    tag = tag.toLowerCase();
    if (SAFE_TAGS.has(tag) && !attrs.trim()) return `<${slash}${tag}>`;
    if (tag === 'a' && slash) return '</a>';
    if (tag === 'a') {
      const h = /^\s+href="([^"]*)"(\s+target="_blank"\s+rel="noopener")?\s*$/.exec(attrs);
      if (h) return `<a href="${h[1].replace(/"/g, '&quot;')}"${h[2] ? ' target="_blank" rel="noopener"' : ''}>`;
    }
    return m.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
  return out.replace(/<(?!\/?(?:b|strong|i|em|br|mark|span|small|a)[\s>\/])/g, '&lt;');
}
const plain = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------- icons (name -> svg inner markup) */
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2A2.6 2.6 0 0 0 12 8c-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2a2.6 2.6 0 0 1-2.5-1.2M12 6v2M12 16v2"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  rocket: '<path d="M5 15c-1.500 1-2 4-2 6 2 0 5-.5 6-2"/><path d="m12 15-3-3a22 22 0 0 1 2-4 12 12 0 0 1 11-5c0 3-1 8-5 11a22 22 0 0 1-5 1z"/><circle cx="16" cy="8" r="1.500"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.500 7.200L4 20l1-4.200A8 8 0 1 1 21 12z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.5-3.500 3-5.500 6.500-5.500s6 2 6.500 5.500"/><path d="M16 4.500a3.500 3.500 0 0 1 0 7M18 14.800c2 .6 3.200 2.300 3.500 5.200"/>',
  design: '<path d="M12 19l7-7-4-4-7 7-1 5z"/><path d="M15 8l1-1a2 2 0 0 1 3 3l-1 1"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-5"/><circle cx="12" cy="14" r="1.200"/>',
  monitor: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  star: '<path d="m12 3 2.700 5.600 6.100.8-4.500 4.200 1.100 6-5.400-3-5.400 3 1.100-6L3.200 9.400l6.100-.8L12 3z"/>'
};
const ICON_NAMES = Object.keys(ICONS).join(', ');
const svg = (name, where, extra = '') => {
  if (!ICONS[name]) fail(`${where}: unknown icon "${name}". Available icons: ${ICON_NAMES}`);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${ICONS[name]}</svg>`;
};

/* ---------------------------------------------------------------- validation helpers */
const need = (obj, keys, where) => {
  if (obj == null || typeof obj !== 'object') fail(`${where} is missing`);
  for (const k of keys) if (obj[k] == null || obj[k] === '') fail(`${where}: "${k}" is required`);
};
const list = (obj, key, where, min = 1) => {
  if (!Array.isArray(obj?.[key]) || obj[key].length < min) fail(`${where}: "${key}" must be a list with at least ${min} item${min > 1 ? 's' : ''}`);
  return obj[key];
};
const STYLES = ['yellow', 'stone', 'cream', 'dark'];
const styleOf = (s, where) => {
  const v = s || 'yellow';
  if (!STYLES.includes(v)) fail(`${where}: "style" must be one of ${STYLES.join(', ')} (got "${v}")`);
  return `g-${v}`;
};

/* ---------------------------------------------------------------- {{tokens}} */
function applyTokens(value, tokens) {
  if (typeof value === 'string') return value.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
  if (Array.isArray(value)) return value.map(v => applyTokens(v, tokens));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyTokens(v, tokens)]));
  return value;
}

/* ---------------------------------------------------------------- shared fragments */
const avatarSpan = a => a.image
  ? `<span style="--c:${attr(a.bg || '#FFC21A')}"><img src="${attr(a.image)}" alt="" loading="lazy" decoding="async"></span>`
  : `<span style="--c:${attr(a.bg || '#FFC21A')}${a.color ? `;color:${attr(a.color)}` : ''}">${rich(a.letter || '')}</span>`;
const pillArrow = '<span class="btn-pill__ico" aria-hidden="true">↗</span>';

function link(l, where, cls = '') {
  need(l, ['label', 'href'], where);
  const ext = l.external ? ' target="_blank" rel="noopener"' : '';
  const klass = [cls, l.accent ? 'yellow' : ''].filter(Boolean).join(' ');
  return `<a href="${attr(l.href)}"${klass ? ` class="${klass}"` : ''}${ext}>${rich(l.label)}</a>`;
}

function sectionHead(s, light = false) {
  const tag = s.tag ? `<span class="tag${light ? ' tag--light' : ''}">${rich(s.tag)}</span>\n  ` : '';
  const title = s.title ? `<h2 class="h2${light ? ' h2--light' : ''}">${rich(s.title)}</h2>\n  ` : '';
  const lead = s.lead ? `<p class="lead">${rich(s.lead)}</p>\n` : '';
  return tag + title + lead;
}
const idAttr = (s, def) => { const id = s.id ?? def; return id ? ` id="${attr(id)}"` : ''; };

/* ---------------------------------------------------------------- section renderers */
const MOCKS = {
  browser: '<div class="mock mock--browser"><i></i><i></i><i></i><b></b><em></em></div>',
  phone: '<div class="mock mock--phone"><b></b><em></em><em></em></div>',
  chart: '<div class="mock mock--chart"><s></s><s></s><s></s><s></s><s></s></div>',
  shop: '<div class="mock mock--shop"><b></b><b></b><b></b><b></b></div>'
};

const SECTIONS = {
  hero(s, ctx, w) {
    need(s.title, ['line1', 'line2'], `${w} → title`);
    need(s, ['subtitle'], w); need(s.cta, ['label', 'href'], `${w} → cta`);
    const proof = s.proof || {};
    const logos = (s.logos || []).map((n, i) => typeof n === 'object' && n.image
      ? `      <span class="lg lg--img"><img src="${attr(n.image)}" alt="${attr(n.name || '')}" loading="lazy" decoding="async"></span>`
      : `      <span class="lg"><i class="lg__ico lg__ico--${(i % 5) + 1}"></i>${rich(typeof n === 'object' ? n.name : n)}</span>`).join('\n');
    return `<section class="hero container"${idAttr(s)}>
  <h1 class="hero__title">
    <span class="t-dark">${rich(s.title.line1)}</span>
    <span class="t-muted">${rich(s.title.line2)}</span>
  </h1>

  <p class="hero__sub">${rich(s.subtitle)}</p>

  <div class="hero__cta">
    <a href="${attr(s.cta.href)}" class="btn-pill">${rich(s.cta.label)} ${pillArrow}</a>
    <div class="proof">
      <div class="avatars" aria-hidden="true">
        ${ctx.site.avatars.map(avatarSpan).join('')}
      </div>
      <div class="proof__txt"><div class="stars" aria-label="Rated ${attr(proof.rating || '5.0')} out of 5">★★★★★</div><small>${rich(proof.text || '')}</small></div>
    </div>
  </div>
${logos ? `
  <div class="hero__logos">
    ${s.logosTitle ? `<p class="loved"><span>${rich(s.logosTitle)}</span></p>` : ''}
    <div class="logos-row" aria-label="Client logos">
${logos}
    </div>
  </div>
` : ''}</section>`;
  },

  workStrip(s, ctx, w) {
    const items = list(s, 'items', w);
    const card = (it, i, hidden) => {
      need(it, ['tag', 'name'], `${w} → items[${i}]`);
      const mock = MOCKS[it.mock || 'browser'];
      if (!mock) fail(`${w} → items[${i}]: "mock" must be one of ${Object.keys(MOCKS).join(', ')}`);
      const theme = Math.min(5, Math.max(1, +it.theme || (i % 5) + 1));
      return `    <article class="card-work c${theme}"${hidden ? ' aria-hidden="true"' : ''}><div class="card-work__img">${mock}</div><p><span>${rich(it.tag)}</span><strong>${rich(it.name)}</strong></p></article>`;
    };
    return `<section class="work"${idAttr(s, 'work')} aria-label="${attr(s.ariaLabel || 'Selected work')}">
  <div class="work__track">
${items.map((it, i) => card(it, i, false)).join('\n')}
${items.map((it, i) => card(it, i, true)).join('\n')}
  </div>
</section>`;
  },

  about(s, ctx, w) {
    need(s, ['statement'], w);
    const st = s.stats || {};
    for (const k of ['projects', 'clients', 'satisfaction', 'growth', 'countries']) need(st[k], [], `${w} → stats.${k}`);
    const big = (o, k) => { need(o, ['value', 'title', 'text'], `${w} → stats.${k}`); return `<div class="big count" data-to="${attr(o.value)}" data-suffix="${attr(o.suffix || '')}">${rich(o.value)}${rich(o.suffix || '')}</div>
      <div class="tile__foot"><h3>${rich(o.title)}</h3><p>${rich(o.text)}</p></div>`; };
    const dots = (st.countries.dots || []).map(c => `<i style="--c:${attr(c)}"></i>`).join('');
    return `<section class="about container"${idAttr(s, 'about')}>
  <div class="about__head">
    <a class="brand brand--sm" href="#top" aria-label="${attr(ctx.site.brand.name)}"><img src="${attr(ctx.site.brand.logoDark)}" alt="${attr(ctx.site.brand.name)}" width="170" height="44"></a>
    <h2 class="statement">${rich(s.statement)}</h2>
  </div>

  <div class="bento">
    <div class="tile tile--tall g-yellow">
      ${big(st.projects, 'projects')}
    </div>
    <div class="tile tile--mini">
      <div class="avatars" aria-hidden="true">${ctx.site.avatars.map(avatarSpan).join('')}</div>
      <div><div class="stars sm">★★★★★</div><small>${rich(st.clients.text || '')}</small></div>
    </div>
    <div class="tile g-cream">
      ${big(st.satisfaction, 'satisfaction')}
    </div>
    <div class="tile tile--tall g-stone">
      ${big(st.growth, 'growth')}
    </div>
    <div class="tile tile--wide">
      <div><h3>${rich(st.countries.title)}</h3><p>${rich(st.countries.text)}</p></div>
      <div class="flags" aria-hidden="true">${dots}</div>
    </div>
  </div>
</section>`;
  },

  techBand(s, ctx, w) {
    const items = list(s, 'items', w);
    return `<section class="tech"${idAttr(s)} aria-label="${attr(s.ariaLabel || 'Tools and platforms')}">
  <div class="tech__track">
    ${items.map(i => `<span>${rich(i)}</span>`).join('')}
    ${items.map(i => `<span aria-hidden="true">${rich(i)}</span>`).join('')}
  </div>
</section>`;
  },

  services(s, ctx, w) {
    const items = list(s, 'items', w);
    const rows = items.map((it, i) => {
      const ww = `${w} → items[${i}]`;
      need(it, ['icon', 'title', 'text'], ww);
      const lk = it.linkLabel ? `\n      <a href="${attr(it.linkHref || '#book')}" class="svc__link">${rich(it.linkLabel)} →</a>` : '';
      return `    <article class="svc ${styleOf(it.style, ww)}"><div class="svc__ico">${svg(it.icon, ww)}</div>
      <div><h3>${rich(it.title)}</h3><p>${rich(it.text)}</p></div>${lk}</article>`;
    });
    return `<section class="services container"${idAttr(s, 'services')}>
  ${sectionHead(s)}
  <div class="svc-list">
${rows.join('\n')}
  </div>
</section>`;
  },

  compare(s, ctx, w) {
    need(s.other, ['title'], `${w} → other`); need(s.us, ['title'], `${w} → us`);
    const ul = o => `<ul>\n${list(o, 'items', w).map(i => `          <li>${rich(i)}</li>`).join('\n')}\n        </ul>`;
    const logos = (s.logos || []).map(l => `<span>${rich(l)}</span>`).join('');
    return `<section class="compare"${idAttr(s)}>
  <div class="container">
    ${sectionHead({ tag: s.tag, title: s.title }, true)}
    <div class="compare__grid">
      <div class="cmp cmp--other">
        <h3>${rich(s.other.title)}</h3>
        ${ul(s.other)}
      </div>
      <div class="cmp cmp--us">
        <h3>${rich(s.us.title)}</h3>
        ${ul(s.us)}
      </div>
    </div>
${s.trustedText ? `
    <p class="trusted">${rich(s.trustedText)}</p>
    <div class="logos" aria-label="Client logos">
      ${logos}
    </div>
` : ''}  </div>
</section>`;
  },

  why(s, ctx, w) {
    const cards = list(s, 'cards', w).map((c, i) => {
      const ww = `${w} → cards[${i}]`;
      need(c, ['icon', 'title', 'text'], ww);
      const lk = c.linkLabel ? `<a href="${attr(c.linkHref || '#book')}" class="svc__link">${rich(c.linkLabel)} →</a>` : '';
      if (c.wide) return `    <article class="why-card why-card--wide ${styleOf(c.style, ww)}"><div><h3>${rich(c.title)}</h3><p>${rich(c.text)}</p>${lk}</div><div class="why-ico why-ico--xl">${svg(c.icon, ww, ' aria-hidden="true"')}</div></article>`;
      return `    <article class="why-card ${styleOf(c.style, ww)}"><div class="why-ico">${svg(c.icon, ww, ' aria-hidden="true"')}</div><h3>${rich(c.title)}</h3><p>${rich(c.text)}</p></article>`;
    });
    return `<section class="why container"${idAttr(s)}>
  ${sectionHead(s)}
  <div class="why__grid">
${cards.join('\n')}
  </div>
</section>`;
  },

  testimonials(s, ctx, w) {
    const items = list(s, 'items', w).map((t, i) => {
      const ww = `${w} → items[${i}]`;
      need(t, ['quote', 'name'], ww);
      const v = t.variant ? `quote--${t.variant}` : '';
      if (t.variant && !['hero', 'accent'].includes(t.variant)) fail(`${ww}: "variant" must be "hero", "accent" or left out`);
      const initial = t.initial || String(t.name).trim().charAt(0).toUpperCase();
      return `    <blockquote class="quote${v ? ' ' + v : ''}">${t.logo ? `<span class="qlogo">${rich(t.logo)}</span>` : ''}<p>${rich(t.quote)}</p><footer><i style="--c:${attr(t.avatarBg || '#FFC21A')}${t.avatarColor ? `;color:${attr(t.avatarColor)}` : ''}">${rich(initial)}</i><div><b>${rich(t.name)}</b><small>${rich(t.role || '')}</small></div></footer></blockquote>`;
    });
    return `<section class="testi container"${idAttr(s, 'testimonials')}>
  ${sectionHead(s)}
  <div class="testi__grid">
${items.join('\n')}
  </div>
</section>`;
  },

  process(s, ctx, w) {
    const steps = list(s, 'steps', w).map((st, i) => {
      const ww = `${w} → steps[${i}]`;
      need(st, ['icon', 'title', 'text'], ww);
      return `    <article class="step">
      <div class="step__ico">
        ${svg(st.icon, ww)}
      </div>
      <h3>${rich(st.title)}</h3>
      <p>${rich(st.text)}</p>
      <span class="step__n">${String(i + 1).padStart(2, '0')}</span>
    </article>`;
    });
    const cta = s.cta ? `\n  <a href="${attr(s.cta.href || '#book')}" class="btn btn--primary center">${rich(s.cta.label)} <span aria-hidden="true">→</span></a>` : '';
    return `<section class="process container"${idAttr(s, 'process')}>
  ${sectionHead(s)}
  <div class="steps">
${steps.join('\n')}
  </div>${cta}
</section>`;
  },

  booking(s, ctx, w) {
    if (s.calendlyUrl) {
      return `<section class="book"${idAttr(s, 'book')}>
  <div class="book__3d" aria-hidden="true"><canvas id="bookCanvas"></canvas></div>
  <div class="container">
    ${sectionHead({ tag: s.tag, title: s.title }, true)}
    <div class="booker booker--calendly">
      <div class="calendly-inline-widget" data-url="${attr(s.calendlyUrl)}"></div>
    </div>
  </div>
  <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
</section>`;
    }
    need(s.panel, ['host', 'title'], `${w} → panel`);
    const slots = list(s, 'timeSlots', w);
    const email = s.email || ctx.site.contact.email;
    const subject = s.emailSubject || 'Consultation request';
    const details = (s.panel.details || []).map(d => `<li>${rich(d)}</li>`).join('');
    return `<section class="book"${idAttr(s, 'book')}>
  <div class="book__3d" aria-hidden="true"><canvas id="bookCanvas"></canvas></div>
  <div class="container">
    ${sectionHead({ tag: s.tag, title: s.title }, true)}
    <div class="booker">
      <aside class="booker__info">
        <div class="booker__who"><img src="${attr(ctx.site.brand.logoMark)}" alt="" width="34" height="35"><div><b>${rich(s.panel.host)}</b><small>${rich(s.panel.subtitle || '')}</small></div></div>
        <h3>${rich(s.panel.title)}</h3>
        <ul>${details}</ul>
      </aside>
      <div class="cal">
        <div class="cal__head"><button id="prevM" aria-label="Previous month">‹</button><b id="monthLbl"></b><button id="nextM" aria-label="Next month">›</button></div>
        <div class="cal__dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
        <div class="cal__grid" id="calGrid"></div>
      </div>
      <div class="slots" data-times="${attr(JSON.stringify(slots))}">
        <b id="dayLbl">Select a date</b>
        <div id="slotList"></div>
        <a href="mailto:${attr(email)}?subject=${encodeURIComponent(subject)}" class="btn btn--primary btn--block" id="confirmBtn" data-email="${attr(email)}" data-subject="${attr(subject)}">${rich(s.confirmLabel || 'Confirm booking')}</a>
      </div>
    </div>
  </div>
</section>`;
  },

  faq(s, ctx, w) {
    const items = list(s, 'items', w).map((f, i) => {
      need(f, ['q', 'a'], `${w} → items[${i}]`);
      return `    <details><summary>${rich(f.q)}</summary><p>${rich(f.a)}</p></details>`;
    });
    return `<section class="faq container"${idAttr(s, 'faq')}>
  ${sectionHead(s)}
  <div class="faq__list">
${items.join('\n')}
  </div>
</section>`;
  },

  legal(s, ctx, w) {
    need(s, ['title'], w);
    const blocks = list(s, 'blocks', w).map(b => [
      b.heading ? `  <h2>${rich(b.heading)}</h2>` : '',
      ...(b.paragraphs || []).map(p => `  <p>${rich(p)}</p>`),
      b.list ? `  <ul>\n${b.list.map(li => `    <li>${rich(li)}</li>`).join('\n')}\n  </ul>` : ''
    ].filter(Boolean).join('\n'));
    return `<main class="legal"${idAttr(s)}>
  <h1>${rich(s.title)}</h1>
  ${s.updated ? `<p class="meta">Last updated: ${rich(s.updated)}</p>` : ''}

${blocks.join('\n\n')}
</main>`;
  }
};

/* ---------------------------------------------------------------- page chrome */
const HOME_OUTPUT = 'index.html';
const toHref = (href, page) => {
  // hash links on pages other than the home page must point back to the home page
  if (page.output !== HOME_OUTPUT && typeof href === 'string' && href.startsWith('#')) return href === '#top' ? HOME_OUTPUT : HOME_OUTPUT + href;
  return href;
};

function renderNav(ctx, page) {
  const { site } = ctx;
  const nav = site.navigation;
  const links = nav.links.map(l => `      <a href="${attr(toHref(l.href, page))}">${rich(l.label)}</a>`).join('\n');
  return `<header class="nav" id="top">
  <div class="container nav__inner">
    <a href="${attr(toHref('#top', page))}" class="brand" aria-label="${attr(site.brand.name)} home">
      <img class="brand__logo" src="${attr(site.brand.logo)}" alt="${attr(site.brand.name)}" width="170" height="44">
    </a>
    <nav class="nav__links" id="navLinks" aria-label="Primary">
${links}
    </nav>
    <a href="${attr(toHref(nav.cta.href, page))}" class="btn-pill btn-pill--sm nav__cta">${rich(nav.cta.label)} ${pillArrow}</a>
    <button class="burger" id="burger" aria-label="Toggle menu" aria-expanded="false" aria-controls="navLinks"><span></span><span></span></button>
  </div>
</header>`;
}

function renderFooter(ctx, page) {
  const { site } = ctx;
  const f = site.footer;
  const cols = f.columns.map(c => `      <div><h4>${rich(c.title)}</h4>${c.links.map(l => link({ ...l, href: toHref(l.href, page) }, `footer → ${c.title}`)).join('')}</div>`).join('\n');
  const legal = (f.legalLinks || []).map(l => `<a href="${attr(l.href)}">${rich(l.label)}</a>`).join(' &nbsp;·&nbsp; ');
  const copy = rich(f.copyright).replace('{{year}}', '<span id="yr"></span>');
  return `<footer class="footer">
  <div class="container footer__inner">
    <a href="${attr(toHref('#top', page))}" class="footer__logo" aria-label="${attr(site.brand.name)}"><img src="${attr(site.brand.logo)}" alt="${attr(site.brand.name)}" width="217" height="56"></a>
    <div class="footer__cols">
${cols}
    </div>
  </div>
  <div class="footer__word" aria-hidden="true">${rich(site.brand.footerWordmark || site.brand.name)}<i>.</i></div>
  <p class="footer__copy">${copy}${legal ? ' &nbsp;·&nbsp; ' + legal : ''}</p>
</footer>`;
}

function renderCookie(ctx) {
  const c = ctx.site.cookieBanner;
  if (!c || c.enabled === false) return '';
  return `<!-- Cookie & privacy notice -->
<aside class="consent" id="consent" role="dialog" aria-live="polite" aria-label="Cookie and privacy notice" hidden>
  <p><strong>${rich(c.title)}</strong> ${rich(c.text)} <a href="${attr(c.policyHref)}">${rich(c.policyLabel)}</a>.</p>
  <div class="consent__btns">
    <button type="button" class="consent__btn consent__btn--ghost" data-consent="declined">${rich(c.declineLabel || 'Decline')}</button>
    <button type="button" class="consent__btn" data-consent="accepted">${rich(c.acceptLabel || 'Accept')}</button>
  </div>
</aside>`;
}

function renderHead(page, ctx, sectionsData) {
  const { site } = ctx;
  const m = page.meta || {};
  need(m, ['title', 'description'], `${page.file} → meta`);
  const url = (site.url || '').replace(/\/$/, '');
  const canonical = url ? pageUrl(site, page) : '';
  const ld = [];
  if (page.output === HOME_OUTPUT && url) {
    ld.push({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: site.brand.name, url, logo: `${url}/${site.brand.logo}`,
      email: site.contact.email, telephone: `+${site.contact.whatsappNumber}`
    });
  }
  const faq = sectionsData.find(s => s.type === 'faq');
  if (faq) {
    ld.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.items.map(f => ({ '@type': 'Question', name: plain(f.q), acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } }))
    });
  }
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- GENERATED by build.mjs from content/pages/${path.basename(page.file)} - edit the JSON, not this file -->
  <title>${attr(m.title)}</title>
  <meta name="description" content="${attr(m.description)}">${m.noindex ? '\n  <meta name="robots" content="noindex, nofollow">' : ''}
  <meta name="theme-color" content="${attr(site.themeColor || '#FFC21A')}">
${canonical ? `  <link rel="canonical" href="${attr(canonical)}">\n` : ''}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${attr(site.brand.name)}">
  <meta property="og:title" content="${attr(m.title)}">
  <meta property="og:description" content="${attr(m.description)}">
${canonical ? `  <meta property="og:url" content="${attr(canonical)}">\n` : ''}  <link rel="icon" href="${attr(site.brand.logoMark)}" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
${ld.map(o => `  <script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
</head>`;
}

const SCRIPTS = `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="script.js"></script>`;

function renderPage(page, ctx) {
  const { site } = ctx;
  const indexed = (page.sections || []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.enabled !== false);
  const sections = indexed.map(x => x.s);
  if (!sections.length) fail(`${path.basename(page.file)}: "sections" must contain at least one section`);

  const body = indexed.map(({ s, i }) => {
    const where = `${path.basename(page.file)} → sections[${i}] (${s.type})`;
    const fn = SECTIONS[s.type];
    if (!fn) fail(`${where}: unknown section type "${s.type}". Available types: ${Object.keys(SECTIONS).join(', ')}`);
    return fn(s, ctx, where);
  });
  const head = renderHead(page, ctx, sections);
  const lang = attr(site.language || 'en');

  if (page.layout === 'legal') {
    return `<!doctype html>
<html lang="${lang}">
${head}
<body>
<header class="nav">
  <div class="container nav__inner">
    <a href="${HOME_OUTPUT}" class="brand" aria-label="${attr(site.brand.name)} home"><img class="brand__logo" src="${attr(site.brand.logo)}" alt="${attr(site.brand.name)}" width="170" height="44"></a>
    <a href="${HOME_OUTPUT}" class="btn-pill btn-pill--sm nav__cta" style="margin-left:auto">Back to home ${pillArrow}</a>
  </div>
</header>

${body.join('\n\n')}

<footer class="legal__foot">${rich(site.footer.copyright).replace('{{year}}', '<span id="yr"></span>')} &nbsp;·&nbsp; <a href="${HOME_OUTPUT}">Back to home</a></footer>
<script>document.getElementById('yr').textContent = new Date().getFullYear();</script>
</body>
</html>
`;
  }

  return `<!doctype html>
<html lang="${lang}">
${head}
<body>

<!-- Preloader / progress / cursor -->
<div class="loader" id="loader" aria-hidden="true">
  <div class="loader__inner">
    <div class="loader__brand"><img src="${attr(site.brand.logo)}" alt="" width="260" height="67"></div>
    <div class="loader__bar"><span></span></div>
    <b class="loader__num" id="loaderNum">0</b>
  </div>
</div>
<div class="progress" aria-hidden="true"></div>
<div class="cursor" id="cursor" aria-hidden="true"></div>
<div class="cursor-dot" id="cursorDot" aria-hidden="true"></div>

${renderNav(ctx, page)}

<main>

${body.join('\n\n')}

</main>

${renderFooter(ctx, page)}

${renderCookie(ctx)}

${SCRIPTS}
</body>
</html>
`;
}

/* ---------------------------------------------------------------- build */
export function build({ quiet = false } = {}) {
  const siteRaw = readJson(path.join(CONTENT, 'site.json'));
  need(siteRaw.brand, ['name', 'logo', 'logoDark', 'logoMark'], 'site.json → brand');
  need(siteRaw.contact, ['email', 'whatsappDisplay', 'whatsappNumber'], 'site.json → contact');
  need(siteRaw.navigation, ['links', 'cta'], 'site.json → navigation');
  need(siteRaw.footer, ['columns', 'copyright'], 'site.json → footer');
  siteRaw.avatars = siteRaw.avatars || [];

  const tokens = {
    brand: siteRaw.brand.name,
    email: siteRaw.contact.email,
    whatsapp: siteRaw.contact.whatsappDisplay,
    whatsappUrl: `https://wa.me/${siteRaw.contact.whatsappNumber}`,
    whatsappNumber: siteRaw.contact.whatsappNumber
  };
  const site = applyTokens(siteRaw, tokens);
  const ctx = { site, tokens };

  const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
  if (!files.length) fail('content/pages/ has no .json page files');

  const written = [], pagesBuilt = [];
  for (const f of files) {
    const file = path.join(PAGES_DIR, f);
    const page = applyTokens(readJson(file), tokens);
    page.file = file;
    need(page, ['output'], `${f}`);
    const html = renderPage(page, ctx);
    fs.writeFileSync(path.join(ROOT, page.output), html);
    pagesBuilt.push(page);
    written.push(`${f}  →  ${page.output}`);
  }
  written.push(...writeSeoFiles(site, pagesBuilt));
  if (!quiet) console.log(`✔ Built ${written.length} file${written.length > 1 ? 's' : ''}:\n  ${written.join('\n  ')}`);
  return written;
}

/* ---------------------------------------------------------------- sitemap.xml + robots.txt */
const pageUrl = (site, page) => `${(site.url || '').replace(/\/$/, '')}/${page.output === HOME_OUTPUT ? '' : page.output}`; // same as the canonical
const isoDay = d => d.toISOString().slice(0, 10);

/* <lastmod> = when the page's content really changed (not the build time):
   uncommitted edits -> today; otherwise the date of the last commit that touched the page JSON;
   if git isn't available (e.g. a shallow CI clone) keep the date already in sitemap.xml. */
function lastModified(file, previous) {
  const rel = path.relative(ROOT, file);
  try {
    const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (git(['status', '--porcelain', '--', rel])) return isoDay(new Date());
    const committed = git(['log', '-1', '--format=%cI', '--', rel]);
    if (committed) return isoDay(new Date(committed));
  } catch { /* no git */ }
  return previous || isoDay(new Date());
}

function writeSeoFiles(site, pages) {
  if (!site.url) fail('site.json → "url" is needed to build sitemap.xml and robots.txt (e.g. "https://lordevs.com")');
  const base = site.url.replace(/\/$/, '');
  const sitemapFile = path.join(ROOT, 'sitemap.xml');
  const previous = {};
  if (fs.existsSync(sitemapFile)) {
    for (const m of fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) previous[m[1]] = m[2];
  }
  const entries = pages
    .filter(p => !(p.meta && p.meta.noindex))                     // only indexable pages
    .map(p => ({ loc: pageUrl(site, p), lastmod: lastModified(p.file, previous[pageUrl(site, p)]) }))
    .sort((a, b) => a.loc.length - b.loc.length);                 // home page first
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by build.mjs - lists every page in content/pages/ that is not "noindex" -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>\n    <loc>${attr(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(sitemapFile, xml);

  const robots = `# GENERATED by build.mjs
# All search engines and AI search crawlers (Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, ...) are welcome.
User-agent: *
Allow: /
Disallow: /content/

Sitemap: ${base}/sitemap.xml
`;
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
  return [`sitemap.xml  (${entries.length} URL${entries.length === 1 ? '' : 's'})`, 'robots.txt'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { build(); }
  catch (e) {
    if (e instanceof ContentError) { console.error(`\n✖ Content problem\n  ${e.message}\n`); process.exit(1); }
    throw e;
  }
}
export { ContentError };
export const META = { icons: ICONS, sectionTypes: Object.keys(SECTIONS) };
