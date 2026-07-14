// server/index.js — local Inkwell server: static UI + API + fal/LLM proxies.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasLLM, llmModel } from './ai.js';
import * as skills from './skills.js';
import { hasFal, generateImage, generateVideo } from './fal.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '30mb' }));

const PORT = process.env.PORT || 4317;

/* ---------- capability status ---------- */
app.get('/api/status', (req, res) => {
  res.json({
    llm: hasLLM(), fal: hasFal(),
    llmModel: llmModel(),
    imageModel: process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/dev',
    videoModel: process.env.FAL_VIDEO_MODEL || 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
  });
});

/* ---------- project CRUD ---------- */
app.get('/api/projects', wrap(async (req, res) => res.json(await store.listProjects())));
app.get('/api/projects/:id', wrap(async (req, res) => {
  const p = await store.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
}));
app.post('/api/projects', wrap(async (req, res) => res.json(await store.createProject(req.body || {}))));
app.put('/api/projects/:id', wrap(async (req, res) => {
  const p = req.body; p.id = req.params.id;
  res.json(await store.saveProject(p));
}));
app.delete('/api/projects/:id', wrap(async (req, res) => { await store.deleteProject(req.params.id); res.json({ ok: true }); }));

/* ---------- ideation ---------- */
app.post('/api/ideate', wrap(async (req, res) => {
  const { history, message } = req.body || {};
  res.json(await skills.ideate({ history, message }));
}));

/* ---------- studio skills (mutate + persist the project) ---------- */
app.post('/api/skills/enhance-story', wrap(async (req, res) => {
  const { project, feedback } = req.body;
  project.story = await skills.enhanceStory({ story: project.story, feedback, meta: project.meta });
  res.json(await store.saveProject(project));
}));

app.post('/api/skills/extract-script', wrap(async (req, res) => {
  const { project, note } = req.body;
  project.script = await skills.extractScript({
    story: project.story, characters: project.characters,
    existingScript: note ? project.script : '', note,
  });
  res.json(await store.saveProject(project));
}));

app.post('/api/skills/extract-characters', wrap(async (req, res) => {
  const { project } = req.body;
  const found = await skills.extractCharacters({ story: project.story, script: project.script, existing: project.characters });
  const existing = new Set((project.characters || []).map(c => c.name.toLowerCase()));
  for (const c of found) {
    if (existing.has((c.name || '').toLowerCase())) continue;
    project.characters.push({ id: rid('char'), name: c.name, role: c.role || '', ego: c.ego || '', description: c.description || '', refs: [], assetIds: [] });
  }
  res.json(await store.saveProject(project));
}));

app.post('/api/skills/extract-scenes', wrap(async (req, res) => {
  const { project } = req.body;
  const found = await skills.extractScenes({ script: project.script, story: project.story, characters: project.characters, assets: project.assets, existing: project.scenes });
  for (const s of found) {
    project.scenes.push({
      id: rid('scene'), title: s.title || 'Scene', description: s.description || '',
      characterNames: s.characterNames || [], assetNames: s.assetNames || [], shot: s.shot || '',
      framePrompt: '', frameUrl: '', shotPrompt: '', shotUrl: '', shotIsMock: false, feedback: [],
    });
  }
  res.json(await store.saveProject(project));
}));

app.post('/api/skills/frame-prompt', wrap(async (req, res) => {
  const { project, sceneId, note } = req.body;
  const scene = (project.scenes || []).find(s => s.id === sceneId);
  if (!scene) return res.status(404).json({ error: 'no scene' });
  scene.framePrompt = note && scene.framePrompt
    ? await skills.improvePrompt({ current: scene.framePrompt, feedback: note, kind: 'frame' })
    : await skills.buildFramePrompt({ scene, characters: project.characters, assets: project.assets, styleRefs: project.styleRefs, note });
  res.json(await store.saveProject(project));
}));

