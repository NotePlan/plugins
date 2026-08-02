# Flow cleanup — items needing a human decision

Generated during the repo-wide Flow error sweep. Everything here is a **real defect or a genuine
design question**, not a missing annotation. Each one was deliberately left erroring, because an
annotation or cast would hide the problem rather than fix it.

Track progress with `node scripts/flow-report.js`. CI (`Flow-Check` job) fails only if a plugin's
unique-site count rises above `scripts/flow-baseline.json`, so fixing anything here is safe and
the ratchet will lock the improvement in.

**Legend:** 🔴 user-visible breakage · 🟠 silent wrong behaviour · 🟡 dead/vestigial code · 🔵 design question

---

## 🔴 Broken — these fail at runtime

### 1. `np.Preview` — two files import a function that no longer exists
`np.Preview/src/mathTests.js:4`, `np.Preview/src/mermaidTests.js:4`

```js
import { showHTML } from '@helpers/HTMLView'
```

`helpers/HTMLView.js` exports `showHTMLV2(body, opts)` and no `showHTML` at all. Both files call
it positionally (`showHTML('title', body, ...)`) in ~8 places. They would throw on import.

**Suggestion:** port the call sites to `showHTMLV2(body, { windowTitle, ... })`, or delete both
files if they were only ever scratch tests (the names suggest so). Ask @jgclark which.

---

### 2. `jgclark.PeriodicReviews` — source imports three modules that don't exist
`jgclark.PeriodicReviews/src/reviewHTMLViewGenerator.js:9,10,18,19`

Imports `../plugin.json`, `./periodicReviewHelpers` and `./reviewQuestions`. The plugin's `src/`
contains only this one file — there is no `plugin.json` and no sibling modules.

**Suggestion:** the directory looks orphaned (left behind by a move or a partial extraction).
Confirm with @jgclark, then either restore the missing files or delete `src/`.

---

### 3. `NoteModule` — two methods return before doing anything
`np.Templating/lib/support/modules/NoteModule.js:340`, `:354`

```js
removeSection(headingOfSectionToRemove: string): void {
  return 'Not implemented yet'          // <- first statement
  const note = this.getCurrentNote()    // unreachable
  note ? removeSection(note, headingOfSectionToRemove) : null
}
```

Same shape in `replaceContentUnderHeading()`. Both have a working implementation immediately
below an unconditional `return`, so templates calling `note.removeSection(...)` silently do
nothing. Flow's `unreachable-code` errors here are correct.

**Suggestion:** delete the `return 'Not implemented yet'` line in both and let the real code run,
then test. If they were stubbed out for a reason, the reason isn't recorded anywhere — worth
asking whoever added them.

---

### 4. `KimMachineGun.Raindrop` — "create if not exists" fails when the note *does* exist
`KimMachineGun.Raindrop/src/NPPluginMain.js:157`

```js
async function createNoteIfNotExists(title, folder, content?): Promise<string> {
  const existingNotes = DataStore.projectNoteByTitle(title, true, false) ?? []
  if (existingNotes.length === 0) {
    ... return await DataStore.newNoteWithContent(...) / newNote(...)
  }
  // no return on the "already exists" path -> undefined
}
```

The caller then does `await Editor.openNoteByFilename(filename)` with `undefined`.

**Suggestion:** return `existingNotes[0].filename` on that branch. Also note
`DataStore.newNote()` returns `?string`, so the declared `Promise<string>` is optimistic either
way.

---

### 5. `dialogElementRenderer` — one unguarded `item.key`
`helpers/react/DynamicDialog/dialogElementRenderer.js:820` (the note-chooser)

`TSettingItem.key` is optional (separator items have none). Six of the seven
`handleFieldChange(item.key, ...)` calls in this file sit inside an `if (item.key)` guard and
have been cast; this one has no guard, so it can write `settings[undefined]`.

**Suggestion:** wrap it in the same `if (item.key)` guard as its siblings.

---

### 5a. Four undeclared identifiers that would throw `ReferenceError`

Flow's `cannot-resolve-name` is not a typing nit here — these names don't exist at runtime
either. Each is one character or one missing import away from working.

| Location | Problem | Suggestion |
|---|---|---|
| `helpers/react/Modal/ModalWithTooltip.jsx:38` | `if (isMetaKey && metaKey)` — the event's `metaKey` was destructured **as** `isMetaKey` on the line above, so bare `metaKey` is undeclared. Throws on every mouse-over. | The second operand looks like a leftover; it is probably meant to be a prop. Most likely just `if (isMetaKey)`. |
| `shared.AI/src/support/helpers.js:59` | `commmand.aliases` — three m's. The loop variable is `command`. | Fix the typo. |
| `shared.AI/src/support/helpers.js:66` | `fs.writeFile(commandsPath, output)` — Node's `fs` isn't imported and isn't available in NotePlan's JS runtime anyway. | This function (`generateREADMECommands`) looks like it was written for a build script, not the plugin. Move it to `scripts/`, or use `DataStore.saveData`. `availablePreferences` at `:108` is undeclared for the same reason. |
| `np.Templating/lib/helpers.js:100` | `logDebug('')` — the file imports `{ log, clo }` from `@helpers/dev` but not `logDebug`. | Add it to the import, or drop the line (it only prints a blank line). |
| `dwertheimer.TaskAutomations/src/NPTaskScanAndProcess.js:104` | `keyModifiers.toString()` inside a `logDebug` — `keyModifiers` is never declared in that scope. Throws whenever the non-date branch is reached. | Check whether it should come from the function's parameters; otherwise remove it from the message. |

