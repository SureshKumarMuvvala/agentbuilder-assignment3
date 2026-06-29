# LaunchLens — Product, Architecture & Data Fusion

*A presentation deck for the assignment submission*

---

## Slide 1: Title

# LaunchLens 🔭
## Market-Intelligence AI Agent for Founders

**Go / No-Go / Niche verdicts** from live demand + supply research

> **Stack**: Python · LangGraph · SerpApi · Oxylabs · SQLite · React/TypeScript

---

## Slide 2: The Problem

### Founders need fast, evidence-backed launch decisions

| Pain Point | What Happens Today |
|------------|-------------------|
| **Demand signals scattered** | Google Trends, Shopping, News — manual, slow |
| **Supply signals opaque** | Amazon seller counts, pricing, reviews — hard to aggregate |
| **No fusion** | Demand & supply analyzed in isolation |
| **No memory** | Each question starts from zero context |
| **Black-box AI** | Can't see *why* a verdict was reached |

**LaunchLens solves all five** in a single conversation.

---

## Slide 3: Product Overview

### What LaunchLens Does

1. **Founder types a product idea** in plain English
2. **Agent classifies intent** → demand / pricing / reviews / full report
3. **Parallel fan-out** runs 5 research nodes simultaneously:
   - Google Trends (interest direction)
   - Google Shopping (cross-retailer price band)
   - Google News (landscape headlines)
   - Amazon Search (seller count + price band)
   - Amazon Reviews (recurring complaints)
4. **Agent fuses demand + supply** → Go / No-Go / Niche verdict with pricing & positioning
5. **Memory persists** across turns & restarts (SQLite checkpointer)
6. **Summarization** bounds context after 10 messages

---

## Slide 4: Two Front-Ends, One Graph

| Interface | Purpose | Audience |
|-----------|---------|----------|
| **CLI** (`uv run launchlens`) | Fast chat loop for demos & dev | Founders, developers |
| **Web UI** (`localhost:5173`) | LangSmith-style execution viewer | Graders, reviewers |

> Both consume the **exact same compiled LangGraph** — zero duplication.

---

## Slide 5: Graph Architecture — The 5 Graded Concepts

```mermaid
flowchart TD
    START([START]) --> SUM[summarize_if_needed<br/><b>Concept 5: Memory</b>]
    SUM --> ROUTE{classify_intent<br/><b>Concept 2: Routing</b>}
    ROUTE -->|demand| DEMAND[research_trends + shopping + news]
    ROUTE -->|pricing| PRICING[research_shopping + amazon]
    ROUTE -->|reviews| REVIEWS[research_reviews]
    ROUTE -->|full| FANOUT[<b>Concept 3: Fan-out</b><br/>5 parallel Send()]
    FANOUT --> AGENT[agent node<br/><b>Concept 4: Agent + Tools</b>]
    DEMAND --> AGENT
    PRICING --> AGENT
    REVIEWS --> AGENT
    AGENT --> END([END])
    MEMORY[SqliteSaver<br/><b>Concept 5: Memory</b>] -.-> AGENT
```

---

## Slide 6: Concept 1 — Typed StateGraph with Reducers

### `LaunchLensState` (launchlens/graph.py:55–69)

```python
class LaunchLensState(TypedDict):
    messages: Annotated[list, add_messages]      # LangChain reducer
    query: str
    intent: str
    keyword: str | None
    research: Annotated[dict, operator.or_]      # Fan-out merge reducer
    summary: str | None
```

**Key insight**: `operator.or_` on `research` lets parallel branches each write a different key (`trends`, `shopping`, `news`, `amazon`, `reviews`) into one dict **without clobbering each other**.

---

## Slide 7: Concept 2 — Routing (Conditional Edges)

### `classify_intent` → `route_by_intent` (graph.py:106–160)

```python
INTENT_PLAN = {
    "demand":     ["research_trends", "research_shopping", "research_news"],
    "pricing":    ["research_shopping", "research_amazon"],
    "reviews":    ["research_reviews"],
    "full":       ["research_trends", "research_shopping", "research_news",
                   "research_amazon", "research_reviews"],
}

def route_by_intent(state) -> list[Send]:
    targets = INTENT_PLAN.get(state["intent"], INTENT_PLAN["full"])
    return [Send(node, {"query": state["query"]}) for node in targets]
```

**Result**: One question → exactly the research branches needed, no waste.

---

## Slide 8: Concept 3 — True Fan-Out (Parallel `Send()`)

### 5 research nodes run in **one superstep** (graph.py:151–195)

