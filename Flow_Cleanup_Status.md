# Flow cleanup — current state

**Temporary working document.** Delete once the branch is merged and
[Flow_Human_Review.md](./Flow_Human_Review.md) has been triaged.

Branch: `flow-cleanup` · not pushed · *last verified 2026-08-02*

---

## Numbers

| | Start | Now | Change |
|---|---|---|---|
| Raw `flow check` errors | 8,254 | **6** | −99.93% |
| Unique `file:line:code` sites | 1,314 | **6** | −99.5% |
| Files with errors | 205 | **3** | — |
| Plugins with any error | ~34 | **2 of 47** | — |
| Jest | 4,619 passing | **4,621 passing**, green | — |

The only two plugins still erroring are `jgclark.PeriodicReviews` (4) and `np.Preview` (2), and
**both are the same kind of problem: imports of modules or exports that do not exist.** Neither
can be fixed with a type — see items 1 and 2.

Raw count and site count started far apart because Flow emits one error per
(source-type × destination-slot) pair, so one bad annotation could produce thousands of lines.
They now coincide, which is itself evidence the cascades are gone.

Run `node scripts/flow-report.js` for the live per-plugin table.

---

## Every remaining error is a documented defect

All 6 are items 1 and 2 in [Flow_Human_Review.md](./Flow_Human_Review.md).

The review list also carries **8 further defects that are real but no longer erroring**, because
silencing them was the only option under the type-only rule. Those sites carry a cast *plus* a
`// KNOWN BUG` comment naming the actual problem — Flow is quiet, the bug is not gone. The two
worth acting on first:

- `KimMachineGun.Raindrop` opens `undefined` when the note already exists (item 3).
- `np.Tidy`'s `runSilently` is never honoured because a boolean is passed where an encoded-params
  string is expected (item 4).

---

## Did anything change at runtime?

There were two distinct passes, and they have different answers.

### Pass 1 — the type-only sweep (through commit `a3dc9c88`)

`scripts/flow-emit-audit.js` Babel-transforms every changed file at a base revision and at the
working tree, then diffs the emitted JavaScript. Flow annotations and casts are erased, so a
type-only change must emit byte-identical output.

**179 of 205 changed files emitted byte-identical JavaScript.** The 26 exceptions were:

| Category | Files | Note |
|---|---|---|
| Provably equivalent | 21 | `Number()` around a `Date` subtraction that `-` already coerced; empty statements from `;(x: any)` casts; `String()` where a template literal already called it; `const self = this` aliases; identity `asTNote()` wrappers |
| Verified equivalent, real edit | 1 | `sortTasks.js` `for...in` → indexed loop |
| Import corrected | 1 | `pluginToHTMLBridge.js` — a runtime const sat in an `import type` block |
| **Deliberate bug fixes** | 3 | see below |

The three deliberate fixes, each in its own commit:

1. **`helpers/dev.js`** (`47421bf6`) — the log functions are now variadic. Eleven call sites were
   passing a third argument that was silently dropped, so **log output now includes data it
   previously discarded**.
2. **`NPTimeblocking.js`** (`e5119981`) — `writeSyncedCopies(...paras, config)` spread the array,
   passing the *first paragraph* as the array and the *second* as the config. The feature
   reported "No todos/references marked for this day!" and wrote nothing.
3. **`EventAutomations/config.js`** (`e5119981`) — `createSyncedCopies` existed in `plugin.json`
   but nowhere in the config plumbing.

Three further incidental behaviour changes were caught by the audit and reverted to casts
(`232aa2db`).

### Pass 2 — the review pass (commits `f8e0679d` … `763dbb09`)

This pass deliberately fixed the documented defects, so **74 files legitimately changed emitted
JavaScript**. That is the point of it, not a violation. `shared.AI` was also removed from the
repo entirely.

Re-run the audit yourself at any time: `node scripts/flow-emit-audit.js` (`--show` for diffs).

---

## Three regressions the re-check caught

Worth recording, because two of them were invisible to `flow check` alone.

1. **`dwertheimer.JestHelpers` — a red test suite.** The fix for the old `this[name]` bug built a
   `NOTEPLAN_GLOBALS` map at module scope. Those globals only exist inside NotePlan, so importing
   the module anywhere else threw `ReferenceError: Calendar is not defined` and the plugin's own
   Jest suite failed to run. Now built lazily inside the function. **This is the one emitted-JS
   change in the re-check pass, and it is intentional.**
2. **`np.plugin-test/src/react/WebView.jsx` — a labeled tuple Babel can't parse.** The annotation
   had also been placed *inside* the destructuring pattern, which Flow rejects outright
   (`unsupported-syntax`). Reverted to `Array<any>`, which is the only spelling that satisfies
   both Flow and Babel here — see item 10 for the full matrix.
3. **Five type-only leftovers** from otherwise-correct fixes: a guard that produced an exact empty
   object with no indexer (`timeblocking-helpers`), a refinement Flow can't carry from `.filter()`
   into `.map()` (`helpers/calendar.js`), array invariance on a `defaultValue`
   (`helpers/dataManipulation.js`), and two coercions. All fixed with annotations/casts;
   emitted JS unchanged.

---

## Guard rail

`scripts/flow-report.js` plus a `Flow-Check` CI job, failing only when a plugin's unique-site
count rises above `scripts/flow-baseline.json`. With 45 of 47 plugins pinned at zero the ratchet
now does real work.

Once items 1 and 2 are closed, replace it with a plain `npx flow check` — the repo will be clean.

---

## Lessons worth keeping

- **`flow check` passing is not enough.** Flow accepts syntax Babel cannot parse, and Babel
  failing to parse a file breaks both the rollup build and jest. Item 10 has the tested matrix;
  `flow-emit-audit.js` catches it.
- **Run the tests, not just Flow.** The JestHelpers regression was invisible to `flow check` —
  the module type-checked perfectly and still threw on import.
- **The audit must list files from `git diff <base>`, not `<base>..HEAD`** — the latter silently
  skips uncommitted work, which is exactly what a running agent has.
- **Agents reach for a cast where a bug lives.** Three did during the sweep; those sites carry a
  `// KNOWN BUG` comment rather than a silent cast.

---

## Known flake (pre-existing, not caused by this work)

Jest intermittently loses a worker and fails a different suite each run. Verified on a stashed
(clean) tree: six runs there failed `helpers/__tests__/search.test.js`,
`np.Templating/__tests__/frontmatter-error-handling.test.js` and `web-api-tests.test.js` on
different runs. Passes with `--runInBand`.
