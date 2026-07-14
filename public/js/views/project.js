// views/project.js — the project workspace: Story, Script, Characters, Assets,
// Style, Storyboard. This is where an idea becomes a film.
import { h, icon, icons, toast, spinner, modal, confirmModal } from '../ui.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { go } from '../router.js';

let current = null;
let host = null;
let activeTab = 'story';

const TABS = [
  { key: 'story', label: 'Story', icon: 'book' },
  { key: 'script', label: 'Script', icon: 'script' },
  { key: 'characters', label: 'Characters', icon: 'users' },
  { key: 'assets', label: 'Assets', icon: 'box' },
  { key: 'style', label: 'Style Refs', icon: 'palette' },
  { key: 'storyboard', label: 'Storyboard', icon: 'film' },
];

export async function renderProject(root, id, tab) {
  host = root;
  root.innerHTML = '<div class="wrap" style="padding:60px 0"><div class="skeleton" style="height:40px;width:280px"></div></div>';
  try { current = await api.getProject(id); } catch { current = null; }
  if (!current) { toast('Project not found', 'err'); go('/'); return; }
  ensureShape(current);
  activeTab = TABS.some(t => t.key === tab) ? tab : 'story';
  paint();
}

function ensureShape(p) {
  p.characters ||= []; p.assets ||= []; p.styleRefs ||= []; p.scenes ||= []; p.meta ||= {};
  p.characters.forEach(c => { c.refs ||= []; c.assetIds ||= []; });
}

function setTab(t) { activeTab = t; history.replaceState(null, '', `#/project/${current.id}/${t}`); paint(); }

async function persist() { try { const saved = await api.saveProject(current); saved && (current.updatedAt = saved.updatedAt); } catch (e) { toast('Save failed: ' + e.message, 'err'); } }

function paint() {
  host.innerHTML = '';
  host.appendChild(h('div', { class: 'workspace' }, [sidebar(), h('div', { class: `ws-main ${activeTab === 'storyboard' ? 'wide' : ''}` }, tabContent())]));
}

/* ---------------- sidebar ---------------- */
function sidebar() {
  return h('div', { class: 'ws-side' }, [
    h('button', { class: 'btn ghost sm', style: { paddingLeft: 0, marginBottom: '18px' }, onclick: () => go('/') }, [icon('arrowLeft'), 'All projects']),
    h('div', { class: 'proj-title' }, current.title),
    current.logline && h('div', { class: 'proj-logline' }, current.logline),
    h('div', { class: 'row gap-6', style: { flexWrap: 'wrap', marginTop: '12px' } }, [
      current.meta?.runtime && h('span', { class: 'pill' }, current.meta.runtime),
      current.meta?.genre && h('span', { class: 'pill pink' }, current.meta.genre),
    ]),
    h('div', { class: 'ws-tabs' }, TABS.map(t => {
      const badge = counts()[t.key];
      return h('button', { class: `ws-tab ${activeTab === t.key ? 'active' : ''}`, onclick: () => setTab(t.key) }, [
        icon(t.icon), h('span', { class: 'grow' }, t.label),
        badge ? h('span', { class: 'badge' }, badge) : null,
      ]);
    })),
    h('div', { style: { marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line-soft)' } },
      h('div', { class: 'tag-inline', style: { lineHeight: 1.5 } }, [
        state.status.fal ? '● fal.ai connected' : '○ mock generation',
        h('br'),
        state.status.llm ? '● AI director live' : '○ mock director',
      ])),
  ]);
}
function counts() {
  return {
    characters: current.characters.length || '',
    assets: current.assets.length || '',
    style: current.styleRefs.length || '',
    storyboard: current.scenes.length || '',
    script: current.script ? '✓' : '',
    story: '',
  };
}

/* ---------------- tab dispatch ---------------- */
function tabContent() {
  switch (activeTab) {
    case 'story': return storyTab();
    case 'script': return scriptTab();
    case 'characters': return charactersTab();
    case 'assets': return assetsTab();
    case 'style': return styleTab();
    case 'storyboard': return storyboardTab();
  }
}

function head(k, title, desc) {
  return h('div', { class: 'tab-head' }, [h('div', { class: 'k' }, k), h('h1', title), desc && h('p', desc)]);
}

/* busy helper */
async function withBtn(btn, label, fn) {
  const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '';
  btn.appendChild(spinner()); btn.appendChild(document.createTextNode(' ' + label));
  try { return await fn(); } catch (e) { toast(e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}

/* ================= STORY ================= */
function storyTab() {
  const wrap = h('div', {});
  const ta = h('textarea', { spellcheck: 'false' }, current.story || '');
  ta.value = current.story || '';
  ta.addEventListener('blur', () => { if (ta.value !== current.story) { current.story = ta.value; persist(); } });

  const fb = h('input', { class: 'feedback-input', placeholder: 'Tell the AI how to develop it — “darken the second half”, “add a betrayal”, “make the mom unhinged”…' });
  const enhanceBtn = h('button', { class: 'btn primary' }, [icon('wand'), 'Enhance']);
  enhanceBtn.onclick = () => withBtn(enhanceBtn, 'Writing…', async () => {
    current.story = ta.value;
    current = await api.enhanceStory(current, fb.value.trim());
    fb.value = ''; paint(); toast('Story enhanced', 'ok');
  });

  wrap.append(
    head('Premise', 'Story', 'Your two-paragraph premise — the spine of the film. Edit it directly, or hand the AI a note and iterate until it sings.'),
    h('div', { class: 'editor' }, [
      h('div', { class: 'eh' }, [h('div', { class: 't' }, [icon('book'), 'Premise']), h('span', { class: 'tag-inline' }, 'auto-saves')]),
      ta,
    ]),
    h('div', { class: 'feedback-bar' }, [fb, enhanceBtn]),
    metaEditor(),
  );
  return wrap;
}

function metaEditor() {
  const fields = [['runtime', 'Runtime'], ['genre', 'Genre'], ['style', 'Visual style'], ['setting', 'Setting']];
  const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginTop: '16px' } },
    fields.map(([k, label]) => {
      const inp = h('input', { class: 'input', value: current.meta[k] || '', placeholder: label });
      inp.addEventListener('blur', () => { if (inp.value !== current.meta[k]) { current.meta[k] = inp.value; persist(); } });
      return h('div', { class: 'field' }, [h('label', label), inp]);
    }));
  return h('div', {}, [h('hr', { class: 'hr' }), h('div', { class: 'tag-inline', style: { marginBottom: '10px' } }, 'PROJECT METADATA'), grid]);
}

