# What's changed in  Periodic Reviews Plugin?
_Please also see the [Plugin Documentation](https://noteplan.co/plugins/jgclark.DailyJournal/)._

Note: this is a new plugin, forked from my original **Journalling Helpers** one. That will remain available for users who need to run NotePlan 3.19 or earlier -- which doesn't support integrated plugin windows -- but will be retired in due course.

## [2.0.0.b13] - 2026-04-26
- New setting: **Big task marker style** to switch big-task/win markers between `>>` (priority 4), `!!!` (priority 3), and `!!` (priority 2).
- Big-task/win detection in review summaries now follows this setting (still counting `#win` / `#bigwin` as wins).
- Plan-item carry-over fallback matching now follows the configured marker priority (instead of always assuming `>>` / priority 4).
- Planning-line normalization now strips any of `>>`, `!!!`, or `!!` when pasted into the planning textarea.
- Removed **Planned items prefix** setting; planning lines written to the next-period note now always use the configured **Big task marker style** marker.

## [2.0.0.b12] - 2026-04-26
- Review write-back: for `<string>` or mixed typed lines (for example duration/int/boolean combinations on one template line) now upsert to the existing matching line in the review section. Note: unchecked booleans explicitly clear previously written boolean tokens on that line.
- Review summary: completed-task lists now show only for daily/weekly reviews; monthly, quarterly, and yearly reviews no longer render completed-task blocks.
- Tweaks to layout in Summary areas.
- dev: Removed quarter-title normalization in review helpers and switched review flow to pass raw period titles directly for note matching and summary period boundary lookups.

## [2.0.0.b11] - 2026-04-20
- Make the details in the summary sections 
collapsible
- Fix so that review commands no longer switch the editor to the “current” period’s note when you already have another calendar note of that same kind open (for example, yesterday’s daily note stays open instead of jumping to today).

## [2.0.0.b10] - 2026-04-13
- Review window **Summary**: completed-task list(s) and the calendar events list are each wrapped in HTML `<details>` / `<summary>` (expanded by default) so you can collapse the lists while keeping the headings visible.
- New optional settings **Planned items prefix** (default `>>`) and **Planned items suffix** (default `#win`) for text written with each planned item into the **next** period’s calendar note.
- Review window submit: do not log “no template question answers” when the user only filled the **planning** textarea (next-period plan lines still count as a substantive submit).
- Review window callback: `onReviewWindowAction` now **returns `{}`** on every path when invoked via `DataStore.invokePluginCommandByName` (required by NotePlan; missing return can stop the handler after the “Executing function” log). Normalize a single-array bridge payload `[actionName, payload]` when needed; bail out cleanly if settings fail to load.

## [2.0.0.b9] - 2026-04-11
- settled on name 'Periodic Reviews' not 'Journalling & Reviews'
- Summary / carry-over plan tasks: include **cancelled** `>>` lines (e.g. `* [-] >> …`); they show as **not** done like open items. Fix: plan-section extraction no longer stopped after the first task under a matching H2.

## [2.0.0.b8] - 2026-04-10
- Review window: Fix `<string>` (and other `<type>` markers) sometimes appearing before the textarea — label text now strips full angle-bracket tokens, not bare type names.
- Review question templates: `<integer>` is accepted as an alias for `<int>`. Simplifying, dropped support for  `<h2>` / `<h3>` question lines.
- Further layout improvements to Summary area
- 

## [2.0.0.b7] - 2026-04-09
- Review summary: Done tasks whose body starts with `>>` (after the task marker and optional `!` priorities) count as **wins** for the period, same as `#win` / `#bigwin`, without needing a “Wins” section. They appear in the same **completed tasks** list as other done items (wins first), not duplicated. **Weekly/monthly/quarterly/yearly** summaries use the same win rules when listing done tasks for the period (even if there are no carry-over plan items).
- Review window: Fix daily summary layout when carry-over plan items exist.
- Review window: Fix heading-only template lines being split by the flex segment matcher, leaving text fragments.
- dev: Refactor review flow — `reviewQuestions.js` (parse / pre-fill / answer output), more helpers in `journalHelpers.js`, slimmer `periodReviews.js`; shared segment regex for HTML + parser; `writeAnswersToNote` is module-private.
- dev: Update Template handling in applyTemplateToNote() to not make any Editor inserts if there's nothing to insert. Aim: avoid race conditions.

## [2.0.0.b6] - 2026-04-04
- `<date>` / `<datenext>` / `<nextdate>` are now substituted in heading and label text taken from parsed questions (e.g. `## Weekly Review for <date>`), not only in the raw template line—so the window matches the period title.
- **Planning vs reviewing:** New settings name planned items per period (daily through yearly, with defaults such as “Big 3 Rocks”, “Top 3 Wins”, etc.). The review window shows a **Summary** block (carry-over plan tasks from this note as open/complete icons, then the usual daily completed-task and event summary). 
- A separate **planning** section after the main form writes an H2 and `>> …` tasks at the start of the **next** period’s calendar note, replacing any existing section with that title. Empty planning clears that section on the next note. That H2 uses `{planName} for {next period title}` (e.g. `Big Rocks for 2026-04-04`), distinct from the review-window “Planned:” / “Planning: … for the next …” labels.
- Added fuller translation of markdown to how its displayed in user's current theme in NP, particularly including Priority markers.
- Open and reference the quarterly calendar note using NotePlan’s title format `YYYY-Qn` not `YYYYQn`.
- Reorganised the settings

## [2.0.0.b5] - 2026-03-31
- Added a new review question type `<duration>` that accepts `[H]H:MM` input (for example `1:05` or `12:30`) in the review window and when writing answers to notes.
- Ensure Question strings are handled case-insensitively
- Added list of events in the day to the summary at the start
- dev: Rename journal.js to periodReviews.js

## [2.0.0.b4] - 2026-03-28
- Split section-heading settings: `dailyJournalSectionHeading` is now used by daily journal commands, and `reviewSectionHeading` is used by weekly/monthly/quarterly/yearly review commands. Existing installs migrate heading values to preserve prior behavior.
- **Review placeholders:** `<date>` is replaced with the current review period’s calendar title (e.g. `2026-03-28`, `2026-W13`, `2026Q1`) in the review window and the output. 
- Added `<datenext>` (alias `<nextdate>`) that's similar to `<date>` but gives the **following** period in the same format (e.g. weekly `2024-W52` → `2025-W01`).
- **Correct calendar note:** The open editor note is only reused when it matches the review command’s period type **and** the same period title (e.g. today for a daily review). Otherwise the plugin opens the intended note.

## [2.0.0.b3] - 2026-03-25
- New review question types: `<bullets>` (each answer line written with a `- ` prefix), `<checklists>` (`+ ` per line), and `<tasks>` (`* ` per line). The review window uses a multi-line field; empty lines are skipped. Answers already in the calendar note are pre-filled with markers stripped.
- Headings in review settings are now output as HTML headings: `<subheading>` outputs an `<h3 class="review-subheading h3">...`, and literal `##` / `###` lines in settings are carried through as `<h2>` / `<h3>` with `review-subheading` classes.
- `<date>` placeholder is now supported in review question lines and is substituted with the relevant calendar period title in the review window and in saved output.

## [2.0.0.b2] - 2026-03-24
- When opening the review window, answers already present in the calendar note are pre-filled in the matching controls (under your **Review section heading** when that heading exists; otherwise the whole note is scanned). Latest matching paragraph wins so you can edit the most recent review block.
- Added a period summary list above review questions: daily shows Dashboard-style completed tasks from changed notes for that day, and week/month/quarter/year show only in-period done items tagged `#win` or `#bigwin`, rendered with multi-column circle-check entries. Period boundaries use `getFirstDateInPeriod` / `getLastDateInPeriod`; task text uses the same HTMLView conversion helpers as note HTML export (hashtags, mentions, links, etc.). Summary lines omit the `@done(…)` stamp for readability.
- Calendar event counts and timed duration in the summary use **EventHelpers** settings (`getEventsSettings`) and the same per-day `getEventsForDay` loop as EventHelpers’ `listDaysEvents`, with deduping for multi-day items.

## [2.0.0.b1] - 2026-03-24
### New
- The **daily/weekly/monthly/...Review** commands now ask all their questions in a single window and writes answers to the review section in the usual format. It lays out the questions and spaces for answers as it will be added into the note, according to your settings.
- As usual for my plugins, this picks up colours and fonts from your current NP Theme.
- Added a `Review Window type` setting to choose the style of review window to use: 'New Window' for a separate window; 'Main Window' to take over the main window; 'Split View' for a split view in the main window.
- Added `Open the calendar note when reviewing it?` setting (default: `true`) so review commands no longer ask the opening question.
- The settings for review questions now no longer needs to have ` || ` delimiters.
- It will migrate settings from the old **Journalling Helpers** plugin on first install.

### Fixed
- Fixed a single-window review callback bridge bug that generated extra quotes around `DataStore.invokePluginCommandByName(...)`, causing a runtime JavaScript `SyntaxError` when submitting or cancelling.
- Fixed duplicate/late review-window callbacks by making the HTML bridge one-shot and safely no-op when `DataStore.invokePluginCommandByName` is unavailable in the current JS context.
- Switched single-window review form callbacks to `noteplan://x-callback-url/runPlugin` and added payload JSON parsing in `onReviewWindowAction`, avoiding WebView `DataStore` runtime availability issues.
