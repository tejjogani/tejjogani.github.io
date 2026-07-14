// server/store.js — projects as folders on disk. The filesystem is the source
// of truth, so you can also open any project in Claude Code and edit it by hand.
//
// Layout:  projects/<id>/
//   project.json          (authoritative structured data)
//   story.md, script.md   (human-readable mirrors)
//   characters/<slug>/character.md
//   media/...             (generated frames + shots)

import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..', 'projects');

async function ensureRoot() { if (!existsSync(ROOT)) await mkdir(ROOT, { recursive: true }); }
export function projectDir(id) { return path.join(ROOT, safe(id)); }
function safe(s) { return String(s).replace(/[^a-z0-9-_]/gi, ''); }

export function slugify(s) {
  return String(s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
}

export async function listProjects() {
  await ensureRoot();
  const entries = await readdir(ROOT, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const p = await getProject(e.name);
      if (p) out.push(summary(p));
    } catch {}
  }
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

export async function getProject(id) {
  const f = path.join(projectDir(id), 'project.json');
  if (!existsSync(f)) return null;
  return JSON.parse(await readFile(f, 'utf8'));
}

export async function createProject(data) {
  await ensureRoot();
  const base = slugify(data.title);
  let id = base, n = 2;
  while (existsSync(projectDir(id))) id = `${base}-${n++}`;
  const now = Date.now();
  const project = {
    id,
    title: data.title || 'Untitled',
    logline: data.logline || '',
    meta: data.meta || {},
    story: data.story || data.premise || '',
    script: data.script || '',
    characters: data.characters || [],
    assets: data.assets || [],
    styleRefs: data.styleRefs || [],
    scenes: data.scenes || [],
    conversation: data.conversation || [],
    createdAt: now,
    updatedAt: now,
  };
  await mkdir(projectDir(id), { recursive: true });
  await writeProject(project);
  return project;
}

export async function saveProject(project) {
  if (!project?.id || !existsSync(projectDir(project.id))) throw new Error('unknown project');
  project.updatedAt = Date.now();
  await writeProject(project);
  return project;
}

async function writeProject(project) {
  const dir = projectDir(project.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2));
  // human-readable mirrors for agentic editing
  await writeFile(path.join(dir, 'story.md'), `# ${project.title}\n\n> ${project.logline || ''}\n\n${project.story || ''}\n`);
  if (project.script) await writeFile(path.join(dir, 'script.md'), project.script + '\n');
  const cdir = path.join(dir, 'characters');
  await mkdir(cdir, { recursive: true });
  for (const c of project.characters || []) {
    const cd = path.join(cdir, slugify(c.name));
    await mkdir(path.join(cd, 'refs'), { recursive: true });
    await writeFile(path.join(cd, 'character.md'),
      `# ${c.name}\n\n**Role:** ${c.role || ''}\n\n**Ego:** ${c.ego || ''}\n\n${c.description || ''}\n`);
  }
}

export async function deleteProject(id) {
  const dir = projectDir(id);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
}

/** Write a generated/uploaded media buffer into the project, return web path. */
export async function saveMedia(id, relPath, buffer) {
  const dir = projectDir(id);
  if (!existsSync(dir)) throw new Error('unknown project');
  const rel = relPath.replace(/^\/+/, '').replace(/\.\./g, '');
  const abs = path.join(dir, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return `/files/${encodeURIComponent(id)}/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

export function mediaPath(id, rel) {
  return path.join(projectDir(id), rel.replace(/^\/+/, '').replace(/\.\./g, ''));
}

function summary(p) {
  const total = 6;
  let done = 0;
  if (p.story) done++;
  if (p.script) done++;
  if ((p.characters || []).length) done++;
  if ((p.assets || []).length || (p.styleRefs || []).length) done++;
  if ((p.scenes || []).length) done++;
  if ((p.scenes || []).some(s => s.shot?.video || s.shotVideo)) done++;
  return {
    id: p.id, title: p.title, logline: p.logline, meta: p.meta || {},
    counts: {
      characters: (p.characters || []).length,
      scenes: (p.scenes || []).length,
      assets: (p.assets || []).length,
      styleRefs: (p.styleRefs || []).length,
    },
    progress: Math.round((done / total) * 100),
    updatedAt: p.updatedAt, createdAt: p.createdAt,
  };
}
