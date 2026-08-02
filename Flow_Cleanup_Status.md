# Flow cleanup — current state

**Temporary working document.** Delete once the branch is merged and
[Flow_Human_Review.md](./Flow_Human_Review.md) has been triaged.

Branch: `flow-cleanup` · not pushed

---

## Numbers

| | Start | Now | Change |
|---|---|---|---|
| Raw `flow check` errors | 8,254 | **18** | −99.8% |
| Unique `file:line:code` sites | 1,314 | **18** | −98.6% |
| Files with errors | 205 | **9** | −96% |
| Plugins at zero errors | 0 | **32 of 34** | — |
| Jest | 200 suites / 4,619 tests | unchanged, green | — |

Raw count and site count started far apart because Flow emits one error per
(source-type × destination-slot) pair — a single bad annotation could produce thousands of lines.
They now coincide, which is itself a sign the cascades are gone.

Only `np.Preview` (2) and `jgclark.PeriodicReviews` (4) still have plugin-level errors, plus a
scattering of single sites elsewhere. Flow's own standard library also went 12 → 0.

Run `node scripts/flow-report.js` for the live per-plugin table.

---

## Every remaining error is a documented defect

**All 18 are listed in [Flow_Human_Review.md](./Flow_Human_Review.md)** with a concrete suggested
fix. None of them is a missing annotation — each is a real problem that a cast would hide:

| Count | What | Item |
|---|---|---|
| 5 | Undeclared identifiers that throw `ReferenceError` (`commmand` typo, `metaKey` destructured under another name, `fs` in plugin code, `keyModifiers`, `addTrigger`/`ensureFrontmatter`) | 5a |
| 4 | `jgclark.PeriodicReviews/src` imports four modules that don't exist | 2 |
| 2 | `np.Preview` imports a `showHTML` that was replaced by `showHTMLV2` | 1 |
| 2 | `jgclark.Summaries/testCharting.js` calls `showHTMLV2` with the old positional signature | 16 |
| 1 | `dialogElementRenderer.js:823` — the one `handleFieldChange(item.key)` with no guard | 5 |
| 1 | `helpers/react/testSimpleDialog.js` imports `@helpers/NPNotePlan`, which doesn't exist | 5a |
| 1 | `helpers/checkType.js` `$ObjMap` — blocked on a Babel upgrade | 18b |

The checklist also carries ~20 further defects that *were* silenced by a type-only cast during the
sweep, because leaving them erroring wasn't an option under the no-code-changes rule. Three of
those carry a `// KNOWN BUG - see Flow_Human_Review.md item N` comment at the exact line.

---

## Did anything actually change at runtime?

`scripts/flow-emit-audit.js` transforms every changed file with Babel at a base revision and at
the working tree, then diffs the emitted JavaScript. Flow annotations and casts are erased by
`@babel/preset-flow`, so a type-only change must emit byte-identical output.

**179 of 205 changed source files emit byte-identical JavaScript.** Eight plugin bundles
(`jgclark.Dashboard`, `np.Templating`, `dwertheimer.TaskAutomations`, `.EventAutomations`,
`np.CallbackURLs`, `shared.AI`, `jgclark.Reviews`, `np.plugin-test`) all rebuild unchanged.

Re-run it yourself: `node scripts/flow-emit-audit.js` (add `--show` for the diffs).

The 26 files that differ:

### Provably equivalent (21 files)

| Pattern | Files | Why it's identical |
|---|---|---|
| `Number(dateObj)` around a `Date` subtraction | 10 | `-` already coerces via `valueOf()`; `Number(x)` is the same conversion, `NaN` included |
| Stray `;` from `;(x: any).method()` casts | 5 | An empty statement. Needed because the repo omits semicolons, so a leading `(` would continue the previous line |
| `String(x)` in a template literal / `encodeURIComponent` | 2 | Both already call `String()` on their argument |
| `const self = this` / `const proc = process` alias | 2 | Same object through a local |
| `asTNote(x)` in two test files | 2 | Identity function — `(n: any) => (n: any)` |
| Added `export` line in `__mocks__/index.js` | 1 | Purely additive re-export |

### Verified equivalent, but a real edit (1 file)

