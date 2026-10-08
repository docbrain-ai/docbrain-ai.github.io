// The homepage film. The reader's scroll plays it: real moments become a traced lesson, the lesson travels
// to a teammate and an agent, then out to the whole company. Footage comes from /media/<clip>.mp4; until it
// exists, a labelled stand-in plays so the motion can be judged.

// links into the old homepage's sections now live on their own pages
const MOVED = { pricing: '/pricing/' };
for (const id of ['b1', 'b2', 'b3', 'b5', 'b6', 'forge', 'recap', 'ops', 'roi', 'compare', 'honest', 'faq', 'start']) MOVED[id] = `/how-it-works/#${id}`;
if (MOVED[location.hash.slice(1)]) location.replace(MOVED[location.hash.slice(1)]);

document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------- media: real clip, or a labelled stand-in
const STANDIN = ['/assets/reason-expired.mp4', '/assets/agent-in-the-editor.mp4'];
// media/manifest.json lists the footage that exists, so the page never asks for a file that isn't there
const manifest = fetch('/media/manifest.json').then((r) => (r.ok ? r.json() : { files: [] })).then((m) => new Set(m.files)).catch(() => new Set());
const exists = (url) => manifest.then((have) => have.has(url.replace('/media/', '')));
let standinTurn = 0;
async function loadClip(v) {
  const name = v.dataset.clip, real = `/media/${name}.mp4`;
  if (await exists(real)) { v.src = real; return 'real'; }
  // a keyframe still stands in for its clip until the video exists: shown as the poster, traced from the image
  const still = `/media/${name}.jpg`;
  if (await exists(still)) { v.poster = still; v._still = new Image(); v._still.src = still; return 'still'; }
  if (name === 'belief-newhire') {
    const plate = document.createElement('div');
    plate.className = 'plate on'; plate.textContent = `media/${name}.mp4 · awaiting footage`;
    v.replaceWith(plate); return 'plate';
  }
  v.src = name === 'ch2-agent' ? STANDIN[1] : STANDIN[standinTurn++ % 2];
  const host = v.parentElement;
  if (host && !host.querySelector('.standin')) {
    const b = document.createElement('span'); b.className = 'standin'; b.textContent = 'stand-in · awaiting footage'; host.appendChild(b);
  }
  return 'standin';
}
const play = (v) => { if (!reduce && v && v.src && v.play) v.play().catch(() => {}); };

// ---------------------------------------------------------------- the trace: any clip, redrawn as line art
function tracer(srcCanvasW, srcCanvasH) {
  const work = document.createElement('canvas'); work.width = srcCanvasW; work.height = srcCanvasH;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  return function trace(video, out, rgb, threshold = 70) {
    const src = video && (video._still || video);
    if (!src || !(src instanceof HTMLImageElement ? src.complete && src.naturalWidth : src.readyState >= 2)) return false;
    wctx.drawImage(src, 0, 0, srcCanvasW, srcCanvasH);
    const { data } = wctx.getImageData(0, 0, srcCanvasW, srcCanvasH);
    const W = srcCanvasW, H = srcCanvasH, g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
    out.width = W; out.height = H;
    const octx = out.getContext('2d'), img = octx.createImageData(W, H), o = img.data;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1] + g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1];
      const gy = -g[i - W - 1] - 2 * g[i - W] - g[i - W + 1] + g[i + W - 1] + 2 * g[i + W] + g[i + W + 1];
      const m = Math.hypot(gx, gy);
      if (m > threshold) { const k = i * 4; o[k] = rgb[0]; o[k + 1] = rgb[1]; o[k + 2] = rgb[2]; o[k + 3] = Math.min(255, (m - threshold) * 2.2); }
    }
    octx.putImageData(img, 0, 0);
    return true;
  };
}

