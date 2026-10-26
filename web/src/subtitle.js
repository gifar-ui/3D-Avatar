import { gsap } from 'gsap';

// Film-style subtitles for the narration: one cue at a time, always a single line, centred at the
// bottom of the screen. Words light up as they are spoken (colour only, no movement).
//
// Cues are cut from the narration's word timings: a cue never crosses a sentence, and a sentence
// too long for one line is split into even one-line cues, preferring to end a cue at a comma.
// Lines are measured in the subtitle's own font (a canvas), against the width the line has on
// screen. A cue stays up through short pauses and clears when the voice is silent for longer.

const HOLD = 0.6;                               // s a cue may stay after its last word
const FIT = 0.94;                               // share of the width a line may fill (the font's
                                                // rounding, a font not loaded yet)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctx = document.createElement('canvas').getContext('2d');

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const joinTokens = (tokens) => tokens.map((t, i) => (i && !t.joined ? ' ' : '') + t.text).join('');

// Each word with the punctuation around it, from its sentence's text: [{ text, word, line, joined }].
// Between two words, what touches the first ("dah,") stays with it; what follows the space
// (an opening quote) joins the next. Parts of one written word ("Node.js", "cita-cita") are
// `joined`: no space before them, and never a line or cue break.
function tokenize(n) {
  const out = [];
  n.sentences.forEach((s, line) => {
    let cursor = 0;
    let last = null;
    n.words.forEach((w, word) => {
      if (w.line !== line) return;
      let at = s.text.indexOf(w.text, cursor);
      if (at < 0) at = s.text.toLowerCase().indexOf(w.text.toLowerCase(), cursor);
      if (at < 0) return;
      const gap = s.text.slice(cursor, at);
      const [, tail, lead] = gap.match(/^(\S*)\s*([\s\S]*)$/);
      if (last) last.text += tail;
      last = { text: (last ? lead : tail + lead) + s.text.slice(at, at + w.text.length), word, line, joined: !!last && !/\s/.test(gap) };
      out.push(last);
      cursor = at + w.text.length;
    });
    if (last) last.text += s.text.slice(cursor).trimEnd();
  });
  return out;
}

// The subtitle's font and the width a line has (px), read from its CSS so the two never drift apart.
function measure(el) {
  const cs = getComputedStyle(el);
  const size = parseFloat(cs.fontSize);
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const maxWidth = parseFloat(cs.maxWidth) || Infinity;
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  // the line's own padding, from the stylesheet (a line may not exist yet to read it from)
  const linePad = 2 * (document.documentElement.dataset.layout === 'compact' ? 12 : 14);
  const spacing = parseFloat(cs.letterSpacing) || 0;
  return { font, size, spacing, width: (Math.min(window.innerWidth, maxWidth) - pad - linePad) * FIT };
}

// Cuts a sentence's tokens into the fewest runs that each fit `max` px, choosing the cuts (dynamic
// programming over the gaps between words) so the runs come out even; a cut after a comma costs a
// little less. A word too long for a line on its own gets a line to itself.
const COMMA_BONUS = 0.06;    // how much unevenness (squared share of the even length) a comma is worth

function split(tokens, width, max) {
  const total = width(tokens);
  if (total <= max) return [tokens];
  const n = tokens.length;
  const cuts = [0];          // where a run may start: not inside a written word ("Node.js")
  for (let i = 1; i < n; i++) if (!tokens[i].joined) cuts.push(i);
  cuts.push(n);
  for (let parts = Math.ceil(total / max); parts <= n; parts++) {
    const target = total / parts;
    // best[k][j]: the lowest cost of cutting tokens [0, cuts[j]) into k runs
    const best = Array.from({ length: parts + 1 }, () => new Array(cuts.length).fill(Infinity));
    const from = Array.from({ length: parts + 1 }, () => new Array(cuts.length).fill(-1));
    best[0][0] = 0;
    for (let k = 1; k <= parts; k++) {
      for (let j = 1; j < cuts.length; j++) {
        for (let i = 0; i < j; i++) {
          if (best[k - 1][i] === Infinity) continue;
          const run = tokens.slice(cuts[i], cuts[j]);
          const w = width(run);
          if (w > max && j - i > 1) continue;
          const comma = cuts[j] < n && /[,;:]$/.test(run[run.length - 1].text);
          const cost = best[k - 1][i] + ((w - target) / target) ** 2 - (comma ? COMMA_BONUS : 0);
          if (cost < best[k][j]) {
            best[k][j] = cost;
            from[k][j] = i;
          }
        }
      }
    }
    if (best[parts][cuts.length - 1] === Infinity) continue;
    const runs = [];
    for (let k = parts, j = cuts.length - 1; k > 0; j = from[k][j], k--) runs.unshift(tokens.slice(cuts[from[k][j]], cuts[j]));
    return runs;
  }
  return [tokens];
}

