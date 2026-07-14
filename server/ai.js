// server/ai.js — language-model layer (Anthropic) with graceful mock fallback.
// Exposes a low-level llm() call plus a hasLLM() capability check.
// Higher-level "studio skills" live in skills.js.

const API = 'https://api.anthropic.com/v1/messages';

export function hasLLM() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function llmModel() {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
}

/**
 * Low-level call. messages: [{role:'user'|'assistant', content:string}]
 * Returns the assistant text. Throws on API error.
 */
export async function llm({ system, messages, maxTokens = 2000, temperature = 0.8 }) {
  if (!hasLLM()) throw new Error('NO_LLM_KEY');
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: llmModel(),
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

/**
 * Ask the model for JSON matching an expectation described in `instruction`.
 * Robustly extracts the first JSON object/array from the reply.
 */
export async function llmJSON({ system, messages, maxTokens = 2500 }) {
  const raw = await llm({
    system: (system || '') + '\n\nRespond with ONLY valid JSON. No markdown fences, no prose.',
    messages,
    maxTokens,
    temperature: 0.7,
  });
  return extractJSON(raw);
}

export function extractJSON(raw) {
  let s = raw.trim();
  // strip code fences if present
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in model reply');
  // find matching end by scanning
  const openCh = s[start];
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === openCh) depth++;
      else if (c === closeCh) { depth--; if (depth === 0) { end = i; break; } }
    }
  }
  if (end === -1) throw new Error('Unbalanced JSON in model reply');
  return JSON.parse(s.slice(start, end + 1));
}
