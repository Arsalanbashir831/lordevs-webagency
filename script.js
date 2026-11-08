(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const preview = /[?&]cms-preview/.test(location.search);   // page is shown inside the CMS editor
  if (!location.hash && !preview) window.scrollTo(0, 0);

  /* Smooth scrolling for in-page links is done here, NOT with CSS `scroll-behavior:smooth`:
     the CSS version also smooths the instant scroll jumps ScrollTrigger makes while re-measuring,
     so it measured every trigger ~one scroll-offset wrong and paused the marquees on screen. */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); // honours scroll-padding-top
    history.pushState(null, '', a.getAttribute('href'));
  });

  const yrEl = $('#yr'); if (yrEl) yrEl.textContent = new Date().getFullYear();

  /* ---------- Nav ---------- */
  const nav = $('.nav'), burger = $('#burger'), links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', e => {
    if (e.target.tagName === 'A') { links.classList.remove('open'); burger.setAttribute('aria-expanded', false); }
  });

  /* ---------- Counters (work with or without GSAP) ---------- */
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, to = +el.dataset.to, suf = el.dataset.suffix || '';
      const start = performance.now(), dur = 1500;
      const tick = t => {
        const p = Math.min((t - start) / dur, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('.count').forEach(c => cio.observe(c));

  /* ---------- Booking calendar ---------- */
  (() => {
    const grid = $('#calGrid'), lbl = $('#monthLbl'), dayLbl = $('#dayLbl'), slotList = $('#slotList'), confirmBtn = $('#confirmBtn');
    if (!grid) return;                                   // page has no booking section
    let times = ['09:00 AM', '10:00 AM', '11:30 AM', '01:00 PM', '02:30 PM', '04:00 PM'];
    try { times = JSON.parse($('.slots').dataset.times) || times; } catch (e) {}
    const mailTo = confirmBtn.dataset.email || 'hello@lordevs.com', mailSubject = confirmBtn.dataset.subject || 'Consultation request';
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let view = new Date(now.getFullYear(), now.getMonth(), 1);
    let selDate = null, selTime = null;
    const fmt = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const updateLink = () => {
      if (selDate && selTime) {
        const body = encodeURIComponent(`Hi team,\n\nI'd like to book a 30 min consultation on ${fmt(selDate)} at ${selTime}.\n`);
        confirmBtn.href = `mailto:${mailTo}?subject=${encodeURIComponent(mailSubject)}&body=${body}`;
      }
    };
    function renderSlots() {
      slotList.innerHTML = '';
      if (!selDate) { slotList.innerHTML = '<small>Pick a day to see times.</small>'; return; }
      dayLbl.textContent = fmt(selDate);
      times.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = t;
        if (t === selTime) b.className = 'sel';
        b.onclick = () => { selTime = t; renderSlots(); updateLink(); };
        slotList.appendChild(b);
      });
    }
    function renderCal() {
      lbl.textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      grid.innerHTML = '';
      for (let i = 0; i < view.getDay(); i++) grid.appendChild(document.createElement('span'));
      const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(view.getFullYear(), view.getMonth(), d);
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = d;
        b.disabled = date < now || date.getDay() === 0 || date.getDay() === 6;
        if (selDate && +selDate === +date) b.className = 'sel';
        b.onclick = () => { selDate = date; selTime = null; renderCal(); renderSlots(); };
        grid.appendChild(b);
      }
    }
    $('#prevM').onclick = () => {
      const p = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      if (p >= new Date(now.getFullYear(), now.getMonth(), 1)) { view = p; renderCal(); }
    };
    $('#nextM').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); };
    renderCal(); renderSlots();
  })();

  /* ---------- FAQ accordion: all closed by default, one open at a time, animated height ---------- */
  (() => {
    const items = $$('.faq details');
    if (!items.length) return;
    const DUR = reduce ? 0 : 420, EASE = 'cubic-bezier(.22,1,.36,1)';
    const collapsedH = d => d.querySelector('summary').offsetHeight;

    function animate(d, from, to, done) {
      if (d._anim) d._anim.cancel();
      d.style.overflow = 'hidden';
      const a = d._anim = d.animate({ height: [from + 'px', to + 'px'] }, { duration: DUR, easing: EASE });
      const end = () => { if (d._anim === a) { d._anim = null; d.style.height = d.style.overflow = ''; done && done(); } };
      a.onfinish = end;
      a.oncancel = () => {};
    }
    function open(d) {
      const from = d.offsetHeight;                 // current height (works mid-animation too)
      d.open = true; d.classList.add('is-open');
      animate(d, from, d.scrollHeight);
    }
    function close(d) {
      const from = d.offsetHeight;
      d.classList.remove('is-open');
      animate(d, from, collapsedH(d), () => { d.open = false; });
    }
    items.forEach(d => {
      d.open = false; d.classList.remove('is-open');
      d.querySelector('summary').addEventListener('click', e => {
        e.preventDefault();
        if (d.classList.contains('is-open')) { close(d); return; }
        items.forEach(o => { if (o !== d && o.classList.contains('is-open')) close(o); });   // previous one closes
        open(d);
      });
    });
  })();

  /* ---------- Cookie & privacy banner ---------- */
  (() => {
    const el = $('#consent');
    if (!el) return;
    if (preview) { el.remove(); return; }
    const KEY = 'lordevs-consent';
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved) { el.remove(); return; }
    setTimeout(() => { el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show'))); }, reduce ? 600 : 3400);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      try { localStorage.setItem(KEY, b.dataset.consent); } catch (err) {}
      el.classList.remove('show');
      setTimeout(() => el.remove(), 700);
    });
  })();

  /* =====================================================
     THREE.JS SCENES
  ===================================================== */
  function makeStage(canvas, { fov = 40, z = 9 }) {
    const T = THREE;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) { canvas.style.display = 'none'; return null; }
    renderer.setPixelRatio(1);   // decorative scene: never render at retina resolution (4x the pixels)
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(fov, 1, 0.1, 100);
    camera.position.z = z;
    scene.add(new T.AmbientLight(0xffffff, 0.6));
    const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(3, 4, 5); scene.add(key);
    const fill = new T.PointLight(0xffc21a, 1.8, 30); fill.position.set(-5, -2, 4); scene.add(fill);
    const rim = new T.PointLight(0xffffff, 0.9, 30); rim.position.set(4, -4, -3); scene.add(rim);

    const stage = { scene, camera, renderer, onFrame: null, onResize: null };
    const parent = canvas.parentElement;
    const resize = () => {
      const w = parent.clientWidth, h = parent.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (stage.onResize) stage.onResize(w / h);
      if (reduce) renderer.render(scene, camera);
    };
    new ResizeObserver(resize).observe(parent);
    resize();

    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(parent);
    const clock = new T.Clock();
    if (reduce) { if (stage.onFrame) stage.onFrame(0); renderer.render(scene, camera); return stage; }
    let lastRender = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (now - lastRender < 33) return;                 // cap at ~30fps
      lastRender = now;
      if (stage.onFrame) stage.onFrame(clock.getElapsedTime());
      renderer.render(scene, camera);
    })(0);
    return stage;
  }

  function initThree() {
    if (!window.THREE) return {};
    const T = THREE;
    const yellow = () => new T.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.3, metalness: 0.15, flatShading: true });
    const black = () => new T.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4, metalness: 0.5 });
    const out = {};

    /* ---- Booking: big knot + faceted gem on the sides ---- */
    const bc = $('#bookCanvas');
    if (bc) {
      const st = makeStage(bc, { fov: 40, z: 10 });
      if (st) {
        const knotG = new T.Group(), gemG = new T.Group();
        st.scene.add(knotG, gemG);
        const knot = new T.Mesh(new T.TorusKnotGeometry(1.2, 0.36, 110, 14, 2, 3), yellow());
        knotG.add(knot);
        const gem = new T.Mesh(new T.OctahedronGeometry(1.1, 0), yellow());
        const gemEdges = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(1.11, 0)), new T.LineBasicMaterial({ color: 0x0b0b0b }));
        gemG.add(gem, gemEdges);
        st.onResize = aspect => {
          const halfW = 10 * Math.tan((40 * Math.PI) / 360) * aspect;
          knotG.position.set(-halfW * 0.84, 1.6, -1);
          gemG.position.set(halfW * 0.86, -1.6, -1);
          const s = aspect < 1 ? 0.6 : 1; knotG.scale.setScalar(s); gemG.scale.setScalar(s * 1.2);
        };
        st.onResize(bc.parentElement.clientWidth / (bc.parentElement.clientHeight || 1));
        st.onFrame = t => {
          knot.rotation.x = t * 0.25; knot.rotation.y = t * 0.35;
          gem.rotation.y = gemEdges.rotation.y = t * 0.5;
          gem.rotation.x = gemEdges.rotation.x = t * 0.2;
          knotG.position.y = 1.6 + Math.sin(t * 0.8) * 0.2;
          gemG.position.y = -1.6 + Math.cos(t * 0.9) * 0.2;
        };
        out.book = { knotG, gemG };
      }
    }
    return out;
  }

  /* =====================================================
     GSAP ANIMATIONS
  ===================================================== */
  function splitWords(el, mask = true) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = mask ? 'w' : 'w w--nomask';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return $$('.wi', el);
  }
  function splitChars(el) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach(c => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; frag.appendChild(s); });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$('.ch', el);
  }

  function initAnimations(three) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.config({ nullTargetWarn: false });   // pages may leave out sections
    ScrollTrigger.config({ ignoreMobileResize: true });
    const loader = $('#loader');

    /* --- split text --- */
    const heroTitle = $('.hero__title');
    const heroWords = heroTitle ? splitWords(heroTitle) : [];
    const stmt = $('.statement');
    const stmtWords = stmt ? splitWords(stmt, false) : [];
    // scroll-driven "ink fill": progress comes from the statement's live position, but only
    // while the page is scrolling (or the fill is still easing) - idle frames do no work at all
    const n = stmtWords.length;
    const last = new Array(n).fill(-1);
    let cur = 0, target = 0, dirty = true;
    const paint = p => stmtWords.forEach((w, i) => {
      const local = Math.round(Math.min(Math.max(p * n - i, 0), 1) * 200) / 200;
      if (local !== last[i]) { last[i] = local; w.style.backgroundPositionX = (100 - local * 100) + '%'; }
    });
    paint(0);
    const markDirty = () => { dirty = true; };
    window.addEventListener('scroll', markDirty, { passive: true });
    window.addEventListener('resize', markDirty);
    gsap.ticker.add(() => {
      if (dirty && stmt) {
        dirty = false;
        const vh = window.innerHeight, top = stmt.getBoundingClientRect().top;
        const from = vh * 0.88, to = vh * 0.2;           // empty when the text enters, full near the top
        target = Math.min(Math.max((from - top) / (from - to), 0), 1);
      }
      if (cur === target) return;
      cur += (target - cur) * 0.2;
      if (Math.abs(target - cur) < 0.001) cur = target;
      paint(cur);
    });

    /* --- initial hidden states for hero intro --- */
    gsap.set(heroWords, { yPercent: 115 });
    gsap.set('.hero__title mark', { backgroundSize: '0% 100%' });
    gsap.set('.hero__sub, .btn-pill:not(.btn-pill--sm), .proof, .hero__logos', { opacity: 0, y: 30 });
    gsap.set('.work__track .card-work', { opacity: 0, y: 80 });

    /* --- hero intro (runs after the loader) --- */
    const intro = () => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.to(heroWords, { yPercent: 0, duration: 1.2, stagger: 0.08 })
        .to('.hero__title mark', { backgroundSize: '100% 100%', duration: 1, ease: 'power3.inOut' }, '-=.6')
        .to('.hero__sub, .hero__cta .btn-pill, .proof, .hero__logos', { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 }, '-=.9')
        .to('.work__track .card-work', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, '-=.7');
    };

    /* --- loader --- */
    const num = $('#loaderNum'), counter = { v: 0 };
    root.classList.add('is-loading');
    const finishLoader = () => { root.classList.remove('is-loading'); if (loader) loader.style.display = 'none'; ScrollTrigger.refresh(); };
    const loaderTl = gsap.timeline({ onComplete: finishLoader })
      .to(counter, { v: 100, duration: 1.4, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(counter.v); } })
      .to('.loader__bar span', { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }, 0)
      .to('.loader__inner', { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' })
      .call(intro, null, '+=0.1')
      .to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '<');
    if (preview) loaderTl.timeScale(15);
    setTimeout(finishLoader, 6000); // fail-safe

    /* --- scroll progress --- */
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    /* =====================================================================
       SCROLL-IN ANIMATIONS (every section)
       Each block plays the first time its start line is reached, OR immediately if the
       user already scrolled past it (nav links, End key, scrollbar jumps, refresh mid-page),
       so nothing can be left hidden. Delays are chained inside one timeline per section.
    ===================================================================== */
    const whenIn = (trigger, start, fn) => {
      let done = false;
      const go = () => { if (!done) { done = true; fn(); } };
      ScrollTrigger.create({
        trigger, start,
        onUpdate: self => { if (self.progress > 0) go(); },
        onRefresh: self => { if (self.progress > 0) go(); }
      });
    };

    // section heading: tag pops (0s) -> title words rise (+0.3s, 60ms apart) -> intro line fades up (+0.9s)
    const head = section => {
      const tag = $('.tag', section), h2 = $('.h2', section), lead = $('.lead', section);
      const words = h2 ? splitWords(h2) : [];
      if (tag) gsap.set(tag, { opacity: 0, y: 18, scale: 0.85 });
      if (words.length) gsap.set(words, { yPercent: 115 });
      if (lead) gsap.set(lead, { opacity: 0, y: 24 });
      whenIn(h2 || tag || section, 'top 90%', () => {
        const tl = gsap.timeline();
        if (tag) tl.to(tag, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.5)' });
        if (words.length) tl.to(words, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06 }, tag ? 0.3 : 0);
        if (lead) tl.to(lead, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.9);
      });
    };
    ['#services', '.compare', '.why', '#testimonials', '#process', '#book', '#faq'].forEach(sel => { const el = $(sel); if (el) head(el); });

    /* --- ABOUT: logo (0s) -> bento tiles (0.12s apart) -> avatars (+0.6s) -> flags (+1s) --- */
    gsap.set('.about__head .brand', { opacity: 0, x: -30 });
    whenIn('.about__head', 'top 88%', () => gsap.to('.about__head .brand', { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }));
    gsap.set('.tile', { y: 70, opacity: 0, scale: 0.92 });
    gsap.set('.tile--mini .avatars span, .flags i', { scale: 0 });
    whenIn('.bento', 'top 86%', () => {
      const tl = gsap.timeline();
      tl.to('.tile', { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out', stagger: 0.12 })
        .to('.tile--mini .avatars span', { scale: 1, duration: 0.4, ease: 'back.out(3)', stagger: 0.08 }, 0.6)
        .to('.flags i', { scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.07 }, 1.0);
    });

    /* --- TECH BAND: rises in --- */
    gsap.set('.tech', { opacity: 0, y: 70 });
    whenIn('.tech', 'top 94%', () => gsap.to('.tech', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }));

    /* --- SERVICES: every row slides in by itself the moment it scrolls into view (no chained delays) --- */
    $$('.svc').forEach(row => {
      const ico = $('.svc__ico', row);
      gsap.set(row, { x: -260, opacity: 0 });
      gsap.set(ico, { scale: 0, rotation: -35 });
      whenIn(row, 'top 90%', () => {
        gsap.to(row, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
        gsap.to(ico, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
      });
    });

    /* --- COMPARISON: left card (0s) + right card (0.15s) -> checklist items (+0.6s) -> logos (+0.2s) --- */
    gsap.set('.cmp--other', { x: -80, opacity: 0 });
    gsap.set('.cmp--us', { x: 80, opacity: 0, scale: 0.95 });
    gsap.set('.cmp li', { x: -18, opacity: 0 });
    whenIn('.compare__grid', 'top 88%', () => {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to('.cmp--other', { x: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })
        .to('.cmp--us', { x: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out' }, 0.15)
        .to('.cmp--other li', { x: 0, opacity: 1, duration: 0.5, stagger: 0.09, ease: 'power2.out' }, 0.6)
        .to('.cmp--us li', { x: 0, opacity: 1, duration: 0.5, stagger: 0.09, ease: 'power2.out' }, 0.75);
    });
    gsap.set('.trusted', { opacity: 0, y: 16 });
    gsap.set('.compare .logos span', { opacity: 0, scale: 0.6 });
    whenIn('.trusted', 'top 96%', () => {
      gsap.timeline()
        .to('.trusted', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
        .to('.compare .logos span', { opacity: 0.8, scale: 1, duration: 0.5, ease: 'back.out(2.5)', stagger: 0.1 }, 0.2);
    });

    /* --- WHY: three cards (0.12s apart) -> two wide cards (after) -> icon badges pop --- */
    gsap.set('.why-card', { opacity: 0, y: 60, rotationX: -10, transformPerspective: 1000, transformOrigin: '50% 100%' });
    gsap.set('.why-ico', { scale: 0 });
    whenIn('.why__grid', 'top 86%', () => {
      const tl = gsap.timeline();
      tl.to('.why-card:not(.why-card--wide)', { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 })
        .to('.why-card--wide', { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15 }, '-=0.3')
        .to('.why-ico', { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.1 }, 0.35);
    });

    /* --- TESTIMONIALS: quotes in reading order, 0.14s apart -> avatars pop --- */
    gsap.set('.quote', { opacity: 0, y: 60 });
    gsap.set('.quote footer i', { scale: 0 });
    whenIn('.testi__grid', 'top 86%', () => {
      gsap.timeline()
        .to('.quote', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.14 })
        .to('.quote footer i', { scale: 1, duration: 0.45, ease: 'back.out(3)', stagger: 0.14 }, 0.4);
    });

    /* --- PROCESS: steps 0.2s apart (icon spins in, number follows) -> button last --- */
    gsap.set('.step', { opacity: 0, y: 60 });
    gsap.set('.step__ico', { scale: 0, rotation: -90 });
    gsap.set('.step__n', { opacity: 0, x: 20 });
    gsap.set('.process .btn.center', { opacity: 0, y: 20 });
    whenIn('.steps', 'top 86%', () => {
      gsap.timeline()
        .to('.step', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.2 })
        .to('.step__ico', { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.2 }, 0.25)
        .to('.step__n', { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out', stagger: 0.2 }, 0.4)
        .to('.process .btn.center', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.1');
    });

    /* --- BOOKING: panel rises -> calendar days cascade -> time slots --- */
    gsap.set('.booker', { y: 90, opacity: 0, rotationX: 12, transformPerspective: 1200 });
    gsap.set('.cal__grid button', { opacity: 0, scale: 0.6 });
    whenIn('.booker', 'top 88%', () => {
      gsap.timeline()
        .to('.booker', { y: 0, opacity: 1, rotationX: 0, duration: 1, ease: 'power3.out' })
        .to('.cal__grid button', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)', stagger: 0.018 }, 0.55);
    });

    /* --- FAQ: questions 0.1s apart --- */
    gsap.set('.faq details', { opacity: 0, y: 30 });
    whenIn('.faq__list', 'top 88%', () => gsap.to('.faq details', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 }));

    /* --- FOOTER: columns (0.12s apart) -> big wordmark letters rise -> copyright --- */
    const fw = $('.footer__word');
    const chars = fw ? splitChars(fw) : [];
    gsap.set('.footer__logo, .footer__cols > div', { opacity: 0, y: 30 });
    gsap.set(chars, { yPercent: 110 });
    gsap.set('.footer__copy', { opacity: 0 });
    whenIn('.footer__inner', 'top 96%', () => {
      gsap.timeline()
        .to('.footer__logo, .footer__cols > div', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12 })
        .to(chars, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.07 }, 0.4)
        .to('.footer__copy', { opacity: 1, duration: 0.6 }, '-=0.3');
    });

    /* --- floating emojis --- */
    $$('.why-ico').forEach((e, i) => gsap.to(e, { y: '-=8', rotation: i % 2 ? 5 : -5, duration: 2 + (i % 3) * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

    /* --- marquees: paused while off-screen, speed up with scroll speed --- */
    const marquees = [];
    const addMarquee = (tw, trigger) => {
      ScrollTrigger.create({ trigger, start: 'top bottom', end: 'bottom top', onToggle: self => tw.paused(!self.isActive) });
      marquees.push(tw);
    };
    const marquee = (track, from, to, duration, trigger) =>
      addMarquee(gsap.fromTo(track, { xPercent: from }, { xPercent: to, repeat: -1, duration, ease: 'none' }), trigger);
    marquee('.work__track', 0, -50, 50, '.work');

    /* Industry band: each word moves on its own and wraps around, instead of sliding one giant strip.
       A single strip of 16 long words gets 15-20k px wide on big screens - past the GPU layer size
       browsers (esp. Safari) will composite - so it froze after a second. Per-word layers stay small. */
    (() => {
      const track = $('.tech__track'); if (!track) return;
      const spans = [...track.children];
      const setX = spans.map(s => gsap.quickSetter(s, 'x', 'px'));
      let W = 0, lefts = [], widths = [];
      const measure = () => {                            // offsetLeft/Width ignore transforms, so no reset needed
        W = track.scrollWidth;
        lefts = spans.map(s => s.offsetLeft);
        widths = spans.map(s => s.offsetWidth);
      };
      const state = { p: 0 };
      const render = () => {
        if (!W) return;
        const shift = state.p * W;                       // moves right, like before
        spans.forEach((s, i) => setX[i](gsap.utils.wrap(-widths[i], W - widths[i], lefts[i] + shift) - lefts[i]));
      };
      measure(); render();
      ScrollTrigger.addEventListener('refresh', () => { measure(); render(); }); // resize, fonts, load
      // 76s per full loop = same speed as the old 38s per half
      addMarquee(gsap.to(state, { p: 1, duration: 76, ease: 'none', repeat: -1, onUpdate: render }), '.tech');
    })();
    let prevY = window.scrollY, boost = 0, appliedScale = 1;
    gsap.ticker.add(() => {
      const y = window.scrollY;
      const v = Math.min(Math.abs(y - prevY) / 14, 5);
      prevY = y;
      boost += (v - boost) * 0.12;
      const scale = Math.round((1 + boost) * 20) / 20;
      if (scale !== appliedScale) { appliedScale = scale; marquees.forEach(tw => tw.timeScale(scale)); }
    });

    /* --- 3D scenes: mouse parallax + scroll-linked motion --- */
    if (three.book) {
      const sc = { trigger: '.book', start: 'top bottom', end: 'bottom top', scrub: 1 };
      gsap.to(three.book.knotG.rotation, { y: Math.PI * 2, x: 1.2, scrollTrigger: sc });
      gsap.to(three.book.gemG.rotation, { y: -Math.PI * 2, z: 1, scrollTrigger: sc });
    }
    /* --- fine-pointer extras: tilt, magnetic buttons, cursor --- */
    if (fine) {
      $$('.step, .why-card, .quote, .tile--tall').forEach(el => {
        gsap.set(el, { transformPerspective: 900 });
        const qy = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power2.out' });
        const qx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power2.out' });
        el.addEventListener('pointermove', e => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          qy(((e.clientX - r.left) / r.width - 0.5) * 12);
          qx(-((e.clientY - r.top) / r.height - 0.5) * 12);
        }, { passive: true });
        el.addEventListener('pointerleave', () => { qy(0); qx(0); });
      });
      $$('.btn, .btn-pill').forEach(b => {
        const qx = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' });
        const qy = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
        b.addEventListener('pointermove', e => {
          const r = b.getBoundingClientRect();
          qx((e.clientX - r.left - r.width / 2) * 0.25);
          qy((e.clientY - r.top - r.height / 2) * 0.35);
        }, { passive: true });
        b.addEventListener('pointerleave', () => { qx(0); qy(0); });
      });

      // cursor: plain transforms only (no blend modes, no layout changes)
      const ring = $('#cursor'), dot = $('#cursorDot');
      const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
      const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
      let shownCursor = false, hovering = false, lastTarget = null;
      window.addEventListener('pointermove', e => {
        rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
        if (!shownCursor) { shownCursor = true; ring.classList.add('on'); dot.classList.add('on'); }
        if (e.target !== lastTarget) {
          lastTarget = e.target;
          const h = !!(e.target.closest && e.target.closest('a, button, summary'));
          if (h !== hovering) { hovering = h; gsap.to(ring, { scale: h ? 1.8 : 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' }); ring.classList.toggle('is-hover', h); }
        }
      }, { passive: true });
      document.addEventListener('pointerleave', () => { shownCursor = false; ring.classList.remove('on'); dot.classList.remove('on'); });
    }

    /* --- nav scroll-spy --- */
    $$('.nav__links a').forEach(a => {
      const sec = $(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: self => a.classList.toggle('active', self.isActive) });
    });

    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- boot ---------- */
  const killLoader = () => { const l = $('#loader'); if (l) l.remove(); root.classList.remove('is-loading'); };
  let three = {};
  try { three = initThree(); } catch (e) { console.warn('3D disabled:', e); }
  if (window.gsap && window.ScrollTrigger && !reduce) {
    try { initAnimations(three); } catch (e) { console.error(e); killLoader(); }
  } else {
    killLoader();
  }
})();
