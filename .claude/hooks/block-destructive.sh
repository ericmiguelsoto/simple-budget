#!/bin/bash
# block-destructive.sh
# PreToolUse hook for Bash commands.
# Blocks obviously destructive operations before they execute.
#
# Adapted for RatsNest:
# - Removed `source` from .env blocklist (needed for `source .env.local` in Supabase migrations)
# - Still blocks cat/head/tail/grep of .env files (prevents credential exposure in output)
#
# Uses Node.js for JSON parsing (no jq dependency).

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try {
      const j=JSON.parse(d);
      console.log(j.tool_input?.command || '');
    } catch(e) { console.log(''); }
  });
")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block recursive deletion of root, home, or parent directory
if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|(-[a-zA-Z]*\s+)*)(\/|~|\$HOME|\.\.)'; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Blocked destructive rm command targeting root, home, or parent directory. If intentional, run manually."}}'
  exit 0
fi

# Block database destruction
if echo "$COMMAND" | grep -qiE 'DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\S+\s*;?\s*$'; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Blocked destructive database command. If intentional, run manually."}}'
  exit 0
fi

# Block force pushes and hard resets
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force|git\s+push\s+-f\b|git\s+reset\s+--hard\s+(HEAD~|origin)'; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Blocked force push or hard reset. If intentional, run manually."}}'
  exit 0
fi

# Block .env file reads that would expose credentials in output
# NOTE: `source .env.local` is intentionally ALLOWED (needed for Supabase migrations)
if echo "$COMMAND" | grep -qE '(cat|less|head|tail|more|grep|sed|awk|bat)\s+\.env\b'; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Blocked .env file read. Credentials should not be exposed in output. If intentional, run manually."}}'
  exit 0
fi

exit 0
