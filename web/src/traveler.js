import { gsap } from 'gsap';
import { popIcon } from './motion.js';

// Journey: the avatar's face travels the dotted trail on the map (ui.js renderTrail) to the stop the
// narration (or a click) is on, and stands there over the stop's badge. It walks the trail's own
// curve, rocking a little from side to side like the avatar's walk, and the trail it has covered
// turns solid behind it; it pops as it arrives. Reduced motion: it moves in one cut, no rock, no pop.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROCK = 5;           // deg either way while walking, one rock per stop passed

// route: the .route element; n stops, rowUnits: the trail's viewBox height per stop.
// Returns { go(i) }: i = the stop to stand on, -1 = off the map (before the first stop is reached).
export function trailTraveler(route, n, rowUnits) {
  const box = route.querySelector('.route__path:not(.route__path--done)');
  const path = box.querySelector('path');
  const done = route.querySelector('.route__path--done');
  const me = route.querySelector('.route__me');
  const face = me.firstElementChild;
  const state = { len: 0 };
  let at = -1;
  let walk = null;
  // the trail swings the same way between every pair of stops, so the stops sit evenly along it
  const lengthAt = (i) => (n > 1 ? (path.getTotalLength() / (n - 1)) * i : 0);

  // the face on the trail at state.len (viewBox units → the box's px), the covered trail clipped to it
  function place(rotation = 0) {
    const pt = path.getPointAtLength(state.len);
    const sx = box.clientWidth / 44;
    const sy = box.clientHeight / (n * rowUnits);
    gsap.set(me, { x: box.offsetLeft + pt.x * sx, y: box.offsetTop + pt.y * sy, rotation });
    done.style.clipPath = `inset(0 0 ${Math.max(0, box.clientHeight - pt.y * sy).toFixed(1)}px 0)`;
  }
  // the rows' height changes with the screen (style.css --row)
  new ResizeObserver(() => at >= 0 && !walk?.isActive() && place()).observe(box);

  return {
    go(i) {
      if (i === at) return;
      walk?.kill();
      if (i < 0) {
        at = -1;
        gsap.to(me, { autoAlpha: 0, duration: 0.24, ease: 'ui-out', overwrite: 'auto' });
        done.style.clipPath = '';
        return;
      }
      const steps = Math.abs(i - at);
      const from = at;
      at = i;
      // first appearance (the first stop, or a trail rebuilt mid-story): it is just there
      if (from < 0) {
        state.len = lengthAt(i);
        place();
        gsap.to(me, { autoAlpha: 1, duration: 0.3, ease: 'ui-out', overwrite: 'auto' });
        popIcon(face);
        return;
      }
      walk = gsap.to(state, {
        len: lengthAt(i),
        duration: reduceMotion ? 0 : Math.min(1.4, 0.45 + 0.3 * steps),
        ease: 'power2.inOut',
        onUpdate() {
          place(reduceMotion ? 0 : Math.sin(this.progress() * steps * Math.PI * 2) * ROCK);
        },
        onComplete: () => popIcon(face),
      });
    },
  };
}
