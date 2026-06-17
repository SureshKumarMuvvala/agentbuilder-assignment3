#!/bin/bash
set -e
for p in prompts/p1_scaffold.md prompts/p2_config.md prompts/p3_fixtures.md \
          prompts/p4_serpapi.md prompts/p5_oxylabs.md prompts/p6_graph.md \
          prompts/p7_cli.md prompts/p8_docs.md prompts/p9_verify.md; do
  echo "=== Running $p ==="
  claude "$(cat $p)"
  echo "=== Done $p ==="
done