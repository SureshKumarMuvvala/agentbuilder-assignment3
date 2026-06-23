"""Rich terminal UI and entry point for the LaunchLens chat agent.

This is what a founder actually runs (``uv run launchlens``). It does three small
jobs and leans on the graph for everything hard:

1. Build the LangGraph app once (which wires up the tools, agent, and SQLite
   memory).
2. Loop: read a product question, wrap it as a ``HumanMessage``, and invoke the
   graph under a fixed ``thread_id`` so the conversation has memory — including
   across restarts, because the checkpointer is on disk.
3. Pretty-print the Go/No-Go/Niche verdict with Rich, plus a dim line showing
   which intent was routed and which data sources were fused.

Pass ``--debug`` (or set ``LAUNCHLENS_DEBUG=1``) to stream each graph node and
its state delta before the verdict — useful when learning how LangGraph runs.

Type ``exit`` (or Ctrl-C) to quit. Because the thread_id is stable, quitting and
relaunching resumes the same chat — that's the "memory survives restarts" demo.
"""

import argparse
import sys

from langchain_core.messages import HumanMessage
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from launchlens.config import get_provider
from launchlens.debug import is_debug_enabled, run_graph_with_debug
from launchlens.graph import build_graph

# Windows' legacy console defaults to the cp1252 code page, which can't encode
# the rupee sign, emoji, or other characters a real verdict might contain — and
# that raises UnicodeEncodeError mid-print. Force UTF-8 (replacing anything that
# still doesn't fit) so the demo can never crash on a stray character.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

console = Console()

# One stable conversation id. Reusing it means relaunching the CLI continues the
# same chat (memory across restarts). Delete launchlens_memory.sqlite to reset.
THREAD_ID = "launchlens-cli"

# Words that end the session.
QUIT_WORDS = {"exit", "quit", "q", "bye"}


def _parse_args() -> argparse.Namespace:
    """CLI flags; debug can also be toggled via LAUNCHLENS_DEBUG in .env."""
    parser = argparse.ArgumentParser(
        description="LaunchLens — Go/No-Go/Niche verdict for product ideas."
    )
    parser.add_argument(
        "--debug",
        "-d",
        action="store_true",
        help="Stream each graph node and its state (learning mode)",
    )
    return parser.parse_args()


def _print_banner(*, debug: bool = False) -> None:
    """Show the title and which LLM mode we're running in."""
    provider = get_provider()
    debug_line = "  ·  [bold yellow]debug trace ON[/]" if debug else ""
    console.print(
        Panel.fit(
            "[bold cyan]LaunchLens[/]  — should you launch it?\n"
            f"[dim]LLM mode: {provider}{debug_line}  ·  type 'exit' to quit[/]",
            border_style="cyan",
        )
    )
    if provider == "mock":
        console.print(
            "[dim yellow]Running in mock mode: tools read from fixtures/, no API "
            "keys needed.[/]\n"
        )
    if debug:
        console.print(
            "[dim yellow]Debug mode: step through each graph node — press Enter "
            "to advance, [bold]a[/] to auto-advance.[/]\n"
        )


def _print_verdict(state: dict) -> None:
    """Render the agent's answer plus a dim trace of what was researched."""
    # The verdict is the last message the graph produced.
    answer = state["messages"][-1].content
    console.print(Panel(Markdown(answer), title="LaunchLens", border_style="green"))

    # A small trace makes the routing + fan-out visible during a demo.
    intent = state.get("intent", "?")
    sources = ", ".join(sorted(state.get("research", {}).keys())) or "none"
    console.print(f"[dim]intent: {intent}  ·  sources fused: {sources}[/]\n")


def main() -> None:
    """Run the interactive chat loop."""
    args = _parse_args()
    debug = is_debug_enabled(args.debug)
    _print_banner(debug=debug)

    # Build the graph once; it owns the tools, agent, and SQLite checkpointer.
    app = build_graph()
    config = {"configurable": {"thread_id": THREAD_ID}}

    while True:
        # Read the founder's next question. Ctrl-C / Ctrl-D exit cleanly.
        try:
            question = console.input("[bold]You:[/] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye — good luck with the launch![/]")
            break

        if not question:
            continue
        if question.lower() in QUIT_WORDS:
            console.print("[dim]Goodbye — good luck with the launch![/]")
            break

        # Invoke the graph with just the new turn; the checkpointer supplies the
        # rest of the history automatically via the thread_id.
        try:
            payload = {"messages": [HumanMessage(content=question)]}
            if debug:
                state = run_graph_with_debug(app, payload, config, console)
            else:
                with console.status("[cyan]Researching demand + supply…[/]"):
                    state = app.invoke(payload, config)
            _print_verdict(state)
        except Exception as e:  # never let one bad turn kill the session
            console.print(f"[red]Something went wrong:[/] {e}\n")


if __name__ == "__main__":
    # Allow `python cli.py` as well as the `launchlens` entry point.
    sys.exit(main())
