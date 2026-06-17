# Testing LaunchLens — OpenAI Mode (live LLM)

OpenAI mode swaps the fake LLM for a real **`gpt-4o`** chat model
(`ChatOpenAI`, set in `launchlens/config.py`). The verdicts are now genuinely
reasoned from the tool data instead of canned. The **tools** can still run from
fixtures (no SerpApi/Oxylabs keys needed) — so you can test real LLM reasoning
cheaply, then add live data only when you want it.

> Do [`01-mock-mode.md`](./01-mock-mode.md) first. This doc assumes you've
> already run `uv venv` + `uv sync` and proven the graph works offline.

---

## 1. Get an OpenAI API key

1. Sign in at <https://platform.openai.com/>.
2. Create a key under **API keys** (starts with `sk-...`).
3. Make sure the account has billing/credits — `gpt-4o` is a paid model.

---

## 2. Configure `.env` for OpenAI

Edit `.env`:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-real-key-here
```

Leave `SERPAPI_KEY` / `OXYLABS_*` blank for now — with those blank the tools keep
reading from `fixtures/`, so **only the LLM is live**. (See step 5 to go fully live.)

> Cost note: each turn makes one or more `gpt-4o` calls. Test with a few short
> turns, not the whole demo script, to keep spend tiny.

---

## 3. Run and confirm the mode switched

```powershell
uv run launchlens
```

The banner must now read:

```
LLM mode: openai
```

Note the yellow "mock mode" fixtures notice is **gone** — that's expected; it
only prints in mock mode.

---

## 4. Drive a test conversation

```text
You: I want to launch a stainless-steel insulated water bottle in India under ₹1,500 — is it worth it?
```

What to verify (different from mock mode):

- The verdict is **specific to your question** — it references the price band,
  trends, and competitor data, not a fixed canned sentence.
- The dim trace still shows `intent:` and `sources fused:` — routing and fan-out
  are unchanged; only the brain changed.
- Ask a **follow-up** (`What about the US market?`) and confirm it stays on topic
  — memory works the same as mock mode.

Try one demand-only and one supply-only question to confirm the LLM picks the
right tools:

```text
You: Is search demand for this rising or falling?     (should lean on Google Trends)
You: How crowded is Amazon and what do reviewers complain about?  (should lean on Oxylabs)
```

---

## 5. (Optional) Go fully live with real demand/supply data

To replace the fixtures with real API calls, also fill in:

```env
SERPAPI_KEY=your-serpapi-key
OXYLABS_USER=your-oxylabs-username
OXYLABS_PASS=your-oxylabs-password
```

- **SerpApi** key: <https://serpapi.com/manage-api-key>
- **Oxylabs** credentials: from your Oxylabs dashboard (Realtime / E-Commerce Scraper API)

Now `is_mock()` is `False`, so every tool hits the real API. Each tool is wrapped
in try/except and returns `{"error": ...}` on failure, so a bad key or network
blip degrades gracefully — the session won't crash; you'll just see `error` in
the fused sources.

---

## 6. OpenAI-mode checklist

- [ ] Banner shows `LLM mode: openai`
- [ ] Verdict text is tailored to the question (not one of the 3 canned lines)
- [ ] `intent:` / `sources fused:` still appear (routing + fan-out intact)
- [ ] A follow-up question keeps prior context (memory intact)
- [ ] (If keys added) `sources fused` reflect real API data, errors handled cleanly

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Banner still shows `mock` | `LLM_PROVIDER=openai` not saved, or stray spaces around it |
| `AuthenticationError` / 401 | Bad or missing `OPENAI_API_KEY` |
| `RateLimitError` / quota | No billing/credits on the OpenAI account |
| `ModuleNotFoundError: langchain_openai` | Re-run `uv sync` |
| Tools return `{"error": ...}` | Expected if live keys are blank/invalid — fixtures used otherwise |
