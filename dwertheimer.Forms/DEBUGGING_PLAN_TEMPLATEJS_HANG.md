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

