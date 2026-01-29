#!/bin/bash
# Update the live Todoist plugin from the integration branch
# Restores the original branch when done

set -e

PLUGIN_DIR="/Users/felciano/Carlciano Dropbox/Ramon Felciano/Code/NotePlan-plugins"
PLUGIN_NAME="dbludeau.TodoistNoteplanSync"
INTEGRATION_BRANCH="todoist-integration-testing"

# Function to build plugin and check for errors
build_plugin() {
    echo "Building $PLUGIN_NAME..."
    BUILD_OUTPUT=$(npx noteplan-cli plugin:dev "$PLUGIN_NAME" -nc 2>&1)
    BUILD_EXIT=$?
    echo "$BUILD_OUTPUT"

    # Check for build failure patterns in output
    if echo "$BUILD_OUTPUT" | grep -q "Build of plugin.*failed\|RollupError\|MISSING_EXPORT"; then
        echo ""
        echo "ERROR: Build failed! See errors above."
        return 1
    fi

    # Also check exit code
    if [ $BUILD_EXIT -ne 0 ]; then
        echo ""
        echo "ERROR: Build command exited with code $BUILD_EXIT"
        return 1
    fi

    return 0
}

cd "$PLUGIN_DIR"

# Save current branch
ORIGINAL_BRANCH=$(git branch --show-current)

# Check if already on the integration branch
if [ "$ORIGINAL_BRANCH" = "$INTEGRATION_BRANCH" ]; then
    echo "Already on $INTEGRATION_BRANCH"
    if ! build_plugin; then
        exit 1
    fi
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
BUILD_FAILED=false
if ! build_plugin; then
    BUILD_FAILED=true
fi

# Switch back to original branch
echo "Restoring branch: $ORIGINAL_BRANCH"
git checkout "$ORIGINAL_BRANCH"

# Restore stashed changes if we stashed them
if [ "$STASHED" = true ]; then
    echo "Restoring stashed changes..."
    git stash pop
fi

# Exit with error if build failed
if [ "$BUILD_FAILED" = true ]; then
    echo ""
    echo "ERROR: Build failed! Plugin was NOT updated."
    exit 1
fi

echo ""
echo "Done! Live Todoist plugin updated from $INTEGRATION_BRANCH"
