// He is not a narrator. He is THE GUY WITH THE PROBLEM — the one everyone asks,
// who has forgotten it himself, buried in sticky notes. Then the product finds
// it for him and he becomes the hero. The whole arc is played for laughs.
export const BRAIN_SVG = `
<svg class="bx" viewBox="0 0 140 190" fill="none" aria-hidden="true">
 <g class="b-all">
  <g class="b-legs" stroke="currentColor" stroke-width="3.6" stroke-linecap="round">
    <path class="b-legL" d="M61 136 L56 166"/><path class="b-legR" d="M79 136 L84 166"/>
    <path class="b-footL" d="M52 166 L62 166"/><path class="b-footR" d="M78 166 L88 166"/>
  </g>
  <g class="b-arms" stroke="currentColor" stroke-width="3.6" stroke-linecap="round">
    <g class="b-armL"><path d="M55 112 L41 130"/>
      <!-- the rope ties HERE. Inside the arm group, so it inherits the swing and
           the rope stays in his hand instead of hovering beside it. -->
      <circle class="b-hand" cx="41" cy="130" r="1.6" fill="none" stroke="none"/></g>
    <path class="b-armR" d="M85 112 L99 130"/>
  </g>
  <rect class="b-body" x="55" y="106" width="30" height="32" rx="12" stroke="currentColor" stroke-width="3.6"/>

  <g class="b-head">
    <path class="b-skull" stroke="currentColor" stroke-width="3.8" stroke-linejoin="round"
      d="M70 26c10-6 22-3 25 6 11 1 16 11 13 19 7 6 5 18-4 21 1 10-9 17-18 14-5 6-15 8-20 3
         -7 4-16 1-18-7-10 1-17-7-14-16-8-5-7-17 2-20 0-10 10-16 18-13 3-7 12-9 16-7Z"/>
    <g class="b-folds" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".45">
      <path d="M70 30c-4 6 3 11-1 17"/><path d="M50 44c6 2 4 9 9 11"/><path d="M90 44c-6 2-4 9-9 11"/>
    </g>
    <g class="b-face">
      <g class="b-eyes"><circle class="b-eyeL" cx="59" cy="74" r="3.6" fill="currentColor"/>
        <circle class="b-eyeR" cx="81" cy="74" r="3.6" fill="currentColor"/></g>
      <g class="b-lids" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0">
        <path d="M54 74h10"/><path d="M76 74h10"/></g>
      <path class="b-brows" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"
            d="M53 64c3-3 9-3 12 0M75 64c3-3 9-3 12 0" opacity="0"/>
      <path class="b-mouth" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"
            d="M63 86c4 3 10 3 14 0"/>
      <g class="b-shades" opacity="0">
        <path d="M50 70h40" stroke="currentColor" stroke-width="3"/>
        <rect x="50" y="68" width="17" height="13" rx="3" fill="currentColor"/>
        <rect x="73" y="68" width="17" height="13" rx="3" fill="currentColor"/>
      </g>
    </g>
  </g>

  <!-- the comedy props -->
  <g class="b-sweat" opacity="0" fill="var(--agt,#6FA8DC)">
    <path class="s1" d="M100 52c0 0 4 5 4 7a4 4 0 1 1-8 0c0-2 4-7 4-7Z"/>
    <path class="s2" d="M40 58c0 0 3 4 3 6a3 3 0 1 1-6 0c0-2 3-6 3-6Z"/>
  </g>
  <g class="b-qmark" opacity="0">
    <text x="106" y="44" font-family="var(--serif)" font-size="30" fill="var(--marginL,#CF6055)">?</text>
  </g>
  <g class="b-bulb" opacity="0">
    <circle cx="70" cy="8" r="9" stroke="var(--warn,#D4A44C)" stroke-width="2.6" class="b-glass"/>
    <path d="M65 18h10" stroke="var(--warn,#D4A44C)" stroke-width="2.6" stroke-linecap="round"/>
    <g class="b-rays" stroke="var(--warn,#D4A44C)" stroke-width="2.2" stroke-linecap="round" opacity="0">
      <path d="M70 -6v-5M55 -1l-4-4M85 -1l4-4M50 12h-5M90 12h5"/>
    </g>
  </g>

  <!-- the thread. It is a nuisance he drags about — until the end. -->
  <g class="b-thread" stroke="var(--marginL,#CF6055)" fill="none" stroke-linecap="round">
    <path class="b-knot" d="M38 128c2.6-1.6 5.4-1.6 7 .6s.4 4.6-2.2 5.2-5-.8-5.4-3 .6-2.8.6-2.8Z" stroke-width="2.4"/>
  </g>
 </g>
</svg>`;

// the arc, in order
export const POSES = ['walk','swamped','asked','straining','blank','panic','found','smug','hero','wave'];
export const ARC = {
  walk:      ['hauling it',   'he walks everywhere towing seven systems'],
  swamped:   ['drowning',    'every answer is in his head, and he is towing seven systems'],
  asked:     ['asked again', 'fifth time this month. same question.'],
  straining: ['straining',   'he KNOWS he knew this'],
  blank:     ['nothing',     'the light does not come on'],
  panic:     ['panic',       'production is down and he is the documentation'],
  found:     ['found it',    'DocBrain had it the whole time'],
  smug:      ['smug',        'he has never been more relaxed'],
  hero:      ['the hero',    'no rope. he is not carrying any of it any more.'],
  wave:      ['and out',      'he stops, turns, and looks straight at you'],
};
export const LINES = {
  walk:      "Every question in this company routes through me.",
  swamped:   "It is in one of these seven. Somewhere. Ask me anything. Please don't.",
  asked:     "Yes. Someone asked me this in March. I was there. I answered it.",
  straining: "It's… it's right there. I can almost—",
  blank:     "…no. It's gone. It's just gone.",
  panic:     "WHY AM I THE ONLY ONE WHO KNOWS THIS",
  found:     "Oh. Priya wrote it down. At 2am. Eight months ago.",
  smug:      "I don't remember anything any more. It's wonderful.",
  hero:      "Ask me anything. I genuinely do not have to remember it.",
  wave:      "Right. Go and self-host it. I have nothing else to do.",
};

let uid = 0;
export function mountBrain(el, pose = 'swamped') {
  el.innerHTML = BRAIN_SVG.replace(/SKULLCLIP/g, 'sk' + (++uid));
  // NEVER assign className here: it wipes whatever the host already had (.guide
  // and its position:fixed, for one) and drops the element into normal flow.
  const setPose = (pp) => {
    const keep = (el.getAttribute('class') || '').split(/\s+/)
      .filter(c => c && c !== 'brain' && !c.startsWith('pose-'));
    el.setAttribute('class', ['brain', ...keep, 'pose-' + pp].join(' '));
  };
  setPose(pose);
  return {
    pose(p) { setPose(p); },
    say(text) {
      let b = el.querySelector('.bubble');
      if (!text) { if (b) b.classList.remove('on'); return; }
      if (!b) { b = document.createElement('div'); b.className = 'bubble'; el.appendChild(b); }
      b.textContent = text;
      requestAnimationFrame(() => b.classList.add('on'));
    },
  };
}
