import { load, verify, records, sha256 } from './dbev.js';
import { initGraph } from './graph.js';
import { initCinema } from './cinema.js';
import { makeWorld, VIEW } from './world.js';
import { mountBrain } from './brain.js';
import { makeRope } from './mind.js';

const $ = (i) => document.getElementById(i);
const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// One 404 here used to kill the whole module — top-level await, so the ROI
// calculator, the verifier and the scroll engine all died with it.
let RUNS, NIGHT, PREM, fixturesOK = true;
try {
  [RUNS, NIGHT, PREM] = await Promise.all(
    ['fixtures/runs.json','fixtures/night.json','fixtures/premise.json'].map(async u => {
      const r = await fetch(u); if (!r.ok) throw new Error(`${u} -> ${r.status}`); return r.json();
    }));
} catch (e) {
  console.error('fixtures failed to load', e);
  fixturesOK = false;
  RUNS  = { runs: [], fallback: { steps: [] }, _provenance: { status: 'fixtures unavailable' } };
  NIGHT = { messages: [], captured: { headline:'', detail:'', source:'', author:'', spans:0 } };
  PREM  = { watching:'', holds:{line:'',answer:'',note:''}, broken:{line:'',answer:'',note:'',changed:'',downstream:[]} };
}

const G = initGraph($('graph'), { reduced: REDUCED });
const CIN = initCinema({ reduced: REDUCED });

/* ================= THE STORYTELLER =================
   He is not a narrator. He is the engineer whose head IS the documentation —
   and he walks the whole film with you, reacting to each beat. */
const GUIDE = mountBrain($('guide'), 'walk');
// Exactly as brain.html hangs it. The rope was hosted on HIM — a 158x214 box —
// so it had no room to hang, lag or swing and read as a stick. brain.html hangs
// it on a big container (.stagey, 340px tall) with links:16 seg:15; here the
// container is the whole frame, so the rope behaves the same way everywhere.
const guideRope = makeRope($('ropestage'), () => {
  const el = $('guide');
  const hand = el.querySelector('.b-hand');
  const r = (hand || el).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };   // host is the viewport
}, { links: 16, seg: 15, reduced: REDUCED });
// brain.html loosens the rope on the beats where he is visibly drowning in it
const SLACKY = new Set(['swamped', 'asked', 'blank', 'weary']);
function ropeFor(len){ guideRope.assign({ len, slack: SLACKY.has(guidePose) ? 1.25 : 1 }); }

// He replaces the five title cards. Each act gets exactly two moments: the hook
// he opens on, and the turn — the thing that has just gone wrong, or just been
// caught. Two lines an act is the most a person will actually read while
// scrolling; the running detail is on the subtitle underneath him.
const ACT = {
  // 'walk' IS this line in brain.js — "hauling it, he walks everywhere towing
  // seven systems". Same character as the title card, so he carries straight over.
  0: { pose:'walk',      open:'Every question in this company routes through me.' },
  // 2am page -> she actually solves it. The turn is a WIN, not more strain.
  1: { pose:'alert',     open:'Two in the morning. Checkout is down again.',
       at:.44, pose2:'found',     turn:'There — she just worked it out. Now watch where it goes.' },
  // resignation first (of course she left), THEN the blank: blank IS forgetting.
  2: { pose:'weary',     open:'Eight months. She moved teams, the thread scrolled away.',
       at:.46, pose2:'blank',     turn:'And I have completely forgotten it.' },
  3: { pose:'asked',     open:'November. Someone new opens the very same file.',
       at:.42, pose2:'block',     turn:"Stop — I have seen this exact one before." },
  // the alarm is the open; the turn is the product winning, so he gets to gloat.
  4: { pose:'panic',     open:'Someone just edited the file that answer came from.',
       at:.44, pose2:'smug',      turn:'So the answer is wrong now. It noticed before you did.' },
  // he is being doubted, then he hands it to you.
  5: { pose:'asked',     open:'And how do you know any of this is real?',
       at:.40, pose2:'hero',      turn:"Check it yourself. Turn your internet off first." },
};
// and he keeps going, all the way down
const GUIDE_DOC = [
  ['forge',   'asked',  'Go on. Rewrite what she said. It will catch you.'],
  ['recap',   'found', 'One sentence. Eight months. Three seconds.'],
  ['ops',     'asked',  'Four services. Your platform team will be fine.'],
  ['pricing', 'smug',   'Never per person. I am unlimited and I am delightful.'],
  ['roi',     'asked',  'That is my time, costed out. Sobering, isn\'t it.'],
  ['compare', 'block',  'Two of those rows go against us. We left them in.'],
  ['honest',  'weary',  'This is the bit most companies delete.'],
  ['faq',     'found', 'Ask me. I actually enjoy it now.'],
  ['start',   'wave',   'Right. Go and self-host it. I have nothing else to do.'],
];
let guideBeat = -1, guideKey = '', guideX = 0, guideFace = 1, guideStill = 0, sayTimer = 0;
let guideSettled = true, guidePose = 'swamped', guideFacing = false, guideShown = '', guideW0 = 0;
const guideHand = { x: 160, y: 0 };
let guideTurned = false;

function docSection(){
  const mid = innerHeight * .62;
  let found = null;
  for (const [id] of GUIDE_DOC) {
    const el = $(id); if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid * .3) found = id;
  }
  return found;
}

// He speaks in MOMENTS. A bubble that never leaves becomes wallpaper and you
// stop reading it. It arrives on a change, holds, and goes.
function speak(text){
  clearTimeout(sayTimer);
  GUIDE.say(text);
  sayTimer = setTimeout(() => GUIDE.say(''), 5200);
}

// He WALKS the page: his position tracks how far down you are, so he travels
// with you instead of standing in a corner. And he only walks while YOU move —
// stop scrolling and he stops, then performs the beat he is standing in.
const FLOOR = $('floor'), FLOORPATH = FLOOR && FLOOR.querySelector('path');
// the thing he is talking about right now
const SUBJ = { 0:'top', 1:'b1', 2:'b2', 3:'b3', 4:'b5', 5:'b6' };
function currentSubject(){
  if (guideKey) { const d = $(guideKey); return d ? (d.querySelector('.tblwrap,.grid3,.grid2,.calc,.lie,.atk') || d) : null; }
  const id = SUBJ[guideBeat < 0 ? 0 : guideBeat];
  const sec = $(id);
  return sec ? (sec.querySelector('.screen') || sec) : null;
}
// The nav is z-80, he is z-74, and he speaks ABOVE his head — so his ceiling is
// the nav's bottom edge plus the bubble's own height, both measured, not guessed.
function guideCeiling(el){
  const nav = document.querySelector('nav');
  const navB = nav ? nav.getBoundingClientRect().bottom : 58;
  // A CONSTANT reserve for his bubble, not a live measurement. Measuring it made
  // his ceiling move every time a line timed out, so his mark shifted 35px in
  // the middle of an act and he looked like he was drifting as you scrolled.
  return Math.round(navB + (innerWidth <= 900 ? 82 : 60));
}
// From the SVG viewBox, not from a measurement. offsetHeight reads 0 on the
// very first frame, which made his predicted height too small and let him sit
// half a body below the floor — the "first refresh cut him" bug exactly.
const BRAIN_ASPECT = 190 / 140;

