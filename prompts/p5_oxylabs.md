Task: write launchlens/tools/oxylabs_tools.py only.

Base: POST https://realtime.oxylabs.io/v1/queries
Auth: (OXYLABS_USER, OXYLABS_PASS) from config

Three @tool functions:
1. search_amazon(query: str) -> dict
   payload: {"source": "amazon_search", "query": query, "parse": True}
   return slim: {top_sellers (max 5: title/price/rating/reviews), price_range, avg_rating}

2. get_amazon_product(asin: str) -> dict
   payload: {"source": "amazon_product", "query": asin, "parse": True}
   return slim: {title, price, rating, total_reviews,
                 top_complaints (max 3, extracted from reviews text),
                 key_features (max 3)}

3. get_amazon_bestsellers(category: str) -> dict
   payload: {"source": "amazon_bestsellers", "query": category, "parse": True}
   return slim: {top_3: [{rank, title, price}], category}

Each function:
- checks is_mock() first, loads matching fixture if True
- wraps live call in try/except, returns {"error": str, "data": {}} on failure
- has LLM-quality docstring
- is under 50 lines

Done when: LLM_PROVIDER=mock python -c "from launchlens.tools.oxylabs_tools import search_amazon; print(search_amazon.invoke('water bottle'))" prints a dict.