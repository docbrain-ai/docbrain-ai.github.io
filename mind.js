// The rope is simulated in PAGE space, not inside his SVG.
//
// That was the bug: simulated locally, his walking never reached it, so I faked
// the drag with a constant sideways force. Constant force + constant gravity has
// exactly one equilibrium — a straight diagonal. It looked like a walking stick.
//
// Anchored to his hand in page coordinates, the motion IS the input: he walks,
// the anchor moves, the rope lags, curves, whips and settles on its own.
export function makeRope(container, getAnchor, opts = {}) {
  const { links = 15, seg = 13, gravity = .55, damp = .95, iter = 12, reduced = false } = opts;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ropelayer');
  const path = document.createElementNS(NS, 'path');
  svg.appendChild(path); container.appendChild(svg);

  const a0 = getAnchor();
  const P = [];
  for (let i = 0; i < links; i++)
    P.push({ x: a0.x - i * seg * .3, y: a0.y + i * seg * .5, px: a0.x, py: a0.y });

  // len 1 = he is carrying all of it alone; 0 = he carries nothing at all
  const S = { lift: 0, slack: 1, len: 1 };
  let raf = 0, t = 0;

  function frame() {
    t++;
    const a = getAnchor();
    for (const p of P) {
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      p.x += vx + Math.sin(t * .03 + p.y * .02) * .25;   // air, not a constant push
      p.y += vy + gravity - S.lift * gravity * 1.9;
    }
    P[0].x = a.x; P[0].y = a.y;
    const L = seg * S.slack;
    for (let k = 0; k < iter; k++) {
      for (let i = 0; i < P.length - 1; i++) {
        const p = P[i], q = P[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 1e-4, f = (d - L) / d * .5;
        const ox = dx * f, oy = dy * f;
        if (i > 0) { p.x += ox; p.y += oy; }
        q.x -= ox; q.y -= oy;
      }
      P[0].x = a.x; P[0].y = a.y;
    }
    // draw only as much rope as he is still carrying
    const n = Math.max(0, Math.min(P.length, Math.round(P.length * S.len)));
    if (n < 2) { path.setAttribute('d', ''); path.style.opacity = '0'; }
    else {
      path.style.opacity = '';
      let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
      for (let i = 1; i < n - 1; i++) {
        const xc = (P[i].x + P[i + 1].x) / 2, yc = (P[i].y + P[i + 1].y) / 2;
        d += ` Q${P[i].x.toFixed(1)} ${P[i].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
      }
      const last = P[n - 1];
      d += ` T${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      path.setAttribute('d', d);
    }
    raf = requestAnimationFrame(frame);
  }
  // Draw the first frame SYNCHRONOUSLY. Waiting for rAF left the rope with no
  // path at all until the next frame, so it popped into existence a beat after
  // he did. frame() schedules its own successor, so this starts the loop too.
  frame();
  if (reduced) cancelAnimationFrame(raf);

  // Snap every link onto the anchor. Without this, moving him to a new mark
  // drags the whole rope across the page in one frame — an 873px streak over
  // the copy — instead of the rope simply being where he now is.
  function reset(){
    const a = getAnchor();
    for (let i = 0; i < P.length; i++) {
      P[i].x = a.x - i * seg * .3; P[i].y = a.y + i * seg * .5;
      P[i].px = P[i].x; P[i].py = P[i].y;
    }
  }
  return { set:(k,v)=>{S[k]=v;}, assign:(o)=>Object.assign(S,o),
           reset, stop:()=>cancelAnimationFrame(raf) };
}
