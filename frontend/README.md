# uball · VLM Play-by-Play — Frontend

A polished, client-facing demo frontend for the basketball VLM (video-language-model)
play-by-play tool. Built with **Vite + React + TypeScript + Tailwind CSS**.

Pick a game and a play from the backend (which reads from Supabase), watch the play's
clip alongside its structured CV output (events JSON), then run a Gemini model to get a
descriptive play-by-play (e.g. _"red #7 pulls a fadeaway, blocked by green #10"_).
Toggle the CV events on/off to show the accuracy difference. A **Manual upload** mode lets
you narrate any clip with optional events/context JSON.

## Requirements

- Node 20+ (developed against Node 24, npm 11)

## Install & run

```bash
npm install        # install dependencies
npm run dev        # start the dev server  ->  http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # preview the production build locally
```

Open <http://localhost:5173> after `npm run dev`.

## Backend

The frontend talks to the FastAPI backend at the base URL in `VITE_API_BASE`
(default `http://127.0.0.1:8000`). All routes live under `/api`.

Create a `.env` file (copy from `.env.example`) to point at a different backend:

```bash
cp .env.example .env
# edit VITE_API_BASE if needed
```

Endpoints used:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Connection status + server defaults |
| `GET /api/models?api_key=…` | Validate the Gemini key / list models |
| `GET /api/games` | List games |
| `GET /api/games/{id}/plays` | List plays for a game |
| `GET /api/plays/{id}` | Play detail (events + context) |
| `GET /api/plays/{id}/clip` | Streamed mp4 (used as a `<video src>`) |
| `POST /api/narrate_play` | Narrate a Supabase-backed play |
| `POST /api/narrate` | Narrate a manually-uploaded clip (multipart) |

## Settings

Open the gear button (top-right). Settings are persisted in the browser's
`localStorage` only:

- **Gemini API key** — sent to the backend (as the `api_key` field **and** the
  `X-Goog-Api-Key` header) only when narrating or testing the key. It never leaves your
  machine otherwise.
- **Default model** — `flash` (Gemini 3.5 Flash) or `pro` (Gemini 3.1 Pro).
- **FPS** — frames per second sampled from the clip (default 5).
- **Media resolution** — `low` / `medium` / `high` (default medium).

Use **Test key** to confirm the key works and see how many models it can access.

## Project structure

```
src/
├── App.tsx                  # shell: top bar, tabs, health check
├── main.tsx                 # React entry
├── index.css                # Tailwind + base styles
├── types.ts                 # API + domain types (mirror backend contract)
├── lib/
│   ├── api.ts               # typed fetch client for every endpoint
│   ├── storage.ts           # localStorage load/save for settings
│   ├── useSettings.ts       # settings hook (persisted)
│   ├── colors.ts            # jersey-color name -> hex resolver
│   └── format.ts            # time/range formatting
└── components/              # presentational + container components
```

## Notes

- Dark theme throughout; narration can take 10–40s and shows a loading state.
- All API errors (including FastAPI `{ "detail": … }`) are surfaced inline; the UI
  never crashes on a bad response.
