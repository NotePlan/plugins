# np-plugin-commands

Common NotePlan plugin build commands (programmer runs these; agents should not `npm run build`).

See also `AGENTS.md` and `agents/docs/programming.md`.

- Build React runtime first (React/WebView plugins; `npc` does not do this):  
  `node ./<plugin-id>/src/react/support/performRollup.node.js`
- Build/install plugin: `npc plugin:dev <plugin-id> -nc`
- Dashboard: `./buildDashboard.sh` (performRollup + npc)
- Typecheck: `npx flow`
- Test one file: `npx jest path/to/file.test.js --no-watch`