// He owns ONE lane for the whole page: the left margin, outside the text
// column. Measured once, so the hero, every act and every doc section leave him
// the same strip — and he can never land on any of them.
let LANE = 0;
let GW_NATURAL = 0;
function measureLane(){
  const wr = document.querySelector('main .wrap');
  LANE = wr ? wr.getBoundingClientRect().left : innerWidth * .16;
  // His intended width is whatever the stylesheet says at this viewport. Read it
  // by clearing our own override first — hardcoding 84-124 was simply wrong,
  // the sheet asks for clamp(104px,10vw,158px).
  const el = $('guide'); if (!el) return;
  const keep = el.style.width; el.style.width = '';
  GW_NATURAL = el.offsetWidth || 110;
  el.style.width = keep;
}

// Where he stands in that lane, per act. He HOLDS this for the whole act.
// Recomputing it every frame made him chase the scroll, which is what read as
// moving too fast — a storyteller takes a mark and stays on it.
// 0 is the hero: he stands UP beside the headline, not down on the body copy.
const MARK_Y = { 0:.17, 1:.54, 2:.64, 3:.48, 4:.58, 5:.50, doc:.56 };

function guideFloor(){
  // The letterbox bar is a real object at the bottom of the frame, and the
  // subtitle sits above it. His floor was innerHeight — which is UNDER the bar.
  const bar = document.body.classList.contains('boxed') ? innerHeight * .072 : 0;
  const sub = document.querySelector('.scene .beat.on');
  const st = sub ? sub.getBoundingClientRect().top - 10 : Infinity;
  return Math.min(innerHeight - bar - 14, st);
}

let markKey = '', markDbg = {}, markHidden = false;
function stageGuide(key){
  const el = $('guide');
  const CEIL = guideCeiling(el), FLR = guideFloor();
  const band = FLR - CEIL;
  const k = `${key}|${innerWidth}x${innerHeight}|${Math.round(band / 8)}`;
  markDbg = { key, CEIL, FLR, band: Math.round(band), k };
  if (k !== markKey) {                       // he moves when the ACT moves, not when you scroll
    markKey = k;
    const W0 = GW_NATURAL || 110;              // whatever the stylesheet asks for here
    // His lane ends where the ARTIFACT begins, not where the text column does.
    // Measuring to the text column threw away the whole actor column that the
    // stage grid reserves for him, and capped him at ~180px on a 1600 frame.
    // On the hero there is no artifact to measure against, so the boundary is
    // the text column. Borrowing b1's artifact edge put his lane 160px too wide
    // and stood him on the lede and the three cards.
    const refId = typeof key === 'number' && SUBJ[key] !== 'top' ? SUBJ[key] : null;
    const ref = refId ? NATSZ.get(refId) : null;
    const laneRight = ref ? (ref.cx - ref.w / 2 - 22) : (LANE - 22);
    const laneW = Math.max(0, laneRight - 12);
    let nw, x, yFixed = null;
    // ---- THE HERO IS A SPECIAL CASE ----
    // He belongs beside the HEADLINE, not in whatever margin happens to be left.
    // The h1 is a full-width block, so its rect is useless; the per-line spans
    // give the real right edge of the type.
    const h1 = key === 0 ? $('heroBig') : null;
    if (h1) {
      const hr = h1.getBoundingClientRect();
      // .lni is display:block, so its rect is the COLUMN's width, not the type's.
      // A Range over the text is the only thing that gives the real inked edge —
      // measuring the block found no room at any width and dumped him in the gutter.
      // The right edge of ALL the hero type, not just the headline's. On a short
      // frame the lede is the wider block, and standing him only clear of the
      // headline dropped his rope straight into it.
      let textR = hr.left;
      const inked = (el) => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n; while ((n = w.nextNode())) {
          if (!n.nodeValue.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const r of rg.getClientRects()) if (r.width > 1) textR = Math.max(textR, r.right);
        }
      };
      inked(h1);
      const lede = document.querySelector('#top .lede'); if (lede) inked(lede);
      const room = hr.right - textR - 44;
      if (room >= 150) {                     // the void the headline's rag leaves
        nw = Math.min(W0, room);
        x = textR + 40 + Math.max(0, (room - nw) / 2);
        yFixed = hr.top;                     // resolved against the type below
      }
    }
    markHidden = false;
    if (nw == null) {
      if (laneW >= 96) {                     // his lane: beside the story, never on it
        nw = Math.min(W0, laneW);
        x = 12 + Math.max(0, (laneW - nw) / 2);
      } else if (key === 0) {
        // The hero is dense and full-width on a smaller screen: no crook beside
        // the headline and no margin either. Rather than stand him on the copy,
        // he simply is not there yet — the film starts, THEN he walks on.
        markHidden = true; nw = W0; x = 14;
      } else {                               // no lane (narrow): the dark floor, bottom left
        nw = W0; x = 14;
      }
    }
    // Set the width, then MEASURE the height. Deriving it from the SVG viewBox
    // said 168px when his box is really 385 — the extra is his own layout, not
    // the drawing — and a floor computed from a height less than half the real
    // one is exactly how he ended up under the letterbox bar.
    el.style.width = Math.round(nw) + 'px';
    let nh = el.offsetHeight || nw * BRAIN_ASPECT;
    if (nh > band - 10) {                       // too tall for the band: scale him to it
      const shrink = Math.max(.5, (band - 10) / nh);
      nw = Math.max(56, nw * shrink);
      el.style.width = Math.round(nw) + 'px';
      nh = el.offsetHeight || nw * BRAIN_ASPECT;
    }
    let y;
    if (yFixed != null) {
      const hr = h1.getBoundingClientRect();
      y = hr.top + (hr.height - nh) / 2;     // his eyeline on the headline's
    } else {
      const yf = laneW >= 96 ? (MARK_Y[key] ?? MARK_Y.doc) : .98;
      y = CEIL + Math.max(0, band - nh) * yf;
    }
    el.style.left   = Math.round(x) + 'px';
    el.style.top    = Math.round(Math.max(CEIL, Math.min(y, FLR - nh))) + 'px';
    el.style.bottom = 'auto';
    guideFace = 1;                           // the story is always to his right
    // His bubble opens to his right; near the frame edge it ran off screen.
    if (el.style.setProperty) {
      // Two bubble modes, two different bounds: on a wide frame it opens to his
      // RIGHT, on a narrow one it opens ABOVE from his left edge.
      el.style.setProperty('--bubmax',  Math.max(150, innerWidth - (x + nw) - 26) + 'px');
      el.style.setProperty('--bubmaxm', Math.max(150, innerWidth - x - 18) + 'px');
    }
    // He CUTS to his new mark rather than gliding to it, so the rope re-forms
    // there in the same frame. Gliding dragged the rope 870px across the copy,
    // and the cut lands on the act's gate flash — which is how film does it.
    if (guideRope && guideRope.reset) guideRope.reset();
  }
  // Where his hand is, in viewport space. camera() runs BEFORE driveGuide in the
  // frame, so it reads this one frame stale — 16ms on a hand that eases over
  // 550ms is invisible, and it costs zero extra layout reads.
  const hd = el.querySelector('.b-hand');
  const hr = (hd || el).getBoundingClientRect();
  guideHand.x = hr.left + hr.width / 2;
  guideHand.y = hr.top + hr.height / 2;
  el.style.transform = `scaleX(${guideFacing ? 1 : guideFace})`;
  const moving = velS > .012;
  if (moving) {
    guideSettled = false;
    clearTimeout(guideStill);
    guideStill = setTimeout(() => { guideSettled = true; restGuide(); }, 220);
  }
  return { moving, settled: guideSettled };
}

