import { gsap } from 'gsap';

// Film-style subtitles for the narration: one cue at a time, at most two lines, centred at the
// bottom of the screen. Words light up as they are spoken (colour only, no movement).
//
// Cues are cut from the narration's word timings: a cue never crosses a sentence, and a long
// sentence is split into cues of at most two lines, preferring to end a cue at a comma.
// A cue stays up through short pauses and clears when the voice is silent for longer.

const LINE_CHARS = { wide: 46, compact: 34 };   // ≈ characters per line at the subtitle's size
const HOLD = 0.6;                               // s a cue may stay after its last word
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const len = (tokens) => tokens.reduce((n, t) => n + t.text.length + 1, -1);

// Each word with the punctuation around it, from its sentence's text: [{ text, word, line }].
// Between two words, what touches the first ("dah,") stays with it; what follows the space
// (an opening quote) joins the next.
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
      const [, tail, lead] = s.text.slice(cursor, at).match(/^(\S*)\s*([\s\S]*)$/);
      if (last) last.text += tail;
      last = { text: (last ? lead : tail + lead) + s.text.slice(at, at + w.text.length), word, line };
      out.push(last);
      cursor = at + w.text.length;
    });
    if (last) last.text += s.text.slice(cursor).trimEnd();
  });
  return out;
}

// Splits a cue's tokens into one line, or two lines as even as possible.
function toLines(tokens, max) {
  if (len(tokens) <= max) return [tokens];
  let best = 1;
  let score = Infinity;
  for (let k = 1; k < tokens.length; k++) {
    const a = len(tokens.slice(0, k));
    const b = len(tokens.slice(k));
    const s = Math.max(a, b) + Math.abs(a - b) * 0.25;
    if (s < score) {
      score = s;
      best = k;
    }
  }
  return [tokens.slice(0, best), tokens.slice(best)];
}

function buildCues(n, max) {
  const cues = [];
  let cur = [];
  const close = () => {
    if (!cur.length) return;
    const first = n.words[cur[0].word];
    const last = n.words[cur[cur.length - 1].word];
    cues.push({ lines: toLines(cur, max), start: first.start, end: last.end });
    cur = [];
  };
  // a sentence that fits two lines is one cue; a longer one is cut into even cues, at a comma
  // when one comes past the middle of a cue
  const sentences = [];
  for (const t of tokenize(n)) (sentences[t.line] ??= []).push(t);
  for (const group of sentences.filter(Boolean)) {
    const parts = Math.ceil(len(group) / (max * 2));
    const target = len(group) / parts;
    for (const t of group) {
      if (cur.length && len([...cur, t]) > Math.min(max * 2, target + max * 0.25)) close();
      cur.push(t);
      if (parts > 1 && len(cur) >= target * 0.6 && /[,;:]$/.test(t.text)) close();
    }
    close();
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
    this.layout = null;
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
    const layout = document.documentElement.dataset.layout;
    if (n.words !== this.words || layout !== this.layout) {
      this.words = n.words;
      this.layout = layout;
      this.cues = buildCues(n, LINE_CHARS[layout] ?? LINE_CHARS.wide);
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
    const parts = [];
    cue.lines.forEach((line, i) => {
      if (i) parts.push(h('br'));
      const box = h('span', 'subtitle__line');
      line.forEach((t, j) => {
        if (j) box.append(' ');
        const w = h('span', 'w', t.text);
        this.spans[t.word] = w;
        box.append(w);
      });
      parts.push(box);
    });
    this.el.replaceChildren(...parts);
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
