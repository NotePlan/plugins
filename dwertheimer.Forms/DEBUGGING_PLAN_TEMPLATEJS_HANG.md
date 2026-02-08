# Debugging Plan: `templatejs-block` `fn()` Hang

This document tracks the investigation into the `dwertheimer.Forms` freeze/hang when executing a `templatejs-block` whose `templateJSContent` returns an object.

## Current state (known good control)

- The end-to-end flow can succeed when `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT=true` (TemplateJS execution is skipped and a dummy object is returned).
- The TemplateJS invocation has been centralized via `runTemplateJSFn(...)` so all diagnostic paths call the compiled template function in one place.
- Logs may be lost due to NotePlan log buffering; prefer **throw checkpoints** for hard bracketing.

## Goals

- Identify whether the hang is:
  - **before** `fn(params)` (context building / variable binding / getters),
  - **inside** user code execution,
  - **after** `fn(params)` (result inspection, copying, merge into context, awaiting/Promise behavior),
  - or in the subsequent `np.Templating` pipeline (e.g. `templateRunner` call/args).

## Constraints / notes

- NotePlan JSContext quirks:
  - Promise behavior can be non-standard (`new Promise(...)` may fail).
  - Log buffering can hide the true last executed statement.
- Avoid deep-walking complex objects; use shallow copies and safe summaries.

## Where to work

- Primary file: `dwertheimer.Forms/src/formSubmission.js`
  - `executeTemplateJSBlock(...)`
  - `executeTemplateJSBlocks(...)`
  - `processCreateNew(...)` (templateRunner call)

## Runbook: how to run each experiment

- For each run, record:
  - **date/time**
  - flags changed (exact values)
  - **last hard marker** observed (LBB line or thrown error message)
  - whether NotePlan froze, crashed, or completed
  - any suspect key/index if applicable

Prefer **throw checkpoints** when narrowing a hang, because logs can disappear.

## Run log (results)

Paste the key lines from the console log for each run here (especially any `DIAG-RUNFN:` throws).

### Run 1 — Bracket the real `fn(params)` call (before-fn throw)

- **Objective**: Prove we reach the *single* real `fn(params)` call site (and therefore determine whether the hang is inside `fn` or earlier).
- **Code settings** (in `dwertheimer.Forms/src/formSubmission.js`):
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 1`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_LABEL = 'workingContext.'`
- **Expected outcome**: an error thrown with:
  - `DIAG-RUNFN: stage=1 before-fn label="workingContext.<N>"`
- **Result**:
  - **Observed**:
    - Freeze/hang (no `DIAG-RUNFN: stage=1 before-fn ...` observed)
  - **Interpretation**:
    - The hang is occurring **before we reach the single `fn(params)` call site** (or log buffering is dying extremely early).
    - Next: bracket earlier inside the `workingContext` build loop.

### Run 2 — Bracket earlier: does the `workingContext` loop start?

- **Objective**: Determine whether we even enter the `workingContext` loop (before any `fn(...)` is called).
- **Code settings** (in `dwertheimer.Forms/src/formSubmission.js`):
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_WORKING_KEY = 1`
  - `TEMPLATEJS_DIAG_THROW_WORKING_STAGE = 1` (start of loop iteration)
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 0` (disabled for this run)
- **Expected outcome**: an error thrown with:
  - `DIAG-WORKINGCTX: stage=1 start-loop key=1`
- **Result**:
  - **Observed**:
    - `DIAG-WORKINGCTX: stage=1 start-loop key=1` (seen)
    - Note: you reported an additional freeze *after* the error is logged/handled.
  - **Interpretation**:
    - [ ] If this throw appears: the loop begins; next we move the throw forward (stage 2/3) or advance the key index.
    - [ ] If it freezes before this throw: the hang is **before** the loop (e.g. setup/logging right before the loop).

### Run 3 — Avoid Promise resolution on error path (likely hang source)

