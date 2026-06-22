# VLM_Basketball — research & testing demo

A small full-stack app to **test how well a VLM (Gemini) narrates basketball plays** and to
**show the client our progress** on the VLM layer. You pick a game → a play (loaded live from
the Supabase annotation DB), see the play's **clip** and its **structured events JSON**, then
run **Gemini 3.5 Flash / 3.1 Pro** to get a descriptive **play-by-play** — e.g.
*"red #7 pulls a fadeaway, blocked by green #10."* Events can be toggled **on/off** to show how
much the world-model context changes the output.

> **Scope:** research/testing only. The production VLM architecture lives in the SAM3 repo
> (see [Relationship to SAM3](#relationship-to-sam3)); we integrate there later. This repo is
> the playground to validate model choice, FPS, and grounding before that.

## Architecture

```
 React + Vite + Tailwind (frontend/)        FastAPI (backend/)                external
 ┌───────────────────────────┐   /api   ┌──────────────────────────┐
 │ pick game → play           │ ───────► │ Supabase REST  ──────────┼──►  plays / games /
 │ video + events JSON viewer │          │  (events + clip window)  │     video_metadata
 │ model / fps / api-key UI   │          │ S3 + ffmpeg → clip       │ ──► uball-videos-prod
 │ narration output           │ ◄─────── │ google-genai → Gemini    │ ──► Gemini 3.5/3.1
 └───────────────────────────┘          └──────────────────────────┘
```

## Where the structured output comes from (provenance)

The "structured output" is the **`events` (jsonb) column of the `plays` table** in the Supabase
**annotation** project **`mhbrsftxvxxtfgbajrlc`** (the same DB the annotation tool / Supabase MCP
reads). Per play we also use `classification`, `player_a/b`, `note`, `start/end_timestamp`,
`angle`, plus the game's `team1/2_color` and `roster_team1/2` for grounding, and
`video_metadata.s3_key` + `sync_offset_seconds` to cut the exact clip from S3. Schema reference:
SAM3 `docs/14_games_and_clips.md`.

The backend reaches this over **Supabase REST** with `SUPABASE_URL` + `SUPABASE_KEY` — set them in
`backend/.env`. (The annotation-tool **Supabase MCP** points at the same project; this app uses a
direct REST key so it can run standalone. Column names are read defensively — adjust
`backend/app/supabase_client.py` if the live schema differs.)

## Quick start

### Backend
```bash
python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env        # fill GOOGLE_API_KEY, SUPABASE_URL/KEY, AWS creds
python backend/run.py                        # http://127.0.0.1:8000  (docs at /docs)
```

### Frontend
```bash
cd frontend && npm install && npm run dev     # http://localhost:5173  (talks to :8000)
```

Open the UI → **Settings** → paste your **Gemini API key** (stored in your browser only) → pick a
game/play → **Narrate**. Toggle **Use events** to compare grounded vs pixel-only. A **Manual
upload** tab lets you test any clip + pasted JSON.

## Models (verified against ai.google.dev, June 2026)

| UI option | Model id | Status |
|---|---|---|
| **flash** (default) | `gemini-3.5-flash` | GA |
| **pro** | `gemini-3.1-pro-preview` | preview |

Native video at a configurable **fps** (default **5**, good for fast action) and `media_resolution`
(`high` helps read small jersey numbers at ~4× tokens). Override model ids via
`VLM_FLASH_MODEL` / `VLM_PRO_MODEL`.

## API (backend)

`GET /api/health` · `GET /api/models` · `GET /api/games` · `GET /api/games/{id}/plays` ·
`GET /api/plays/{id}` · `GET /api/plays/{id}/clip` · `POST /api/narrate_play` · `POST /api/narrate`.
The Gemini key is sent per-request (`api_key` field or `X-Goog-Api-Key` header), falling back to
`GOOGLE_API_KEY` in `backend/.env`.

## Research

The VLM model-selection research (why Gemini native-video + CV-grounded identity, the Twelve Labs
verdict, the bake-off plan) is in **[docs/vlm_research.md](docs/vlm_research.md)** (mirrored from
SAM3 `docs/15_vlm_research.md`).

## Relationship to SAM3

This repo is **research/testing**; the production system is
**`Tracking-Cross_camera_association-SAM3`** (the 4-camera tracking + cross-camera fusion + world
model + VLM narration architecture). The VLM layer designed in SAM3 `docs/09_vlm_narration.md`
will be integrated into that pipeline later. Keep the two in sync:
- SAM3 `docs/15_vlm_research.md` ⇄ this repo's `docs/vlm_research.md` (research source of truth).
- The `events` JSON shape here mirrors SAM3 `docs/08_world_model.md`.

## Privacy

Google's **paid** Gemini API does **not** train on your prompts/video; the **free** tier does —
use a paid key for real game footage. Uploaded clips are deleted from the Files API after each call.
