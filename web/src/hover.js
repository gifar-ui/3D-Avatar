import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { popIcon } from './motion.js';

gsap.registerPlugin(Draggable);

// Pointer hover motion on the page chrome: the letters of the wordmark and the nav labels ripple,
// the home cards tilt toward the cursor under a moving sheen, and the round buttons are magnetic.
// On the Skills panel the logos pop under the cursor and a memo can be pulled about (memoPointer).
// Mouse and trackpad only (a tap fires a stray hover) and never with reduced motion; the CSS
// colour and shadow changes on hover stay either way. Everything here is transform and opacity.

const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const on = () => fine.matches && !reduceMotion.matches;

export function initHover() {
  wordmarkWave(document.querySelector('.wordmark'));
  for (const link of document.querySelectorAll('.mainnav .nav-link')) navWave(link);
  for (const card of document.querySelectorAll('.topic-card')) cardTilt(card);
  for (const btn of document.querySelectorAll('#btn-sound, #btn-menu, #connect-links .icon-btn')) magnetic(btn, 0.35, true);
  magnetic(document.getElementById('lang-switch'), 0.18, false);
}

// Each glyph as an inline-block span, so it can move on its own; spaces kept as no-break spaces.
function splitChars(el, text) {
  return [...text].map((c) => {
    const s = document.createElement('span');
    s.className = 'char';
    s.textContent = c === ' ' ? ' ' : c;
    el.append(s);
    return s;
  });
}

// The letters hop one after another, a small wave left to right, and land with a little bounce.
// One wave at a time: a new hover mid-wave lets it finish.
function waveOn(target, glyphs) {
  let wave = null;
  target.addEventListener('pointerenter', () => {
    if (!on() || wave?.isActive()) return;
    const letters = glyphs();
    wave = gsap.timeline()
      .to(letters, { y: -5, rotation: (i) => (i % 2 ? 4 : -4), duration: 0.18, ease: 'power2.out', stagger: 0.045 }, 0)
      .to(letters, { y: 0, rotation: 0, duration: 0.4, ease: 'back.out(3)', stagger: 0.045 }, 0.18);
  });
}

