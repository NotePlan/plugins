# Flow cleanup — current state

**Temporary working document.** Delete once the branch is merged and
[Flow_Human_Review.md](./Flow_Human_Review.md) has been triaged.

Branch: `flow-cleanup` · 36 commits · not pushed

---

## Numbers

| | Start | Now | Change |
|---|---|---|---|
| Raw `flow check` errors | 8,254 | **852** | −90% |
| Unique `file:line:code` sites | 1,314 | **510** | −61% |
| Files with errors | 205 | 138 | −33% |
| Plugins at zero errors | 0 | **6** | — |
| Jest | 200 suites / 4,619 tests | unchanged, green | — |

Raw count and site count diverge because Flow emits one error per
(source-type × destination-slot) pair. Unique sites is the honest measure; the raw number was
inflated ~6× at the start by a handful of annotations.

**Plugins now at zero:** `jgclark.MOCs`, `jgclark.Filer`, `np.statistics`, `scripts`,
`aaronpoweruser.ReadwiseUnofficial`, `__mocks__`. Flow's own standard library also went 12 → 0
(our `declare var Range` had been shadowing the DOM `Range` class, breaking `dom.js`).

Run `node scripts/flow-report.js` for the live per-plugin table.

---

## Did anything actually change at runtime?

Every changed file was transformed with Babel at `main` and at `HEAD`, and the emitted JS
diffed. **107 of 133 changed source files emit byte-identical JavaScript.** The `jgclark.Dashboard`
and `dwertheimer.TaskAutomations` plugin builds also produce byte-identical `script.js`.

Re-run it yourself at any time: `node scripts/flow-emit-audit.js` (add `--show` for the diffs).

The 26 files that do differ break down as follows.

### Provably equivalent (21 files)

| Pattern | Files | Why it's identical |
|---|---|---|
| `Number(dateObj)` around a `Date` subtraction | 10 | `-` already coerces via `valueOf()`; `Number(x)` is the same conversion, including `NaN` for undefined |
| Stray `;` from `;(x: any).method()` casts | 5 | An empty statement. Needed because the repo omits semicolons, so a leading `(` would continue the previous line |
| `String(x)` inside a template literal / `encodeURIComponent` | 2 | Both already call `String()` on their argument |
| `const self = this` / `const proc = process` alias | 2 | Same object, referenced through a local |
| `asTNote(x)` wrapper in two test files | 2 | Identity function — `(n: any) => (n: any)` |
| Added `export` line in `__mocks__/index.js` | 1 | Purely additive re-export |

### Verified equivalent, but a real edit (1 file)

`dwertheimer.TaskSorting/src/sortTasks.js` — `for (const lineIndex in todos)` became a plain
indexed loop. Identical for a dense array (`todos` comes from `sortListBy`, so it always is one);
differs only if the array ever carried non-index enumerable properties, which `for...in` would
have picked up and the indexed loop won't. That's the reason for the change. 61 tests cover the
file.

### Deliberate behaviour changes — each in its own commit (3 files)

1. **`helpers/dev.js`** — `logDebug`/`logInfo`/`logWarn`/`logError` are now variadic. Eleven call
   sites were passing a third argument that was being silently dropped, so **log output now
   includes data it previously discarded**. No other behaviour change.
   → commit `47421bf6`

2. **`dwertheimer.EventAutomations/src/NPTimeblocking.js`** — removed a spread:
   `writeSyncedCopies(...paras, config)` → `writeSyncedCopies(paras, config)`. The spread passed
   the *first paragraph* as the array and the *second paragraph* as the config, so the feature
   showed "No todos/references marked for this day!" and wrote nothing.
   → commit `e5119981`

3. **`dwertheimer.EventAutomations/src/config.js`** — added `createSyncedCopies` to
   `AutoTimeBlockingConfig`, its defaults (`false`, matching `plugin.json`) and `configTypeCheck`.
   It existed in `plugin.json` but nowhere in the config plumbing.
   → same commit, `e5119981`

### Import corrected (1 file)

