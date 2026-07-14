// ui.js — DOM helpers, icons, toasts, modals
// ------------------------------------------------------------

export function h(tag, props = {}, children = []) {
  // Defensive: allow h(tag, children) by shifting args when props isn't a plain object.
  if (props == null || Array.isArray(props) || props instanceof Node || typeof props === 'string' || typeof props === 'number') {
    children = props ?? []; props = {};
  }
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// tiny markdown: **bold**, paragraphs, - lists
export function mdLite(text) {
  const safe = esc(text || '');
  const blocks = safe.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    if (/^(\s*[-*]\s+)/.test(b)) {
      const items = b.split(/\n/).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
      return '<ul>' + items.map(i => `<li>${inline(i)}</li>`).join('') + '</ul>';
    }
    return `<p>${inline(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}
function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// ---- Icons (stroke) ----
const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icons = {
  pen: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  spark: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5 13.2 11 16 12l-2.8 1L12 15.5 10.8 13 8 12l2.8-1Z"/>'),
  send: P('<path d="M4 12l16-8-6 16-3-6-7-2Z"/>'),
  arrowRight: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  arrowLeft: P('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  book: P('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z"/><path d="M18 3v18"/>'),
  script: P('<path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  users: P('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>'),
  box: P('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M12 21v-9M20 7.5 12 12 4 7.5"/>'),
  palette: P('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-1 1-1.8-.6-1 .1-2.2 1.3-2.2H17a4 4 0 0 0 4-4c0-5-4-10-9-10Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
  film: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>'),
  image: P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/>'),
  wand: P('<path d="M15 4V2M15 10V8M12 6h1M17 6h1"/><path d="M4 20 14 10l1.5 1.5L5.5 21.5Z"/>'),
  refresh: P('<path d="M20 11a8 8 0 0 0-14-4.5L3 9M4 13a8 8 0 0 0 14 4.5L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>'),
  check: P('<path d="M4 12l5 5L20 6"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  more: P('<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>'),
  key: P('<circle cx="8" cy="15" r="4"/><path d="M11 12l7-7 3 3M17 8l2 2"/>'),
  home: P('<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>'),
  edit: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  play: P('<path d="M7 4v16l13-8Z"/>'),
  download: P('<path d="M12 3v12M8 11l4 4 4-4M4 21h16"/>'),
  chevron: P('<path d="M9 6l6 6-6 6"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  link: P('<path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1"/>'),
  layers: P('<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5M3 17l9 5 9-5"/>'),
  heart: P('<path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5C19 15.5 12 20 12 20Z"/>'),
  bed: P('<path d="M3 18V8M3 12h13a4 4 0 0 1 4 4v2M3 18h18M6 12V9h5v3"/>'),
  target: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  sparkles: P('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>'),
};

export function icon(name) {
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.innerHTML = icons[name] || icons.spark;
  return span.firstChild;
}

// ---- Toast ----
export function toast(msg, kind = 'info') {
  const root = document.getElementById('toast-root');
  const ic = { ok: 'check', err: 'x', info: 'spark' }[kind] || 'spark';
  const t = h('div', { class: `toast ${kind}` }, [
    h('span', { class: 'ti', html: icons[ic] }),
    h('span', { text: msg }),
  ]);
  t.querySelector('.ti').style.width = '17px';
  root.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 300); }, 2600);
}

// ---- Modal ----
export function modal({ title, body, footer, size }) {
  const root = document.getElementById('modal-root');
  const close = () => { back.style.opacity = '0'; setTimeout(() => back.remove(), 160); };
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } }, [
    h('div', { class: `modal ${size || ''}` }, [
      h('div', { class: 'mh' }, [
        h('h3', { text: title }),
        h('button', { class: 'iconbtn', onclick: close }, icon('x')),
      ]),
      h('div', { class: 'mb' }, body),
      footer && h('div', { class: 'mf' }, footer),
    ]),
  ]);
  root.appendChild(back);
  return { close, el: back };
}

export function confirmModal({ title, message, confirmText = 'Confirm', danger }) {
  return new Promise(resolve => {
    const m = modal({
      title,
      body: [h('p', { class: 'muted', style: { fontSize: '14.5px', lineHeight: '1.6' }, text: message })],
      footer: [
        h('button', { class: 'btn ghost', onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger-ghost' : 'primary'}`, onclick: () => { m.close(); resolve(true); } },
          danger ? [icon('trash'), confirmText] : confirmText),
      ],
    });
  });
}

// small dropdown menu attached to a trigger button
export function attachMenu(triggerBtn, items) {
  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.querySelector('.menu-pop');
    if (existing) { existing.remove(); return; }
    const pop = h('div', { class: 'menu-pop' }, items.map(it =>
      h('button', { class: `menu-item ${it.danger ? 'danger' : ''}`, onclick: (ev) => { ev.stopPropagation(); pop.remove(); it.onClick(); } },
        [it.icon && icon(it.icon), it.label])));
    const wrap = h('div', { class: 'menu' }, pop);
    Object.assign(wrap.style, { position: 'absolute' });
    const r = triggerBtn.getBoundingClientRect();
    wrap.style.left = (r.right - 180) + 'px';
    wrap.style.top = (r.bottom + window.scrollY + 6) + 'px';
    wrap.style.zIndex = '80';
    pop.style.position = 'static';
    document.body.appendChild(wrap);
    const off = () => { wrap.remove(); document.removeEventListener('click', off); };
    setTimeout(() => document.addEventListener('click', off), 0);
  });
}

export function spinner(brand) { return h('span', { class: `spinner ${brand ? 'brand' : ''}` }); }
