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
