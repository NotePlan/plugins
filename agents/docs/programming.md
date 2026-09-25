# NotePlan plugin programming conventions

Canonical reference for agents working in this repo. Cursor injects a short
always-on reminder via `.cursor/rules/np-programming-general.mdc` -- this file
is the full text.

## Critical rules

- Never use dynamic imports. Rollup will not process them correctly. Always use
  static imports at the top of files.
- Never use `require` in NotePlan plugin code -- use `import` at the top of the
  file (same Rollup reason). See also `agents/docs/react-html.md`.
- Do not run `npm run build` for plugins -- leave building to the programmer
  (`npc plugin:dev`, Rollup). See root `README.md`.
- Do not commit or push unless the user explicitly asks.
- Do not use raw `Promise.resolve`, `Promise.all`, or `Promise.race` in plugin code—NotePlan's JSContext may not have them. Use polyfills from `@helpers/promisePolyfill.js` (`promiseResolve`, `promiseAll`, `promiseRace`).

## NotePlan domain facts

- Supported task priority markers are exactly `!`, `!!`, `!!!`, and `>>`.
  Corresponding `paragraph.priority` values: 1, 2, 3, and 4. `!!!!` is **not**
  supported.
- "Priority marker" / "Marker" is user-facing language (the symbols). Key code
  logic off `.priority` when possible; use symbols in settings/labels/descriptions.
- Use `@flow-typed/Noteplan.js`, not the public website, for NotePlan plugin
  APIs. Offer to sync missing notes into it when learning from gists/changelogs, but get the developer to check and approve.

## Globals

NotePlan provides globals available to all plugins (`DataStore`, `CommandBar`, `Editor`, `NotePlan`, etc.). Do not import them.

## Code style

- Flow for static typing
- No semicolons (ESLint/Prettier)
- Single quotes for strings
- Max line length: 180 characters
- Keep `logDebug`, `logInfo`, `logWarn`, `logError`, and `clo` calls on a single
  line when possible (do not wrap them to satisfy max line length)
- Template literals instead of string concatenation
- ES6+ (`const`/`let`, arrow functions)
- async/await; no floating promises
- Follow existing naming patterns
- Proper try/catch error handling
- Import order: external libs -> internal libs -> local files; within each group,
  alphabetical by source filename
- Keep code DRY with clear function responsibilities
- JSDoc for functions; Flow types as appropriate
- Always research `helpers/` before writing new code
- Prefer explicit functions over constant declarations
- When moving code, keep existing comments and commented-out code
- Do not remove `console.log` / `clo` / `logDebug` / `logWarn` / `logInfo` /
  `logError` statements or comments
- If rewriting a full file, include all import statements
- If a file has a top comment with date/author/version, update it when changing
  the file
- Any DIV you create or edit needs a human-understandable class name (easier debugging)

## Build / test commands

- Build plugin: `npc plugin:dev <plugin-id> -nc`
- Build React runtime: `node ./<plugin-id>/src/react/support/performRollup.node.js`
- Lint: `npm run lint` or `npm run lint-fix`
- Type check: prefer `npx flow` (or `npm run typecheck:fast` when Flow server is warm).
  Do not use `npm run typecheck...` unless the user asks for that script by name.
- Tests: `npm run test`; single: `npx jest path/to/file.test.js -t "test name" --no-watch`
- Always pass `--no-watch` to jest (default config watches)
- Templating tests: `jest np.Templating/__tests__/**/*.test.js --no-watch`
- Dev: `npm run dev`

## Testing behaviour for agents

- Do not prompt the user to run tests. Run them automatically when relevant; do
  not ask permission or suggest running tests.
- Prefer `npx flow` over `npm run typecheck...` unless the user names that script.
  Before finishing a task where you added new code, check there are no Flow type errors.
- Allow in sandbox: `cd`, `npm test`, `npx flow`, `jest`, `npx jest`, `grep`,
  `head`, `tail`, `node`
- **Never hard-code Jest workarounds into functions under test**

## Plugin settings lookup (runtime)

When unsure what a setting is or what the user has configured, read live
`settings.json` from NotePlan's plugin data directory:

- Base:
  `/Users/jonathan/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins/data/`
- Full path: `{base}/{plugin.id}/settings.json`

Use `plugin.id` from the relevant `plugin.json` (not the repo folder name if they differ).

## Common helpers

- Logging: `logDebug`, `logError`, `clo`, `logInfo`, `logWarn`
- Notes: `findNote`, `getParagraphs`, `getSelectedParagraphs`, `getTasksFromNote`
- Dates: `getTodaysDateHyphenated`, `getDateStringFromCalendarFilename`
- Config: `getSettings`, `updateSettingsForPlugin`
- UI: `showMessage`, `showMessageYesNo`, `displayTitle`
- Background thread: `runOnAsyncThread`

## Changelog

Add updates to the first H2 section in the plugin's `CHANGELOG.md`. That section
should match the release number in the plugin's `plugin.json`.
