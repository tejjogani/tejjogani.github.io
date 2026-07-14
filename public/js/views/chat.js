// views/chat.js — ideation: develop the story idea with the AI creative director.
import { h, icon, icons, mdLite, toast, spinner } from '../ui.js';
import { api } from '../api.js';
import { drafts, state } from '../state.js';
import { go } from '../router.js';

export async function renderChat(root, id) {
  const draft = drafts.get(id);
  if (!draft) { go('/'); return; }

  root.innerHTML = '';
  const thread = h('div', { class: 'chat-thread', id: 'thread' });
  const scroll = h('div', { class: 'chat-scroll' }, thread);

  const input = h('textarea', { class: '', placeholder: 'Reply, or tell me what to change — “make the ending hopeful”, “add a rival”, “set it underwater”…', rows: '1', style: { minHeight: '46px' } });
  autoGrow(input);
  const composerSend = () => submit(input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composerSend(); } });

  const composer = h('div', { class: 'chat-composer' }, h('div', { class: 'cc-inner' },
    h('div', { class: 'promptbox', style: { margin: 0, maxWidth: '100%' } }, [
      input,
      h('div', { class: 'pb-foot' }, [
        h('div', { class: 'pb-hint' }, state.status.llm ? 'Shaping your story…' : 'Mock creative director — set ANTHROPIC_API_KEY for full range'),
        h('button', { class: 'send', onclick: composerSend }, icon('send')),
      ]),
    ])));

  const header = h('div', { class: 'chat-head' }, h('div', { class: 'wrap chat-head-inner' }, [
    h('div', { class: 'row gap-12' }, [
      h('button', { class: 'iconbtn', onclick: () => go('/'), title: 'Home' }, icon('arrowLeft')),
      h('div', {}, [
        h('div', { class: 'row gap-8' }, [h('span', { style: { fontSize: '18px' } }, '💡'), h('strong', { style: { fontSize: '15px' } }, draft.proposal?.title || 'New idea')]),
        h('div', { class: 'tag-inline' }, 'Ideation'),
      ]),
    ]),
    h('div', { class: 'row gap-8' }, [
      h('span', { class: `pill ${state.status.llm ? 'mint' : ''}` }, [h('span', { class: 'dot' }), state.status.llm ? 'AI live' : 'Mock mode']),
    ]),
  ]));

  root.appendChild(h('div', { class: 'chatview' }, [header, scroll, composer]));

  const rerender = () => { paintThread(thread, draft); scroll.scrollTop = scroll.scrollHeight; };
  rerender();

  // auto-run if a trailing user message has no reply (came from the home prompt)
  const last = draft.messages[draft.messages.length - 1];
  if (last && last.role === 'user' && !thinkingFlag) runIdeate(draft, rerender, scroll);

  async function submit(text) {
    text = (text || '').trim();
    if (!text || thinkingFlag) return;
    input.value = ''; input.style.height = 'auto';
    draft.messages.push({ role: 'user', content: text });
    drafts.save(draft); rerender();
    await runIdeate(draft, rerender, scroll);
  }
}

let thinkingFlag = false;

async function runIdeate(draft, rerender, scroll) {
  thinkingFlag = true;
  const thread = document.getElementById('thread');
  const typing = h('div', { class: 'msg ai', id: 'typing' }, [
    h('div', { class: 'avatar' }, '🖋'),
    h('div', { class: 'grow' }, [h('div', { class: 'who' }, 'Creative Director'), h('div', { class: 'typing' }, [h('i'), h('i'), h('i')])]),
  ]);
  thread.appendChild(typing); scroll.scrollTop = scroll.scrollHeight;

  try {
    const history = draft.messages.slice(0, -1);
    const message = draft.messages[draft.messages.length - 1].content;
    const result = await api.ideate(history, message);
    draft.messages.push({ role: 'assistant', content: result.reply || 'Here\'s an idea.' });
    if (result.proposal) { draft.proposal = result.proposal; draft.title = result.proposal.title; }
    drafts.save(draft);
  } catch (e) {
    draft.messages.push({ role: 'assistant', content: `_(Something went wrong: ${e.message})_` });
    drafts.save(draft);
  } finally {
    thinkingFlag = false;
    document.getElementById('typing')?.remove();
    rerender();
  }
}

