"""Oxylabs supply-side tools: Amazon search, product, and reviews.

These three tools answer the *supply* half of LaunchLens: what is actually
selling on the marketplace, and where are the gaps? Search shows the incumbents
and their price band, product zooms into one listing, and reviews mine recurring
complaints (a complaint everyone repeats is a product opportunity). The agent
fuses these with the SerpApi *demand* tools to reach a Go/No-Go/Niche verdict.

Same two rules as the SerpApi tools:

* **Slim output** — each tool returns a tiny dict (a few numbers and at most
  three short strings), never the raw Oxylabs JSON, which is large.
* **Mock mode** — when ``is_mock()`` is True we read a saved fixture from
  ``fixtures/`` instead of calling Oxylabs, so the app runs offline with no
  credentials. The same slimming functions run in both modes.

Every live call is wrapped in try/except and degrades to ``{"error": ...}``.
"""

import json
import os
from pathlib import Path

import requests
from langchain_core.tools import tool

from ..config import is_mock

# fixtures/ lives at the project root (this file is launchlens/tools/oxylabs_tools.py).
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"

# Oxylabs' Realtime endpoint: we POST a job and get the parsed result back in one
# call (no polling), which keeps the tool code simple.
OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries"


def _load_fixture(name: str) -> dict:
    """Read a saved Oxylabs response from fixtures/ (used only in mock mode)."""
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def _oxy_query(source: str, query: str) -> dict:
    """POST one job to Oxylabs Realtime and return the raw JSON response.

    ``source`` is the Oxylabs scraper (amazon_search / amazon_product /
    amazon_reviews); ``query`` is a keyword for search or an ASIN for the other
    two. ``parse: True`` asks Oxylabs to return structured fields rather than raw
    HTML. Credentials are injected here, in one place.
    """
    payload = {"source": source, "query": query, "parse": True}
    auth = (os.getenv("OXYLABS_USER"), os.getenv("OXYLABS_PASS"))
    resp = requests.post(OXYLABS_ENDPOINT, json=payload, auth=auth, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _content(data: dict) -> dict:
    """Dig the parsed ``content`` block out of an Oxylabs response envelope."""
    return data.get("results", [{}])[0].get("content", {})


# --- Slimming functions: raw Oxylabs JSON -> tiny dict the LLM can read ----------


def _slim_search(data: dict) -> dict:
    """Reduce a search response to seller count, price band, and average rating."""
    organic = _content(data).get("results", {}).get("organic", [])
    prices = sorted(
        i["price"] for i in organic if isinstance(i.get("price"), (int, float))
    )
    ratings = [i["rating"] for i in organic if isinstance(i.get("rating"), (int, float))]
    if not prices:
        return {"error": "no search results"}

    return {
        "sellers": len(organic),
        "low": prices[0],
        "high": prices[-1],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
    }


def _slim_product(data: dict) -> dict:
    """Reduce a product response to price, rating, review count, and short title."""
    c = _content(data)
    if not c.get("title"):
        return {"error": "no product data"}

    return {
        "title": c["title"][:48],
        "price": c.get("price"),
        "rating": c.get("rating"),
        "reviews": c.get("reviews_count"),
    }


def _slim_reviews(data: dict) -> dict:
    """Mine reviews for recurring complaints (the product-opportunity signal).

    We surface the average rating plus up to three short complaint titles drawn
    from the low-rated (<=2 star) reviews — those are the "everyone says it leaks"
    gaps a founder can design around. Titles are truncated to keep the dict slim.
    """
    reviews = _content(data).get("reviews", [])
    ratings = [r["rating"] for r in reviews if isinstance(r.get("rating"), (int, float))]
    complaints = [
        r["title"][:40]
        for r in reviews
        if isinstance(r.get("rating"), (int, float)) and r["rating"] <= 2 and r.get("title")
    ][:3]
    if not reviews:
        return {"error": "no reviews"}

    return {
        "reviews_seen": len(reviews),
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "complaints": complaints,
    }


# --- The three tools the agent can call -----------------------------------------


@tool
def amazon_search(query: str) -> dict:
    """Search Amazon for a product category via Oxylabs.

    Returns how many sellers were found, the lowest and highest prices, and the
    average rating. Use this to size up the competition and the prevailing price
    band before deciding whether to enter.
    """
    if is_mock():
        return _slim_search(_load_fixture("oxylabs_search.json"))
    try:
        return _slim_search(_oxy_query("amazon_search", query))
    except Exception as e:  # network/auth/parse failure degrades gracefully
        return {"error": str(e)}


@tool
def amazon_product(asin: str) -> dict:
    """Look up one Amazon product by its ASIN via Oxylabs.

    Returns the title, price, star rating, and review count for that single
    listing. Use this to inspect a specific top seller in detail.
    """
    if is_mock():
        return _slim_product(_load_fixture("oxylabs_product.json"))
    try:
        return _slim_product(_oxy_query("amazon_product", asin))
    except Exception as e:
        return {"error": str(e)}


@tool
def amazon_reviews(asin: str) -> dict:
    """Mine the reviews of an Amazon product (by ASIN) for recurring complaints.

    Returns how many reviews were scanned, the average rating, and up to three
    common complaints from the low-star reviews. Use this to find product gaps a
    founder could exploit (e.g. "everyone says it leaks").
    """
    if is_mock():
        return _slim_reviews(_load_fixture("oxylabs_reviews.json"))
    try:
        return _slim_reviews(_oxy_query("amazon_reviews", asin))
    except Exception as e:
        return {"error": str(e)}


# Convenience list so the graph can bind all supply-side tools in one import.
OXYLABS_TOOLS = [amazon_search, amazon_product, amazon_reviews]
