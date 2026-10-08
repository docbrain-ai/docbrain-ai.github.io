// The homepage picture: one person, their team, the company. And the proof moment.
const NS = 'http://www.w3.org/2000/svg';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent.appendChild(n);
  return n;
}
const ring = (cx, cy, r, n, turn = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

// --- the scene: drawn once, the stage's data-stage decides how much of it shows
function drawScene(svg) {
  const world = el('g', { class: 'world' }, svg);
  const links = el('g', {}, world);
  const org = el('g', { class: 'org' }, world);
  const team = el('g', { class: 'team' }, world);
  const me = el('g', {}, world);
  const line = (g, a, b) => el('line', { class: 'lnk', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);

  // the company: six other teams around Maya's, each one lit by what reached it
  const hubs = ring(0, 0, 560, 6, Math.PI / 6);
  const orgLinks = el('g', { class: 'org' }, links);
  hubs.forEach((h, i) => {
    line(orgLinks, [0, 0], h);
    line(orgLinks, h, hubs[(i + 1) % hubs.length]);
    el('circle', { class: 'lit', cx: h[0], cy: h[1], r: 9 }, org);
    ring(h[0], h[1], 95, 7, i).forEach((p, j) => {
      line(orgLinks, h, p);
      el('circle', { class: j % 3 === 0 ? 'lit' : 'nd', cx: p[0], cy: p[1], r: 6 }, org);
    });
  });

  // the team: the people closest to Maya
  const teamLinks = el('g', { class: 'team' }, links);
  const mates = ring(0, 0, 120, 7, -Math.PI / 2);
  mates.forEach((p, i) => {
    line(teamLinks, [0, 0], p);
    line(teamLinks, p, mates[(i + 1) % mates.length]);
    el('circle', { class: 'lit', cx: p[0], cy: p[1], r: 7 }, team);
  });

  // one person
  el('circle', { class: 'halo', cx: 0, cy: 0, r: 30 }, me);
  el('circle', { class: 'me', cx: 0, cy: 0, r: 11 }, me);
}

// --- scroll: the beat under the reading line sets the stage
function followStory(stage, beats) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const phone = innerWidth < 832;
    const y = innerHeight * (phone ? 0.7 : 0.5);
    let s = '0';
    for (const b of beats) {
      const r = b.getBoundingClientRect();
      if (r.top <= y) s = b.dataset.stage;
    }
    if (stage.dataset.stage !== s) stage.dataset.stage = s;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

// --- proof: three moments, one lesson; plays only while seen, and the reader can stop it
function runProof(proof, button) {
  const STEP_MS = 6500;
  let timer = null, inView = false, userPaused = reduce;
  const label = () => {
    button.textContent = userPaused ? 'Play' : 'Pause';
    button.setAttribute('aria-pressed', String(userPaused));
  };
  const sync = () => {
    const play = inView && !userPaused;
    proof.dataset.playing = String(play);
    if (play && !timer) {
      timer = setInterval(() => { proof.dataset.step = String((Number(proof.dataset.step) + 1) % 3); }, STEP_MS);
    } else if (!play && timer) { clearInterval(timer); timer = null; }
  };
  button.addEventListener('click', () => { userPaused = !userPaused; label(); sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(proof);
  label();
}

drawScene(document.getElementById('scene'));
followStory(document.querySelector('.stage'), [...document.querySelectorAll('.beat')]);
runProof(document.getElementById('proof'), document.getElementById('proofToggle'));
