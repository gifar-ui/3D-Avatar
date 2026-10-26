import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

// Choreography for the page around the camera moves: what leaves, what arrives, in what order.
// Each function returns a GSAP timeline, so main.js can nest it beside the camera tween.
// Entrances end with clearProps, handing the elements back to their CSS (hover lifts, card float).
// The cards and the name plate carry a CSS `translate` (float, centring), which GSAP would bake
// into an inline transform, so they move through the --slide/--rise/--grow variables instead.

gsap.registerPlugin(CustomEase);
// The page's one curve, for entrances and exits alike; CSS --ease is the same (style.css).
CustomEase.create('ui-out', '0.23, 1, 0.32, 1');

// Reduced motion is gentler, not none: the fades stay (3× quicker), every distance becomes 0.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const M = reduceMotion ? 0 : 1;
const CLEAR = 'transform,opacity,visibility,transition';
const CLEAR_VARS = '--slide,--rise,--grow,opacity,visibility';
const ARRIVE = { ease: 'ui-out', duration: 0.6, overwrite: 'auto' };
const LEAVE = { ease: 'ui-out', duration: 0.24, overwrite: 'auto' };
const PULL = 0.3;                   // cards start this share of the way toward the avatar…
const PULL_MAX = 0.6;               // …but at most this many card heights from their spot (compact: a tight grid)

const $$ = (root, sel) => [...root.querySelectorAll(sel)];
const homeParts = (view) => ({
  plate: view.querySelector('.nameplate'),
  cards: $$(view, '.topic-card'),
  footer: $$(view, '.connect'),
});
const detailParts = (view) => ({
  article: view.querySelector('.topic'),
  player: view.querySelector('.player'),
  subtitle: view.querySelector('.subtitle'),
  // the soft column behind the content travels with the panels, so it never shows on an empty
  // stage (nor jumps sides while the avatar is off stage)
  wash: document.querySelector('.wash--detail'),
});

// Offset (px) from a card's spot toward a screen point, as --slide/--rise values.
function toward(card, point, share = PULL) {
  const r = card.getBoundingClientRect();
  let dx = (point.x - (r.left + r.width / 2)) * share * M;
  let dy = (point.y - (r.top + r.height / 2)) * share * M;
  const d = Math.hypot(dx, dy);
  const max = PULL_MAX * r.height;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
  }
  return { '--slide': `${dx.toFixed(1)}px`, '--rise': `${dy.toFixed(1)}px` };
}

export function play(tl) {
  return reduceMotion ? tl.timeScale(3) : tl;
}

export function setView(view, on) {
  view.classList.toggle('is-active', on);
  view.inert = !on;
}

// First visit: the page's frame arrives while the avatar walks in. The header drops in (brand,
// links, actions), the topic trail and, on home, the footer rise; home opens now with the name
// plate and the cards held back for homeIn, once the avatar stands on its mark.
export function frameIn(view, { home }) {
  const bar = document.querySelector('.topbar');
  const actions = $$(bar, '.topbar__actions > *');
  const top = [bar.querySelector('.wordmark'), ...$$(bar, '.mainnav li'), ...actions];
  const { plate, cards } = homeParts(view);
  const bottom = [document.querySelector('.trail'), ...(home ? $$(view, '.connect__label, .connect__divider, .connect__links > li') : [])];
  if (home) {
    setView(view, true);
    gsap.set([plate, ...cards], { autoAlpha: 0 });
  }
  gsap.set(actions, { transition: 'none' });   // their :active press transitions transform
  const tl = gsap.timeline({ defaults: { ...ARRIVE, duration: 0.7 }, delay: 0.35 })
    .fromTo(top, { autoAlpha: 0, y: -20 * M }, { autoAlpha: 1, y: 0, stagger: 0.05, clearProps: CLEAR }, 0)
    // the underline keeps its own x (placeMarkers), so it only fades
    .fromTo(bar.querySelector('.nav-indicator'), { autoAlpha: 0 }, { autoAlpha: 1, clearProps: 'opacity,visibility' }, 0.3);
  return tl.fromTo(bottom, { autoAlpha: 0, y: 18 * M }, { autoAlpha: 1, y: 0, stagger: 0.05, clearProps: CLEAR }, 0.2);
}