// He stops when you stop, and only THEN does he act out the beat. Without this
// he is walking forever and every pose is invisible.
let flourishT = 0;
function flourish(){
  const el = $('guide');
  el.classList.remove('shift'); void el.offsetWidth; el.classList.add('shift');
  clearTimeout(flourishT);
  flourishT = setTimeout(() => el.classList.remove('shift'), 620);
}
function setGuidePose(p){
  if (p === guideShown) return;
  guideShown = p; GUIDE.pose(p); flourish();
}
function restGuide(){ if (guidePose) setGuidePose(guidePose); }
function driveGuide(beat, on, pp){
  const el = $('guide');
  const dsec = on ? '' : docSection();
  const { moving, settled } = stageGuide(on ? beat : (dsec || 'doc'));
  if (FLOOR) FLOOR.classList.toggle('on', el.classList.contains('on'));

  if (!on) {                                    // past the film, in the document
    const sec = dsec;
    el.classList.toggle('on', !!sec);
    ropeFor(0);                                 // by now he carries nothing
    if (sec && sec !== guideKey) {
      guideKey = sec; guideBeat = -1;
      const row = GUIDE_DOC.find(r => r[0] === sec);
      guideFacing = (sec === 'start');          // the last one: he turns to you
      guidePose = row[1]; setGuidePose(row[1]); speak(row[2]);
    } else if (sec) {
      const row = GUIDE_DOC.find(r => r[0] === sec);
      if (row) guidePose = row[1];
      setGuidePose(guidePose);
    }
    return;
  }

  guideKey = ''; guideFacing = false;
  el.classList.toggle('on', on && !markHidden);
  // He is already carrying everything on the hero, but at full length the rope
  // falls out of the headline's void and across the third card. It reaches its
  // longest at act 1 — which is where the problem actually starts anyway.
  // On a small frame the headline void is short, so a long rope drops straight
  // out of it and across the lede. He carries the same amount, drawn shorter.
  const LEN = { 0: (innerWidth >= 1200 && innerHeight >= 760) ? .85 : .5, 1: 1, 2: .82, 3: .45, 4: .22, 5: 0 };
  ropeFor(LEN[beat] ?? 1);

  const act = ACT[beat] || ACT[0];
  const sec = $(SUBJ[beat]);
  const ap = sec && beat > 0 ? prog(sec) : 0;

  if (beat !== guideBeat) {                     // a new act: he opens it
    guideBeat = beat; guideTurned = false;
    guidePose = act.pose; setGuidePose(act.pose); speak(act.open);
    return;
  }
  // and partway through, the act turns on him
  if (act.turn && !guideTurned && ap >= act.at) {
    guideTurned = true;
    guidePose = act.pose2; setGuidePose(act.pose2); speak(act.turn);
    return;
  }
  if (act.turn && guideTurned && ap < act.at - .06) guideTurned = false;  // scrub back, re-arm
  setGuidePose(guidePose);                      // he holds the act he is in
}

let tension = 0, tenTok = 0;
function setTension(v){
  tension = v; tenTok++; G.set('tension', v); CIN.tension(v);
  document.documentElement.style.setProperty('--tension', v.toFixed(2));
  document.body.dataset.tense = v >= .95 ? '3' : v >= .7 ? '2' : v >= .4 ? '1' : '0';
}
function releaseTension(v, ms){
  const tok = tenTok;                     // only release what we actually set
  setTimeout(() => { if (tok === tenTok - 1 || tok === tenTok) setTension(v); }, ms);
}
function jolt(){
  const el = $('b3').querySelector('.screen'); if (!el || REDUCED) return;
  el.classList.remove('jolt'); void el.offsetWidth; el.classList.add('jolt');
  setTimeout(() => el.classList.remove('jolt'), 460);
}

function net(){ const on = navigator.onLine;
  $('net').classList.toggle('off', !on); $('netlbl').textContent = on ? 'online' : 'offline'; }
addEventListener('online', net); addEventListener('offline', net); net();

/* ================= BEAT 1 — the night ================= */
const INIT = { 'priya.raman':['P','p'], 'marco.velten':['M','m'], 'PagerDuty':['!','b'] };
(function buildThread(){
  const t = $('thread');
  NIGHT.messages.forEach(m => {
    const [ini,cls] = INIT[m.who] || ['?',''];
    const d = document.createElement('div');
    d.className = 'msg' + (m.key?' key':'') + (m.cmd?' cmd':'');
    d.innerHTML = `<div class="av ${cls}">${ini}</div><div class="mb">
      <div class="who">${esc(m.who)}${m.bot?' <span>BOT</span>':''}</div><div class="t">${esc(m.text)}</div></div>`;
    t.appendChild(d);
  });
  const c = NIGHT.captured, d = document.createElement('div');
  d.className = 'claim'; d.id = 'nclaim';
  d.innerHTML = `<div class="tag">claim captured · ${c.spans} spans cited</div><div class="h">${esc(c.headline)}</div>
    <div class="d">${esc(c.detail)}</div><div class="m"><span>source <b>${esc(c.source)}</b></span><span>by <b>${esc(c.author)}</b></span></div>`;
  t.appendChild(d);
})();
const KEY_IDX = NIGHT.messages.findIndex(m => m.key);
function renderNight(p){
  const msgs = [...$('thread').querySelectorAll('.msg')];
  const shown = Math.floor(clamp((p - .06) / .64, 0, 1) * msgs.length + 1e-6);
  msgs.forEach((m,i) => m.classList.toggle('in', i < shown));
  const captured = p > .80;
  $('nclaim').classList.toggle('in', captured);
  $('tdot').classList.toggle('live', p > .03 && !captured);
  $('tsay').textContent = captured
    ? 'DocBrain read the thread and kept the one sentence that mattered — cited to the message it came from.'
    : shown > KEY_IDX + 1 ? 'Somebody replies “nobody wrote it down.” They are about to be wrong.'
    : shown > KEY_IDX ? 'That one sentence is the whole thing. It exists in exactly one place.'
    : 'A channel is about to hold the only copy of something important.';
  $('tlbl').textContent = captured ? 'the capture' : 'what just happened';
}

/* ================= BEAT 2 — the decay ================= */
function renderAge(p){
  const cards = [...$('age').querySelectorAll('.agec[data-gone]')];
  cards.forEach((c,i) => c.classList.toggle('gone', p > .16 + i * .16));
  const done = p > .68;
  $('kept').classList.toggle('in', done);
  $('asay').textContent = done
    ? 'Everything a company normally loses, lost. The sentence DocBrain captured is still here — and still being checked.'
    : p > .16 ? 'Nobody is at fault. This is simply what happens.' : 'Keep scrolling.';
}

