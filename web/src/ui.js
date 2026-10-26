import { icon, wordmark } from './icons.js';
import { play, popIcon, viewerIn, viewerOut } from './motion.js';
import { memoPointer } from './hover.js';
import { hangCard } from './lanyard.js';
import { trailTraveler } from './traveler.js';
import { formatTime } from './narration.js';
import { Subtitles } from './subtitle.js';

// DOM building for the page. Copy always goes in through textContent;
// innerHTML is used only for static SVG markup (icons.js, the journey trail's path).

const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'tabindex') el.setAttribute(k, v);
    else el[k] = v;
  }
  el.append(...children.filter((c) => c !== null && c !== undefined));
  return el;
};

const topicHref = (id) => (id ? `#/${id}` : '#/');

// Builds the page's fixed structure once; renderLanguage fills in (and later swaps) its text.
export function renderChrome(content) {
  const { profile, topics } = content;
  document.querySelector('.wordmark').innerHTML = wordmark();

  const navItems = [{ id: null }, ...topics];
  for (const list of [document.getElementById('mainnav-list'), document.getElementById('menu-list')]) {
    list.replaceChildren(...navItems.map((t) => h('li', {},
      h('a', { class: 'nav-link', href: topicHref(t.id), 'data-target': t.id ?? 'home' }))));
  }

  document.getElementById('btn-menu').innerHTML = icon('menu', 18);

  // topic cards (state 01)
  document.getElementById('topic-cards').replaceChildren(...topics.map((t) => h('li', {},
    h('a', { class: 'topic-card glass-2', href: topicHref(t.id), 'data-topic': t.id },
      h('span', { class: 'icon-chip', html: icon(t.icon, 20) }),
      h('span', { class: 'topic-card__text' },
        h('span', { class: 'topic-card__title' }),
        h('span', { class: 'topic-card__sub' })),
      h('span', { class: 'topic-card__arrow', html: icon('arrowRight', 16, 2) })))));

  // footer
  document.getElementById('connect-links').replaceChildren(...profile.links.map((l) => h('li', {},
    h('a', { class: 'icon-btn glass-1', href: l.href, 'aria-label': l.label, ...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) },
      l.id === 'github' ? h('img', { src: '/images/logos/github.svg', alt: '', width: 20, height: 20 })
        : l.id === 'email' ? h('span', { html: icon('mail', 20) })
          : h('span', { class: 'mono-logo', text: 'in', 'aria-hidden': 'true' })))));

  // topic trail (bottom left): one dot per stop of the scroll order; names are labels and tooltips
  document.getElementById('trail-list').replaceChildren(...navItems.map((t) => h('li', {},
    h('a', { class: 'trail__dot', href: topicHref(t.id), 'data-target': t.id ?? 'home' }))));
  document.querySelector('.trail__hint').innerHTML = icon('mouse', 20, 1.6);

  document.getElementById('player-cc').innerHTML = '<span>CC</span>';
  renderLanguage(content);
}

let ui = {};

// All the language-dependent text outside the topic panel, swapped in place (the cards and links
// keep their elements, so their motion state and focus survive a language change).
export function renderLanguage({ lang, ui: strings, profile, topics }) {
  ui = strings;
  const root = document.documentElement;
  root.lang = lang;
  document.title = ui.title;
  document.querySelector('meta[name="description"]').content = ui.description;

  const name = (id) => (id === 'home' ? ui.home : topics.find((t) => t.id === id).nav);
  for (const a of document.querySelectorAll('.nav-link')) a.textContent = name(a.dataset.target);
  for (const a of document.querySelectorAll('.trail__dot')) {
    const id = a.dataset.target;
    const label = id === 'home' ? ui.home : topics.find((t) => t.id === id).title;
    a.setAttribute('aria-label', label);
    a.title = label;
  }
  for (const t of topics) {
    const card = document.querySelector(`.topic-card[data-topic="${t.id}"]`);
    card.querySelector('.topic-card__title').textContent = t.title;
    card.querySelector('.topic-card__sub').textContent = t.subtitle;
  }

  document.querySelector('.wordmark').setAttribute('aria-label', ui.homeLink);
  document.getElementById('stage').setAttribute('aria-label', ui.stage);
  document.getElementById('btn-menu').setAttribute('aria-label', ui.openMenu);
  document.getElementById('player-cc').setAttribute('aria-label', ui.subtitles);
  document.querySelector('.connect__label').textContent = ui.connect;
  const switcher = document.getElementById('lang-switch');
  switcher.setAttribute('aria-label', ui.language);
  for (const b of switcher.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));

  // identity: a hidden page title + the name plate in front of the podium
  const [role, ...more] = profile.roles;
  document.getElementById('hero-title').textContent = `${profile.name} — ${profile.roles.join(' · ')}`;
  // name, dot and role share one baseline (the two fonts sit at different heights in their boxes)
  document.getElementById('nameplate').replaceChildren(h('span', { class: 'nameplate__line' },
    h('span', { class: 'nameplate__name', text: profile.name }),
    h('span', { class: 'nameplate__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'nameplate__role' }, role,
      more.length ? h('span', { class: 'nameplate__more', text: ` · ${more.join(' · ')}` }) : null)),
  );

  delete document.getElementById('btn-play').dataset.mode;   // renderNarration relabels it
}