- **Objective**: If the system freezes *after* the diagnostic throw is logged, suspect the error return path (e.g. `promiseResolve(...)`) is hanging in NotePlan’s JSContext. This run removes Promise-based returns for TemplateJS error objects.
- **Code change** (in `dwertheimer.Forms/src/formSubmission.js`):
  - In `executeTemplateJSBlock`, return `{ __blockError: ... }` **directly** (no `promiseResolve`) for:
    - non-object returns
    - missing return
    - catch(error) path
- **Expected outcome**:
  - The `DIAG-WORKINGCTX` throw still appears, but the plugin should **not** freeze after the error is handled; it should return an error payload back to the UI cleanly.
- **Result**:
  - **Observed**:
    - UI shows `Form Submission Error` with:
      - `Error executing TemplateJS block "field12": TemplateJS block "field12" threw when called with context: DIAG-WORKINGCTX: stage=1 start-loop key=1`
    - No post-error freeze observed (error returns appear stable)
  - **Interpretation**:
    - Freeze stopped → hang was very likely in the Promise resolution/return path, not in `fn`.
    - [ ] If freeze remains: bracket even later (executeTemplateJSBlocks merge / response sending).

### Run 4 — Re-test “before-fn” throw (now that error returns are stable)

- **Objective**: Retry the original “before-fn” bracketing now that the Promise-based error return path is removed.
- **Code settings** (in `dwertheimer.Forms/src/formSubmission.js`):
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_WORKING_STAGE = 0` (disabled)
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 1`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_LABEL = 'workingContext.'`
- **Expected outcome**: an error thrown with:
  - `DIAG-RUNFN: stage=1 before-fn label="workingContext.<N>"`
- **Result**:
  - **Observed**:
    - `DIAG-RUNFN: stage=1 before-fn label="workingContext.10"` (seen)
  - **Interpretation**:
    - We reached the call site; next run is stage=2 after-fn for the same label.
    - [ ] If it freezes before stage=1: hang is still earlier than the call site (investigate Function construction / contextVars binding).

### Run 5 — “after-fn” throw for the same call (does `fn` return?)

- **Objective**: Determine whether the very first real `fn(params)` call (at `workingContext.10`) returns.
- **Code settings** (in `dwertheimer.Forms/src/formSubmission.js`):
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 2`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_LABEL = 'workingContext.10'`
- **Expected outcome**:
  - If `fn` returns: `DIAG-RUNFN: stage=2 after-fn label="workingContext.10"`
  - If it freezes/hangs before that throw: the hang is **inside** `fn` during that call.
- **Result**:
  - **Observed**:
    - Template error (no hang): `Can't find variable: dateField1`
  - **Interpretation**:
    - `fn` is executing and throwing normally; we are past the “can’t reach fn” problem.
    - Next: ensure the test template does not reference missing variables (use minimal form/template), then re-enable bracketing to find the hang.

### Run 6 — Minimal reproducible form/template (reduce variables)

- **Objective**: Remove noise from missing variables and isolate a true “hang” reproducer.
- **Suggested test setup**:
  - Form with **1–2 fields** total (simple keys like `title` / `date1`)
  - One `templatejs-block` that starts with:
    - `return { ok: true }`
  - Then add **one reference at a time**:
    - `return { title }`
    - `return { date1 }`
    - `return { today: date.today() }` (etc.)