// ---------------------------------------------------------------- the film
async function film() {
  const story = $('#story'), stage = $('.stage'), rig = $('.rig');
  const P = Object.fromEntries($$('[data-role]', stage).map((e) => [e.dataset.role, e]));
  const wires = $('.wires'), nav = $('#nav'), heroin = $('.heroin');
  const reel = $$('video', P.footage);
  await Promise.all($$('video[data-clip]').map(async (v) => { v.dataset.state = await loadClip(v); }));

  // the reel: the four moments crossfade until the story narrows to one person
  let shown = -1;
  const showClip = (i) => {
    if (i === shown) return;
    reel.forEach((v, j) => { v.classList.toggle('on', j === i); if (j === i) { v.preload = 'auto'; play(v); } else v.pause(); });
    shown = i;
  };
  showClip(0);
  let reelTurn = 0, K = {};
  if (!reduce) setInterval(() => { if (Number(stage.dataset.p) < K.shrink) showClip((reelTurn = (reelTurn + 1) % 4)); }, 3600);
  [P.mate, P.agent].forEach((p) => play(p.querySelector('video')));

  let pw, ph, vw, vh;
  const measure = () => { vw = innerWidth; vh = innerHeight; pw = P.footage.offsetWidth; ph = pw * 9 / 16; };

  // the company: an inner ring of teams around the first one, and an outer ring each inner team reaches
  const TILES = ['incident', 'review', 'onboarding', 'handover', 'standup', 'audit', 'servers', 'agent', 'whiteboard', 'late'];
  const tiles = [];
  [[8, 1.12, 0], [16, 1.85, Math.PI / 16]].forEach(([n, r, turn], ring) => {
    for (let i = 0; i < n; i++) {
      const t = document.createElement('div'); t.className = 'tile';
      const name = TILES[tiles.length % TILES.length];
      exists(`/media/tile-${name}.jpg`).then((ok) => { if (ok) { const im = new Image(); im.src = `/media/tile-${name}.jpg`; im.alt = ''; t.appendChild(im); } });
      P.sky.appendChild(t);
      tiles.push({ el: t, a: turn + (i / n) * Math.PI * 2, r, ring, i, n });
    }
  });
  const placeTiles = () => tiles.forEach((t) => {
    const w = pw * (t.ring ? 0.15 : 0.19);
    gsap.set(t.el, { width: w, height: w * 9 / 16, x: Math.cos(t.a) * t.r * pw - w / 2, y: Math.sin(t.a) * t.r * pw * 0.62 - w * 9 / 32 });
  });

  // the timeline is keyed to the captions: each movement happens while its sentence is on screen
  const phone = () => innerWidth < 832;
  gsap.set(Object.values(P).filter((e) => e !== P.sky), { xPercent: -50, yPercent: -50 });
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power1.inOut' } });
  const build = () => {
    tl.clear(); measure(); placeTiles();
    const len = story.offsetHeight - vh;
    const at = (id, f) => clamp((document.getElementById(id).offsetTop + f * vh) / len);
    K = {
      shrink: at('hero', 0.6),
      tilt: [at('intro', -0.95), at('intro', -0.6)],
      lesson: [at('ring1', -0.9), at('ring1', -0.62)],
      team: [at('ring2', -0.95), at('ring2', -0.66)],
      mate: [at('ring2', -0.66), at('ring2', -0.42)], agent: [at('ring2', -0.56), at('ring2', -0.32)],
      pull: [at('ring3', -0.95), at('ring3', -0.62)],
      reach: [at('ring3', -0.62), at('ring3', 0.05)],
    };
    const d = (k) => K[k][1] - K[k][0];
    const cover = Math.max(vw / pw, vh / ph) * 1.02, dy = (0.5 - (phone() ? 0.34 : 0.42)) * vh;
    const tilt = phone() ? 14 : 26;
    gsap.set(P.footage, { scale: cover, y: dy, borderRadius: 0, opacity: 1, z: 0 });
    gsap.set([P.trace, P.grid], { opacity: 0, z: 0, x: 0 });
    gsap.set(P.lesson, { opacity: 0, z: 120, y: -ph * 0.06, scale: 0.92 });
    gsap.set(P.mate, { opacity: 0, x: pw * 0.8, y: -ph * 0.38, z: -40 });
    gsap.set(P.agent, { opacity: 0, x: pw * 0.8, y: ph * 0.24, z: -40 });
    gsap.set(rig, { rotationY: 0, rotationX: 0, x: 0, y: 0, scale: 1 });
    tiles.forEach((t) => gsap.set(t.el, { opacity: 0 }));
    tl.to(P.footage, { scale: 1, y: 0, borderRadius: 16, duration: K.shrink, ease: 'power2.inOut' }, 0)
      .to(rig, { rotationY: -tilt, rotationX: tilt * 0.25, duration: d('tilt') }, K.tilt[0])
      .to(P.trace, { opacity: 1, z: -170, x: pw * 0.06, duration: d('tilt') }, K.tilt[0])
      .to(P.grid, { opacity: 0.55, z: -340, x: pw * 0.12, duration: d('tilt') }, K.tilt[0] + d('tilt') * 0.2)
      .to(P.footage, { opacity: 0.55, duration: d('lesson') }, K.lesson[0])
      .to(P.lesson, { opacity: 1, z: 260, scale: 1, duration: d('lesson') }, K.lesson[0])
      .to(rig, { rotationY: -tilt * 0.3, rotationX: 0, x: phone() ? -pw * 0.2 : -pw * 0.3, y: -vh * 0.09, duration: d('team') }, K.team[0])
      .to([P.mate, P.agent], { opacity: 1, duration: d('team') * 0.6, stagger: d('team') * 0.25 }, K.team[0] + d('team') * 0.3)
      .to(rig, { scale: phone() ? 0.34 : 0.4, rotationY: 0, x: 0, y: 0, duration: d('pull') }, K.pull[0])
      .to([P.trace, P.grid], { opacity: 0, duration: d('pull') * 0.6 }, K.pull[0])
      .to(P.footage, { opacity: 1, duration: d('pull') }, K.pull[0]);
    tiles.forEach((t) => {
      t.reach = K.reach[0] + (t.ring ? 0.38 + (t.i / t.n) * 0.55 : (t.i / t.n) * 0.3) * d('reach');
      t.dur = 0.07 * d('reach');
      tl.to(t.el, { opacity: 1, duration: t.dur * 0.6 }, Math.max(0, t.reach - t.dur));
    });
    tl.to({}, { duration: 0.0001 }, 1);
  };
  build();

  // wires: drawn in screen space between the panes' real positions.
  // Every frame reads all positions first, then writes — one layout per frame, never one per wire.
  const wire = () => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', 'w'); p.setAttribute('pathLength', '1');
    p.style.strokeDasharray = '1'; p.style.opacity = '0';
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '3.4'); dot.style.opacity = '0';
    wires.append(p, dot); return { p, dot, f: -1 };
  };
  const sr = () => stage.getBoundingClientRect();
  const box = (el, s) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - s.left, r.top + r.height / 2 - s.top, r.width, r.height]; };
  const W = { mate: wire(), agent: wire() };
  const tileWires = tiles.map(() => wire());
  const drawWire = (w, a, b, f, bend) => {
    if (f <= 0) { if (w.f !== 0) { w.p.style.opacity = '0'; w.dot.style.opacity = '0'; w.f = 0; } return; }
    const cx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, cy = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
    w.p.setAttribute('d', `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`);
    if (w.f !== f) {
      w.p.style.opacity = '1'; w.p.style.strokeDashoffset = String(1 - f);
      w.p.classList.toggle('hot', f < 1);
      if (f >= 1) w.p.setAttribute('marker-end', 'url(#arrow)'); else w.p.removeAttribute('marker-end');
    }
    if (f < 1) { // the point on the curve, by its parameter — close enough to arc length for a moving dot
      const u = 1 - f; w.dot.setAttribute('cx', u * u * a[0] + 2 * u * f * cx + f * f * b[0]); w.dot.setAttribute('cy', u * u * a[1] + 2 * u * f * cy + f * f * b[1]); w.dot.style.opacity = '1';
    } else if (w.f < 1) w.dot.style.opacity = '0';
    w.f = f;
  };
  // where a wire meets a pane: the edge facing the other end, not its centre
  const edge = (c, toward) => {
    const dx = toward[0] - c[0], dy = toward[1] - c[1], sx = c[2] / 2 / Math.abs(dx || 1e-6), sy = c[3] / 2 / Math.abs(dy || 1e-6), s = Math.min(sx, sy, 1);
    return [c[0] + dx * s, c[1] + dy * s];
  };

  const trace = tracer(320, 180);
  const traceCanvas = $('canvas', P.trace);
  let lastTrace = 0, tracedStill = null;
  const chapters = $$('.beat'), caps = $$('.capin');

  const update = (p) => {
    stage.dataset.p = p.toFixed(4);
    tl.progress(p);
    showClip(p < K.shrink ? shown : 4);
    const teamOn = p >= K.mate[0], companyOn = p >= K.reach[0] - 0.08;
    // reads
    const s = sr();
    const L = teamOn ? box(P.lesson, s) : null, M = teamOn ? box(P.mate, s) : null, A = teamOn ? box(P.agent, s) : null;
    const F = companyOn ? box(P.footage, s) : null, T = companyOn ? tiles.map((t) => box(t.el, s)) : null;
    const vh = innerHeight, chapterTops = chapters.map((c) => c.getBoundingClientRect().top);
    // writes
    drawWire(W.mate, L && edge(L, M), M && edge(M, L), teamOn ? span(p, ...K.mate) : 0, -0.18);
    drawWire(W.agent, L && edge(L, A), A && edge(A, L), teamOn ? span(p, ...K.agent) : 0, 0.18);
    P.mate.classList.toggle('lit', p >= K.mate[1]); P.agent.classList.toggle('lit', p >= K.agent[1]);
    let lit = 0;
    tiles.forEach((t, k) => {
      if (!companyOn) { drawWire(tileWires[k], null, null, 0); t.el.classList.remove('lit'); return; }
      const from = t.ring ? T[Math.round((t.i / t.n) * 8) % 8] : F, b = T[k], f = span(p, t.reach - t.dur, t.reach);
      drawWire(tileWires[k], edge(from, b), edge(b, from), f, 0.08);
      t.el.classList.toggle('lit', f >= 1); if (f >= 1) lit++;
    });
    stage.dataset.lit = String(lit);
    let ch = 'hero'; chapters.forEach((c, i) => { if (chapterTops[i] <= vh * 0.64) ch = c.id; });
    stage.dataset.chapter = ch;
  };

  const progressNow = () => clamp(-story.getBoundingClientRect().top / (story.offsetHeight - innerHeight));
  let lastKey = '';
  const frame = () => {
    const live = reel.find((v) => v.classList.contains('on'));
    const traceVisible = gsap.getProperty(P.trace, 'opacity') > 0.02;
    const videoTrace = traceVisible && live && !live._still && !live.paused;
    const key = `${scrollY}|${innerWidth}|${innerHeight}`;
    if (key === lastKey && !videoTrace) return; // nothing moved: do nothing
    if (key !== lastKey) {
      lastKey = key;
      let p = progressNow();
      if (reduce) {
        update(p);
        const at = { hero: 0, intro: K.tilt[1], ring1: K.lesson[1], ring2: K.agent[1], ring3: 1 };
        p = at[stage.dataset.chapter] ?? 0;
      }
      update(p);
      // the headline steps aside as the moment shrinks; captions hold in their band and fade at the edges
      const h = clamp(scrollY / innerHeight);
      heroin.style.opacity = String(1 - span(h, 0.04, 0.32));
      heroin.style.transform = `translateY(${-h * 60}px)`;
      const rs = caps.map((c) => c.parentElement.getBoundingClientRect());
      caps.forEach((c, i) => { c.style.opacity = String(span(1 - rs[i].top / innerHeight, 0.05, 0.32) * span(rs[i].bottom / innerHeight, 0.72, 0.9)); });
      nav.classList.toggle('dark', story.getBoundingClientRect().bottom > 70);
    }
    if (traceVisible && live) {
      const now = performance.now();
      if (live._still) { if (tracedStill !== live._still && trace(live, traceCanvas, [239, 234, 224])) tracedStill = live._still; }
      else if (now - lastTrace > 100) { lastTrace = now; trace(live, traceCanvas, [239, 234, 224]); tracedStill = null; }
    }
  };
  addEventListener('resize', () => { build(); lastKey = ''; frame(); });
  gsap.ticker.add(frame);
  frame();
}

