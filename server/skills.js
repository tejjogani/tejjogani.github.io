// server/skills.js — high-level "studio" operations.
// Each skill uses the real LLM when a key is present, else a plausible mock
// so the entire flow is explorable offline.

import { hasLLM, llm, llmJSON } from './ai.js';

const STUDIO_SYSTEM =
  'You are the creative director of Inkwell, an indie anime studio. You help a solo creator ' +
  'develop original anime shorts. You are concrete, visual, and story-first. You think like a ' +
  'director: clear conflict, characters with real interiority, and a resolution that lands. ' +
  'Keep an anime sensibility — expressive emotion, strong silhouettes, cinematic framing.';

/* ------------------------------------------------------------------ *
 * IDEATION — chat toward a story proposal
 * ------------------------------------------------------------------ */
export async function ideate({ history, message }) {
  const convo = [...(history || []), { role: 'user', content: message }];

  if (hasLLM()) {
    const sys = STUDIO_SYSTEM + `

You are in an ideation conversation. Decide whether to (a) ask ONE sharp follow-up question to
sharpen the idea, or (b) present a story proposal. Prefer proposing once you have enough to work with.

Return JSON of shape:
{
  "reply": "conversational message to the creator (markdown ok)",
  "proposal": null OR {
     "title": "...",
     "logline": "one vivid sentence",
     "premise": "TWO paragraphs. P1 sets world+characters+the central conflict. P2 escalates and resolves.",
     "meta": { "runtime": "e.g. 30 min", "style": "visual style", "setting": "when/where", "genre": "..." },
     "characters": ["Name — one-line role", ...],
     "conflict": "the core dramatic engine in one line",
     "resolution": "how it ends, one line"
  }
}
If you are only asking a question, set "proposal" to null.`;
    try {
      return await llmJSON({ system: sys, messages: convo, maxTokens: 1600 });
    } catch (e) {
      // fall through to mock on any parsing/API hiccup
    }
  }
  return mockIdeate(convo, message);
}

/* ------------------------------------------------------------------ *
 * STORY — enhance the premise with feedback
 * ------------------------------------------------------------------ */
export async function enhanceStory({ story, feedback, meta }) {
  if (hasLLM()) {
    const sys = STUDIO_SYSTEM + '\nRewrite/expand the story premise applying the note. Keep it tight ' +
      'and cinematic. Return ONLY the new prose (2–4 paragraphs), no preamble.';
    try {
      return await llm({
        system: sys,
        messages: [{ role: 'user', content: `CURRENT STORY:\n${story}\n\nNOTE: ${feedback || 'Deepen it — sharpen the conflict and the emotional turn.'}` }],
        maxTokens: 1400,
      });
    } catch (e) {}
  }
  return mockEnhanceStory(story, feedback);
}

/* ------------------------------------------------------------------ *
 * SCRIPT — extract/update a script from the story
 * ------------------------------------------------------------------ */
export async function extractScript({ story, characters, existingScript, note }) {
  const chars = (characters || []).map(c => `${c.name} (${c.role || 'character'})`).join(', ');
  if (hasLLM()) {
    const sys = STUDIO_SYSTEM + `\nWrite/rewrite a shooting script for a short anime based on the story.
Use scene headings (INT./EXT. — LOCATION — TIME), action lines, and character dialogue.
Give characters distinct voices reflecting their egos. Keep it filmable and paced for the runtime.
If an EXISTING SCRIPT and a NOTE are given, preserve what works and apply the note (e.g. add a character/scene).
Return ONLY the script text.`;
    const parts = [`STORY:\n${story}`, chars && `CHARACTERS: ${chars}`, existingScript && `EXISTING SCRIPT:\n${existingScript}`, note && `NOTE: ${note}`].filter(Boolean);
    try {
      return await llm({ system: sys, messages: [{ role: 'user', content: parts.join('\n\n') }], maxTokens: 3200 });
    } catch (e) {}
  }
  return mockScript(story, characters, existingScript, note);
}

