# 🖋 Inkwell — a local indie anime studio

Turn a one-sentence spark into a finished anime short. Inkwell runs **entirely on
your machine**: you develop a story with an AI creative director, then build the
script, characters, assets, style references, storyboard and shots — all in one
place, with the project stored as **plain files on disk** so you can also drive it
agentically from Claude Code.

```
idea  →  ideation chat  →  convert to project
                              │
        ┌─────────────────────┼──────────────────────────────┐
      Story   →   Script   →  Characters / Assets / Style  →  Storyboard
     (premise)  (screenplay)   (reference directories)      (frames → shots)
```

Everything is a feedback loop: change the story, then re-run the script,
characters or storyboard — the AI carries the old version forward and applies
just what changed.

## Quick start

```bash
npm install
cp .env.example .env      # optional — add keys to make it real
npm start                 # → http://localhost:4317
```

Open http://localhost:4317, type an idea in the prompt box, and go.

**No keys? No problem.** Inkwell ships with a built-in **mock mode** for both the
creative director and image/video generation, so you can explore the entire flow
offline. Placeholder art is rendered locally so the storyboard still works.

## Making it real

Add keys to `.env` and restart (`npm start`):

| Variable | What it powers | Where |
|---|---|---|
| `ANTHROPIC_API_KEY` | Story / script / character / prompt reasoning | https://console.anthropic.com |
| `FAL_KEY` | Start-frame images + Seedance shots | https://fal.ai/dashboard/keys |
| `FAL_IMAGE_MODEL` | Image model route (default `fal-ai/flux/dev`) | |
| `FAL_VIDEO_MODEL` | Video model route (default Seedance image-to-video) | |

## How it works

- **Frontend** — a no-build vanilla-JS single-page app in `public/`.
- **Server** — a small Express app in `server/` that holds your keys, proxies
  fal.ai (image + video, with job polling) and the language model, and reads/writes
  projects on disk.
- **Storage** — the filesystem is the source of truth. Each project is a folder:

  ```
  projects/<slug>/
    project.json           # authoritative structured data
    story.md, script.md    # human-readable mirrors
    characters/<name>/
      character.md
      refs/                # T-pose, emotions, repeated poses
    assets/…  style/…
    media/scenes/<id>/     # generated frames + shots
  ```

Because it's all plain files, you can open `projects/<slug>/` in Claude Code and
edit the story, script, or scene prompts by hand — the UI picks up the changes.

## The studio, tab by tab

- **Story** — your two-paragraph premise. Edit directly, or give the AI a note
  ("darken the second half", "add a betrayal") and iterate.
- **Script** — extract a shooting script from the story; agentically update it
  ("add the new 7th character in act 2").
- **Characters** — extract the cast, then give each a reference directory: T-pose,
  emotions, and repeated poses (fight, sport…). Link assets to characters.
- **Assets** — recurring places and props (a home, a bed, a favorite item).
- **Style Refs** — global look-and-feel references injected into every frame prompt.
- **Storyboard** — each scene becomes a shot. Generate the start frame (linked to
  your character + style refs), then drive it into a Seedance shot. Regenerate
  either the frame or the shot with feedback — the AI improves the prompt.

## Roadmap notes

- **Voice** — an open question: let Seedance handle character voices, or use a
  dedicated TTS (e.g. ElevenLabs) and solve lip-sync separately. The local server
  is the right place to add either — audio can be stored next to each shot.
- Export cuts each shot as a file you can drop into an editor (CapCut, etc.).
