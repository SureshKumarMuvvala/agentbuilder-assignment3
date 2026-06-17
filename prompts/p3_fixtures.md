Task: create mock JSON fixtures in fixtures/ for "stainless steel water bottle India".

fixtures/google_trends.json
  Fields: trend_direction (str), peak_interest (0-100), related_queries (list 5),
          regional_interest (dict 3 regions)

fixtures/google_shopping.json
  Fields: products array (5 items: title, price_inr, rating)

fixtures/google_news.json
  Fields: events array (3 items: title, date, snippet), market_sentiment

fixtures/amazon_search.json
  Fields: products array (5 items: title, asin, price, rating, review_count)

fixtures/amazon_product.json
  Fields: title, price, rating, total_reviews,
          reviews array (5 items with text field),
          key_features (list 3)

fixtures/amazon_bestsellers.json
  Fields: bestsellers array (5 items: rank, title, price)

Rules: data must be internally consistent, each file under 50 lines.
Done when: all 6 fixture files exist and are valid JSON.