/* =====================================================================
   Lordevs CMS – admin app (vanilla JS, no build step)
   Talks to dev.mjs:  GET /api/content · PUT /api/site · PUT/POST/DELETE /api/pages
   ===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------ tiny helpers */
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); let c = o; for (const k of ks) { if (c[k] == null || typeof c[k] !== 'object') c[k] = {}; c = c[k]; } c[last] = v; };
  const delPath = (o, p) => { const ks = p.split('.'), last = ks.pop(); const c = ks.length ? getPath(o, ks.join('.')) : o; if (c && typeof c === 'object') delete c[last]; };
  const ensureObj = (o, p) => { let v = getPath(o, p); if (v == null || typeof v !== 'object') { v = {}; setPath(o, p, v); } return v; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const strip = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pageLabel = (p, name) => p.output === 'index.html' ? 'Home' : ((p.meta && p.meta.title) ? p.meta.title.split(' – ')[0] : name);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  const UI = {
    page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    ext: '<path d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0 1 5M20 4v7h-7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6A17 17 0 0 0 2 12s4 7 10 7a9.700 9.700 0 0 0 4.200-.9"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.500v.01"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    tablet: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>'
  };
  const ico = (name, cls = '') => h('span', { class: cls, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[name] || ''}</svg>` });
  const siteIco = (name, cls = '') => h('span', { class: cls, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(S.meta.icons || {})[name] || ''}</svg>` });

  /* ------------------------------------------------------------ state + API */
  const S = { data: null, meta: { icons: {}, sectionTypes: [] }, cur: null, obj: null, saved: '', view: 'form', open: new WeakSet(), device: 'desktop', showPreview: true };

  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CMS': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
    try { return await res.json(); } catch { return { ok: false, error: `Server returned ${res.status}` }; }
  }
  const isDirty = () => !!S.obj && JSON.stringify(S.obj) !== S.saved;

  /* ------------------------------------------------------------ toast + modal */
  function toast(kind, msg, detail) {
    const el = h('div', { class: `toast ${kind}` }, ico(kind === 'ok' ? 'ok' : 'alert'), h('div', {}, msg, detail && h('pre', {}, detail)));
    $('#toasts').append(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, kind === 'ok' ? 2600 : 9000);
  }
  function modal(content, { small = false } = {}) {
    const back = h('div', { class: 'modal', onClick: e => { if (e.target === back) close(); } }, h('div', { class: `modal__card${small ? ' is-sm' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content));
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', onKey); back.remove(); }
    document.addEventListener('keydown', onKey);
    $('#modal-root').append(back);
    const first = back.querySelector('input,select,button.type'); if (first) first.focus();
    return { close };
  }

  /* ------------------------------------------------------------ schema helpers */
  const T = (key, label, o = {}) => ({ type: 'text', key, label, ...o });
  const TA = (key, label, o = {}) => ({ type: 'textarea', key, label, rows: 3, ...o });
  const N = (key, label, o = {}) => ({ type: 'number', key, label, ...o });
  const SEL = (key, label, options, o = {}) => ({ type: 'select', key, label, options, ...o });
  const BOOL = (key, label, o = {}) => ({ type: 'bool', key, label, ...o });
  const COLOR = (key, label, o = {}) => ({ type: 'color', key, label, ...o });
  const ICON = (key = 'icon', label = 'Icon', o = {}) => ({ type: 'icon', key, label, half: true, ...o });
  const GROUP = (key, label, fields, o = {}) => ({ type: 'group', key, label, fields, ...o });
  const LIST = (key, label, fields, newItem, o = {}) => ({ type: 'list', key, label, fields, newItem, ...o });
  const STR = (key, label, o = {}) => ({ type: 'strings', key, label, ...o });
  const STYLE = (o = {}) => SEL('style', 'Card colour', [['yellow', 'Yellow'], ['stone', 'Stone'], ['cream', 'Cream'], ['dark', 'Dark']], { half: true, ...o });
  const HEAD = () => [T('tag', 'Small label', { half: true, help: 'Tiny tag above the title' }), T('title', 'Title', { half: true, help: 'Use <br> for a line break' })];
  const LEAD = () => TA('lead', 'Intro line', { rows: 2 });
  const RICH = 'Allowed: <b>bold</b>, <i>italic</i>, <br>, <mark>highlight</mark>, <a href="…">link</a>';

  /* section definitions: label, description, icon (from the site's icon set), form fields, defaults for "Add section" */
  const DEFS = {
    hero: { label: 'Hero', icon: 'rocket', desc: 'Big headline, intro text, main button and client logos.',
      fields: [
        GROUP('title', 'Headline', [T('line1', 'Line 1', { half: true }), T('line2', 'Line 2', { half: true, help: 'Wrap a word in <mark>…</mark> to highlight it' })]),
        TA('subtitle', 'Intro text', { help: RICH }),
        GROUP('cta', 'Main button', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true })]),
        GROUP('proof', 'Social proof', [T('rating', 'Rating (e.g. 4.9)', { half: true }), T('text', 'Text', { half: true })]),
        T('logosTitle', 'Logos heading'),
        STR('logos', 'Client names')
      ],
      make: () => ({ type: 'hero', title: { line1: 'Your headline,', line2: 'goes <mark>here</mark>.' }, subtitle: 'A short sentence about what you do.', cta: { label: 'Get in touch', href: '#book' }, proof: { rating: '5.0', text: 'Trusted by clients' }, logosTitle: '', logos: [] }) },
    workStrip: { label: 'Work strip', icon: 'monitor', desc: 'Scrolling row of project cards.',
      fields: [LIST('items', 'Projects', [T('tag', 'Type', { half: true }), T('name', 'Project name', { half: true }), SEL('mock', 'Preview style', [['browser', 'Website'], ['phone', 'Mobile app'], ['chart', 'Chart'], ['shop', 'Shop']], { half: true }), SEL('theme', 'Card colour', [[1, 'Yellow'], [2, 'Black'], [3, 'Cream'], [4, 'Stone'], [5, 'Dark gold']], { half: true, number: true })], { tag: 'Business Website', name: 'New project', mock: 'browser', theme: 1 })],
      make: () => ({ type: 'workStrip', items: [{ tag: 'Business Website', name: 'New project', mock: 'browser', theme: 1 }] }) },
    about: { label: 'About & stats', icon: 'users', desc: 'Statement that fills in as you scroll, plus the stats grid.',
      fields: [
        TA('statement', 'Statement', { help: RICH }),
        GROUP('stats.projects', 'Stat 1 – big yellow tile', [N('value', 'Number', { half: true }), T('suffix', 'Suffix (+ % X)', { half: true }), T('title', 'Title'), TA('text', 'Text', { rows: 2 })]),
        GROUP('stats.clients', 'Happy clients badge', [T('text', 'Text')]),
        GROUP('stats.satisfaction', 'Stat 2 – cream tile', [N('value', 'Number', { half: true }), T('suffix', 'Suffix', { half: true }), T('title', 'Title'), TA('text', 'Text', { rows: 2 })]),
        GROUP('stats.growth', 'Stat 3 – grey tile', [N('value', 'Number', { half: true }), T('suffix', 'Suffix', { half: true }), T('title', 'Title'), TA('text', 'Text', { rows: 2 })]),
        GROUP('stats.countries', 'Wide tile', [T('title', 'Title'), TA('text', 'Text', { rows: 2 }), STR('dots', 'Dot colours (hex)', { color: true })])
      ],
      make: () => ({ type: 'about', statement: 'We build things that matter – <span>and we do it well.</span>', stats: { projects: { value: 100, suffix: '+', title: 'Projects', text: 'Delivered on time.' }, clients: { text: '25+ happy clients' }, satisfaction: { value: 98, suffix: '%', title: 'Satisfaction', text: 'Happy clients.' }, growth: { value: 3, suffix: 'X', title: 'Growth', text: 'Average result.' }, countries: { title: 'Clients worldwide', text: 'Across many countries.', dots: ['#0B0B0B', '#FFC21A', '#fff'] } } }) },
    techBand: { label: 'Tech band', icon: 'code', desc: 'Yellow scrolling strip of tools and platforms.',
      fields: [STR('items', 'Items')],
      make: () => ({ type: 'techBand', items: ['WordPress', 'Next.js'] }) },
    services: { label: 'Services', icon: 'layers', desc: 'Rows describing what you offer.',
      fields: [...HEAD(), LEAD(), LIST('items', 'Services', [ICON(), STYLE(), T('title', 'Title'), TA('text', 'Description'), T('linkLabel', 'Button text', { half: true }), T('linkHref', 'Button link', { half: true })], { icon: 'globe', style: 'yellow', title: 'New service', text: 'Describe it here.', linkLabel: 'Learn more', linkHref: '#book' })],
      make: () => ({ type: 'services', tag: 'Services', title: 'What we do', lead: '', items: [{ icon: 'globe', style: 'yellow', title: 'New service', text: 'Describe it here.', linkLabel: 'Learn more', linkHref: '#book' }] }) },
    compare: { label: 'Comparison', icon: 'check', desc: 'Dark section: other agencies vs. you.',
      fields: [...HEAD(), GROUP('other', 'Left card (others)', [T('title', 'Title'), STR('items', 'Points')]), GROUP('us', 'Right card (you)', [T('title', 'Title'), STR('items', 'Points')]), T('trustedText', 'Logos heading'), STR('logos', 'Client names')],
      make: () => ({ type: 'compare', tag: 'Comparison', title: 'Why choose us?', other: { title: 'Others', items: ['Point one'] }, us: { title: 'Us', items: ['Point one'] }, trustedText: '', logos: [] }) },
    why: { label: 'Why it matters', icon: 'bolt', desc: 'Grid of benefit cards.',
      fields: [...HEAD(), LIST('cards', 'Cards', [ICON(), STYLE(), T('title', 'Title'), TA('text', 'Text', { rows: 2 }), BOOL('wide', 'Wide card (shows a link + big icon)'), T('linkLabel', 'Link text', { half: true }), T('linkHref', 'Link', { half: true })], { icon: 'bolt', style: 'cream', title: 'New card', text: 'Describe the benefit.' })],
      make: () => ({ type: 'why', tag: 'Why it matters', title: 'Why it matters', cards: [{ icon: 'bolt', style: 'cream', title: 'New card', text: 'Describe the benefit.' }] }) },
    testimonials: { label: 'Testimonials', icon: 'star', desc: 'Customer quotes.',
      fields: [...HEAD(), LIST('items', 'Quotes', [SEL('variant', 'Layout', [['', 'Normal'], ['hero', 'Large (left)'], ['accent', 'Yellow (wide)']], { half: true }), T('logo', 'Company logo text', { half: true }), TA('quote', 'Quote'), T('name', 'Name', { half: true }), T('role', 'Role', { half: true }), COLOR('avatarBg', 'Avatar colour', { half: true }), COLOR('avatarColor', 'Avatar letter colour', { half: true })], { quote: 'What a great experience!', name: 'Customer Name', role: 'Role', avatarBg: '#FFC21A' })],
      make: () => ({ type: 'testimonials', tag: 'Testimonials', title: 'What clients say', items: [{ quote: 'What a great experience!', name: 'Customer Name', role: 'Role', avatarBg: '#FFC21A' }] }) },
    process: { label: 'Process', icon: 'trending', desc: 'Numbered steps with a button.',
      fields: [...HEAD(), LEAD(), LIST('steps', 'Steps (numbered automatically)', [ICON(), T('title', 'Title', { half: true }), TA('text', 'Text', { rows: 2 })], { icon: 'check', title: 'New step', text: 'Describe the step.' }), GROUP('cta', 'Button', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true })])],
      make: () => ({ type: 'process', tag: 'Process', title: 'How it works', lead: '', steps: [{ icon: 'check', title: 'Step one', text: 'Describe the step.' }], cta: { label: 'Get started', href: '#book' } }) },
    booking: { label: 'Booking', icon: 'clock', desc: 'Dark section with the calendar and time slots.',
      fields: [...HEAD(), GROUP('panel', 'Left panel', [T('host', 'Host name', { half: true }), T('subtitle', 'Subtitle', { half: true }), T('title', 'Meeting title'), STR('details', 'Details')]), STR('timeSlots', 'Time slots (e.g. 09:00 AM)'), T('confirmLabel', 'Confirm button', { half: true }), T('emailSubject', 'Email subject', { half: true }), T('email', 'Send bookings to (optional)', { help: 'Leave empty to use the main contact email' })],
      make: () => ({ type: 'booking', tag: 'Free Consultation', title: 'Let\'s talk', panel: { host: 'Our Team', subtitle: 'Strategy Call', title: '30 Min Meeting', details: ['⏱ 30 min', '💻 Google Meet'] }, timeSlots: ['09:00 AM', '10:00 AM'], confirmLabel: 'Confirm booking', emailSubject: 'Consultation request' }) },
    faq: { label: 'FAQ', icon: 'chat', desc: 'Accordion of questions and answers.',
      fields: [...HEAD(), LIST('items', 'Questions', [T('q', 'Question'), TA('a', 'Answer', { rows: 4, help: RICH })], { q: 'New question?', a: 'Answer here.' }, { itemTitle: it => it.q })],
      make: () => ({ type: 'faq', tag: 'FAQ', title: 'Questions & answers', items: [{ q: 'New question?', a: 'Answer here.' }] }) },
    legal: { label: 'Legal text', icon: 'shield', desc: 'Long text page (privacy, terms…).',
      fields: [T('title', 'Page title', { half: true }), T('updated', 'Last updated', { half: true }), LIST('blocks', 'Blocks', [T('heading', 'Heading'), STR('paragraphs', 'Paragraphs', { textarea: true }), STR('list', 'Bullet list', { textarea: true })], { heading: 'New heading', paragraphs: ['Text…'] }, { itemTitle: b => b.heading || 'Intro' })],
      make: () => ({ type: 'legal', title: 'Legal page', updated: '', blocks: [{ heading: 'First heading', paragraphs: ['Text…'] }] }) }
  };

  const SITE_FIELDS = [
    { type: 'section', label: 'Brand', fields: [
      GROUP('brand', 'Brand & logos', [T('name', 'Company name', { half: true }), T('footerWordmark', 'Big footer word', { half: true }), T('logo', 'Logo (light text, for dark backgrounds)', { help: 'File path, e.g. assets/logo.svg' }), T('logoDark', 'Logo (dark text, for white backgrounds)'), T('logoMark', 'Logo mark only (favicon, small spots)')]),
      T('url', 'Website address', { help: 'Used for SEO (canonical links). Example: https://lordevs.com' }),
      T('themeColor', 'Browser theme colour', { half: true }), T('language', 'Language code', { half: true })] },
    { type: 'section', label: 'Contact', fields: [
      GROUP('contact', 'Contact details (used everywhere)', [T('email', 'Email'), T('whatsappDisplay', 'WhatsApp number (as shown)', { half: true }), T('whatsappNumber', 'WhatsApp number (digits only)', { half: true, help: 'e.g. 923071257828 – no + or spaces' })])] },
    { type: 'section', label: 'Menu', fields: [
      GROUP('navigation.cta', 'Menu button', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true })]),
      LIST('navigation.links', 'Menu links', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true, help: 'Use #services for a section, or a page like about.html' })], { label: 'New link', href: '#' })] },
    { type: 'section', label: 'Footer', fields: [
      LIST('footer.columns', 'Footer columns', [T('title', 'Column title'), LIST('links', 'Links', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true }), BOOL('external', 'Open in new tab', { sm: true }), BOOL('accent', 'Highlight in yellow', { sm: true })], { label: 'New link', href: '#' })], { title: 'New column', links: [] }),
      T('footer.copyright', 'Copyright line', { help: 'Use {{year}} for the current year' }),
      LIST('footer.legalLinks', 'Legal links', [T('label', 'Label', { half: true }), T('href', 'Link', { half: true })], { label: 'Privacy Policy', href: 'privacy.html' })] },
    { type: 'section', label: 'Cookie banner', fields: [
      GROUP('cookieBanner', 'Cookie & privacy banner', [BOOL('enabled', 'Show the banner'), T('title', 'Bold lead-in'), TA('text', 'Text', { rows: 3 }), T('policyLabel', 'Policy link text', { half: true }), T('policyHref', 'Policy link', { half: true }), T('acceptLabel', 'Accept button', { half: true }), T('declineLabel', 'Decline button', { half: true })])] },
    { type: 'section', label: 'Social proof avatars', fields: [
      LIST('avatars', 'Avatars (the little coloured circles)', [T('letter', 'Letter', { half: true }), COLOR('bg', 'Background', { half: true }), COLOR('color', 'Letter colour', { half: true })], { letter: 'A', bg: '#FFC21A' }, { itemTitle: a => a.letter })] }
  ];

  /* ------------------------------------------------------------ field renderers */
  function fieldWrap(f, control) {
    return h('label', { class: `field${f.half ? ' field--half' : ''}` },
      h('span', { class: 'field__label' }, f.label, f.optional && h('em', {}, 'optional')), control, f.help && h('span', { class: 'field__help' }, f.help));
  }

  function renderFields(fields, data, onChange) {
    const wrap = h('div', { class: 'fields' });
    for (const f of fields) wrap.append(renderField(f, data, onChange));
    return wrap;
  }

  function renderField(f, data, onChange) {
    const val = () => getPath(data, f.key);
    const put = v => { setPath(data, f.key, v); onChange(); };

    switch (f.type) {
      case 'group': {
        const sub = ensureObj(data, f.key);
        return h('fieldset', { class: 'group' }, f.label && h('legend', {}, f.label), renderFields(f.fields, sub, onChange));
      }
      case 'list': return listField(f, data, onChange);
      case 'strings': return stringsField(f, data, onChange);
      case 'bool': {
        const input = h('input', { type: 'checkbox', onChange: e => put(e.target.checked) });
        input.checked = val() !== false && val() != null ? !!val() : false;
        return h('label', { class: `switch${f.sm ? ' is-sm' : ''}` }, input, h('span', { class: 'switch__track' }), f.label);
      }
      case 'select': {
        const sel = h('select', { class: 'select', onChange: e => {
          let v = e.target.value;
          if (f.number) v = +v;
          if (v === '') { delPath(data, f.key); onChange(); } else put(v);
        } }, f.options.map(([v, l]) => h('option', { value: v }, l)));
        sel.value = val() == null ? '' : String(val());
        if (sel.value === '' && val() != null) sel.append(h('option', { value: val(), selected: true }, String(val())));
        return fieldWrap(f, sel);
      }
      case 'number': {
        const inp = h('input', { class: 'input', type: 'number', onInput: e => put(e.target.value === '' ? '' : +e.target.value) });
        inp.value = val() ?? '';
        return fieldWrap(f, inp);
      }
      case 'textarea': {
        const ta = h('textarea', { class: 'textarea', rows: f.rows || 3, onInput: e => put(e.target.value) });
        ta.value = val() ?? '';
        return fieldWrap(f, ta);
      }
      case 'color': {
        const text = h('input', { class: 'input mono', placeholder: '#FFC21A', onInput: e => { put(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) pick.value = e.target.value; } });
        const pick = h('input', { type: 'color', onInput: e => { text.value = e.target.value.toUpperCase(); put(text.value); } });
        text.value = val() ?? ''; pick.value = /^#[0-9a-f]{6}$/i.test(text.value) ? text.value : '#ffc21a';
        return fieldWrap(f, h('div', { class: 'colorrow' }, pick, text));
      }
      case 'icon': return fieldWrap(f, iconPicker(val() || '', v => put(v)));
      default: {
        const inp = h('input', { class: 'input', type: 'text', placeholder: f.placeholder || '', onInput: e => put(e.target.value) });
        inp.value = val() ?? '';
        return fieldWrap(f, inp);
      }
    }
  }

  function iconPicker(current, onPick) {
    const names = Object.keys(S.meta.icons);
    const glyph = h('span', { class: 'iconpick__glyph' });
    const label = h('span', {});
    const setCur = v => { glyph.replaceChildren(siteIco(v)); label.textContent = v || 'Choose an icon'; };
    setCur(current);
    let pop = null;
    const close = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', outside, true); } };
    const outside = e => { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) close(); };
    const btn = h('button', { type: 'button', class: 'iconpick__btn', onClick: e => {
      e.preventDefault();
      if (pop) return close();
      pop = h('div', { class: 'iconpick__pop' }, names.map(n => h('button', { type: 'button', class: `iconpick__opt${n === current ? ' is-on' : ''}`, title: n, onClick: ev => { ev.preventDefault(); current = n; setCur(n); onPick(n); close(); } }, siteIco(n))));
      wrap.append(pop);
      document.addEventListener('mousedown', outside, true);
    } }, glyph, label);
    const wrap = h('div', { class: 'iconpick' }, btn);
    return wrap;
  }

  /* ---- lists of objects ---- */
  function moveItem(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; }

  function listField(f, data, onChange) {
    let arr = getPath(data, f.key);
    if (!Array.isArray(arr)) { arr = []; setPath(data, f.key, arr); }
    const body = h('div', { class: 'list' });
    const render = () => {
      body.replaceChildren(
        h('div', { class: 'list__label' }, f.label, h('em', {}, `${arr.length} item${arr.length === 1 ? '' : 's'}`)),
        ...arr.map((item, i) => itemCard(item, i)),
        h('button', { type: 'button', class: 'add', onClick: () => { const n = clone(f.newItem || {}); arr.push(n); S.open.add(n); onChange(); render(); } }, ico('plus'), `Add ${f.label.replace(/ \(.*\)/, '').replace(/s$/, '').toLowerCase()}`)
      );
    };
    const itemCard = (item, i) => {
      const title = (f.itemTitle ? f.itemTitle(item, i) : (item.title || item.name || item.q || item.label || item.tag || item.heading || item.letter)) || `Item ${i + 1}`;
      const sub = f.itemSub ? f.itemSub(item) : (item.text || item.role || item.a || item.href || '');
      const open = S.open.has(item);
      const card = h('div', { class: `item${open ? ' is-open' : ''}` });
      const tool = (name, label, fn, cls = '') => h('button', { type: 'button', class: `icon-btn ${cls}`, title: label, 'aria-label': label, onClick: e => { e.stopPropagation(); fn(); } }, ico(name));
      card.append(
        h('div', { class: 'item__head', onClick: () => { open ? S.open.delete(item) : S.open.add(item); render(); } },
          h('span', { class: 'item__n' }, i + 1),
          h('div', { class: 'item__title' }, strip(title), sub && h('small', {}, strip(sub).slice(0, 80))),
          h('div', { class: 'item__tools' },
            tool('up', 'Move up', () => { if (moveItem(arr, i, -1)) { onChange(); render(); } }),
            tool('down', 'Move down', () => { if (moveItem(arr, i, 1)) { onChange(); render(); } }),
            tool('copy', 'Duplicate', () => { const c = clone(item); arr.splice(i + 1, 0, c); S.open.add(c); onChange(); render(); }),
            tool('trash', 'Delete', () => { if (confirm('Delete this item?')) { arr.splice(i, 1); onChange(); render(); } }, 'danger')),
          ico('down', 'item__chev icon-btn'))
      );
      if (open) card.append(h('div', { class: 'item__body' }, renderFields(f.fields, item, () => { onChange(); })));
      return card;
    };
    render();
    return body;
  }

  /* ---- lists of strings ---- */
  function stringsField(f, data, onChange) {
    let arr = getPath(data, f.key);
    if (!Array.isArray(arr)) { arr = []; setPath(data, f.key, arr); }
    const body = h('div', { class: 'list' });
    const render = () => {
      body.replaceChildren(
        h('div', { class: 'list__label' }, f.label, h('em', {}, `${arr.length}`)),
        ...arr.map((s, i) => {
          const inp = f.textarea
            ? h('textarea', { class: 'textarea', rows: 3, onInput: e => { arr[i] = e.target.value; onChange(); } })
            : h('input', { class: 'input', type: 'text', onInput: e => { arr[i] = e.target.value; onChange(); } });
          inp.value = s;
          const tb = (n, label, fn, cls = '') => h('button', { type: 'button', class: `icon-btn ${cls}`, title: label, 'aria-label': label, onClick: fn }, ico(n));
          const swatch = f.color ? h('input', { type: 'color', style: 'width:38px;height:38px;border:1.5px solid var(--line);border-radius:10px;padding:2px;background:#fff;flex:none', value: /^#[0-9a-f]{6}$/i.test(s) ? s : '#ffc21a', onInput: e => { arr[i] = e.target.value.toUpperCase(); inp.value = arr[i]; onChange(); } }) : null;
          return h('div', { class: 'strrow', style: f.textarea ? 'align-items:flex-start' : '' }, swatch, inp,
            tb('up', 'Move up', () => { if (moveItem(arr, i, -1)) { onChange(); render(); } }),
            tb('down', 'Move down', () => { if (moveItem(arr, i, 1)) { onChange(); render(); } }),
            tb('trash', 'Remove', () => { arr.splice(i, 1); onChange(); render(); }, 'danger'));
        }),
        h('button', { type: 'button', class: 'add', onClick: () => { arr.push(f.color ? '#FFC21A' : ''); onChange(); render(); const ins = body.querySelectorAll('.input,.textarea'); ins[ins.length - 1]?.focus(); } }, ico('plus'), 'Add')
      );
    };
    render();
    return body;
  }

  /* ------------------------------------------------------------ preview panel */
  const PV = {
    widths: { desktop: 1280, tablet: 820, mobile: 390 }, url: '', frame: null, stage: null, box: null, loading: null, urlEl: null, ext: null,
    init() {
      const mk = (d, name, label) => h('button', { title: label, 'aria-label': label, class: S.device === d ? 'is-on' : '', onClick: e => { S.device = d; $('#prev .seg').querySelectorAll('button').forEach(b => b.classList.remove('is-on')); e.currentTarget.classList.add('is-on'); PV.fit(); } }, ico(name));
      this.urlEl = h('div', { class: 'prev__url' });
      this.ext = h('a', { class: 'icon-btn', target: '_blank', rel: 'noopener', title: 'Open in a new tab' }, ico('ext'));
      this.frame = h('iframe', { title: 'Live preview', onLoad: () => this.loading.classList.add('is-hidden') });
      this.loading = h('div', { class: 'prev__loading' }, 'Loading preview…');
      this.box = h('div', { class: 'prev__frame' }, this.frame, this.loading);
      this.stage = h('div', { class: 'prev__stage' }, this.box);
      $('#prev').replaceChildren(
        h('div', { class: 'prev__bar' }, h('b', {}, 'Preview'),
          h('div', { class: 'seg' }, mk('desktop', 'monitor', 'Desktop'), mk('tablet', 'tablet', 'Tablet'), mk('mobile', 'phone', 'Mobile')),
          this.urlEl,
          h('button', { class: 'icon-btn', title: 'Reload preview', 'aria-label': 'Reload preview', onClick: () => this.reload() }, ico('refresh')), this.ext),
        this.stage);
      new ResizeObserver(() => this.fit()).observe(this.stage);
    },
    load(url) {
      if (this.url === url) return;
      this.url = url; this.loading.classList.remove('is-hidden');
      this.frame.src = url + (url.includes('?') ? '&' : '?') + 'cms-preview=1';
      this.urlEl.textContent = 'localhost' + (url.startsWith('/') ? url : '/' + url);
      this.ext.href = url;
    },
    fit() {
      if (!this.stage) return;
      const w = this.widths[S.device], sw = this.stage.clientWidth - 36, sh = this.stage.clientHeight - 36;
      if (sw <= 0 || sh <= 0) return;
      const scale = Math.min(1, sw / w);
      this.box.style.width = Math.round(w * scale) + 'px';
      this.box.style.height = Math.round(sh) + 'px';
      this.frame.style.width = w + 'px';
      this.frame.style.height = Math.round(sh / scale) + 'px';
      this.frame.style.transform = `scale(${scale})`;
    },
    reload() {
      const win = this.frame.contentWindow; let y = 0;
      try { y = win.scrollY; } catch (e) {}
      this.loading.classList.remove('is-hidden');
      this.frame.addEventListener('load', () => { [60, 250, 700, 1400].forEach(t => setTimeout(() => { try { this.frame.contentWindow.scrollTo(0, y); } catch (e) {} }, t)); }, { once: true });
      try { win.location.reload(); } catch (e) { this.frame.src = this.frame.src; }
    },
    scrollToSection(i) {
      try {
        const doc = this.frame.contentDocument; const el = doc.querySelectorAll('main > *')[i];
        if (el) doc.defaultView.scrollTo({ top: el.getBoundingClientRect().top + doc.defaultView.scrollY - 90, behavior: 'smooth' });
      } catch (e) {}
    }
  };

  /* ------------------------------------------------------------ navigation / selection */
  function pageOutput() {
    const home = Object.values(S.data.pages).find(p => p.output === 'index.html');
    if (S.cur.kind === 'page') return S.obj.output || 'index.html';
    return home ? home.output : 'index.html';
  }

  function go(target) {
    if (S.cur && S.cur.kind === target.kind && S.cur.name === target.name) return;
    if (isDirty() && !confirm('You have unsaved changes on this page. Discard them?')) return;
    S.cur = target;
    S.obj = clone(target.kind === 'site' ? S.data.site : S.data.pages[target.name]);
    S.saved = JSON.stringify(S.obj);
    S.view = 'form';
    renderAll();
    PV.load('/' + pageOutput());
  }

  /* ------------------------------------------------------------ sidebar + topbar */
  let statusEl, saveBtn;
  function renderSide() {
    const pages = Object.entries(S.data.pages).sort((a, b) => (a[1].output === 'index.html' ? -1 : b[1].output === 'index.html' ? 1 : a[0].localeCompare(b[0])));
    const item = (kind, name, icoName, title, sub) => {
      const on = S.cur && S.cur.kind === kind && S.cur.name === name;
      return h('button', { class: `nav-item${on ? ' is-active' : ''}`, onClick: () => go({ kind, name }) }, ico(icoName), h('span', {}, title, sub && h('small', {}, sub)), on && isDirty() && h('i', { class: 'dot', title: 'Unsaved changes' }));
    };
    $('#side').replaceChildren(
      h('div', { class: 'side__brand' }, h('img', { src: '/' + S.data.site.brand.logo, alt: S.data.site.brand.name }), h('span', { class: 'side__badge' }, 'CMS')),
      h('h4', {}, 'Pages'),
      ...pages.map(([name, p]) => item('page', name, 'page', pageLabel(p, name), p.output)),
      h('button', { class: 'nav-item side__add', onClick: newPageModal }, ico('plus'), 'New page'),
      h('h4', {}, 'Settings'),
      item('site', 'site', 'gear', 'Site settings', 'Logo, contact, menu, footer'),
      h('div', { class: 'side__foot' }, 'Changes save to ', h('b', {}, 'content/*.json'), ' and rebuild the site instantly.', h('br'), h('a', { href: '/' + pageOutput(), target: '_blank', rel: 'noopener' }, 'View live site ↗'))
    );
  }

  function renderTop() {
    statusEl = h('div', { class: 'status' }, h('i'), h('span', {}, 'All changes saved'));
    saveBtn = h('button', { class: 'btn btn--primary', onClick: save }, ico('save'), 'Save');
    const crumbKind = S.cur.kind === 'site' ? 'Settings' : 'Pages';
    const crumbName = S.cur.kind === 'site' ? 'Site settings' : pageLabel(S.obj, S.cur.name);
    $('#top').replaceChildren(
      h('div', { class: 'crumb' }, h('span', {}, crumbKind + ' /'), h('b', {}, crumbName)),
      statusEl, h('div', { class: 'top__sp' }),
      h('div', { class: 'seg' }, ...['form', 'json'].map(v => h('button', { class: S.view === v ? 'is-on' : '', onClick: () => switchView(v) }, v === 'form' ? 'Form' : 'JSON'))),
      h('button', { class: 'icon-btn', title: 'Show / hide preview', 'aria-label': 'Toggle preview', onClick: () => { S.showPreview = !S.showPreview; $('#app').classList.toggle('no-prev', !S.showPreview); setTimeout(() => PV.fit(), 50); } }, ico('panel')),
      saveBtn);
    updateStatus();
  }

  function updateStatus() {
    if (!statusEl) return;
    const d = isDirty();
    statusEl.classList.toggle('is-dirty', d);
    statusEl.lastChild.textContent = d ? 'Unsaved changes' : 'All changes saved';
    saveBtn.disabled = !d && S.view !== 'json';
    const active = document.querySelector('.nav-item.is-active'); if (active) { const dot = active.querySelector('.dot'); if (d && !dot) active.append(h('i', { class: 'dot' })); if (!d && dot) dot.remove(); }
  }

  /* ------------------------------------------------------------ editors */
  const changed = () => updateStatus();

  function renderEditor() {
    const root = h('div', { class: 'edit__inner' });
    if (S.view === 'json') root.append(jsonEditor());
    else if (S.cur.kind === 'site') root.append(siteEditor());
    else root.append(pageEditor());
    $('#edit').replaceChildren(root);
  }

  function jsonEditor() {
    const err = h('div', { class: 'jsonerr' });
    const ta = h('textarea', { class: 'jsonbox', spellcheck: 'false', onInput: e => { try { JSON.parse(e.target.value); err.textContent = ''; } catch (x) { err.textContent = 'Invalid JSON: ' + x.message; } } });
    ta.value = JSON.stringify(S.obj, null, 2);
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); } });
    S.jsonTa = ta; S.jsonErr = err;
    return h('div', {}, h('div', { class: 'callout' }, ico('alert'), h('div', {}, 'This is the raw file. Changes here are checked when you press ', h('b', {}, 'Save'), ' or switch back to Form.')), ta, err);
  }
  function applyJson() {
    try { S.obj = JSON.parse(S.jsonTa.value); return true; }
    catch (e) { S.jsonErr.textContent = 'Invalid JSON: ' + e.message; toast('err', 'Fix the JSON first', e.message); return false; }
  }
  function switchView(v) {
    if (v === S.view) return;
    if (S.view === 'json' && !applyJson()) return;
    S.view = v; renderTop(); renderEditor();
  }

  function siteEditor() {
    const root = h('div', {}, h('div', { class: 'callout' }, ico('alert'), h('div', {}, 'These settings are shared by every page – contact details, menu, footer and cookie banner.')));
    for (const sec of SITE_FIELDS) {
      root.append(h('div', { class: 'h-row' }, h('h3', {}, sec.label)),
        h('div', { class: 'card' }, h('div', { class: 'card__body' }, renderFields(sec.fields, S.obj, changed))));
    }
    return root;
  }

  function pageEditor() {
    const page = S.obj;
    const root = h('div', {});
    page.meta = page.meta || {};
    const desc = h('span', {});
    const upd = () => { const n = (page.meta.description || '').length; desc.textContent = `${n} characters` + (n > 160 ? ' – a bit long for Google' : n < 70 ? ' – a bit short' : ' – good length'); };
    upd();
    root.append(
      h('div', { class: 'card' },
        h('div', { class: 'card__head' }, h('div', {}, h('h2', {}, 'Page settings'), h('p', {}, 'What Google shows in search results.'))),
        h('div', { class: 'card__body' }, renderFields([
          T('meta.title', 'Page title', { help: 'Shown in the browser tab and Google (aim for under 60 characters)' }),
          TA('meta.description', 'Description', { rows: 3 }),
          BOOL('meta.noindex', 'Hide this page from search engines')], page, () => { upd(); changed(); }),
          h('div', { class: 'field__help', style: 'margin-top:6px' }, desc),
          h('div', { class: 'field__help', style: 'margin-top:12px' }, 'File: ', h('b', {}, page.output), ' · Layout: ', h('b', {}, page.layout || 'default')))));

    const head = h('div', { class: 'h-row' }, h('div', {}, h('h3', {}, 'Sections'), h('p', {}, 'Drag to reorder · click to edit · eye to hide')),
      h('button', { class: 'btn btn--ghost btn--sm', onClick: () => addSectionModal(list, render) }, ico('plus'), 'Add section'));
    const list = h('div', {});
    root.append(head, list);

    function render() {
      list.replaceChildren(...page.sections.map((s, i) => sectionCard(s, i, render)));
      if (!page.sections.length) list.append(h('div', { class: 'callout' }, ico('alert'), 'This page has no sections yet – add one to get started.'));
    }
    render();

    if (S.cur.name !== 'home') {
      root.append(h('div', { class: 'h-row' }, h('div', {}, h('h3', {}, 'Danger zone'))),
        h('div', { class: 'card' }, h('div', { class: 'card__body' }, h('button', { class: 'btn btn--danger', onClick: deletePage }, ico('trash'), 'Delete this page'),
          h('div', { class: 'field__help', style: 'margin-top:8px' }, 'Removes the page and its generated HTML file. A backup of the JSON is kept in content/.backups/.'))));
    }
    return root;
  }

  function sectionCard(sec, i, rerender) {
    const page = S.obj;
    const def = DEFS[sec.type] || { label: sec.type, icon: 'star', fields: null };
    const open = S.open.has(sec);
    const off = sec.enabled === false;
    const summary = strip((sec.title && sec.title.line1 ? sec.title.line1 + ' ' + (sec.title.line2 || '') : sec.title) || sec.tag || sec.statement || (sec.items && sec.items[0] && (sec.items[0].title || sec.items[0].name || sec.items[0].q)) || '');
    const card = h('div', { class: `sec${open ? ' is-open' : ''}${off ? ' is-off' : ''}` });
    const tool = (name, label, fn, cls = '') => h('button', { class: `icon-btn ${cls}`, title: label, 'aria-label': label, onClick: e => { e.stopPropagation(); fn(); } }, ico(name));
    const grip = h('span', { class: 'sec__grip', title: 'Drag to reorder', onMouseDown: () => { card.draggable = true; }, onMouseUp: () => { card.draggable = false; } }, ico('grip'));

    card.addEventListener('dragstart', e => { S.dragIdx = i; card.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) {} });
    card.addEventListener('dragend', () => { card.draggable = false; card.classList.remove('is-drag'); });
    card.addEventListener('dragover', e => { if (S.dragIdx == null) return; e.preventDefault(); card.classList.add('is-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('is-over'));
    card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('is-over'); const from = S.dragIdx; S.dragIdx = null; if (from == null || from === i) return; const [m] = page.sections.splice(from, 1); page.sections.splice(i, 0, m); changed(); rerender(); });

    card.append(h('div', { class: 'sec__head', onClick: () => {
      if (open) S.open.delete(sec); else { S.open.add(sec); const idx = page.sections.slice(0, i).filter(s => s.enabled !== false).length; if (page.layout !== 'legal') PV.scrollToSection(idx); }
      rerender();
    } },
      grip, siteIco(def.icon, 'sec__ico'),
      h('div', { class: 'sec__txt' }, h('b', {}, def.label, off && ' · hidden'), h('span', {}, summary || ' ')),
      h('div', { class: 'sec__tools' },
        tool(off ? 'eyeOff' : 'eye', off ? 'Show section' : 'Hide section', () => { if (off) delete sec.enabled; else sec.enabled = false; changed(); rerender(); }),
        tool('up', 'Move up', () => { if (moveItem(page.sections, i, -1)) { changed(); rerender(); } }),
        tool('down', 'Move down', () => { if (moveItem(page.sections, i, 1)) { changed(); rerender(); } }),
        tool('copy', 'Duplicate', () => { const c = clone(sec); page.sections.splice(i + 1, 0, c); S.open.add(c); changed(); rerender(); }),
        tool('trash', 'Delete section', () => { if (confirm(`Delete the "${def.label}" section?`)) { page.sections.splice(i, 1); changed(); rerender(); } }, 'danger'))));

    if (open) {
      const body = h('div', { class: 'sec__body' });
      if (def.fields) body.append(renderFields(def.fields, sec, changed));
      else {
        const ta = h('textarea', { class: 'jsonbox', style: 'min-height:260px', onInput: e => { try { const v = JSON.parse(e.target.value); Object.keys(sec).forEach(k => delete sec[k]); Object.assign(sec, v); changed(); } catch (x) {} } });
        ta.value = JSON.stringify(sec, null, 2);
        body.append(h('div', { class: 'callout', style: 'margin-top:16px' }, ico('alert'), 'Unknown section type – edit its raw JSON.'), ta);
      }
      card.append(body);
    }
    return card;
  }

  /* ------------------------------------------------------------ modals */
  function addSectionModal(list, rerender) {
    const page = S.obj;
    const types = Object.keys(DEFS).filter(t => (page.layout === 'legal') === (t === 'legal'));
    const m = modal([
      h('h3', {}, 'Add a section'), h('p', { class: 'sub' }, 'Pick a block – it is added to the end of the page and filled with sample content.'),
      h('div', { class: 'types' }, types.map(t => h('button', { class: 'type', onClick: () => {
        const sec = DEFS[t].make(); page.sections.push(sec); S.open.add(sec); changed(); rerender(); m.close();
        setTimeout(() => { const cards = $('#edit').querySelectorAll('.sec'); cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
      } }, siteIco(DEFS[t].icon, 'sec__ico'), h('div', {}, h('b', {}, DEFS[t].label), h('span', {}, DEFS[t].desc))))),
      h('div', { class: 'modal__foot' }, h('button', { class: 'btn btn--ghost', onClick: () => m.close() }, 'Cancel'))
    ]);
  }

  function newPageModal() {
    const title = h('input', { class: 'input', placeholder: 'e.g. About us' });
    const name = h('input', { class: 'input mono', placeholder: 'about' });
    let touched = false;
    name.addEventListener('input', () => { touched = true; });
    title.addEventListener('input', () => { if (!touched) name.value = slug(title.value); });
    const layout = h('select', { class: 'select' }, h('option', { value: 'default' }, 'Normal page (menu, sections, footer)'), h('option', { value: 'legal' }, 'Text page (privacy, terms…)'));
    const err = h('div', { class: 'jsonerr' });
    const m = modal([
      h('h3', {}, 'New page'), h('p', { class: 'sub' }, 'Creates content/pages/<name>.json and builds <name>.html.'),
      h('div', { class: 'fields' },
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Page title'), title),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'File name'), name, h('span', { class: 'field__help' }, 'Lowercase letters, numbers and dashes – becomes the web address.')),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Type'), layout)), err,
      h('div', { class: 'modal__foot' }, h('button', { class: 'btn btn--ghost', onClick: () => m.close() }, 'Cancel'),
        h('button', { class: 'btn btn--primary', onClick: async () => {
          const r = await api('POST', '/api/pages', { name: name.value.trim(), title: title.value.trim(), layout: layout.value });
          if (!r.ok) { err.textContent = r.error; return; }
          m.close(); await reloadData(); go({ kind: 'page', name: r.name }); toast('ok', 'Page created');
        } }, 'Create page'))
    ], { small: true });
    title.focus();
  }

  async function deletePage() {
    if (!confirm(`Delete the page "${S.cur.name}"? This removes its JSON and generated HTML (a backup is kept).`)) return;
    const r = await api('DELETE', `/api/pages/${S.cur.name}`);
    if (!r.ok) return toast('err', 'Could not delete', r.error);
    S.obj = null; S.saved = ''; S.cur = null;
    await reloadData(); toast('ok', 'Page deleted');
    go({ kind: 'page', name: 'home' });
  }

  /* ------------------------------------------------------------ save */
  async function save() {
    if (!S.cur) return;
    if (S.view === 'json' && !applyJson()) return;
    if (!isDirty() && S.view !== 'json') return;
    saveBtn.disabled = true; saveBtn.lastChild.textContent = 'Saving…';
    const url = S.cur.kind === 'site' ? '/api/site' : `/api/pages/${S.cur.name}`;
    let r;
    try { r = await api('PUT', url, S.obj); } catch (e) { r = { ok: false, error: e.message }; }
    saveBtn.lastChild.textContent = 'Save';
    if (!r.ok) { updateStatus(); toast('err', 'Not saved – the site would break', r.error); return; }
    S.saved = JSON.stringify(S.obj);
    if (S.cur.kind === 'site') S.data.site = clone(S.obj); else S.data.pages[S.cur.name] = clone(S.obj);
    updateStatus(); renderSide(); PV.reload();
    toast('ok', 'Saved – site rebuilt');
  }

  /* ------------------------------------------------------------ boot */
  function renderAll() { renderSide(); renderTop(); renderEditor(); }
  async function reloadData() {
    const d = await api('GET', '/api/content');
    if (!d.site) throw new Error(d.error || 'Could not load content');
    S.data = { site: d.site, pages: d.pages }; S.meta = d.meta;
  }

  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
  window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  (async () => {
    try { await reloadData(); }
    catch (e) {
      $('#edit').replaceChildren(h('div', { class: 'edit__inner' }, h('div', { class: 'callout danger' }, ico('alert'), h('div', {}, h('b', {}, 'Could not reach the CMS server. '), 'Start it with ', h('code', {}, 'node dev.mjs'), ' and open ', h('code', {}, 'http://localhost:3000/admin/'), '.'))));
      return;
    }
    PV.init();
    const first = S.data.pages.home ? 'home' : Object.keys(S.data.pages)[0];
    S.cur = { kind: 'page', name: first };
    S.obj = clone(S.data.pages[first]); S.saved = JSON.stringify(S.obj);
    renderAll();
    PV.load('/' + pageOutput());
  })();
})();
