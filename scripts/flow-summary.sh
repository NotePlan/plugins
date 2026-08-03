#!/usr/bin/env bash
#
# flow-summary.sh -- Summarize Flow typecheck errors by file
#
# Usage:
#   scripts/flow-summary.sh                       # all files, using flow server if running
#   scripts/flow-summary.sh jgclark.Dashboard      # only files whose path contains this string
#   scripts/flow-summary.sh -c jgclark.Dashboard   # force a fresh `flow check` instead of `flow status`
#
# by @ClaudeAI guided by @jgclark, 2023-08-02

set -uo pipefail  # NOTE: no -e -- flow's own exit codes (2 = errors found) are expected, not failures

FRESH_CHECK=false
if [[ "${1:-}" == "-c" ]]; then
  FRESH_CHECK=true
  shift
fi

FOLDER_FILTER="${1:-}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

if ! command -v flow >/dev/null 2>&1; then
  echo "Error: flow is required but not installed or not on PATH." >&2
  exit 1
fi

# Get Flow's JSON output. `flow status`/`flow check` exit 0 (clean), 2 (errors
# found), or occasionally other codes on real failures -- exit code alone can't
# tell us whether the JSON is good, so we validate the JSON itself instead.
get_flow_json() {
  local out
  if ! $FRESH_CHECK; then
    out="$(flow status --json 2>/dev/null)"
    if echo "$out" | jq -e . >/dev/null 2>&1; then
      echo "$out"
      return 0
    fi
    # flow status gave us nothing parseable (server not running, etc.) -- fall through to a fresh check
  fi

  out="$(flow check --json 2>/dev/null)"
  if echo "$out" | jq -e . >/dev/null 2>&1; then
    echo "$out"
    return 0
  fi

  echo "Error: could not get valid JSON from flow status or flow check." >&2
  return 1
}

RAW_JSON="$(get_flow_json)" || exit 1

TOTAL_ERRORS="$(echo "$RAW_JSON" | jq '.errors | length')"

if [[ "$TOTAL_ERRORS" -eq 0 ]]; then
  echo "No Flow errors found."
  exit 0
fi

SUMMARY="$(echo "$RAW_JSON" | jq -r '
  .errors[]
  | ([.message[].loc.source] | map(select(. != null)) | .[0]) // "(unknown file)"
' | sort | uniq -c | sort -rn)"

if [[ -n "$FOLDER_FILTER" ]]; then
  # Substring match, not anchored -- Flow may report absolute or root-relative
  # paths depending on where .flowconfig lives, so an anchored ^prefix match
  # can silently miss everything.
  SUMMARY="$(echo "$SUMMARY" | awk -v needle="$FOLDER_FILTER" 'index($0, needle) > 0')"
fi

if [[ -z "$SUMMARY" ]]; then
  if [[ -n "$FOLDER_FILTER" ]]; then
    echo "No Flow errors found matching '$FOLDER_FILTER'."
  else
    echo "No Flow errors found."
  fi
  exit 0
fi

echo "$SUMMARY" | awk '{printf "%-6s %s\n", $1, $2}'
echo "---"
echo "$SUMMARY" | awk '{sum += $1} END {printf "Total: %d errors in %d files\n", sum, NR}'