/* ================= BEAT 3 — the catch, plays itself ================= */
const FILE = [
  { t:'# checkout-api — production values', c:'cm' }, { t:'' },
  { t:'image:', c:'ky' }, { t:'  repository: acme/checkout-api' }, { t:'  tag: 4.2.0' }, { t:'' },
  { t:'  replicas: 6' }, { t:'' },
  { t:'database:', c:'ky' },
  { t:'  # Traffic goes through the pooler, not straight to the primary.', c:'cm' },
  { t:'  # See the deploy review note before changing this.', c:'cm' },
  { t:'  connectVia: ', edit:{ key:'connectVia', val:'pgbouncer', sel:['pgbouncer','direct','proxysql'] } },
  { t:'  poolSize: ',   edit:{ key:'poolSize',  val:'40' } }, { t:'' },
  { t:'redis:', c:'ky' }, { t:'  chart: bitnami/redis' },
  { t:'  version: ', edit:{ key:'redisVersion', val:'7.2.4' } },
];
const ORIG = {}; FILE.forEach(l => { if (l.edit) ORIG[l.edit.key] = l.edit.val; });
let cur = { ...ORIG }, manual = false, agentActive = false, manualRun = false, manualU = 0;
const fit = (el,v) => { el.style.width = (Math.max(3, String(v).length) + (el.tagName==='SELECT'?3.4:1.6)) + 'ch'; };
function drawCode(){
  $('code').innerHTML = '';
  FILE.forEach((l,i) => {
    const row = document.createElement('div');
    row.className = 'ln' + (l.edit ? (cur[l.edit.key] !== ORIG[l.edit.key] ? ' changed' : ' hot') : '');
    const n = document.createElement('span'); n.className='n'; n.textContent = i+1; row.appendChild(n);
    const body = document.createElement('span');
    if (l.edit){
      body.appendChild(document.createTextNode(l.t));
      let el;
      if (l.edit.sel){ el = document.createElement('select');
        l.edit.sel.forEach(o => { const op=document.createElement('option'); op.value=op.textContent=o; el.appendChild(op); });
        el.value = cur[l.edit.key];
      } else { el = document.createElement('input'); el.value = cur[l.edit.key]; }
      el.className = 'edit'; el.dataset.k = l.edit.key; fit(el, cur[l.edit.key]);
      el.setAttribute('aria-label', `${l.edit.key} — editable value in values.yaml`);
      el.disabled = !manual;
      const upd = () => { cur[l.edit.key] = el.value.trim(); fit(el, el.value); onEdit(); };
      el.addEventListener('input', upd);
      el.addEventListener('change', () => { upd(); drawCode(); });
      body.appendChild(el);
    } else { const s=document.createElement('span'); if(l.c) s.className=l.c; s.textContent=l.t; body.appendChild(s); }
    row.appendChild(body); $('code').appendChild(row);
  });
}
const changedKey = () => Object.keys(ORIG).find(k => cur[k] !== ORIG[k] && cur[k] !== '');
function onEdit(){
  const k = changedKey();
  $('commit').disabled = !k || !manual;
  $('cstat').textContent = k ? `${k}: ${ORIG[k]} → ${cur[k]}` : (manual ? 'edit poolSize, connectVia or version' : 'watching');
}
const pickRun = (k) => RUNS.runs.find(r => r.match.key===k) || RUNS.fallback;
const fill = (s,v) => String(s).replace(/\{\{new\}\}/g, esc(v));

/* The agent run is SCRUBBED, not played. It was an async sleep() chain on a
   wall clock: you either waited for it or destroyed it by moving. Now the
   scroll position IS the playhead — scrub back and the agent un-thinks. */
function timeline(run){
  const total = (run.steps[run.steps.length-1].at || 1) + 1400;
  return run.steps.map((st,i) => ({ ...st, i,
    t0: st.at / total,
    t1: (run.steps[i+1] ? run.steps[i+1].at : total) / total }));
}
const NODE = new Map();          // step index -> element
let runKey = null, runTL = null, runVal = '', lastSig = '', verdictFired = false;

function stepHTML(st, val){
  switch (st.kind){
    case 'think': case 'about': case 'stop':
      return `<div class="ln2"><span class="gl">${st.kind==='stop'?'■':'▸'}</span><div class="tx${st.kind!=='think'?' warn':''}"></div></div>`;
    case 'diff':
      return `<div class="diffb">${fill(st.text,val).split('\n').map(l =>
        l.startsWith('+')?`<span class="add">${esc(l)}</span>`:l.startsWith('-')?`<span class="del">${esc(l)}</span>`:esc(l)).join('\n')}</div>`;
    case 'tool':   return `<div class="toolb">⏺ ${esc(st.tool)} <span class="a">${esc(st.args)}</span></div>`;
    case 'result': return `<div class="resb">⎿ ${esc(st.read)} read · <b>${st.found} captured claim${st.found===1?'':'s'} found</b> · ${st.ms}ms</div>`;
    case 'claim':  return `<div class="cslot" id="aslot"></div>`;
    case 'verdict':return `<div class="verd${st.nofind?' none':''}"><div class="tag">${st.nofind?'no captured knowledge':'change refused'}</div>
        <div class="t">${fill(st.text,val)}</div><div class="f">${esc(st.fix)}</div><div class="c">${esc(st.cite)}</div></div>`;
    default: return '';
  }
}
function setRun(k, val){
  if (k === runKey && val === runVal) return;
  runKey = k; runVal = val; runTL = timeline(pickRun(k));
  NODE.clear(); $('agent').innerHTML = ''; lastSig = ''; verdictFired = false;
}
function renderRun(u){
  if (!runTL) return;
  const visible = runTL.filter(st => u >= st.t0);
  const cursor  = runTL.find(st => u >= st.t0 && u < st.t1);
  // typing is a slice of the text, not a timer
  let typed = -1;
  if (cursor && ['think','about','stop'].includes(cursor.kind)){
    const local = clamp((u - cursor.t0) / Math.max(1e-4, (cursor.t1 - cursor.t0)) * 1.9, 0, 1);
    typed = Math.floor(fill(cursor.text, runVal).length * local);
  }
  const sig = visible.length + '|' + (cursor ? cursor.i : -1) + '|' + typed;
  if (sig === lastSig) return;
  lastSig = sig;

  for (const st of runTL){
    const on = u >= st.t0;
    if (on && !NODE.has(st.i)){
      const d = document.createElement('div'); d.innerHTML = stepHTML(st, runVal);
      const el = d.firstElementChild; if (!el) continue;
      NODE.set(st.i, el); $('agent').appendChild(el);
    } else if (!on && NODE.has(st.i)){
      NODE.get(st.i).remove(); NODE.delete(st.i);
    }
  }
  // keep DOM order matching timeline order after a scrub-back
  [...NODE.keys()].sort((a,b)=>a-b).forEach(i => $('agent').appendChild(NODE.get(i)));

  for (const st of visible){
    if (!['think','about','stop'].includes(st.kind)) continue;
    const el = NODE.get(st.i); if (!el) continue;
    const box = el.querySelector('div'); if (!box) continue;
    const full = fill(st.text, runVal);
    if (cursor && st.i === cursor.i && typed < full.length)
      box.innerHTML = esc(full.slice(0, typed)) + '<span class="cursor"></span>';
    else box.textContent = full;
  }

  const st = cursor || visible[visible.length-1];
  setTension(!st ? .05 : st.kind==='stop' ? 1 : st.kind==='tool' ? .85
    : st.kind==='about' ? .58 : st.kind==='claim' ? .55 : st.kind==='verdict' ? .18 : .1);
  $('adot').classList.toggle('live', !!cursor);
  $('astat').textContent = !visible.length ? 'idle'
    : cursor ? (cursor.kind==='tool' ? 'calling docbrain' : 'running')
    : (runTL[runTL.length-1].nofind ? 'nothing found' : 'refused');

  const vd = runTL[runTL.length-1];
  if (u >= vd.t0 && !verdictFired){ verdictFired = true;
    if (!vd.nofind){ jolt(); CIN.flash(1); camPunch(1.6); } pulse(); }
  if (u < vd.t0) verdictFired = false;

  const claimSeen = visible.some(x => x.kind==='claim');
  $('blbl').textContent = u >= vd.t0 ? (vd.nofind ? 'it said so' : 'the catch') : 'what just happened';
  $('bsay').textContent = u >= vd.t0
    ? (vd.nofind ? 'No captured decision covers that line, and it said so instead of inventing one.'
                 : 'Priya just stopped a mistake she had already made, for someone she will never meet. That is DocBrain.')
    : claimSeen ? 'The agent had no idea. It asked DocBrain first — and got back what Priya wrote eight months ago.'
    : visible.length ? 'The agent is reading the change. It has no knowledge of this repo.'
    : 'A new engineer opens the file that broke checkout, knowing none of this.';
}
function pulse(){
  if (REDUCED) return;
  let v = 0; const id = setInterval(() => {
    v += .028; G.set('pulse', v); if (v >= 2){ clearInterval(id); G.set('pulse', -1); }
  }, 16);
}
$('commit').addEventListener('click', () => { manualU = 0; manualRun = true; });
$('undo').addEventListener('click', () => {
  manual = true; cur = {...ORIG}; manualRun = false; manualU = 0; setRun(null,''); drawCode(); onEdit();
  $('agent').innerHTML = '<div class="idle">Edit poolSize, connectVia or version<br>on the left, then press Commit.</div>';
  $('astat').textContent='idle'; $('adot').classList.remove('live');
  $('blbl').textContent='your turn';
  $('bsay').textContent='Edit any boxed value and commit. The agent reviews whatever you do — including the line it has nothing captured on.';
  $('undo').textContent = 'Reset';
  $('cstat').textContent = 'edit poolSize, connectVia or version, then Commit';
});