export function setActiveTopic(id) {
  for (const a of document.querySelectorAll('[data-target]')) {
    const on = (a.dataset.target === (id ?? 'home'));
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

export function renderTopic(topic, profile) {
  const article = document.getElementById('topic');
  article.dataset.body = topic.body.type;         // the certificate deck widens the panel (style.css)
  follower = null;                                // renderBody sets it again for a deck or a trail
  const overline = h('p', { class: 'overline', text: topic.overline });
  const lead = h('p', { class: 'topic__lead', text: topic.lead });
  const signature = topic.signature ? h('p', { class: 'signature', 'aria-label': `Signature: ${profile.name}`, text: profile.name }) : null;
  if (topic.body.type === 'idcard') {
    // the card carries the page title (the full name); the lead comes first
    article.replaceChildren(overline, lead, renderIdCard(topic.body, profile));
  } else {
    const [title, accent] = topic.heading;
    article.replaceChildren(...[
      overline,
      h('h1', { class: 'topic__title', id: 'topic-title', tabindex: '-1' }, title, h('span', { class: 'accent', text: accent })),
      lead,
      renderBody(topic.body),
      signature,
    ].filter(Boolean));
  }

  // the whole narration as text, for screen readers (the subtitles on screen are hidden from them)
  document.getElementById('transcript-text').replaceChildren(...topic.transcript.map((s) => h('p', { text: s })));
  requestAnimationFrame(fitTopic);
}

// Marks the topic panel that runs longer than its column, which then fades at its foot (style.css).
// Again on resize and once the fonts are in (main.js).
export function fitTopic() {
  const article = document.getElementById('topic');
  article.toggleAttribute('data-overflow', article.scrollHeight > article.clientHeight + 1);
}

// About: an ID badge hanging from a lanyard (the strap and clip are decoration).
// The card hangs from the strap and swings (lanyard.js; it can be pulled with a mouse). It follows
// the narration: a swing on the hello and the welcome, and each row lights up while it's spoken of.
function renderIdCard(card, profile) {
  const rows = card.items.map((it) => h('li', { class: 'idcard__row' },
    h('span', { class: 'idcard__icon', html: icon(it.icon, 16) }),
    h('span', { class: 'idcard__text' },
      h('span', { class: 'idcard__title', text: it.title }),
      h('span', { class: 'idcard__meta', text: it.meta }))));
  const el = h('div', { class: 'idcard' },
    h('span', { class: 'idcard__strap', 'aria-hidden': 'true' }),
    h('div', { class: 'idcard__swing' },
      h('span', { class: 'idcard__clip', 'aria-hidden': 'true' }),
      h('section', { class: 'idcard__body glass-3' },
        h('div', { class: 'idcard__head' },
          h('img', { class: 'idcard__photo', src: card.photo, alt: card.photoAlt, width: 84, height: 112, draggable: false }),
          h('div', { class: 'idcard__id' },
            h('h1', { class: 'idcard__name', id: 'topic-title', tabindex: '-1', text: profile.fullName }),
            h('p', { class: 'idcard__roles', text: profile.roles[0] }))),   // the main role only
        h('ul', { class: 'idcard__rows' }, ...rows))));
  const lanyard = hangCard(el);
  el.lanyard = lanyard;                     // motion.js panelsIn drops the card in

  let line = -1;
  let side = 1;                             // swings alternate left and right
  follower = {
    follow(next) {
      if (next === line || next < 0) return;
      line = next;
      const i = card.items.findIndex((it) => it.lines?.includes(next));
      rows.forEach((r, j) => r.classList.toggle('is-active', j === i));
      if (card.swing?.includes(next)) lanyard.nudge(260 * (side = -side));
      else if (i >= 0) lanyard.nudge(110 * (side = -side));
    },
  };
  return el;
}

function renderBody(body) {
  switch (body.type) {
    case 'stack':
      return renderStack(body.groups);
    case 'facts':
      return h('dl', { class: 'facts' }, ...body.items.map((f) => h('div', { class: 'facts__row glass-2' },
        h('dt', { text: f.label }), h('dd', { text: f.value }))));
    case 'links':
      return h('ul', { class: 'rows' }, ...body.items.map((p) => h('li', {},
        // anything that isn't a #/ route (a certificate scan, a project site) opens in a new tab
        h('a', { class: 'row glass-2', href: p.href, ...(p.href.startsWith('#') ? {} : { target: '_blank', rel: 'noopener' }) },
          h('span', { class: 'row__text' }, h('span', { class: 'row__title', text: p.title }), h('span', { class: 'row__meta', text: p.meta })),
          h('span', { class: 'row__arrow', html: icon('arrowRight', 16, 2) })))));
    case 'timeline':
      return h('ol', { class: 'rows timeline' }, ...body.items.map((p, i) => h('li', { class: 'row glass-2' },
        h('span', { class: 'timeline__num', text: String(i + 1).padStart(2, '0') }),
        h('span', { class: 'row__text' }, h('span', { class: 'row__title', text: p.title }), h('span', { class: 'row__meta', text: p.meta })))));
    case 'certs':
      return renderCerts(body.items);
    case 'trail':
      return renderTrail(body);
    default:
      return h('div');
  }
}

// What follows the narration on the open topic (its ID card, memos, certificate deck or journey
// trail): { follow(line, narration) }.
let follower = null;
const SWIPE_PX = 40;

// Skills: one paper memo per group, taped to the panel (the tape and the tilt are CSS). It follows
// the narration: the memo it talks about lifts off the panel, each logo pops as its name is spoken
// and keeps a mark once said, and the closing line pops them all in turn. Pulling a memo about
// and the pop under the cursor are hover.js memoPointer; the memos are taped on and written out in
// motion.js panelsIn (writeMemo).
// A spoken word names a skill when it is the label's first word ("Node" for Node.js) or, from four
// letters on, the start of it ("Postgres" for PostgreSQL), so "I" or "a" never pops IDE or AI Agent.
const skillKey = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/u)?.[0] ?? '';
const names = (key, word) => word === key || (word.length >= 4 && key.startsWith(word));
// a slightly wavy underline, stretched to the name's width (pathLength 1: drawn by its dash offset)
const SCRIBBLE = '<svg viewBox="0 0 100 8" preserveAspectRatio="none"><path d="M2 5C18 2.5 30 6.5 48 4.5S80 3 98 5.5" pathLength="1"/></svg>';

function renderStack(groups) {
  const skills = [];   // { item, icon, key } in reading order
  // the name and each label are boxes of their own, so motion.js writeMemo can ink them in;
  // the name is underlined with a hand-drawn stroke
  const memos = groups.map((g) => h('section', { class: 'memo' },
    h('span', { class: 'memo__tape', 'aria-hidden': 'true' }),
    h('h2', { class: 'memo__name' }, h('span', { class: 'memo__ink', text: g.name },
      h('span', { class: 'memo__scribble', 'aria-hidden': 'true', html: SCRIBBLE }))),
    // an item is [label, logo file] or, without a brand logo, [label, null, icon name]
    h('ul', { class: 'memo__list' }, ...g.items.map(([label, logo, glyph = 'code']) => {
      const glyphEl = h('span', { class: 'memo__icon' }, logo
        ? h('img', { src: `/images/logos/${logo}.svg`, alt: '', width: 16, height: 16 })
        : h('span', { class: 'memo__glyph', html: icon(glyph, 15, 2) }));
      const item = h('li', { class: 'memo__item' }, glyphEl, h('span', { class: 'memo__label', text: label }));
      skills.push({ item, icon: glyphEl, key: skillKey(label) });
      return item;
    }))));
  memos.forEach(memoPointer);

  const last = Math.max(...groups.flatMap((g) => g.lines ?? []));
  let line = -1;
  let heard = 0;           // words of the narration already looked at
  follower = {
    follow(next, n) {
      // the words reached since the last frame; going back (a replay) clears the marks
      const spoken = n?.spokenWords ?? 0;
      if (spoken < heard) {
        heard = 0;
        for (const s of skills) s.item.classList.remove('is-said');
      }
      const live = spoken - heard <= 2;     // a jump (a language switch mid-play) marks without popping
      for (; heard < spoken; heard++) {
        const word = skillKey(n.words[heard].text);
        for (const s of skills) {
          if (!names(s.key, word)) continue;
          s.item.classList.add('is-said');
          if (live) popIcon(s.icon);
        }
      }

      if (next === line) return;
      line = next;
      const i = groups.findIndex((g) => g.lines?.includes(next));
      memos.forEach((m, j) => m.classList.toggle('is-active', j === i));
      if (next > last) {
        skills.forEach((s, k) => {
          s.item.classList.add('is-said');
          popIcon(s.icon, k * 0.05);
        });
      }
    },
  };
  return h('div', { class: 'memos' }, ...memos);
}

// Certificates as a fanned deck: the active card in front, the other two behind it (left, right).
// Where a card sits is its data-slot, and CSS moves it there (a transition, so rapid clicks retarget
// instead of restarting). The deck stays stacked and hidden until motion.js panelsIn fans it out.
// Side cards are for the pointer only; the pills below are the keyboard and screen reader path.
function renderCerts(items) {
  const n = items.length;
  let active = -1;
  let startX = null;
  let swiped = false;
  const title = h('span', { class: 'row__title' });
  const meta = h('span', { class: 'row__meta' });
  const cards = items.map((c, i) => h('button', {
    type: 'button',
    class: 'cert',
    'data-shape': c.width > c.height ? 'wide' : 'tall',
    style: `--i: ${i}; aspect-ratio: ${c.width} / ${c.height}`,
    onclick: () => {
      if (swiped) return;
      if (i === active) openViewer(c, cards[i]);
      else show(i);
    },
  }, h('span', { class: 'cert__lift' }, h('img', { src: c.src, alt: '', width: c.width, height: c.height, decoding: 'async', draggable: false }))));
  const pills = items.map((c, i) => h('button', { type: 'button', class: 'certs__pill', text: c.short, onclick: () => show(i) }));

  function show(i) {
    if (i === active) return;
    active = i;
    cards.forEach((card, j) => {
      const slot = j === i ? 'front' : j === (i + n - 1) % n ? 'left' : 'right';
      const front = slot === 'front';
      card.dataset.slot = slot;
      card.tabIndex = front ? 0 : -1;
      card.setAttribute('aria-hidden', String(!front));
      card.setAttribute('aria-label', front ? `${items[j].title}, ${ui.viewCertificate}` : items[j].title);
    });
    pills.forEach((p, j) => p.setAttribute('aria-pressed', String(j === i)));
    title.textContent = items[i].title;
    meta.textContent = items[i].meta;
  }

  const deck = h('div', { class: 'certs__deck' }, ...cards);
  // a horizontal drag past SWIPE_PX moves one card; the click that ends it doesn't count
  deck.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    swiped = false;
  });
  deck.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    swiped = true;
    show((active + (dx < 0 ? 1 : -1) + n) % n);
  });

  show(0);
  let line = -1;
  follower = {
    // the narration's current line brings the card it talks about to the front
    follow(next) {
      if (next === line) return;
      line = next;
      const i = items.findIndex((c) => c.lines?.includes(next));
      if (i >= 0) show(i);
    },
  };

  // caption under the deck, then one row for the pills and the open button: the less height
  // around the deck, the larger the scans can be
  return h('div', { class: 'certs' },
    deck,
    h('div', { class: 'certs__caption' }, h('span', { class: 'row__text' }, title, meta)),
    h('div', { class: 'certs__bar' },
      h('div', { class: 'certs__pills', role: 'group', 'aria-label': ui.chooseCertificate }, ...pills),
      h('button', { type: 'button', class: 'certs__open', onclick: () => openViewer(items[active], cards[active]) },
        h('span', { text: ui.viewCertificate }), h('span', { class: 'certs__open-icon', html: icon('arrowRight', 14, 2) }))));
}

