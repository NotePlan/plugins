# What's changed in 💭 Journalling  & Reviews Plugin?
_Please also see the [Plugin Documentation](https://noteplan.co/plugins/jgclark.DailyJournal/)._

Note: this is a new plugin, forked from my original **Journalling Helpers** one. That will remain available for users who need to run NotePlan 3.19 or earlier -- which doesn't support integrated plugin windows -- but will be retired in due course.

## [2.0.0.b4] - 2026-03-26
- ??? Get the comms working back from the review window

## [2.0.0.b3] - 2026-03-25
- New review question types: `<bullets>` (each answer line written with a `- ` prefix), `<checklists>` (`+ ` per line), and `<tasks>` (`* ` per line). The review window uses a multi-line field; empty lines are skipped. Answers already in the calendar note are pre-filled with markers stripped.
- Headings in review settings are now output as HTML headings: `<subheading>` outputs an `<h3 class="review-subheading h3">...`, and literal `##` / `###` lines in settings are carried through as `<h2>` / `<h3>` with `review-subheading` classes.
- `<date>` placeholder is now supported in review question lines and is substituted with the relevant review note title string in both the window and output.

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
