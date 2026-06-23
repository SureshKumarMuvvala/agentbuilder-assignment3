"""Web API layer for LaunchLens.

This package exposes the exact same LangGraph app the CLI uses over HTTP, so a
React frontend can *watch* the graph run: node-by-node execution, tool calls,
state diffs, routing decisions, and memory updates. Nothing about the graph or
the 5 graded concepts changes — we only add an observation/transport layer on
top of it.

Modules:

* ``serializers`` - turn LangChain message/state objects into plain JSON.
* ``streaming``   - run the graph and translate its event stream into small,
  frontend-friendly events (node_start, node_end, tool_start, tool_end, final).
* ``server``      - the FastAPI app: config, graph topology, chat (SSE), and
  thread/session endpoints.
"""