// Journey: the stops on a dotted trail down a paper map, oldest at the top. Each stop is
// is-done, is-active or is-next against the one the narration (or a click) is on; before the
// first stop is reached all are is-next, after the last all are is-done. The avatar's face walks
// the trail to the active stop and stays on the last one at the end (traveler.js).
const TRAIL_ROW = 60;    // the trail's viewBox height per stop; CSS sets the rows' real height

function trailPath(n) {
  let d = `M22 ${TRAIL_ROW / 2}`;
  for (let i = 1; i < n; i++) {
    const y = TRAIL_ROW / 2 + (i - 1) * TRAIL_ROW;
    const s = i % 2 ? 12 : -12;     // swing left and right so it reads as a path, not a rule
    d += ` C ${22 + s} ${y + 20}, ${22 - s} ${y + 40}, 22 ${y + TRAIL_ROW}`;
  }
  return d;
}

function renderTrail({ items, traveler }) {
  const n = items.length;
  const stops = items.map((it, i) => h('li', { class: 'route-stop' },
    h('button', { type: 'button', class: 'route-stop__btn', onclick: () => show(i) },
      h('span', { class: 'route-stop__badge', 'aria-hidden': 'true', html: icon(it.icon, 17) }),
      h('span', { class: 'route-stop__text' },
        h('span', { class: 'route-stop__top' },
          h('span', { class: 'route-stop__title', text: it.title }),
          h('span', { class: it.now ? 'route-stop__years is-now' : 'route-stop__years', text: it.years })),
        h('span', { class: 'route-stop__meta', text: it.meta })))));

  // reached: how many stops the story has come to, 0..n; the last of them is the active one
  // the dotted trail, and the same trail solid, uncovered as the face walks it (traveler.js)
  const trail = (cls) => h('span', {
    class: cls,
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 44 ${n * TRAIL_ROW}" preserveAspectRatio="none"><path d="${trailPath(n)}" vector-effect="non-scaling-stroke"/></svg>`,
  });
  // the outer box is what motion.js slides in; the tilted paper is the inner one (as with the memos)
  const route = h('div', { class: 'route' }, h('div', { class: 'route__map' },
    h('span', { class: 'route__tape', 'aria-hidden': 'true' }),
    trail('route__path'),
    trail('route__path route__path--done'),
    h('ol', { class: 'route__stops', 'aria-label': ui.journeyStops }, ...stops),
    h('span', { class: 'route__me', 'aria-hidden': 'true' },
      h('span', { class: 'route__me-face' }, h('img', { src: traveler, alt: '', width: 40, height: 40, draggable: false })))));
  const walker = trailTraveler(route, n, TRAIL_ROW);

  // reached: how many stops the story has come to, 0..n; the last of them is the active one
  function show(i, reached = i + 1) {
    stops.forEach((s, j) => {
      s.classList.toggle('is-done', j < reached - 1 || reached > n);
      s.classList.toggle('is-active', j === i);
      s.querySelector('button').setAttribute('aria-pressed', String(j === i));
    });
    if (i >= 0) walker.go(i);
    else if (reached === 0) walker.go(-1);    // after the last stop it stays there
  }

  show(-1, 0);
  let line = -1;
  const lines = items.flatMap((it) => it.lines ?? []);
  const first = Math.min(...lines);
  const last = Math.max(...lines);
  follower = {
    // the narration's current line lights up the stop it talks about; past the last one, all are
    // done; back before the first (a replay), none are
    follow(next) {
      if (next === line) return;
      line = next;
      const i = items.findIndex((it) => it.lines?.includes(next));
      if (i >= 0) show(i);
      else if (next > last) show(-1, n + 1);
      else if (next < first) show(-1, 0);
    },
  };
  return route;
}