// Home (state 01): the name plate rises from the podium, then the cards come out of the avatar
// (`origin()`, a screen point) one by one in reading order, and settle on their spots.
// The intro (once a visit) takes its time; coming back from a topic is quicker.
export function homeIn(view, origin, { footer = true, intro = false } = {}) {
  const { plate, cards, footer: foot } = homeParts(view);
  gsap.set(cards, { clearProps: '--slide,--rise,--grow' });   // measure the spots, not where homeOut left them
  const from = cards.map((c) => toward(c, origin()));
  const tl = gsap.timeline({ defaults: ARRIVE, onStart: () => setView(view, true) })
    .fromTo(plate, { autoAlpha: 0, '--rise': `${10 * M}px` }, { autoAlpha: 1, '--rise': '0px', clearProps: CLEAR_VARS }, 0)
    .fromTo(cards, { autoAlpha: 0, '--slide': (i) => from[i]['--slide'], '--rise': (i) => from[i]['--rise'], '--grow': 1 - 0.1 * M },
      { autoAlpha: 1, '--slide': '0px', '--rise': '0px', '--grow': 1, duration: intro ? 0.8 : 0.5, stagger: intro ? 0.08 : 0.06, clearProps: CLEAR_VARS },
      intro ? 0.2 : 0.08);
  if (footer) tl.fromTo(foot, { autoAlpha: 0, y: 8 * M }, { autoAlpha: 1, y: 0, duration: 0.5, clearProps: CLEAR }, 0.3);
  return tl;
}

// After the intro: the mouse at the end of the trail bobs twice, then rests.
export function nudgeScroll() {
  const icon = document.querySelector('.trail__hint');
  const tl = gsap.timeline({ onComplete: () => gsap.set(icon, { clearProps: 'transform' }) });
  return reduceMotion ? tl : tl.to(icon, { y: 4, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 3 });
}

// Home leaves as the camera starts to move: the cards draw back into the avatar, quicker than they came.
// It leaves its end state inline (homeIn resets it), so the zoom can be played backwards (main.js).
export function homeOut(view, origin) {
  const { plate, cards, footer } = homeParts(view);
  const to = cards.map((c) => toward(c, origin(), PULL / 2));
  view.inert = true;
  return gsap.timeline({ defaults: LEAVE, onComplete: () => setView(view, false) })
    .to(cards, { autoAlpha: 0, '--slide': (i) => to[i]['--slide'], '--rise': (i) => to[i]['--rise'], '--grow': 1 - 0.06 * M, stagger: 0.04 }, 0)
    .to([plate, ...footer], { autoAlpha: 0, duration: 0.22 }, 0);
}

// Cards drift a few px against the cursor (nx, ny: -1…1, y up); each card's CSS --depth sets how far.
// Written on each card: --px/--py are registered as non-inherited, so the card's children never restyle.
// The card's transform rounds the drift to whole pixels, so --px/--py are written already snapped to
// one (x · depth whole) and only when a card's pixel changes: a handful of style recalcs per sweep
// instead of one per frame, and the same motion.
export function cardParallax(cards) {
  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const p = { x: 0, y: 0 };
  const at = cards.map((c) => ({ depth: parseFloat(getComputedStyle(c).getPropertyValue('--depth')) || 5, x: 0, y: 0 }));
  let queued = false;
  const write = () => {
    queued = false;
    cards.forEach((c, i) => {
      const a = at[i];
      const x = Math.round(p.x * a.depth), y = Math.round(p.y * a.depth);
      if (x !== a.x) c.style.setProperty('--px', (x / a.depth).toFixed(4));
      if (y !== a.y) c.style.setProperty('--py', (y / a.depth).toFixed(4));
      a.x = x;
      a.y = y;
    });
  };
  // both tweens update on the same tick: one write after them
  const queue = () => {
    if (queued) return;
    queued = true;
    gsap.ticker.add(write, true);
  };
  const toX = gsap.quickTo(p, 'x', { duration: 0.9, ease: 'power3.out', onUpdate: queue });
  const toY = gsap.quickTo(p, 'y', { duration: 0.9, ease: 'power3.out', onUpdate: queue });
  return (nx, ny) => {
    toX(-nx);
    toY(ny);
  };
}

