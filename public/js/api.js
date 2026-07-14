// api.js — thin wrappers over the local server.

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  status: () => req('GET', '/api/status'),

  listProjects: () => req('GET', '/api/projects'),
  getProject: (id) => req('GET', `/api/projects/${id}`),
  createProject: (data) => req('POST', '/api/projects', data),
  saveProject: (p) => req('PUT', `/api/projects/${p.id}`, p),
  deleteProject: (id) => req('DELETE', `/api/projects/${id}`),

  ideate: (history, message) => req('POST', '/api/ideate', { history, message }),

  enhanceStory: (project, feedback) => req('POST', '/api/skills/enhance-story', { project, feedback }),
  extractScript: (project, note) => req('POST', '/api/skills/extract-script', { project, note }),
  extractCharacters: (project) => req('POST', '/api/skills/extract-characters', { project }),
  extractScenes: (project) => req('POST', '/api/skills/extract-scenes', { project }),
  framePrompt: (project, sceneId, note) => req('POST', '/api/skills/frame-prompt', { project, sceneId, note }),
  shotPrompt: (project, sceneId, note) => req('POST', '/api/skills/shot-prompt', { project, sceneId, note }),

  generateFrame: (project, sceneId) => req('POST', '/api/generate/frame', { project, sceneId }),
  generateShot: (project, sceneId) => req('POST', '/api/generate/shot', { project, sceneId }),

  upload: (projectId, relPath, dataUrl) => req('POST', '/api/upload', { projectId, relPath, dataUrl }),
};
