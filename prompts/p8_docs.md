Task: write README.md, CONCEPT_MAP.md, and SUBMISSION.md.

README.md sections:
1. One-line description
2. Setup (uv venv, uv sync, cp .env.example .env, uv run launchlens)
3. Mode toggle (LLM_PROVIDER or /mode command)
4. Concept map table: file + function + line for all 5 LangGraph concepts
5. Demo script — these 6 prompts in order:
   "I want to launch a stainless steel water bottle in India under ₹1500"
   "What do customers complain about most in this category?"
   "Compare with the US market"
   "Which price point has the least competition?"
   "Give me a final positioning strategy"
   /mode anthropic  [then repeat prompt 1 to show live API call]
6. Graph diagram: run python -c "from launchlens.graph import build_graph; print(build_graph().get_graph().draw_mermaid())" and paste output
7. Video link: [placeholder]

CONCEPT_MAP.md: same table + one plain-English paragraph per concept.

SUBMISSION.md: fill SUBMISSION_TEMPLATE.md with real file names, function names, and line numbers from the actual code.

Done when all 3 files exist and README setup section runs cleanly.