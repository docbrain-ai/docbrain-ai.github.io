// ONE camera. The lattice and the story panels are objects in the same space,
// projected by the same maths — which is what makes it a place rather than a
// background with divs on top.
//
// The camera always has a DESTINATION (the next node). The previous version
// scaled a container with no subject, which is why the push-in read as random.

export const NODES = {           // where each beat sits in the memory, in world units
  b1: { z: 10, x:  .10, y: -.05 },
  b2: { z: 20, x: -.16, y:  .08 },
  b3: { z: 30, x:  .14, y: -.02 },
  b5: { z: 40, x: -.12, y:  .06 },
  b6: { z: 50, x:  .02, y: -.04 },
};
export const NEAR = 1.2, FOCAL = 900;
// The camera stops SHORT of a node at a comfortable viewing distance rather
// than flying through it. A panel is exactly scale 1.0 at VIEW.
export const VIEW = 8;

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function makeWorld() {
  const cam = { z: 0, x: 0, y: 0 };        // eased
  const want = { z: 0, x: 0, y: 0 };       // target, written by scroll
  let shake = 0;

  return {
    /** scroll position -> a point on the flight path through the memory */
    fly(u, ids) {
      // u is 0..1 across the whole film; ids are the beats in order
      const span = ids.length - 1;
      const f = clamp(u, 0, 1) * span;
      const i = Math.min(span, Math.floor(f)), t = f - i;
      const a = NODES[ids[i]], b = NODES[ids[Math.min(span, i + 1)]];
      want.z = lerp(a.z, b.z, t) - VIEW;      // hold back, so the node is IN FRONT of you
      want.x = lerp(a.x, b.x, t);
      want.y = lerp(a.y, b.y, t);
    },
    step() {
      cam.z = lerp(cam.z, want.z, .085);
      cam.x = lerp(cam.x, want.x, .07);
      cam.y = lerp(cam.y, want.y, .07);
      shake *= .87;
    },
    punch(v) { shake = v; },
    get z() { return cam.z; }, get x() { return cam.x; }, get y() { return cam.y; },
    get shake() { return shake; },

    /** project a world point to the screen. One place, so nothing can drift apart. */
    project(p, W, H) {
      const d = p.z - cam.z;
      if (d <= NEAR) return null;                 // behind or through the lens
      const s = FOCAL / d;
      return {
        x: W / 2 + (p.x - cam.x) * s,
        y: H / 2 + (p.y - cam.y) * s,
        s, d,
        // 1.0 exactly at the viewing distance; smaller further out
        scale: VIEW / d,
        // resolve: a node arrives out of the field rather than fading in
        resolve: clamp((26 - d) / 12, 0, 1) * clamp((d - NEAR) / 3.5, 0, 1),
      };
    },

    /** The bounded envelope. A panel may never exceed the frame — this is the
     *  rule the old camera lacked, which is why it pushed content off-screen. */
    fit(natW, natH, W, H, s) {
      const maxW = W * .92, maxH = H * .80;
      return clamp(s, .55, Math.min(maxW / natW, maxH / natH, 1.18));
    },
  };
}