/* ------------------------------------------------------------------ *
 * CHARACTERS — extract the cast from story + script
 * ------------------------------------------------------------------ */
export async function extractCharacters({ story, script, existing }) {
  if (hasLLM()) {
    const sys = STUDIO_SYSTEM + `\nIdentify the characters. For each return name, role, ego (their driving
psychology / attitude in a phrase), and a physical+wardrobe description usable as an image reference brief.
If EXISTING characters are provided, keep their ids/names and only ADD missing ones or refine descriptions.
Return JSON array: [{ "name","role","ego","description" }].`;
    const parts = [`STORY:\n${story}`, script && `SCRIPT:\n${script.slice(0, 6000)}`, existing?.length && `EXISTING: ${existing.map(c => c.name).join(', ')}`].filter(Boolean);
    try {
      const arr = await llmJSON({ system: sys, messages: [{ role: 'user', content: parts.join('\n\n') }], maxTokens: 2200 });
      return Array.isArray(arr) ? arr : [];
    } catch (e) {}
  }
  return mockCharacters(story, script, existing);
}

/* ------------------------------------------------------------------ *
 * SCENES — break the script into shots/scenes for storyboarding
 * ------------------------------------------------------------------ */
export async function extractScenes({ script, story, characters, assets, existing }) {
  if (hasLLM()) {
    const sys = STUDIO_SYSTEM + `\nBreak the script into an ordered list of filmable scenes/shots for storyboarding.
For each scene give: a short title, a one-paragraph visual description (what we SEE — framing, action, mood),
the character names present, and any asset/location names used. Keep 4–14 scenes for a short.
If EXISTING scenes are provided, preserve them and only add/adjust to match the current script.
Return JSON array: [{ "title","description","characterNames":[],"assetNames":[],"shot":"e.g. wide/close/OTS" }].`;
    const chars = (characters || []).map(c => c.name).join(', ');
    const parts = [`SCRIPT:\n${script}`, chars && `CHARACTERS: ${chars}`, existing?.length && `EXISTING SCENES: ${existing.length}`].filter(Boolean);
    try {
      const arr = await llmJSON({ system: sys, messages: [{ role: 'user', content: parts.join('\n\n') }], maxTokens: 3000 });
      return Array.isArray(arr) ? arr : [];
    } catch (e) {}
  }
  return mockScenes(script, characters, assets, existing);
}

/* ------------------------------------------------------------------ *
 * PROMPTS — build the start-frame prompt and the shot (video) prompt
 * ------------------------------------------------------------------ */
export async function buildFramePrompt({ scene, characters, assets, styleRefs, note }) {
  const charBriefs = (characters || []).filter(c => (scene.characterNames || []).includes(c.name))
    .map(c => `${c.name}: ${c.description || c.role}`).join('; ');
  const style = (styleRefs || []).map(s => s.description || s.name).join(', ');
  if (hasLLM()) {
    const sys = 'You write image-generation prompts for anime start frames. Output a single dense prompt: ' +
      'subject + action + composition/framing + lighting + anime style descriptors. Integrate the given ' +
      'character and style references by name so they can be linked. Return ONLY the prompt.';
    try {
      return await llm({
        system: sys,
        messages: [{ role: 'user', content: `SCENE: ${scene.title}\n${scene.description}\nSHOT: ${scene.shot || ''}\nCHARACTERS: ${charBriefs}\nSTYLE REFERENCES: ${style || 'anime, cinematic'}\n${note ? 'NOTE: ' + note : ''}` }],
        maxTokens: 500, temperature: 0.7,
      });
    } catch (e) {}
  }
  return mockFramePrompt(scene, charBriefs, style, note);
}