- **Code settings**:
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 0` (no bracketing yet)
- **Expected outcome**:
  - No ReferenceErrors; TemplateJS block returns cleanly.
  - Once stable, we re-enable `DIAG-RUNFN` stage=1/2 around the call to locate any hang precisely.
- **Result**:
  - **Observed**:
    - Minimal `return { ok: true }` **succeeds** (no hang).
    - Note: `templatejs-block` results (`ok`, `field1`, etc.) appear in the rendered note output.
      - This is **expected behavior** (results are merged into context and available to the template).
      - If the template doesn't explicitly reference these, check if the template body has code that iterates/dumps all context variables.
      - **TODO for cleanup**: Ensure template body doesn't auto-output all context keys unless intended.

### Run 7a — Re-enable bracketing (confirm call site)

- **Objective**: Confirm we can still reach the call site with real template code.
- **Code settings**:
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 1`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_LABEL = 'workingContext.'`
- **Test template**: `return { title: field1 }`
- **Result**:
  - **Observed**:
    - `DIAG-RUNFN: stage=1 before-fn label="workingContext.10"` (seen, error returned cleanly)
  - **Interpretation**:
    - Call site confirmed; error handling path works (no hang on error return).

### Run 7b — Test real template code execution (no throws)

- **Objective**: Test if the actual template code (`return { title: field1 }`) executes without hanging when throws are disabled.
- **Code settings** (in `dwertheimer.Forms/src/formSubmission.js`):
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 0` (no throws)
- **Test template**: `return { title: field1 }`
- **Result**:
  - **Observed**:
    - **Succeeded** (no hang) — form submission completed, note created successfully.
  - **Interpretation**:
    - Simple template code works. Next: test progressively more complex templates to find if/when hang occurs.

### Run 8 — Progressive complexity testing (find hang boundary)

