# What's changed in 💭 Journalling  & Reviews Plugin?
_Please also see the [Plugin Documentation](https://noteplan.co/plugins/jgclark.DailyJournal/)._

Note: this is a new plugin, forked from my original **Journalling Helpers** one. That will remain available for users who need to run NotePlan 3.19 or earlier -- which doesn't support integrated plugin windows -- but will be retired in due course.

## [2.0.0.b1] - 2026-03-23
### Added
- The **daily/weekly/monthly/...Review** commands now ask all their questions in a single window and writes answers to the review section in the usual format. It lays out the questions and spaces for answers as it will be added into the note, according to your settings.
- As usual for my plugins, this picks up colours and fonts from your current NP Theme.
- Added a `Review Window type` setting to choose the style of review window to use: 'New Window' for a separate window; 'Main Window' to take over the main window; 'Split View' for a split view in the main window.
- Added `Open the calendar note when reviewing it?` setting (default: `true`) so review commands no longer ask the opening question.
- The settings for review questions now no longer needs to have ` || ` delimiters.

### Fixed
- Fixed a single-window review callback bridge bug that generated extra quotes around `DataStore.invokePluginCommandByName(...)`, causing a runtime JavaScript `SyntaxError` when submitting or cancelling.
- Fixed duplicate/late review-window callbacks by making the HTML bridge one-shot and safely no-op when `DataStore.invokePluginCommandByName` is unavailable in the current JS context.
- Switched single-window review form callbacks to `noteplan://x-callback-url/runPlugin` and added payload JSON parsing in `onReviewWindowAction`, avoiding WebView `DataStore` runtime availability issues.
