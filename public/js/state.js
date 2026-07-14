// state.js — app-level state: capability status + local ideation drafts.
// Ideation "ideas" live in localStorage until you convert them into a real
// project folder on disk.

import { api } from './api.js';

export const state = { status: { llm: false, fal: false } };

export async function loadStatus() {
  try { state.status = await api.status(); } catch { state.status = { llm: false, fal: false }; }
  return state.status;
}

const DKEY = 'inkwell.drafts.v1';
function readDrafts() { try { return JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch { return []; } }
function writeDrafts(d) { localStorage.setItem(DKEY, JSON.stringify(d)); }

export const drafts = {
  list: () => readDrafts().sort((a, b) => b.updatedAt - a.updatedAt),
  get: (id) => readDrafts().find(d => d.id === id) || null,
  create() {
    const d = { id: 'idea_' + Math.random().toString(36).slice(2, 9), title: 'New idea', messages: [], proposal: null, createdAt: Date.now(), updatedAt: Date.now() };
    const all = readDrafts(); all.push(d); writeDrafts(all); return d;
  },
  save(draft) {
    draft.updatedAt = Date.now();
    const all = readDrafts();
    const i = all.findIndex(d => d.id === draft.id);
    if (i >= 0) all[i] = draft; else all.push(draft);
    writeDrafts(all);
    return draft;
  },
  remove(id) { writeDrafts(readDrafts().filter(d => d.id !== id)); },
};

export function timeAgo(ts) {
  if (!ts) return '';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}
