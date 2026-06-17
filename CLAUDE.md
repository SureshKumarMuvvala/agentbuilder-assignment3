# LaunchLens — Project Memory

## What this project is
CLI chat agent called LaunchLens. A founder types a product idea, the agent
researches it using SerpApi (demand) + Oxylabs (supply), and replies with a
Go/No-Go/Niche verdict. Conversation memory persists across turns.

## Stack
- Python, UV for venv, LangGraph for agent graph
- LLM: 3 modes via LLM_PROVIDER env var: mock | openai | anthropic
- SerpApi: Google Trends, Shopping, News (demand side)
- Oxylabs: Amazon search, product, reviews (supply side)
- Rich for CLI formatting
- SQLite checkpointer for memory

## Folder structure (do not change)
launchlens/
  __init__.py
  config.py        # 3-mode LLM switcher
  graph.py         # LangGraph state machine (all 5 concepts)
  memory.py        # SQLite checkpointer
  tools/
    __init__.py
    serpapi_tools.py
    oxylabs_tools.py
fixtures/          # mock JSON, one file per API source
cli.py             # Rich terminal UI, entry point
pyproject.toml
.env.example
CONCEPT_MAP.md
README.md

## The 5 LangGraph concepts (all required, all graded)
1. Typed StateGraph — LaunchLensState with operator.or_ reducers for fan-out fields
2. Fan-out — Send() for true parallel execution, not sequential
3. Routing — classify_intent node + route_by_intent conditional edges
4. Agent node — create_react_agent bound to all 6 tools
5. Memory — SqliteSaver checkpointer + summarize_if_needed node (trigger >10 messages)

## Slim tool output rule
Every @tool function returns a small dict (<200 bytes). Never pass raw API
response to the LLM. This applies to all serpapi and oxylabs tools.

## Mock mode rule
When LLM_PROVIDER=mock or is_mock() is True, all tools load from fixtures/
instead of calling real APIs. FakeListLLM handles LLM calls.

## Error handling rule
All live API calls wrapped in try/except. Return {"error": str} on failure.
Agent degrades gracefully, never crashes.

## Beginner comments rule
Every node, class, and non-trivial function gets a comment block explaining
it in plain English (for a beginner presenting this during a demo).

## Never do these
- Never re-read README.md or RUBRIC.md during a build phase
- Never ask for confirmation between steps, build autonomously
- Never pass raw API responses to the LLM
- Never use sequential calls where Send() fan-out is required