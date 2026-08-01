#!/bin/bash
# stop-verify.sh
# Runs when Claude tries to finish a task (Stop event).
# Adapted for this zero-dependency vanilla-JS project:
# - Runs `node --test tests/` if a tests/ folder with test files exists.
# - Blocks completion while any unit test fails.
# Uses Node.js for JSON parsing (no jq on this machine).

INPUT=$(cat)

# Prevent an infinite loop: if this hook already blocked once and Claude
# retried, allow the stop through.
STOP_ACTIVE=$(echo "$INPUT" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try {
      const j=JSON.parse(d);
      console.log(j.stop_hook_active || false);
    } catch(e) { console.log('false'); }
  });
")
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# No tests yet (early scaffolding) -> nothing to verify.
if ! ls tests/*.test.js >/dev/null 2>&1; then
  echo '{"additionalContext": "No unit tests found in tests/. Task completion is unverified by the stop hook."}'
  exit 0
fi

# NOTE: bare `node --test` (default file discovery). Passing the directory
# (`node --test tests/`) breaks on this machine — see tasks/lessons.md.
TEST_OUTPUT=$(node --test 2>&1)
if [ $? -ne 0 ]; then
  TRUNCATED=$(echo "$TEST_OUTPUT" | grep -E "not ok|fail|✖" | head -15)
  ESCAPED=$(echo "$TRUNCATED" | sed ':a;N;$!ba;s/\n/\\n/g' | sed 's/"/\\"/g')
  echo "{\"decision\": \"block\", \"reason\": \"Unit tests are failing. Fix before completing:\\n${ESCAPED}\"}"
  exit 2
fi

exit 0