`dwertheimer.TaskSorting/src/sortTasks.js` — `for (const lineIndex in todos)` became an indexed
loop. Identical for a dense array (`todos` comes from `sortListBy`); differs only if the array
ever carried non-index enumerable properties, which is the reason for the change. 61 tests cover
the file.

### Import corrected (1 file)

`jgclark.Dashboard/src/pluginToHTMLBridge.js` — `REFRESH_ACTIONS_ALLOWED_ON_HANDLER_FAILURE` is a
runtime const (`types.js:448`) but sat in the `import type` block, so Babel erased it. Rollup
flattens modules into one scope so the built plugin *did* resolve it — not a live crash — but the
import was wrong. `script.js` still rebuilds unchanged.

### Deliberate behaviour changes — each in its own commit (3 files)

1. **`helpers/dev.js`** — the log functions are now variadic. Eleven call sites were passing a
   third argument that was silently dropped, so **log output now includes data it previously
   discarded**. → `47421bf6`
2. **`dwertheimer.EventAutomations/src/NPTimeblocking.js`** — removed a spread:
   `writeSyncedCopies(...paras, config)` passed the *first paragraph* as the array and the
   *second* as the config, so the feature reported "No todos/references marked for this day!" and
   wrote nothing. → `e5119981`
3. **`dwertheimer.EventAutomations/src/config.js`** — `createSyncedCopies` existed in
   `plugin.json` but nowhere in the config plumbing. → `e5119981`

Three further incidental behaviour changes were caught by the audit and reverted to casts
(`232aa2db`): a shallow copy on an error path in `removeInvalidTagSections`, a changed initial
value for `NoTasks`' `this.pointer`, and a changed Map key in `taskNoteStats`.

---

## Two things the audit caught that would otherwise have shipped

Both are cases where **Flow 0.245 accepts syntax that Babel cannot parse**, so the file silently
fails to transform — breaking the rollup build *and* jest.

1. Optional tuple elements (`[string, any, string?]`) in `np.plugin-test/src/react/WebView.jsx`.
2. Mapped types (`{ [K in keyof Obj]: … }`) replacing `$ObjMap` in `helpers/checkType.js` — this
   one turned 19 test suites red before it was reverted.

An earlier version of this document said both were "blocked on a Babel upgrade". **That was
wrong, and it was worth checking.** Tested against `@babel/preset-flow` 7.25.9, 7.29.7 and 8.0.1,
and `@babel/parser` 8.0.4 with every `flow` plugin option: all three syntaxes fail on all of
them. Babel's Flow parser has not implemented them at any version.

The supported route is `babel-plugin-syntax-hermes-parser`, which does parse mapped types and
conditional types (and the *labeled* tuple form, `[a: string, b: any, c?: string]`, which Flow
also accepts — so prefer that spelling). `$ObjMap` still parses under it too.

Not recommended today: it swaps the Flow front-end for jest, rollup and eslint at once, and buys
exactly one error (item 18b, a deprecation). Full table in item 17a.

---

## Guard rail

`scripts/flow-report.js` plus a `Flow-Check` CI job. It fails only when a plugin's unique-site
count rises above `scripts/flow-baseline.json`. With 32 of 34 plugins pinned at zero, the ratchet
now does real work. Verified in both directions.

Once the checklist is worked through, replace the ratchet with a plain `npx flow check`.

---

## How the last stretch was done

Two waves of parallel agents over disjoint plugin groups, each held to the type-only rule and each
required to prove it with `scripts/flow-emit-audit.js` before finishing, then re-verified
centrally. Worth knowing if you repeat the exercise:

- The audit must list files from `git diff <base>`, **not** `<base>..HEAD` — the latter silently
  skips uncommitted work, which is exactly what a running agent has.
- Agents will reach for a cast where a bug lives. Three did; those sites now carry a
  `// KNOWN BUG` comment rather than a silent cast.
- One agent's "improvement" to a vendored `flow-typed` libdef (making `chroma-js`'s `Scale`
  generic) traded 3 errors for 5. Reverted.

---

## Known flake (pre-existing, not caused by this work)

Jest intermittently loses a worker and fails a different suite each run. Verified on a stashed
(clean) tree: six runs there failed `helpers/__tests__/search.test.js`,
`np.Templating/__tests__/frontmatter-error-handling.test.js` and `web-api-tests.test.js` on
different runs. Passes with `--runInBand`.
