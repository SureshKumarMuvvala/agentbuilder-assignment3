"""Debug-mode helpers — stream the graph and pretty-print each step for learning.

When debug mode is on, the CLI prints a Rich trace of every node execution and
the state it writes back. Press Enter after each step to advance — you control
the pace. The normal verdict panel at the end is unchanged.
"""

import json
import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage, SystemMessage
from rich.console import Console, Group
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text
from rich.tree import Tree

from .graph import INTENT_PLAN

# Nodes where LangGraph pauses after each superstep (step-by-step execution).
DEBUG_INTERRUPT_NODES = [
    "summarize_if_needed",
    "classify_intent",
    "research_trends",
    "research_shopping",
    "research_news",
    "research_amazon",
    "research_reviews",
    "agent",
]

# Beginner-friendly labels for each graph node (maps to the 5 graded concepts).
NODE_META: dict[str, dict[str, str]] = {
    "summarize_if_needed": {
        "title": "Memory Check",
        "concept": "5 · Memory",
        "color": "magenta",
        "blurb": "Compresses older chat turns once the thread exceeds 10 messages.",
    },
    "classify_intent": {
        "title": "Intent Router",
        "concept": "2 · Routing",
        "color": "yellow",
        "blurb": "Reads your question and picks which research branches to run.",
    },
    "research_trends": {
        "title": "Google Trends",
        "concept": "3 · Fan-out",
        "color": "blue",
        "blurb": "Demand signal — interest direction (runs in parallel).",
    },
    "research_shopping": {
        "title": "Google Shopping",
        "concept": "3 · Fan-out",
        "color": "blue",
        "blurb": "Demand/price signal — cross-retailer price band (parallel).",
    },
    "research_news": {
        "title": "Google News",
        "concept": "3 · Fan-out",
        "color": "blue",
        "blurb": "Landscape signal — recent headlines (parallel).",
    },
    "research_amazon": {
        "title": "Amazon Search",
        "concept": "3 · Fan-out",
        "color": "cyan",
        "blurb": "Supply signal — seller count and price band (parallel).",
    },
    "research_reviews": {
        "title": "Amazon Reviews",
        "concept": "3 · Fan-out",
        "color": "cyan",
        "blurb": "Gap signal — recurring complaints from reviews (parallel).",
    },
    "agent": {
        "title": "Verdict Agent",
        "concept": "4 · Agent + Tools",
        "color": "green",
        "blurb": "Fuses demand + supply data into the Go / No-Go / Niche answer.",
    },
}


def is_debug_enabled(cli_flag: bool = False) -> bool:
    """True when --debug was passed or LAUNCHLENS_DEBUG / DEBUG is set in the env."""
    if cli_flag:
        return True
    raw = os.getenv("LAUNCHLENS_DEBUG", os.getenv("DEBUG", "")).strip().lower()
    return raw in ("1", "true", "yes", "on")


def print_debug_turn_header(console: Console) -> None:
    """Mark the start of a traced graph run for one user question."""
    console.print()
    console.print(
        Rule(
            "[bold yellow]Debug trace[/] — step through each node at your own pace",
            style="yellow",
        )
    )
    console.print(
        "[dim]Flow: START → memory → router → (parallel research) → agent → END[/]\n"
        "[dim]Press [bold]Enter[/] after each step to run the next node. "
        "Type [bold]a[/] to auto-advance remaining steps.[/]\n"
    )


def _node_label(node: str) -> str:
    """Human-readable name for a graph node."""
    return NODE_META.get(node, {}).get("title", node.replace("_", " ").title())



def _next_step_hint(
    current_node: str,
    *,
    intent: str | None,
    pending_research: list[str],
) -> str | None:
    """Describe what runs after the current node."""
    if current_node == "summarize_if_needed":
        return _node_label("classify_intent")
    if current_node == "classify_intent":
        targets = INTENT_PLAN.get(intent or "full", INTENT_PLAN["full"])
        if len(targets) == 1:
            return _node_label(targets[0])
        names = ", ".join(_node_label(n) for n in targets[:3])
        extra = f" +{len(targets) - 3} more" if len(targets) > 3 else ""
        return f"{len(targets)} parallel nodes ({names}{extra})"
    if current_node.startswith("research_"):
        idx = pending_research.index(current_node) if current_node in pending_research else -1
        if idx >= 0 and idx + 1 < len(pending_research):
            return _node_label(pending_research[idx + 1])
        return _node_label("agent")
    if current_node == "agent":
        return "LaunchLens verdict panel"
    return None


def _prompt_continue(
    console: Console, *, next_label: str | None, auto_advance: list[bool]
) -> None:
    """Wait for Enter before moving on; 'a' skips remaining pauses this turn."""
    if auto_advance[0]:
        return

    if next_label:
        console.print(f"[bold yellow]→ Next:[/] {next_label}")
    try:
        response = console.input(
            "[dim]Press Enter to continue[/] [dim](or type [bold]a[/] to auto-advance): [/]"
        ).strip().lower()
    except (EOFError, KeyboardInterrupt):
        console.print()
        raise

    if response == "a":
        auto_advance[0] = True
        console.print("[dim]Auto-advancing remaining steps…[/]\n")