---

## 🟠 Silently wrong

### 6. `np.CallbackURLs` — nine dead cancel checks in the wizard
`np.CallbackURLs/src/NPXCallbackWizard.js:152, 162, 181, 198, 246, 255, 332, 341, 350`

```js
const choice = await chooseOption('How should the note open?', opts, opts[0].value)
if (choice === false) return false   // never true
```

`chooseOption()` (`helpers/userInput.js:52`) never returns `false` — on cancel,
`CommandBar.showOptions` yields an index that falls through to `?? defaultValue ??
options[0].value`. So **cancelling any step of the wizard silently proceeds with the default**
instead of aborting. Nine separate places assume otherwise.

**Suggestion:** decide the contract. Either make `chooseOption` return `false` on cancel (it's a
widely-used helper — check every caller first), or use `chooseOptionWithModifiers`, or drop the
dead checks and accept that cancel isn't detectable here.

---

### 7. `timeblocking-helpers` — a write that goes nowhere
`dwertheimer.EventAutomations/src/timeblocking-helpers.js:909`

```js
;(timeMap.find((tm) => tm.start === t.start) ?? {}).busy = true
```

When `find` misses, the assignment lands on a throwaway `{}` and the slot is never marked busy.
`openTimesForTimeframe` is derived from `timeMap`, so it probably always hits — but if it ever
doesn't, a used slot stays available and tasks get double-booked.

**Suggestion:** assign to a named local and `if (slot) slot.busy = true`, so a miss is visible.

---

### 8. `timeblocking-helpers` — optional config indexed unconditionally
`dwertheimer.EventAutomations/src/timeblocking-helpers.js:883`

`config.timeframes[key]` where `timeframes?: any` is optional. TypeError in the
`BY_TIMEBLOCK_TAG` path if a user hasn't configured timeframes.

**Suggestion:** guard, or give `timeframes` a default in `getTimeBlockingDefaults()`.

---

### 9. `sortTasks` — null rendered into a heading
`dwertheimer.TaskSorting/src/sortTasks.js:1120`

`_heading` is coerced into a template literal while possibly null, producing the literal text
`"null"` in the note.

**Suggestion:** `_heading ?? ''`.

---

### 10. `sortTasks` — `mixed` reaching `.substring()`
`dwertheimer.TaskSorting/src/sortTasks.js:985, 1023, 1026, 1083, 1137, 1153`

`getArrayValue()` returns `mixed` (and can return `null` per `:1137`), and the result flows into
`sortOrder[0][0] === '-' ? sortOrder[0].substring(1) : ...`. Throws if it isn't a string.

**Suggestion:** give `getArrayValue()` a real return type in `helpers/dataManipulation.js`, or
validate at the call site.

---

### 11. `dbludeau.TodoistNoteplanSync` — `this` inside object methods
`dbludeau.TodoistNoteplanSync/src/NPPluginMain.js:80, 104, 110`

Flow's `object-this-reference`: these methods reference `this` but are defined on an object
literal, so `this` depends entirely on how they're called. If any is ever passed as a callback
it breaks.

**Suggestion:** have them reference the object by name instead of `this`, or convert to a class.

---

### 12. `jgclark.Summaries` — vacuous guards
`jgclark.Summaries/src/TMOccurrences.js:320, 321, 323`

`this.count !== ''` and `this.total !== ''` where both are declared `number`. Those clauses can
never be false, so they filter nothing; the adjacent `!isNaN(...)` checks do the real work.

**Suggestion:** harmless but misleading — delete the `!== ''` clauses.

---

## 🟡 Dead or vestigial

### 13. `NoTasks.jsx` — confetti class references four undeclared globals
`jgclark.Dashboard/src/react/components/NoTasks.jsx:123, 223-235, 266-283`

Calls `random()`, `TweenLite`, `Power4` and `_` (lodash). None is imported or declared anywhere;
line 10 has a commented-out `// import {random} from 'lodash'`. `ConfettiCannon` would throw
`ReferenceError` if constructed. The file header says **"no longer used (from v2.2 or v2.3)"**.

**Suggestion:** delete the file (and its import sites, if any). If the confetti is wanted later,
it needs GSAP added as a dependency — that's a new decision, not a restoration.

---

### 14. `sortTasks` — calls a NotePlan API that may not exist
`dwertheimer.TaskSorting/src/sortTasks.js:141-155`

