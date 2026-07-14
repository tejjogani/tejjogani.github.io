// main.js — bootstrap: nav, routing, capability status.
import { h, icon, icons, modal } from './ui.js';
import { onRoute, startRouter, go } from './router.js';
import { loadStatus, state } from './state.js';
import { renderHome } from './views/home.js';
import { renderChat } from './views/chat.js';
import { renderProject } from './views/project.js';

const app = document.getElementById('app');

function nav() {
  const st = state.status;
  return h('div', { class: 'nav' }, h('div', { class: 'wrap nav-inner' }, [
    h('a', { class: 'brand', href: '#/', onclick: () => go('/') }, [
      h('span', { class: 'glyph', html: icons.pen }),
      h('div', {}, [h('div', {}, 'Inkwell'), h('small', {}, 'indie anime studio')]),
    ]),
    h('div', { class: 'nav-actions' }, [
      h('span', { class: `pill ${st.llm && st.fal ? 'mint' : st.llm || st.fal ? 'gold' : ''} hide-sm`, style: { cursor: 'pointer' }, onclick: openStatus }, [
        h('span', { class: 'dot' }),
        st.llm && st.fal ? 'All systems live' : (st.llm || st.fal ? 'Partial · mock' : 'Mock mode'),
      ]),
      h('button', { class: 'btn sm subtle', onclick: openStatus }, [icon('key'), h('span', { class: 'hide-sm' }, 'Keys & setup')]),
      h('button', { class: 'btn sm primary', onclick: () => go('/') }, [icon('plus'), h('span', { class: 'hide-sm' }, 'New idea')]),
    ]),
  ]));
}

function openStatus() {
  const st = state.status;
  const row = (ok, name, detail) => h('div', { class: 'row gap-12', style: { padding: '12px 0', borderBottom: '1px solid var(--line-soft)' } }, [
    h('span', { style: { fontSize: '18px' } }, ok ? '🟢' : '⚪'),
    h('div', { class: 'grow' }, [h('div', { style: { fontWeight: 600, fontSize: '14px' } }, name), h('div', { class: 'tag-inline' }, detail)]),
    h('span', { class: `pill ${ok ? 'mint' : ''}` }, ok ? 'Live' : 'Mock'),
  ]);
  modal({
    title: 'Keys & setup',
    body: [
      h('p', { class: 'muted', style: { fontSize: '14px', lineHeight: 1.6 } }, 'Inkwell runs entirely on your machine. Everything works in mock mode; add keys to make story writing and generation real.'),
      row(st.llm, `Creative director — ${st.llmModel || 'Claude'}`, st.llm ? 'Anthropic key detected' : 'Set ANTHROPIC_API_KEY in .env'),
      row(st.fal, 'Image + video — fal.ai', st.fal ? `${st.imageModel} · ${st.videoModel}` : 'Set FAL_KEY in .env'),
      h('div', { class: 'banner', style: { marginTop: '6px' } }, [
        h('span', { class: 'bi', html: icons.info, style: { width: '18px', display: 'inline-flex' } }),
        h('div', { html: 'Add keys to <code class="mono">.env</code> at the project root, then restart the server (<code class="mono">npm start</code>). Your projects live as plain files under <code class="mono">projects/</code> — open that folder in Claude Code to edit story, script or prompts agentically.' }),
      ]),
    ],
    footer: [h('a', { class: 'btn ghost', href: 'https://fal.ai/dashboard/keys', target: '_blank' }, 'Get fal.ai key'), h('a', { class: 'btn primary', href: 'https://console.anthropic.com/', target: '_blank' }, 'Get Anthropic key')],
  });
}

onRoute(async ({ parts }) => {
  // rebuild nav each route so status pill stays fresh
  app.innerHTML = '';
  const navEl = nav();
  app.appendChild(navEl);
  const view = h('div', { id: 'view' });
  app.appendChild(view);

  if (parts[0] === 'idea' && parts[1]) return renderChat(view, parts[1]);
  if (parts[0] === 'project' && parts[1]) return renderProject(view, parts[1], parts[2]);
  return renderHome(view);
});

(async function boot() {
  await loadStatus();
  startRouter();
})();