// One modal for the full certificate, made on first use. The scan grows out of its card and
// shrinks back into it (motion.js viewerIn/viewerOut); Escape, the scrim and the close button shut it.
let viewer = null;

function certViewer() {
  if (viewer) return viewer;
  const img = h('img', { alt: '' });
  const caption = h('figcaption', { class: 'cert-viewer__caption' });
  const fig = h('figure', { class: 'cert-viewer__fig' }, img, caption);
  const scrim = h('div', { class: 'cert-viewer__scrim' });
  const close = h('button', { type: 'button', class: 'icon-btn glass-1 cert-viewer__close', html: icon('close', 18) });
  const dialog = h('dialog', { class: 'cert-viewer' }, scrim, fig, close);
  scrim.onclick = closeViewer;
  close.onclick = closeViewer;
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeViewer();
  });
  dialog.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });   // no topic stepping behind it
  document.body.append(dialog);
  viewer = { dialog, img, caption, fig, scrim, close, card: null, tl: null };
  return viewer;
}

async function openViewer(item, card) {
  const v = certViewer();
  if (v.dialog.open) return;
  v.img.src = item.src;
  v.img.alt = item.alt;
  v.caption.textContent = `${item.title} · ${item.meta}`;
  v.close.setAttribute('aria-label', ui.closeCertificate);
  v.dialog.setAttribute('aria-label', item.title);
  v.card = card;
  try { await v.img.decode(); } catch { /* measured as it is */ }
  v.dialog.showModal();
  v.tl?.kill();
  v.tl = play(viewerIn(v, card.querySelector('.cert__lift')));
}