/* ================= SCRIPT ================= */
function scriptTab() {
  const wrap = h('div', {});
  const has = !!current.script;
  const ta = h('textarea', { spellcheck: 'false' }, current.script || '');
  ta.value = current.script || '';
  ta.addEventListener('blur', () => { if (ta.value !== current.script) { current.script = ta.value; persist(); } });

  const genBtn = h('button', { class: 'btn primary' }, [icon('wand'), has ? 'Regenerate from story' : 'Generate script from story']);
  genBtn.onclick = () => withBtn(genBtn, 'Writing script…', async () => {
    current = await api.extractScript(current, null); paint(); toast('Script generated', 'ok');
  });

  const note = h('input', { class: 'feedback-input', placeholder: 'Agentic update — “add the new 7th character in act 2”, “tighten the middle”, “add a rooftop scene”…' });
  const updateBtn = h('button', { class: 'btn subtle' }, [icon('refresh'), 'Update']);
  updateBtn.onclick = () => withBtn(updateBtn, 'Revising…', async () => {
    if (!note.value.trim()) return toast('Add a note describing the change', 'info');
    current.script = ta.value;
    current = await api.extractScript(current, note.value.trim());
    note.value = ''; paint(); toast('Script updated', 'ok');
  });

  wrap.append(
    head('Screenplay', 'Script', 'Extract a shooting script from your story. It feeds character extraction and the storyboard — regenerate whenever the story changes.'),
    banner('The script, characters and storyboard form a loop. Change the story, then re-run each step — the AI carries the old version forward and applies just what changed.'),
    h('div', { class: 'row gap-10', style: { margin: '16px 0', flexWrap: 'wrap' } }, [genBtn]),
    has ? h('div', { class: 'editor script' }, [
      h('div', { class: 'eh' }, [h('div', { class: 't' }, [icon('script'), 'Screenplay']),
        h('button', { class: 'btn xs ghost', onclick: () => { navigator.clipboard?.writeText(current.script); toast('Copied', 'ok'); } }, [icon('copy'), 'Copy'])]),
      ta,
    ]) : emptyBlock('📝', 'No script yet', 'Generate one from your story to get started.'),
    has ? h('div', { class: 'feedback-bar' }, [note, updateBtn]) : null,
  );
  return wrap;
}

