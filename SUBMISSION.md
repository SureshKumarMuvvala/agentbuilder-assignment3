# Submission - Assignment 3

**Student(s):** Suresh Kumar Muvvala
**GitHub repo:** https://github.com/SureshKumarMuvvala/agentbuilder-assignment3 (branch: **`launchlens-v2`**)
**Demo video (≥2 min):** see the **Deliverables** table below (committed under `presentation/`)
**Presentation / slides:** see the **Deliverables** table below (committed under `presentation/`)

### Deliverables — presentations & demo videos

| # | Type | Title | Voice / Mode | Path |
|---|------|-------|--------------|------|
| 1 | Presentation deck | LaunchLens Deck (mock / fixtures) | — / offline, deterministic | `presentation/LaunchLens-Deck.html` |
| 2 | Presentation deck | LaunchLens Deck (live data) | — / OpenAI + SerpApi + Oxylabs | `presentation/LaunchLens-Deck-Live.html` |
| 3 | Demo video (~4:16) | LaunchLens Live Demo | Female voice (OpenAI `nova`) / live | `presentation/LaunchLens-Live-Demo.mp4` |
| 4 | Demo video (~4:39) | LaunchLens Live Demo | Male, Indian-accent voice (OpenAI `onyx`) / live | `presentation/LaunchLens-Live-Demo-IndianMale.mp4` |

> Both decks are self-contained HTML (open in any browser; ↑/↓ to navigate, **F** fullscreen, **P** print/PDF view). Supporting screenshots live in `presentation/screenshots/` (mock) and `presentation/screenshots-live/` (live). Both videos are the **same live walkthrough** (real "robot vacuum" analysis) — only the narration voice differs.

---

## 1. LaunchLens in your words (2-3 sentences)

LaunchLens is a market-intelligence agent: a founder types one product idea, and a LangGraph state machine researches **demand** (SerpApi — Google Trends, Shopping, News) and **supply** (Oxylabs — Amazon search & reviews) in a single parallel fan-out. A `create_react_agent` then fuses both sides into one merged `research` dict and returns a concise **Go / No-Go / Niche** verdict with a price band and the top unmet gap. Because the demand and supply signals are reconciled together (rising demand + a price gap + a recurring review complaint → GO, with where to enter and what to win on), the founder gets a decision rather than two separate reports.

---

## 2. Concept map - where each required concept lives

| Concept | File | Function / node | Line(s) | One-line note |
|---------|------|-----------------|---------|---------------|
| Graph & state | `launchlens/graph.py` | `LaunchLensState` (TypedDict) + `research` reducer | 83, 99 | Typed state; `research: Annotated[dict, operator.or_]` so parallel branches merge without clobbering |
| Fan-out (parallel) | `launchlens/graph.py` | `route_by_intent` → `Send()` | 272, 284 | Returns a **list of `Send()` objects** → chosen research nodes run in one superstep, not sequentially |
| Routing (conditional edges) | `launchlens/graph.py` | `classify_intent` + `add_conditional_edges` | 222, 394 | Deterministic intent label (demand / pricing / reviews / full) drives the conditional edge |
| Agent node + tools | `launchlens/graph.py` | `agent` → `create_react_agent` | 339, 359 | ReAct agent bound to all 6 SerpApi + Oxylabs tools; fuses the merged research into the verdict |
| Short-term memory (checkpointer + summarization) | `launchlens/memory.py`, `launchlens/graph.py` | `SqliteSaver` (`get_checkpointer`), `summarize_if_needed`, `compile(checkpointer=…)` | memory.py 34; graph.py 108, 408 | `SqliteSaver` checkpoints state per node by `thread_id`; `summarize_if_needed` compresses once a chat passes 10 messages |

---

## 3. Data sources used

- **SerpApi engine(s):** Google Trends, Google Shopping, Google News — used for **demand**: trend direction & interest score, cross-retailer price band, and category momentum/headlines.
- **Oxylabs source(s):** `amazon_search`, `amazon_reviews` — used for **supply**: seller count, average rating, Amazon price band, and recurring review complaints (mined as opportunity gaps). The reviews node runs a quick `amazon_search` internally to resolve a real ASIN before pulling reviews.
- **How they combine:** the fan-out writes each tool's slim result into one shared `research` dict (`operator.or_` reducer), and the agent node is instructed to **fuse both sides** — demand justifies "why now", supply justifies "where's the gap", and the price band is reconciled from Shopping vs Amazon — into a single Go / No-Go / Niche verdict.
- **Live vs mocked:** with `LLM_PROVIDER=mock` (default) every tool reads from `fixtures/` and a `FakeListChatModel` drives the chat — fully offline, deterministic, no keys. With `LLM_PROVIDER=openai` (or `anthropic`) the tools make **real SerpApi/Oxylabs calls** and a real LLM produces the verdict. Both demo videos and the live deck were captured in live `openai` mode; every number shown (e.g. 100 live news headlines, a real Amazon ASIN, the $8–$1,700 price band) is a real API response. Every tool returns a slim `<200 B` dict — raw API payloads are never sent to the LLM — and live calls are wrapped in try/except so a failure returns `{"error": …}` and degrades gracefully instead of crashing the graph.

