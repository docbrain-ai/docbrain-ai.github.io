import { mountBrain } from './brain.js';
import { makeRope } from './mind.js';
// The projection booth: letterbox, film grain, gate flash, timecode and sound.
// None of this is decoration — it is the difference between a web page with
// animation on it and something that reads as a piece of film.

export function initCinema({ reduced = false } = {}) {
  const el = (t, c, p = document.body) => { const n = document.createElement(t); if (c) n.className = c; p.appendChild(n); return n; };

  // ---- letterbox: the single strongest "this is film" signal ----
  const barT = el('div', 'lb lb-t'), barB = el('div', 'lb lb-b');

  // ---- gate flash: a real cut has a frame of light, not a crossfade ----
  const flash = el('div', 'gate');

  // ---- film grain: 4 noise tiles, cycled. Generated once, never redrawn. ----
  const grain = el('div', 'grain');
  if (!reduced) {
    const S = 96, tiles = [];
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 60;          // dark noise, screened ON TOP
        d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
      }
      x.putImageData(img, 0, 0); tiles.push(c.toDataURL('image/png'));
    }
    grain.style.backgroundImage = `url(${tiles[0]})`;
    grain.style.animation = 'grainshift .9s steps(6) infinite';
  }

  // ---- timecode ----
  const tc = el('div', 'tc');
  tc.innerHTML = '<span class="rec"></span><span id="tcv">00:00:00:00</span>';
  const tcv = tc.querySelector('#tcv');

  // ---- sound: generated, not a file. Gated behind a real user gesture. ----
  const snd = el('button', 'sndbtn');
  snd.type = 'button';
  snd.innerHTML = '<span class="ico">♪</span><span class="lbl">sound</span>';
  snd.setAttribute('aria-label', 'Toggle sound');
  let AC = null, master = null, dry = null, sendT = null, lp = null,
      bed = [], airGain = null, subGain = null, on = false;

  function impulse(sec = 2.8, decay = 3.0) {
    const n = Math.floor(AC.sampleRate * sec);
    const buf = AC.createBuffer(2, n, AC.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      for (const [ms, g] of [[23, .4], [37, .28], [59, .2], [83, .14]]) {
        const k = Math.floor(AC.sampleRate * ms / 1000);
        if (k < n) d[k] += (c ? -g : g);
      }
    }
    return buf;
  }
  const noiseBuf = (sec, shape) => {
    const n = Math.floor(AC.sampleRate * sec), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * shape(i / n);
    return b;
  };

  function build() {
    AC = new (window.AudioContext || window.webkitAudioContext)();

    // a limiter, so five layers plus reverb cannot stack into clipping
    const lim = AC.createDynamicsCompressor();
    lim.threshold.value = -14; lim.knee.value = 6; lim.ratio.value = 12;
    lim.attack.value = .003; lim.release.value = .25;
    lim.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0; master.connect(lim);

    const conv = AC.createConvolver(); conv.buffer = impulse();
    const rev = AC.createGain(); rev.gain.value = .8;
    conv.connect(rev); rev.connect(master);
    dry = AC.createGain(); dry.gain.value = 1; dry.connect(master);
    // reverb belongs on transients, not on a sustained pad
    const sendBed = AC.createGain(); sendBed.gain.value = .12; sendBed.connect(conv); bedSend = sendBed;
    sendT = AC.createGain(); sendT.gain.value = .62; sendT.connect(conv);

    // gentle, non-resonant. A Q of 3 at 240Hz was ringing on the 6th harmonic.
    lp = AC.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 1150; lp.Q.value = .5;
    bedVol = AC.createGain(); bedVol.gain.value = .8;
    lp.connect(bedVol); bedVol.connect(dry); bedVol.connect(sendBed);
    const hp = AC.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.value = 70;             // strip what no speaker can play
    hp.connect(lp);

    // A2 / E3 / A3 / E4 — fundamentals a laptop can actually reproduce,
    // triangles and sines rather than sawtooths, each breathing at its own rate.
    for (const [f, type, g, pan, lfoHz] of [
      [110.00, 'triangle', .26, -.35, .047],
      [164.81, 'triangle', .17,  .32, .063],
      [220.00, 'sine',     .12, -.18, .081],
      [329.63, 'sine',     .07,  .22, .034],
    ]) {
      const o = AC.createOscillator(); o.type = type; o.frequency.value = f;
      const g1 = AC.createGain(); g1.gain.value = g;
      const swell = AC.createOscillator(); swell.frequency.value = lfoHz;
      const swellG = AC.createGain(); swellG.gain.value = g * .45;
      swell.connect(swellG); swellG.connect(g1.gain); swell.start();
      const pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
      if (pn) { pn.pan.value = pan; o.connect(g1); g1.connect(pn); pn.connect(hp); }
      else { o.connect(g1); g1.connect(hp); }
      o.start(); bed.push({ o, g: g1, base: g });
    }

    // felt, not heard — only present when the room tightens
    const sub = AC.createOscillator(); sub.type = 'sine'; sub.frequency.value = 55;
    subGain = AC.createGain(); subGain.gain.value = 0;
    sub.connect(subGain); subGain.connect(dry); sub.start();

    // movement, not hiss
    const air = AC.createBufferSource();
    air.buffer = noiseBuf(3, () => 1); air.loop = true;
    const ahp = AC.createBiquadFilter(); ahp.type = 'highpass'; ahp.frequency.value = 700;
    const abp = AC.createBiquadFilter(); abp.type = 'bandpass'; abp.frequency.value = 1700; abp.Q.value = .5;
    airGain = AC.createGain(); airGain.gain.value = 0;
    air.connect(ahp); ahp.connect(abp); abp.connect(airGain);
    airGain.connect(dry); airGain.connect(sendT); air.start();
  }

  function toggle() {
    if (!AC) build();
    if (AC.state === 'suspended') AC.resume();
    on = !on;
    master.gain.cancelScheduledValues(AC.currentTime);
    master.gain.linearRampToValueAtTime(on ? .30 : 0, AC.currentTime + (on ? 1.6 : .4));
    snd.classList.toggle('on', on);
    snd.querySelector('.lbl').textContent = on ? 'sound on' : 'sound';
  }
  snd.addEventListener('click', toggle);

  // an impact: weight underneath, a thump in the body, a snap on top
  function hit(strength = 1) {
    if (!on || !AC) return;
    const t = AC.currentTime;

    const o = AC.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + .5);
    const og = AC.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(.85 * strength, t + .006);
    og.gain.exponentialRampToValueAtTime(.0001, t + 1.0);
    o.connect(og); og.connect(dry); og.connect(sendT); o.start(t); o.stop(t + 1.1);

    const th = AC.createBufferSource(); th.buffer = noiseBuf(.22, x => Math.pow(1 - x, 3));
    const tlp = AC.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 260;
    const tg = AC.createGain(); tg.gain.value = .55 * strength;
    th.connect(tlp); tlp.connect(tg); tg.connect(dry); th.start(t);

    const sn = AC.createBufferSource(); sn.buffer = noiseBuf(.11, x => Math.pow(1 - x, 6));
    const shp = AC.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 3200;
    const sg = AC.createGain(); sg.gain.value = .16 * strength;
    sn.connect(shp); shp.connect(sg); sg.connect(dry); sg.connect(sendT); sn.start(t);
  }

  // the room tightens: the bed opens up, the sub arrives, everything leans in
  function tension(v) {
    if (!AC || !on) return;
    const t = AC.currentTime;
    lp.frequency.linearRampToValueAtTime(lp.frequency.value + v * 500, t + .4);
    subGain.gain.linearRampToValueAtTime(v * .22, t + .4);
    for (const b of bed) b.g.gain.linearRampToValueAtTime(b.base * (1 + v * .3), t + .4);
    master.gain.linearRampToValueAtTime(.30 + v * .08, t + .4);
  }

  function air(v) {
    if (!AC || !on) return;
    airGain.gain.linearRampToValueAtTime(Math.min(.05, v * .06), AC.currentTime + .12);
  }

  // ---- per-beat sound design ----
  // Every note is IN TUNE. The previous version detuned voices by up to 50
  // cents to suggest decay, which just sounds broken. The beats change by
  // moving to a different CHORD and register, and each change is marked by a
  // struck tone so you hear the turn instead of guessing at a slow ramp.
  const BEATS = {
    // A minor, open fifths — waiting
    0: { ch: [110.00, 164.81, 220.00, 329.63], lp: 1400, vol: .80, bell: 440.00 },
    // the night: sparse and high. Root, octave, fifth, ninth. One person awake.
    1: { ch: [110.00, 220.00, 329.63, 493.88], lp: 1150, vol: .60, bell: 659.25 },
    // eight months: drops a whole octave to bare root and fifth. Hollow, not sour.
    2: { ch: [ 82.41, 123.47, 164.81,   0   ], lp:  620, vol: .50, bell: 164.81 },
    // the agent: C major, close and present
    3: { ch: [130.81, 196.00, 261.63, 392.00], lp: 1750, vol: .85, bell: 523.25 },
    // the lie: A suspended 4th — unresolved, but still consonant
    4: { ch: [110.00, 146.83, 220.00, 293.66], lp: 1250, vol: .72, bell: 293.66 },
    // the proof: A major. It resolves, and the filter opens all the way.
    5: { ch: [110.00, 164.81, 277.18, 329.63], lp: 2200, vol: .92, bell: 554.37 },
  };
  let bedSend = null, bedVol = null;

  // a soft struck tone: this is what makes a beat change audible
  function bell(f, g = .16) {
    if (!on || !AC) return;
    const t = AC.currentTime;
    for (const [mult, gain, dur] of [[1, g, 4.2], [2, g * .30, 3.0], [3, g * .12, 2.2]]) {
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
      const og = AC.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(gain, t + .012);       // soft, never a click
      og.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(og); og.connect(dry); og.connect(sendT);      // long tail in the room
      o.start(t); o.stop(t + dur + .1);
    }
  }

  function beat(n) {
    if (!AC || !on) return;
    const B = BEATS[n]; if (!B) return;
    const t = AC.currentTime, R = 1.4;
    lp.frequency.linearRampToValueAtTime(B.lp, t + R);
    bedVol.gain.linearRampToValueAtTime(B.vol, t + R);
    bed.forEach((b, i) => {
      const f = B.ch[i];
      if (!f) { b.g.gain.linearRampToValueAtTime(0, t + R); return; }
      b.g.gain.linearRampToValueAtTime(b.base, t + R);
      b.o.frequency.exponentialRampToValueAtTime(f, t + R);   // portamento: you HEAR it move
    });
    bell(B.bell);
  }

  let boxed = false, lastFlash = -1e9;

  // ---- opening titles ----
  function opening(cards) {
    if (reduced) return Promise.resolve();
    const o = el('div', 'opening');
    o.innerHTML = `<div class="ocards"></div>
      <button class="oskip" type="button">skip</button>`;
    const holder = o.querySelector('.ocards');
    let at = 0, markCard = null, markAt = 0;
    cards.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'ocard' + (c.mark ? ' omark' : '');
      const LOGO = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12.3 3 16.5l9 4.2 9-4.2z" opacity=".45"/><path d="M12 7.8 3 12l9 4.2L21 12z" opacity=".7"/><path d="M12 3.3 3 7.5l9 4.2 9-4.2z"/></svg>`;
      // On the title card he is not the overworked engineer yet — he is just
      // pleased to be here. It is the only time in the film he dances.
      d.innerHTML = (c.mark ? `<div class="orow"><div class="obuddy"></div>${LOGO}</div>` : '')
        + `<span>${c.t}</span>`;
      if (c.mark) {
        // 'walk' is the arc's "hauling it -- he walks everywhere towing seven
        // systems". He arrives on the title card already carrying the problem.
        mountBrain(d.querySelector('.obuddy'), 'walk');
        markCard = d; markAt = at;
      }
      d.style.animationDelay = at + 'ms';
      d.style.animationDuration = c.hold + 'ms';   // each card owns its own slot
      at += c.hold;
      holder.appendChild(d);
    });
    barT.style.height = barB.style.height = '7.2vh';
    document.body.classList.add('opening-on');
    // The rope hangs on the CARD HOLDER, not on him -- same as brain.html and
    // same as the page: a rope hosted on a 78px box cannot hang.
    let introRope = null;
    if (markCard) setTimeout(() => {
      const bud = markCard.querySelector('.obuddy');
      if (!bud || !bud.isConnected) return;
      holder.classList.add('ropehost');
      introRope = makeRope(holder, () => {
        const h = holder.getBoundingClientRect();
        const hand = bud.querySelector('.b-hand') || bud;
        const r = hand.getBoundingClientRect();
        return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
      }, { links: 14, seg: 9, reduced });
    }, markAt + 120);
    return new Promise(res => {
      let done = false;
      const end = () => {
        if (done) return; done = true;
        o.classList.add('out');
        document.body.classList.remove('opening-on');
        lastFlash = -1e9;
        if (introRope) introRope.stop();   // its rAF would outlive the overlay
        setTimeout(() => o.remove(), 700); res();
      };
      const total = cards.reduce((a, c) => a + c.hold, 0);
      const timer = setTimeout(end, total);
      const skip = () => { clearTimeout(timer); end(); };
      o.querySelector('.oskip').addEventListener('click', skip);
      o.addEventListener('click', skip);
      addEventListener('keydown', skip, { once: true });
      addEventListener('wheel', skip, { once: true, passive: true });
      addEventListener('touchstart', skip, { once: true, passive: true });
    });
  }
  return {
    // 0 = open frame, 1 = full letterbox
    box(v) {
      const h = (v * 7.2).toFixed(2) + 'vh';
      barT.style.height = h; barB.style.height = h;
      const nb = v > .5;
      if (nb !== boxed) { boxed = nb; document.body.classList.toggle('boxed', nb); }
    },
    flash(strength = 1) {
      if (reduced) return;
      const now = performance.now();
      if (now - lastFlash < 240) return;      // still well under the 3Hz threshold
      lastFlash = now;
      flash.style.transition = 'none'; flash.style.opacity = String(.5 * strength);
      requestAnimationFrame(() => { flash.style.transition = 'opacity .34s ease-out'; flash.style.opacity = '0'; });
      hit(strength);
    },
    timecode(seconds) {
      const f = Math.floor((seconds % 1) * 24);
      const s = Math.floor(seconds) % 60, m = Math.floor(seconds / 60) % 60, h = Math.floor(seconds / 3600);
      const p = (n) => String(n).padStart(2, '0');
      tcv.textContent = `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
    },
    rolling(v) { tc.classList.toggle('on', v); },
    grain(v) { grain.style.opacity = v ? '.10' : '0'; },
    opening,
    tension,
    air,
    beat,
  };
}
