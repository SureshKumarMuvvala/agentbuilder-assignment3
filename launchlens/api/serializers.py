"""Turn LangChain message + graph-state objects into plain JSON.

The frontend speaks JSON, but LangGraph state is full of Python objects:
``HumanMessage``, ``AIMessage`` (sometimes carrying ``tool_calls``),
``SystemMessage``, ``ToolMessage``, and ``RemoveMessage`` (the summarizer's
"forget this turn" marker). This module is the single place that flattens those
into dicts the React inspector can render. Keeping it in one file means the API
has exactly one definition of "what a message looks like on the wire".
"""

from typing import Any

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)

# Map each LangChain message class to the short ``role`` the frontend uses to
# colour-code the transcript. Anything unknown falls back to "other".
_ROLE = {
    HumanMessage: "human",
    AIMessage: "ai",
    SystemMessage: "system",
    ToolMessage: "tool",
    RemoveMessage: "remove",
}


def _role_of(message: Any) -> str:
    """Return the short role string for a message instance."""
    for cls, role in _ROLE.items():
        if isinstance(message, cls):
            return role
    return "other"


def message_to_dict(message: Any) -> dict:
    """Flatten one LangChain message into a JSON-safe dict.

    Inputs : a single message object from ``state['messages']``.
    Outputs: ``{role, content, id, ...}`` — plus ``tool_calls`` on an AIMessage
    that made them, and ``name`` on a ToolMessage so the UI can label which tool
    produced it. We keep tool-call args so the Tool Trace viewer can show them.
    """
    role = _role_of(message)
    out: dict[str, Any] = {
        "role": role,
        "content": getattr(message, "content", "") or "",
        "id": getattr(message, "id", None),
    }

    # An AIMessage may carry the tool calls the agent decided to make.
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        out["tool_calls"] = [
            {
                "name": tc.get("name"),
                "args": tc.get("args"),
                "id": tc.get("id"),
            }
            for tc in tool_calls
        ]

    # A ToolMessage knows which tool it answers and that call's id.
    if role == "tool":
        out["name"] = getattr(message, "name", None)
        out["tool_call_id"] = getattr(message, "tool_call_id", None)

    return out


def messages_to_list(messages: list | None) -> list[dict]:
    """Serialize a list of messages, skipping Nones defensively."""
    return [message_to_dict(m) for m in (messages or []) if m is not None]


def state_to_dict(state: dict | None) -> dict:
    """Serialize a full LaunchLensState snapshot for the State Viewer.

    Inputs : the graph's merged state (or a checkpointed snapshot's ``values``).
    Outputs: the same shape with ``messages`` flattened to JSON. ``research``,
    ``query`` and ``intent`` are already plain types, so they pass through.
    """
    state = state or {}
    return {
        "messages": messages_to_list(state.get("messages")),
        "research": state.get("research", {}),
        "query": state.get("query", ""),
        "intent": state.get("intent", ""),
    }


def jsonable(value: Any) -> Any:
    """Best-effort coercion of a node's state-delta into JSON-safe data.

    Node updates can contain message objects (e.g. the agent's verdict, or the
    summarizer's RemoveMessage list). We recurse, converting any message we find
    and leaving plain JSON types untouched. Used to serialize the per-node deltas
    the Execution Inspector shows.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (AIMessage, HumanMessage, SystemMessage, ToolMessage, RemoveMessage)):
        return message_to_dict(value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return str(value)  # last resort: stringify anything exotic
