// Samples a <name>.lipsync.json timeline (made by tts/align.py) into VRM mouth weights.
// Per phoneme cue: its mouth shape, blended into the next cue over its last 35%
// (coarticulation), lips pressed shut through the middle of p/b/m, and the whole
// opening scaled by the voice's loudness envelope.

const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];
const LEAD = 0.04;                      // mouth moves slightly ahead of the sound
const smooth = (x) => x * x * (3 - 2 * x);

export class LipSync {
  constructor(data) {
    this.cues = data.phonemes;
    this.env = data.envelope;
    this.envRate = data.envelopeRate;
    this.sentences = data.sentences;
    this.duration = data.duration;
    this.i = 0;
    this.out = Object.fromEntries(VOWELS.map((v) => [v, 0]));
  }

  loudness(t) {
    const k = Math.min(this.env.length - 1, Math.max(0, Math.round(t * this.envRate)));
    return this.env[k] / 100;
  }

  find(t) {
    const c = this.cues;
    if (this.i >= c.length || c[this.i].s > t) this.i = 0;   // seek backwards: restart scan
    while (this.i < c.length && c[this.i].e <= t) this.i++;
    return this.i < c.length && c[this.i].s <= t ? this.i : -1;
  }

  sample(time) {
    const t = time + LEAD;
    const out = this.out;
    for (const v of VOWELS) out[v] = 0;
    const i = this.find(t);
    if (i < 0) return out;                                     // between words: mouth closes

    const cue = this.cues[i];
    const k = (t - cue.s) / Math.max(1e-3, cue.e - cue.s);
    if (cue.c === 'bilabial' && k > 0.2 && k < 0.8) return out;   // lips pressed together

    const next = this.cues[i + 1];
    const blend = next && next.s - cue.e < 0.06 ? smooth(Math.max(0, (k - 0.65) / 0.35)) : 0;
    const open = Math.min(1.15, 0.35 + 0.9 * this.loudness(time));
    for (const v of VOWELS) {
      const a = cue.m[v] ?? 0;
      const b = next ? (next.m[v] ?? 0) : 0;
      out[v] = (a + (b - a) * blend) * open;
    }
    return out;
  }
}
