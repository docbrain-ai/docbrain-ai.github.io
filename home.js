// The homepage film. The reader's scroll plays it: real moments become a traced lesson, the lesson travels
// to a teammate and an agent, then out to the whole company. Footage comes from /media/<clip>.mp4; until it
// exists, a labelled stand-in plays so the motion can be judged.

// links into the old homepage's sections now live on their own pages
const MOVED = { pricing: '/pricing/' };
for (const id of ['b1', 'b2', 'b3', 'b5', 'b6', 'forge', 'recap', 'ops', 'roi', 'compare', 'honest', 'faq', 'start']) MOVED[id] = `/how-it-works/#${id}`;
if (MOVED[location.hash.slice(1)]) location.replace(MOVED[location.hash.slice(1)]);

// no animation library (blocked, offline): leave the plain page — every word and button is already in the HTML
const ready = !!(window.gsap);
if (ready) document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------- media: real clip, or a labelled stand-in
const STANDIN = ['/assets/reason-expired.mp4', '/assets/agent-in-the-editor.mp4'];
// media/manifest.json lists the footage that exists, so the page never asks for a file that isn't there
const manifest = fetch('/media/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  .then((m) => ({ have: new Set(m.files || []), trims: m.trims || {} }));
const exists = (url) => manifest.then((m) => m.have.has(url.replace('/media/', '')));
let standinTurn = 0;
async function loadClip(v) {
  const name = v.dataset.clip, real = `/media/${name}.mp4`;
  if (await exists(real)) {
    v.preload = 'none'; v.src = real;
    if (await exists(`/media/${name}.jpg`)) v.poster = `/media/${name}.jpg`; // shown if autoplay is refused or motion is reduced
    const trim = (await manifest).trims[`${name}.mp4`]; // play only the good part of a clip
    if (trim) { v._in = trim[0]; v._out = trim[1]; }
    return 'real';
  }
  // a keyframe still stands in for its clip until the video exists: shown as the poster, traced from the image
  const still = `/media/${name}.jpg`;
  if (await exists(still)) {
    if (name === 'belief-newhire') { // a frame of its own: show the still as an image, so the crop is the one we chose
      const img = new Image(); img.src = still; img.alt = ''; img.className = 'still'; v.replaceWith(img); return 'still';
    }
    v.poster = still; v._still = new Image(); v._still.src = still; return 'still';
  }
  if (name === 'belief-newhire') { // no clip yet: no empty frame, the sentence takes the room
    const fig = v.closest('figure'); fig.hidden = true; fig.parentElement.classList.add('solo'); return 'absent';
  }
  if (!(await manifest).have.size) return 'absent'; // the footage list is unreachable: plain dark panes, never public stand-ins
  if (name.startsWith('hero-') && (await exists('/media/ch1-maya.mp4'))) { v.preload = 'none'; v.src = '/media/ch1-maya.mp4'; v.poster = '/media/ch1-maya.jpg'; v._in = 0; v._out = 6.5; return 'borrowed'; }
  v.src = name === 'ch2-agent' ? STANDIN[1] : STANDIN[standinTurn++ % 2];
  const host = v.parentElement;
  if (host && !host.querySelector('.standin')) {
    const b = document.createElement('span'); b.className = 'standin'; b.textContent = 'stand-in · awaiting footage'; host.appendChild(b);
  }
  return 'standin';
}
// Safari refuses autoplay in Low Power Mode or when auto-play is off for the site; those clips start on the first tap or key
const refused = new Set();
const play = (v) => { if (reduce || !v || !v.src || !v.play) return; v.muted = true; v.play().then(() => refused.delete(v), () => refused.add(v)); };
['pointerdown', 'touchend', 'keydown'].forEach((t) => addEventListener(t, () => refused.forEach((v) => { refused.delete(v); if (v.classList.contains('on')) play(v); }), { passive: true }));

// ---------------------------------------------------------------- the trace: any clip, redrawn as line art
function tracer(srcCanvasW, srcCanvasH) {
  const work = document.createElement('canvas'); work.width = srcCanvasW; work.height = srcCanvasH;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  return function trace(video, out, rgb, keep = 0.12) {
    const src = video && (video._still || video);
    if (!src || !(src instanceof HTMLImageElement ? src.complete && src.naturalWidth : src.readyState >= 2)) return false;
    wctx.drawImage(src, 0, 0, srcCanvasW, srcCanvasH);
    const { data } = wctx.getImageData(0, 0, srcCanvasW, srcCanvasH);
    const W = srcCanvasW, H = srcCanvasH, g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
    // edge strength everywhere first, then keep the strongest share of it: dark dusk footage and a bright
    // daylight office both come out as clear line art, instead of a fixed threshold that empties dark clips
    const mag = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1] + g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1];
      const gy = -g[i - W - 1] - 2 * g[i - W] - g[i - W + 1] + g[i + W - 1] + 2 * g[i + W] + g[i + W + 1];
      mag[i] = Math.hypot(gx, gy);
    }
    const sample = []; for (let i = 0; i < mag.length; i += 7) sample.push(mag[i]);
    sample.sort((p, q) => p - q);
    const cut = Math.max(12, sample[Math.floor(sample.length * (1 - keep))]), top = Math.max(cut + 1, sample[Math.floor(sample.length * 0.995)]);
    out.width = W; out.height = H;
    const octx = out.getContext('2d'), img = octx.createImageData(W, H), o = img.data;
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] > cut) { const k = i * 4; o[k] = rgb[0]; o[k + 1] = rgb[1]; o[k + 2] = rgb[2]; o[k + 3] = Math.min(255, 70 + 185 * (mag[i] - cut) / (top - cut)); }
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

  // the reel: each real moment plays its section through, then the next crossfades in;
  // once the story narrows to one person, Maya's clip loops on its own
  let shown = -1, K = {};
  const inPoint = (v) => v._in || 0;
  const outPoint = (v) => Math.min(v._out ?? Infinity, (v.duration || Infinity) - 0.15);
  const seekIn = (v) => { const go = () => { try { v.currentTime = inPoint(v); } catch (e) {} }; v.readyState >= 1 ? go() : v.addEventListener('loadedmetadata', go, { once: true }); };
  let sceneReset = () => {};
  const showClip = (i) => {
    if (i === shown) return;
    sceneReset(reel[i]);
    reel.forEach((v, j) => {
      v.classList.toggle('on', j === i);
      if (j === i) { if (!reduce) v.preload = 'auto'; seekIn(v); play(v); } else v.pause();
    });
    shown = i;
  };
  const isHero = (v) => !!v && v.dataset.clip.startsWith('hero-');
  const mayaAt = reel.findIndex((v) => v.dataset.clip === 'ch1-maya');
  const heroes = reel.map((v, i) => [v, i]).filter(([v]) => isHero(v));
  const real = heroes.filter(([v]) => v.dataset.state === 'real').map(([, i]) => i);
  const borrowed = heroes.find(([v]) => v.dataset.state === 'borrowed');
  // order: whiteboard opens, the night incident closes; Maya stands in for any missing moment
  // the hero follows Maya's lesson through three moments
  const ORDER = ['hero-02-whiteboard', 'hero-03-standup', 'hero-01-incident'];
  const rank = (i) => ORDER.indexOf(reel[i].dataset.clip);
  const sorted = real.filter((i) => rank(i) >= 0).sort((a, b) => rank(a) - rank(b));
  const last = sorted.filter((i) => reel[i].dataset.clip === 'hero-01-incident');
  const middle = sorted.filter((i) => reel[i].dataset.clip !== 'hero-01-incident');
  const cycle = real.length ? [...middle, ...(borrowed ? [borrowed[1]] : []), ...last] : [0];
  let reelTurn = 0;
  const inHero = () => Number(stage.dataset.p || 0) < K.shrink;
  const next = (v) => {
    if (inHero() && cycle.length > 1 && !reduce) showClip(cycle[(reelTurn = (reelTurn + 1) % cycle.length)]);
    else { sceneReset(v); v.currentTime = inPoint(v); play(v); }
  };

  // three scenes over the hero, Maya's lesson through them all: captured at the whiteboard, found by a teammate's
  // agent weeks later, used by on-call during an outage. Each plays once per pass of its clip.
  const sc = $('#hero .scene'), flash = $('#hero .flash');
  const pick = (s) => sc && $(s, sc);
  const shot = pick('.shot'), agentp = pick('.agentp:not(.found):not(.chat)'), kept = pick('.kept'), found = pick('.found'), chat = pick('.chat');
  const typed = new Map(sc ? $$('.ty', sc).map((e) => [e, e.textContent]) : []);
  let scene = null, snapped = false;
  const BOARD = [0.53, 0.1, 0.27, 0.27]; // the part of the frame her phone is pointed at: the whiteboard, clear of her hands
  const grab = (src, crop = BOARD) => {
    const c = $('canvas', shot), w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight;
    c.width = 640; c.height = 360;
    try { c.getContext('2d').drawImage(src, crop[0] * w, crop[1] * h, crop[2] * w, crop[3] * h, 0, 0, 640, 360); } catch (e) {}
  };
  const type = (tl, el, at, duration = 1.0) => {
    const said = typed.get(el), n = { v: 0 };
    tl.call(() => { el.textContent = ''; el.classList.add('typing'); }, null, Math.max(0, at - 0.01))
      .to(n, { v: said.length, duration, ease: 'none', onUpdate: () => { el.textContent = said.slice(0, Math.round(n.v)); } }, at)
      .call(() => el.classList.remove('typing'), null, at + duration + 0.1);
  };
  const rise = { opacity: 0, y: 16 }, risen = { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' };
  const SCENES = {
    // she frames the board, takes the photo; her agent files the decision; the card comes back kept
    'hero-02-whiteboard': { at: 5.4, parts: () => [shot, agentp, kept], run: (tl, v) => {
      grab(v);
      const lines = $$('.l2, .l3', agentp);
      tl.set(lines, { opacity: 0 }, 0)
        .to(flash, { opacity: 0.75, duration: 0.06 }, 0)
        .to(flash, { opacity: 0, duration: 0.6 }, 0.06)
        .fromTo(shot, { opacity: 0, scale: 1.3, rotation: 0, y: 30 }, { opacity: 1, scale: 1, rotation: -4, y: 0, duration: 0.8, ease: 'power3.out' }, 0.05)
        .fromTo(agentp, rise, risen, 0.7);
      type(tl, $('.ty', agentp), 1.1);
      tl.to(lines[0], { opacity: 1, duration: 0.3 }, 2.3)
        .fromTo(lines[1], { y: 4 }, { opacity: 1, y: 0, duration: 0.3 }, 3.4)
        .fromTo(kept, { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' }, 4.0)
        .to([shot, agentp, kept], { opacity: 0, y: -10, duration: 0.6, stagger: 0.08 }, 7.6);
      // the footage keeps moving under the scene: slowed while the agent works, and a slow push-in so it never sits still
      v.playbackRate = 0.7;
      tl.fromTo(v, { scale: 1 }, { scale: 1.07, duration: tl.duration(), ease: 'sine.inOut' }, 0);
    } },
    // weeks later, someone else is about to change the same code; their agent checks first and finds it
    'hero-03-standup': { at: 0.8, parts: () => [found], run: (tl) => {
      const l2 = $('.l2', found), mini = $('.mini', found);
      tl.set([l2, mini], { opacity: 0 }, 0).fromTo(found, rise, risen, 0);
      type(tl, $('.ty', found), 0.4, 1.1);
      tl.to(l2, { opacity: 1, duration: 0.3 }, 1.7)
        .fromTo(mini, { opacity: 0, y: 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }, 2.6)
        .to(found, { opacity: 0, y: -10, duration: 0.6 }, 6.3);
    } },
    // an outage at night: on-call asks in the channel, and the answer quotes the same decision
    'hero-01-incident': { at: 2.6, parts: () => [chat], run: (tl) => {
      const reply = $('.reply', chat);
      tl.set(reply, { opacity: 0 }, 0).fromTo(chat, rise, risen, 0);
      type(tl, $('.ty', chat), 0.4, 1.2);
      tl.fromTo(reply, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 2.2)
        .to(chat, { opacity: 0, y: -10, duration: 0.6 }, 6.2);
    } },
  };
  const sceneOf = (v) => (sc && v.dataset.state === 'real' && SCENES[v.dataset.clip]) || null;
  sceneReset = (v) => {
    if (!sc) return;
    if (scene) scene.kill();
    scene = null; snapped = false;
    typed.forEach((said, el) => { el.textContent = said; el.classList.remove('typing'); });
    gsap.set([...sc.children, flash], { opacity: 0, clearProps: 'transform' });
    gsap.set($$('.l2, .l3, .mini, .reply', sc), { clearProps: 'opacity,transform' });
    reel.forEach((r) => { r.playbackRate = 1; gsap.set(r, { clearProps: 'transform' }); });
    const S = v && sceneOf(v);
    if (reduce && S) { // no motion: the finished scene, still
      if (S.parts().includes(shot)) { const img = new Image(); img.onload = () => grab(img, [0, 0, 1, 1]); img.src = '/media/hero-02-photo.jpg'; }
      gsap.set(S.parts(), { opacity: 1 });
    }
  };
  const runScene = (v, S) => {
    snapped = true;
    scene = gsap.timeline({ onComplete: () => next(v) });
    S.run(scene, v);
  };
  reel.forEach((v, j) => v.addEventListener('timeupdate', () => {
    if (j !== shown) return;
    const t = v.currentTime, end = t >= outPoint(v);
    const S = !reduce && sceneOf(v);
    if (S) {
      if (!snapped && t >= S.at && !end && inHero()) return runScene(v, S);
      if (end && scene) return v.pause(); // hold the last frame while the scene finishes; it moves the reel on
    }
    if (!end) return;
    if (isHero(v)) next(v); else v.currentTime = inPoint(v);
  }));
  showClip(cycle[0]);
  // side panes: shown from their poster, and only download and play once the story reaches the team
  const side = [P.mate, P.agent].map((p) => p.querySelector('video'));
  side.forEach((v) => {
    v.classList.add('on');
    if (v._in !== undefined) v.addEventListener('timeupdate', () => { if (v.currentTime < inPoint(v) - 0.3 || v.currentTime >= outPoint(v)) seekIn(v); });
  });
  let teamAwake = false;
  const wakeTeam = () => { if (teamAwake) return; teamAwake = true; side.forEach((v) => { if (!reduce) v.preload = 'auto'; seekIn(v); play(v); }); };

  let pw, ph, vw, vh;
  const measure = () => { vw = innerWidth; vh = innerHeight; pw = P.footage.offsetWidth; ph = pw * 9 / 16; };

  // the company: an inner ring of teams around the first one, and an outer ring each inner team reaches
  const TILES = ['incident', 'review', 'onboarding', 'handover', 'standup', 'audit', 'servers', 'agent', 'whiteboard', 'late'];
  const tiles = [];
  [[8, 1.12, 0], [16, 1.85, Math.PI / 16]].forEach(([n, r, turn], ring) => {
    for (let i = 0; i < n; i++) {
      const t = document.createElement('div'); t.className = 'tile';
      const name = TILES[tiles.length % TILES.length];
      t.dataset.tile = name;
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
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const build = () => {
    tl.clear(); measure(); placeTiles();
    const len = story.offsetHeight - vh;
    const at = (id, f) => clamp((document.getElementById(id).offsetTop + f * vh) / len);
    // five movements laid end to end across the whole story: every bit of scroll moves something
    const a1 = at('intro', -0.85), a2 = at('ring1', -0.85), a3 = at('ring2', -0.85), a4 = at('ring3', -0.85);
    const dT = a3 - a2, dE = 1 - a4;
    K = {
      shrink: a1, tilt: [a1, a2], lesson: [a2, a3], team: [a3, a4], pull: [a4, 1],
      mate: [a3 + dT * 0.55, a3 + dT * 0.8], agent: [a3 + dT * 0.65, a3 + dT * 0.92],
      reach: [a4 + dE * 0.2, 0.985],
    };
    const d = (k) => K[k][1] - K[k][0];
    const cover = Math.max(vw / pw, vh / ph) * 1.02, dy = (0.5 - (phone() ? 0.34 : 0.42)) * vh;
    const tilt = phone() ? 14 : 26;
    gsap.set(P.footage, { scale: cover, y: dy, borderRadius: 0, opacity: 1, z: 0 });
    gsap.set([P.trace, P.grid], { opacity: 0, z: 0, x: 0 });
    gsap.set(P.lesson, { opacity: 0, z: 120, y: -ph * 0.06, scale: 0.92 });
    // desktop: the team stands to Maya's right; phone: side by side beneath her pane
    if (phone()) {
      gsap.set(P.mate, { opacity: 0, x: -pw * 0.26, y: ph * 0.8, z: -20 });
      gsap.set(P.agent, { opacity: 0, x: pw * 0.26, y: ph * 0.8, z: -20 });
    } else {
      gsap.set(P.mate, { opacity: 0, x: pw * 0.66, y: -ph * 0.32, z: -40 });
      gsap.set(P.agent, { opacity: 0, x: pw * 0.66, y: ph * 0.26, z: -40 });
    }
    gsap.set(rig, { rotationY: 0, rotationX: 0, x: 0, y: 0, scale: 1 });
    gsap.set(reel, { scale: 1 });
    tiles.forEach((t) => gsap.set(t.el, { opacity: 0 }));
    tl
      // a slow push into the footage the whole way through, so the picture is never still
      .to(reel, { scale: 1.12, duration: 1 }, 0)
      // 1. the moment shrinks into a pane
      .to(P.footage, { scale: 1, y: 0, borderRadius: 16, duration: K.shrink, ease: 'power1.inOut' }, 0)
      // 2. it turns, and its layers separate
      .to(rig, { rotationY: -tilt, rotationX: tilt * 0.25, duration: d('tilt') }, K.tilt[0])
      // the traced lines lie exactly on the footage, so every line sits on Maya; the grid fans out behind
      .to(P.trace, { opacity: 0.95, z: 0, x: 0, y: 0, duration: d('tilt') * 0.7 }, K.tilt[0])
      .to(P.grid, { opacity: 0.55, z: -320, x: pw * (phone() ? 0.14 : 0.36), duration: d('tilt') * 0.7 }, K.tilt[0] + d('tilt') * 0.3)
      // 3. one person: the lesson lifts out of the moment, slowly, the whole chapter long
      .to(P.footage, { opacity: 0.55, duration: d('lesson') * 0.5 }, K.lesson[0])
      .to(P.lesson, { opacity: 1, scale: 1, duration: d('lesson') * 0.15 }, K.lesson[0])
      .to(P.lesson, { z: phone() ? 90 : 300, duration: d('lesson') }, K.lesson[0])
      .to(rig, { rotationY: -tilt * 0.75, duration: d('lesson') }, K.lesson[0])
      // 4. the team: the rig turns toward the people the lesson reaches
      .to(rig, { rotationY: phone() ? 0 : -tilt * 0.3, rotationX: 0, x: phone() ? 0 : -pw * 0.24, y: phone() ? -vh * 0.06 : -vh * 0.04, duration: d('team') * 0.6 }, K.team[0])
      .to(P.mate, { opacity: 1, duration: d('team') * 0.2 }, K.team[0] + d('team') * 0.5)
      .to(P.agent, { opacity: 1, duration: d('team') * 0.2 }, K.team[0] + d('team') * 0.6)
      // 5. the company: pull back until the first team is one of many
      .to(rig, { scale: phone() ? 0.34 : 0.4, rotationY: 0, x: 0, y: -vh * (phone() ? 0.02 : 0.07), duration: d('pull') * 0.75 }, K.pull[0])
      .to([P.trace, P.grid], { opacity: 0, duration: d('pull') * 0.4 }, K.pull[0])
      .to(P.footage, { opacity: 1, duration: d('pull') * 0.5 }, K.pull[0]);
    tiles.forEach((t) => {
      t.reach = K.reach[0] + (t.ring ? 0.38 + (t.i / t.n) * 0.6 : (t.i / t.n) * 0.32) * d('reach');
      t.dur = 0.08 * d('reach');
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

  const trace = tracer(640, 360);
  const traceCanvas = $('canvas', P.trace);
  let lastTrace = 0, tracedStill = null;
  const chapters = $$('.beat'), caps = $$('.capin');

  let tilesLoaded = false;
  const loadTiles = () => {
    if (tilesLoaded) return; tilesLoaded = true;
    tiles.forEach((t) => exists(`/media/tile-${t.el.dataset.tile}.jpg`).then((ok) => { if (ok) { const im = new Image(); im.src = `/media/tile-${t.el.dataset.tile}.jpg`; im.alt = ''; t.el.appendChild(im); } }));
  };
  const update = (p) => {
    stage.dataset.p = p.toFixed(4);
    if (p >= K.team[0] - 0.04) wakeTeam();
    if (p >= K.team[1] - 0.08) loadTiles();
    tl.progress(p);
    showClip(p < K.shrink ? (isHero(reel[shown]) ? shown : cycle[reelTurn]) : mayaAt); // found by name: positions shift as clips come and go
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
      heroin.style.opacity = String(1 - span(h, 0.02, 0.2));
      heroin.style.transform = `translateY(${-h * 60}px)`;
      if (sc) sc.style.opacity = heroin.style.opacity;
      const rs = caps.map((c) => c.parentElement.getBoundingClientRect());
      caps.forEach((c, i) => { c.style.opacity = String(span(1 - rs[i].top / innerHeight, 0.2, 0.42) * span(rs[i].bottom / innerHeight, 0.98, 1.16)); });
      nav.classList.toggle('dark', story.getBoundingClientRect().bottom > 70);
    }
    if (traceVisible && live) {
      const now = performance.now();
      if (live._still) { if (tracedStill !== live._still && trace(live, traceCanvas, [255, 255, 255], 0.07)) tracedStill = live._still; }
      else if (now - lastTrace > 100) { lastTrace = now; trace(live, traceCanvas, [255, 255, 255], 0.07); tracedStill = null; }
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
  const where = $('#where'), ots = $$('.ot', where);
  const wide = () => innerWidth >= 1024;
  // the tools sit on an ellipse just outside the sentence and drift round it as the reader scrolls
  let last = NaN;
  const place = () => {
    if (scrollY === last) return; last = scrollY;
    const r = where.getBoundingClientRect();
    if (!wide()) { ots.forEach((o) => { o.style.transform = ''; }); return; }
    if (r.bottom < 0 || r.top > innerHeight) return;
    const spin = reduce ? 0 : span(innerHeight - r.top, 0, innerHeight + r.height) * 0.9;
    const rx = Math.min(r.width * 0.36, 560), ry = r.height * 0.36;
    ots.forEach((o, i) => {
      const a = -Math.PI / 2 + (i / ots.length) * Math.PI * 2 + spin;
      o.style.transform = `translate(${r.width / 2 + Math.cos(a) * rx - o.offsetWidth / 2}px, ${r.height / 2 + Math.sin(a) * ry - o.offsetHeight / 2}px)`;
    });
  };
  addEventListener('resize', () => { last = NaN; place(); });
  gsap.ticker.add(place);
  const words = $$('.rot > span'); let k = 0; words[0].classList.add('on');
  if (!reduce) setInterval(() => { words[k].classList.remove('on'); k = (k + 1) % words.length; words[k].classList.add('on'); }, 2200);
}

// ---------------------------------------------------------------- the close: the person who started it, as one line
function drawing() {
  const close = $('#close');
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); portrait(); } }, { rootMargin: '900px 0px' }).observe(close);
}
async function portrait() {
  const c = $('.drawing');
  let v = $('video[data-clip="ch1-maya"]');
  if (!v || !['real', 'still'].includes(v.dataset.state)) { c.hidden = true; return; } // a stand-in traced is noise, not a portrait
  if (await exists('/media/ch1-maya.jpg')) { const im = new Image(); im.src = '/media/ch1-maya.jpg'; v = { _still: im, addEventListener: (...a) => im.addEventListener(...a) }; }
  const trace = tracer(480, 270);
  const go = () => { if (!trace(v, c, [27, 25, 21], 0.15)) setTimeout(go, 400); };
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
if (ready && !reduce && window.Lenis) {
  const lenis = new Lenis({ lerp: 0.085 });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
if (ready) {
  runProof($('#proof'), $('#proofToggle'));
  fills();
  daylight();
  film().then(drawing);
}