/* ================= CHARACTERS ================= */
function charactersTab() {
  const wrap = h('div', {});
  const extractBtn = h('button', { class: 'btn primary' }, [icon('sparkles'), current.characters.length ? 'Sync cast from script' : 'Extract cast from story']);
  extractBtn.onclick = () => withBtn(extractBtn, 'Reading…', async () => {
    current = await api.extractCharacters(current); paint(); toast('Cast updated', 'ok');
  });
  const addBtn = h('button', { class: 'btn subtle', onclick: () => openCharacter(newCharacter()) }, [icon('plus'), 'Add manually']);

  wrap.append(
    head('The Cast', 'Characters', 'Every character gets a reference directory — T-pose, emotions, repeated poses — that links into scene prompts so they stay consistent shot to shot.'),
    h('div', { class: 'row gap-10', style: { marginBottom: '20px', flexWrap: 'wrap' } }, [extractBtn, addBtn]),
    current.characters.length
      ? h('div', { class: 'grid cards3' }, current.characters.map(characterCard))
      : emptyBlock('🎭', 'No characters yet', 'Extract them from your story, or add one by hand.'),
  );
  return wrap;
}

function newCharacter() { return { id: 'char_' + Math.random().toString(36).slice(2, 9), name: '', role: '', ego: '', description: '', refs: [], assetIds: [], _new: true }; }

function characterCard(c) {
  const idx = Math.abs(hash(c.id)) % 5;
  const cols = [['#3a2f66', '#5a2748'], ['#1f3a4a', '#2f7b6a'], ['#4a2f2f', '#b8556f'], ['#2f2f4a', '#5b4fb8'], ['#3a3a1f', '#8a7b2f']][idx];
  const tpose = c.refs.find(r => r.kind === 'tpose');
  const card = h('div', { class: 'card char-card' }, [
    h('div', { class: 'ch-top', style: { '--c1': cols[0], '--c2': cols[1] } }, [
      tpose
        ? h('div', { class: 'ch-face', style: { padding: 0, overflow: 'hidden' } }, h('img', { src: tpose.url, style: { width: '100%', height: '100%', objectFit: 'cover' } }))
        : h('div', { class: 'ch-face' }, '🎭'),
      h('div', { class: 'grow' }, [h('h3', c.name || 'Unnamed'), c.role && h('div', { class: 'ch-role' }, c.role)]),
    ]),
    h('div', { class: 'ch-body' }, [
      c.ego && h('div', { class: 'tag-inline', style: { marginBottom: '8px', color: 'var(--brand-2)' } }, '“' + c.ego + '”'),
      h('div', { class: 'ch-desc' }, c.description || 'No description yet.'),
      h('div', { class: 'ch-refs' }, [
        refCount(c, 'tpose', 'T-pose'), refCount(c, 'emotion', 'emotions'), refCount(c, 'pose', 'poses'),
        c.assetIds.length ? h('span', { class: 'refchip' }, `${c.assetIds.length} assets`) : null,
      ]),
    ]),
  ]);
  card.addEventListener('click', () => openCharacter(c));
  return card;
}
function refCount(c, kind, label) {
  const n = c.refs.filter(r => r.kind === kind).length;
  return h('span', { class: 'refchip', style: n ? { borderColor: 'rgba(139,123,255,.4)', color: '#cbc2ff' } : {} }, `${n} ${label}`);
}