function closeViewer() {
  const v = viewer;
  if (!v?.dialog.open || v.closing) return;
  v.closing = true;
  v.tl?.kill();
  const lift = v.card?.isConnected ? v.card.querySelector('.cert__lift') : null;
  v.tl = play(viewerOut(v, lift, () => {
    v.closing = false;
    v.dialog.close();
  }));
}

const subtitles = new Subtitles(document.getElementById('subtitle'));
const RING = 2 * Math.PI * 20;      // circumference of the player's progress ring (r = 20)
const RING_HZ = 12;                 // ring steps per second: each step repaints the page, and 12 read as smooth

export function setSubtitles(on) {
  subtitles.setEnabled(on);
  document.getElementById('player-cc').setAttribute('aria-pressed', String(on));
}
setSubtitles(subtitles.enabled);

// Reflects the narration state in the player and the subtitles.
// Runs every frame while the narration plays, so the DOM is only touched when what it shows changes.
const player = { els: null, offset: '', time: '' };

export function renderNarration(n) {
  player.els ??= {
    play: document.getElementById('btn-play'),
    icon: document.getElementById('player-icon'),
    ring: document.getElementById('player-progress'),
    times: [...document.querySelectorAll('.js-time')],
  };
  const { play, icon: playIcon, ring, times } = player.els;
  const mode = n.playing ? 'pause' : 'play';
  if (play.dataset.mode !== mode) {
    play.dataset.mode = mode;
    play.setAttribute('aria-label', n.playing ? ui.pause : ui.play);
    playIcon.innerHTML = icon(mode, 14);
  }
  const t = n.time >= n.duration ? n.duration : Math.floor(n.time * RING_HZ) / RING_HZ;
  const frac = n.duration ? Math.min(1, t / n.duration) : 0;
  const offset = (RING * (1 - frac)).toFixed(2);
  if (offset !== player.offset) {
    player.offset = offset;
    ring.style.strokeDashoffset = offset;
    ring.style.visibility = frac > 0 ? 'visible' : 'hidden';    // a round cap would show a dot at 0
  }
  const time = `${formatTime(n.time)} / ${formatTime(n.duration)}`;
  if (time !== player.time) {
    player.time = time;
    for (const el of times) el.textContent = time;
  }

  subtitles.update(n);
  follower?.follow(n.current, n);
}

export function renderSound(muted) {
  const b = document.getElementById('btn-sound');
  b.setAttribute('aria-pressed', String(muted));
  b.setAttribute('aria-label', muted ? ui.unmute : ui.mute);
  b.innerHTML = icon(muted ? 'volumeOff' : 'volume', 18);
}