| Node | Source | Signal Type | Slim Output (<200 B) |
|------|--------|-------------|---------------------|
| `research_trends` | SerpApi Google Trends | Demand: interest direction | `{"trend_score": 78, "direction": "rising"}` |
| `research_shopping` | SerpApi Google Shopping | Demand: price band | `{"price_min": 499, "price_max": 1299, "retailers": 12}` |
| `research_news` | SerpApi Google News | Landscape: headlines | `{"headlines": ["...", "..."], "sentiment": "neutral"}` |
| `research_amazon` | Oxylabs Amazon Search | Supply: seller count | `{"seller_count": 247, "price_min": 399, "price_max": 999}` |
| `research_reviews` | Oxylabs Amazon Reviews | Gap: complaints | `{"top_complaints": ["leaks", "lid breaks"], "avg_rating": 3.8}` |

**All five execute in parallel** — not sequential. Merged via `operator.or_` reducer.

---

## Slide 9: Concept 4 — Agent Node + Tools (ReAct Loop)

### `create_react_agent` with 6 bound tools (graph.py:206–226)

```python
ALL_TOOLS = SERPAPI_TOOLS + OXYLABS_TOOLS  # 3 demand + 3 supply

react_agent = create_react_agent(get_llm(), ALL_TOOLS)
```

**Agent fuses demand + supply** into the final verdict:

> **GO** — Strong rising trend, manageable competition, price band ₹800–1,200
>
> **NO-GO** — Declining interest, saturated market (300+ sellers), commodity pricing
>
> **NICHE** — Stable demand, few sellers (<50), premium positioning at ₹1,500+

---

## Slide 10: Concept 5 — Memory (SQLite + Summarization)

### Two-layer memory (memory.py + graph.py:77–104)

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **Short-term** | `SqliteSaver` (on-disk) | Survives CLI restarts; per `thread_id` |
| **Long-term** | `summarize_if_needed` node | Compresses history after 10 messages |

```python
# Summarization trigger
SUMMARY_TRIGGER = 10

def summarize_if_needed(state):
    if len(state["messages"]) > SUMMARY_TRIGGER:
        # LLM summarizes older turns → SystemMessage
        # Old Human/AI messages → RemoveMessage
        return {"messages": [summary_msg] + [RemoveMessage(id=...) for ...]}
```

**Result**: Unbounded conversation length with bounded context window.

---

## Slide 11: Data-Fusion Approach

### How Demand + Supply Become a Verdict

```
┌─────────────────────┐     ┌─────────────────────┐
│   DEMAND (SerpApi)  │     │  SUPPLY (Oxylabs)   │
├─────────────────────┤     ├─────────────────────┤
│ • Trends: 78 ↑      │     │ • Sellers: 247      │
│ • Shopping: ₹499–₹1299│    │ • Price: ₹399–₹999   │
│ • News: neutral     │     │ • Reviews: 3.8★     │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          └───────────┬───────────────┘
                      ▼
         ┌─────────────────────┐
         │   AGENT (ReAct)     │
         │  Fuses both sides   │
         └─────────┬───────────┘
                   ▼
         ┌─────────────────────┐
         │   GO / NO-GO /      │
         │   NICHE + PRICING   │
         │   + POSITIONING     │
         └─────────────────────┘
```

**Fusion logic** (in agent prompt):
- **High demand + low supply** → GO (blue ocean)
- **Low demand + high supply** → NO-GO (red ocean)
- **Moderate demand + moderate supply** → NICHE (differentiate on quality/brand)
- **Price band** = intersection of shopping + amazon ranges
- **Positioning** = derived from review gaps (what competitors miss)

---

## Slide 12: UI — Graph Panel (Left Rail)

### **Concept 1, 2, 3 visible in 30 seconds**

**What you see:**
- Live graph topology: `START → Memory → Router → [5 parallel] → Agent → END`
- **Fan-out layer** highlighted as horizontal row — parallelism obvious
- Nodes pulse **yellow** while running, turn **concept color** when done
- **Superstep replay** — re-watch any past turn step-by-step

> **Screenshot placeholder**: Graph panel showing fan-out layer with 5 nodes lit up in parallel (superstep 2)

---

## Slide 13: UI — Inspector Tab (Timeline)

### **Node-by-node execution trace**

| Column | Shows |
|--------|-------|
| Step | Superstep number |
| Node | Node name + concept badge |
| Duration | ms per node |
| Status | idle / running / done / error |
| State Delta | What the node wrote back |

**Key for grader**: Click any turn in history → see its full timeline.

> **Screenshot placeholder**: Timeline showing supersteps 0–3 with durations, fan-out nodes all at step 2

---

## Slide 14: UI — Tools Tab

### **Every tool call + slim result (<200 B)**

- **Demand tools** (SerpApi) — green accent
- **Supply tools** (Oxylabs) — cyan accent
- Raw API responses **never** sent to LLM
- Agent's internal tool loop visible when using OpenAI/Anthropic

> **Screenshot placeholder**: Tools panel showing 6 calls with color-coded cards, each expanding to key/value table

---

## Slide 15: UI — State Tab

### **Live merged state**

