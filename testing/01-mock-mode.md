# Testing LaunchLens — Mock Mode (offline, no keys)

Mock mode is the **default** and the safest way to test LaunchLens. It needs
**no API keys** and **no network**: every tool reads a saved JSON file from
`fixtures/`, and a fake LLM (`_MockChatModel` in `launchlens/config.py`) replays
canned Go / No-Go / Niche verdicts. Use this to confirm the app, the graph, and
all 5 LangGraph concepts work before you spend a cent on a real API.

> This is the base doc. The OpenAI and Anthropic docs
> ([`02-openai-mode.md`](./02-openai-mode.md), [`03-anthropic-mode.md`](./03-anthropic-mode.md))
> reuse the setup steps here and only change `.env`.

---

## 0. Prerequisites (one time)

- **Python 3.12+** — check with `python --version`
- **[`uv`](https://docs.astral.sh/uv/)** — check with `uv --version`

---

## 1. Install dependencies

From the project root:

```powershell
uv venv      # create the local .venv
uv sync      # install everything in pyproject.toml into it
```

Expected: `uv sync` finishes with no errors and a `.venv/` folder exists.

---

## 2. Configure `.env` for mock mode

```powershell
cp .env.example .env
```

Open `.env` and make sure it reads exactly:

```env
LLM_PROVIDER=mock
```

You can leave every other key blank — mock mode never reads them.

> Safety net: `get_provider()` in `launchlens/config.py` falls back to `mock`
> for any unrecognized value, so even a typo can't trigger a paid API call.

---

## 3. Run the chat loop

```powershell
uv run launchlens
# or: uv run python cli.py
```

### What you should see

A cyan banner, then a yellow confirmation line:

```
LaunchLens  — should you launch it?
LLM mode: mock  ·  type 'exit' to quit

Running in mock mode: tools read from fixtures/, no API keys needed.
```

The line **`LLM mode: mock`** is your proof the provider switch worked.

---

## 4. Drive a test conversation

Type these one at a time. They exercise routing, fan-out, fusion, and memory:

| # | Type this | What it tests |
|---|-----------|----------------|
| 1 | `I want to launch a stainless-steel insulated water bottle in India under ₹1,500 — is it worth it?` | Full report → **fan-out** (Trends + Amazon + News in parallel) |
| 2 | `What are people complaining about in the reviews of the top sellers?` | **Routing** to the supply branch + reviews tool |
| 3 | `What about the US market instead?` | **Memory** — it should keep the bottle context |
| 4 | `Compare it with a cheaper plastic version.` | Fusion across demand + supply |
| 5 | `Give me the final Go/No-Go verdict with a price band and positioning.` | Verdict rendering |
| 6 | `Summarize everything we've discussed.` | **Summarization** node (triggers after >10 messages) |

After each answer, look at the dim trace line under the verdict panel:

```
intent: full_report  ·  sources fused: news, shopping, trends
```

- **`intent:`** shows which branch routing chose.
- **`sources fused:`** shows which tool outputs were merged — multiple sources on
  turn 1 confirms the parallel `Send()` fan-out ran.

> In mock mode the verdict text cycles through 3 canned answers (GO → NICHE →
> NO-GO) regardless of the question — that's expected. You're testing the
> **graph wiring**, not the LLM's reasoning.

---

## 5. Verify memory survives a restart

1. Type `exit` to quit.
2. Run `uv run launchlens` again.
3. Ask: `What were we just discussing?`

It should recall the water-bottle thread. This works because the SQLite
checkpointer (`launchlens/memory.py`) writes to `launchlens_memory.sqlite` on
disk under a fixed `thread_id` (`launchlens-cli`).

**To reset memory for a clean test run**, delete that file:

```powershell
Remove-Item launchlens_memory.sqlite
```

---

## 6. Mock-mode checklist

- [ ] `uv sync` completed with no errors
- [ ] Banner shows `LLM mode: mock` and the yellow fixtures notice
- [ ] Turn 1 shows multiple `sources fused` (fan-out works)
- [ ] `intent:` changes between a demand/supply question and a full report (routing works)
- [ ] After quitting + relaunching, the agent recalls the prior topic (memory works)
- [ ] No traceback ever crashes the session

If all six pass, the agent is wired correctly. Now move on to a real LLM:
[`02-openai-mode.md`](./02-openai-mode.md) or
[`03-anthropic-mode.md`](./03-anthropic-mode.md).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `command not found: uv` | Install uv: https://docs.astral.sh/uv/getting-started/installation/ |
| Banner shows a mode other than `mock` | Check `LLM_PROVIDER=mock` in `.env`, with no stray spaces |
| `FileNotFoundError ... fixtures/...` | Run from the project root so `fixtures/` resolves |
| Garbled ₹ / emoji on Windows | Already handled — `cli.py` forces UTF-8 output |