def _research_table(data: dict) -> Table:
    """Turn a slim tool dict into a compact key/value table."""
    table = Table(show_header=True, header_style="bold", box=None, padding=(0, 1))
    table.add_column("Field", style="cyan", no_wrap=True)
    table.add_column("Value", style="white")

    for key, value in data.items():
        if isinstance(value, list):
            if value and isinstance(value[0], str):
                display = ", ".join(value[:3])
                if len(value) > 3:
                    display += f" … (+{len(value) - 3} more)"
            else:
                display = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, dict):
            display = json.dumps(value, ensure_ascii=False)
        else:
            display = str(value)
        table.add_row(str(key), display)
    return table


def _messages_summary(messages: list) -> Tree:
    """Summarize message list changes without duplicating the final verdict text."""
    tree = Tree("[bold]messages[/] updated")
    for message in messages:
        if isinstance(message, RemoveMessage):
            tree.add("[dim]RemoveMessage[/] — dropped an old turn from memory")
        elif isinstance(message, SystemMessage):
            preview = (message.content or "")[:72].replace("\n", " ")
            tree.add(f"[magenta]SystemMessage[/]: {preview}…")
        elif isinstance(message, HumanMessage):
            preview = (message.content or "")[:72].replace("\n", " ")
            tree.add(f"[bold blue]HumanMessage[/]: {preview}")
        elif isinstance(message, AIMessage):
            content = message.content or ""
            if getattr(message, "tool_calls", None):
                names = ", ".join(tc.get("name", "?") for tc in message.tool_calls)
                tree.add(f"[green]AIMessage[/] (tool calls: {names})")
            else:
                tree.add(
                    f"[green]AIMessage[/] verdict ready "
                    f"([dim]{len(content)} chars — shown in panel below[/])"
                )
        else:
            tree.add(f"[dim]{type(message).__name__}[/]")
    return tree


def _format_node_body(node: str, update: dict | None) -> Any:
    """Build Rich renderables for the state delta a node returned."""
    if not update:
        if node == "summarize_if_needed":
            return Text(
                "No compression needed — conversation is still under the limit.",
                style="dim",
            )
        return Text("No state change.", style="dim")

    parts: list[Any] = []

    if node == "classify_intent":
        query = update.get("query", "")
        intent = update.get("intent", "?")
        targets = INTENT_PLAN.get(intent, INTENT_PLAN["full"])

        route = Table(show_header=False, box=None, padding=(0, 1))
        route.add_column("Key", style="cyan")
        route.add_column("Value")
        route.add_row("query", query or "—")
        route.add_row("intent", f"[bold yellow]{intent}[/]")
        route.add_row("fan-out targets", ", ".join(targets))
        parts.append(route)

    if "research" in update and update["research"]:
        research = update["research"]
        for source, payload in research.items():
            parts.append(Text(f"research[{source}]", style="bold cyan"))
            if isinstance(payload, dict):
                if payload.get("error"):
                    parts.append(Text(f"  error: {payload['error']}", style="red"))
                else:
                    parts.append(_research_table(payload))
            else:
                parts.append(Text(f"  {payload}", style="white"))

    if "messages" in update and update["messages"]:
        parts.append(_messages_summary(update["messages"]))

    if not parts:
        pretty = json.dumps(update, indent=2, default=str, ensure_ascii=False)
        parts.append(Text(pretty, style="white"))

    return Group(*parts) if len(parts) > 1 else parts[0]


def print_debug_step(
    console: Console, step: int, node: str, update: dict | None
) -> None:
    """Render one node execution as a numbered, color-coded panel."""
    meta = NODE_META.get(
        node,
        {
            "title": node.replace("_", " ").title(),
            "concept": "Graph node",
            "color": "white",
            "blurb": "",
        },
    )
    title = (
        f"[bold {meta['color']}]Step {step}[/] · "
        f"{meta['title']} "
        f"[dim]({meta['concept']})[/]"
    )
    body = _format_node_body(node, update)
    console.print(
        Panel(
            Group(body, Text(meta["blurb"], style="dim italic") if meta["blurb"] else ""),
            title=title,
            border_style=meta["color"],
            padding=(1, 2),
        )
    )


def run_graph_with_debug(app, inputs: dict, config: dict, console: Console) -> dict:
    """Step through the graph one node at a time; return the final merged state."""
    print_debug_turn_header(console)

    step = 0
    final_state: dict | None = None
    stream_input: dict | None = inputs
    intent: str | None = None
    pending_research: list[str] = []
    auto_advance = [False]

    while True:
        for mode, chunk in app.stream(
            stream_input,
            config,
            stream_mode=["updates", "values"],
            interrupt_after=DEBUG_INTERRUPT_NODES,
        ):
            if mode == "updates":
                for node_name, update in chunk.items():
                    if node_name == "__interrupt__":
                        continue

                    step += 1
                    print_debug_step(console, step, node_name, update)

                    if node_name == "classify_intent" and update:
                        intent = update.get("intent")
                        pending_research = list(
                            INTENT_PLAN.get(intent or "full", INTENT_PLAN["full"])
                        )

                    next_label = _next_step_hint(
                        node_name,
                        intent=intent,
                        pending_research=pending_research,
                    )
                    _prompt_continue(console, next_label=next_label, auto_advance=auto_advance)

            elif mode == "values":
                final_state = chunk

        snapshot = app.get_state(config)
        if not snapshot.next:
            break
        stream_input = None

    if final_state is None:
        raise RuntimeError("Debug stream finished without a final state.")

    console.print(Rule("[dim]End of debug trace[/]", style="dim"))
    console.print()
    return final_state
