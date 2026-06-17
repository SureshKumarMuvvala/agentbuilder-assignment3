"""SerpApi demand-side tools: Google Trends, Shopping, and News.

These three tools answer the *demand* half of LaunchLens: what is the market
asking for? Trends shows whether interest is rising, Shopping shows the price
band across retailers, and News surfaces recent launches/recalls. The agent
combines these with the Oxylabs *supply* tools to reach a Go/No-Go/Niche verdict.

Two rules drive every tool here:

* **Slim output** — each tool returns a tiny dict (a handful of numbers and at
  most three strings), never the raw SerpApi JSON. Raw responses are huge and
  would blow up the LLM's context window and cost; we distill them first.
* **Mock mode** — when ``is_mock()`` is True we read a saved fixture from
  ``fixtures/`` instead of calling SerpApi, so the whole app runs offline with no
  API key. The *same* slimming functions run in both modes, so what the agent
  sees offline matches what it would see live.

Every live call is wrapped in try/except and degrades to ``{"error": ...}`` so a
network hiccup never crashes the agent.
"""

import json
import os
from pathlib import Path

from langchain_core.tools import tool

from ..config import is_mock

# fixtures/ lives at the project root: this file is launchlens/tools/serpapi_tools.py,
# so we walk up two parents (tools/ -> launchlens/ -> project root) then into fixtures/.
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


def _load_fixture(name: str) -> dict:
    """Read a saved SerpApi response from fixtures/ (used only in mock mode)."""
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def _serp_search(params: dict) -> dict:
    """Call SerpApi with the given params plus our API key, return the raw dict.

    Kept tiny and separate so the three tools share one code path to the API and
    so the API key is injected in exactly one place.
    """
    from serpapi import GoogleSearch

    params = {**params, "api_key": os.getenv("SERPAPI_KEY")}
    return GoogleSearch(params).get_dict()


# --- Slimming functions: raw SerpApi JSON -> tiny dict the LLM can read ---------


def _slim_trends(data: dict, query: str) -> dict:
    """Turn an interest-over-time response into direction + average + hot terms.

    We drop the query echo (the agent already knows what it asked) to keep the
    dict under the project's ~200-byte slim-output budget.
    """
    timeline = data.get("interest_over_time", {}).get("timeline_data", [])
    values = [
        v["values"][0]["extracted_value"]
        for v in timeline
        if v.get("values") and "extracted_value" in v["values"][0]
    ]
    if not values:
        return {"error": "no trend data"}

    # Compare the first third of the period to the last third to label direction.
    third = max(1, len(values) // 3)
    start_avg = sum(values[:third]) / third
    end_avg = sum(values[-third:]) / third
    delta = end_avg - start_avg
    trend = "rising" if delta > 5 else "falling" if delta < -5 else "flat"

    related = [
        r["query"]
        for r in data.get("related_queries", {}).get("rising", [])
        if r.get("query")
    ][:3]

    return {
        "trend": trend,
        "avg_interest": round(sum(values) / len(values)),
        "related": related,
    }


def _slim_shopping(data: dict, query: str) -> dict:
    """Reduce a shopping response to the price band (low / median / high)."""
    prices = sorted(
        item["extracted_price"]
        for item in data.get("shopping_results", [])
        if isinstance(item.get("extracted_price"), (int, float))
    )
    if not prices:
        return {"error": "no shopping data"}

    return {
        "low": prices[0],
        "median": prices[len(prices) // 2],
        "high": prices[-1],
        "n": len(prices),
    }


def _slim_news(data: dict, query: str) -> dict:
    """Reduce a news response to a count and the three latest headlines.

    Headlines are truncated to 48 chars each so the dict stays slim while still
    conveying the gist (a launch, a recall, market growth).
    """
    items = data.get("news_results", [])
    headlines = [i["title"][:48] for i in items if i.get("title")][:3]
    return {"count": len(items), "recent_headlines": headlines}


# --- The three tools the agent can call -----------------------------------------


@tool
def google_trends(query: str) -> dict:
    """Check Google Trends demand for a product idea.

    Returns whether search interest is rising/flat/falling, the average interest
    level (0-100), and up to three related rising search terms. Use this to judge
    whether demand for the product is growing.
    """
    if is_mock():
        return _slim_trends(_load_fixture("serpapi_trends.json"), query)
    try:
        raw = _serp_search(
            {"engine": "google_trends", "q": query, "data_type": "TIMESERIES"}
        )
        return _slim_trends(raw, query)
    except Exception as e:  # any network/parse failure degrades gracefully
        return {"error": str(e)}


@tool
def google_shopping(query: str) -> dict:
    """Check cross-retailer prices for a product idea via Google Shopping.

    Returns the lowest, median, and highest listed prices plus how many listings
    were found. Use this to see where a founder's target price would sit in the
    market.
    """
    if is_mock():
        return _slim_shopping(_load_fixture("serpapi_shopping.json"), query)
    try:
        raw = _serp_search({"engine": "google_shopping", "q": query})
        return _slim_shopping(raw, query)
    except Exception as e:
        return {"error": str(e)}


@tool
def google_news(query: str) -> dict:
    """Scan recent Google News for a product category.

    Returns how many recent stories were found and the three latest headlines.
    Use this to spot launches, recalls, or competitor moves in the space.
    """
    if is_mock():
        return _slim_news(_load_fixture("serpapi_news.json"), query)
    try:
        raw = _serp_search({"engine": "google_news", "q": query})
        return _slim_news(raw, query)
    except Exception as e:
        return {"error": str(e)}


# Convenience list so the graph can bind all demand-side tools in one import.
SERPAPI_TOOLS = [google_trends, google_shopping, google_news]