function buildCues(n, m) {
  ctx.font = m.font;
  const width = (tokens) => {
    const text = joinTokens(tokens);
    return ctx.measureText(text).width + text.length * m.spacing;
  };
  const cues = [];
  // a sentence that fits the line is one cue; a longer one is cut into as few one-line cues as fit,
  // as even as they can be, ending a cue at a comma where that keeps them about even
  const sentences = [];
  for (const t of tokenize(n)) (sentences[t.line] ??= []).push(t);
  for (const group of sentences.filter(Boolean)) {
    for (const tokens of split(group, width, m.width)) {
      cues.push({ tokens, start: n.words[tokens[0].word].start, end: n.words[tokens[tokens.length - 1].word].end });
    }
  }
  cues.forEach((c, i) => {
    const next = cues[i + 1]?.start ?? Infinity;
    c.until = Math.min(next, c.end + HOLD);
  });
  return cues;
}

export class Subtitles {
  constructor(el) {
    this.el = el;
    this.words = null;
    this.fit = null;       // the layout and width the cues were cut for
    this.cues = [];
    this.shown = null;     // the cue on screen
    this.spans = [];       // word index → span, for the cue on screen
    this.spoken = -1;
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem('subtitles') !== 'off';
    } catch { /* storage unavailable: subtitles on */ }
    el.classList.toggle('is-off', !this.enabled);
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.classList.toggle('is-off', !on);
    try {
      localStorage.setItem('subtitles', on ? 'on' : 'off');
    } catch { /* not remembered */ }
  }

  // Called on every narration change and every frame while it plays.
  update(n) {
    // the cues are cut again for new words, a new width (a resize, the layout), or the subtitle
    // font arriving (until then they're measured in the fallback font)
    const fit = `${document.documentElement.dataset.layout} ${window.innerWidth}`;
    if (n.words !== this.words || fit !== this.fit) {
      this.words = n.words;
      this.fit = fit;
      const m = measure(this.el);
      this.cues = buildCues(n, m);
      if (!document.fonts.check(m.font)) document.fonts.load(m.font).then(() => (this.fit = null), () => {});
      this.#show(null, true);
    }
    // nothing before the first word or once the narration has ended (its clock stops there, so the
    // last cue would never time out); a pause keeps the cue being said
    const t = n.time;
    const live = !n.ended && (n.playing || t > 0);
    const cue = live ? this.cues.find((c) => t >= c.start - 0.05 && t < c.until) ?? null : null;
    if (cue !== this.shown) this.#show(cue);
    if (cue) this.#light(n.spokenWords);
  }

  #show(cue, now = false) {
    const el = this.el;
    this.shown = cue;
    this.spoken = -1;
    gsap.killTweensOf(el);
    if (!cue) {
      this.spans = [];
      if (now) {
        el.replaceChildren();
        gsap.set(el, { autoAlpha: 0 });
      } else {
        gsap.to(el, { autoAlpha: 0, duration: 0.2, ease: 'ui-out', onComplete: () => el.replaceChildren() });
      }
      return;
    }
    // the old cue leaves quickly, the new one comes up 4 px; with reduced motion it only fades
    const build = () => this.#build(cue);
    const enter = () => gsap.fromTo(el, { autoAlpha: 0, y: reduceMotion ? 0 : 4 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'ui-out', clearProps: 'transform' });
    if (now || +gsap.getProperty(el, 'opacity') === 0) {
      build();
      enter();
    } else {
      gsap.to(el, { autoAlpha: 0, duration: 0.12, ease: 'ui-out', onComplete: () => { build(); enter(); } });
    }
  }

  #build(cue) {
    this.spans = [];
    const box = h('span', 'subtitle__line');
    cue.tokens.forEach((t, j) => {
      if (j && !t.joined) box.append(' ');
      const w = h('span', 'w', t.text);
      this.spans[t.word] = w;
      box.append(w);
    });
    this.el.replaceChildren(box);
    const spoken = this.spoken;             // light what was already said before the cue came up
    this.spoken = -1;
    this.#light(spoken);
  }

  #light(spokenWords) {
    if (spokenWords === this.spoken) return;
    this.spoken = spokenWords;
    for (const [i, w] of this.spans.entries()) w?.classList.toggle('is-spoken', i < spokenWords);
  }
}
