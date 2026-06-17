Task: write launchlens/config.py only.

- load_dotenv() on import
- get_llm() returns correct LLM based on LLM_PROVIDER env var (see CLAUDE.md)
  mock -> FakeListLLM cycling 3 preset verdict-shaped responses
  openai -> ChatOpenAI(model="gpt-4o-mini")
  anthropic -> ChatAnthropic(model="claude-sonnet-4-6")
- is_mock() -> bool
- Beginner comment block at top (see CLAUDE.md rule)

Done when: python -c "from launchlens.config import get_llm; print(get_llm())" runs without error.