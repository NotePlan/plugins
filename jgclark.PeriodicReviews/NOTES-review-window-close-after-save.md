# Daily Review: window stays open after Save

Status: fixed in `2.0.0.b17`–`b19` (close path + WebView transport; 2026-09-22)
Plugin: `jgclark.PeriodicReviews`
Command: Daily Review (`dailyReviewQuestions` → `onReviewWindowAction`)

Originally observed: answers wrote correctly to the Journal heading; floating review window did not dismiss.

---

## Symptom (pre-fix)

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
   Earlier CHANGELOG said review callbacks switched to `noteplan://x-callback-url/runPlugin`. The HTML still preferred jsBridge when available (x-callback is fallback only), with a comment about avoiding URL length limits for large payloads.

---

## Fix applied (2.0.0.b17–b19)

Source: `jgclark.PeriodicReviews/src/`

1. **WebView transport** - jsBridge is primary. Preferring `window.location.href = noteplan://…` fails in HTMLView with `NSURLErrorDomain -1002 unsupported URL` (seen 2026-09-22). x-callback remains fallback only when jsBridge is absent.
2. **Close last** in `onReviewWindowAction` - after `writeAnswersToNote` and `writePlanningTasksToNextPeriodNote`.
3. **Verify close** in `closePeriodicReviewWindow` - re-find window after `.close()`; retry by window id; if still open, schedule hidden `closePeriodicReviewWindow` command via `NotePlan.openURL` (plugin-side; not WebView location.href).
4. **Guard open-time click-through** - Save/Cancel disabled for `CLICK_THROUGH_GUARD_MS` (400ms) after load; early submit/cancel ignored.
5. **Unlock if close fails** - WebView clears `hasSentReviewAction` and re-enables buttons after `UNLOCK_IF_STILL_OPEN_MS` (4s) if the page is still alive.

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

Rebuild with `npc plugin:dev jgclark.PeriodicReviews -c` (not `npm run build`).
