# Flow cleanup — items needing a human decision

Everything here is a **real defect or a genuine design question**, not a missing annotation.

Two kinds of entry:

- **Still erroring** — Flow reports it today. Only items 1 and 2 are in this state.
- **Silenced but not fixed** — the defect is real, but leaving it erroring wasn't an option under
  the type-only rule, so the site carries a cast plus a `// KNOWN BUG` comment. Flow is quiet;
  the bug is not gone.

Track progress with `node scripts/flow-report.js`. CI (`Flow-Check`) fails only if a plugin's
unique-site count rises above `scripts/flow-baseline.json`, so fixing anything here is safe.

**Legend:** 🔴 user-visible breakage · 🟠 silent wrong behaviour · 🟡 dead/vestigial code · 🔵 design question

*Last verified against the code on 2026-08-02 — every item below was re-checked at its stated
line, not carried over on trust. Items resolved in the review pass have been removed.*

---

## 🔴 Still erroring (6 of 6 remaining Flow errors)

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

### 2. `jgclark.PeriodicReviews` — source imports four modules that don't exist

`jgclark.PeriodicReviews/src/reviewHTMLViewGenerator.js:9, 10, 18, 19`

Imports `../plugin.json`, `./periodicReviewHelpers` (twice) and `./reviewQuestions`. The plugin's
`src/` contains only this one file — there is no `plugin.json` and no sibling modules.

**Suggestion:** the directory looks orphaned (left behind by a move or a partial extraction).
Confirm with @jgclark, then either restore the missing files or delete `src/`.

---

## 🔴 Silenced but not fixed — real breakage

### 3. `KimMachineGun.Raindrop` — "create if not exists" opens `undefined` when the note exists

`KimMachineGun.Raindrop/src/NPPluginMain.js:153-158`

`createNoteIfNotExists()` has no return on the `existingNotes.length !== 0` path, so it resolves
to `undefined` and the caller does `Editor.openNoteByFilename(undefined)`. The signature is now
honestly `Promise<?string>` and the call site carries a `KNOWN BUG` comment and an `(filename: any)`
cast — so Flow is quiet, but the note-already-exists case still fails.

**Suggestion:** `return existingNotes[0].filename` on that branch, then drop the cast.

---

### 4. `np.Tidy` — a boolean passed where an encoded-params string is expected

`np.Tidy/src/tidyMain.js:46-47`

```js
await removeOrphanedBlockIDs((config.runSilently: any))
```

`removeOrphanedBlockIDs(params: string = '')` (`:430`) feeds `params` to
`overrideSettingsWithEncodedTypedArgs()` and `getTagParamsFromString()`. Passing `true` takes the
`if (params)` branch and `getTagParamsFromString(true, 'runSilently', false)` cannot read
`runSilently`. Effect: **`runSilently` is never honoured** by this command. Currently cast with a
`KNOWN BUG` comment.

**Suggestion:** pass `'{"runSilently":true}'` (or `''`), matching the other params-taking calls
below it.

---

## 🟠 Silenced but not fixed — silently wrong

### 5. `jgclark.Reviews` — a guard that can never be false

`jgclark.Reviews/src/projects.js:251`

```js
const finalProgressComment = (finalCommentRaw && (finalCommentRaw: any) !== true) ? ... : ''
```

`getInputTrimmed()` returns `Promise<string | false>` (`helpers/userInput.js`), so `!== true` is
always true. The cast keeps Flow quiet.

**Suggestion:** drop the `&& (finalCommentRaw: any) !== true` clause entirely.

---

### 6. `jgclark.Summaries` — vacuous string comparisons on numbers

`jgclark.Summaries/src/TMOccurrences.js` — 7 occurrences of `!== ''`

`this.count !== ''` and `this.total !== ''` where both are declared `number`. Those clauses can
never be false, so they filter nothing; the adjacent `!isNaN(...)` checks do the real work.

**Suggestion:** harmless but misleading — delete the `!== ''` clauses.

---

## 🟡 Dead or vestigial

### 7. `NoTasks.jsx` — confetti class references four undeclared globals

`jgclark.Dashboard/src/react/components/NoTasks.jsx` — 16 references

Calls `random()`, `TweenLite`, `Power4` and `_` (lodash). None is imported or declared anywhere;
line 10 has a commented-out `// import {random} from 'lodash'`. `ConfettiCannon` would throw
`ReferenceError` if constructed. The file header says **"no longer used (from v2.2 or v2.3)"**.

**Suggestion:** delete the file. If the confetti is wanted later it needs GSAP added as a
dependency — a new decision, not a restoration.

---

## 🔵 Design questions

### 8. `TEditor` is missing `linkedItems` and `datedTodos`

`flow-typed/Noteplan.js` — both are declared on `Note` (`:1736`, `:1743`) but **not** on `TEditor`

Both appear to exist on the live Editor object. Call sites work around it with `(e: any)` casts.

**Suggestion:** confirm with @EduardMe that Editor exposes them, then add both to `TEditor` (or
move them to `CoreNoteFields`) and drop the casts. Deliberately not done blind.

---

### 9. `TDashboardSettings` — 68 of 86 properties are "required" but nothing guarantees them

`jgclark.Dashboard/src/types.js` — 86 properties, 18 optional

The settings object is assembled at runtime by `getDashboardSettingsDefaults()` from a
`TSettingItem` array, so Flow cannot verify any given key is present, and older installs won't
have newer keys until defaults are merged. Consumers already treat them defensively
(`dashboardSettings?.FFlag_UseTagCache !== false`).

The sweep added `TDashboardSettingsIn = $ReadOnly<Partial<TDashboardSettings>>` for parameters,
which is the honest *input* type. The underlying question remains.

**Suggestion:** audit the required/optional split. Most probably want to be optional.

---

### 10. Babel cannot parse Flow's newer type syntax — measured, not assumed

Flow 0.245 accepts syntax that `@babel/preset-flow` rejects, so a file can pass `flow check` and
still fail to transform, breaking **both** the rollup build and jest. Tested 2026-08-02:

| Syntax | preset-flow 7.25.9 (current) | 7.29.7 | 8.0.1 / parser 8.0.4 | `babel-plugin-syntax-hermes-parser` |
|---|---|---|---|---|
| `[string, any, string?]` | ✗ | ✗ | ✗ | ✗ |
| `[a: string, b: any, c?: string]` (labeled) | ✗ | ✗ | ✗ | ✓ |
| `{ [K in keyof O]: … }` (mapped) | ✗ | ✗ | ✗ | ✓ |
| `T extends U ? A : B` (conditional) | ✗ | ✗ | ✗ | ✓ |
| `$ObjMap<O, F>` (deprecated) | ✓ | ✓ | ✓ | ✓ |

Also tested `@babel/parser` 8.0.4 with `['flow', {all: true, enums: true}]` — no change. Babel's
Flow parser has simply not implemented these, at any version. **Upgrading Babel does not help.**

Consequences today:
- `np.plugin-test/src/react/WebView.jsx:166` — `sendToPlugin`'s param stays `Array<any>`. Both
  optional-tuple spellings break the build; the non-optional `[string, any, string]` doesn't fit
  the sole caller, which passes two elements.
- `helpers/checkType.js` — keep `$ObjMap`. It is deprecated but parses everywhere. Rewriting it
  as a mapped type turned 19 test suites red before it was reverted.

**Suggestion:** do nothing for now. Adopting `babel-plugin-syntax-hermes-parser` swaps the Flow
front-end for jest, rollup and eslint at once, and today would buy one deprecation. Revisit only
if the team wants modern Flow syntax generally — then it is one coordinated change.
