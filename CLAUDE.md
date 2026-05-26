# NOTEPLAN PLUGINS DEVELOPMENT GUIDE

## Build/Test Commands

- Build plugin: `npc plugin:dev <plugin-id> -nc`
- Build react runtime: `node ./<plugin-id>/src/react/support/performRollup.node.js`
- Lint code: `npm run lint` or fix issues with `npm run lint-fix`
- Type check: `npm run typecheck`
- Run all tests: `npm run test`
- Run single test: `npx jest path/to/file.test.js -t "test name"`
- Watch tests: `npm run test:watch`
- Development mode: `npm run dev`

## Code Style Guidelines

- Use Flow for static typing
- No semicolons (enforced by ESLint/Prettier)
- Single quotes for strings
- Max line length: 180 characters
- Keep `logDebug`, `logInfo`, `logWarn`, `logError`, and `clo()` calls on a single line when possible; do not wrap them across multiple lines to satisfy the max line length rule
- Use template literals instead of string concatenation
- Use ES6+ features (const/let, arrow functions)
- Use async/await and handle promises properly (no floating promises)
- Follow existing naming patterns in the codebase
- Proper error handling with try/catch blocks
- Follow import order: external libs -> internal libs -> local files
- Keep code DRY and modular with clear function responsibilities
- Use JSDoc comments for public functions
- Always research the `helpers/` folder before writing new code
- Prefer writing explicit functions over constant declarations

## Common Helper Functions

The most frequently used functions in the codebase are:

- Logging: logDebug, logError, clo, logInfo, logWarn
- Note utilities: findNote, getParagraphs, getSelectedParagraphs, getTasksFromNote
- Date handling: getTodaysDateHyphenated, getDateStringFromCalendarFilename
- Configuration: getSettings, updateSettingsForPlugin
- UI interaction: showMessage, showMessageYesNo, displayTitle

## Debugging Infinite Loops and Freezes

- Do not rely only on `logDebug`/`logInfo` when NotePlan freezes. The plugin console can buffer logs, and if the JSContext hangs the last useful line may never flush.
- First isolate whether the loop is React/WebView-side or plugin-side. Add sequence IDs and active counters around field changes, React effects, REQUEST creation, router entry/exit, and backend handlers.
- For plugin-side freezes, add temporary hidden diagnostic commands in `plugin.json` and call them with x-callback URLs, e.g. `noteplan://x-callback-url/runPlugin?pluginID=np.Shared&command=shared%3AtemporaryProbe&arg0=...&arg1=...`.
- Prefer early-return checkpoints over logs for suspected freeze points. Return a `showMessage()` or structured success response after each checkpoint (`after-start`, `after-filter`, `after-convert`, etc.) so each run proves the next section completed.
- Binary-search expensive loops with diagnostic params such as `start` and `limit`. If a full conversion freezes but `limit=10` returns slowly, treat it as a performance stall rather than a request-loop bug.
- Keep diagnostics temporary and clearly marked (`[DIAG]`, hidden command, debug-only params). Once the root cause is fixed, remove or gate noisy logging and hidden commands unless the user wants to keep them for follow-up testing.
- For chooser note loading, be careful with backend decoration. `getNoteDecorationForReact()` can be expensive across calendar-note lists; pass `includeDecoration: false` when the React component derives display decoration itself.
