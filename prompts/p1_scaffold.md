Task: scaffold the project. Do not read any other file — CLAUDE.md has all context.

1. Create pyproject.toml with dependencies:
   langgraph>=0.2.0, langchain-anthropic, langchain-openai, langchain-core,
   langchain-community, google-search-results, requests, python-dotenv, rich

2. Run: uv venv && uv sync

3. Create every file and folder listed under "Folder structure" in CLAUDE.md
   as empty stubs. Each stub gets one docstring line saying what it does.

4. Create .env.example:
   LLM_PROVIDER=mock
   SERPAPI_KEY=
   OXYLABS_USER=
   OXYLABS_PASS=
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=

Done when: all folders and stub files exist and uv sync succeeds.