export async function buildShotPrompt({ scene, framePrompt, note }) {
  if (hasLLM()) {
    const sys = 'You write image-to-video prompts for Seedance. Given a start frame and scene, describe the ' +
      'MOTION: camera move, character action beats, timing, and mood over the shot. Return ONLY the prompt.';
    try {
      return await llm({
        system: sys,
        messages: [{ role: 'user', content: `START FRAME PROMPT: ${framePrompt}\nSCENE: ${scene.title} — ${scene.description}\n${note ? 'FEEDBACK: ' + note : ''}` }],
        maxTokens: 400, temperature: 0.7,
      });
    } catch (e) {}
  }
  return mockShotPrompt(scene, framePrompt, note);
}

export async function improvePrompt({ current, feedback, kind }) {
  if (hasLLM()) {
    const sys = `You refine ${kind === 'shot' ? 'video (motion)' : 'image'} generation prompts. Apply the ` +
      'feedback and return ONLY the improved prompt.';
    try {
      return await llm({ system: sys, messages: [{ role: 'user', content: `CURRENT PROMPT:\n${current}\n\nFEEDBACK: ${feedback}` }], maxTokens: 500, temperature: 0.6 });
    } catch (e) {}
  }
  return `${current}\n\n[revised: ${feedback}]`;
}

/* ================================================================== *
 * MOCK IMPLEMENTATIONS (used when no ANTHROPIC_API_KEY)
 * ================================================================== */
function pick(arr, i) { return arr[i % arr.length]; }
function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

function deriveTitle(idea) {
  const t = idea.toLowerCase();
  if (t.includes('romeo') || t.includes('juliet')) return 'Neon Vows';
  if (t.includes('samurai')) return 'The Last Cadence';
  if (t.includes('space') || t.includes('2100') || t.includes('cyber')) return 'Signal & Ash';
  const words = idea.split(/\s+/).filter(w => w.length > 3);
  return titleCase((words[0] || 'Untitled') + ' ' + (words[1] || 'Bloom'));
}

function mockIdeate(convo, message) {
  const priorProposal = convo.some(m => m.role === 'assistant' && /premise|proposal/i.test(m.content));
  const userTurns = convo.filter(m => m.role === 'user');
  const idea = userTurns.map(m => m.content).join(' ');
  const short = message.trim().split(/\s+/).length < 5 && !priorProposal;

  if (short) {
    return {
      reply: `Love where this is going. A couple of quick calls so I can shape the right story:\n\n- **Runtime & scope** — are we aiming at a ~30 min short, or something tighter?\n- **Tone** — grounded and bittersweet, or heightened and operatic?\n- **The hook** — what's the one image or feeling you want the audience to leave with?\n\nGive me a line on any of those and I'll draft a full premise.`,
      proposal: null,
    };
  }

  const title = deriveTitle(idea);
  const isRJ = /romeo|juliet|love/i.test(idea);
  const yearMatch = idea.match(/\b(20|21|22)\d{2}\b/);
  const setting = yearMatch ? `Year ${yearMatch[0]}` : (isRJ ? 'a divided neon metropolis' : 'a near-future city');
  const runtime = (idea.match(/\b(\d{1,3})\s*min/) || [])[1];

  const premise = isRJ
    ? `In ${setting}, two arcology-states share a sky but not a citizenship. **Rui**, a courier for the lower tiers, and **Aya**, heir to the tower that farms the city's light, meet in the three-minute window when their transit lines cross. What starts as a dropped message becomes a nightly ritual — two people falling in love across a border their families built to keep apart. Every meeting is stolen from systems designed to catch them.\n\nWhen Aya's house moves to seal the last open crossing, the lovers gamble everything on one final run to be on the same side before the gates close forever. They make it — but only one of them does, and the survivor spends the rest of the night rewriting the city's light so the other's name is the first thing it says at dawn. The vow outlives the vow-makers: the border flickers, and the two towers, for the first time, share a single color.`
    : `In ${setting}, an ordinary life is interrupted by a signal no one else can hear. Our protagonist follows it against every sensible instinct, and finds a person — or a memory of one — waiting at the other end. The pull between what's safe and what's true becomes the engine of the story, and the world quietly reorganizes itself around their choice.\n\nAs the stakes sharpen, the protagonist must decide what they're willing to lose to keep the connection real. The resolution isn't a rescue — it's an acceptance, rendered in a single held image that recolors everything that came before. We end changed, and so do they.`;

  return {
    reply: `Here's a first pass — a **${runtime ? runtime + '-minute anime short' : 'short anime'}** I think fits your spark. Read the premise, then tell me what to push on (a twist, a wilder character, a different ending) and I'll revise. When it feels right, convert it to a project.`,
    proposal: {
      title,
      logline: isRJ
        ? 'Two lovers on opposite sides of a walled sky steal three minutes a night — until the night the wall closes for good.'
        : 'One person follows a signal no one else can hear, and has to decide what a true connection is worth.',
      premise,
      meta: {
        runtime: runtime ? `${runtime} min` : '30 min',
        style: 'Cinematic anime, painterly backgrounds, expressive character acting',
        setting,
        genre: isRJ ? 'Romance / Tragedy' : 'Drama / Speculative',
      },
      characters: isRJ
        ? ['Rui — lower-tier courier, reckless and warm', 'Aya — tower heir, precise and quietly rebellious', 'Mother Sena — Aya\'s guardian, the story\'s cold logic', 'Old Kessel — Rui\'s mentor, comic relief with a scar']
        : ['The Listener — protagonist chasing the signal', 'The Voice — the person on the other end', 'The Skeptic — the friend who anchors them'],
      conflict: isRJ ? 'Love across a border their families exist to enforce.' : 'Safety versus a truth that demands everything.',
      resolution: isRJ ? 'One crosses, one doesn\'t — and the survivor rewrites the city\'s light into a vow.' : 'Not a rescue but an acceptance, held in one final image.',
    },
  };
}

