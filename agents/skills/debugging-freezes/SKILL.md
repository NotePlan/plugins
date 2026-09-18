---
name: debugging-freezes
description: >-
  Debug NotePlan plugin freezes and infinite loops when the app hangs, the
  WebView stops updating, or logDebug/logInfo stop flushing. Use when the user
  reports a freeze, hang, infinite loop, or "NotePlan is stuck", or when React
  memoization / request-router loops are suspected.
---

# Debugging infinite loops and freezes

Do not rely only on `logDebug` / `logInfo` when NotePlan freezes. The plugin
console can buffer logs, and if the JSContext hangs the last useful line may
never flush.

## Isolate the side

First decide whether the loop is React/WebView-side or plugin-side. Add sequence
IDs and active counters around:

- field changes and React effects
- REQUEST creation, router entry/exit
- backend handlers

## Plugin-side freezes

Add temporary hidden diagnostic commands in `plugin.json` and call them with
x-callback URLs, e.g.:

```text
noteplan://x-callback-url/runPlugin?pluginID=np.Shared&command=shared%3AtemporaryProbe&arg0=...&arg1=...
```

Prefer early-return checkpoints over logs. Return a `showMessage()` or structured
success response after each checkpoint (`after-start`, `after-filter`,
`after-convert`, etc.) so each run proves the next section completed.

Binary-search expensive loops with diagnostic params such as `start` and `limit`.
If a full conversion freezes but `limit=10` returns slowly, treat it as a
performance stall rather than a request-loop bug.

## Hygiene

Keep diagnostics temporary and clearly marked (`[DIAG]`, hidden command,
debug-only params). Once the root cause is fixed, remove or gate noisy logging
and hidden commands unless the user wants them kept for follow-up testing.

## Related pitfalls

- For chooser note loading, `getNoteDecorationForReact()` can be expensive across
  calendar-note lists; pass `includeDecoration: false` when the React component
  derives display decoration itself.
- React infinite loops from unstable function props: see
  `agents/docs/react-html.md` (useCallback / AppContext useMemo).
- After a change, confirm with the nplog skill (`agents/skills/nplog/SKILL.md`).
