#!/bin/sh
# Build Dashboard, and then run it. Needs to run from local GH root directory.
node ./np.Shared/src/react/support/performRollup.node.js
npc plugin:dev np.Shared -nc
