# LaunchLens — Project Memory

## What this project is

LaunchLens is a market-intelligence AI agent.

A founder types a product idea and the system researches:

* Demand signals from SerpApi
* Supply signals from Oxylabs

The agent combines both data sources and produces:

* GO
* NO-GO
* NICHE

recommendations with pricing and positioning guidance.

Conversation memory persists across turns using LangGraph checkpointers.

---

# Stack

## Backend

* Python
* UV
* LangGraph
* LangChain

## LLM Providers

Controlled by `LLM_PROVIDER`

Supported values:

* mock
* openai
* anthropic

## Demand Data

SerpApi:

* Google Trends
* Google Shopping
* Google News

## Supply Data

Oxylabs:

* Amazon Search
* Amazon Product
* Amazon Reviews
* Amazon Pricing

## Storage

* SQLite checkpointer

## UI

Frontend may use:

* React
* TypeScript
* Tailwind
* shadcn/ui

---

# Folder Structure (Do Not Change)

launchlens/
**init**.py
config.py
graph.py
memory.py

tools/
**init**.py
serpapi_tools.py
oxylabs_tools.py

fixtures/

cli.py
main.py

pyproject.toml
.env.example

CONCEPT_MAP.md
README.md

---

# Repository Scanning Rules

Always read the minimum number of files necessary.

Read first:

* launchlens/**
* cli.py
* main.py
* pyproject.toml
* CLAUDE.md

Ignore unless explicitly requested:

* .venv/**
* **pycache**/**
* launchlens_memory.sqlite
* uv.lock
* .env
* prompts/**

Avoid reading during implementation work:

* README-brief.md
* RUBRIC.md
* SUBMISSION_TEMPLATE.md

Only read when directly relevant:

* docs/**
* fixtures/**
* testing/**
* README.md
* CONCEPT_MAP.md

Before opening files:

1. Determine the task.
2. Identify the minimum file set.
3. Avoid repository-wide scans.

Token efficiency is important.

---

# Assignment Scoring Priority

Optimize all decisions for assignment grading.

Priority order:

1. Demonstrate all 5 LangGraph concepts
2. Demonstrate SerpApi + Oxylabs fusion
3. Make graph execution observable
4. Make memory observable
5. Improve demo quality
6. Improve UI polish

If forced to choose:

Prefer observability over aesthetics.

A grader should identify:

* Graph Construction
* Routing
* Fan-Out
* Agent + Tools
* Memory

within 30 seconds.

---

# The 5 LangGraph Concepts (All Required)

## 1. Typed StateGraph

LaunchLensState

Requirements:

* Typed state
* Reducers where needed
* Clean graph design

## 2. Fan-Out

True parallel execution.

Requirements:

* Use Send()
* Parallel branches
* Proper merge behavior

Never fake fan-out with sequential execution.

## 3. Routing

Requirements:

* classify_intent node
* conditional edges
* sensible default path

## 4. Agent Node

Requirements:

* create_react_agent
* all tools available
* proper agent-tool loop

## 5. Memory

Requirements:

* SqliteSaver
* summarize_if_needed node
* summary trigger after long chats

---

# UI Development Rules

The UI exists primarily to demonstrate LangGraph concepts.

Do NOT build a generic chatbot.

Build a LangSmith-style execution viewer.

Priority order:

1. Graph execution visibility
2. State visibility
3. Tool visibility
4. Memory visibility
5. Chat experience
6. Visual polish

Debug Mode should expose:

* Routing decisions
* Fan-Out execution
* Tool calls
* State transitions
* Summarization activity
* Checkpointer activity

Every node execution should display:

* Node name
* Duration
* Input state
* Output state
* Tool calls
* Errors

Graph visualization should show:

* Running nodes
* Completed nodes
* Failed nodes
* Parallel execution
* Merge points

---

# Slim Tool Output Rule

Every tool must return a small structured dictionary.

Target:

< 200 bytes whenever practical

Allowed:

{
"trend_score": 78
}

Not allowed:

Entire API responses.

Never send raw API payloads to the LLM.

Always summarize.

---

# Mock Mode Rule

When:

LLM_PROVIDER=mock

or

is_mock() == True

Use fixtures only.

Requirements:

* No external API calls
* Deterministic outputs
* Fast execution

FakeListLLM handles mock responses.

---

# Error Handling Rule

All live API calls must:

* use try/except
* never crash the graph

Return:

{
"error": "message"
}

Agent should degrade gracefully.

---

# Beginner Comment Rule

Every:

* graph node
* class
* tool
* non-trivial function

must contain beginner-friendly comments.

Comments should explain:

* purpose
* inputs
* outputs
* why it exists

Assume the presenter is explaining the project live.

---

# Observability Rule

Expose graph execution whenever possible.

Preferred visibility:

* Node timeline
* Tool calls
* State diffs
* Routing decisions
* Memory updates

Observable systems score better than hidden systems.

---

# Never Do These

* Never change folder structure without explicit request
* Never reintroduce raw API responses
* Never replace Send() fan-out with sequential execution
* Never hardcode secrets
* Never commit .env
* Never remove memory functionality
* Never remove summarization functionality
* Never perform repository-wide scans when a targeted scan is sufficient
* Never ask for confirmation between implementation steps unless blocked

Build autonomously and incrementally.