// ---------------------------------------------------------------- words light up as they are read
function fills() {
  $$('.fill').forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
    const ws = $$('.w', h);
    if (reduce) { ws.forEach((w) => w.classList.add('on')); return; }
    let last = NaN;
    const tick = () => {
      if (scrollY === last) return; last = scrollY;
      const r = h.getBoundingClientRect();
      const f = span(innerHeight * 0.92 - r.top, 0, innerHeight * 0.42);
      const n = Math.round(f * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < n));
    };
    gsap.ticker.add(tick);
  });
}

// ---------------------------------------------------------------- daylight: tiles orbit, the word turns
function daylight() {
  const where = $('#where'), orbit = $('.orbit', where);
  const names = ['incident', 'review', 'onboarding', 'handover', 'standup', 'audit', 'servers', 'agent', 'whiteboard', 'late', 'incident', 'review'];
  const ots = names.map((n, i) => {
    const d = document.createElement('div'); d.className = 'ot';
    const s = 58 + ((i * 37) % 90); d.style.width = d.style.height = `${s}px`;
    exists(`/media/tile-${n}.jpg`).then((ok) => {
      if (ok) { const im = new Image(); im.src = `/media/tile-${n}.jpg`; im.alt = ''; d.appendChild(im); }
      else { const l = document.createElement('span'); l.textContent = n; d.appendChild(l); }
    });
    orbit.appendChild(d); return { d, a: (i / names.length) * Math.PI * 2, s, rr: 0.36 + ((i * 7) % 5) * 0.035 };
  });
  let last = NaN;
  const place = () => {
    if (scrollY === last) return; last = scrollY;
    const r = where.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const spin = reduce ? 0 : span(innerHeight - r.top, 0, innerHeight + r.height) * 1.4;
    ots.forEach((o) => {
      const a = o.a + spin, rx = r.width * o.rr, ry = r.height * o.rr * 0.95;
      o.d.style.transform = `translate(${r.width / 2 + Math.cos(a) * rx - o.s / 2}px, ${r.height / 2 + Math.sin(a) * ry - o.s / 2}px)`;
    });
  };
  gsap.ticker.add(place);
  const words = $$('.rot > span'); let k = 0; words[0].classList.add('on');
  if (!reduce) setInterval(() => { words[k].classList.remove('on'); k = (k + 1) % words.length; words[k].classList.add('on'); }, 2200);
}