function paintThread(thread, draft) {
  thread.innerHTML = '';
  if (!draft.messages.length) {
    thread.appendChild(h('div', { class: 'msg ai' }, [
      h('div', { class: 'avatar' }, '🖋'),
      h('div', { class: 'grow' }, [h('div', { class: 'who' }, 'Creative Director'),
        h('div', { class: 'bubble', html: mdLite('Tell me the anime you want to make — a vibe, a reference, a single image is enough. I\'ll shape it into a story with you.') })]),
    ]));
  }
  draft.messages.forEach((m, i) => {
    const isAI = m.role === 'assistant';
    const row = h('div', { class: `msg ${isAI ? 'ai' : 'user'}` }, [
      h('div', { class: 'avatar' }, isAI ? '🖋' : '🙂'),
      h('div', { class: 'grow' }, [
        h('div', { class: 'who' }, isAI ? 'Creative Director' : 'You'),
        h('div', { class: 'bubble', html: mdLite(m.content) }),
        // attach proposal card under the last AI message
        (isAI && i === lastAIIndex(draft) && draft.proposal) ? proposalCard(draft) : null,
      ]),
    ]);
    thread.appendChild(row);
  });
}

function lastAIIndex(draft) {
  for (let i = draft.messages.length - 1; i >= 0; i--) if (draft.messages[i].role === 'assistant') return i;
  return -1;
}

function proposalCard(draft) {
  const p = draft.proposal;
  const premiseParas = String(p.premise || '').split(/\n{2,}/).filter(Boolean);
  return h('div', { class: 'proposal' }, [
    h('div', { class: 'ph' }, [
      h('div', { class: 't' }, [h('span', { html: icons.book, style: { width: '16px', display: 'inline-flex', color: 'var(--brand-2)' } }), 'Story Proposal']),
      h('div', { class: 'row gap-6' }, (p.meta ? Object.values(p.meta).filter(Boolean).slice(0, 1) : []).map(v => h('span', { class: 'pill brand' }, v))),
    ]),
    h('div', { class: 'pbody' }, [
      h('h4', p.title),
      p.logline && h('div', { class: 'll' }, p.logline),
      ...premiseParas.map(t => h('p', { class: 'desc', html: inlineBold(t) })),
      h('div', { class: 'metaline' }, [
        p.meta?.runtime && h('span', { class: 'pill' }, ['⏱ ', p.meta.runtime]),
        p.meta?.genre && h('span', { class: 'pill pink' }, p.meta.genre),
        p.meta?.setting && h('span', { class: 'pill' }, ['📍 ', p.meta.setting]),
        p.conflict && h('span', { class: 'pill gold' }, ['⚡ ', trunc(p.conflict, 42)]),
      ]),
      (p.characters?.length) && h('div', { style: { marginTop: '14px' } }, [
        h('div', { class: 'tag-inline', style: { marginBottom: '7px' } }, 'MAIN CAST'),
        h('div', { class: 'row gap-6', style: { flexWrap: 'wrap' } }, p.characters.map(c => h('span', { class: 'pill' }, c))),
      ]),
    ]),
    h('div', { class: 'pfoot' }, [
      h('button', { class: 'btn primary', onclick: (e) => convert(e.currentTarget, draft) }, [icon('arrowRight'), 'Convert to project']),
      h('span', { class: 'tag-inline' }, 'or keep refining in the chat below'),
    ]),
  ]);
}

async function convert(btn, draft) {
  const p = draft.proposal;
  btn.disabled = true; btn.innerHTML = ''; btn.appendChild(spinner()); btn.appendChild(document.createTextNode(' Creating project…'));
  try {
    const project = await api.createProject({
      title: p.title, logline: p.logline, meta: p.meta || {},
      story: p.premise, conversation: draft.messages,
    });
    drafts.remove(draft.id);
    toast('Project created', 'ok');
    go(`/project/${project.id}`);
  } catch (e) {
    toast('Failed: ' + e.message, 'err');
    btn.disabled = false; btn.textContent = 'Convert to project';
  }
}

function inlineBold(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function autoGrow(ta) { const g = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }; ta.addEventListener('input', g); }
