<!-- Maps each of the 5 graded LangGraph concepts to where it lives in the code. -->

# Concept Map

The 5 required LangGraph concepts, mapped to the exact file + function + line.
All line numbers refer to the current source; the whole flow is assembled in
`build_graph()` (`launchlens/graph.py:242`).

Graph shape: `START → summarize_if_needed → classify_intent → [Send fan-out] → agent → END`

---

## 1. Graph construction & typed state

A typed `StateGraph` whose merge-fields carry reducers.

| What | File | Symbol | Line |
|------|------|--------|------|
| Typed state class | `launchlens/graph.py` | `class LaunchLensState(TypedDict)` | 55 |
| `messages` reducer (`add_messages`) | `launchlens/graph.py` | `messages: Annotated[list, add_messages]` | 68 |
| Fan-out reducer (`operator.or_`) | `launchlens/graph.py` | `research: Annotated[dict, operator.or_]` | 69 |
| StateGraph built from the typed state | `launchlens/graph.py` | `builder = StateGraph(LaunchLensState)` | 249 |
| `START → … → END` wiring | `launchlens/graph.py` | `build_graph()` edges | 260–276 |

The `operator.or_` reducer on `research` is what lets the parallel branches each
write a different key into one dict without clobbering each other.

---

## 2. Routing (conditional edges)

A node classifies the founder's intent; a conditional edge picks the path.

| What | File | Symbol | Line |
|------|------|--------|------|
| Intent classifier node | `launchlens/graph.py` | `def classify_intent(...)` | 106 |
| Intent → branch plan | `launchlens/graph.py` | `INTENT_PLAN` | 134 |
| Conditional-edge function | `launchlens/graph.py` | `def route_by_intent(...)` | 151 |
| Conditional edge registered | `launchlens/graph.py` | `builder.add_conditional_edges("classify_intent", route_by_intent)` | 264 |

Intents: `demand`, `pricing`, `reviews`, or `full` (a complete Go/No-Go report).

---

## 3. Fan-out (parallel execution)

The router returns multiple `Send()` objects, so the chosen research nodes run in
the same superstep and fan back in to one agent node.

| What | File | Symbol | Line |
|------|------|--------|------|
| Parallel dispatch via `Send()` | `launchlens/graph.py` | `return [Send(node, {"query": ...}) for node in targets]` | 160 |
| Fan-out leaf: Google Trends | `launchlens/graph.py` | `def research_trends(...)` | 167 |
| Fan-out leaf: Google Shopping | `launchlens/graph.py` | `def research_shopping(...)` | 174 |
| Fan-out leaf: Google News | `launchlens/graph.py` | `def research_news(...)` | 181 |
| Fan-out leaf: Amazon search | `launchlens/graph.py` | `def research_amazon(...)` | 188 |
| Fan-out leaf: Amazon reviews | `launchlens/graph.py` | `def research_reviews(...)` | 195 |
| Fan-in: every leaf → `agent` | `launchlens/graph.py` | `builder.add_edge(node, "agent")` | 267–274 |

Each leaf returns `{"research": {<key>: <slim dict>}}`; the `operator.or_` reducer
(concept 1) merges them.

---

## 4. Agent node + tools

An LLM agent bound to all six SerpApi + Oxylabs tools, fusing demand + supply.

| What | File | Symbol | Line |
|------|------|--------|------|
| All 6 tools bound to the agent | `launchlens/graph.py` | `ALL_TOOLS = SERPAPI_TOOLS + OXYLABS_TOOLS` | 45 |
| Agent node | `launchlens/graph.py` | `def agent(...)` | 206 |
| `create_react_agent` construction | `launchlens/graph.py` | `react_agent = create_react_agent(get_llm(), ALL_TOOLS)` | 226 |
| Tool — Google Trends (demand) | `launchlens/tools/serpapi_tools.py` | `def google_trends(...)` | 124 |
| Tool — Google Shopping (demand) | `launchlens/tools/serpapi_tools.py` | `def google_shopping(...)` | 143 |
| Tool — Google News (demand) | `launchlens/tools/serpapi_tools.py` | `def google_news(...)` | 160 |
| Tool — Amazon search (supply) | `launchlens/tools/oxylabs_tools.py` | `def amazon_search(...)` | 126 |
| Tool — Amazon product (supply) | `launchlens/tools/oxylabs_tools.py` | `def amazon_product(...)` | 142 |
| Tool — Amazon reviews (supply) | `launchlens/tools/oxylabs_tools.py` | `def amazon_reviews(...)` | 157 |

Every tool returns a slim dict (<200 bytes); raw API responses never reach the LLM.

---

## 5. Short-term memory

A SQLite checkpointer (survives restarts) **plus** a summarization node that
bounds the context window on long chats.

| What | File | Symbol | Line |
|------|------|--------|------|
| Checkpointer factory | `launchlens/memory.py` | `def get_checkpointer(...)` | 24 |
| `SqliteSaver` (on-disk) | `launchlens/memory.py` | `return SqliteSaver(conn)` | 34 |
| Checkpointer attached to the graph | `launchlens/graph.py` | `builder.compile(checkpointer=get_checkpointer())` | 278 |
| Summarization node | `launchlens/graph.py` | `def summarize_if_needed(...)` | 77 |
| Summarize trigger (>10 messages) | `launchlens/graph.py` | `SUMMARY_TRIGGER` | 49 |

The checkpointer persists state per `thread_id` (set by the CLI,
`cli.py`), so quitting and relaunching resumes the same conversation;
`summarize_if_needed` keeps that stored history from growing without bound.

---

## Supporting files

| Purpose | File | Symbol |
|---------|------|--------|
| 3-mode LLM switcher (mock / openai / anthropic) | `launchlens/config.py` | `get_llm()`, `is_mock()` |
| CLI chat loop + `thread_id` | `cli.py` | `main()` |
