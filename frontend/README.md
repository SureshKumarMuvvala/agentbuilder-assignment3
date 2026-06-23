# LaunchLens UI — LangGraph Execution Viewer

A LangSmith-style viewer for the LaunchLens graph. It does **not** replace the
CLI; it's a second front-end over the *same* compiled graph, built to make the 5
graded LangGraph concepts visible in ~30 seconds:

| Panel | Concept it surfaces |
|---|---|
| **Graph** (left) | Typed StateGraph topology + **fan-out** (the 5 research nodes light up together in one superstep) |
| **Inspector** tab | Node-by-node timeline, durations, and per-node **state deltas** |
| **Tools** tab | Every tool call with its slim `<200 byte` result (demand vs supply colour-coded) — **Agent + Tools** |
| **State** tab | Live `intent` (**routing**), merged `research` dict (`operator.or_`), message count |
| **Memory** tab | **SqliteSaver checkpoints** written per superstep |
| **Chat** (right) | Transcript + input; memory persists per `thread_id` |

## Run it (two processes)

**1. Backend** (FastAPI, from the repo root):

```bash
uv run launchlens-api          # serves http://127.0.0.1:8000
# or: uv run uvicorn launchlens.api.server:app --port 8000
```

**2. Frontend** (Vite dev server, from `frontend/`):

```bash
npm install
npm run dev                    # serves http://localhost:5173
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the backend, so there's
no CORS setup in dev. Mock mode (the default, `LLM_PROVIDER=mock`) needs no API
keys — tools read from `fixtures/`.

## How it connects

- `GET /api/config` — LLM provider badge
- `GET /api/graph` — static topology drawn by the Graph panel
- `POST /api/chat` — **SSE stream** of `node_start` / `node_end` / `tool_*` /
  `routing` / `checkpoint` / `final` events (the live execution)
- `GET /api/threads`, `POST /api/threads`, `GET /api/threads/{id}/state` —
  session switching + rehydrating a conversation's checkpointed state

The backend lives in `launchlens/api/` (`server.py`, `streaming.py`,
`serializers.py`) and changes nothing about the graph itself.
