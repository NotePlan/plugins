#!/bin/sh
# Build Dashboard, and then run it. Needs to run from local GH root directory.
node ./jgclark.Dashboard/src/react/support/performRollup.node.js
npc plugin:dev jgclark.Dashboard -nc
echo "Running Dashboard..."
open "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showDashboard"