| Field | Meaning |
|-------|---------|
| `intent` | Routing decision (demand/pricing/reviews/full) |
| `research` | Merged dict — proves `operator.or_` reducer works |
| `messages` | Count + last message preview |
| `summary` | Compressed history if >10 messages |

> **Screenshot placeholder**: State viewer showing `intent: "full"`, `research` with 5 keys, message count

---

## Slide 16: UI — Memory Tab

### **Checkpoint evolution across turns**

- Each turn = one SQLite checkpoint
- Shows message count growth
- **Summarization event** visible when trigger fires (turn 11+)
- Click any checkpoint to rehydrate that conversation state

> **Screenshot placeholder**: Memory panel showing 5 checkpoints, turn 11 marked with "summarized" badge

---

## Slide 17: UI — Chat Panel (Right)

### **Verdict-first, observability-on-demand**

- **Hero**: Go/No-Go/Niche card with pricing band & positioning
- **Trace rail** (collapsed): 5 concept chips — Route, Fan-out, Agent, Memory
- Click any chip → opens Execution Drawer at that tab
- **Thread sidebar**: Switch conversations, see memory pressure

> **Screenshot placeholder**: Full split view — Graph left, Chat right, Execution Drawer expanded showing Tools tab

---

## Slide 18: Demo Script (Grader-Ready)

Run in mock mode (`LLM_PROVIDER=mock`) — no API keys needed:

```bash
# Terminal 1: Backend
uv run launchlens-api

# Terminal 2: Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

**Conversation that shows all concepts:**

1. `"I want to launch a stainless-steel insulated water bottle in India under ₹1,500 — is it worth it?"`
   → Shows **routing (full)**, **fan-out (5 parallel)**, **agent fusion**, **verdict**

2. `"What are people complaining about in the reviews of the top sellers?"`
   → Shows **routing (reviews)**, **memory (context retained)**

3. `"What about the US market instead?"`
   → Shows **memory (bottle context preserved)**

4. `"Compare it with a cheaper plastic version."`
   → Shows **agent tool loop** (if OpenAI/Anthropic)

5. `"Give me the final Go/No-Go verdict with a price band and positioning."`
   → Shows **fusion output**

6. `"Summarize everything we've discussed."`
   → Shows **summarization node** firing

---

## Slide 19: Project Structure (Clean, Grader-Friendly)

```
launchlens/
  config.py        # 3-mode LLM switcher (mock | openai | anthropic)
  graph.py         # LangGraph state machine (ALL 5 CONCEPTS)
  memory.py        # SQLite checkpointer
  debug.py         # Rich CLI step-through trace
  tools/
    serpapi_tools.py   # demand: Trends, Shopping, News
    oxylabs_tools.py   # supply: Amazon search, product, reviews
  api/             # web layer over SAME graph (no graph changes)
    server.py          # FastAPI: config, topology, chat (SSE), threads
    streaming.py       # graph event stream → SSE events
    serializers.py     # LangChain messages/state → JSON
fixtures/          # mock JSON, one file per API source
cli.py             # Rich terminal UI, entry point
frontend/          # React + TS + Tailwind execution viewer
```

---

## Slide 20: Key Differentiators for Grading

| Requirement | How LaunchLens Delivers |
|-------------|------------------------|
| **All 5 concepts visible** | Web UI surfaces each in dedicated panel |
| **True fan-out (not sequential)** | `Send()` returns list → single superstep |
| **Slim tool outputs** | Every tool returns <200 B dict |
| **Mock mode works offline** | Fixtures + FakeListLLM, zero keys |
| **Memory survives restarts** | SQLite on disk, same `thread_id` |
| **Summarization bounds context** | Trigger at 10 messages, `RemoveMessage` |
| **Two front-ends, one graph** | CLI + Web UI share `build_graph()` |
| **Beginner comments everywhere** | Every node/class/tool explains *why* |

---

## Slide 21: Thank You

# LaunchLens 🔭

**Go / No-Go / Niche** — from idea to evidence in one conversation.

> **Repo**: https://github.com/SureshKumarMuvvala/agentbuilder-assignment3
>
> **Live demo**: `uv run launchlens` (mock mode) or `localhost:5173` (web UI)

---

## Appendix: UI Screenshots Guide

> **To capture screenshots for the deck:**

1. Start backend: `uv run launchlens-api`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Run the demo script (Slide 18)
5. Capture these views:
   - **Full split view** (Graph left + Chat right)
   - **Graph panel** with fan-out layer highlighted
   - **Execution Drawer** → Graph tab (replay controls visible)
   - **Execution Drawer** → Timeline tab (supersteps 0–3)
   - **Execution Drawer** → Tools tab (6 color-coded calls)
   - **Execution Drawer** → State tab (merged research dict)
   - **Execution Drawer** → Memory tab (checkpoints + summarization)
   - **Collapsed rail** (5 concept chips)
   - **Thread sidebar** with message count + summary trigger

**Tip**: Use browser dev tools device toolbar for consistent 1920×1080 captures.