- **Objective**: Test incrementally more complex templates to find the boundary where the hang occurs (if it still exists).
- **Code settings**:
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = false`
  - `TEMPLATEJS_DIAG_THROW_RUN_FN_STAGE = 0` (no throws)
- **Test template progression** (test each one):
  1. ✅ `return { title: field1 }` (simple form field) — **SUCCEEDED**
  2. ⚠️ `return { today: date.today() }` — **ERROR** (not hang): `date.today is not a function`
     - Note: Error returned cleanly (no hang). `date.today()` exists in DateModule but may not be exposed in context.
     - Try alternatives: `date.now()`, `currentDate()`, or `date.date8601()`
  3. [ ] `return { today: date.now() }` (try `date.now()` instead)
  4. [ ] `return { today: currentDate() }` (try global `currentDate()` helper)
  5. [ ] `return { computed: date.daysBetween(startDateEntry, dueDateEntry) }` (multiple helpers)
  6. [ ] `return { result: date.daysBetween(startDateEntry, dueDateEntry) || 0 }` (with fallback)
  7. [ ] Original problematic template (if available)
- **Result**:
  - **Observed**:
    - Variant 1: ✅ Succeeded
    - Variant 2: ⚠️ Error (not hang) — `date.today is not a function` (method may not be exposed)
    - [ ] Paste results for remaining variants (succeeds, errors, or hangs).
  - **Interpretation**:
    - [ ] If all succeed: the original hang was likely fixed by removing `promiseResolve` from error paths.
    - [ ] If a specific variant hangs: we've isolated the problematic code pattern.

## Step 1 — Baseline & experiment hygiene

- [ ] Keep the known-good control:
  - `DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT=true`
- [ ] Verify end-to-end success still works after each change (sanity gate).
- [ ] Change **one variable at a time** (one flag or one code path).

## Step 2 — Determine “where the hang is” (bracket the call)

Add hard bracketing (throws) around the single call site inside `runTemplateJSFn(...)`:

- [ ] Throw immediately **before** `fn(params)` (proves we reached the call).
- [ ] Throw immediately **after** `fn(params)` (proves `fn` returned).
- [ ] If it hangs between these throws → the hang is **inside** `fn`.

## Step 3 — Classify the hang type

### 3A — Hang before calling `fn(params)`?

- [ ] If the “before-fn” throw never triggers, bracket earlier:
  - [ ] before `Function.apply(...)` construction
  - [ ] after `Function.apply(...)` construction
  - [ ] before building `contextVars`
  - [ ] after building `contextVars`

### 3B — Hang inside user code?

Run minimal user code through the same plumbing:

- [ ] Use a minimal `templateJSContent`:
  - [ ] `return { ok: true }`
  - [ ] `return { a: 1 }`
  - [ ] `return { a: 'x' }`
  - [ ] `return { a: {} }`
  - [ ] `return { a: [] }`
- [ ] If minimal code hangs, the bug is not the user template — it’s the environment/context plumbing.

### 3C — Hang after `fn(params)` returns?

Bracket each post-processing step:

- [ ] right before `Object.keys(result)`
- [ ] right after `Object.keys(result)`
- [ ] right before copying `plainResult[key] = value`
- [ ] right after copying
- [ ] right before returning from `executeTemplateJSBlock`
- [ ] right after awaiting `executeTemplateJSBlock` in `executeTemplateJSBlocks`
- [ ] right before merging into context
- [ ] right after merging into context

If all these pass, the hang is likely downstream (e.g., `templateRunner`).

## Step 4 — Isolate “bad inputs” (context narrowing)

### 4A — Compare context flavors

- [ ] `emptyContext` run
- [ ] `safeContext` run
- [ ] `workingContext` incremental run
- [ ] `testContext` key-by-key (forward)
- [ ] `testContext` key-by-key (reverse)

### 4B — Binary search key sets (if cumulative)

- [ ] Use a binary-search strategy to find the smallest subset that triggers the hang:
  - [ ] half the keys + suspect key(s)
  - [ ] quarter the keys + suspect key(s)
  - [ ] continue until minimal reproducer set is found

### 4C — Value stubbing

Once a suspect key is identified:

- [ ] Replace just that key’s value with a benign stub and retry:
  - [ ] `null`
  - [ ] `{}` (plain empty object)
  - [ ] `[]`
  - [ ] `() => {}` (if the key is expected to be callable)

If stubbing fixes the hang, focus on that value’s origin (proxy/getter/bridge object).

## Step 5 — Reduce surface area (minimize what `fn` can touch)

- [ ] Temporarily reduce `contextVars` creation:
  - [ ] only bind a minimal allowlist (e.g. just form fields needed)
  - [ ] leave everything else accessible via `params[...]` only
- [ ] Avoid any logging that stringifies or enumerates large/unknown objects.

## Step 6 — Confirm what we pass into `np.Templating templateRunner`

- [ ] Right before `templateRunner`, log a **safe summary** of args:
  - [ ] top-level keys
  - [ ] type per key (string/number/boolean/function/object/array/null/undefined)
  - [ ] for objects/arrays: only length / keycount (no deep walk)
- [ ] If the hang occurs only after TemplateJS is fixed, shift focus to `templateRunner` inputs.

## Side issue — Form window not closing after success

Observation: WebView logs show “closing dialog after 500ms delay”, but behavior may differ.

- [ ] Confirm whether the dialog is truly not closing (or closing behind another note open).
- [ ] Verify window close call path:
  - [ ] correct `windowId` / customId
  - [ ] close is invoked after success
  - [ ] no form error / AI analysis state prevents close
- [ ] If needed, add a single debug marker right before the close invocation and right after.

## Side issue — NotePlan crash after successful form submission (network stack)

**Date**: 2026-01-28 15:02:15

**Crash details**:
- **Type**: `EXC_BAD_ACCESS (SIGSEGV)` — segmentation fault
- **Thread**: `com.apple.network.connections` (background network thread)
- **Location**: `__NSCFLocalDownloadTask dealloc` → `NWConcrete_nw_path_evaluator dealloc`
- **Cause**: Null pointer dereference (`0x0000000000000020`)

**Interpretation**:
- This is **NOT related to TemplateJS execution** (form submission succeeded, note was created).
- Crash occurs during network stack cleanup/deallocation, likely from:
  - Cloud sync activity
  - Plugin HTTP requests (`np.Templating` or other plugins)
  - Background network operations completing/cancelling
- This is a **NotePlan/macOS network framework bug** (memory management issue during deallocation).

**Action items**:
- [ ] Check if crash reproduces without our plugin code (baseline NotePlan behavior).
- [ ] Check if any plugins are making HTTP requests during/after form submission.
- [ ] If reproducible, report to NotePlan team as a network stack crash (separate from TemplateJS hang).

