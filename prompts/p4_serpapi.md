Task: write launchlens/tools/serpapi_tools.py only.

Three @tool functions:
1. get_google_trends(query: str) -> dict
   live: GET https://serpapi.com/search?engine=google_trends&q={query}&api_key={SERPAPI_KEY}
   return slim: {trend_direction, peak_interest, top_related_queries (max 5), regional_interest (top 3)}

2. get_google_shopping(query: str) -> dict
   live: engine=google_shopping
   return slim: {price_range: {min,max,median}, top_products (max 3: title/price/rating), currency}

3. get_google_news(query: str) -> dict
   live: engine=google_news
   return slim: {recent_events (max 3: title/date/snippet), market_sentiment}

Each function:
- checks is_mock() first, loads matching fixture if True
- wraps live call in try/except, returns {"error": str} on failure
- has LLM-quality docstring (2-3 sentences: what it returns, when to call it)
- is under 40 lines

Done when: LLM_PROVIDER=mock python -c "from launchlens.tools.serpapi_tools import get_google_trends; print(get_google_trends.invoke('water bottle'))" prints a dict.