function openCharacter(c) {
  const isNew = c._new;
  const nameI = h('input', { class: 'input', value: c.name, placeholder: 'Name' });
  const roleI = h('input', { class: 'input', value: c.role, placeholder: 'Role (protagonist, rival…)' });
  const egoI = h('input', { class: 'input', value: c.ego, placeholder: 'Ego / driving psychology' });
  const descI = h('textarea', { class: 'textarea', placeholder: 'Physical + wardrobe description (used as the image reference brief)' }, c.description || '');
  descI.value = c.description || '';

  const refWrap = h('div', {});
  const renderRefs = () => {
    refWrap.innerHTML = '';
    refWrap.append(
      h('div', { class: 'tag-inline', style: { margin: '4px 0 8px' } }, 'REFERENCE DIRECTORY'),
      h('div', { class: 'ref-grid' }, [
        refSlot({ owner: c, kind: 'tpose', label: 'T-pose', single: true, onChange: renderRefs }),
        ...c.refs.filter(r => r.kind === 'emotion').map(r => refSlot({ owner: c, existing: r, kind: 'emotion', onChange: renderRefs })),
        refSlot({ owner: c, kind: 'emotion', label: '+ Emotion', add: true, onChange: renderRefs }),
        ...c.refs.filter(r => r.kind === 'pose').map(r => refSlot({ owner: c, existing: r, kind: 'pose', onChange: renderRefs })),
        refSlot({ owner: c, kind: 'pose', label: '+ Pose (fight, sport…)', add: true, onChange: renderRefs }),
      ]),
    );
  };
  renderRefs();

  // linked assets
  const assetLink = h('div', {});
  const renderAssets = () => {
    assetLink.innerHTML = '';
    if (!current.assets.length) { assetLink.append(h('div', { class: 'tag-inline' }, 'No assets yet — add some in the Assets tab to link a home, bed or favorite item.')); return; }
    assetLink.append(h('div', { class: 'row gap-8', style: { flexWrap: 'wrap' } }, current.assets.map(a => {
      const on = c.assetIds.includes(a.id);
      return h('button', { class: `pill ${on ? 'brand' : ''}`, style: { cursor: 'pointer' }, onclick: () => { c.assetIds = on ? c.assetIds.filter(x => x !== a.id) : [...c.assetIds, a.id]; renderAssets(); } },
        [on ? '✓ ' : '', a.name || 'asset']);
    })));
  };
  renderAssets();

  const m = modal({
    title: isNew ? 'New character' : (c.name || 'Character'), size: 'lg',
    body: [
      h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
        h('div', { class: 'field' }, [h('label', 'Name'), nameI]),
        h('div', { class: 'field' }, [h('label', 'Role'), roleI]),
      ]),
      h('div', { class: 'field' }, [h('label', 'Ego'), egoI]),
      h('div', { class: 'field' }, [h('label', 'Description'), descI]),
      h('hr', { class: 'hr' }),
      refWrap,
      h('hr', { class: 'hr' }),
      h('div', { class: 'tag-inline', style: { marginBottom: '8px' } }, 'LINKED ASSETS'),
      assetLink,
    ],
    footer: [
      !isNew && h('button', { class: 'btn danger-ghost', onclick: async () => {
        if (await confirmModal({ title: 'Delete character?', message: `Remove ${c.name || 'this character'}?`, confirmText: 'Delete', danger: true })) {
          current.characters = current.characters.filter(x => x.id !== c.id); await persist(); m.close(); paint();
        }
      } }, [icon('trash'), 'Delete']),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn ghost', onclick: m.close }, 'Close'),
      h('button', { class: 'btn primary', onclick: async () => {
        c.name = nameI.value; c.role = roleI.value; c.ego = egoI.value; c.description = descI.value;
        if (isNew) { delete c._new; current.characters.push(c); }
        await persist(); m.close(); paint(); toast('Saved', 'ok');
      } }, 'Save'),
    ],
  });
}

/* reference slot with upload */
function refSlot({ owner, existing, kind, label, single, add, onChange }) {
  if (single) existing = owner.refs.find(r => r.kind === 'tpose');
  const slot = h('div', { class: `ref-slot ${existing ? 'filled' : ''}` });
  if (existing) {
    slot.append(
      h('img', { src: existing.url }),
      h('span', { class: 'tag' }, existing.label || kind),
      h('button', { class: 'rm', onclick: async (e) => { e.stopPropagation(); owner.refs = owner.refs.filter(r => r !== existing); await persist(); onChange(); } }, icon('x')),
    );
  } else {
    slot.append(h('span', { html: icons.image, style: { width: '22px', display: 'inline-flex' } }), h('span', { class: 'lbl' }, label || kind));
  }
  slot.addEventListener('click', () => pickImage(async (dataUrl) => {
    const relBase = `characters/${slug(owner.name || owner.id)}/refs/${kind}-${Math.random().toString(36).slice(2, 6)}`;
    const { url } = await api.upload(current.id, relBase, dataUrl);
    if (single) owner.refs = owner.refs.filter(r => r.kind !== 'tpose');
    const lbl = kind === 'emotion' ? (prompt('Label this emotion (e.g. angry, joyful):', 'emotion') || 'emotion')
      : kind === 'pose' ? (prompt('Label this pose (e.g. fighting stance):', 'pose') || 'pose')
      : 'T-pose';
    owner.refs.push({ id: 'ref_' + Math.random().toString(36).slice(2, 8), kind, label: lbl, url });
    await persist(); onChange();
  }));
  return slot;
}

