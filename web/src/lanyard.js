import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

// The About ID card hangs from its lanyard: a small 2D physics loop on GSAP's ticker.
// The lanyard is a long, slightly stretchy band from a pin far above the panel (only its lower end
// shows, fading upward) down to the card's clip; the card swings with it and turns with the band.
// Grab the card and pull it (Draggable, mouse and trackpad), let go and it swings back until it
// settles; then the loop stops. Reduced motion: the card just hangs still.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const BAND = 260;         // px from the pin down to the clip at rest: the swing's radius
const GRAVITY = 2600;     // px/s²
const STIFF = 900;        // the band's stretch (1/s²): higher is a stiffer band
const AIR = 2.2;          // damping of the swing (1/s): lower swings longer
const STRETCH_DAMP = 60;  // damping along the band (≈ critical), so a catch doesn't bounce back up
const TURN = 220;         // how hard the card turns toward the band's angle (1/s²)
const TURN_DAMP = 16;     // and how quickly that turn settles (1/s)
const LEAN = 0.85;        // the card turns this share of the band's angle…
const MAX_TURN = 22;      // …up to this many degrees either way
const REACH = 130;        // px a pull can stretch the band beyond its rest length
const DEG = 180 / Math.PI;

const STILL = { drop() {}, nudge() {} };

// card: the .idcard element (ui.js renderIdCard). Returns { drop(), nudge(px/s) }.
export function hangCard(card) {
  if (reduceMotion) return STILL;
  const strap = card.querySelector('.idcard__strap');
  const swing = card.querySelector('.idcard__swing');

  // Positions are the clip's, relative to the pin; at rest it hangs BAND straight below it
  const L = BAND;
  const rest = L - GRAVITY / STIFF;   // the band's unstretched length: the card's weight stretches it to L
  const p = { x: 0, y: L };
  const v = { x: 0, y: 0 };
  let turn = 0;           // card rotation, deg
  let spin = 0;           // deg/s
  let held = null;        // while dragged: { x, y } where the pull puts the clip
  let running = false;

  // the visible end of the band rides with the clip, turned to the band's angle (it pivots at its
  // lower end, style.css) and stretched by as much as the band is: its top stays put, so a pull
  // lengthens it, and it thins a little as it does. The card swings from the clip
  let shown = 0;          // px of the band showing at rest, from its faded top to the pivot
  function render() {
    if (shown <= 0) shown = strap.offsetHeight - 6;  // read once it's laid out (the pivot is 6px up)
    const d = Math.hypot(p.x, p.y);
    const lean = Math.atan2(p.x, p.y) * DEG;     // the band's angle from hanging straight down
    const long = Math.max(0.4, (shown + d - L) / shown);
    const thin = gsap.utils.clamp(0.72, 1, 1 - ((d - L) / REACH) * 0.28);
    const at = `translate(${p.x.toFixed(2)}px, ${(p.y - L).toFixed(2)}px)`;
    strap.style.transform = `${at} rotate(${(-lean).toFixed(2)}deg) scale(${thin.toFixed(3)}, ${(shown > 0 ? long : 1).toFixed(3)})`;
    swing.style.transform = `${at} rotate(${turn.toFixed(2)}deg)`;
  }

  function step(dt) {
    if (held) {
      // follow the pull; the velocity it leaves with is the pull's own
      const vx = (held.x - p.x) / dt;
      const vy = (held.y - p.y) / dt;
      v.x = v.x * 0.6 + vx * 0.4;
      v.y = v.y * 0.6 + vy * 0.4;
      p.x = held.x;
      p.y = held.y;
    } else {
      let ax = 0;
      let ay = GRAVITY;
      const d = Math.hypot(p.x, p.y) || 1;
      const nx = p.x / d;
      const ny = p.y / d;
      if (d > rest) {                       // a strap only pulls when it's taut
        ax -= STIFF * (d - rest) * nx;
        ay -= STIFF * (d - rest) * ny;
        const along = v.x * nx + v.y * ny;
        const k = 1 - Math.exp(-STRETCH_DAMP * dt);
        v.x -= nx * along * k;
        v.y -= ny * along * k;
      }
      v.x += ax * dt;
      v.y += ay * dt;
      const air = Math.exp(-AIR * dt);
      v.x *= air;
      v.y *= air;
      p.x += v.x * dt;
      p.y += v.y * dt;
    }
    // the card turns with the band, lagging a little; while pulled it also leans into the motion
    const lean = Math.atan2(p.x, p.y) * DEG;
    const target = gsap.utils.clamp(-MAX_TURN, MAX_TURN, -lean * LEAN - (held ? v.x * 0.01 : 0));
    spin += (-TURN * (turn - target) - TURN_DAMP * spin) * dt;
    turn += spin * dt;
  }

  const settled = () => !held && Math.abs(v.x) + Math.abs(v.y) < 3 && Math.abs(spin) < 1.5
    && Math.abs(p.x) < 0.3 && Math.abs(p.y - L) < 0.4 && Math.abs(turn) < 0.08;

  function tick() {
    if (!card.isConnected) return sleep();      // the topic changed: this card is gone
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 1 / 30);
    step(dt);
    if (settled()) {
      p.x = 0; p.y = L; v.x = v.y = 0; turn = spin = 0;
      render();
      return sleep();
    }
    render();
  }
  function wake() {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  }
  function sleep() {
    running = false;
    gsap.ticker.remove(tick);
  }

  // Drag: a hidden proxy carries Draggable's numbers; the card itself is only ever moved by render()
  if (finePointer) {
    const proxy = document.createElement('div');
    proxy.className = 'idcard__proxy';
    card.append(proxy);
    let from = null;
    Draggable.create(proxy, {
      trigger: swing,
      type: 'x,y',
      minimumMovement: 2,
      cursor: 'grab',
      activeCursor: 'grabbing',
      onPress() {
        from = { x: p.x, y: p.y };
        gsap.set(proxy, { x: 0, y: 0 });
        this.update();
      },
      onDragStart() {
        held = { x: p.x, y: p.y };
        wake();
      },
      onDrag() {
        let x = from.x + this.x;
        let y = from.y + this.y;
        const d = Math.hypot(x, y);
        const max = L + REACH;
        if (d > max) { x *= max / d; y *= max / d; }
        held = { x, y: Math.max(y, L * 0.4) };
      },
      onRelease() {
        held = null;
        wake();
      },
    });
  }

  return {
    // the card falls in from above and the strap catches it (the panel's entrance, motion.js)
    drop() {
      shown = 0;                            // re-read: the strap is shorter on short screens
      p.x = 34;
      p.y = L - 70;
      v.x = v.y = 0;
      turn = -6;
      spin = 0;
      render();
      wake();
    },
    // a push sideways, px/s: the narration's beats (ui.js)
    nudge(speed) {
      if (held) return;
      v.x += speed;
      wake();
    },
  };
}
