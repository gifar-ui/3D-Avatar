"""Detailed lip-sync timeline for a recorded voice line (Indonesian).

    python tts/align.py tts/input/sample-tts-informal.mp3 \
        --script tts/script/who-am-i.txt --out web/public/tts/who-am-i

Writes <out>.mp3 (a copy of the audio) and <out>.lipsync.json:
  sentences  one entry per script line, with its start/end (for the transcript)
  words      every word with its time span
  phonemes   one cue per phoneme: start, end, phoneme class, VRM mouth weights
             {aa, ih, ou, ee, oh}; lips-closed cues (p/b/m) have all weights 0
  envelope   loudness of the voice, 100 values per second, 0..100

Pipeline: faster-whisper word timestamps -> the script's spelling aligned onto
them -> letters split into Indonesian phonemes (digraphs ng/ny/kh/sy, diphthongs
ai/au/oi) -> each word's time shared by phoneme length -> mouth shapes per
phoneme, with consonants borrowing the shape of the vowel next to them.
"""

import argparse
import difflib
import json
import re
import shutil
from pathlib import Path

import av
import numpy as np
from faster_whisper import WhisperModel

# ---------- phonemes ----------
DIGRAPHS = ["ng", "ny", "kh", "sy", "ai", "au", "oi", "ei"]
VOWELS = set("aiueo")

# mouth weights per vowel (VRM presets). Indonesian "e" is often a schwa, so it is softer.
VOWEL_SHAPE = {
    "a": {"aa": 1.0},
    "i": {"ih": 0.9},
    "u": {"ou": 0.9},
    "e": {"ee": 0.65, "aa": 0.15},
    "o": {"oh": 0.95},
    "ai": {"aa": 0.8, "ih": 0.35},
    "au": {"aa": 0.6, "ou": 0.5},
    "oi": {"oh": 0.7, "ih": 0.35},
    "ei": {"ee": 0.7, "ih": 0.3},
}
# consonant classes: (relative length, fixed shape or None = borrow neighbour vowel, borrow strength)
CONS = {
    "bilabial": (0.55, {}, 0.0),                      # p b m: lips pressed shut
    "labiodental": (0.6, {"ih": 0.25, "ee": 0.1}, 0.0),  # f v: lower lip to teeth
    "round": (0.55, {"ou": 0.75}, 0.0),               # w: rounded lips
    "palatal": (0.55, {"ih": 0.45}, 0.0),             # y ny: spread
    "sibilant": (0.65, {"ih": 0.35, "ee": 0.2}, 0.0),  # s z c j sy: teeth together
    "alveolar": (0.5, None, 0.45),                    # t d n l r
    "velar": (0.5, None, 0.55),                       # k g ng kh h q x
}
CONS_CLASS = {
    **dict.fromkeys(["p", "b", "m"], "bilabial"),
    **dict.fromkeys(["f", "v"], "labiodental"),
    "w": "round",
    **dict.fromkeys(["y", "ny"], "palatal"),
    **dict.fromkeys(["s", "z", "c", "j", "sy"], "sibilant"),
    **dict.fromkeys(["t", "d", "n", "l", "r"], "alveolar"),
    **dict.fromkeys(["k", "g", "ng", "kh", "h", "q", "x"], "velar"),
}
VOWEL_LEN = {"a": 1.15, "o": 1.1, "e": 0.9, "i": 0.95, "u": 1.0}
SPEECH = {"aa", "ih", "ou", "ee", "oh"}


def phonemes(word):
    w = re.sub(r"[^a-z]", "", word.lower().replace("é", "e"))
    out, i = [], 0
    while i < len(w):
        two = w[i:i + 2]
        if two in DIGRAPHS and not (two in VOWEL_SHAPE and i + 2 < len(w) and w[i + 2] in VOWELS):
            out.append(two)
            i += 2
        else:
            out.append(w[i])
            i += 1
    return out


def is_vowel(p):
    return p in VOWEL_SHAPE


def word_cues(word, start, end):
    ph = phonemes(word)
    if not ph:
        return []
    lengths = []
    for k, p in enumerate(ph):
        if is_vowel(p):
            base = VOWEL_LEN.get(p, 1.25)
            if k == len(ph) - 1:
                base *= 1.15            # word-final vowels are drawn out a little
        else:
            base = CONS[CONS_CLASS.get(p, "velar")][0]
            if p == "k" and k == len(ph) - 1:
                base *= 0.5             # final k is a glottal stop
        lengths.append(base)
    scale = (end - start) / sum(lengths)

    cues, t = [], start
    for k, (p, ln) in enumerate(zip(ph, lengths)):
        if is_vowel(p):
            cls, shape = "vowel", dict(VOWEL_SHAPE[p])
        else:
            cls = CONS_CLASS.get(p, "velar")
            _, fixed, borrow = CONS[cls]
            if fixed is not None:
                shape = dict(fixed)
            else:   # coarticulation: take the nearest vowel's shape, weaker
                near = next((ph[j] for j in (k + 1, k - 1, k + 2, k - 2) if 0 <= j < len(ph) and is_vowel(ph[j])), "e")
                shape = {v: round(x * borrow, 3) for v, x in VOWEL_SHAPE[near].items()}
        cues.append({"s": round(t, 3), "e": round(t + ln * scale, 3), "p": p, "c": cls, "m": shape})
        t += ln * scale
    return cues


