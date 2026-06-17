# LaunchLens 🔭

A CLI chat agent that tells a founder whether a product is worth launching. You type a
product idea in plain English; LaunchLens researches it live — **demand** from SerpApi
(Google Trends, Shopping, News) and **supply** from Oxylabs (Amazon search, product,
reviews) — fuses both sides, and replies with a **Go / No-Go / Niche** verdict covering
demand, price band, and positioning. It remembers the conversation across turns and
summarizes once it gets long.

> 📄 The full assignment brief lives in **[README-brief.md](./README-brief.md)** and the
> hosted landing page: https://fnusatvik07.github.io/agentbuilder-assignment3/

---

## Setup

Requires Python 3.12+ and [`uv`](https://docs.astral.sh/uv/).

```bash
# 1. Install dependencies into a local venv
uv venv
uv sync

# 2. Configure keys (mock mode needs none)
cp .env.example .env
# edit .env — set LLM_PROVIDER and any API keys you have

# 3. Run the chat loop
uv run launchlens
# or: uv run python cli.py
```

### Environment variables (`.env`)

| Variable            | Purpose                                          |
|---------------------|--------------------------------------------------|
| `LLM_PROVIDER`      | `mock` \| `openai` \| `anthropic` (default `mock`) |
| `SERPAPI_KEY`       | SerpApi key — demand data                        |
| `OXYLABS_USER`      | Oxylabs username — supply data                   |
| `OXYLABS_PASS`      | Oxylabs password — supply data                   |
| `OPENAI_API_KEY`    | Required when `LLM_PROVIDER=openai`              |
| `ANTHROPIC_API_KEY` | Required when `LLM_PROVIDER=anthropic`          |

> **Mock mode** (`LLM_PROVIDER=mock`) needs no keys: every tool loads from `fixtures/`
> and a fake LLM drives the conversation. Use it to develop and demo offline.

---

## Concept map (the 5 graded LangGraph concepts)

Each required concept maps to a file + function + line. See
[`CONCEPT_MAP.md`](./CONCEPT_MAP.md) for the full per-symbol breakdown.

| # | Concept                       | File                              | Function / symbol            | Line |
|---|-------------------------------|-----------------------------------|------------------------------|------|
| 1 | Typed `StateGraph` + reducers | `launchlens/graph.py`             | `LaunchLensState` (`operator.or_` on `research`) | 55, 69 |
| 2 | Fan-out (parallel `Send()`)   | `launchlens/graph.py`             | `route_by_intent` / `Send`   | 151, 160 |
| 3 | Routing (conditional edges)   | `launchlens/graph.py`             | `classify_intent` / `add_conditional_edges` | 106, 264 |
| 4 | Agent node + tools            | `launchlens/graph.py`             | `create_react_agent` agent node | 206, 226 |
| 5 | Short-term memory             | `launchlens/memory.py`, `graph.py`| `SqliteSaver`, `summarize_if_needed` | 34, 77 |

Tools wrapped for the agent node:

- **SerpApi (demand)** — `launchlens/tools/serpapi_tools.py`: Google Trends, Shopping, News
- **Oxylabs (supply)** — `launchlens/tools/oxylabs_tools.py`: Amazon search, product, reviews

Every tool returns a slim dict (<200 bytes); raw API responses are never passed to the LLM.

---

## Architecture

```mermaid
flowchart TD
    U([Founder asks a question]) --> S
    S["summarize_if_needed<br/><i>MEMORY: compress long chats</i>"] --> R
    R{"classify_intent<br/><i>ROUTING</i>"}
    R -->|demand| D["demand branch"]
    R -->|pricing| P["pricing branch"]
    R -->|full report| F["<i>FAN-OUT: parallel Send()</i>"]
    F --> FT["Google Trends"]
    F --> FA["Amazon (Oxylabs)"]
    F --> FN["Google News"]
    D --> AG
    P --> AG
    FT --> AG
    FA --> AG
    FN --> AG
    AG["agent node<br/><i>AGENT + TOOLS loop</i>"]
    AG <-->|calls tools| TL["SerpApi + Oxylabs tools"]
    AG --> V["Go / No-Go / Niche verdict"] --> E([END])
    CP[("SqliteSaver checkpointer")] -.->|state saved per node| AG
```

A live diagram can be regenerated with `graph.get_graph().draw_mermaid()`.

---

## Demo script

Run `uv run launchlens` and try a conversation that shows fusion and memory across turns:

1. `I want to launch a stainless-steel insulated water bottle in India under ₹1,500 — is it worth it?`
2. `What are people complaining about in the reviews of the top sellers?`
3. `What about the US market instead?`  ← *tests memory: it should keep the bottle context*
4. `Compare it with a cheaper plastic version.`
5. `Give me the final Go/No-Go verdict with a price band and positioning.`
6. `Summarize everything we've discussed.`  ← *exercises the summarization node*

---

## Project layout

```
launchlens/
  config.py        # 3-mode LLM switcher (mock | openai | anthropic)
  graph.py         # LangGraph state machine (all 5 concepts)
  memory.py        # SQLite checkpointer
  tools/
    serpapi_tools.py   # demand: Trends, Shopping, News
    oxylabs_tools.py   # supply: Amazon search, product, reviews
fixtures/          # mock JSON, one file per API source
cli.py             # Rich terminal UI, entry point
```
