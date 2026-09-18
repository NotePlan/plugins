# np-plugin-commands

Common NotePlan plugin build commands (programmer runs these; agents should not `npm run build`).

See also `AGENTS.md` and `agents/docs/programming.md`.

- Build plugin: `npc plugin:dev <plugin-id> -nc`
- Build React runtime: `node ./<plugin-id>/src/react/support/performRollup.node.js`
- Typecheck: `npx flow`
- Test one file: `npx jest path/to/file.test.js --no-watch`
