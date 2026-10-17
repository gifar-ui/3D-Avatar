import { LipSync } from './lipsync.js';

// Narration for a topic. Two modes:
//  - voice: a recorded audio file plus its .lipsync.json (from tts/align.py). Time follows
//    the audio element; the mouth follows the detailed phoneme timeline.
//  - simulated: no audio yet. Time runs on a reading pace from the transcript text and the
//    mouth shows the vowel of the letter being "spoken".

const CHARS_PER_SEC = 14;
const SENTENCE_GAP = 0.45;
const VOWEL = { a: 'aa', i: 'ih', y: 'ih', u: 'ou', e: 'ee', o: 'oh' };
const cache = new Map();

async function fetchLipsync(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`)))));
  return cache.get(url);
}

export class Narration {
  constructor({ onChange } = {}) {
    this.onChange = onChange ?? (() => {});
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this.#stopped());
    this.audio.addEventListener('pause', () => this.#stopped());
    this.muted = false;
    this.token = 0;
    this.#reset([], 0);
  }

  // Loads a topic's narration. Resolves when it is ready to play.
  async load(topic) {
    const token = ++this.token;
    this.audio.pause();
    this.lip = null;
    if (topic.voice) {
      try {
        const data = await fetchLipsync(topic.voice.lipsync);
        if (token !== this.token) return;
        this.lip = new LipSync(data);
        this.audio.src = topic.voice.audio;
        const sentences = data.sentences.map((s) => ({ text: s.text, start: s.s, end: s.e }));
        const words = data.words?.map((w) => ({ text: w.text, line: w.line, start: w.s, end: w.e }));
        this.#reset(sentences, data.duration, words ?? pacedWords(sentences));
        return;
      } catch (err) {
        console.warn('Narration audio unavailable, using the simulated voice.', err);
        if (token !== this.token) return;
      }
    }
    this.audio.removeAttribute('src');
    let t = 0;
    const sentences = topic.transcript.map((text) => {
      const dur = Math.max(1.2, text.length / CHARS_PER_SEC);
      const s = { text, start: t, end: t + dur };
      t += dur + SENTENCE_GAP;
      return s;
    });
    this.#reset(sentences, Math.max(0, t - SENTENCE_GAP), pacedWords(sentences));
  }

  #reset(sentences, duration, words = []) {
    this.sentences = sentences;
    this.words = words;           // [{ text, line (sentence index), start, end }] in spoken order
    this.duration = duration;
    this.simTime = 0;
    this.playing = false;
    this.onChange(this);
  }

  #stopped() {
    if (!this.lip || !this.playing) return;
    this.playing = false;
    this.onChange(this);
  }

  get time() {
    return this.lip ? this.audio.currentTime : this.simTime;
  }

  // True once it has played to the end (until it is played or sought again).
  get ended() {
    return this.lip ? this.audio.ended : this.duration > 0 && this.simTime >= this.duration;
  }

  play() {
    if (!this.duration) return;
    if (this.time >= this.duration - 0.05) this.seek(0);
    this.playing = true;
    if (this.lip) {
      this.audio.muted = this.muted;
      this.audio.play().catch(() => {            // autoplay blocked before any interaction
        this.playing = false;
        this.onChange(this);
      });
    }
    this.onChange(this);
  }
  pause() {
    this.playing = false;
    if (this.lip) this.audio.pause();
    this.onChange(this);
  }
  toggle() {
    this.playing ? this.pause() : this.play();
  }
  seek(t) {
    const v = Math.min(this.duration, Math.max(0, t));
    if (this.lip) this.audio.currentTime = v;
    else this.simTime = v;
    this.onChange(this);
  }
  setMuted(m) {
    this.muted = m;
    this.audio.muted = m;
  }

  get current() {
    const t = this.time;
    return this.sentences.findIndex((s) => t >= s.start && t < s.end + SENTENCE_GAP);
  }

  // Number of words whose start has been reached (so words[0..n-1] are spoken or being spoken).
  get spokenWords() {
    const t = this.time;
    const w = this.words;
    let lo = 0;
    let hi = w.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (w[mid].start <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Advances the clock; returns mouth weights {aa, ih, ou, ee, oh} or null when silent.
  update(dt) {
    if (!this.playing) return null;
    if (this.lip) return this.lip.sample(this.audio.currentTime);

    this.simTime += dt;
    if (this.simTime >= this.duration) {
      this.simTime = this.duration;
      this.playing = false;
      this.onChange(this);
      return null;
    }
    const s = this.sentences.find((x) => this.simTime >= x.start && this.simTime < x.end);
    if (!s) return null;                                  // pause between sentences
    const i = Math.floor((this.simTime - s.start) * CHARS_PER_SEC);
    const text = s.text.toLowerCase();
    for (let j = i; j < Math.min(text.length, i + 3); j++) {
      const ch = text[j];
      if (VOWEL[ch]) return { [VOWEL[ch]]: 0.85 };
      if (!/[a-z]/.test(ch)) return null;                  // space or punctuation: lips close
    }
    return null;
  }
}

// Word timings for narration without an alignment: spread over each sentence at the reading pace.
function pacedWords(sentences) {
  const words = [];
  sentences.forEach((s, line) => {
    for (const m of s.text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
      const start = s.start + m.index / CHARS_PER_SEC;
      words.push({ text: m[0], line, start, end: Math.min(s.end, start + m[0].length / CHARS_PER_SEC) });
    }
  });
  return words;
}

export const formatTime = (t) => {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
