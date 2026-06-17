"""3-mode LLM switcher (mock | openai | anthropic) driven by the LLM_PROVIDER env var.

This module is the single place that decides *which* language model the rest of
the app talks to. Everything else (the graph, the agent node) just calls
``get_llm()`` and never has to care whether we are running offline in mock mode
or hitting a real API. Keeping that decision in one file is what lets the whole
project flip between "free, no-keys demo" and "real research" with one env var.
"""

import os

from dotenv import load_dotenv

# Read the .env file once, when this module is first imported, so that
# os.environ is populated before anyone calls get_provider() / get_llm().
load_dotenv()

# The three modes we support. "mock" is the safe default: it needs no API keys
# and runs entirely from saved fixtures, which is what we want for a demo.
VALID_PROVIDERS = ("mock", "openai", "anthropic")

# Model IDs per provider. claude-opus-4-8 is Anthropic's current flagship model;
# gpt-4o is OpenAI's. Pinning them here keeps model choices out of the graph code.
ANTHROPIC_MODEL = "claude-opus-4-8"
OPENAI_MODEL = "gpt-4o"


def get_provider() -> str:
    """Return the active provider name, lowercased, defaulting to 'mock'.

    We read LLM_PROVIDER fresh each call (rather than caching) so tests can flip
    the env var between calls. Anything we don't recognise falls back to 'mock'
    so a typo can never accidentally trigger a paid API call.
    """
    provider = os.getenv("LLM_PROVIDER", "mock").strip().lower()
    return provider if provider in VALID_PROVIDERS else "mock"


def is_mock() -> bool:
    """True when we should run fully offline (fake LLM + fixture-backed tools).

    Tools call this to decide whether to load from fixtures/ or hit a real API.
    Centralising the check here means 'mock mode' has exactly one definition.
    """
    return get_provider() == "mock"


def get_llm():
    """Build and return the chat model for the active provider.

    - mock:      a FakeListChatModel that replays canned answers. No network,
                 no keys, deterministic output — perfect for a graded demo.
    - openai:    ChatOpenAI (needs OPENAI_API_KEY).
    - anthropic: ChatAnthropic on claude-opus-4-8 (needs ANTHROPIC_API_KEY).

    Imports for the real providers are done lazily, inside each branch, so that
    mock mode works even if langchain_openai / langchain_anthropic aren't usable
    (e.g. missing optional deps) on the demo machine.
    """
    provider = get_provider()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        # temperature=0 keeps the Go/No-Go verdict stable and reproducible.
        return ChatAnthropic(model=ANTHROPIC_MODEL, temperature=0)

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=OPENAI_MODEL, temperature=0)

    # Default: mock mode. _MockChatModel cycles through these canned replies, one
    # per call, so the CLI shows a believable conversation without any API key.
    canned_responses = [
        "Verdict: GO. Demand is rising and the top Amazon sellers leave a clear "
        "price gap to undercut. Position on durability.",
        "Verdict: NICHE. Search interest is steady but small; target a specific "
        "sub-segment rather than the mass market.",
        "Verdict: NO-GO. The category is crowded with cheap, well-reviewed "
        "incumbents and demand is flat.",
    ]
    return _MockChatModel(responses=canned_responses)


# FakeListChatModel is a stand-in chat model that replays a fixed list of
# answers instead of calling an API. We subclass it for one reason: LangGraph's
# create_react_agent (our agent node) calls model.bind_tools(...) at build time,
# and the stock fake model raises NotImplementedError there. Overriding
# bind_tools to just return self lets the agent graph build and run in mock mode,
# while the model still replays its canned verdicts. Defined after get_llm() so
# the import stays local to the mock branch's needs.
from langchain_core.language_models.fake_chat_models import FakeListChatModel  # noqa: E402


class _MockChatModel(FakeListChatModel):
    """Offline fake chat model that also satisfies create_react_agent."""

    def bind_tools(self, tools, **kwargs):
        # Ignore the tools (mock mode never really calls them through the LLM)
        # but return a usable model so the react-agent loop can run.
        return self
