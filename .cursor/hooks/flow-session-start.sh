#!/usr/bin/env bash
#
# sessionStart: warm the Flow server so later `flow` / `npm run typecheck:fast`
# calls reuse incremental state instead of paying for a cold `flow check`.
#
# Fire-and-forget from Cursor's point of view -- we return quickly and let
# `flow start` finish in the background when the server is not already up.

set -u

# Drain hook stdin (session JSON). We do not need the payload.
cat >/dev/null

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

FLOW_BIN=""
if command -v flow >/dev/null 2>&1; then
  FLOW_BIN="flow"
elif command -v npx >/dev/null 2>&1; then
  FLOW_BIN="npx --no-install flow"
fi

STATUS="Flow CLI not found; typecheck unavailable until flow-bin is on PATH."
if [[ -n "$FLOW_BIN" ]]; then
  # --no-auto-start: cheap probe. Exit 0 means a server is already serving.
  if $FLOW_BIN status --no-auto-start --quiet >/dev/null 2>&1; then
    STATUS="Flow server already running. Prefer \`npm run typecheck:fast\` (or \`flow\`) over \`npm run typecheck\` / \`flow check\`."
  else
    # Background start so this hook returns before a cold init finishes.
    (
      $FLOW_BIN start --quiet >/dev/null 2>&1
    ) &
    STATUS="Started Flow server in the background. Prefer \`npm run typecheck:fast\` (or \`flow\`) over \`npm run typecheck\` / \`flow check\`. First status call may wait for warm-up."
  fi
fi

# Escape for JSON string (minimal: backslash and double-quote).
STATUS_JSON=$(printf '%s' "$STATUS" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

printf '{"additional_context":%s}\n' "$STATUS_JSON"
exit 0