---

## 4. How to run

```bash
# setup
uv venv
uv sync
cp .env.example .env        # mock mode needs no keys; for live set LLM_PROVIDER + API keys

# CLI (over the compiled graph)
uv run launchlens           # add --debug to step through each node

# Web UI — LangGraph execution viewer (two processes)
uv run launchlens-api       # backend  -> http://127.0.0.1:8000  (FastAPI + SSE)
cd frontend && npm install && npm run dev   # frontend -> http://localhost:5173
```

`.env` keys: `LLM_PROVIDER` (`mock` | `openai` | `anthropic`), `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `SERPAPI_KEY`, `OXYLABS_USER`, `OXYLABS_PASS`. The provider can also be switched at runtime from the UI's status pill (top-right).

---

## 5. Demo script (the prompts in your recording)

Recorded as one live conversation on a single thread (so memory + routing are both visible):

1. **`Should I launch a robot vacuum?`** → routes to **full report**, fans out to all 5 tools, returns a **GO** verdict with scores, a price band, and the top review-gap.
2. **`What price should I sell a robot vacuum at?`** → routes to **pricing** (Shopping + Amazon only); recommends a band of **$252–$280**, just under the market median.
3. **`How is search demand for robot vacuums trending?`** → routes to **demand** (Trends + News); shows a **rising** trend score of 38/100.

Same product, three different live routes from one conversation — and the Memory tab shows all three turns persisted in SQLite, proving the follow-ups remembered the product without restating it. (To exercise the summarization node specifically, continue the chat past 10 messages — e.g. add "Summarize everything we've discussed.")

---

## 6. Bonus attempted (if any)

- **LangSmith-style web execution viewer** (`launchlens/api/` + `frontend/`) — a second front-end over the *same* compiled graph that makes every concept observable: replayable **Graph**, node **Timeline** (shared step numbers prove the parallel fan-out), **Tools** trace with slim results, live **State** (the `operator.or_` merge), and **Memory** evolution across turns. Per-turn trace history is preserved (re-open any earlier turn).
- **Server-Sent Events streaming** — node-by-node execution streamed live (`node_start` / `tool_end` / `routing` / `checkpoint` / `final`).
- **Runtime 3-mode LLM switching** (`mock` | `openai` | `anthropic`) read fresh each turn, switchable from the UI without a rebuild.
- **Deterministic keyword extraction** — reduces a founder's full sentence to a clean product search term so the tools get a keyword, not a question.
- **Presentation & demo assets** — two self-contained HTML decks (mock + live) and two narrated live demo videos (female and Indian-accent male voice), all generated from real runs (see Deliverables table).

---

## 7. Known limitations / what I'd do next

- **Follow-up keyword scope:** `classify_intent` re-extracts the search keyword from only the *latest* question, so a bare follow-up like "what are the complaints?" can lose the product noun (the research tools then search the wrong term, even though the agent still has conversational memory for the verdict text). Next: carry the active product keyword in state and reuse it when a follow-up omits it.
- **Trends data gaps:** Google Trends occasionally returns `{"error": "no trend data"}` for long or unusual keywords, and related-search terms sometimes come back empty. Next: fall back to a shorter keyword and retry.
- **Reviews ASIN drift:** the reviews node resolves its own top ASIN from a fresh search, which can differ from the full-report ASIN, so the surfaced complaints may vary between turns. Next: thread the chosen ASIN through state.
- **Mock-mode tool trace:** in mock mode the agent's internal ReAct tool loop is silent (the fake LLM never calls tools), so the reliable visible trace there is the fan-out research nodes. Live mode shows the agent calling tools too.
- **Short-term memory only:** memory is per-`thread_id` in SQLite with summarization; there's no long-term/cross-thread or vector memory yet.
- **Narration voice:** the Indian-accent male narration is steered via OpenAI TTS instructions (no native Indian English voice is installed locally), so accent fidelity is approximate; a dedicated regional TTS voice would improve it.
