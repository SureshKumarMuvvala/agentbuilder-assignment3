# Testing LaunchLens — Anthropic (Claude) Mode (live LLM)

Anthropic mode runs the agent on **`claude-opus-4-8`** — Anthropic's flagship
Claude model — via `ChatAnthropic` (`launchlens/config.py`, `temperature=0` so the
Go/No-Go verdict is stable and reproducible). As with OpenAI mode, the tools can
keep reading from `fixtures/`, so you can test real Claude reasoning without any
SerpApi/Oxylabs keys, then add live data when you want it.

> Do [`01-mock-mode.md`](./01-mock-mode.md) first. This doc assumes `uv venv` +
> `uv sync` are done and the graph already works offline.

---

## 1. Get an Anthropic API key

1. Sign in at <https://console.anthropic.com/>.
2. Create a key under **API Keys** (starts with `sk-ant-...`).
3. Make sure the workspace has credits — Claude is a paid model.

---

## 2. Configure `.env` for Anthropic

Edit `.env`:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

Leave `SERPAPI_KEY` / `OXYLABS_*` blank to keep the tools on fixtures so **only
the LLM is live** (cheapest way to test Claude's reasoning). See step 5 to go
fully live.

> The model id is pinned in `launchlens/config.py` as
> `ANTHROPIC_MODEL = "claude-opus-4-8"`. If your account lacks access to Opus,
> change that one line to a model you can use (e.g. a Sonnet id) and re-run.

---

## 3. Run and confirm the mode switched

```powershell
uv run launchlens
```

The banner must read:

```
LLM mode: anthropic
```

The yellow "mock mode" fixtures notice will not appear — expected outside mock mode.

---

## 4. Drive a test conversation

```text
You: I want to launch a stainless-steel insulated water bottle in India under ₹1,500 — is it worth it?
```

Verify:

- The verdict is **reasoned and specific** to the question — Claude weighs demand
  vs. supply and gives a price band + positioning, not a canned line.
- Because `temperature=0`, asking the **same question twice** should give a
  near-identical verdict — a good reproducibility check for a graded demo.
- The dim trace still shows `intent:` and `sources fused:` — routing and fan-out
  are model-agnostic.
- A follow-up (`What about the US market?`) stays on the bottle topic — memory works.

Optional intent checks:

```text
You: Is demand for this rising?                          (demand branch → Trends)
You: How saturated is Amazon, and what do reviews say?   (supply branch → Oxylabs)
```

---

## 5. (Optional) Go fully live with real demand/supply data

Fill in the data-provider keys too:

```env
SERPAPI_KEY=your-serpapi-key
OXYLABS_USER=your-oxylabs-username
OXYLABS_PASS=your-oxylabs-password
```

- **SerpApi**: <https://serpapi.com/manage-api-key>
- **Oxylabs**: your Oxylabs dashboard credentials

Now `is_mock()` is `False` and every tool calls the real API. Each call is
wrapped in try/except → `{"error": ...}` on failure, so bad credentials or a
network issue degrade gracefully instead of crashing the chat.

---

## 6. Anthropic-mode checklist

- [ ] Banner shows `LLM mode: anthropic`
- [ ] Verdict text is tailored to the question (not a canned line)
- [ ] Re-asking the same question gives a stable verdict (temperature=0)
- [ ] `intent:` / `sources fused:` still appear (routing + fan-out intact)
- [ ] A follow-up keeps prior context (memory intact)
- [ ] (If keys added) live data flows in, errors handled cleanly

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Banner still shows `mock` | `LLM_PROVIDER=anthropic` not saved, or stray spaces |
| `AuthenticationError` / 401 | Bad or missing `ANTHROPIC_API_KEY` |
| `model not found` / 404 | Your account lacks `claude-opus-4-8`; change `ANTHROPIC_MODEL` in `config.py` |
| `ModuleNotFoundError: langchain_anthropic` | Re-run `uv sync` |
| Tools return `{"error": ...}` | Expected if live keys blank/invalid — fixtures used otherwise |
