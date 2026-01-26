#!/bin/bash
# Update the live Todoist plugin from the integration branch
# Restores the original branch when done

set -e

PLUGIN_DIR="/Users/felciano/Carlciano Dropbox/Ramon Felciano/Code/NotePlan-plugins"
PLUGIN_NAME="dbludeau.TodoistNoteplanSync"
INTEGRATION_BRANCH="todoist-integration-testing"

cd "$PLUGIN_DIR"

# Save current branch
ORIGINAL_BRANCH=$(git branch --show-current)

# Check if already on the integration branch
if [ "$ORIGINAL_BRANCH" = "$INTEGRATION_BRANCH" ]; then
    echo "Already on $INTEGRATION_BRANCH"
    echo "Building $PLUGIN_NAME..."
    npx noteplan-cli plugin:dev "$PLUGIN_NAME" -nc
    echo ""
    echo "Done! Live Todoist plugin updated from $INTEGRATION_BRANCH"
    exit 0
fi

# Check for uncommitted changes and stash if needed
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Stashing uncommitted changes..."
    git stash push -m "update-todoist-live auto-stash"
    STASHED=true
fi

echo "Current branch: $ORIGINAL_BRANCH"
echo "Switching to: $INTEGRATION_BRANCH"

# Switch to integration branch
git checkout "$INTEGRATION_BRANCH"

# Build and deploy the plugin
echo "Building $PLUGIN_NAME..."
npx noteplan-cli plugin:dev "$PLUGIN_NAME" -nc

# Switch back to original branch
echo "Restoring branch: $ORIGINAL_BRANCH"
git checkout "$ORIGINAL_BRANCH"

# Restore stashed changes if we stashed them
if [ "$STASHED" = true ]; then
    echo "Restoring stashed changes..."
    git stash pop
fi

echo ""
echo "Done! Live Todoist plugin updated from $INTEGRATION_BRANCH"
