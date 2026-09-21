# Daily Review: window stays open after Save

Status: open (investigated 2026-09-19; source not in this repo yet)
Plugin: `jgclark.PeriodicReviews` v2.0.0.b16-beta
Command: Daily Review (`dailyReviewQuestions` → `onReviewWindowAction`)
Observed: answers wrote correctly to the Journal heading; floating review window did not dismiss.

When source is available again, use this note to pick up the fix. Only the bundled `script.js` is in NP-plugins today; `jgclark.Journalling/` has CHANGELOG only.

---

## Symptom

Press Save in the Daily Review floating window:

- Review answers are appended to the calendar note (heading `Journal`) correctly.
- Planning tasks write to the next period note correctly.
- The window remains open.
- Extra Save clicks do nothing.

## Log evidence (2026-09-19)

Use `nplog` (never grep the raw log):

```bash
node scripts/nplog/nplog --json --mode 5 'closePeriodicReviewWindow'
node scripts/nplog/nplog --json --mode 3 'submitReview\(\) called'
node scripts/nplog/nplog --json --mode 3 'hasSentReviewAction'
```

Timeline:

| Time (local) | What |
| --- | --- |
| 23:52:00 | `dailyReviewQuestions` starts |
| 23:52:33 | Floating window opens (`customId=jgclark.PeriodicReviews.period-review`, id `03B0493D-...`) |
| 23:52:33 | WebView: `submitReview()` → jsBridge → `Executing function 'onReviewWindowAction'` |
| 23:52:33 → 23:57:47 | ~5 min gap before `action=submit` (shared JSContext busy; CloudKit sync spam present) |
| 23:57:47 | `action=submit`, append to Journal in `20260919`, planning write to `2026-09-20` |
| 23:57:47 | `closePeriodicReviewWindow: closed window customId='jgclark.PeriodicReviews.period-review'` |
| 23:57:47 | `Journalling/onReviewWindowAction :: Finished.` |
| 23:57:47 | WebView still alive: more `submitReview()` calls stopped by `hasSentReviewAction is true` |

No PeriodicReviews ERROR on the submit path. Close was called and logged as success; the WebView kept running afterward, so `.close()` did not actually dismiss the window.

---

## Root cause (working theory)

1. **False-success close**  
   `closePeriodicReviewWindow()` finds the window, calls `windowToClose.close()`, logs success, and returns. It never checks that the window is gone (`isVisible` / `isHTMLWindowOpen` / customId lookup after close).

2. **Close from inside a same-window jsBridge invoke**  
   Review HTML prefers `webkit.messageHandlers.jsBridge` → `DataStore.invokePluginCommandByName('onReviewWindowAction', ...)` over x-callback. That nests Save on the shared plugin JSContext. Calling `HTMLView.close()` on the invoking window from inside that nested command appears unreliable (logged close, UI still up).

3. **Close is not the last step**  
   On submit, close runs after `writeAnswersToNote` but before `writePlanningTasksToNextPeriodNote` finishes.

4. **Possible early Save at open**  
   `submitReview()` fired at 23:52:33 as the window appeared (click-through plausible). `hasSentReviewAction` then locked further submits. Later user Save presses were no-ops while the first invoke was still stuck / completing.

5. **CHANGELOG vs shipped HTML mismatch**  
   `jgclark.Journalling/CHANGELOG.md` says review callbacks switched to `noteplan://x-callback-url/runPlugin`. The bundled HTML still prefers jsBridge when available (x-callback is fallback only), with a comment about avoiding URL length limits for large payloads.

---

## Code map (bundled `jgclark.PeriodicReviews/script.js`)

Locations below are for the investigated bundle; line numbers will drift after rebuild.

| Piece | What to find |
| --- | --- |
| Open window | `dailyReviewQuestions` → `processReviewQuestions` → `showHTMLV2` with `customId` `jgclark.PeriodicReviews.period-review` |
| Save / cancel / refresh | `onReviewWindowAction` |
| Write answers | `writeAnswersToNote` |
| Close | `closePeriodicReviewWindow` → `getWindowFromCustomId` → `.close()` |
| Planning after save | `writePlanningTasksToNextPeriodNote` |
| WebView Save | Inline HTML: `submitReview` → `sendToPlugin` (jsBridge first) + `hasSentReviewAction` lock |

Submit path shape (bundle):

```javascript
// after writeAnswersToNote...
if (isSubmit) {
  closePeriodicReviewWindow() // mid-handler; false success logged
}
await writePlanningTasksToNextPeriodNote(...)
// Finished.
```

WebView transport shape (bundle):

```javascript
// Primary: jsBridge → invokePluginCommandByName (same JSContext)
// Fallback: noteplan://x-callback-url/runPlugin
if (locksForm && hasSentReviewAction) return // blocks later Saves
```

---

## Fix plan (when source is available)

Do these in order; re-test after each if possible.

1. **Prefer x-callback for submit/cancel** (match CHANGELOG). Keep jsBridge only if payload size forces it; if so, still close via a separate mechanism that is not nested in the same invoke.
2. **Close last** - after all writes succeed (`writeAnswersToNote` and `writePlanningTasksToNextPeriodNote`).
3. **Verify close** - after `.close()`, confirm the window is gone; if not, retry by UUID/`customId`, or fire a tiny close-only command via `NotePlan.openURL` (avoid raw `new Promise` on NotePlan Beta; use promise polyfills if needed).
4. **Guard open-time click-through** - briefly disable Save on load (~300–500ms), or ignore submit for a short window after HTML load.
5. **Do not rely on `hasSentReviewAction` alone for UX** - if close fails, unlock or show an error so the user is not stuck with a dead Save button on an open window.

Optional diagnostics while fixing:

- Log window `id` / `customId` / `isVisible` before and after `.close()`.
- Log whether submit arrived via jsBridge or x-callback.
- Temporary `[DIAG]` around close + post-close window list.

---

## How to re-test

```bash
CURSOR=$(node scripts/nplog/nplog --mark)
# Run Daily Review in NotePlan, fill answers, press Save once
node scripts/nplog/nplog --since "$CURSOR" --follow --wait-idle 5 --json
```

Success criteria:

- Journal (and planning, if any) written.
- Log shows close attempt **and** no further WebView `submitReview` / `hasSentReviewAction` activity from that window.
- Window is visually gone.
- A second Save is not needed / not possible because the window closed.

---

## Out of scope / unresolved

- Whether `HTMLView.close()` from a jsBridge-invoked command is a NotePlan API limitation (confirm with Eduard / `@flow-typed/Noteplan.js` if needed).
- Whether the 23:52:33 submit was click-through vs a load-time handler bug (payload had full answers; could be pre-fill).
- CloudKit `CKError` spam during the stall is NotePlan sync noise, not the review handler throwing.
- No code fix applied in this investigation; rebuild with `npc`, not `npm run build`.
