Task: verify the full build. Fix any errors found before reporting done.

Run these checks in order:
1. uv run python -c "from launchlens.config import get_llm, is_mock; print(get_llm(), is_mock())"
2. LLM_PROVIDER=mock uv run python -c "from launchlens.tools.serpapi_tools import get_google_trends; print(get_google_trends.invoke('water bottle'))"
3. LLM_PROVIDER=mock uv run python -c "from launchlens.tools.oxylabs_tools import search_amazon; print(search_amazon.invoke('water bottle'))"
4. LLM_PROVIDER=mock uv run python -c "from launchlens.graph import build_graph; g=build_graph(); print(g.get_graph().draw_mermaid())"
5. LLM_PROVIDER=mock uv run python -c "
from launchlens.graph import build_graph
import uuid
app = build_graph()
thread = str(uuid.uuid4())
config = {'configurable': {'thread_id': thread}}
r1 = app.invoke({'query': 'water bottle India', 'messages': []}, config)
r2 = app.invoke({'query': 'what about US market?', 'messages': []}, config)
print('Memory test: PASS' if len(r2['messages']) > 2 else 'Memory test: FAIL')
"

Fix any failures. Then print:
BUILD COMPLETE
Run: uv run launchlens