// GIFFΛR
function wordmarkWave(mark) {
  for (const node of [...mark.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const run = document.createElement('span');
    splitChars(run, node.textContent);
    node.replaceWith(run);
  }
  const ordered = [...mark.querySelectorAll('.char, .wordmark__lambda')];   // reading order: G I F F Λ R
  waveOn(mark, () => ordered);
}

// Nav labels wave like the wordmark. The language switch rewrites a label (ui.js renderLanguage),
// so it is split again on its next hover.
function navWave(link) {
  waveOn(link, () => {
    if (!link.querySelector('.char')) {
      const text = link.textContent;
      link.textContent = '';
      splitChars(link, text);
    }
    return [...link.querySelectorAll('.char')];
  });
}

// Home card: tilts toward the cursor (--rx/--ry feed the card's own transform in style.css, which
// GSAP never writes, see motion.js), a soft light follows the pointer across the glass, the icon
// pops and the arrow slides out and back in.
function cardTilt(card) {
  const sheen = document.createElement('span');
  sheen.className = 'topic-card__sheen';
  sheen.setAttribute('aria-hidden', 'true');
  card.prepend(sheen);
  const chip = card.querySelector('.icon-chip');
  const arrow = card.querySelector('.topic-card__arrow svg');

  const tilt = { rx: 0, ry: 0 };
  // both tweens update on the same tick: one write after them (as the parallax, motion.js)
  let queued = false;
  const write = () => {
    queued = false;
    card.style.setProperty('--rx', tilt.rx.toFixed(2));
    card.style.setProperty('--ry', tilt.ry.toFixed(2));
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    gsap.ticker.add(write, true);
  };
  const toRx = gsap.quickTo(tilt, 'rx', { duration: 0.5, ease: 'power3.out', onUpdate: queue });
  const toRy = gsap.quickTo(tilt, 'ry', { duration: 0.5, ease: 'power3.out', onUpdate: queue });
  const sheenX = gsap.quickTo(sheen, 'x', { duration: 0.35, ease: 'power3.out' });
  const sheenY = gsap.quickTo(sheen, 'y', { duration: 0.35, ease: 'power3.out' });
  const wide = () => document.documentElement.dataset.layout === 'wide';
  // the 3D tilt is on only while the card tilts (style.css .is-tilting): flat, its text stays sharp
  let flatten = null;

  card.addEventListener('pointerenter', (e) => {
    if (!on() || !wide()) return;
    flatten?.kill();
    card.classList.add('is-tilting');
    const r = card.getBoundingClientRect();
    gsap.set(sheen, { x: e.clientX - r.left - sheen.offsetWidth / 2, y: e.clientY - r.top - sheen.offsetHeight / 2 });
    gsap.to(sheen, { autoAlpha: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    gsap.fromTo(chip, { scale: 1, rotation: 0 }, { scale: 1.14, rotation: -10, duration: 0.45, ease: 'back.out(4)', overwrite: 'auto' });
    gsap.timeline({ overwrite: 'auto' })
      .to(arrow, { x: 14, autoAlpha: 0, duration: 0.16, ease: 'power2.out' })
      .set(arrow, { x: -14 })
      .to(arrow, { x: 0, autoAlpha: 1, duration: 0.32, ease: 'power3.out' });
  });
  card.addEventListener('pointermove', (e) => {
    if (!on() || !wide()) return;
    const r = card.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;     // -1…1, left to right
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;     // -1…1, top to bottom
    toRx(-ny * 7);
    toRy(nx * 9);
    sheenX(e.clientX - r.left - sheen.offsetWidth / 2);
    sheenY(e.clientY - r.top - sheen.offsetHeight / 2);
  });
  card.addEventListener('pointerleave', () => {
    toRx(0);
    toRy(0);
    flatten?.kill();
    flatten = gsap.delayedCall(0.55, () => card.classList.remove('is-tilting'));   // once the tilt is back to 0 (0.5 s)
    gsap.to(sheen, { autoAlpha: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(chip, { scale: 1, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
  });
}

// Skills memo (ui.js renderStack, rebuilt with each topic): a logo pops as the cursor comes onto its
// skill, and the paper can be pulled by hand (Draggable), stiffly, as if the tape held it. It swings
// from the tape as it goes (style.css puts the pivot there) and springs back onto its spot on
// release, like the round buttons. Only on wide screens with the whole panel showing: while a memo
// is off its spot (.is-loose) the panel lets it out of its column (style.css), which a scrolling
// panel can't do without jumping, and in compact the panel is a touch sheet anyway.
const MEMO_REACH = { minX: -56, maxX: 56, minY: -28, maxY: 40 };   // px the pull can take it

export function memoPointer(memo) {
  memo.addEventListener('pointerover', (e) => {
    const item = e.target.closest('.memo__item');
    if (on() && item && !item.contains(e.relatedTarget)) popIcon(item.querySelector('.memo__icon'));
  });
  if (!on()) return;
  const free = () => {
    const panel = memo.closest('.topic');
    return document.documentElement.dataset.layout === 'wide' && panel.scrollHeight <= panel.clientHeight + 1;
  };
  Draggable.create(memo, {
    type: 'x,y',
    bounds: MEMO_REACH,
    edgeResistance: 0.85,
    dragResistance: 0.45,
    onPress(e) {
      if (!free()) return this.endDrag(e);
      gsap.killTweensOf(memo, 'x,y,rotation');    // a spring-back (or the entrance's swing) gives way
      memo.classList.add('is-held', 'is-loose');
    },
    onDrag() {
      gsap.set(memo, { rotation: gsap.utils.clamp(-9, 9, this.x * 0.14) });
    },
    onRelease() {
      memo.classList.remove('is-held');
      gsap.to(memo, {
        x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', clearProps: 'transform',
        onComplete: () => memo.classList.remove('is-loose'),
      });
    },
  });
}

// Round button: pulled toward the cursor (with `depth`, its icon a little further), swells slightly,
// and springs back to rest when the cursor leaves. The sound button's icon is replaced on every
// toggle (ui.js renderSound), so the icon's tweens follow whichever element is there now.
function magnetic(btn, strength, depth) {
  if (!btn) return;
  const follow = { duration: 0.4, ease: 'power3.out' };
  const bx = gsap.quickTo(btn, 'x', follow);
  const by = gsap.quickTo(btn, 'y', follow);
  let icon = null;
  let ix = null;
  let iy = null;
  const current = () => {
    const el = depth ? btn.firstElementChild : null;
    if (el !== icon) {
      icon = el;
      ix = el && gsap.quickTo(el, 'x', follow);
      iy = el && gsap.quickTo(el, 'y', follow);
    }
    return icon;
  };
  btn.addEventListener('pointerenter', () => {
    if (!on()) return;
    gsap.to(btn, { scale: 1.08, duration: 0.35, ease: 'back.out(3)', overwrite: 'auto' });
  });
  btn.addEventListener('pointermove', (e) => {
    if (!on()) return;
    const r = btn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    bx(dx * strength);
    by(dy * strength);
    if (current()) {
      ix(dx * strength * 0.5);
      iy(dy * strength * 0.5);
    }
  });
  btn.addEventListener('pointerleave', () => {
    const back = { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' };
    gsap.to(btn, { ...back, scale: 1 });
    if (current()) gsap.to(icon, back);
  });
}