app.post('/api/skills/shot-prompt', wrap(async (req, res) => {
  const { project, sceneId, note } = req.body;
  const scene = (project.scenes || []).find(s => s.id === sceneId);
  if (!scene) return res.status(404).json({ error: 'no scene' });
  scene.shotPrompt = note && scene.shotPrompt
    ? await skills.improvePrompt({ current: scene.shotPrompt, feedback: note, kind: 'shot' })
    : await skills.buildShotPrompt({ scene, framePrompt: scene.framePrompt, note });
  res.json(await store.saveProject(project));
}));

/* ---------- generation (image + video) ---------- */
app.post('/api/generate/frame', wrap(async (req, res) => {
  const { project, sceneId } = req.body;
  const scene = (project.scenes || []).find(s => s.id === sceneId);
  if (!scene) return res.status(404).json({ error: 'no scene' });
  if (!scene.framePrompt) scene.framePrompt = await skills.buildFramePrompt({ scene, characters: project.characters, assets: project.assets, styleRefs: project.styleRefs });

  const refs = collectRefs(project, scene);
  const out = await generateImage({ prompt: scene.framePrompt, imageRefs: refs });
  const url = await store.saveMedia(project.id, `media/scenes/${scene.id}/frame.${out.ext}`, out.buffer);
  scene.frameUrl = url + `?t=${Date.now()}`;
  scene.frameIsMock = out.mock;
  res.json(await store.saveProject(project));
}));

app.post('/api/generate/shot', wrap(async (req, res) => {
  const { project, sceneId } = req.body;
  const scene = (project.scenes || []).find(s => s.id === sceneId);
  if (!scene) return res.status(404).json({ error: 'no scene' });
  if (!scene.frameUrl) return res.status(400).json({ error: 'generate the start frame first' });
  if (!scene.shotPrompt) scene.shotPrompt = await skills.buildShotPrompt({ scene, framePrompt: scene.framePrompt });

  const startFrame = webUrlToDisk(project.id, scene.frameUrl);
  const out = await generateVideo({ prompt: scene.shotPrompt, startFrame });
  const url = await store.saveMedia(project.id, `media/scenes/${scene.id}/shot.${out.ext}`, out.buffer);
  scene.shotUrl = url + `?t=${Date.now()}`;
  scene.shotIsMock = out.mock;
  res.json(await store.saveProject(project));
}));

/* ---------- reference / asset uploads ---------- */
app.post('/api/upload', wrap(async (req, res) => {
  const { projectId, relPath, dataUrl } = req.body;
  const [meta, b64] = String(dataUrl).split(',');
  const ext = ((meta.match(/data:image\/(\w+)/) || [])[1] || 'png').replace('jpeg', 'jpg');
  const buffer = Buffer.from(b64, 'base64');
  const url = await store.saveMedia(projectId, `${relPath}.${ext}`, buffer);
  res.json({ url: url + `?t=${Date.now()}` });
}));

/* ---------- serve generated media ---------- */
app.get('/files/:id/*', (req, res) => {
  const rel = req.params[0];
  res.sendFile(store.mediaPath(req.params.id, rel), (err) => { if (err) res.status(404).end(); });
});

/* ---------- static UI ---------- */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  🖋  Inkwell studio running →  http://localhost:${PORT}`);
  console.log(`     LLM: ${hasLLM() ? llmModel() : 'mock (set ANTHROPIC_API_KEY)'}   |   Generation: ${hasFal() ? 'fal.ai' : 'mock (set FAL_KEY)'}\n`);
});

/* ---------- helpers ---------- */
function wrap(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  });
}
function rid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

function collectRefs(project, scene) {
  const refs = [];
  for (const c of project.characters || []) {
    if (!(scene.characterNames || []).includes(c.name)) continue;
    const tpose = (c.refs || []).find(r => r.kind === 'tpose') || (c.refs || [])[0];
    if (tpose?.url) refs.push(webUrlToDisk(project.id, tpose.url));
  }
  for (const s of project.styleRefs || []) if (s.url) refs.push(webUrlToDisk(project.id, s.url));
  return refs.filter(Boolean);
}
function webUrlToDisk(id, url) {
  const clean = String(url).split('?')[0];
  const prefix = `/files/${id}/`;
  if (!clean.startsWith(prefix)) return null;
  return store.mediaPath(id, decodeURIComponent(clean.slice(prefix.length)));
}
