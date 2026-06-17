Task: write launchlens/graph.py and launchlens/memory.py implementing all 5 LangGraph concepts from CLAUDE.md.

CONCEPT 1 — STATE (graph.py):
class LaunchLensState(TypedDict):
    messages: Annotated[list, add_messages]
    query: str
    intent: str
    demand_data: Annotated[dict, operator.or_]
    supply_data: Annotated[dict, operator.or_]
    verdict: str
    summary: str
    thread_id: str

CONCEPT 2 — ROUTING (graph.py):
Node: classify_intent(state) — LLM classifies query into demand|pricing|full_report|followup
Function: route_by_intent(state) -> str
Edges from "router" to: demand_fanout | pricing_fanout | full_fanout | agent

CONCEPT 3 — FAN-OUT (graph.py):
from langgraph.constants import Send
fan_out_full returns [Send("fetch_trends",state), Send("fetch_shopping",state), Send("fetch_amazon",state), Send("fetch_reviews",state)]
demand_fanout: fetch_trends + fetch_shopping only
pricing_fanout: fetch_shopping + fetch_amazon only
All fan-out nodes -> merge_results node

Fetch nodes:
- fetch_trends_node: calls get_google_trends(state["query"]), returns {"demand_data": {"trends": result}}
- fetch_shopping_node: calls get_google_shopping(state["query"]), returns {"demand_data": {"shopping": result}}
- fetch_amazon_node: calls search_amazon(state["query"]), returns {"supply_data": {"amazon_search": result}}
- fetch_reviews_node: gets top asin from supply_data if present, calls get_amazon_product(asin), returns {"supply_data": {"product_detail": result}}

CONCEPT 4 — AGENT NODE (graph.py):
agent = create_react_agent(get_llm(), tools=[get_google_trends, get_google_shopping, get_google_news, search_amazon, get_amazon_product, get_amazon_bestsellers])
System prompt includes FUSION RULE: verdict must cite both SerpApi demand signals and Oxylabs supply data.
Verdict format: VERDICT: [Go/No-Go/Niche] / DEMAND: ... / COMPETITION: ... / GAP: ... / POSITIONING: ...
Wire: merge_results -> agent -> END

CONCEPT 5 — MEMORY (memory.py + graph.py):
memory.py: get_checkpointer() returns SqliteSaver.from_conn_string("launchlens_memory.db")

summarize_if_needed(state) node:
- skip if len(messages) <= 10 or messages[-1] is ToolMessage
- LLM compresses to <150 words preserving: product names, verdicts, key numbers
- stores in state["summary"]
- replaces messages with [SystemMessage(summary)] + messages[-2:]
Wire: START -> summarize_if_needed -> router

build_graph() compiles with checkpointer from memory.py.

Add beginner comment blocks per CLAUDE.md rule.

Done when: python -c "from launchlens.graph import build_graph; g=build_graph(); print('OK')" prints OK.