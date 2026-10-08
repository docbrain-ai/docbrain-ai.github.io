// The homepage picture: the reader's scroll pulls the camera back from Maya to her team to the company,
// and what she learned travels outward as they go. And the proof moment.

// links into the old homepage's sections now live on their own pages
const MOVED = { pricing: '/pricing/' };
for (const id of ['b1', 'b2', 'b3', 'b5', 'b6', 'forge', 'recap', 'ops', 'roi', 'compare', 'honest', 'faq', 'start']) MOVED[id] = `/how-it-works/#${id}`;
const old = location.hash.slice(1);
if (MOVED[old]) location.replace(MOVED[old]);

document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// --- the people. t is how far into the story the lesson reaches them (0..1)
function buildPeople() {
  const people = [{ x: 0, y: 0, t: -1, parent: null, me: true }];
  const add = (x, y, t, parent) => { people.push({ x, y, t, parent }); return people.length - 1; };
  const around = (cx, cy, r, n, turn) => Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const nearest = (x, y, ids) => ids.reduce((b, i) => (Math.hypot(people[i].x - x, people[i].y - y) < Math.hypot(people[b].x - x, people[b].y - y) ? i : b));

  const team = around(0, 0, 1.3, 7, -Math.PI / 2).map(([x, y], i) => add(x, y, 0.38 + i * 0.018, 0));
  const growTeam = (hx, hy, hubT, parent, turn) => {
    const hub = add(hx, hy, hubT, parent);
    around(hx, hy, 1.15, 12, turn).forEach(([x, y], j) => add(x, y, hubT + 0.035 + j * 0.006, hub));
    return hub;
  };
  const near = around(0, 0, 4.2, 6, Math.PI / 6).map(([x, y], i) => growTeam(x, y, 0.56 + i * 0.016, nearest(x, y, team), i));
  around(0, 0, 8.4, 12, 0).forEach(([x, y], i) => growTeam(x, y, 0.75 + i * 0.009, nearest(x, y, near), i * 0.5));
  return people;
}

// --- the camera: p (0..1 through the story) -> zoom, eased like a real pull-back
const KEYS = [[0, 16], [0.33, 8], [0.5, 3.4], [0.67, 2.2], [1, 1.1]];
function zoomAt(p) {
  for (let i = 1; i < KEYS.length; i++) {
    const [p0, k0] = KEYS[i - 1], [p1, k1] = KEYS[i];
    if (p <= p1) return k0 * (k1 / k0) ** ((p - p0) / (p1 - p0));
  }
  return KEYS.at(-1)[1];
}
const STILL = { 0: 0, 1: 0.33, 2: 0.67, 3: 1 }; // reduced motion: one frame per beat

function runScene(story, stage, canvas, card, beats) {
  const people = buildPeople();
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, U = 1, colors = {};

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = { glow: cs.getPropertyValue('--glow').trim(), node: cs.getPropertyValue('--node').trim(), line: cs.getPropertyValue('--line').trim() };
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = Math.min(W, H) / 24;
  };

  const beatNow = () => {
    const y = innerHeight * (innerWidth < 832 ? 0.7 : 0.5);
    let s = '0';
    for (const b of beats) if (b.getBoundingClientRect().top <= y) s = b.dataset.stage;
    return s;
  };

  function draw() {
    const s = beatNow();
    stage.dataset.stage = s;
    const r = story.getBoundingClientRect();
    let p = clamp(-r.top / (story.offsetHeight - innerHeight));
    if (reduce) p = STILL[s];
    const k = zoomAt(p);
    const phone = W < 832;
    const cx = W * (phone ? 0.5 : 0.68), cy = H * (phone ? 0.78 : 0.5);
    const at = (n) => [cx + n.x * k * U, cy + n.y * k * U];
    const lit = (n) => clamp((p - n.t) / 0.04);

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    // the links, and the lesson travelling along them
    for (const n of people) {
      if (n.parent === null) continue;
      const a = at(people[n.parent]), b = at(n);
      ctx.strokeStyle = colors.line; ctx.lineWidth = 1; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      const from = Math.max(people[n.parent].t, 0);
      const f = clamp((p - from) / (n.t - from + 0.04));
      if (f > 0) {
        const hx = a[0] + (b[0] - a[0]) * f, hy = a[1] + (b[1] - a[1]) * f;
        ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(hx, hy); ctx.stroke();
        if (f < 1) { ctx.fillStyle = colors.glow; ctx.beginPath(); ctx.arc(hx, hy, 3.2, 0, 7); ctx.fill(); }
      }
    }
    // the people
    let count = 0;
    for (const n of people) {
      const [x, y] = at(n);
      const L = lit(n);
      if (L >= 0.5) count++;
      const rad = n.me ? clamp(0.16 * k * U, 7, 16) : clamp(0.08 * k * U, 2.2, 6.5) * (1 + 0.25 * L);
      // everyone is there from the start, faint; the lesson warms them as it arrives
      ctx.globalAlpha = 0.28; ctx.fillStyle = colors.node;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
      if (L > 0) {
        ctx.globalAlpha = 0.13 * L; ctx.fillStyle = colors.glow;
        ctx.beginPath(); ctx.arc(x, y, rad * 2.2, 0, 7); ctx.fill();
        ctx.globalAlpha = L;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Maya's card sits on her light and shrinks into it
    const show = clamp((k - 4.2) / 3);
    const scale = clamp((k / 16) ** 0.55, 0.35, 1);
    card.style.opacity = String(show);
    card.style.transform = `translate(${cx - card.offsetWidth / 2}px, ${cy - card.offsetHeight / 2}px) scale(${scale})`;

    stage.dataset.zoom = k.toFixed(3);
    stage.dataset.lit = String(count);
  }

  let queued = false;
  const frame = () => { queued = false; draw(); };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { resize(); request(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); request(); });
  readColors(); resize(); draw();
}

// --- proof: three moments, one lesson; plays only while seen, and the reader can stop it
function runProof(proof, button) {
  const STEP_MS = 6500;
  let timer = null, inView = false, userPaused = reduce;
  const sync = () => {
    button.textContent = userPaused ? 'Play' : 'Pause';
    const play = inView && !userPaused;
    proof.dataset.playing = String(play);
    if (play && !timer) {
      timer = setInterval(() => { proof.dataset.step = String((Number(proof.dataset.step) + 1) % 3); }, STEP_MS);
    } else if (!play && timer) { clearInterval(timer); timer = null; }
  };
  button.hidden = false;
  button.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(proof);
  sync();
}

runScene(document.querySelector('.story'), document.querySelector('.stage'), document.getElementById('scene'),
  document.querySelector('.maya'), [...document.querySelectorAll('.beat')]);
runProof(document.getElementById('proof'), document.getElementById('proofToggle'));
