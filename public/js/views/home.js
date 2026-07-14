// views/home.js — landing: central prompt box + running projects & ideas.
import { h, icon, icons, toast, confirmModal, attachMenu } from '../ui.js';
import { api } from '../api.js';
import { drafts, timeAgo, state } from '../state.js';
import { go } from '../router.js';

const EXAMPLES = [
  'A 30-min love story inspired by Romeo & Juliet, anime style, set in 2100',
  'A quiet slice-of-life about a girl who repairs broken robots by the sea',
  'A samurai western where the duel is a piano performance',
  'Two rival ramen chefs, one city, one impossible bowl',
];

export async function renderHome(root) {
  root.innerHTML = '';
  const box = h('textarea', { class: '', placeholder: 'Describe the anime you want to make…  e.g. “a love story inspired by Romeo & Juliet, anime style, set in the year 2100”', rows: '2' });
  autoGrow(box);

  const send = () => startIdea(box.value);
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  const sendBtn = h('button', { class: 'send', title: 'Start developing', onclick: send }, icon('send'));

  const promptbox = h('div', { class: 'promptbox' }, [
    box,
    h('div', { class: 'pb-foot' }, [
      h('div', { class: 'pb-hint' }, [
        h('span', { html: icons.sparkles, style: { width: '14px', display: 'inline-flex', color: 'var(--brand-2)' } }),
        state.status.llm ? 'Creative director is live' : 'Running in mock mode — add an API key for real generation',
      ]),
      sendBtn,
    ]),
  ]);

  const chips = h('div', { class: 'chips' }, EXAMPLES.map(ex =>
    h('button', { class: 'chip', onclick: () => { box.value = ex; autoGrowNow(box); box.focus(); } }, ex)));

  const hero = h('div', { class: 'hero' }, [
    h('div', { class: 'eyebrow' }, [h('span', { html: icons.film, style: { width: '15px', display: 'inline-flex' } }), 'Your indie anime studio, on your machine']),
    h('h1', { html: 'Turn a spark into a <span class="grad">finished anime short</span>.' }),
    h('p', { class: 'sub' }, 'Start with one sentence. Develop the story with an AI creative director, then build script, characters, storyboards and shots — all in one place.'),
    promptbox,
    chips,
  ]);

  const ideasSection = h('div', { id: 'ideas-section' });
  const projectsSection = h('div', { id: 'projects-section' });

  root.appendChild(h('div', { class: 'home wrap' }, [hero, ideasSection, projectsSection]));

  renderIdeas(ideasSection);
  await renderProjects(projectsSection);
  setTimeout(() => box.focus(), 50);
}

function renderIdeas(section) {
  section.innerHTML = '';
  const list = drafts.list().filter(d => d.messages.length);
  if (!list.length) return;
  section.appendChild(h('div', { class: 'section-head' }, [
    h('h2', 'Ideas in progress'), h('span', { class: 'line' }), h('span', { class: 'count' }, `${list.length}`),
  ]));
  section.appendChild(h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' } },
    list.map(d => {
      const card = h('div', { class: 'card idea-card' }, [
        h('div', { class: 'ic-glyph' }, '💡'),
        h('div', { class: 'grow' }, [
          h('div', { class: 'spread' }, [
            h('h3', d.proposal?.title || d.title),
            h('span', { class: 'tag-inline' }, timeAgo(d.updatedAt)),
          ]),
          h('p', d.proposal?.logline || d.messages.find(m => m.role === 'user')?.content || 'Untitled idea'),
          h('div', { class: 'row gap-8', style: { marginTop: '10px' } }, [
            d.proposal && h('span', { class: 'pill brand' }, [h('span', { class: 'dot' }), 'Ready to convert']),
          ]),
        ]),
      ]);
      card.addEventListener('click', () => go(`/idea/${d.id}`));
      return card;
    })));
}

