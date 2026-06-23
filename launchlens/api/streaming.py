"""Run the graph and translate its event stream into frontend-friendly events.

This is the bridge between LangGraph and the React execution viewer. We run the
*same* compiled graph the CLI uses, but instead of printing a Rich trace
(``debug.py``) we emit small JSON events the browser can render live:

* ``run_start``  - a question started executing.
* ``node_start`` - a graph node began (carries its step number; nodes that share
  a step are running *in parallel* — that's the fan-out, made visible).
* ``tool_start`` / ``tool_end`` - a research node's tool call and its slim result.
* ``routing``    - the intent the router picked and which branches it fanned to.
* ``node_end``   - a node finished: its state delta, duration, and any error.
* ``checkpoint`` - the SqliteSaver persisted state (memory, made visible).
* ``final``      - the merged end state plus the verdict text.
* ``error`` / ``done`` - terminal markers.

Two implementation notes:

1. LangGraph's ``SqliteSaver`` is *synchronous* (it has no async methods), so we
   drive the graph with the blocking ``app.stream(...)`` and run it in a worker
   thread, pushing events onto an ``asyncio.Queue`` the SSE endpoint drains. That
   keeps the event loop free without needing an async checkpointer.
2. We stream with ``stream_mode=["debug", "updates", "values"]``: ``debug`` gives
   node task start/finish (and the step numbers that expose parallelism),
   ``updates`` gives each node's clean state delta, and ``values`` gives the final
   merged state.
"""

import asyncio
import threading
import time
from typing import Any, Iterator

from langchain_core.messages import HumanMessage

from ..debug import NODE_META
from ..graph import INTENT_PLAN
from .serializers import jsonable, message_to_dict, state_to_dict

# Which concrete tool each fan-out research node calls, and which key it writes
# into ``state['research']``. Used to synthesize tool_start/tool_end events so the
# Tool Trace viewer shows the real call + its slim result.
RESEARCH_NODE_TOOL = {
    "research_trends": ("google_trends", "trends"),
    "research_shopping": ("google_shopping", "shopping"),
    "research_news": ("google_news", "news"),
    "research_amazon": ("amazon_search", "amazon"),
    "research_reviews": ("amazon_reviews", "reviews"),
}


def _node_meta(node: str) -> dict:
    """Label/concept/colour for a node (reuses the CLI debug metadata)."""
    meta = NODE_META.get(node)
    if meta:
        return {
            "label": meta["title"],
            "concept": meta["concept"],
            "color": meta["color"],
            "blurb": meta["blurb"],
        }
    return {"label": node, "concept": "", "color": "white", "blurb": ""}


def _verdict_text(state: dict) -> str:
    """Pull the last plain assistant reply (the verdict) out of a state dict."""
    for message in reversed(state.get("messages", [])):
        data = message_to_dict(message)
        if data["role"] == "ai" and not data.get("tool_calls"):
            return data["content"]
    return ""


def _iter_graph_events(app, question: str, thread_id: str) -> Iterator[dict]:
    """Synchronously run the graph for one turn, yielding clean event dicts.

    This is a *blocking* generator (SqliteSaver is sync). The async layer runs it
    in a worker thread. Each yielded dict is one frontend event.
    """
    config = {"configurable": {"thread_id": thread_id}}
    inputs = {"messages": [HumanMessage(content=question)]}

    yield {"type": "run_start", "thread_id": thread_id, "question": question}

    # node id -> wall-clock start, so node_end can report a duration.
    start_times: dict[str, float] = {}
    # node name -> latest state delta seen on the "updates" stream.
    pending_delta: dict[str, dict] = {}
    final_state: dict | None = None

    for mode, payload in app.stream(
        inputs, config, stream_mode=["debug", "updates", "values"]
    ):
        if mode == "updates":
            # Stash each node's delta; node_end (below) serializes and emits it.
            for node, delta in payload.items():
                if node != "__interrupt__":
                    pending_delta[node] = delta if isinstance(delta, dict) else {}

        elif mode == "values":
            final_state = payload  # last one wins = the merged end state

        elif mode == "debug":
            kind = payload.get("type")
            data = payload.get("payload", {})

            if kind == "task":  # a node is about to run
                node = data.get("name")
                task_id = data.get("id")
                step = payload.get("step")
                start_times[task_id] = time.monotonic()
                yield {
                    "type": "node_start",
                    "node": node,
                    "step": step,
                    "task_id": task_id,
                    **_node_meta(node),
                }
                # A research node maps 1:1 to a tool call — announce it starting.
                if node in RESEARCH_NODE_TOOL:
                    tool_name, _ = RESEARCH_NODE_TOOL[node]
                    yield {
                        "type": "tool_start",
                        "node": node,
                        "tool": tool_name,
                        "input": data.get("input", {}).get("query", ""),
                    }

            elif kind == "task_result":  # a node just finished
                node = data.get("name")
                task_id = data.get("id")
                error = data.get("error")
                started = start_times.get(task_id)
                duration_ms = round((time.monotonic() - started) * 1000) if started else None
                delta = pending_delta.pop(node, {})

                # Surface the tool's slim result for the Tool Trace viewer.
                if node in RESEARCH_NODE_TOOL and isinstance(delta, dict):
                    tool_name, key = RESEARCH_NODE_TOOL[node]
                    result = (delta.get("research") or {}).get(key)
                    yield {
                        "type": "tool_end",
                        "node": node,
                        "tool": tool_name,
                        "output": jsonable(result),
                        "error": bool(isinstance(result, dict) and result.get("error")),
                    }

                # The router's decision is worth its own event for the UI.
                if node == "classify_intent" and isinstance(delta, dict):
                    intent = delta.get("intent")
                    yield {
                        "type": "routing",
                        "intent": intent,
                        "keyword": delta.get("keyword", ""),
                        "targets": INTENT_PLAN.get(intent, INTENT_PLAN["full"]),
                    }

                yield {
                    "type": "node_end",
                    "node": node,
                    "task_id": task_id,
                    "duration_ms": duration_ms,
                    "delta": jsonable(delta),
                    "error": str(error) if error else None,
                }

            elif kind == "checkpoint":  # the checkpointer persisted state
                yield {
                    "type": "checkpoint",
                    "step": payload.get("step"),
                    "next": list(data.get("next", [])),
                }

    # One final event with the whole end state + the verdict, for the State Viewer.
    yield {
        "type": "final",
        "state": state_to_dict(final_state),
        "verdict": _verdict_text(final_state or {}),
    }
    yield {"type": "done"}


async def stream_graph_events(app, question: str, thread_id: str):
    """Async generator of graph events, for the SSE endpoint.

    Bridges the blocking ``_iter_graph_events`` generator to asyncio: a worker
    thread runs the graph and pushes each event onto a queue; this coroutine
    yields them as they arrive. A run-level exception becomes an ``error`` event
    so one bad turn never kills the stream (mirrors the CLI's error rule).
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    _SENTINEL = object()

    def worker() -> None:
        try:
            for event in _iter_graph_events(app, question, thread_id):
                loop.call_soon_threadsafe(queue.put_nowait, event)
        except Exception as exc:  # degrade gracefully, never crash the stream
            loop.call_soon_threadsafe(
                queue.put_nowait, {"type": "error", "message": str(exc)}
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

    threading.Thread(target=worker, daemon=True).start()

    while True:
        event = await queue.get()
        if event is _SENTINEL:
            break
        yield event