/* ================= ASSETS ================= */
function assetsTab() {
  const wrap = h('div', {});
  const addBtn = h('button', { class: 'btn primary', onclick: () => openAsset(newAsset()) }, [icon('plus'), 'Add asset']);
  wrap.append(
    head('World & Props', 'Assets', 'Recurring places and objects — a character’s home, their bed, a favorite item. Link them to characters and reference them in scene prompts.'),
    h('div', { style: { marginBottom: '20px' } }, addBtn),
    current.assets.length
      ? h('div', { class: 'grid cards3' }, current.assets.map(assetCard))
      : emptyBlock('🏠', 'No assets yet', 'Add a home, a bed, a keepsake — anything that recurs across scenes.'),
  );
  return wrap;
}
function newAsset() { return { id: 'asset_' + Math.random().toString(36).slice(2, 9), name: '', type: 'item', description: '', url: '', _new: true }; }
const ASSET_ICONS = { home: '🏠', bed: '🛏', item: '🎁', location: '📍', vehicle: '🚗', prop: '📦' };

function assetCard(a) {
  const card = h('div', { class: 'card char-card' }, [
    a.url
      ? h('div', { style: { height: '140px', overflow: 'hidden', borderBottom: '1px solid var(--line-soft)' } }, h('img', { src: a.url, style: { width: '100%', height: '100%', objectFit: 'cover' } }))
      : h('div', { class: 'ch-top' }, [h('div', { class: 'ch-face', style: { '--c1': '#2a3350', '--c2': '#3a2f5a' } }, ASSET_ICONS[a.type] || '📦'), h('div', { class: 'grow' }, [h('h3', a.name || 'Unnamed'), h('div', { class: 'ch-role' }, a.type)])]),
    h('div', { class: 'ch-body' }, [
      a.url && h('h3', { style: { marginBottom: '4px' } }, a.name || 'Unnamed'),
      h('div', { class: 'ch-desc' }, a.description || 'No description.'),
    ]),
  ]);
  card.addEventListener('click', () => openAsset(a));
  return card;
}
function openAsset(a) {
  const isNew = a._new;
  const nameI = h('input', { class: 'input', value: a.name, placeholder: 'Name (e.g. Aya’s balcony)' });
  const typeI = h('select', { class: 'input' }, Object.keys(ASSET_ICONS).map(t => h('option', { value: t, selected: a.type === t ? 'selected' : null }, t)));
  const descI = h('textarea', { class: 'textarea', placeholder: 'Description / reference brief' }, a.description || ''); descI.value = a.description || '';
  const imgWrap = h('div', {});
  const renderImg = () => {
    imgWrap.innerHTML = '';
    const slot = h('div', { class: `ref-slot ${a.url ? 'filled' : ''}`, style: { aspectRatio: '16/9', maxWidth: '320px' } });
    if (a.url) slot.append(h('img', { src: a.url }), h('button', { class: 'rm', onclick: async e => { e.stopPropagation(); a.url = ''; renderImg(); } }, icon('x')));
    else slot.append(h('span', { html: icons.image, style: { width: '22px', display: 'inline-flex' } }), h('span', { class: 'lbl' }, 'Reference image'));
    slot.addEventListener('click', () => pickImage(async (dataUrl) => {
      const { url } = await api.upload(current.id, `assets/${slug(a.name || a.id)}/ref`, dataUrl); a.url = url; renderImg();
    }));
    imgWrap.append(slot);
  };
  renderImg();

  const m = modal({
    title: isNew ? 'New asset' : (a.name || 'Asset'),
    body: [
      h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr', gap: '12px' } }, [
        h('div', { class: 'field' }, [h('label', 'Name'), nameI]),
        h('div', { class: 'field' }, [h('label', 'Type'), typeI]),
      ]),
      h('div', { class: 'field' }, [h('label', 'Description'), descI]),
      imgWrap,
    ],
    footer: [
      !isNew && h('button', { class: 'btn danger-ghost', onclick: async () => { current.assets = current.assets.filter(x => x.id !== a.id); await persist(); m.close(); paint(); } }, [icon('trash'), 'Delete']),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn ghost', onclick: m.close }, 'Close'),
      h('button', { class: 'btn primary', onclick: async () => { a.name = nameI.value; a.type = typeI.value; a.description = descI.value; if (isNew) { delete a._new; current.assets.push(a); } await persist(); m.close(); paint(); toast('Saved', 'ok'); } }, 'Save'),
    ],
  });
}