function mockEnhanceStory(story, feedback) {
  const add = feedback
    ? `\n\nApplying your note — *${feedback}* — the middle now turns harder: a choice that looked like a rescue is revealed as a trade, and the cost lands on the character we least want to pay it.`
    : `\n\nThe conflict tightens: what the protagonist wants and what they fear become the same object, so every step toward the goal is also a step toward the wound.`;
  return story.trim() + add;
}

function mockScript(story, characters, existing, note) {
  const cast = (characters && characters.length ? characters : [{ name: 'RUI' }, { name: 'AYA' }]).map(c => c.name.toUpperCase());
  const header = existing
    ? `/* Updated script — ${note ? 'applied: ' + note : 'regenerated from current story'} */\n\n`
    : '';
  return header + `FADE IN:

EXT. TRANSIT SPINE — DUSK

The city is a stack of lit terraces. A courier line and a private tower line cross for exactly three minutes.

${cast[0]} (20s, jacket a size too big) rides the courier rail, one hand out in the wind.

${cast[0]}
(to no one)
Three minutes. Same as yesterday. Same as never.

A second rail glides in alongside. ${cast[1] || 'AYA'} stands at the rail, composed, a thin band of tower-light at her collar.

${cast[1] || 'AYA'}
You always talk to the wind?

${cast[0]}
Only when it talks back.

They hold each other's eyes as the lines begin to separate.

CUT TO:

INT. TOWER — CONTROL SPINE — NIGHT

${cast[2] || 'MOTHER SENA'} watches a map of the city's crossings. One by one, she closes them.

${cast[2] || 'MOTHER SENA'}
Every open door is a debt. Seal it.

EXT. LAST CROSSING — NIGHT

Alarms bloom. ${cast[0]} runs the rail on foot as the gate irises shut.

${cast[0]}
Aya — jump. I'll catch the light, you catch me.

She jumps. The gate closes on a held breath.

FADE TO WHITE.

/* Beat sheet continues — regenerate to extend, or add a note to revise. */
`;
}