# ---------- alignment ----------
def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def align_script(script_words, asr_words):
    """Give every script word a time span, using the ASR words it matches."""
    a = [norm(w["text"]) for w in asr_words]
    b = [norm(w) for w in script_words]
    out = [None] * len(script_words)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                out[j1 + k] = (asr_words[i1 + k]["s"], asr_words[i1 + k]["e"])
        elif j2 > j1:
            if i2 > i1:
                s, e = asr_words[i1]["s"], asr_words[i2 - 1]["e"]
            else:   # inserted words: squeeze between neighbours
                s = asr_words[i1 - 1]["e"] if i1 > 0 else 0.0
                e = asr_words[i1]["s"] if i1 < len(asr_words) else s + 0.3
            total = sum(max(1, len(b[j])) for j in range(j1, j2))
            t = s
            for j in range(j1, j2):
                d = (e - s) * max(1, len(b[j])) / total
                out[j] = (t, t + d)
                t += d
    return out


def envelope(path, rate=100):
    with av.open(str(path)) as f:
        res = av.AudioResampler(format="flt", layout="mono", rate=16000)
        chunks = []
        for frame in f.decode(audio=0):
            for r in res.resample(frame):
                chunks.append(r.to_ndarray().reshape(-1))
    x = np.concatenate(chunks)
    hop = 16000 // rate
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    db = 20 * np.log10(rms + 1e-6)
    lo, hi = np.percentile(db, 10), np.percentile(db, 97)
    env = np.clip((db - lo) / (hi - lo + 1e-6), 0, 1)
    env = np.convolve(env, np.ones(3) / 3, mode="same")     # 30 ms smoothing
    return [int(round(v * 100)) for v in env], len(x) / 16000


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("audio", type=Path)
    p.add_argument("--script", type=Path, required=True, help="one sentence per line, spelled correctly")
    p.add_argument("--out", type=Path, required=True, help="output path without extension")
    p.add_argument("--model", default="small")
    p.add_argument("--lang", default="id", help="spoken language for the word timestamps (id, en, ...)")
    args = p.parse_args()

    lines = [l.strip() for l in args.script.read_text(encoding="utf-8").splitlines() if l.strip()]
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    def transcribe(prompt):
        segs, _ = model.transcribe(str(args.audio), language=args.lang, word_timestamps=True,
                                   vad_filter=True, initial_prompt=prompt)
        return [{"text": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words if w.word.strip()]

    tokens, owner = [], []
    for li, line in enumerate(lines):
        for w in re.findall(r"[\w’'-]+", line):
            for part in w.split("-"):             # cita-cita -> cita, cita
                if part:
                    tokens.append(part)
                    owner.append(li)
    # the script as a prompt helps with names, but whisper sometimes takes it as already
    # said and skips most of the audio (certs-tts.mp3: 14 of 75 words); then go without it
    asr = transcribe(" ".join(lines))
    if len(asr) < 0.6 * len(tokens):
        asr = transcribe(None)
    spans = align_script(tokens, asr)

    words, cues = [], []
    for tok, li, (s, e) in zip(tokens, owner, spans):
        words.append({"text": tok, "line": li, "s": round(s, 3), "e": round(e, 3)})
        cues.extend(word_cues(tok, s, e))

    sentences = []
    for li, line in enumerate(lines):
        ws = [w for w in words if w["line"] == li]
        sentences.append({"text": line, "s": ws[0]["s"], "e": ws[-1]["e"]})

    env, duration = envelope(args.audio)
    audio_out = args.out.with_suffix(args.audio.suffix)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.audio, audio_out)
    data = {
        "audio": audio_out.name,
        "duration": round(duration, 3),
        "sentences": sentences,
        "words": words,
        "phonemes": cues,
        "envelopeRate": 100,
        "envelope": env,
    }
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    args.out.with_suffix(".lipsync.json").write_text(text, encoding="utf-8")
    print(f"{len(sentences)} sentences, {len(words)} words, {len(cues)} phoneme cues, {duration:.2f}s")
    for s in sentences:
        print(f"  [{s['s']:6.2f}-{s['e']:6.2f}] {s['text']}")


if __name__ == "__main__":
    main()