async function renderProjects(section) {
  section.innerHTML = '';
  section.appendChild(h('div', { class: 'section-head' }, [
    h('h2', 'Projects'), h('span', { class: 'line' }),
    h('button', { class: 'btn sm subtle', onclick: () => startIdea('') }, [icon('plus'), 'New']),
  ]));
  let projects = [];
  try { projects = await api.listProjects(); } catch (e) { section.appendChild(h('div', { class: 'banner warn' }, ['Could not reach the local server. Is it running?'])); return; }

  if (!projects.length) {
    section.appendChild(h('div', { class: 'empty' }, [
      h('div', { class: 'big' }, '🎬'),
      h('h3', 'No projects yet'),
      h('p', 'Start an idea above — once the story feels right, convert it into a project.'),
    ]));
    return;
  }
  const grid = h('div', { class: 'grid projects' }, projects.map(p => projectCard(p, () => renderProjects(section))));
  section.appendChild(grid);
}

const POSTERS = [['#2a2350', '#7b2f6a'], ['#12324a', '#2f7b6a'], ['#3a1f38', '#b8556f'], ['#241f3d', '#5b4fb8'], ['#1f2f3a', '#4f7bb8']];
const GLYPHS = ['🌆', '🌸', '⚔️', '🍜', '🚀', '🌙', '🎐', '🔮'];

function projectCard(p, refresh) {
  const idx = Math.abs(hash(p.id)) % POSTERS.length;
  const pc = POSTERS[idx];
  const menuBtn = h('button', { class: 'iconbtn', style: { color: '#fff' }, onclick: e => e.stopPropagation() }, icon('more'));
  attachMenu(menuBtn, [
    { icon: 'arrowRight', label: 'Open', onClick: () => go(`/project/${p.id}`) },
    { icon: 'trash', label: 'Delete', danger: true, onClick: async () => {
      if (await confirmModal({ title: 'Delete project?', message: `“${p.title}” and all its files will be removed from disk.`, confirmText: 'Delete', danger: true })) {
        await api.deleteProject(p.id); toast('Project deleted', 'ok'); refresh();
      }
    } },
  ]);

  const card = h('div', { class: 'card proj-card' }, [
    h('div', { class: 'poster', style: { '--pc1': pc[0], '--pc2': pc[1] } }, [
      h('span', { class: 'glyph-big' }, GLYPHS[idx]),
      h('div', { style: { position: 'absolute', top: '10px', left: '12px', zIndex: 2 } },
        p.meta?.genre ? h('span', { class: 'pill', style: { background: 'rgba(0,0,0,.4)', borderColor: 'rgba(255,255,255,.15)', color: '#fff' } }, p.meta.genre) : null),
      h('div', { style: { position: 'absolute', top: '8px', right: '8px', zIndex: 3 } }, menuBtn),
    ]),
    h('div', { class: 'body' }, [
      h('h3', p.title),
      h('p', { class: 'logline' }, p.logline || 'No logline yet.'),
      h('div', { class: 'prog' }, [
        h('div', { class: 'progress-label' }, [h('span', 'Studio progress'), h('span', `${p.progress}%`)]),
        h('div', { class: 'progress' }, h('i', { style: { width: p.progress + '%' } })),
      ]),
      h('div', { class: 'meta-row' }, [
        chip(icons.users, p.counts.characters, 'cast'),
        chip(icons.film, p.counts.scenes, 'scenes'),
        p.meta?.runtime && h('span', { class: 'pill' }, p.meta.runtime),
      ]),
    ]),
  ]);
  card.addEventListener('click', () => go(`/project/${p.id}`));
  return card;
}

function chip(svg, n, label) {
  return h('span', { class: 'pill' }, [h('span', { html: svg, style: { width: '13px', display: 'inline-flex', opacity: .8 } }), `${n} ${label}`]);
}

async function startIdea(text) {
  const d = drafts.create();
  if (text && text.trim()) { d.messages.push({ role: 'user', content: text.trim() }); drafts.save(d); }
  go(`/idea/${d.id}`);
}

function autoGrow(ta) { ta.addEventListener('input', () => autoGrowNow(ta)); }
function autoGrowNow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 240) + 'px'; }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