/* ================= STYLE ================= */
function styleTab() {
  const wrap = h('div', {});
  const addBtn = h('button', { class: 'btn primary', onclick: () => openStyle(newStyle()) }, [icon('plus'), 'Add style reference']);
  wrap.append(
    head('Look & Feel', 'Style References', 'Global visual references — color, linework, era, mood. These are injected into every frame prompt so the whole film shares one aesthetic.'),
    h('div', { style: { marginBottom: '20px' } }, addBtn),
    current.styleRefs.length
      ? h('div', { class: 'ref-grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' } }, current.styleRefs.map(styleCard))
      : emptyBlock('🎨', 'No style references', 'Add a few images or written style notes to lock the look.'),
  );
  return wrap;
}
function newStyle() { return { id: 'style_' + Math.random().toString(36).slice(2, 9), name: '', description: '', url: '', _new: true }; }
function styleCard(s) {
  const card = h('div', { class: `ref-slot filled`, style: { aspectRatio: '1' } });
  if (s.url) card.append(h('img', { src: s.url }));
  else card.append(h('div', { style: { padding: '14px', textAlign: 'center' } }, [h('div', { style: { fontSize: '22px', marginBottom: '6px' } }, '🎨'), h('div', { class: 'lbl' }, s.name || 'Style note')]));
  card.append(h('span', { class: 'tag' }, s.name || 'style'));
  card.addEventListener('click', () => openStyle(s));
  return card;
}
function openStyle(s) {
  const isNew = s._new;
  const nameI = h('input', { class: 'input', value: s.name, placeholder: 'Name (e.g. “90s cel, warm neon”)' });
  const descI = h('textarea', { class: 'textarea', placeholder: 'Written style direction — palette, linework, grain, references' }, s.description || ''); descI.value = s.description || '';
  const imgWrap = h('div', {});
  const renderImg = () => {
    imgWrap.innerHTML = '';
    const slot = h('div', { class: `ref-slot ${s.url ? 'filled' : ''}`, style: { aspectRatio: '1', maxWidth: '240px' } });
    if (s.url) slot.append(h('img', { src: s.url }), h('button', { class: 'rm', onclick: async e => { e.stopPropagation(); s.url = ''; renderImg(); } }, icon('x')));
    else slot.append(h('span', { html: icons.image, style: { width: '22px', display: 'inline-flex' } }), h('span', { class: 'lbl' }, 'Style image (optional)'));
    slot.addEventListener('click', () => pickImage(async (dataUrl) => { const { url } = await api.upload(current.id, `style/${slug(s.name || s.id)}`, dataUrl); s.url = url; renderImg(); }));
    imgWrap.append(slot);
  };
  renderImg();
  const m = modal({
    title: isNew ? 'New style reference' : (s.name || 'Style'),
    body: [h('div', { class: 'field' }, [h('label', 'Name'), nameI]), h('div', { class: 'field' }, [h('label', 'Direction'), descI]), imgWrap],
    footer: [
      !isNew && h('button', { class: 'btn danger-ghost', onclick: async () => { current.styleRefs = current.styleRefs.filter(x => x.id !== s.id); await persist(); m.close(); paint(); } }, [icon('trash'), 'Delete']),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn ghost', onclick: m.close }, 'Close'),
      h('button', { class: 'btn primary', onclick: async () => { s.name = nameI.value; s.description = descI.value; if (isNew) { delete s._new; current.styleRefs.push(s); } await persist(); m.close(); paint(); } }, 'Save'),
    ],
  });
}