`Editor.beginEdits()` / `Editor.endEdits()`, guarded by `if (Editor.beginEdits)`. An in-file
comment says *"@jgclark checked in April 2026 and can't find any evidence this exists in the
API"*. Currently suppressed with that explanation.

**Suggestion:** ask @EduardMe whether these exist. If not, delete both blocks; if they do, add
them to `flow-typed/Noteplan.js` and drop the suppressions.

---

### 15. `dwertheimer.Favorites` — dangling type-only import
`dwertheimer.Favorites/src/requestHandlers.js:9`

```js
import { type RequestResponse } from './routerUtils'
```

`./routerUtils` doesn't exist in that plugin. Harmless at runtime (Babel erases type imports),
but the type resolves to nothing.

**Suggestion:** likely meant `@helpers/react/routerUtils` — check and repoint.

---

### 16. Stale extra arguments in test calls (~35 sites)
`np.Templating/__tests__/awaitVariableAssignment.test.js` (9),
`np.Templating/__tests__/promptRegistry.test.js` (16), and others

```js
await processPromptTag(tag, sessionData, '<%', '%>')   // signature takes 2
await processPrompts(templateData, {}, '<%', '%>', getTags)   // signature takes 2
```

The delimiter/getTags parameters were removed from the implementations; the tests still pass
them. Ignored at runtime, so the tests pass.

**Suggestion:** delete the extra arguments. Mechanical, but it is a code edit so it was left
out of the annotation-only sweep. Same for `showHTMLV2` in `jgclark.Summaries/src/testCharting.js:308-309`,
which is called with the *old* `showHTML` positional signature.

---

## 🔵 Design questions

### 17. `experimental.const_params` — 17 reassigned parameters
`KimMachineGun.Raindrop:161`, `dbludeau.TodoistNoteplanSync:78,79`, `np.MeetingNotes:299`,
`np.Templating/lib/engine/errorProcessor.js:131-143`, and others

`.flowconfig` sets `experimental.const_params=true`, which makes every function parameter const.
These sites reassign a parameter (usually `result += ...` or normalising an input).

**Suggestion:** two options — (a) introduce a local (`let out = result`) at each site, which is
the better style anyway; or (b) drop `experimental.const_params` from `.flowconfig` if the team
doesn't actually want that rule. Worth deciding once rather than 17 times.

---

### 18. Template-literal coercion of booleans/Dates (~32 sites)
Spread across `dwertheimer.JestHelpers`, `np.ThemeChooser`, `helpers/react/DynamicDialog`,
`dwertheimer.TaskSorting`, `dwertheimer.test-plugin-scratch` and others.

Flow rejects `${someBoolean}` and `${someDate}` in template literals (`incompatible-type:
should not be coerced`), even though JS handles both. Fixing means wrapping in `String(...)`.

**Suggestion:** low risk and mechanical — `String(x)` is exactly what the template literal
already does — but it *is* a code edit, so it needs a green light. ~32 sites, one sweep.

---

### 19. `TDashboardSettings` — 68 "required" properties that nothing guarantees
`jgclark.Dashboard/src/types.js:29-138`

The settings object is assembled at runtime by `getDashboardSettingsDefaults()` from a
`TSettingItem` array, so Flow cannot verify any given key is present, and older installs won't
have newer keys until defaults are merged. Consumers already treat them defensively
(`dashboardSettings?.FFlag_UseTagCache !== false`).

The sweep added `TDashboardSettingsIn = $ReadOnly<Partial<TDashboardSettings>>` for parameters,
which is the honest input type. The underlying question remains.

**Suggestion:** audit the 68-required / 17-optional split. Most probably want to be optional.

---

### 20. `ParagraphsGroupedByType` is used with two different element types
`helpers/sorting.js:50`, consumed only by `dwertheimer.TaskSorting/src/sortTasks.js`

Declared with `Array<TParagraph>` values, but everything reaching it comes from
`getTasksByType()`, which returns `SortableParagraphSubset` (a different shape, with
`.paragraph`, `.children`, `.raw`). Retyping the elements to `SortableParagraphSubset` was tried
and made things *worse* (+16 sites) — the type really is used both ways in that file.

**Suggestion:** untangle `sortTasks.js` so a given variable holds one or the other, then the type
can be honest. Non-trivial; 53 tests cover the file, so it's a safe refactor to attempt.

**Two attempts already made and reverted, so nobody repeats them:**

1. Retyping `ParagraphsGroupedByType`'s elements to `SortableParagraphSubset` → **+16 sites**.
2. Adding a `[string]: Array<SortableParagraphSubset>` indexer to `GroupedTasks` (which is
   otherwise correct — callers *do* index it dynamically) → **+2 sites**, because it stops
   masking the mismatch and surfaces it at `sortTasks.js:523, 542, 622, 623` instead. Then
   aligning the six accumulators in that file to `Array<SortableParagraphSubset>` → **+26 sites**,
   proving the file really does hold both types in the same variables.

So the indexer on `GroupedTasks` is worth adding *as part of* the refactor, not before it.
