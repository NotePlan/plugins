# PR #769 — Status, Risk Analysis, and Test Plan

**Branch:** `flow-real-types` → `main` (rebased onto post-#767 main, now mergeable)
**Scope:** 167 files changed, 7 commits

---

## 1. Current state

| Metric | Before (#767 merged) | After #769 |
|---|---|---|
| `flow check` errors | 0 | **0** |
| Suppressions (`$FlowIgnore` / `$FlowFixMe`) | 560 | **18** |
| Jest | 200 suites / 4,644 | **200 suites / 4,644** |

**97% of remaining Flow suppressions removed.** Of the 18 left, 3 aren't real suppressions at all (two sit inside commented-out code; one is the literal text `$FlowIgnore[prop-missing]` inside a prose comment in `__mocks__/asNPTypes.js`). So **15 live suppressions remain**, each narrowed to a specific error code and carrying a comment explaining why it's still there.

The rebase dropped 6 commits that are now redundant (the multi-level indent fix and its docblock, both shipped in #770; the `insertTodos` revert and its correction, now obsolete; and a `[DIAG]` logging add/remove pair that nets to zero).

---

## 2. Where there is **zero** risk

This is the majority of the PR, and the claim is mechanical rather than a matter of judgement.

**118 of 167 files (71%) produce byte-identical JavaScript.**

Babel erases Flow types at build time, so a change that only touches annotations *cannot* alter runtime behaviour. `scripts/flow-emit-audit.js` proves this per-file: it runs the Babel transform on each changed file at `main` and again on this branch, and diffs the emitted JS. For 118 files the output is identical byte-for-byte.

**A further 4 files differ only by a bare `;`** — an empty statement, a no-op:

- `helpers/react/reactDev.js`
- `jgclark.Dashboard/src/react/components/Section/useSectionSortAndFilter.jsx`
- `np.Shared/src/react/Root.jsx`
- `np.Templating/__tests__/NPTemplateRunner.test.js`

The repo omits semicolons, so a statement starting with `(` continues the previous line. Inline casts at statement start must be written `;(foo: any).bar()`. That leading `;` survives type erasure as an empty statement.

**So 122 of 167 files carry no behavioural risk whatsoever, and this is verifiable by re-running the audit rather than by trusting review.**

---

## 3. Where the risk actually is

**45 files, 489 changed lines of emitted JavaScript.** I reviewed **100% of those lines at the emitted-JS level** — not the source diff. That matters: emitted JS has comments and type annotations stripped, so nothing can hide in a plausible-looking comment, and a "type-only" change that isn't shows up immediately.

The 45 files break into three tiers.

### Tier A — Mechanically equivalent refactors (no behaviour change)

Verified equivalent, usually by checking the thing the change depended on rather than assuming:

| File | Change | Why it's safe |
|---|---|---|
| `helpers/dev.js` | `timeEnd - timeStart` → `Number(timeEnd) - Number(timeStart)` | `Number()` is exactly what `-` does to each operand. **Important:** `.getTime()` would have been wrong — `helpers/promisePolyfill.js:161,183` pass `Date.now()` (a number) into a param annotated `Date`, so `.getTime()` would throw. |
| `helpers/note.js`, `helpers/NPnote.js` | 6 sorts → `Number(a) - Number(b)` | Same reasoning. An agent originally wrote `.getTime()` here; I reverted that because it adds a crash path the original `-` never had. |
| `dwertheimer.EventAutomations/src/config.js` | `validateConfigProperties` now gets a copy, result discarded | Verified it only *reads* `config[v]` — no writes anywhere in the function. |
| `dbludeau.TodoistNoteplanSync` | setters write `setup.x` not `this.x` | Verified `setup` is never spread or copied, so `this` was always `setup`. |
| `helpers/urls.js`, `jgclark.SearchExtensions/src/searchTriggers.js` | `while ((m = re.exec(s)))` restructured | Same `exec` call order and count. |
| `dwertheimer.TaskAutomations/src/NPTaskScanAndProcess.js` | `hasOwnProperty` → truthiness | Values are always non-empty arrays; `[]` is truthy anyway. |
| `dwertheimer.Forms/src/formSubmission.js` | `for…in` + `hasOwnProperty` → `Object.keys`; `Function.apply` → `new Function` | Identical semantics. |
| `jgclark.SearchExtensions/src/flexiSearch.js` | prefs wrapped in `String()` | Verified the values are only substituted into template strings, never used in boolean context (`"false"` would be truthy). |
| `helpers/config.js`, `helpers/NPConfiguration.js`, `helpers/content.js`, `dwertheimer.TaskSorting/src/tagTasks.js`, `np.Templating/lib/support/modules/data/service.js` | local refinements, `const` destructuring, explicit branches | Equivalent including null/array edge cases. |

### Tier B — Real bug fixes (behaviour changes, but the old behaviour was broken)

These *do* change behaviour. In each case the previous behaviour was a crash, an exception swallowed into a misleading message, or a silently wrong value.

**Three functions that did not exist** — confirmed absent by grep, not inferred:

| Call site | Was | Now |
|---|---|---|
| `np.Templating/src/Templating.js` | `NPTemplating.getTemplate()` — **threw a TypeError every time**, so meeting-note templating was broken | `getTemplateContent()` |
| `np.Templating/lib/TemplatingEngine.js` | `this.getTemplateConfig()` — no such method | `this.templateConfig` |
| `np.Templating/lib/rendering/index.js` | re-exported `renderTemplate` — resolved to `undefined` | `renderTemplateByName` |

**Crashes:**

- `helpers/NPParagraph.js` `paragraphMatches()` called `.startsWith()` on non-string fields (`lineIndex`, `indents`, `date`) → TypeError. Now type-guarded.
- `np.Tidy/src/tidyMain.js` `removeBlankNotes()` compared against the **string** `'undefined'`, so the guard was always true and a note with undefined content threw mid-filter.
- `jgclark.Dashboard` move-day/move-week handlers wrote `p.content` then used `p.note`, which really is `?TNote` — a genuine null dereference the suppression was hiding.
- `np.Templating/lib/support/modules/quote.js` resolved `undefined` out of a `Promise<string>` that callers assign to `const verse: string`.

**Silently wrong values:**

- `jgclark.Dashboard/src/reactMain.js` returned `{}` on error, so every setting read as `undefined`. Now returns `null` and the caller keeps the loaded settings.
- `helpers/NPWindows.js` `getStoredWindowRect()` returned a malformed preference as a fake `Rect`.
- `dwertheimer.Forms` `FormView` passed a tuple-taking `sendToPlugin` into context.
- `np.Templating/lib/support/modules/prompts/handlers/index.js` called `promptDateInterval('', message, default)` against a `(message, defaultValue)` signature — the user saw an empty prompt and the default was dropped.
- `helpers/NPDateStrings.js` — a `null` week threw, and the outer catch discarded **the entire relative-date list**. Now that one week is logged and skipped.

### Tier C — Judgement calls that need a human decision

**These are the only places where reasonable people could disagree.** Everything else is either provably inert or a fix to something demonstrably broken.

1. **`jgclark.SearchExtensions/src/searchHelpers.js` — `makeAnySyncs()` returns `input` instead of `null` on error.** *(@jgclark's call.)* The old behaviour wasn't a design: `null` escaped a `Promise<resultOutputType>` into `saveSearch()`, which reads `.resultCount` and threw — the whole search visibly failed. Now a failure while adding blockIDs costs only the sync links. The alternative (rethrow, so the user gets an empty result set) is equally defensible.

2. **Heading levels clamped to 1–8** (`helpers/userInput.js`, `helpers/paragraph.js`). A computed level of `0`, `NaN` or `12` previously went raw to `insertHeading()`; it's now rounded and clamped (`NaN` → 2). Only affects out-of-range input.

3. **`dwertheimer.TaskAutomations/src/NPOverdueReact.js` — field whitelist.** `para[field] = row[field]` became explicit `type`/`content` branches; anything else logs an error and is skipped. Verified only those two fields are ever sent, but a third would now be dropped rather than blind-assigned.

4. **`helpers/sorting.js` `fieldSorter` — two non-`Date` objects now compare equal.** I found this during review; the agent's claim that only strings/numbers reach that line was wrong. `isNaN()` coerces, so Dates and booleans still become numbers — only plain objects are affected, and the fields actually sorted are `content`/`index`/`date`/`priority`. Very unlikely to fire, but it *is* a divergence neither Flow nor the tests would catch.

5. **`dwertheimer.EventAutomations/src/events.js` — now skips untitled/undated events.** Worth knowing but **not testable**: its wrappers are exported but appear in neither `index.js` nor `plugin.json`, so the command is unreachable.

---

## 4. How we know this is safe

Four independent mechanisms, in decreasing order of strength:

1. **Emitted-JS audit (mechanical, re-runnable).** `node scripts/flow-emit-audit.js --base origin/main` — proves 118 files cannot behave differently. This is the single most important artifact in the PR: it converts "trust the review" into "check the tool."
2. **Full test suite.** 200 suites / 4,644 tests green. Note this is a *floor*, not a ceiling — coverage is thin in exactly the plugin code these changes touch.
3. **Line-by-line review of the entire behaviour-changing surface.** All 489 emitted lines across 45 files, not a sample. Six changes looked like defects and were chased individually; five turned out fine (and could only be known so by checking), one was a real divergence (Tier C item 4).
4. **Dead-suppression sweep.** Placeholder substitution — swap each suppression for a same-line-count placeholder so no line numbers shift, run Flow, see which covered lines actually error. Confirms no remaining suppression is inert (an inert suppression is worse than none: it hides future errors on that line).

### Things I got wrong during this work, and how they were caught

Stated plainly, because it calibrates how much to trust the rest:

- I claimed a Babel upgrade would unlock blocked syntax. **Wrong** — tested 4 versions, all fail. Corrected with a tested matrix.
- An agent's `chroma-js` change traded 3 errors for 5. Caught by re-measuring; reverted.
- A `checkType.js` mapped-type rewrite turned 19 suites red — Babel can't parse mapped types at any version. Reverted.
- Three incidental behaviour changes slipped into a "type-only" commit. Caught **by my own emit audit**, not by review.
- I twice attributed observed indent-flattening to a code path that never executed, and wrote the false conclusion into a commit message. Caught by @dwertheimer's logs; the fix that survived is the one he insisted on re-applying.

The pattern: **the mechanical checks caught what review missed.** That's why the audit matters more than my summary.

---

## 5. What a human should test before merging

Ordered by value. Items 1–2 are the ones I'd actually insist on.

### 1. Meeting notes (np.Templating) — **highest value**
`Create Meeting Note using Meeting Note Template`.
This path **threw a TypeError on every invocation** before this PR (`NPTemplating.getTemplate` doesn't exist). Expect it to work now. If it still fails, the failure is downstream of what was fixed.

### 2. Dashboard settings survive a perspective switch
`Show Dashboard`, then switch perspectives several times including back to default.
✅ Settings persist. ❌ Settings blank out, or the window fails to open. Check the log for `carry on with the existing settings` or `Couldn't assemble the initial data`.
*Why:* `reactMain` used to return `{}` on error, silently replacing every setting with `undefined`.

### 3. Search with sync'd results (jgclark)
Settings: result style **NotePlan**, `syncOpenResultItems` **on**. Run `search` for a term matching several open tasks.
✅ Results carry sync IDs (`^abc123`) exactly as before. The happy path must be untouched — that's the main thing to confirm; the changed path only fires on an error that already broke the search.

### 4. Overdue review edits
`Review overdue tasks (by Task)`. Edit a task's text; complete/cancel a task.
✅ Both work. Check log for `unsupported field` — its absence confirms only `type`/`content` are ever sent.

### 5. Relative-date lists
Any chooser showing relative dates (e.g. `Show Dashboard`, or a template using them).
✅ `this week`, `last week`, `next week`, `2 weeks ago` … `10 weeks' time` all present. ❌ Whole categories missing → check log for `returned null for week offset`.

### 6. Window position restore
Open a plugin window, move/resize, close, reopen. ✅ Restored. If the log shows `isn't a valid Rect`, you had a corrupt stored pref — the intended fix, but worth knowing it fired.

### 7. Rename a note
`rename note` on a normal note ✅; on a title-less note ✅ stops cleanly rather than offering `"undefined"`.

**Not testable — dead code, no action needed:** `events.js` (unreachable — not in `index.js` or `plugin.json`), `TemplatingEngine.getDefaultFormat()` (marked "should never be called"), the `renderTemplate` barrel re-export (nothing imports it).

---

## 6. Known pre-existing bugs found but deliberately NOT fixed

Listed so they aren't mistaken for regressions during testing:

- **`helpers/calendar.js` `keepTodayPortionOnly()`** claims `Array<TCalendarItem>` but returns hand-built plain objects with no `id`, no `isRecurring`, no methods. Any caller reading `.id` or calling `.findLinkedFilenames()` on a multi-day event gets `undefined` or a crash. Four files across three plugins consume it, and `helpers/__tests__/calendar.test.js` asserts `toEqual()` on the plain-object shape — so the test currently locks in the wrong contract.
- **`helpers/NPnote.js` `chooseNoteV2()`** can return a fake note: pick a future calendar date with no note yet and you get a stub with only `title`/`type`/`changedDate`.
- **`helpers/urls.js` `findProjectNoteUrlInText()`** — the `allowCalendarNotes` parameter is dead; the filtered result is computed then discarded.
- **`jgclark.SearchExtensions/flexiSearch.js`** — `String(x) ?? 'quick'` dead defaults: `String()` never returns null, so unset preferences become the literal string `"undefined"`.
- **`dbludeau.TodoistNoteplanSync`** — `teamAccount` is both a data property and a setter; the setter wins, so reads return `undefined`. Appears to be dead code.
- **`helpers/sorting.js` `fieldSorter`** — declared `(a: string, b: string)` but always called with objects; also compares against the *string* `'NaN'`.

---

## 7. Separate finding: NotePlan API bug (not ours, not fixable by plugins)

**Space-indentation is invisible to plugins.** Verified against a note whose bytes on disk were confirmed:

| Line | On disk | API `indents` | API `rawContent` |
|---|---|---|---|
| tab child | 1 tab | **1** ✓ | `"\t* A child ONE-TAB"` ✓ |
| tab grandchild | 2 tabs | **2** ✓ | tabs preserved ✓ |
| 2-space child | 2 spaces | **0** ✗ | spaces stripped |
| 8-space grandchild | 8 spaces | **0** ✗ | spaces stripped |

`rawContent` is reconstructed from marker + `indents` rather than being the literal file bytes (a `- [ ]` on disk comes back as `* `), so once the parser declines to count leading spaces the indentation is gone from *both* fields before any plugin runs.

**The consequence is data loss, not display:** any plugin that deletes and re-inserts paragraphs writes back the stripped version and permanently flattens a space-indented file. Repro note is `DELETEME/indent-api-test.md`; section D shows both behaviours under a single parent. Needs raising with @EduardMe.