/* ================= STORYBOARD ================= */
function storyboardTab() {
  const wrap = h('div', {});
  const genBtn = h('button', { class: 'btn primary' }, [icon('sparkles'), current.scenes.length ? 'Sync scenes from script' : 'Generate storyboard from script']);
  genBtn.onclick = () => withBtn(genBtn, 'Breaking down…', async () => {
    if (!current.script) return toast('Generate a script first', 'info');
    current = await api.extractScenes(current); paint(); toast('Storyboard built', 'ok');
  });

  const allFramesBtn = h('button', { class: 'btn subtle' }, [icon('image'), 'Generate all frames']);
  allFramesBtn.onclick = () => withBtn(allFramesBtn, 'Generating…', async () => {
    for (const s of current.scenes) { if (!s.frameUrl) { current = await api.generateFrame(current, s.id); paint(); } }
    toast('All frames generated', 'ok');
  });

  wrap.append(
    head('Shot by shot', 'Storyboard', 'Each scene from the script becomes a shot. Generate the start frame (linked to your character & style refs), then drive it into a Seedance shot — regenerate either with feedback.'),
    h('div', { class: 'toolbar' }, [
      genBtn,
      current.scenes.length ? allFramesBtn : null,
      h('div', { class: 'grow' }),
      h('span', { class: 'tag-inline' }, `${current.scenes.filter(s => s.frameUrl).length}/${current.scenes.length} frames · ${current.scenes.filter(s => s.shotUrl).length} shots`),
    ]),
    current.scenes.length
      ? h('div', { class: 'scene-list' }, current.scenes.map((s, i) => sceneRow(s, i)))
      : emptyBlock('🎬', 'No storyboard yet', 'Generate one from your script — it links your characters and assets automatically.'),
  );
  return wrap;
}

