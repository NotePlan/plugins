#!/bin/bash
# Symlink nplog onto your PATH. Safe to re-run.
#
#   ./install.sh              -> links into ~/.local/bin
#   ./install.sh /usr/local/bin -> links somewhere else
#
# A symlink (rather than a copy) means `git pull` updates the tool you actually
# run -- no need to re-install after pulling changes to this repo.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nplog"
BIN_DIR="${1:-$HOME/.local/bin}"

if [ ! -f "$SRC" ]; then
  echo "install.sh: cannot find nplog next to this script (looked for $SRC)" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "install.sh: node is required but was not found on PATH." >&2
  echo "  Install Node (https://nodejs.org) then re-run." >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
chmod +x "$SRC"
ln -sfn "$SRC" "$BIN_DIR/nplog"

echo "Linked $BIN_DIR/nplog -> $SRC"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "NOTE: $BIN_DIR is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

# --plugin mode (tailing one plugin's _MCP-console.log) needs to know where
# NotePlan's container lives, which differs by how it was installed -- App
# Store and Setapp use different bundle IDs and therefore different
# Containers paths. Written once to CONFIG_FILE so both nplog and
# scripts/nplog/utils/log-timing.js can resolve it without re-asking.
CONFIG_DIR="$HOME/.config/nplog"
CONFIG_FILE="$CONFIG_DIR/config.json"
APPSTORE_CONTAINER="$HOME/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3"
SETAPP_CONTAINER="$HOME/Library/Containers/co.noteplan.NotePlan-setapp/Data/Library/Application Support/co.noteplan.NotePlan-setapp"

write_container_config() {
  mkdir -p "$CONFIG_DIR"
  printf '{\n  "appSupportDir": "%s"\n}\n' "$1" > "$CONFIG_FILE"
  echo "Wrote $CONFIG_FILE"
}

echo
if [ -f "$CONFIG_FILE" ]; then
  echo "Already configured for --plugin mode ($CONFIG_FILE exists)."
  echo "Delete it (or edit appSupportDir directly) to reconfigure."
else
  appstore_exists=0
  setapp_exists=0
  [ -d "$APPSTORE_CONTAINER" ] && appstore_exists=1
  [ -d "$SETAPP_CONTAINER" ] && setapp_exists=1

  if [ "$appstore_exists" = 1 ] && [ "$setapp_exists" = 0 ]; then
    echo "Detected the App Store version of NotePlan."
    write_container_config "$APPSTORE_CONTAINER"
  elif [ "$setapp_exists" = 1 ] && [ "$appstore_exists" = 0 ]; then
    echo "Detected the Setapp version of NotePlan."
    write_container_config "$SETAPP_CONTAINER"
  elif [ -t 0 ]; then
    # Ambiguous (both or neither found) -- ask, but only if we have a real
    # terminal to ask on; a non-interactive install (CI, a script) just skips
    # this and nplog falls back to auto-detection at runtime.
    echo "Which version of NotePlan do you use? (needed for --plugin mode)"
    echo "  1) App Store"
    echo "  2) Setapp"
    echo "  3) Skip -- I'll configure this later"
    read -r -p "> " np_version_choice
    case "$np_version_choice" in
      1) write_container_config "$APPSTORE_CONTAINER" ;;
      2) write_container_config "$SETAPP_CONTAINER" ;;
      *)
        echo "Skipped. --plugin mode will auto-detect, or set NPLOG_APP_SUPPORT_DIR"
        echo "yourself, or re-run this installer later."
        ;;
    esac
  else
    echo "Skipping --plugin mode setup (no terminal to ask on)."
    echo "Set NPLOG_APP_SUPPORT_DIR, or re-run this installer interactively later."
  fi
fi
