# Adopting `getOpenEditorNote()` across plugins

Plan captured 2026-08-31 after adding shared helpers in `@helpers/NPEditor.js` (Periodic Reviews split-view / sidebar focus fix).

## Shared helpers

| Function | File | Role |
|----------|------|------|
| `getNoteFromEditorWindow(editorWindow)` | `helpers/NPEditor.js` | Resolves `Editor.note`, with calendar fallback when `.note` is unset |
| `getOpenEditorNote(options?)` | `helpers/NPEditor.js` | Uses global `Editor` when it matches; otherwise scans `NotePlan.editors`. Options: `noteType`, `matchNote`, `preferSelection` |
| `getOpenEditorNoteForReview(periodType?)` | `jgclark.PeriodicReviews` | Thin wrapper; filters by calendar period kind |

Related existing helpers (different job - find pane by filename, not “best current note”):

- `getOpenEditorFromFilename()` / `isNoteOpenInEditor()` in `helpers/NPEditor.js`
- `isEditorWindowOpen()` / `findEditorWindowByFilename()` in `helpers/NPWindows.js`

## Problem these helpers solve

1. **`Editor.note` null** on calendar notes - `Editor` itself can still be the note.
2. **Split + sidebar** - clicking a sidebar command can move focus to another pane (often left / non-calendar) before the plugin runs, so global `Editor` is wrong while the intended note remains open in another split.

Command bar launches usually keep the correct focus; sidebar launches are where this shows up.

---

## High value (same failure mode as Daily Review)

These assume global `Editor` / `Editor.note` is the calendar (or “current”) note. Sidebar click in split view can mis-detect and open/write the wrong note.

| Plugin | Location | Why / approach |
|--------|----------|----------------|
| **jgclark.EventHelpers** | `src/eventsToNotes.js` → `validateEditorState()` | Requires `Editor.note` + calendar/daily/weekly. Use `getOpenEditorNote({ noteType: 'Calendar', matchNote: … })`. |
| **jgclark.PeriodicReviews** | `src/templatesStartEnd.js` → `ensureCorrectNoteOpen()` | Uses `Editor.note && isNoteType(Editor.note)`; otherwise opens today. Same split bug as the review command. |
| **jgclark.DailyJournal** | `src/templatesStartEnd.js` → same pattern | Duplicate of Periodic Reviews helper. |
| **np.MeetingNotes** | `src/NPMeetingNotes.js` → `getNoteFromEditor()` for `<current>` | Local helper only checks `Editor.note` and throws if null. Replace with `getOpenEditorNote()` / `getNoteFromEditorWindow(Editor)`. |
| **np.Templating** | `lib/support/modules/NoteModule.js` → `getCurrentNote()` / `currentNote()` | Template current-note APIs use `Editor.note` only. Calendar null-`.note` and wrong-pane cases both apply. |

---

## Medium value (“operate on current note” commands)

Worth adopting for null-`Editor.note` and wrong-pane after sidebar; less calendar-specific. Plain `getOpenEditorNote()` (no filter) is usually enough.

| Plugin | Examples |
|--------|----------|
| **jgclark.Filer** | `moveCompletedToDone.js`, `archive.js` - `Editor.note` only |
| **jgclark.NoteHelpers** | `addItemToFrontmatter`, `addFrontmatterToNote`, logging helpers - fail if `!Editor.note` |
| **jgclark.Summaries** | `stats.js` `handleCurrentNoteOutput`, `progress.js` refresh path |
| **np.statistics** | `showWordCount.js`, `taskNoteStats.js` |
| **np.CallbackURLs** | `NPOpenLinks.js` - open todo links |
| **jgclark.NoteHelpers** | `unlinkedNoteFinder.js`, `duplicateNote.js` |

---

## Partial / different helper needed

| Plugin | Why not a straight swap |
|--------|-------------------------|
| **jgclark.Dashboard** `getParagraphsFromCalendarNotes` | Needs **live paragraphs from the open pane**, not only the note object. Prefer `getOpenEditorFromFilename(note.filename)` then that editor’s `.paragraphs`. `getNoteFromEditorWindow` helps the null-`.note` case. |
| **jgclark.Reviews** `projectClass.js` | “Is this note open?” vs `Editor.note.filename`. Better: `getOpenEditorFromFilename` / `isNoteOpenInEditor`. |
| **jgclark.Dashboard** / **Reviews** `countDoneTasks` etc. | Same filename-match-in-editors pattern. |

---

## Leave alone (triggers)

These intentionally target the **Editor that fired** the save/open hook. Scanning other splits would be wrong:

- `jgclark.Dashboard` `dashboardHooks.js` → `onEditorWillSave`
- `jgclark.SearchExtensions` `searchTriggers.js`
- `jgclark.RepeatExtensions` `repeatTrigger.js`
- `jgclark.WindowTools` `WTHelpers.js` → `onEditorWillSave`
- `np.Preview` `previewTriggers.js`

Optional: use `getNoteFromEditorWindow(Editor)` only for the null-`.note` calendar case **without** scanning other panes (`preferSelection` / no editors scan - or call `getNoteFromEditorWindow` directly).

---

## Suggested implementation order

1. **EventHelpers** `validateEditorState` - highest shared payoff for calendar commands
2. **PeriodicReviews / DailyJournal** `ensureCorrectNoteOpen` - same UX as the review fix
3. **np.MeetingNotes** + **np.Templating** `NoteModule` - replace local “current note” helpers
4. Filer / NoteHelpers / Summaries / statistics - opportunistic “current note” cleanup
5. Dashboard / Reviews - use `getOpenEditorFromFilename` (+ `getNoteFromEditorWindow`), not `getOpenEditorNote` alone

## Tests

- Shared behaviour: `helpers/__tests__/NPEditor.test.js`
- Periodic Reviews period filter: `jgclark.PeriodicReviews/__tests__/periodReviews.test.js`

## Already done

- Periodic Reviews review commands use `getOpenEditorNoteForReview(periodType)` → `getOpenEditorNote({ matchNote })`.
- CHANGELOG note under Periodic Reviews **2.0.0.b16**.