// ---------------------------------------------------------------- the close: the person who started it, as one line
function drawing() {
  const c = $('.drawing'); const v = $('video[data-clip="ch1-maya"]');
  if (!v || !['real', 'still'].includes(v.dataset.state)) { c.hidden = true; return; } // a stand-in traced is noise, not a portrait
  const trace = tracer(480, 270);
  const go = () => { if (!trace(v, c, [27, 25, 21], 60)) setTimeout(go, 400); };
  v.addEventListener('loadeddata', go, { once: true }); if (v._still) v._still.addEventListener('load', go, { once: true }); go();
}

// ---------------------------------------------------------------- proof: three moments, one lesson
function runProof(proof, button) {
  const STEP_MS = 6500;
  let timer = null, inView = false, userPaused = reduce;
  const sync = () => {
    button.textContent = userPaused ? 'Play' : 'Pause';
    const play = inView && !userPaused;
    proof.dataset.playing = String(play);
    if (play && !timer) timer = setInterval(() => { proof.dataset.step = String((Number(proof.dataset.step) + 1) % 3); }, STEP_MS);
    else if (!play && timer) { clearInterval(timer); timer = null; }
  };
  button.hidden = false;
  button.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(proof);
  sync();
}

// smooth scroll makes the scrub feel like a camera, not a scrollbar
if (!reduce && window.Lenis) {
  const lenis = new Lenis({ lerp: 0.085 });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
runProof($('#proof'), $('#proofToggle'));
fills();
daylight();
film().then(drawing);
