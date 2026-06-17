Task: write launchlens/cli.py only.

Use rich library. Entry point: main() called via "uv run launchlens".

Features:
- Startup: banner + current mode displayed in color
- Chat loop: read user input, invoke graph with thread_id config, print response
- Commands:
    /mode mock|openai|anthropic  -> update LLM_PROVIDER, rebuild agent, keep thread
    /new   -> generate new thread_id
    /exit  -> quit
    /help  -> show commands
- Output:
    user input: blue
    tool calls: yellow "📊 Calling: {tool_name}..."
    verdict: green Panel with border
    spinner during agent run
    show "Session: {thread_id}" each turn
- invoke config: {"configurable": {"thread_id": thread_id}}

Add to pyproject.toml under [project.scripts]:
launchlens = "launchlens.cli:main"

Add beginner comments explaining Rich and the chat loop.

Done when: LLM_PROVIDER=mock uv run launchlens starts without error and accepts input.