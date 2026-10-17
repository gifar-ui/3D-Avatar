import { icon, wordmark } from './icons.js';
import { formatTime } from './narration.js';
import { Subtitles } from './subtitle.js';

// DOM building for the page. Copy always goes in through textContent;
// innerHTML is used only for the static icon markup from icons.js.

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

export function renderChrome({ profile, topics }) {
  document.querySelector('.wordmark').innerHTML = wordmark();

  const navItems = [{ id: null, nav: 'Home' }, ...topics];
  for (const list of [document.getElementById('mainnav-list'), document.getElementById('menu-list')]) {
    list.replaceChildren(...navItems.map((t) => h('li', {},
      h('a', { class: 'nav-link', href: topicHref(t.id), 'data-target': t.id ?? 'home', text: t.nav }))));
  }

  document.getElementById('btn-menu').innerHTML = icon('menu', 18);
  document.getElementById('greet-label').textContent = profile.greeting;

  // identity: a hidden page title + the name plate in front of the podium
  const [role, ...more] = profile.roles;
  document.getElementById('hero-title').textContent = `${profile.name} — ${profile.roles.join(' & ')}`;
  document.getElementById('nameplate').replaceChildren(
    h('span', { class: 'nameplate__name', text: profile.name }),
    h('span', { class: 'nameplate__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'nameplate__role' }, role,
      more.length ? h('span', { class: 'nameplate__more', text: ` & ${more.join(' & ')}` }) : null),
  );

  // topic cards (state 01)
  document.getElementById('topic-cards').replaceChildren(...topics.map((t) => h('li', {},
    h('a', { class: 'topic-card glass-2', href: topicHref(t.id), 'data-topic': t.id },
      h('span', { class: 'icon-chip', html: icon(t.icon, 20) }),
      h('span', { class: 'topic-card__text' },
        h('span', { class: 'topic-card__title', text: t.title }),
        h('span', { class: 'topic-card__sub', text: t.subtitle })),
      h('span', { class: 'topic-card__arrow', html: icon('arrowRight', 16, 2) })))));

  // footer
  document.getElementById('connect-links').replaceChildren(...profile.links.map((l) => h('li', {},
    h('a', { class: 'icon-btn glass-1', href: l.href, 'aria-label': l.label, ...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) },
      l.id === 'github' ? h('img', { src: '/images/logos/github.svg', alt: '', width: 20, height: 20 })
        : l.id === 'email' ? h('span', { html: icon('mail', 20) })
          : h('span', { class: 'mono-logo', text: 'in', 'aria-hidden': 'true' })))));

  // topic trail (bottom left): one dot per stop of the scroll order; names are labels and tooltips
  document.getElementById('trail-list').replaceChildren(...navItems.map((t) => h('li', {},
    h('a', { class: 'trail__dot', href: topicHref(t.id), 'data-target': t.id ?? 'home', 'aria-label': t.title ?? t.nav, title: t.title ?? t.nav }))));
  document.querySelector('.trail__hint').innerHTML = icon('mouse', 20, 1.6);

  document.getElementById('player-cc').innerHTML = '<span>CC</span>';
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
  const [lead, accent] = topic.heading;
  article.replaceChildren(...[
    h('p', { class: 'overline', text: topic.overline }),
    h('h1', { class: 'topic__title', id: 'topic-title', tabindex: '-1' }, lead, h('span', { class: 'accent', text: accent })),
    h('p', { class: 'topic__lead', text: topic.lead }),
    renderBody(topic.body),
    topic.signature ? h('p', { class: 'signature', 'aria-label': `Signature: ${profile.name}`, text: profile.name }) : null,
  ].filter(Boolean));

  // the whole narration as text, for screen readers (the subtitles on screen are hidden from them)
  document.getElementById('transcript-text').replaceChildren(...topic.transcript.map((s) => h('p', { text: s })));
}

function renderBody(body) {
  switch (body.type) {
    case 'stack':
      return h('div', { class: 'stack' }, ...body.groups.map((g) => h('section', { class: 'stack__group glass-2' },
        h('h2', { class: 'stack__name', text: g.name }),
        h('ul', { class: 'chips' }, ...g.items.map(([label, logo]) => h('li', { class: logo ? 'chip glass-1' : 'chip chip--missing' },
          logo ? h('img', { src: `/images/logos/${logo}.svg`, alt: '', width: 18, height: 18 }) : h('span', { class: 'chip__icon', html: icon('code', 18) }),
          label))))));
    case 'facts':
      return h('dl', { class: 'facts' }, ...body.items.map((f) => h('div', { class: 'facts__row glass-2' },
        h('dt', { text: f.label }), h('dd', { text: f.value }))));
    case 'links':
      return h('ul', { class: 'rows' }, ...body.items.map((p) => h('li', {},
        h('a', { class: 'row glass-2', href: p.href },
          h('span', { class: 'row__text' }, h('span', { class: 'row__title', text: p.title }), h('span', { class: 'row__meta', text: p.meta })),
          h('span', { class: 'row__arrow', html: icon('arrowRight', 16, 2) })))));
    case 'timeline':
      return h('ol', { class: 'rows timeline' }, ...body.items.map((p, i) => h('li', { class: 'row glass-2' },
        h('span', { class: 'timeline__num', text: String(i + 1).padStart(2, '0') }),
        h('span', { class: 'row__text' }, h('span', { class: 'row__title', text: p.title }), h('span', { class: 'row__meta', text: p.meta })))));
    default:
      return h('div');
  }
}

const subtitles = new Subtitles(document.getElementById('subtitle'));
const RING = 2 * Math.PI * 20;      // circumference of the player's progress ring (r = 20)

export function setSubtitles(on) {
  subtitles.setEnabled(on);
  document.getElementById('player-cc').setAttribute('aria-pressed', String(on));
}
setSubtitles(subtitles.enabled);

// Reflects the narration state in the player and the subtitles.
export function renderNarration(n) {
  const playBtn = document.getElementById('btn-play');
  const mode = n.playing ? 'pause' : 'play';
  if (playBtn.dataset.mode !== mode) {
    playBtn.dataset.mode = mode;
    playBtn.setAttribute('aria-label', n.playing ? 'Pause narration' : 'Play narration');
    document.getElementById('player-icon').innerHTML = icon(mode, 14);
  }
  const frac = n.duration ? Math.min(1, n.time / n.duration) : 0;
  const ring = document.getElementById('player-progress');
  ring.style.strokeDashoffset = (RING * (1 - frac)).toFixed(2);
  ring.style.visibility = frac > 0 ? 'visible' : 'hidden';    // a round cap would show a dot at 0
  const time = `${formatTime(n.time)} / ${formatTime(n.duration)}`;
  for (const el of document.querySelectorAll('.js-time')) if (el.textContent !== time) el.textContent = time;

  subtitles.update(n);
}

export function renderSound(muted) {
  const b = document.getElementById('btn-sound');
  b.setAttribute('aria-pressed', String(muted));
  b.setAttribute('aria-label', muted ? 'Unmute narration' : 'Mute narration');
  b.innerHTML = icon(muted ? 'volumeOff' : 'volume', 18);
}
