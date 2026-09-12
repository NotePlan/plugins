The Calendar and Linear Calendar plugins now use one event editor, maintained in `editor.js` with the native API adapter in `bridge.js`. Both plugins ship as standalone `script.js` files; the generator embeds the shared functions and injects them into each HTML view. Run `node scripts/calendar-editor/build.js` after editing the shared source. `--check` detects stale bundles without modifying files.

The design follows the supplied Add Event screenshot and BlockNote's `apps/web/src/components/calendar/EventDialog.tsx`: a prominent heading, outlined title/location/date fields, plain label/value rows, a blue focus ring, and equal-width Cancel and orange Add/Save actions. URL and notes keep accessible labels. Custom recurrence opens a separate screen within the editor, with Done/Escape returning to the draft; covered fields are inert and recurrence errors stay on that screen. Existing availability and event time zones are preserved without extra controls. New drafts reuse the last successfully saved calendar when it remains writable; embedded views without storage retain that preference for the current view. The same editor supports light/dark appearance, narrow screens, keyboard focus containment, Cmd/Ctrl+Enter, explicit deletion, unsaved-change confirmation, and inline validation or bridge failures.

The original editors had structural and behavioral gaps beyond their styling. Linear Calendar always saved `isAllDay: true`, even for timed events; Calendar closed the draft after a failed write and could not clear notes. Both retrieved recurring events by ID alone, which can select the series master rather than the clicked occurrence. Linear Calendar also deduplicated by title/start instead of identity. These paths now use the shared editor and original occurrence identity; all-day display dates round-trip to exclusive end dates, and the week/day time grid creates a timed draft at the clicked slot.

| Field or behavior | Current implementation |
| --- | --- |
| Title, location, calendar, notes, URL | Editable; calendar identity uses IDs, including identical names across accounts |
| All-day and timed events | Inclusive date UI, exclusive all-day end on save; local time inputs preserve duration when moving the start |
| Repeat presets | Daily, weekly, monthly, yearly |
| Custom daily/weekly | Every N days/weeks; select one or more weekdays |
| Custom monthly | Every N months; select dates, or first/second/third/fourth/last weekday |
| Custom yearly | Every N years; select months; use the start-date day or an ordinal weekday |
| End repeat | Never, on a date, or after a number of occurrences |
| Existing complex rules | Preserved unless explicitly replaced; unknown combinations are not flattened into a simpler rule |
| Edit/delete a recurring event | This occurrence or this and future occurrences; repeat changes require future scope |
| Alerts | Up to two relative alerts; custom existing offsets retained; absolute/location/more-than-two alarms preserved and shown as managed in Apple Calendar |
| Invitees | Display names only; invitations remain in Apple Calendar |
| Availability and time zones | Existing values preserved; times displayed in the device zone |
| Travel time, attachments, invitation management, time-zone selection | Remain in Apple Calendar; full Apple Calendar parity is not claimed |

The native implementation is in `~/Projects/today/Shared/Integrations/JavaScript/Interfaces/CalendarBridge.swift`, with HTML serialization in `Shared/Utils/HTMLViewController+NotePlanAPI.swift`. These changes must be built into NotePlan before the advanced editor fields become available. The native project contains unrelated pre-existing working changes, which this work leaves intact. Existing `Calendar.add/update/remove` callers retain their legacy contract.

The versioned contract is:

- `await Calendar.eventEditorCapabilities()` returns `{version: 1, recurrenceRules: true, occurrenceScopes: ['this', 'future'], alertOffsets: true, location: true, availability: true, calendarID: true}`. The adapter actually invokes the method: HTML bridge proxies make `typeof Calendar.someMethod` unsuitable for capability discovery.
- `await Calendar.eventForEditing({id, originalStartDate, originalCalendarID})` resolves the exact occurrence in its original calendar and start-time window. It rejects missing or ambiguous matches.
- `await Calendar.saveEvent({...fields, id?, originalStartDate?, originalCalendarID?, scope?, recurrenceRules?, alertOffsets?})` returns a serialized calendar item. Existing recurring events require scope `this` or `future`. Fields include title, date, endDate, isAllDay, calendarID, notes, URL, location, and availability. Dates are Date objects or ISO timestamps.
- `await Calendar.removeEvent({id, originalStartDate, originalCalendarID, scope?})` returns true on success. Recurring events require scope.
- Omitting `recurrenceRules` preserves all existing rules. `[]` explicitly removes repetition. A single rule uses frequency `daily|weekly|monthly|yearly`, positive interval, optional daysOfWeek (`{dayOfWeek: 1..7, weekNumber: 0|ordinal}`), daysOfMonth, monthsOfYear, and either endDate or occurrenceCount. Sunday is 1. EventKit-incompatible combinations are rejected rather than silently ignored. Yearly rules use the start day or selected weekdays; EventKit documents daysOfTheMonth as monthly-only.
- Omitting `alertOffsets` preserves all alarms. `[]` removes them; values are seconds relative to the start, negative for before. Unchanged custom alarms are never rewritten merely because another field changed.

Older NotePlan versions use the basic legacy API. Recurrence remains read-only; location controls and alert editing are unavailable. This avoids presenting unsupported fields as successfully saved. Existing non-HTTP event links can be retained; unsafe newly entered script/data URLs are rejected.

Validation: `TZ=America/New_York node --test scripts/calendar-editor/editor.test.cjs` passes 24 checks covering the shared editor and both complete plugin HTML views against a synthetic bridge. Targeted ESLint and bundle freshness checks pass. Browser previews use synthetic data only and were inspected at desktop and 390px widths. Generate them with `node scripts/calendar-editor/preview.js`; they never access real calendars.

Four native recurrence conversion tests were added to the existing `NotePlanTests/PluginTests.swift` target. They do not touch real calendars. Native compilation and tests have not been run: the native repository's AGENTS.md requires an explicit user request. Real EventKit persistence, server-specific recurrence behavior, this/future series splitting, and HTML bridge round-trips still require verification in the updated app before release. Tracking: native Beads issue `today-sxi`.

The event-editor work does not change the calendars' broader filtering model (which still keys visibility by calendar title), fully refactor the monolithic calendar renderers, or replace their progressive loading architecture. Those are separate general-review opportunities.

References: [Apple repeating events](https://support.apple.com/guide/calendar/icl1018/mac), [NotePlan plugin API](https://help.noteplan.co/article/70-javascript-plugin-api), and the installed EventKit SDK's EKRecurrenceRule.h. The API additions above are local implementation changes, not features claimed by the published NotePlan reference.