function mockCharacters(story, script, existing) {
  const base = [
    { name: 'Rui', role: 'Protagonist — courier', ego: 'Reckless warmth; believes borders are just dares.', description: 'Early 20s, wiry, cropped dark hair with an undercut, oversized courier jacket in faded orange, fingerless gloves, a scar through one eyebrow. Perpetual half-smile.' },
    { name: 'Aya', role: 'Deuteragonist — tower heir', ego: 'Precise, quietly rebellious; rehearses freedom she never takes.', description: 'Early 20s, tall, straight black hair to the shoulder, high-collar tower uniform with a thin band of light at the throat, immaculate posture. Eyes that give her away.' },
    { name: 'Mother Sena', role: 'Antagonist — guardian', ego: 'Love expressed as control; certain she is protecting.', description: '50s, silver-streaked hair in a hard knot, charcoal architectural robes, moves like she has already won.' },
    { name: 'Kessel', role: 'Mentor — comic relief', ego: 'Gruff, sentimental, hides advice inside complaints.', description: '60s, broad, burn scar down one forearm, tool-harness, a laugh like gravel.' },
  ];
  const have = new Set((existing || []).map(c => c.name.toLowerCase()));
  return base.filter(c => !have.has(c.name.toLowerCase()));
}

function mockScenes(script, characters, assets, existing) {
  const c = (characters || []).map(x => x.name);
  const A = c[0] || 'Rui', B = c[1] || 'Aya', ANT = c[2] || 'Mother Sena';
  const scenes = [
    { title: 'The Crossing', description: 'Wide establishing of the stacked neon city at dusk; two transit lines drift toward each other across a canyon of light.', characterNames: [], assetNames: ['Transit Spine'], shot: 'wide establishing' },
    { title: 'Three Minutes', description: `${A} rides the courier rail, hand in the wind. The second rail glides alongside and ${B} appears, composed, backlit by tower glow. First eye contact.`, characterNames: [A, B], assetNames: ['Transit Spine'], shot: 'two-shot / OTS' },
    { title: 'Talks Back', description: `Close on ${A}'s half-smile, then ${B}'s guarded one. The gap between rails widens as they speak; the city slides behind them.`, characterNames: [A, B], assetNames: [], shot: 'intercut close-ups' },
    { title: 'The Ledger', description: `Interior tower control spine. ${ANT} stands before a living map of the city's crossings and begins closing them, one light at a time.`, characterNames: [ANT], assetNames: ['Control Spine'], shot: 'wide, cold symmetry' },
    { title: 'Last Crossing', description: `Alarms bloom red. ${A} sprints a narrowing rail on foot as an iris gate begins to close. Urgent handheld energy.`, characterNames: [A], assetNames: ['Last Crossing Gate'], shot: 'tracking / handheld' },
    { title: 'The Jump', description: `${B} jumps the gap toward ${A} as the gate irises shut. Time stretches; the city holds its breath.`, characterNames: [A, B], assetNames: ['Last Crossing Gate'], shot: 'slow-motion close' },
    { title: 'Dawn Vow', description: 'The survivor stands alone as the city\'s light shifts; for the first time both towers share a single color at dawn.', characterNames: [A], assetNames: ['Skyline'], shot: 'wide, held' },
  ];
  const startAt = (existing || []).length;
  return scenes.slice(startAt);
}

function mockFramePrompt(scene, charBriefs, style, note) {
  return [
    `${scene.description}`,
    scene.shot ? `Framing: ${scene.shot}.` : '',
    charBriefs ? `Characters — ${charBriefs}.` : '',
    `Style: ${style || 'cinematic anime, painterly backgrounds, expressive character acting, volumetric neon lighting, film grain'}.`,
    `Composition: strong silhouette, rule-of-thirds, atmospheric depth. 16:9 start frame.`,
    note ? `Note: ${note}.` : '',
  ].filter(Boolean).join(' ');
}

function mockShotPrompt(scene, framePrompt, note) {
  return [
    `Animate the start frame. ${scene.description}`,
    `Camera: slow push-in with subtle parallax on the neon layers.`,
    `Character motion: natural weight, hair and fabric drift, one clear emotional beat.`,
    `Duration ~5s, 24fps anime cadence, hold the final expression.`,
    note ? `Revision: ${note}.` : '',
  ].filter(Boolean).join(' ');
}
