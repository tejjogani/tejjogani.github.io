// server/fal.js — image + video generation via fal.ai, with an offline mock
// that renders placeholder art so the storyboard flow works without a key.
//
// Returns a normalized { buffer, ext, contentType, remoteUrl, mock } object;
// the caller (routes) writes it into the project folder.

import { readFile } from 'node:fs/promises';

export function hasFal() {
  return Boolean(process.env.FAL_KEY);
}

const IMAGE_MODEL = () => process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/dev';
const VIDEO_MODEL = () => process.env.FAL_VIDEO_MODEL || 'fal-ai/bytedance/seedance/v1/pro/image-to-video';

/* -------------------- public API -------------------- */

export async function generateImage({ prompt, imageRefs = [], seed }) {
  if (!hasFal()) return mockImage(prompt, 'frame');
  const input = { prompt, image_size: 'landscape_16_9', num_images: 1 };
  if (seed != null) input.seed = seed;
  // If reference images are supplied, pass the first as an image prompt when the
  // model supports it (many flux/anime routes accept image_url for img2img).
  if (imageRefs.length) input.image_url = await toDataUri(imageRefs[0]);
  const result = await falRun(IMAGE_MODEL(), input);
  const url = firstImageUrl(result);
  if (!url) throw new Error('fal image: no image in response');
  return await download(url);
}

export async function generateVideo({ prompt, startFrame, duration = 5 }) {
  if (!hasFal()) return mockImage(prompt, 'shot');
  if (!startFrame) throw new Error('video generation needs a start frame');
  const input = {
    prompt,
    image_url: await toDataUri(startFrame),
    duration: String(duration),
  };
  const result = await falRun(VIDEO_MODEL(), input);
  const url = result?.video?.url || firstImageUrl(result);
  if (!url) throw new Error('fal video: no video in response');
  return await download(url);
}

/* -------------------- fal queue runner -------------------- */

async function falRun(model, input) {
  const headers = {
    'content-type': 'application/json',
    authorization: `Key ${process.env.FAL_KEY}`,
  };
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST', headers, body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const job = await submit.json();
  const statusUrl = job.status_url || `https://queue.fal.run/${model}/requests/${job.request_id}/status`;
  const responseUrl = job.response_url || `https://queue.fal.run/${model}/requests/${job.request_id}`;

  const deadline = Date.now() + 5 * 60 * 1000; // 5 min
  while (Date.now() < deadline) {
    await sleep(1500);
    const st = await fetch(statusUrl, { headers });
    if (!st.ok) continue;
    const s = await st.json();
    if (s.status === 'COMPLETED') {
      const r = await fetch(responseUrl, { headers });
      if (!r.ok) throw new Error(`fal response ${r.status}`);
      return await r.json();
    }
    if (s.status === 'FAILED' || s.status === 'ERROR') {
      throw new Error(`fal job failed: ${JSON.stringify(s).slice(0, 300)}`);
    }
  }
  throw new Error('fal job timed out');
}

function firstImageUrl(result) {
  if (!result) return null;
  if (Array.isArray(result.images) && result.images[0]) return result.images[0].url || result.images[0];
  if (result.image?.url) return result.image.url;
  return null;
}

async function download(url) {
  if (url.startsWith('data:')) {
    const [meta, b64] = url.split(',');
    const contentType = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    return { buffer: Buffer.from(b64, 'base64'), ext: extFor(contentType), contentType, remoteUrl: url, mock: false };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, ext: extFor(contentType, url), contentType, remoteUrl: url, mock: false };
}

function extFor(ct, url = '') {
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('webm')) return 'webm';
  const m = url.match(/\.(png|jpe?g|webp|mp4|webm)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'bin';
}

async function toDataUri(path) {
  const buf = await readFile(path);
  const ext = path.split('.').pop().toLowerCase();
  const ct = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* -------------------- offline mock art -------------------- */

function mockImage(prompt, kind) {
  const palettes = [['#2a2350', '#7b2f6a'], ['#12324a', '#2f7b6a'], ['#3a1f38', '#b8556f'], ['#241f3d', '#5b4fb8']];
  const p = palettes[Math.abs(hash(prompt)) % palettes.length];
  const words = String(prompt).replace(/\s+/g, ' ').trim();
  const lines = wrap(words, 46).slice(0, 6);
  const isShot = kind === 'shot';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/>
    </linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="960" height="540" fill="url(#g)"/>
  <rect width="960" height="540" filter="url(#n)" opacity="0.06"/>
  <g opacity="0.5" stroke="#ffffff" stroke-width="1" fill="none">
    <path d="M0 180 H960 M0 360 H960 M320 0 V540 M640 0 V540"/>
  </g>
  ${isShot ? `<g transform="translate(480 200)"><circle r="46" fill="rgba(0,0,0,0.35)"/><path d="M-14 -22 L26 0 L-14 22 Z" fill="#fff"/></g>` : ''}
  <text x="480" y="${isShot ? 300 : 250}" text-anchor="middle" font-family="Sora, sans-serif" font-size="26" font-weight="700" fill="#fff" opacity="0.95">${isShot ? 'SHOT PREVIEW' : 'START FRAME'}</text>
  <text x="480" y="${isShot ? 326 : 276}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#fff" opacity="0.6">mock render · add FAL_KEY to generate for real</text>
  ${lines.map((l, i) => `<text x="480" y="${(isShot ? 372 : 322) + i * 22}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="#ffffff" opacity="0.8">${escapeXml(l)}</text>`).join('')}
  <rect x="8" y="8" width="944" height="524" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
</svg>`;
  return { buffer: Buffer.from(svg), ext: 'svg', contentType: 'image/svg+xml', remoteUrl: null, mock: true, kind };
}

function wrap(s, n) {
  const words = s.split(' '); const out = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; }
  if (line.trim()) out.push(line.trim());
  return out;
}
function escapeXml(s) { return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