/* ================= BEAT 5 — the premise ================= */
let premState = false;
function renderPremise(p){
  const broken = p > .40;
  if (broken === premState) return;          // a scroll frame is not a state change
  premState = broken;
  const s = broken ? PREM.broken : PREM.holds;
  $('pwatch').textContent = PREM.watching;
  $('psrc').textContent = s.line; $('psrc').classList.toggle('gone', broken);
  const box = $('pans'); box.classList.toggle('stale', broken);
  box.innerHTML = `<div class="n">${esc(s.note)}</div>`
    + (broken ? `<div class="chg">${esc(s.changed)}</div>` : '');
  $('pdown').innerHTML = broken ? PREM.broken.downstream.map(d => `<li>${esc(d.what)}<b>${esc(d.state)}</b></li>`).join('') : '';
  setTension(broken ? .6 : .05);
  $('psay').textContent = broken
    ? 'Nobody filed a ticket. DocBrain saw the file change and marked every answer that relied on it, with the date.'
    : 'DocBrain is watching the file this answer came from — continuously, not when someone remembers to.';
}

/* ================= BEAT 6 — the proof, plays itself ================= */
const ATTACKS = { rewrite:'assets/story-rewrite.dbev', splice:'assets/story-splice.dbev', manifest:'assets/story-manifest.dbev' };
const ORIGINAL='assets/story-valid.dbev';
let bundle=null, verifierReady=false, verifiedOnce=false;
const VSTEPS=['container opened','signing keys loaded','key chain validated','signatures checked','hash chain walked','manifest verified'];
const STAGE={2:3,3:2,4:4,5:2,6:2,7:2,9:2,10:5,11:5,12:5,14:5,15:5,16:1,17:0,21:0,22:0};
function renderEntries(bytes){
  if (!verifierReady) return;
  const recs = records(bytes);
  $('entries').innerHTML = Array.isArray(recs)
    ? `<span class="mono xs" style="color:var(--dim)">${recs.length} sealed records · </span>` + recs.map(r=>esc(r.body.headline)).join(' <span style="color:var(--dim)">·</span> ')
    : `<span style="color:var(--bad)"><strong>This bundle no longer reads.</strong> The container is damaged: <span class="mono">${esc(recs.error)}</span></span>`;
}
function runVerify(){
  if (!verifierReady) return;
  const offline = !navigator.onLine, rep = verify(bundle);
  $('vout').classList.add('on'); $('vdot').classList.add('live');
  const bad = rep.verdict!=='VALID';
  const stop = bad ? (STAGE[rep.dominant.row] ?? VSTEPS.length-1) : VSTEPS.length-1;
  $('vsteps').innerHTML = VSTEPS.slice(0,stop+1).map((s,i)=>{
    const f = bad && i===stop;
    return `<div class="step" style="animation-delay:${i*55}ms">${f?'<span class="xk">✗</span>':'<span class="ck">✓</span>'} <span class="lbl2">${s}</span></div>`;}).join('');
  const cls = rep.verdict==='VALID'?'ok':rep.verdict==='TAMPERED'?'bad':'warn';
  const plain = { VALID:'Nothing in this bundle has been altered since it was sealed.',
    TAMPERED:'Someone changed this after it was sealed. Here is exactly what:',
    CANNOT_VERIFY:'This cannot be checked either way. That is not the same as fine:' }[rep.verdict];
  $('vbar').innerHTML = `<div class="stamp ${cls}" style="animation-delay:${VSTEPS.length*55+90}ms">${rep.verdict}</div>
    <div class="vsum"><strong>${plain}</strong><br><span class="code2">${rep.dominant.code}</span> · spec row ${rep.dominant.row}
    ${rep.dominant.position!=null?`· position ${rep.dominant.position}`:''}<br>${esc(rep.dominant.detail)}
    ${offline?'<div class="offlineflag">↑ produced with your network disconnected</div>':''}</div>`;
  $('facts').innerHTML = [['verified in',rep.elapsed_ms.toFixed(2)+' ms'],['records',rep.counts.records],
    ['range',rep.scope.range.join('–')],['findings',rep.findings.length],['exit code',rep.exit_code]]
    .map(([k,v])=>`<div class="fact"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  $('negspace').textContent = 'What this is not — ' + rep.negative_space;
  $('vsay').textContent = rep.verdict==='VALID'
    ? 'Checked in your browser, offline, with no reason to trust us. Nothing has been altered since it was sealed.'
    : 'Forged — and named. It says exactly which part was changed, and who could not have changed it.';
  setTension(.7); releaseTension(.08, 1100);
  if (rep.verdict==='VALID'){ G.set('sealed',1); sealedFlag = true; }
}
async function setBundle(url){
  bundle = new Uint8Array(await (await fetch(url)).arrayBuffer());
  renderEntries(bundle);
}
document.querySelectorAll('[data-atk]').forEach(b => b.addEventListener('click', async () => {
  if (!verifierReady) return;
  document.querySelectorAll('.atkc').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); await setBundle(ATTACKS[b.dataset.atk]); runVerify(); }));

/* ================= WRITE THE LIE =================
   Priya's sentence is STORE'd inside the bundle, so the plaintext is literally
   in the file. Overwrite it with the visitor's words at the same byte length —
   every ZIP offset stays valid, the container still parses, and the real
   verifier catches the content hash. They forge it; the maths names them. */
const LIE_LINE = "root cause: upgrade wiped our custom pool config. careful \u2014 the helm value is "
               + "IGNORED unless pgbouncer.customIni is set. that's the trap";
const ENC = new TextEncoder(), DEC = new TextDecoder();
let lieAt = -1, lieLen = 0;

function findBytes(hay, needle){
  outer: for (let i = 0; i <= hay.length - needle.length; i++){
    for (let j = 0; j < needle.length; j++) if (hay[i+j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
function lieInit(){
  const nb = ENC.encode(LIE_LINE);
  lieAt = findBytes(bundle, nb); lieLen = nb.length;
  if (lieAt < 0) { $('lieGo').disabled = true; $('lieStat').textContent = 'sentence not found in bundle'; return; }
  $('lieText').value = LIE_LINE;
  $('lieBytes').textContent = lieLen + ' bytes, sealed';
  $('lieText').addEventListener('input', () => {
    const n = ENC.encode($('lieText').value).length;
    const changed = $('lieText').value !== LIE_LINE;
    $('lieStat').textContent = changed ? `${n} / ${lieLen} bytes — you changed it` : 'unchanged';
    $('lieStat').classList.toggle('changed', changed);
  });
}
function lieVerify(){
  if (lieAt < 0 || !verifierReady) return;
  const forged = bundle.slice();
  const t = ENC.encode($('lieText').value);
  for (let j = 0; j < lieLen; j++) forged[lieAt + j] = j < t.length ? t[j] : 32;  // pad with spaces
  const rep = verify(forged);
  const bad = rep.verdict !== 'VALID';
  const stop = bad ? (STAGE[rep.dominant.row] ?? VSTEPS.length-1) : VSTEPS.length-1;
  $('lieOut').classList.add('on');
  $('lieSteps').innerHTML = VSTEPS.slice(0, stop+1).map((v,i)=>{
    const fail = bad && i === stop;
    return `<div class="step" style="animation-delay:${i*45}ms">${fail?'<span class="xk">✗</span>':'<span class="ck">✓</span>'} <span class="lbl2">${v}</span></div>`;
  }).join('');
  const cls = rep.verdict==='VALID'?'ok':rep.verdict==='TAMPERED'?'bad':'warn';
  const same = $('lieText').value === LIE_LINE;
  const line = same
    ? 'You left it as she wrote it, so it still checks out. Change one character and try again.'
    : 'You rewrote what she said. The bundle still opens, the signatures still parse — and the content hash does not match what was signed at 02:47.';
  $('lieBar').innerHTML = `<div class="stamp ${cls}" style="animation-delay:${VSTEPS.length*45+80}ms">${rep.verdict}</div>
    <div class="vsum"><strong>${line}</strong><br><span class="code2">${rep.dominant.code}</span> · spec row ${rep.dominant.row}<br>${esc(rep.dominant.detail)}
    ${!navigator.onLine?'<div class="offlineflag">↑ and your network is off</div>':''}</div>`;
  $('negspace').textContent = 'What this is not — ' + rep.negative_space;
  if (bad) { CIN.flash(.8); camPunch(1.2); }
}
$('lieGo').addEventListener('click', lieVerify);
$('lieReset').addEventListener('click', () => {
  $('lieText').value = LIE_LINE;
  $('lieStat').textContent = 'unchanged'; $('lieStat').classList.remove('changed');
  $('lieOut').classList.remove('on');
});

/* ================= ROI ================= */
const WORKDAYS=230, WORKHOURS=1840;
const money = (n) => '$' + Math.round(n).toLocaleString();
function roi(){
  const E=+$('rE').value, C=+$('rC').value, M=+$('rM').value, P=+$('rP').value/100;
  $('lE').textContent=E.toLocaleString(); $('lC').textContent=money(C);
  $('lM').textContent=M; $('lP').textContent=(P*100).toFixed(0)+'%';
  const hours=M/60*WORKDAYS, pct=hours/WORKHOURS, per=C*pct*P;
  $('oHours').textContent=hours.toFixed(0)+' h'; $('oPct').textContent=(pct*100).toFixed(1)+'%';
  $('oPer').textContent=money(per); $('oWeeks').textContent=Math.round(hours*P*E/40).toLocaleString();
  $('oTotal').textContent=money(per*E);
  $('oMath').textContent = `${M} min/day × ${WORKDAYS} working days ÷ 60 = ${hours.toFixed(0)} h lost per engineer. `
    + `${hours.toFixed(0)} ÷ ${WORKHOURS} h working year = ${(pct*100).toFixed(1)}%. `
    + `${money(C)} × ${(pct*100).toFixed(1)}% × ${(P*100).toFixed(0)}% = ${money(per)} per engineer × ${E.toLocaleString()} = ${money(per*E)}.`;
}
['rE','rC','rM','rP'].forEach(id => $(id).addEventListener('input', roi));

/* ================= the surviving claim ================= */
let sealedFlag = false;

/* ================= THE MATCH CUT =================
   One card is captured at 02:41 and never leaves. It flies between a landing
   slot in each scene, changing state as the story does. Same element, whole way. */
const TRAV = $('trav');
let tvX = 0, tvY = 0, tvW = 0, tvOn = false, tvState = '', tvSlot = null;
function travSlot(){
  const mid = innerHeight * .5;
  const past = (id) => topOf($(id)) <= mid;
  if (past('b6') && verifiedOnce) return [$('vslot'), sealedFlag ? 'sealed' : 'cited'];
  if (past('b5'))                 return [$('pslot'), premState ? 'stale' : 'cited'];
  if (past('b3') && $('aslot'))   return [$('aslot'), 'cited'];
  if (past('b2'))                 return [$('kept'),  'survived'];
  if (prog($('b1')) > .78)        return [$('nclaim'), 'captured'];
  return [null, ''];
}
const TRAV_LABEL = { captured:'captured · cited to the message', survived:'still here · still checked',
  cited:'read by the agent · before the change', stale:'premise falsified · flagged',
  sealed:'sealed · verifiable offline' };
function driveTrav(){
  const [slot, state] = travSlot();
  if (!slot) { if (tvOn){ tvOn = false; TRAV.classList.remove('on'); } return; }
  let r = slot.getBoundingClientRect();
  if (!r.width) return;
  // During a cut the previous beat's slot has scrolled out of frame, so tracking
  // it flings the card off-screen and back. Park it instead: it CARRIES through
  // the cut, which is the whole point of a match cut.
  // Off-frame means we are mid-cut. A match cut does not hover a card through
  // the black — the object VANISHES on the cut and is already in place on the
  // other side. Same object, new meaning, no glide.
  if (r.top < -r.height * .4 || r.top > innerHeight - r.height * .35) {
    if (tvOn) { tvOn = false; TRAV.classList.remove('on'); }
    return;
  }
  if (!tvOn) {                       // arrive exactly on the card it replaces
    tvX = r.left; tvY = r.top; tvW = r.width; tvOn = true;
    TRAV.classList.add('on');
    const nc = $('nclaim'); if (nc) nc.style.visibility = 'hidden';
  } else if (slot !== tvSlot) {     // a new scene: SNAP, do not glide
    tvX = r.left; tvY = r.top; tvW = r.width;
  } else {
    const k = REDUCED ? 1 : .22;     // settle within a scene only
    tvX += (r.left - tvX) * k; tvY += (r.top - tvY) * k; tvW += (r.width - tvW) * k;
  }
  tvSlot = slot;
  TRAV.style.transform = `translate3d(${tvX.toFixed(1)}px,${tvY.toFixed(1)}px,0)`;
  TRAV.style.width = tvW.toFixed(1) + 'px';
  if (state !== tvState) {
    tvState = state;
    TRAV.classList.remove('stale','sealed','cited');
    if (state === 'stale' || state === 'sealed' || state === 'cited') TRAV.classList.add(state);
    $('travT').textContent = TRAV_LABEL[state] || state;
  }
}

/* ================= scroll engine ================= */
const RENDER = { b1: renderNight, b2: renderAge, b5: renderPremise };
const scenes = [...document.querySelectorAll('.scene')];
const cuts = [...document.querySelectorAll('.cut[data-cut]')];   // NOT the hero: it must be lit on arrival
// split every title into masked lines so they ARRIVE instead of fading
for (const t of document.querySelectorAll('.big')) {
  t.innerHTML = t.innerHTML.split(/<br\s*\/?>/i)
    .map(l => `<span class="lnm"><span class="lni">${l}</span></span>`).join('');
}
const railLinks = [...document.querySelectorAll('.rail a')];
const railIds = railLinks.map(a => a.getAttribute('href').slice(1));
// Every rect is read ONCE per frame, before anything is written. Interleaving
// reads and writes forced a synchronous layout ~25 times a frame, which is what
// makes scroll-driven pages stutter on a phone.
const MEASURED = [...new Set([...scenes, ...cuts, ...railIds.map(id => $(id)), $('recap')].filter(Boolean))];
const RECT = new Map(), OFFH = new Map();
const NATSZ = new Map();
function measureHeights(){
  measureLane();
  for (const el of MEASURED) OFFH.set(el, el.offsetHeight);
  // panel layout size, cached: reading it per frame forces a reflow because the
  // beats rewrite their own DOM earlier in the same frame.
  for (const sc of scenes){
    const el = sc.querySelector('.screen');
    if (!el) continue;
    // offsetLeft walks the layout tree and is immune to the transform camera()
    // is writing on this very element — a getBoundingClientRect here would read
    // back our own scale and the artifact would drift a little further each frame.
    let ox = 0, n = el;
    while (n && n !== document.body) { ox += n.offsetLeft; n = n.offsetParent; }
    NATSZ.set(sc.id, { w: el.offsetWidth, h: el.offsetHeight, cx: ox + el.offsetWidth / 2 });
  }
}
measureLane();
function measureRects(){ for (const el of MEASURED) RECT.set(el, el.getBoundingClientRect()); }
const prog = (el) => {
  const r = RECT.get(el); if (!r) return 0;
  return clamp(-r.top / Math.max(1, (OFFH.get(el) || 1) - innerHeight), 0, 1);
};
const topOf = (el) => { const r = RECT.get(el); return r ? r.top : Infinity; };
function driveGraph(){
  const mid = innerHeight * .5;
  const past = (id) => topOf($(id)) <= mid;
  // sequential, so the furthest-scrolled act wins — one writer, no fighting
  // These were all so low the memory was barely on screen. The field is the
  // subject, not wallpaper — and the collapse in beat 2 has to be a real drop.
  let field=.34, claim=0, agent=0, crack=0;
  if (past('b1')){ field = .30 + prog($('b1')) * .36; claim = prog($('b1')) > .80 ? 1 : 0; }
  if (past('b2')){ field = .70 - prog($('b2')) * .66; claim = 1; }   // .70 -> .04: it dies
  if (past('b3')){ field = .22; claim = 1; agent = agentActive ? .95 : .45; }
  if (past('b5')){ field = .20; claim = 1; agent = .28; crack = prog($('b5')) > .40 ? 1 : 0; }
  if (past('b6')){ field = .28; claim = 1; agent = .22; crack = 0; }
  G.assign({ field, claim, agent, crack });
}
const pageProgress = () => {
  const h = document.documentElement.scrollHeight - innerHeight;
  return h > 0 ? clamp(scrollY / h, 0, 1) : 0;
};
// ================= THE CAMERA =================
// Every beat gets a move. A push-in through the night, a pull-back as the
// memory decays, a hard push under tension, a snap zoom on the refusal.
/* ================= THE CAMERA =================
   It has a SUBJECT. Each beat names a focal element; the camera frames that
   element at the optical centre and closes on it. Scale comes from real depth
   and is clamped by world.fit(), so a panel can never leave the frame — which
   is what was broken: 1.55x on a 70vh card is 1172px in a 1080px window. */
const W = makeWorld();
let punch = 0;
function camPunch(v){ punch = v; W.punch(v); }

// What each beat is ABOUT, as a deliberate framing offset (fraction of panel
// height, + = look lower). Measuring the focal element every frame would mean
// reading a rect of the very element we are transforming — a feedback loop and
// layout thrash. The framing is a directorial choice, so it is a constant.
const FRAME = { b1: .26, b2: .04, b3: .20, b5: -.08, b6: .02 };
// How each artifact ENTERS. He drags most of them in by hand; the editor rises
// under him as he sits down to it; the stale-answer alert is not carried at all
// — it comes across the room and hits him.
const BIRTH = { b1: 'hand', b2: 'hand', b3: 'rise', b5: 'strike', b6: 'hand' };
// How it LEAVES. Everything goes back in his hand except the proof, which he
// pushes past the camera at you — the one object in the film he gives away.
const OUT = { b6: 'toyou' };
const eout = t => 1 - Math.pow(1 - t, 3);

function camera(){
  punch *= .86; W.step();
  for (const sc of scenes){
    const el = sc.querySelector('.screen'); if (!el) continue;
    const p = prog(sc);

    // depth: you approach, arrive at VIEW, and close past it
    const d = Math.max(2.2, VIEW + (.5 - p) * 9);
    const raw = VIEW / d;
    const nat = NATSZ.get(sc.id); if (!nat) continue;
    const natW = nat.w, natH = nat.h;
    // On a phone the artifact already fills the frame, so the push-in has to stay
    // at or under 1x — a 1.18 zoom grows it 27px past its own max-height and back
    // over the strip he is standing in.
    const zcap = innerWidth <= 900 ? 1 : 1.18;
    const z = Math.min(zcap, W.fit(natW, natH, innerWidth, innerHeight, raw * (1 + punch * .07)));

    // frame the subject: as you close, drift so the beat's subject holds centre
    const closing = clamp((p - .28) / .5, 0, 1);
    let ty = -(FRAME[sc.id] ?? 0) * natH * z * closing;
    let tx = 0;
    const rx = clamp((p - .5) * 2, -1, 1) * -4;
    // A 1.1deg tilt on an 868px-wide box adds ~17px of height. On a phone that
    // is enough to push it back over him, so the tilt is desktop-only.
    let rz = (sc.id === 'b5' && premState && innerWidth > 900) ? 1.1 : 0;

    // ---- HE HANDLES IT ----
    // Nothing on this stage simply appears. Each artifact is carried in from his
    // hand, and put away into it again — except the last one, which he pushes
    // out of the frame towards you. The hand is a real measured point, so the
    // object genuinely leaves from where he is standing, not from a guess.
    const born = 1 - eout(clamp(p / .13, 0, 1));       // 1 entering -> 0 settled
    const away = eout(clamp((p - .86) / .14, 0, 1));   // 0 settled  -> 1 gone
    let az = 1, aop = 1;
    // The scale origin is the artifact's LEFT edge, so its visible centre moves
    // as it scales. The hand offset has to target that moving centre, or the
    // object would fly out of a point half a panel-width away from his hand.
    const sc0 = z * (1 - (born > .001 ? born * .88 : 0));
    const visCx = (nat.cx - natW / 2) + natW * sc0 / 2;
    const hx = guideHand.x - visCx, hy = guideHand.y - innerHeight / 2;
    if (born > .001) {
      const b = BIRTH[sc.id];
      if (b === 'rise')        { ty += born * innerHeight * .42; az *= 1 - born * .34; }
      else if (b === 'strike') { tx += born * innerWidth * .72; rz += born * 7; az *= 1 - born * .10; }
      else                     { tx += hx * born; ty += hy * born; az *= 1 - born * .88; rz += born * -15; }
      aop *= 1 - born * .55;
    }
    if (away > .001) {
      if (OUT[sc.id] === 'toyou') { az *= 1 + away * .55; aop *= 1 - away; }   // he gives it to you
      else { tx += hx * away; ty += hy * away; az *= 1 - away * .88; rz += away * 13; aop *= 1 - away * .7; }
    }

    // while it is flying from or back to his hand it is SUPPOSED to be on him
    sc.dataset.motion = (born > .01 || away > .01) ? '1' : '0';
    el.style.transform =
      `perspective(1500px) rotateX(${rx.toFixed(2)}deg) rotate(${rz.toFixed(2)}deg) ` +
      `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${(z * az).toFixed(4)})`;
    el.style.opacity = aop.toFixed(3);
    // one writer for filter: the entry blur, the speed dim and the stage shadow
    const bl = born * 6;
    el.style.filter = `brightness(${(1 - velS * .12).toFixed(3)}) ` +
      (bl > .04 ? `blur(${bl.toFixed(2)}px) ` : '') +
      `drop-shadow(0 30px 60px rgba(0,0,0,.55))`;
  }
}
let lastY = 0, velS = 0, lastBeat = -1;
function tick(){
  measureRects();                       // ---- read phase: every rect, once ----
  const raw = Math.min(1, Math.abs(scrollY - lastY) / 150); lastY = scrollY;
  velS = velS * .82 + raw * .18;        // eased, so movement decays with weight
  document.documentElement.style.setProperty('--vel', velS.toFixed(3));
  CIN.air(velS);
  for (const sc of scenes){ const fn = RENDER[sc.id]; if (fn) fn(prog(sc)); }
  camera(); driveGraph(); driveTrav();
  // the cuts: type rises, holds, falls away
  for (let ci = 0; ci < cuts.length; ci++){
    const c = cuts[ci], p = prog(c);
    // arrival is LATCHED: once it starts it plays out in real time, at its own
    // pace, however fast you are scrolling. Scroll only says when and when out.
    const playing = p > .07 && p < .80;
    if (playing !== c.classList.contains('playing')) {
      c.classList.toggle('playing', playing);
      if (playing) CIN.flash([.34, .30, .52, .34, .62][ci] ?? .4);   // every cut lands
    }
    // the exit stays tied to scroll, so leaving still feels connected to the hand
    const outA = 1 - clamp((p - .70) / .26, 0, 1);
    c.style.setProperty('--outA', outA.toFixed(3));
  }

  const pp = pageProgress();
  G.set('open', pp);          // the memory opens as you read; it never restarts

  // which beat are we in? drives the sound design as well as the camera
  const bm = innerHeight * .5;
  const beatNow = topOf($('b6')) <= bm ? 5 : topOf($('b5')) <= bm ? 4
                : topOf($('b3')) <= bm ? 3 : topOf($('b2')) <= bm ? 2
                : topOf($('b1')) <= bm ? 1 : 0;
  if (typeof window !== 'undefined') window.__dbg = { beatNow, guideBeat, guidePose, guideShown, ticks: (window.__dbg?.ticks||0)+1,
                   mark: markDbg, tops: scenes.map(sc => Math.round(topOf(sc))) };
  if (beatNow !== lastBeat) {
    lastBeat = beatNow; CIN.beat(beatNow);
    CIN.flash([0, .34, .30, .52, .40, .62][beatNow] ?? .35);  // the cuts are gone; HE is the cut
  }
  // One subtitle at a time — the act you are actually in — and NONE once the
  // film is over. beatNow stays pinned at 5 forever after the last act, so the
  // verifier's line was still sitting there all the way down the document.
  const filmOn = topOf($('recap')) > innerHeight * .62;
  const SUBBEAT = { b1: 1, b2: 2, b3: 3, b5: 4, b6: 5 };
  for (const sc of scenes) {
    const bt = sc.querySelector('.beat'); if (!bt) continue;
    bt.classList.toggle('on', filmOn && SUBBEAT[sc.id] === beatNow);
  }

  // The film runs from the first frame until the story ends. Then the frame
  // opens and you are in a document. That transition is the only one that matters.
  const inFilm = filmOn;
  CIN.box(inFilm ? 1 : 0);
  CIN.rolling(inFilm);
  CIN.grain(inFilm);
  if (inFilm) CIN.timecode(pp * 92);
  driveGuide(beatNow, inFilm, pp);

  // BEAT 3 IS SCRUBBED. Your scroll position is the playhead. Scroll back and
  // the agent un-thinks; stop halfway and it stops halfway. No wall clock.
  const p3 = prog($('b3'));
  if (fixturesOK) {
    let u;
    if (manual) {
      if (manualRun) { manualU = Math.min(1, manualU + .011); if (manualU >= 1) manualRun = false; }
      u = manualU;
    } else {
      if (p3 > .04 && cur.poolSize === ORIG.poolSize) { cur.poolSize = '200'; drawCode(); onEdit(); }
      u = clamp((p3 - .15) / .60, 0, 1);
    }
    const k = changedKey() || 'poolSize';
    setRun(k, cur[k]);
    renderRun(u);
    agentActive = u > .02 && u < .99;
  }
  // beat 6 verifies itself when you arrive
  const p6 = prog($('b6'));
  if (!verifiedOnce && verifierReady && p6 > .08){ verifiedOnce = true; runVerify(); }

  const mid = innerHeight * .5;
  let active = -1;
  railIds.forEach((id,i) => { const el = $(id); if (el && topOf(el) <= mid) active = i; });
  railLinks.forEach((a,i) => { a.classList.toggle('on', i===active); a.classList.toggle('done', i<active); });
}
let queued=false;
addEventListener('scroll', () => { if(!queued){ queued=true; requestAnimationFrame(()=>{ queued=false; tick(); }); } }, {passive:true});
// Test hook: the whole page is rAF-driven, and a headless browser under a
// virtual clock produces ~1 frame a second — so the geometry harness drives
// frames itself instead of waiting for ones that never come.
if (typeof window !== 'undefined') window.__tick = tick;
addEventListener('resize', () => { measureHeights(); tick(); }, {passive:true});

/* ================= boot ================= */
setTension(0);
// the film opens before anything else
CIN.opening([
  // DocBrain's own line. The comma carries card one into card two, so it lands
  // as one complete thought instead of a statement that stops halfway.
  { t: 'What one engineer works out,', hold: 1800 },
  { t: 'the whole company keeps.',     hold: 2200 },
  // the longest card: he needs room to actually finish a dance
  { t: 'DocBrain', hold: 3000, mark: true },
]).then(() => { CIN.flash(1); tick(); });
drawCode(); onEdit(); roi();
measureHeights();
$('agent').innerHTML = fixturesOK
  ? '<div class="idle">Waiting for a change to review.</div>'
  : '<div class="idle">This scene could not load.<br>The rest of the page is unaffected.</div>';
if (REDUCED){ Object.values(RENDER).forEach(fn => fn(1)); }
tick();

try {
  const meta = await load();
  $('wasmsize').textContent = (meta.bytes/1024).toFixed(0)+' KB wasm';
  await setBundle(ORIGINAL);
  verifierReady = true; lieInit(); tick();
} catch (e) {
  $('wasmsize').textContent='unavailable';
  $('entries').innerHTML='<span style="color:var(--bad)">The verifier did not load, so this beat is unavailable. The rest of the page is unaffected.</span>';
  console.error('verifier boot failed', e);
}
$('prov').innerHTML = `<b>Provenance:</b> the thread, the agent run and the premise are replayed from
  <span style="color:var(--rdim)">fixtures/</span> — ${esc(RUNS._provenance.status)}. The verification is not a
  fixture: it runs the real verifier on real bytes in your browser.`;