// The current-item markers slide to the item marked aria-current: the header dot and the
// trail's dot (both x). `instant` places them without motion (load, resize).
export function placeMarkers({ instant = false } = {}) {
  const slide = (el, x) => gsap.to(el, { x, duration: instant || reduceMotion ? 0 : 0.3, ease: 'ui-out', overwrite: 'auto' });
  const centre = (box, item, marker) =>
    item.getBoundingClientRect().left - box.getBoundingClientRect().left + (item.offsetWidth - marker.offsetWidth) / 2;

  const nav = document.querySelector('.mainnav');
  const link = nav.querySelector('.nav-link[aria-current]');
  const navDot = nav.querySelector('.nav-indicator');
  if (link) slide(navDot, centre(nav, link, navDot));

  const trail = document.querySelector('.trail');
  const dot = trail.querySelector('.trail__dot[aria-current]');
  const mark = trail.querySelector('.trail__marker');
  if (dot) slide(mark, centre(trail, dot, mark));
}

// Topic content and player. Shared by the zoom-in and by topic-to-topic switches
// (`quick`: a switch already waits for the avatar's walk, the panels shouldn't add to it).
// The subtitle isn't here: it comes up with the first spoken words (subtitle.js).
export function panelsIn(view, { quick = false } = {}) {
  const { article, player, wash } = detailParts(view);
  const tl = gsap.timeline({ defaults: { ...ARRIVE, duration: quick ? 0.4 : 0.6 } })
    .set(article, { clearProps: CLEAR }, 0)
    .to(wash, { autoAlpha: 1 }, 0)
    .fromTo(article.children, { autoAlpha: 0, y: 18 * M }, { autoAlpha: 1, y: 0, stagger: 0.06, clearProps: CLEAR }, 0)
    .fromTo(player, { autoAlpha: 0, y: 16 * M }, { autoAlpha: 1, y: 0, clearProps: CLEAR }, 0.22);
  // Skills: the memos are taped on one by one, each swinging in from its tape, and written out a
  // beat apart (writeMemo). Reduced motion: the skills just fade in.
  const memos = $$(article, '.memo');
  if (memos.length) {
    const at = quick ? 0.1 : 0.18;
    tl.fromTo(memos, { autoAlpha: 0, y: -12 * M, rotation: (i) => (i % 2 ? 4 : -4) * M },
      { autoAlpha: 1, y: 0, rotation: 0, stagger: 0.08, clearProps: CLEAR }, at);
    if (M) memos.forEach((memo, k) => tl.add(writeMemo(memo, quick ? 0.7 : 1), at + 0.3 + k * 0.15));
    else tl.fromTo($$(article, '.memo__item'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.025, clearProps: CLEAR }, at + 0.12);
  }
  // Journey: the map is taped on (it swings in from its tape, like a memo), then the dotted trail
  // draws down it and each stop arrives as the trail reaches it: its badge pops, its text slides in
  const map = article.querySelector('.route__map');
  if (map) {
    const at = quick ? 0.1 : 0.18;
    const stops = $$(map, '.route-stop');
    const draw = 0.15 * stops.length;          // s for the whole trail, drawn at an even pace
    const from = at + 0.15;
    tl.fromTo(map, { autoAlpha: 0, y: -12 * M, rotation: -4 * M }, { autoAlpha: 1, y: 0, rotation: 0, clearProps: CLEAR }, at);
    if (M) {
      tl.fromTo(map.querySelector('.route__path:not(.route__path--done)'), { clipPath: 'inset(0% 0% 100% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: draw, ease: 'none', clearProps: 'clipPath' }, from);
    }
    stops.forEach((stop, i) => {
      const reached = from + (draw * (i + 0.5)) / stops.length;
      tl.fromTo(stop.querySelector('.route-stop__badge'), { autoAlpha: 0, scale: 1 - 0.15 * M },
        { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)', clearProps: CLEAR }, reached)
        .fromTo(stop.querySelector('.route-stop__text'), { autoAlpha: 0, x: -8 * M },
          { autoAlpha: 1, x: 0, duration: 0.4, clearProps: CLEAR }, reached + 0.04);
    });
  }
  const deck = article.querySelector('.certs__deck');
  if (deck) tl.call(fanCerts, [deck], quick ? 0.15 : 0.3);
  const card = article.querySelector('.idcard');
  if (card?.lanyard) tl.call(() => card.lanyard.drop(), null, 0.05);   // About: the card drops onto its strap (lanyard.js)
  return tl;
}

// A Skills memo written out, as if just now (ui.js renderStack): the group's name inks in from the
// left and its hand-drawn underline is drawn, then each skill in turn, its logo stamped on and its
// name inking in beside it. The ink's edge is soft (a mask fading over INK_EDGE px), so it reads as
// ink soaking into the paper rather than a wipe; a word takes as long as its letters.
// `pace` < 1 is quicker.
const INK_PER_CHAR = 0.035;   // s per letter
const INK_EDGE = 14;          // px
const STROKE = 0.3;           // s for the underline

// share p of el inked in ('' once whole, handing it back to its CSS)
function inkTo(el, p) {
  const at = (p * 100).toFixed(1);
  const mask = p >= 1 ? '' : `linear-gradient(90deg, #000 calc(${at}% + ${((p - 1) * INK_EDGE).toFixed(1)}px), transparent calc(${at}% + ${(p * INK_EDGE).toFixed(1)}px))`;
  el.style.maskImage = mask;
  el.style.webkitMaskImage = mask;
}

function writeMemo(memo, pace = 1) {
  const path = memo.querySelector('.memo__scribble path');
  const tl = gsap.timeline();
  // hidden from the start, before the tweens that reveal it begin
  const ink = (el, position) => {
    inkTo(el, 0);
    const pen = { p: 0 };
    tl.to(pen, {
      p: 1,
      duration: gsap.utils.clamp(0.15, 0.5, el.textContent.length * INK_PER_CHAR) * pace,
      ease: 'sine.inOut',
      onUpdate: () => inkTo(el, pen.p),
      onComplete: () => inkTo(el, 1),
    }, position);
  };

  gsap.set(path, { strokeDashoffset: 1 });
  // the underline once the name is whole (the name's mask would hide it, as it hangs below the name)
  ink(memo.querySelector('.memo__ink'));
  tl.to(path, { strokeDashoffset: 0, duration: STROKE * pace, ease: 'sine.inOut', clearProps: 'strokeDashoffset' });
  for (const item of $$(memo, '.memo__item')) {
    const icon = item.querySelector('.memo__icon');
    gsap.set(icon, { autoAlpha: 0 });
    tl.fromTo(icon, { autoAlpha: 0, scale: 0.85 },
      { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)', clearProps: CLEAR, immediateRender: false }, '-=0.08');
    ink(item.querySelector('.memo__label'), '<0.08');
  }
  return tl;
}

// The certificate deck fans out of its stack (CSS transitions on each card's data-slot, staggered
// by --i while it's .is-fanning). Also used when the deck is rebuilt on a visible page (language switch).
export function fanCerts(deck) {
  if (!deck || deck.classList.contains('is-fanned')) return;
  deck.classList.add('is-fanned', 'is-fanning');
  setTimeout(() => deck.classList.remove('is-fanning'), 700);
}

// A small icon pops, the same pop as a home card's icon chip, landing with a little bounce: a Skills
// logo as its name is spoken (ui.js renderStack) or comes under the cursor (hover.js), the Journey
// traveller as it reaches a stop (traveler.js). A new pop mid-pop retargets.
// Reduced motion: no pop; the CSS marks (a said skill, the active stop) stay.
export function popIcon(icon, delay = 0) {
  if (!M) return;
  gsap.timeline({ delay, defaults: { overwrite: 'auto' } })
    .to(icon, { scale: 1.18, rotation: -10, duration: 0.18, ease: 'power2.out' })
    .to(icon, { scale: 1, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' });
}

// Full certificate (ui.js): the scan grows out of its card (FLIP: it starts at the card's box and
// scales up to its own), the scrim fades in, the caption follows. Reduced motion: a fade.
// `rest`: the scan's box with no transform on the figure; `box`: the card it grows from / goes back to.
function flipFrom(img, rest, box) {
  if (!box || !M || !rest?.width) return null;
  const from = box.getBoundingClientRect();
  return {
    x: from.left + from.width / 2 - (rest.left + rest.width / 2),
    y: from.top + from.height / 2 - (rest.top + rest.height / 2),
    scale: from.width / rest.width,
    transformOrigin: `${img.offsetLeft + img.offsetWidth / 2}px ${img.offsetTop + img.offsetHeight / 2}px`,
  };
}

// `v` is ui.js's viewer; v.rest is kept so a close (even mid-open) measures nothing that's moving.
export function viewerIn(v, cardBox) {
  const { fig, img, scrim, caption } = v;
  gsap.set(fig, { clearProps: 'transform' });
  v.rest = img.getBoundingClientRect();
  const from = flipFrom(img, v.rest, cardBox);
  return gsap.timeline({ defaults: { ease: 'ui-out', overwrite: 'auto' } })
    .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0)
    .fromTo(fig, from ? { ...from, autoAlpha: 1 } : { autoAlpha: 0, scale: 0.98 },
      { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.42 }, 0)
    .fromTo(caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.26);
}

// Back into its card (wherever that card sits now), quicker than it came; `done` closes the dialog.
export function viewerOut(v, cardBox, done) {
  const { fig, img, scrim, caption } = v;
  const to = flipFrom(img, v.rest, cardBox);
  return gsap.timeline({
    defaults: { ease: 'ui-out', overwrite: 'auto' },
    onComplete: () => {
      done();
      gsap.set([fig, scrim, caption], { clearProps: 'all' });
    },
  })
    .to(caption, { autoAlpha: 0, duration: 0.12 }, 0)
    .to(fig, to ? { ...to, duration: 0.3 } : { autoAlpha: 0, scale: 0.98, duration: 0.2 }, 0)
    .to(scrim, { autoAlpha: 0, duration: 0.24 }, 0.04);
}

// Clears the panels while the avatar walks off; hidden (not just faded), so nothing is clickable.
export function panelsOut(view) {
  const { article, player, subtitle, wash } = detailParts(view);
  return gsap.timeline({ defaults: LEAVE })
    .to([article, player, subtitle, wash], { autoAlpha: 0 }, 0);
}

// Half body (state 02): the character and its content, nothing else on the stage.
export function detailIn(view) {
  return gsap.timeline({ onStart: () => setView(view, true) })
    .add(panelsIn(view), 0);
}

export function detailOut(view) {
  const { article, player, subtitle, wash } = detailParts(view);
  const all = [article, player, subtitle];
  view.inert = true;
  return gsap.timeline({
    defaults: LEAVE,
    onComplete: () => {
      setView(view, false);
      gsap.set([article, player], { clearProps: CLEAR });
      gsap.set(subtitle, { clearProps: 'transform' });   // stays hidden until its next cue
    },
  })
    .to(all, { autoAlpha: 0, y: 8 * M }, 0)
    .to(wash, { autoAlpha: 0 }, 0);
}
