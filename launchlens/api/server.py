"""FastAPI server that exposes the LaunchLens graph to a React frontend.

The CLI (``cli.py``) and this server are two front-ends over the *same* compiled
graph — neither changes the 5 graded concepts. This module adds:

* ``GET  /api/config``            - active LLM provider + the selectable providers.
* ``POST /api/config``            - switch the active LLM provider at runtime.
* ``GET  /api/graph``             - the static node/edge topology to draw.
* ``POST /api/chat``              - run one turn, streamed as Server-Sent Events
  (node-by-node execution, tool calls, routing, checkpoints, final verdict).
* ``GET  /api/threads``           - list saved conversations (one per thread_id).
* ``POST /api/threads``           - mint a fresh conversation id.
* ``GET  /api/threads/{id}/state``- the current checkpointed state of a thread.

The graph (with its SQLite checkpointer) is built once at startup and shared.
"""

import json
import os
import sqlite3
import uuid
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from ..config import VALID_PROVIDERS, get_provider, is_mock
from ..debug import NODE_META
from ..graph import INTENT_PLAN, build_graph
from ..memory import DEFAULT_DB_PATH
from .serializers import state_to_dict
from .streaming import stream_graph_events

# One stable id for the conversation the CLI also uses, so the UI and CLI can
# share a thread if desired. New UI sessions mint their own ids via POST.
DEFAULT_THREAD_ID = "launchlens-cli"


def _provider_available(name: str) -> bool:
    """Whether a provider can actually run right now (mock always; others need a key).

    Switching to openai/anthropic only works if the matching API key is present in
    the environment, so the UI greys out providers it can't use.
    """
    if name == "mock":
        return True
    if name == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    if name == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    return False


def _config_payload() -> dict:
    """The current provider + the selectable provider list, for the UI."""
    return {
        "provider": get_provider(),
        "mock": is_mock(),
        "default_thread_id": DEFAULT_THREAD_ID,
        "providers": [
            {"name": p, "available": _provider_available(p)} for p in VALID_PROVIDERS
        ],
    }


@lru_cache(maxsize=1)
def get_app():
    """Build the compiled graph once and cache it for the server's lifetime.

    Caching matters: building the graph opens the SQLite checkpointer, and we
    want a single shared instance across all requests (the CLI does the same with
    one ``build_graph()`` call).
    """
    return build_graph()


# ---------------------------------------------------------------------------
# Graph topology — a static description of the nodes/edges so the frontend can
# draw the graph without re-deriving it. Mirrors how build_graph() wires things.
# ---------------------------------------------------------------------------
def _graph_topology() -> dict:
    """Return nodes + edges describing START -> ... -> END for the visualizer."""
    research_nodes = INTENT_PLAN["full"]  # all five fan-out leaves

    nodes = [{"id": "__start__", "label": "START", "concept": "", "color": "white", "group": "control"}]
    for node, meta in NODE_META.items():
        group = "research" if node in research_nodes else "main"
        nodes.append(
            {
                "id": node,
                "label": meta["title"],
                "concept": meta["concept"],
                "color": meta["color"],
                "blurb": meta["blurb"],
                "group": group,
            }
        )
    nodes.append({"id": "__end__", "label": "END", "concept": "", "color": "white", "group": "control"})

    edges = [
        {"source": "__start__", "target": "summarize_if_needed", "kind": "normal"},
        {"source": "summarize_if_needed", "target": "classify_intent", "kind": "normal"},
    ]
    # The router fans out to every research node via a conditional Send() edge.
    for node in research_nodes:
        edges.append({"source": "classify_intent", "target": node, "kind": "conditional"})
        edges.append({"source": node, "target": "agent", "kind": "normal"})
    edges.append({"source": "agent", "target": "__end__", "kind": "normal"})

    return {"nodes": nodes, "edges": edges, "intent_plan": INTENT_PLAN}


