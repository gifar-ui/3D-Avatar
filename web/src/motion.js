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
export function cardParallax(cards) {
  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const p = { x: 0, y: 0 };
  const write = () => {
    for (const c of cards) {
      c.style.setProperty('--px', p.x.toFixed(3));
      c.style.setProperty('--py', p.y.toFixed(3));
    }
  };
  const toX = gsap.quickTo(p, 'x', { duration: 0.9, ease: 'power3.out', onUpdate: write });
  const toY = gsap.quickTo(p, 'y', { duration: 0.9, ease: 'power3.out', onUpdate: write });
  return (nx, ny) => {
    toX(-nx);
    toY(ny);
  };
}

// The current-item markers slide to the item marked aria-current: the header underline and the
// trail's dot (both x). `instant` places them without motion (load, resize).
export function placeMarkers({ instant = false } = {}) {
  const slide = (el, x) => gsap.to(el, { x, duration: instant || reduceMotion ? 0 : 0.3, ease: 'ui-out', overwrite: 'auto' });
  const centre = (box, item, marker) =>
    item.getBoundingClientRect().left - box.getBoundingClientRect().left + (item.offsetWidth - marker.offsetWidth) / 2;

  const nav = document.querySelector('.mainnav');
  const link = nav.querySelector('.nav-link[aria-current]');
  const line = nav.querySelector('.nav-indicator');
  if (link) slide(line, centre(nav, link, line));

  const trail = document.querySelector('.trail');
  const dot = trail.querySelector('.trail__dot[aria-current]');
  const mark = trail.querySelector('.trail__marker');
  if (dot) slide(mark, centre(trail, dot, mark));
}

// Topic content and player. Shared by the zoom-in and by topic-to-topic switches
// (`quick`: a switch already waits for the avatar's walk, the panels shouldn't add to it).
// The subtitle isn't here: it comes up with the first spoken words (subtitle.js).
export function panelsIn(view, { quick = false } = {}) {
  const { article, player } = detailParts(view);
  return gsap.timeline({ defaults: { ...ARRIVE, duration: quick ? 0.4 : 0.6 } })
    .set(article, { clearProps: CLEAR }, 0)
    .fromTo(article.children, { autoAlpha: 0, y: 18 * M }, { autoAlpha: 1, y: 0, stagger: 0.06, clearProps: CLEAR }, 0)
    .fromTo(player, { autoAlpha: 0, y: 16 * M }, { autoAlpha: 1, y: 0, clearProps: CLEAR }, 0.22);
}

// Clears the panels while the avatar walks off; hidden (not just faded), so nothing is clickable.
export function panelsOut(view) {
  const { article, player, subtitle } = detailParts(view);
  return gsap.timeline({ defaults: LEAVE })
    .to([article, player, subtitle], { autoAlpha: 0 }, 0);
}

// Half body (state 02): the character and its content, nothing else on the stage.
export function detailIn(view) {
  return gsap.timeline({ onStart: () => setView(view, true) })
    .add(panelsIn(view), 0);
}

export function detailOut(view) {
  const { article, player, subtitle } = detailParts(view);
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
    .to(all, { autoAlpha: 0, y: 8 * M }, 0);
}
