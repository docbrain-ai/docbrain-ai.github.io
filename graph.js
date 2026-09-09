// The memory, in three dimensions. A depth field of captured knowledge the
// camera flies through as you read, plus two narrative actors in screen space:
// the claim that survives the page, and the agent that asks for it.
// `tension` pushes the camera in and pulls the field tight — the graph holds
// its breath at the moment the agent is about to get it wrong.
const rnd = (s) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const lerp = (a, b, k) => a + (b - a) * k;

export function initGraph(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d');
  const R = rnd(20260909);
  const SMALL = innerWidth < 780;
  const N = reduced ? 40 : SMALL ? 70 : 150;
  const FAR = 4.6, NEAR = .5;

  const field = [];
  for (let i = 0; i < N; i++)
    field.push({ x: R() * 2 - 1, y: R() * 2 - 1,
                 z: NEAR + R() * (FAR - NEAR),        // fixed depth — never recycled
                 vx: (R() - .5) * .00022, vy: (R() - .5) * .00022,
                 r: .5 + R() * 1.1, ph: R() * 6.28, e: 0 });

  // the two actors, in screen space — they must stay legible at every depth
  const claim = { fx: .74, fy: .40, e: 0 };
  const agent = { fx: .24, fy: .64, e: 0 };

  const S = { field: .16, claim: 0, agent: 0, crack: 0, sealed: 0,
              tension: 0, open: 0, pulse: -1 };

  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(innerWidth < 780 ? 1.5 : 2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', size, { passive: true }); size();

  const C = { warm:[236,231,218], green:[95,191,149], amber:[212,164,76], blue:[111,168,220] };
  const rgba = (c,a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

  let t = 0, raf = 0, tenS = 0, openS = 0;
  function draw() {
    t++;
    tenS = lerp(tenS, S.tension, .09);
    openS = lerp(openS, S.open, .035);      // monotonic: the memory only ever opens
    ctx.clearRect(0, 0, W, H);

    // The memory OPENS as you read: a horizon that only ever recedes, sodeep nodes
    // arrive and stay. Nothing cycles, nothing returns to where it began.
    const o = openS;
    // Layout and size are SEPARATE. Coupling both to the perspective divisor is
    // what made the field shrink into sub-pixel dust instead of opening out.
    // Position: a fraction of the viewport that grows as the memory opens.
    const FRAC = (.40 + o * .52) * (1 - tenS * .12);
    // Size: perspective, softened so distant nodes stay above one pixel.
    const FOV = 520 * (1 + tenS * .42);
    const horizon = NEAR + (FAR - NEAR) * (.24 + .76 * o);// how deep you can see, ever-growing
    const cx = W / 2, cy = H / 2;
    const life = reduced ? 0 : (1 - tenS * .92);          // the field stops breathing under tension

    // project the depth field
    const pts = [];
    for (let i = 0; i < N; i++) {
      const n = field[i];
      if (life) {
        n.x += n.vx * life; n.y += n.vy * life;
        if (n.x < -1 || n.x > 1) n.vx *= -1;
        if (n.y < -1 || n.y > 1) n.vy *= -1;
      }
      const d = n.z;                                   // fixed: no recycling
      const revealed = Math.min(1, (horizon - d) / .8);   // fades in as the horizon reaches it
      if (revealed <= 0) { n.e += (0 - n.e) * .05; continue; }
      n.e += (S.field * revealed - n.e) * .05;
      const a = n.e * Math.min(1, (d - NEAR) / .3);       // no giant blob at the lens
      if (a < .006) continue;
      const sz = FOV / Math.pow(d, .85);                  // softened perspective, size only
      pts.push({ x: cx + n.x * (W * .5) * FRAC,
                 y: cy + n.y * (H * .5) * FRAC * .82,
                 r: Math.max(.75, n.r * sz / 220), a, d,
                 tw: reduced ? 1 : .82 + Math.sin(t * .02 + n.ph) * .18 });
    }

    // edges — only between neighbours at similar depth, so it reads as volume
    ctx.lineWidth = 1;
    const lim = Math.min(W, H) * (.155 - o * .05);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (Math.abs(pts[i].d - pts[j].d) > 1.1) continue;
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > lim) continue;
        const a = (1 - dist / lim) * Math.min(pts[i].a, pts[j].a) * .5;
        if (a < .005) continue;
        ctx.strokeStyle = rgba(C.warm, a);
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
    for (const p of pts) {
      ctx.fillStyle = rgba(C.warm, Math.min(1, p.a * p.tw));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
    }

    // the actors
    claim.e += (S.claim - claim.e) * .05;
    agent.e += (S.agent - agent.e) * .05;
    const ax = agent.fx * W, ay = agent.fy * H;
    const bx = claim.fx * W, by = claim.fy * H;
    const claimC = S.crack > .5 ? C.amber : C.green;

    // the claim's citations reaching into the field
    if (claim.e > .05) {
      for (const p of pts) {
        const dist = Math.hypot(p.x - bx, p.y - by);
        if (dist > Math.min(W, H) * .30) continue;
        let a = (1 - dist / (Math.min(W, H) * .30)) * claim.e * p.a * 2.4;
        if (S.crack > .5 && ((Math.round(p.x + p.y) + Math.floor(t / 8)) % 4 === 0)) continue;
        if (a < .006) continue;
        ctx.strokeStyle = rgba(claimC, Math.min(.5, a));
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
    // the query, travelling
    if (S.pulse >= 0) {
      const k = S.pulse <= 1 ? S.pulse : 2 - S.pulse;
      const px = ax + (bx - ax) * k, py = ay + (by - ay) * k;
      ctx.strokeStyle = rgba(C.blue, .38);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const g = ctx.createRadialGradient(px, py, 0, px, py, 26);
      g.addColorStop(0, rgba(S.pulse <= 1 ? C.blue : claimC, .95));
      g.addColorStop(1, rgba(C.blue, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 26, 0, 6.284); ctx.fill();
    }
    for (const [n, x, y, col, base] of [[agent, ax, ay, C.blue, 2.2], [claim, bx, by, claimC, 3.2]]) {
      if (n.e < .02) continue;
      const pulseR = reduced ? 1 : 1 + Math.sin(t * .035) * .06 * (1 + tenS * 2);
      const rad = (38 + n.e * 30) * (1 + tenS * .25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(col, .26 * n.e)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.284); ctx.fill();
      ctx.fillStyle = rgba(col, n.e);
      ctx.beginPath(); ctx.arc(x, y, base * pulseR, 0, 6.284); ctx.fill();
    }
    if (S.sealed > .01) {
      ctx.strokeStyle = rgba(C.warm, S.sealed * .75); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, 13, 0, 6.284); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, 17.5, 0, 6.284); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // the room closes in when it matters
    if (tenS > .01) {
      const v = ctx.createRadialGradient(cx, cy, Math.min(W,H) * (.30 - tenS * .10), cx, cy, Math.max(W,H) * .78);
      v.addColorStop(0, 'rgba(9,9,8,0)'); v.addColorStop(1, `rgba(9,9,8,${(tenS * .72).toFixed(3)})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(draw);
  }

  if (reduced) {
    S.field = .34; S.claim = .95; S.agent = .5; S.open = 1; openS = 1;
    for (const n of field) n.e = S.field;
    claim.e = S.claim; agent.e = S.agent;
    draw(); cancelAnimationFrame(raf);
  } else raf = requestAnimationFrame(draw);

  return { set:(k,v)=>{S[k]=v;}, assign:(o)=>Object.assign(S,o), stop:()=>cancelAnimationFrame(raf) };
}
