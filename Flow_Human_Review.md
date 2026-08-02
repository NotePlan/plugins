# Flow cleanup — items needing a human decision

Generated during the repo-wide Flow error sweep. Everything here is a **real defect or a genuine
design question**, not a missing annotation. Each one was deliberately left erroring, because an
annotation or cast would hide the problem rather than fix it.

Track progress with `node scripts/flow-report.js`. CI (`Flow-Check` job) fails only if a plugin's
unique-site count rises above `scripts/flow-baseline.json`, so fixing anything here is safe and
the ratchet will lock the improvement in.

**Legend:** 🔴 user-visible breakage · 🟠 silent wrong behaviour · 🟡 dead/vestigial code · 🔵 design question

Items fixed during the Aug 2026 review pass have been removed from this list.

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

### 3. `KimMachineGun.Raindrop` — "create if not exists" fails when the note *does* exist

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

### 4. `np.Tidy` — a boolean passed where a JSON parameter string is expected

`np.Tidy/src/tidyMain.js:46`

```js
await removeOrphanedBlockIDs(config.runSilently)
```

`removeOrphanedBlockIDs(params: string = '')` (`:429`) feeds `params` to
`overrideSettingsWithEncodedTypedArgs()` and `getTagParamsFromString()`. Its two neighbours in
`tidyUpAll` (`removeBlankNotes`, `removeTodayTagsFromCompletedTodos`) genuinely do take booleans,
which is presumably how this slipped in. Effect: `**runSilently` is never honoured** by this
command, and the arg parser receives `true`.

**Suggestion:** the file already builds `const param = config.runSilently ? '{"runSilently": true}' : ''`
at `:57` — move that above the `runRemoveOrphansCommand` block and pass `param`.

---

## 🟠 Silently wrong

### 11. `dbludeau.TodoistNoteplanSync` — `this` inside object methods

`dbludeau.TodoistNoteplanSync/src/NPPluginMain.js:80, 104, 110`

Flow's `object-this-reference`: these methods reference `this` but are defined on an object
literal, so `this` depends entirely on how they're called. If any is ever passed as a callback
it breaks.

**Suggestion:** have them reference the object by name instead of `this`, or convert to a class.

---

### 11d. `jgclark.Reviews/src/projects.js` — now-dead cancel guard

`jgclark.Reviews/src/projects.js:249`

```js
const finalProgressComment = (finalCommentRaw && finalCommentRaw !== true) ? ... : ''
```

`getInputTrimmed()` was narrowed to `Promise<string | false>` during this cleanup (it can only
ever return those — see `helpers/userInput.js:199`), so `!== true` is now provably always true.

**Suggestion:** drop the `&& finalCommentRaw !== true` clause.

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

### 17. `TEditor` is missing `linkedItems` and `datedTodos`

`flow-typed/Noteplan.js`

Both exist on the live Editor object and are declared on `Note`, but not on `TEditor`. Currently
worked around with `(e: any)` casts.

**Suggestion:** confirm with @EduardMe that Editor exposes them, then add both to `TEditor` (or
move them to `CoreNoteFields`) and drop the casts. This was deliberately not done blind — the
same question was raised for `datedTodos` earlier in the sweep and left open.

---

### 18. `TDashboardSettings` — 68 "required" properties that nothing guarantees

`jgclark.Dashboard/src/types.js:29-138`

The settings object is assembled at runtime by `getDashboardSettingsDefaults()` from a
`TSettingItem` array, so Flow cannot verify any given key is present, and older installs won't
have newer keys until defaults are merged. Consumers already treat them defensively
(`dashboardSettings?.FFlag_UseTagCache !== false`).

The sweep added `TDashboardSettingsIn = $ReadOnly<Partial<TDashboardSettings>>` for parameters,
which is the honest input type. The underlying question remains.

**Suggestion:** audit the 68-required / 17-optional split. Most probably want to be optional.