**`jgclark.Dashboard/src/pluginToHTMLBridge.js`** — `REFRESH_ACTIONS_ALLOWED_ON_HANDLER_FAILURE`
is a runtime const (`types.js:448`) but was listed in the `import type` block, so Babel erased
it. Now imported as a value, which adds an import line to the emitted JS. Checked the built
bundle before changing it: Rollup flattens modules into one scope, so the plugin *did* resolve
the identifier and this was not a live crash — but the import was wrong, and `npc plugin:dev
jgclark.Dashboard` still produces an unchanged `script.js`.

Three further incidental behaviour changes were caught by this audit and reverted to casts
(commit `232aa2db`): a shallow copy on an error path in `removeInvalidTagSections`, a changed
initial value for `NoTasks`' `this.pointer`, and a changed Map key in `taskNoteStats`.

---

## What the remaining 510 sites are

| Shape | Sites | Fixable without code changes? |
|---|---|---|
| `incompatible-type` / `prop-missing` / `incompatible-call` | ~290 | Mostly no — these are genuine nullability and shape mismatches |
| `extra-arg` (stale arguments in test calls) | 36 | No — needs deleting the arguments (item 16) |
| `cannot-resolve-name` | 26 | No — 21 are genuinely undeclared identifiers (items 5a, 13) |
| `incompatible-use` (reading off possibly-null) | 49 | No — each needs a guard |
| `invalid-computed-prop` / `incompatible-indexer` | 33 | Partly — the rest are the sortTasks type tangle (item 20) |
| `reassign-const` | 17 | No — needs a local variable, or a `.flowconfig` decision (item 17) |
| Template-literal coercion of booleans/Dates | ~32 | Only by wrapping in `String()` (item 18) |
| `unreachable-code` | 4 | No — the code really is unreachable (item 3) |

**The purely-mechanical categories are now exhausted.** `missing-local-annot`,
`missing-empty-array-annot`, `underconstrained-implicit-instantiation`,
`signature-verification-failure`, `method-unbinding`, `definition-cycle`, `value-as-type`,
`recursive-definition`, `missing-this-annot`, `import-value-as-type` and `type-as-value` are all
at **zero**.

Exactly five annotation-shaped errors remain, and all five are documented rather than fixed
because each one is a real problem in disguise: two `missing-export` (the `np.Preview` `showHTML`
imports, item 1), one `missing-this-annot` (`this` at module scope, item 18a), and two
`deprecated-utility`/`deprecated-type` (`$ObjMap` in `checkType.js`, item 18b, plus two vendored
`flow-typed/npm/` libdefs that get regenerated by `flow-typed install`).

**Everything else needs either a code edit or a design decision**, and all of it is written up in
[Flow_Human_Review.md](./Flow_Human_Review.md) — 23 items, graded 🔴 breakage / 🟠 silently wrong /
🟡 dead code / 🔵 design question, each with a concrete suggestion.

The five worth reading first:

- Two `np.Preview` files import a `showHTML` that no longer exists — they throw on import.
- `jgclark.PeriodicReviews/src` imports three modules that aren't in the repo.
- `NoteModule.removeSection()` and `replaceContentUnderHeading()` both `return 'Not implemented
  yet'` above their working implementation, so they silently do nothing.
- Nine cancel checks in `NPXCallbackWizard` test `chooseOption()` against `false`, which it never
  returns — so cancelling a wizard step silently proceeds with the default.
- Five undeclared identifiers that would throw `ReferenceError` (including a `commmand` typo and
  a `metaKey` that was destructured under a different name).

---

## Guard rail

`scripts/flow-report.js` plus a `Flow-Check` CI job. It fails only when a plugin's unique-site
count rises above `scripts/flow-baseline.json`, so the repo can't regress while the remaining
items are worked through. Verified in both directions — it correctly reports a regression when a
deliberately broken function is added.

As each plugin is cleaned up, run `node scripts/flow-report.js --update-baseline` and commit; a
plugin that reaches 0 is pinned there. Once the whole repo is clean, replace the ratchet with a
plain `npx flow check`.

---

## Known flake (pre-existing, not caused by this work)

Jest intermittently loses a worker and fails a different suite each run. Verified on a stashed
(clean) tree: six runs there failed `helpers/__tests__/search.test.js`,
`np.Templating/__tests__/frontmatter-error-handling.test.js` and `web-api-tests.test.js` on
different runs. Passes with `--runInBand`.