def _list_threads() -> list[dict]:
    """List distinct conversation thread_ids stored by the checkpointer.

    We read the SQLite file directly (read-only) for the distinct thread ids and
    each one's latest stored question — enough for a session switcher. If the
    table doesn't exist yet (no chats stored), we return just the default thread.
    """
    threads: list[dict] = []
    try:
        conn = sqlite3.connect(f"file:{DEFAULT_DB_PATH}?mode=ro", uri=True)
        try:
            rows = conn.execute(
                "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_id"
            ).fetchall()
            threads = [{"thread_id": r[0]} for r in rows]
        finally:
            conn.close()
    except sqlite3.OperationalError:
        pass  # no checkpoints table yet

    if not any(t["thread_id"] == DEFAULT_THREAD_ID for t in threads):
        threads.insert(0, {"thread_id": DEFAULT_THREAD_ID})
    return threads


# ---------------------------------------------------------------------------
# FastAPI app + routes
# ---------------------------------------------------------------------------
app = FastAPI(title="LaunchLens API", version="0.1.0")

# The React dev server (Vite) runs on a different origin; allow it to call us.
# Wide-open CORS is fine for a local demo — tighten allow_origins for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Body for POST /api/chat: the founder's question + which conversation."""

    question: str
    thread_id: str = DEFAULT_THREAD_ID


class ProviderRequest(BaseModel):
    """Body for POST /api/config: the LLM provider to switch to."""

    provider: str


@app.get("/api/config")
def config():
    """Report the active LLM provider + the providers the UI can switch between."""
    return _config_payload()


@app.post("/api/config")
def set_provider(req: ProviderRequest):
    """Switch the active LLM provider at runtime (mock | openai | anthropic).

    The graph reads the provider *fresh on every turn* (``get_llm()`` runs inside
    the agent node, tools call ``is_mock()`` per call), so flipping the
    ``LLM_PROVIDER`` env var here changes the *next* chat turn without rebuilding
    the graph. We reject unknown providers and ones whose API key is missing, so
    the user gets a clear error instead of a failed run mid-stream.
    """
    provider = req.provider.strip().lower()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{provider}'. Choose from {list(VALID_PROVIDERS)}.",
        )
    if not _provider_available(provider):
        key = "OPENAI_API_KEY" if provider == "openai" else "ANTHROPIC_API_KEY"
        raise HTTPException(
            status_code=400,
            detail=f"Cannot switch to '{provider}': {key} is not set in the environment.",
        )
    os.environ["LLM_PROVIDER"] = provider
    return _config_payload()


@app.get("/api/graph")
def graph():
    """Return the static graph topology for the visualizer."""
    return _graph_topology()


@app.get("/api/threads")
def threads():
    """List saved conversations (thread ids)."""
    return {"threads": _list_threads()}


@app.post("/api/threads")
def create_thread():
    """Mint a fresh conversation id for a new UI session."""
    return {"thread_id": f"ui-{uuid.uuid4().hex[:12]}"}


@app.get("/api/threads/{thread_id}/state")
def thread_state(thread_id: str):
    """Return the current checkpointed state of one conversation.

    Used by the State Viewer and to rehydrate the chat transcript when the UI
    reconnects to an existing thread.
    """
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = get_app().get_state(config)
    return {"thread_id": thread_id, "state": state_to_dict(snapshot.values or {})}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Run one turn and stream the graph's execution as Server-Sent Events.

    Each SSE message's ``event`` is the event type (node_start, tool_end, …) and
    its ``data`` is the full JSON payload, so the frontend can switch on either.
    """

    async def event_source():
        async for event in stream_graph_events(get_app(), req.question, req.thread_id):
            yield {"event": event["type"], "data": json.dumps(event)}

    return EventSourceResponse(event_source())


def run() -> None:
    """Entry point for ``uv run launchlens-api`` — serve on localhost:8000."""
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    run()