function sceneRow(scene, i) {
  const frame = h('div', { class: 'frame' });
  const paintFrame = () => {
    frame.innerHTML = '';
    if (scene.frameUrl) {
      frame.append(h('img', { src: scene.frameUrl }));
      if (scene.shotUrl) frame.append(shotOverlay(scene));
      frame.append(h('span', { class: 'fr-badge pill', style: { background: 'rgba(0,0,0,.55)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' } }, scene.shotUrl ? '🎞 shot ready' : (scene.frameIsMock ? 'mock frame' : 'frame')));
    } else {
      frame.append(h('div', { class: 'placeholder-art', style: { '--a1': '#241f3d', '--a2': '#3a1f38', position: 'absolute', inset: 0 } }));
      frame.append(h('div', { style: { position: 'relative', textAlign: 'center' } }, [h('div', { style: { fontSize: '26px' } }, '🎞'), h('div', { class: 'tag-inline', style: { marginTop: '4px' } }, 'No frame yet')]));
    }
  };
  paintFrame();

  // prompt editors
  const framePromptTa = h('div', { class: 'prompt-text', contenteditable: 'true', spellcheck: 'false' }, scene.framePrompt || '');
  framePromptTa.textContent = scene.framePrompt || '(generate or write a start-frame prompt)';
  framePromptTa.addEventListener('blur', () => { const v = framePromptTa.textContent.trim(); if (v && v !== scene.framePrompt) { scene.framePrompt = v; persist(); } });

  const buildFrameBtn = h('button', { class: 'btn xs subtle' }, [icon('wand'), scene.framePrompt ? 'Rebuild prompt' : 'Build prompt']);
  buildFrameBtn.onclick = () => withBtn(buildFrameBtn, '…', async () => { current = await api.framePrompt(current, scene.id, null); paint(); });

  const genFrameBtn = h('button', { class: 'btn xs primary' }, [icon('image'), scene.frameUrl ? 'Regenerate frame' : 'Generate frame']);
  genFrameBtn.onclick = () => withBtn(genFrameBtn, 'Rendering…', async () => { current = await api.generateFrame(current, scene.id); paint(); toast('Frame generated', 'ok'); });

  const frameFb = h('input', { class: 'feedback-input', style: { fontSize: '13px', padding: '8px 11px' }, placeholder: 'Refine frame prompt — “wider shot”, “rain”, “from below”…' });
  const frameFbBtn = h('button', { class: 'btn xs subtle' }, icon('refresh'));
  frameFbBtn.onclick = () => withBtn(frameFbBtn, '', async () => { if (!frameFb.value.trim()) return; current = await api.framePrompt(current, scene.id, frameFb.value.trim()); frameFb.value = ''; paint(); });

  // shot section
  const shotPromptTa = h('div', { class: 'prompt-text', contenteditable: 'true', spellcheck: 'false' });
  shotPromptTa.textContent = scene.shotPrompt || '(build a motion prompt for Seedance)';
  shotPromptTa.addEventListener('blur', () => { const v = shotPromptTa.textContent.trim(); if (v && v !== scene.shotPrompt) { scene.shotPrompt = v; persist(); } });

  const buildShotBtn = h('button', { class: 'btn xs subtle' }, [icon('wand'), scene.shotPrompt ? 'Rebuild' : 'Build motion prompt']);
  buildShotBtn.onclick = () => withBtn(buildShotBtn, '…', async () => { current = await api.shotPrompt(current, scene.id, null); paint(); });

  const genShotBtn = h('button', { class: 'btn xs mint' }, [icon('play'), scene.shotUrl ? 'Regenerate shot' : 'Generate shot']);
  genShotBtn.disabled = !scene.frameUrl;
  genShotBtn.title = scene.frameUrl ? '' : 'Generate the start frame first';
  genShotBtn.onclick = () => withBtn(genShotBtn, 'Seedance…', async () => { current = await api.generateShot(current, scene.id); paint(); toast('Shot generated', 'ok'); });

  const shotFb = h('input', { class: 'feedback-input', style: { fontSize: '13px', padding: '8px 11px' }, placeholder: 'Shot feedback — “slower push-in”, “more emotion”…' });
  const shotFbBtn = h('button', { class: 'btn xs subtle' }, icon('refresh'));
  shotFbBtn.onclick = () => withBtn(shotFbBtn, '', async () => { if (!shotFb.value.trim()) return; current = await api.shotPrompt(current, scene.id, shotFb.value.trim()); shotFb.value = ''; paint(); });

  const detail = h('div', { class: 's-detail' }, [
    h('div', { class: 's-tags' }, [
      ...(scene.characterNames || []).map(n => h('span', { class: 'pill brand' }, [h('span', { html: icons.users, style: { width: '12px', display: 'inline-flex' } }), n])),
      ...(scene.assetNames || []).map(n => h('span', { class: 'pill' }, ['📦 ', n])),
      scene.shot && h('span', { class: 'pill gold' }, ['🎥 ', scene.shot]),
    ]),
    h('div', { class: 'lab' }, 'Scene'),
    h('p', { style: { fontSize: '13.5px', color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '14px' } }, scene.description),

    h('div', { class: 'lab' }, 'Start-frame prompt'),
    framePromptTa,
    h('div', { class: 's-actions' }, [buildFrameBtn, genFrameBtn]),
    h('div', { class: 'feedback-bar', style: { marginTop: '10px' } }, [frameFb, frameFbBtn]),

    h('hr', { class: 'hr', style: { margin: '16px 0' } }),

    h('div', { class: 'lab' }, 'Shot (motion) prompt · Seedance'),
    shotPromptTa,
    h('div', { class: 's-actions' }, [buildShotBtn, genShotBtn, scene.shotUrl && h('a', { class: 'btn xs ghost', href: scene.shotUrl, download: `${current.id}-scene-${i + 1}.${scene.shotUrl.split('?')[0].split('.').pop()}` }, [icon('download'), 'Export'])]),
    h('div', { class: 'feedback-bar', style: { marginTop: '10px' } }, [shotFb, shotFbBtn]),
  ]);

  return h('div', { class: 'scene' }, [
    h('div', { class: 's-head' }, [
      h('div', { class: 's-num' }, String(i + 1).padStart(2, '0')),
      h('div', { class: 'grow' }, [h('div', { class: 's-title' }, scene.title), h('div', { class: 's-sub' }, `${(scene.characterNames || []).length} characters · ${scene.shot || 'shot'}`)]),
      h('button', { class: 'iconbtn', onclick: async () => { if (await confirmModal({ title: 'Delete scene?', message: scene.title, confirmText: 'Delete', danger: true })) { current.scenes = current.scenes.filter(x => x.id !== scene.id); await persist(); paint(); } } }, icon('trash')),
    ]),
    h('div', { class: 's-body' }, [frame, detail]),
  ]);
}

function shotOverlay(scene) {
  // mock shots are SVGs; real shots are video — render appropriately
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(scene.shotUrl);
  if (isVideo) {
    const v = h('video', { src: scene.shotUrl, controls: 'controls', loop: 'loop', muted: 'muted', playsinline: 'playsinline', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' } });
    return v;
  }
  return h('img', { src: scene.shotUrl, style: { position: 'absolute', inset: 0 } });
}

/* ---------------- shared bits ---------------- */
function banner(text) { return h('div', { class: 'banner' }, [h('span', { class: 'bi', html: icons.info, style: { width: '18px', display: 'inline-flex' } }), text]); }
function emptyBlock(big, title, p) { return h('div', { class: 'empty' }, [h('div', { class: 'big' }, big), h('h3', title), h('p', p)]); }
function pickImage(cb) {
  const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); });
  document.body.appendChild(inp); inp.click(); setTimeout(() => inp.remove(), 1000);
}
function slug(s) { return String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'x'; }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
