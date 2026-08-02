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

### 17a. Babel's Flow parser doesn't implement Flow's newer type syntax

`np.plugin-test/src/react/WebView.jsx:166`

`sendToPlugin`'s parameter is `[command, data, additionalDetails = '']`. The precise Flow type is
an optional tuple element; Flow 0.245 accepts it, but Babel fails to parse it, so the file stops
transforming and both the rollup build and jest break. It is typed `Array<any>` instead.

**This was measured, not assumed.** An earlier version of this document said this was
"blocked on a Babel upgrade". That is wrong — upgrading does not help:


| Front-end                                                       | optional tuple `[string, any, string?]` | mapped type `{ [K in keyof O]: … }` | conditional type `T extends U ? A : B` |
| --------------------------------------------------------------- | --------------------------------------- | ----------------------------------- | -------------------------------------- |
| `@babel/preset-flow` 7.25.9 (current)                           | ✗                                       | ✗                                   | ✗                                      |
| `@babel/preset-flow` 7.29.7 (latest 7.x)                        | ✗                                       | ✗                                   | ✗                                      |
| `@babel/preset-flow` 8.0.1 / parser 8.0.4                       | ✗                                       | ✗                                   | ✗                                      |
| `@babel/parser` 8.0.4 with `['flow', {all: true, enums: true}]` | ✗                                       | ✗                                   | ✗                                      |
| `**babel-plugin-syntax-hermes-parser**`                         | ✗ unlabeled · **✓ labeled**             | **✓**                               | **✓**                                  |


Babel's own Flow parser has simply not implemented these, at any version. The supported route is
`babel-plugin-syntax-hermes-parser` (Hermes is Meta's Flow parser, which tracks the language).

Two further findings from the same test:

- The *labeled* tuple form `[a: string, b: any, c?: string]` is accepted by **both** Flow and
Hermes; the unlabeled `[string, any, string?]` is Flow-only. Prefer the labeled form.

**Suggestion:** do nothing for now. Switching the Flow front-end to `hermes-parser` touches jest,
rollup and eslint at once, for a single optional-tuple typing win. Revisit if the team wants modern
Flow syntax generally — at which point it is one coordinated change, not three.

---

### 17b. `TEditor` is missing `linkedItems` and `datedTodos`

`flow-typed/Noteplan.js`

Both exist on the live Editor object and are declared on `Note`, but not on `TEditor`. Currently
worked around with `(e: any)` casts.

**Suggestion:** confirm with @EduardMe that Editor exposes them, then add both to `TEditor` (or
move them to `CoreNoteFields`) and drop the casts. This was deliberately not done blind — the
same question was raised for `datedTodos` earlier in the sweep and left open.

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

---

### 21. `chooseOption` / `CommandBar.showOptions` cancel contract — for @jgclark

**Status (Aug 2026):** `np.CallbackURLs` was fixed locally with a file-private
`chooseWizardOption()` wrapper around `chooseOptionWithModifiers` (see
`np.CallbackURLs/src/NPXCallbackWizard.js`). That is enough for that plugin for now. **No change
was made to `helpers/userInput.js` `chooseOption()` itself** — this item is for a repo-wide
decision.

#### Background

`chooseOption()` (`helpers/userInput.js:52`) was written when `CommandBar.showOptions` cancel
behaviour was less clear. Several plugins (notably `np.CallbackURLs`) were written assuming ESC
returns `false`, matching `getInput()` / `textPrompt()` / `showForm()`:

```js
const choice = await chooseOption('How should the note open?', opts, opts[0].value)
if (choice === false) return false   // intended cancel path — never actually ran
```

That matches how @jgclark remembers the API working at the time.

#### What `chooseOption` actually does today

```js
export async function chooseOption(...) {
  const { index } = await CommandBar.showOptions(...)
  return options[index]?.value ?? defaultValue ?? options[0].value
}
```

It **never returns `false`**. On ESC/cancel, one of:

1. **Silent default** — if `showOptions` returns a result with a missing/invalid `index`, the
  `?? defaultValue ?? options[0].value` chain picks the default (or first option). The user
   thinks they cancelled; the plugin proceeds as if they chose the default.
2. **Throw** — if `showOptions` resolves to `null` (how `getValuesForFrontmatterTag` in
  `helpers/NPFrontMatter.js` treats cancel), destructuring throws and the caller may appear to
   "abort" without a clean `false` return.

There is **no documented guarantee** in `flow-typed/Noteplan.js` that ESC kills the plugin run.
Templating's cancel story is built on prompt helpers returning `false` / `null`, not on runtime
abort.

#### Scale

Roughly **40 call sites** use `chooseOption` across the repo. Most do not check for cancel. A few
already type the result as `string | boolean` and treat non-string as "keep current value"
(`helpers/NPSettings.js`) — anticipating cancel without getting it.

Cancel-sensitive code tends to use `chooseOptionWithModifiers`, `textPrompt`, or `showForm`
instead (e.g. Templating `PromptFormHandler`, TaskAutomations `getUserActionForThisTask`).

#### Options for a repo-wide fix (when you want to tackle it)


| Approach                                                   | Pros                                                              | Cons                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A. Teach `chooseOption` to return `false` on cancel**    | One fix, matches `getInput` contract, all `=== false` checks work | ~40 callers; some relied on "ESC = default"; return type becomes `Promise<T | TDefault | false>` |
| **B. Leave `chooseOption` as-is; document "no cancel"**    | No breaking changes                                               | Misleading for authors who expect `false`; defaults on ESC remain                                |
| **C. Per-call-site wrappers** (what CallbackURLs does now) | Safe, incremental                                                 | Duplicated `chooseWizardOption`-style helpers                                                    |


**Suggested cancel detection** (if A): after `showOptions`, return `false` when
`response == null`, `index == null`, `index < 0`, or both `value` and `label` are missing.
Apply the same rules to `chooseOptionWithModifiers` for consistency.

**Do not use `false` as an option `.value`** if A is adopted — reserve `false` for the helper's
cancel sentinel only (option values should stay strings or other domain types).

#### Recommendation for now

- **Defer A** until you can skim callers or accept a behaviour change (ESC stops meaning "take
default").
- **CallbackURLs** local wrapper is the template for any other wizard that needs cancel before
then.
- When you do A, CallbackURLs can drop `chooseWizardOption` and go back to plain `chooseOption`.

