# What's changed in 🔬 Projects + Reviews plugin?
See [website documentation for more details](https://noteplan.co/plugins/jgclark.Reviews), and how to configure it to suit your workflow.

## [2.0.0.b29] - 2026-05-02
- fix "finish review" operations failing to find the project note open in a split window. [dev: `finishReview` now resolves the note via `getFirstRegularNoteAmongOpenEditors` (scans `NotePlan.editors`).]
- dev: fixed Rollup circular dependency: moved TSV migration logging to `migrationLog.js` so `reviewHelpers` no longer imports `migration.js`.
- Clicking on a note title in the Rich Project List now re-uses an existing split view wherever possible. [dev: opening a project from the title link, dialog note name, review icon, or content link now goes through `openNoteInSplitViewIfNotOpenAlready` (focus if already open; version-aware `reuseSplitView` / `splitView` when opening a new split).]

## [2.0.0.b28a] - 2026-05-02
- fix embedded-metadata migration: combined `project`/`metadata` lines with `@start` / `@review` / `@reviewed` etc. now write separate YAML keys even when mention prefs are unset or values were already read from `note.mentions` (previously the combined line could become hashtags-only and drop dates).

## [2.0.0.b28] - 2026-05-01
- new command **migrate all projects**: batch-runs `Project` constructor migration on every note that matches current list settings; appends rows to `migration_log.tsv` in the plugin data directory.
- New **convert to project** command which converts any regular note into a project. It shows user a form to fill in, asking for project tag, start date, due date, last reviewed date, review interval, aim, etc. It updates the note adding the answers into the frontmatter. (Requires NotePlan v3.21+.)

## [2.0.0.b27] - 2026-04-30 (released)
- added 'N projects' count to the top bar
- dev: simplify `projectClass` by extracting reusable helpers to `projectClassHelpers.js` and immutable calculation logic to `projectClassCalculations.js`
- dev: simplify `projects.js` complete/cancel closeout flow by extracting shared action logic, normalizing closeout defaults/parsing, and fixing a `submitted` form-result typo
- dev: simplify `reviews.js` by extracting shared folder-heading formatting, centralizing output-style render dispatch, and consolidating display-filter toggle handlers

## [2.0.0.b26] - 2026-04-30
- fix finish review flow to always remove the `nextReview` frontmatter field when a review is completed
- fix complete/cancel project flow to remove legacy body metadata line from the writable note instance after frontmatter update, avoiding stale duplicate metadata and runtime errors
- allow complete/cancel project form to be dismissed without stopping the rest of the processing.

## [2.0.0.b25] - 2026-04-29 (released)
- change: Project metadata precedence now prefers YAML frontmatter (separate keys and embedded mentions in the combined `project`/`metadata` key) over legacy body metadata lines when constructing `Project` instances.
- update "skip review" and "set new review interval" logic to use the newer FM-preferring updaters
- fix to unpause not removing `#pause` tag from FM

## [2.0.0.b24] - 2026-04-29
- fix race in `finishReview`: when migrating metadata in an open editor, frontmatter/body updates now use the same editor object so `Editor.save()` no longer wipes frontmatter
- fix frontmatter migration side-effect: adding YAML `title:` no longer removes the note's body H1 heading
- address cause of "can't update dashboard for some reason" log error
- remove hidden setting `writeDateMentionsInCombinedMetadata`; date/interval metadata now persists via separate YAML keys, while `projectMetadataFrontmatterKey` remains tags-only
- add stronger one-time migration logging and behavior for legacy metadata:
  - migrate embedded `@mentions` from combined tags key into separate YAML keys, then normalize combined key to hashtags-only
  - support multi-line body metadata blocks during migration
  - when metadata is duplicated in both body and frontmatter, frontmatter wins and body mention lines are cleared

## [2.0.0.b23] - 2026-04-26
- When **completing** or **cancelling**  a project a new form is shown that asks:
  - whether to archive the project note?
  - should a note of the completion/cancellation be made in the current Quarterly or Yearly note?
  - is there any final 'progress' comment to make?
- When the displayed Rich project list is updated, it now keeps as close to its current scroll position as possible.
- Fixed race conditions when pausing/completing/cancelling a project that meant the update to the frontmatter was undone.

## [2.0.0.b22] - 2026-04-20 (released)
- fix: setting the 'currently reviewing' state in the Project List stopped the review from starting (thanks, @Garba)
- dev: failed attempt to delete settings.json file if found to be invalid. Discovered there's no need to write a default copy, as the app does this anyway if the file is missing.
- dev: turn down some logging
- dev: revert change to HTMLView::sendToHTMLWindow which Cursor made, and broke things.

## [2.0.0.b21] - 2026-04-19 (released)
- New cache to significantly speed up display of the Project List when a project note hasn't changed since the last run. 
  - dev: regenerating `allProjectsList` reuses cached JSON rows when `note.changedDate` matches stored `noteChangedAtMs` (skips `Project` constructor; still runs `calcReviewFieldsForProject`).
- dev: Attempted to speed up the Project constructor:
  - `Project` constructor batches `DataStore.preference` reads for mention strings and separate frontmatter key names; `parseDateMention` accepts optional resolved mention names to avoid duplicate lookups
  - reuse first `readRawFrontmatterField` result for primary project tag resolution (same combined key)
- dev: confirmed that note's title is not migrated from H1 to frontmatter.

## [2.0.0.b20] - 2026-04-18
- dev: fix small issues found by Cursor
- dev: avoid two calls to getMetadataLineIndexFromBody() in Project constructors
- dev: removed editSettings for iOS (no longer needed)
- add more info to user if settings.json cannot be found
- tighten detection of body metadata to exclude lines starting `#`
- ??? think about a better time to do the migration of files

## [2.0.0.b19] - 2026-04-16
- **Finish review** uses the focused editor (`Editor.note`), not the first window in `NotePlan.editors`, so the correct note is updated when multiple editors are open.
- Fix error clearing next-review fields
- Stop saving plugin settings from opening the Project List window if it wasn't already open.
- Fix **Finish review** (and other metadata updates) when project metadata lives only in YAML frontmatter: `@reviewed(...)` and related edits now target the frontmatter `project:` line, not only a body metadata line.
- dev: `isProjectNoteIsMarkedSequential()` now uses `getProjectMetadataLineIndex()` when scanning the metadata line so `#sequential` is detected on the YAML `project:` line when there is no body metadata line.

## [2.0.0.b18] - 2026-04-15
- dev: In `Project` construction, when metadata exists in both frontmatter and note body, the body metadata line is now logged at INFO level and removed so frontmatter remains authoritative.
- dev: When metadata exists only in the note body, this is now logged at INFO level and migrated using the standard note/editor migration helpers.
- dev: Rename helper `getOrMakeMetadataLineIndex()` to `getMetadataLineIndexFromBody()`: it now only searches the note body and returns `false` when not found; callers now log DEBUG when body metadata is absent.

## [2.0.0.b17] - 2026-03-14
- **Add progress update** now uses the new Command Bar Form capability to ask for details in one step; older NotePlan versions keep the two separate prompts and always uses today's date in the progress line.

## [2.0.0.b16] - 2026-03-13
- dev: now pauses/unpauses the auto refresh timers when the rich window is hidden by NP
- further layout improvements to top bar and edit dialog when project list displayed in a very narrow window
- remove `nextReview` frontmatter when pausing, completing, or cancelling a project
- change the sorting order for "(first) project tag" to come in the order that they're defined in setting "Project Display order", rather than simple alphabetical order (for @Doug)
- dev: extract `migrateProjectMetadataLineCore` in reviewHelpers.js for Editor vs Note migration paths
- dev: extract `startReviewCoreLogic` in reviews.js for `startReviews`, `startReviewForNote`, and `finishReviewAndStartNextReview`
- dev: when pausing, update reviewed date and remove `nextReview` only; leave other separate frontmatter keys unchanged (full sync still used for complete/cancel/migration). Always apply frontmatter key removals after `updateFrontMatterVars` so `nextReview` is removed even if that helper returns false.
- dev: consolidate `updateProjectMetadata` and `updateFrontmatterMetadataFromFields` into a single method (structured frontmatter + optional plain body paragraph update)

## [2.0.0.b15] - 2026-03-29 (released)
- add "(first) Project tag" as a sort order
- dev: remove .projectTag and instead always use .allProjectTags.
- fix `null% done` when no completed or open tasks.

## [2.0.0.b14] - 2026-03-26
- change default metadata write behavior: project date fields now write to separate frontmatter keys (`start`, `due`, `reviewed`, `completed`, `cancelled`, `nextReview`) instead of being embedded in the combined `project`/`metadata` value.
- nudge base font size down 1pt, to be closer to the NP interface
- tweak the timing on "due soon" and "review soon" indicators
- dev: removed remaining TSV logic

## [2.0.0.b13] - 2026-03-26 (released)
- when invalid frontmatter metadata values are detected (like `review: @review()` or `due: @due()`), automatically remove the affected frontmatter key.
- normalize mention-style date frontmatter values (e.g. `due: @due(2026-03-09)`) to plain date values (`due: 2026-03-09`) during Project constructor processing.
- Handle frontmatter fields in a case-insensitive manner.
- Fix gap at start of topbar if not showing Perspective.

## [2.0.0.b12] - 2026-03-22
- improve multi-column layout
- remove two config settings that should have been removed earlier.
- dev: streamline CSS definitions

## [2.0.0.b11] - 2026-03-20
### Project Metadata & Frontmatter
Project metadata can now be fully stored in frontmatter, either as a single configurable key (project:) or as separate keys for individual fields (start, due, reviewed, etc.). Migration is automatic — when any command updates a note with body-based metadata, it moves it to frontmatter and cleans up the body line. After a review is finished, any leftover body metadata line is replaced with a migration notice, then removed on the next finish.
### Modernised Project List Design
The Rich project list has been significantly modernised with a more compact, calmer layout showing more metadata at a glance.
### New Controls
An "Order by" control has been added to the top bar (completed/cancelled/paused projects sort last unless ordering by title). Automatic refresh for the Rich project list is available via a new "Automatic Update interval" setting (in minutes; 0 to disable).
### Progress Reporting
Weekly per-folder progress CSVs now use full folder paths consistently and include a totals row. This data can also be visualised as two heatmaps — notes progressed per week and tasks completed per week.
### Other
The "Group by folder" now defaults to off.
<!--
## [1.4.0.b10] - 2026-03-20
- Add 'Order by' control to the Filter dropdown menu. Note: completed/cancelled/paused projects are shown last, unless you request ordering by title.

## [1.4.0.b9] - 2026-03-20
- Modernised layout significantly for Rich project list, including add more metadata in a compact and calmer look
- Default for "Group by folder" is now off, for the best look.

## [1.4.0.b8] - 2026-03-16
- When finishing a review, if project metadata is in frontmatter, any existing body metadata line is replaced with the message "Project metadata has been migrated to frontmatter". On the next finish, that message line is removed.

## [1.4.0.b7] - 2026-03-13
- Status lozenge changes
  - Shorten text and add icons
  - Drop lozenges when not further out than 2 weeks
  - Improved colouring, re-using earlier error/warn/info colours
  - Move to column 2 (via hidden setting 'statusLozengesInColumn2')
- Improved alignment of text and icons in column 2
- Fixed bug where a specifically-set theme could pick up the wrong light/dark mode.

## [1.4.0.b6] - 2026-03-12
- New: Weekly per-folder Area/Project progress CSVs now use full folder paths consistently and include a totals row at the bottom of each table.
- New: Weekly per-folder Area/Project progress can now be viewed as two heatmaps (notes progressed per week and tasks completed per week), using data from the CSVs.

## [1.4.0.b5] - 2026-02-27
- Project metadata can now be fully stored in frontmatter as well as in the note body. You have two options:
  - You can now use a configurable frontmatter key name (default `project:`), to store it all in a single value.
  - Or you can use separate frontmatter keys (`start`, `due`, `reviewed`, `completed`, `cancelled`, `review`, `nextReview`).  when they already exist, and keeps them in sync when they are present, without creating new keys for notes that don’t use them.
    - Note: if you have configured different phrases for these strings, they are used instead (without the leading `@` character)
- New: When any command updates a project note that had metadata in the body, it now writes to frontmatter and removes that body line. Migration includes all tags in the metadata line (e.g. `#project` or `#area`) as well as the dates in mentions (e.g. `@due(2026-08-22)`.

## [1.4.0.b4] - 2026-02-26
- New: Automatic refresh for the Project List display (Rich window only). To use this, set the new setting "Automatic Update interval" to the number of minutes. Leave at 0 to turn off.

## [1.4.0.b3] - 2026-02-24
- Dev: Refactor reviews.js significantly to better separate logic from display concerns. Adds new file `reviewsHTMLTemplates.js`.

## [1.4.0.b2] - 2026-02-24
- New: Added a 'Demo' mode, which swaps in a separate `allProjectsDemoListDefault.json` to display details of real (or potentially fictitious) projects for demo.

## [1.4.0.b1] - 2026-02-22
- Change: Rich project list: column 3 (metadata column) now shows review and due status as coloured lozenges, plus project tag(s), #sequential when applicable, and all hashtags from the note's metadata line and frontmatter `project` value. New Project field `allProjectTags` holds this combined list.
- Dev: Project class now uses ISO date strings (YYYY-MM-DD) for startDate, dueDate, reviewedDate, completedDate, and cancelledDate instead of JavaScript Date objects; removes Date/string conversion in constructor, allProjectsListHelpers, and reviewHelpers.
-->

## [1.3.1] - 2026-02-26
- New setting "Theme to use for Project Lists": if set to a valid installed Theme name, the Rich project list window uses that theme instead of your current NotePlan theme. Leave blank to use your current theme.
- Fixed edge case with adding progress updates and frontmatter.

## [1.3.0] - 2026-02-20
### Display Improvements
- Supports opening the Project Lists window in NotePlan's main window on macOS. See Display setting "Open Project Lists in what sort of macOS window?".
- Adds the plugin to the NP Sidebar list of plugins
- Now highlights the project in the list that is currently being reviewed
- Moved the display toggles to a new "Filter…" menu in the top bar, and added "Show next actions?" and "Show paused?" toggles. Other changes to layout at narrower window widths.
- When running in the main window, clicking on a project note now opens it in a split view to the side.
- Added 'Next' review button to top bar.
- Added 'Start' review button to the edit dialogs
- Added an 'Add Task' button to the edit dialog, which asks user for task details, and which heading to add it under.
- Added a count badge to project list rows: shows count of open (non-future) items in a small grey square. Badges only appear for active projects and when counts are greater than zero.
- Smartly truncates long 'next action' lines
- Uses a note's icon in the project list, if set in the note's frontmatter
- Turned back on the automatic updates of Dashboard plugin (if open). [Requires Dashboard v2.4.0 beta 18 or later.]
- Improved the dialog box title (now includes folder and clickable project note name)
- Progress line format now changed to remove colon after date by default (i.e. `Progress: <num>@YYYY-MM-DD <description>`), but existing lines will still be parsed correctly.
- If "display dates?" setting is off, then any progress or next actions lines are shown under the project title, rather than to the side.

### Processing Improvements
- Supports projects in (Team)Space notes, using the settings in the Perspective from Dashboard v2.4 which allows you to specify which (Team)Spaces you wish to include, plus whether or not to include the Private "Space" (all notes not in a Space).
- New 'Sequential' project marker that automatically makes the first open task/checklist in a project note the 'next action'. To set this add the frontmatter `project: #sequential`.
- Improved next action processing: now only the first tagged item is shown; if there are no tagged items and a sequential tag is present in the frontmatter, the first open item is displayed instead.
- New setting "Progress Heading" allows to put a heading wherever you want in a project note for the  `Progress: ...` lines to live. If a note has existing progress lines when this is first set, it will first find them and insert the heading above the lines. (Requested by @Harold.)
- New setting "Also write most recent Progress line to frontmatter?". When turned on this allows the current progress information to be used in Folder Views. (default: off) (for @oak86)
- Pausing or un-pausing on a Project now also updates the `@reviewed()` date
- Stops the 'next action' check from running if the project note is marked as `#sequential`

### Fixed
- Re-wrote finding open project note now there can be multiple Editors open.
- Folder name (including Space name) not being included in project completion list in yearly note
- Progress lines with 100% were parsed as 10%
- Other smaller improvements and fixes (including those reported by @Garba, @Mourique and @Doug)
<!-- - added new **weekly projects progress** command for JGC -->

<!--
## [1.3.0.b12] - 2026-02-16
- Added a count badge to project list rows: shows count of open (non-future) items in a small grey square. Badges only appear for active projects and when counts are greater than zero.
- Added an "Add Task" button to the edit dialog, which asks user for task details, and which heading to add it under.

## [1.3.0.b11] - 2026-02-15
- get display of progress lines working again in the main display, and truncate when too long
- fix for folder name (including Space name) not being included in project completion list in yearly note
- if "display dates?" setting is off, then any progress or next actions lines are shown under the project title, rather than to the side.

## [1.3.0.b10] - 2026-02-14
- Added 'Next' review button to top bar.
- Re-wrote finding open project note now there can be multiple Editors open.
- Fix: Progress lines with 100% were parsed as 10%

## [1.3.0.b9] - 2026-02-11
- New setting "Also write most recent Progress line to frontmatter?". When turned on this allows the current progress information to be used in Folder Views. (default: off) (for @oak86)
- Progress line format now changed to remove colon after date by default (i.e. `Progress: <num>@YYYY-MM-DD <description>`), but existing lines will still be parsed correctly.
- Pausing or un-pausing on a Project now also updates the `@reviewed()` date
- New "Show paused?" toggle in the Filter… menu
- Right-align the toggles in the Filter... menu, suppress re-load when clicking outside the menu when no settings have been changed.

## [1.3.0.b8] - 2026-02-08
- dev: refactor to move most HTML code into separate htmlGenerators.js file
- stop the 'next action' check from running if the project note is marked as `#sequential`
- added new hidden **weekly projects progress** command for JGC
- new 'Display Filter...' menu for the various checkboxes
- improve dialog box title (now includes folder and clickable project note name)
- added new 'Start' review button to the dialog box

## [1.3.0.b7] - 2026-01-24
- improved next action processing: now only the first tagged item is shown; if there are no tagged items and a sequential tag is present in the frontmatter, the first open item is displayed instead.
- turned back on the automatic updates of Dashboard plugin (if open). [Requires Dashboard v2.4.0 beta 18 or later.]
- remove writing to 'Project Generation Log' unless you have DEBUG level logging on (thanks, @timlockridge)

## [1.3.0.b6] - 2026-01-23
- improved messages to users under certain error conditions
- dev: updated semver checking to hopefully remove unnecessary logged errors

## [1.3.0.b5] - 2026-01-20
- new setting "Progress Heading" allows to put a heading wherever you want in a project note for the  `Progress: ...` lines to live. If a note has existing progress lines when this is first set, it will first find them and insert the heading above the lines. (Requested by @Harold.)
- fixed edge case when writing progress lines (thanks, @Mourique)
- fix writing updated metadata wrongly, when using `metadata:` key in frontmatter (thanks, @Doug)

## [1.3.0.b4] - 2026-01-16
- highlight the project in the list that is currently being reviewed
- smartly truncate long next action lines
- use a note's icon in the project list, if set in the note's frontmatter
- trying out some layout tweaks, for better display in narrower Editor windows
- add new `sidebarView` keys to plugin.json
- fix to 'Start Reviews' (thanks, @Garba)

## [1.3.0.b3] - 2026-01-11
- can now display the first open task/checklist in a project note as the 'next action' by adding a new 'Sequential project marker' to its frontmatter (e.g. `project: #sequential`).
- added new display toggle for "next actions"
- tidied up the display of the top bar to more gracefully deal with likely narrow window widths

## [1.3.0.b2] - 2026-01-10
- now supports opening the Project Lists window in NotePlan's main window on macOS. See Display setting "Open Project Lists in what sort of macOS window?".
- when running in the main window, it will now open project notes in a split view to the side.

## [1.3.0.b1] - 2025-12-09
- now supports projects in (Team)Space notes, using the settings in the Perspective from Dashboard v2.4 which allows you to specify which (Team)Spaces you wish to include, plus whether or not to include the Private "Space" (all notes not in a Space).
-->

## [1.2.4] - not released
- improve inter-plugin communication with the Dashboard.

## [1.2.3] - 2025-04-28
- Fixed race condition stopping 'Finish + Next' review from working (thanks, @gdrn).
- Fixed problem in 'Pause Project'

## [1.2.2] - 2025-04-03
- Added workaround for failing API call when using 'Finish + Next' (thanks, Alexandre Jacques)

## [1.2.1] - 2025-04-01
- Under-the-hood changes to suit shared settings with Dashboard plugin.
- Fix % completion not being generated if using progress comments with no estimated %.
- Code refactoring.

## [1.2.0] - 2025-03-19
There are 2 new settings that affect which open tasks/checklists are included in the '% completion' statistic for each project:
- Ignore tasks set more than these days in the future: If set more than 0, then when the progress percentage is calculated it will ignore items scheduled more than this number of days in the future. (Default is 0 days -- i.e. no future items are ignored).
- Ignore checklists in progress? If set, then checklists in progress will not be counted as part of the project's completion percentage.

## [1.1.2] - 2025-03-17
- Fix to Next Actions not being detected in '/finish review' (thanks, @Wook5000)
- DEV: update to use CoreNoteFields, not TNote, where possible

## [1.1.1] - 2025-02-14
### Changes
- Turns off the background refresh of Dashboard plugin after every change to Project List, as it was interfering with changing Perspectives. The Dashboard will still update on its usual 'automatically update' interval without problems.
- If a project note is being processed but doesn't yet have any relevant metadata (specifically at least `@review` or `@reviewed` mention, or at least one project/metadata/review/reviewed frontmatter field), then a very basic metadata line will be added after the note title.

## [1.1.0] - 2025-02-03
### New
- **Supports 'Perspectives' from Dashboard plugin**. If you turn the feature on in settings, the Project List will automatically use the current 'Perspective' definition from the Dashboard plugin to determine which folders are included and excluded.
  - The Dashboard (from v2.1.8) now also tells the Project List window to update when you change Perspective (if you have the window open)
- where you have more than one project tag, each tag is shown in a section that can be collapsed or expanded using the triangle icons ▼ or ▶

### Changed
- changed the top-middle box of controls to be a top bar, with only the controls that can't live in the popup 'edit dialog' boxes
- top bar now shows the current Perspective name (if used)
- other improvements of the 'rich' style Project List, to bring more in line with the Dashboard plugin. Including a simpler style of tooltips that aren't clipped
- now supports multiple next action tags, and shows all of them in the Project List (requested by @christmetcalf; closes issue #613)
- when you run '/cancel project' it now asks for a progress comment (like happens when you pause a project)
- the heading of the edit dialog box now shows the note title (not filename), and the current review interval

## [1.0.2] - 2024-12-28 (unreleased)
- now uses the user's 'Editor Font Size' setting to determine the base font size for the rich view of the Project List -- and so can be changed up and down quite easily -- rather than using what the Theme defines.
- small layout tweaks

## [1.0.1] - 2024-12-13
### Fixed 
- fix bug with 'next action' setting (thanks, Alexandre Jacques)

## [1.0.0] - 2024-10-11
### New
- can now define an optional 'next action' tag, and the first of these for a given project note are shown in the Project List. (This can be turned off if desired.) (Requested by @matt.)
- if a 'next action' tag is set, then warn user if they're finishing a Review, and no next action tag is found. (Unless there are no open items.)
- added 'New Interval' buttons to the top bar and edit dialogs, to change the `@review(...)` interval.
- added "Display only due?" and "Display finished?" toggles to window.
- added ⌘D and ⌘F shortcuts for changing the "Display only due?" and "Display finished?" toggles.
- added setting "Folder to Archive completed/cancelled project notes to". The default remains the built-in Archive location in the sidebar. (For @dvarlot.)

### Changed
- doubled speed of generating longer project lists
- tweaked layout of item edit dialog to more closely match the Dashboard plugin
- the Dashboard plugin (if open) will refresh its Project section when the a relevant change is made to a Project in this plugin.
- simplified the "Display finished Projects?" setting to now be just off or on (which displays them after the open projects).
- improved display of projects with literally no tasks
- paused projects are now shown after active projects

### Fixed
- now won't open the Projects List window after a review is finished, if it wasn't already open.

<!-- ### Changes (under the hood)
- split out Project class definition from reviewHelpers.js
- changed from using tab-separated text file that holds a few details on matching project notes, to a JSON-formatted file, holding all details on all relevant project notes
- tweaked Rich layout slightly to suit adding 'next action' feature
- setting name 'Only display due projects/areas?' is now 'Only display projects/areas ready for review?'
- stopped using NP Preferences for displayFinished and displayOnlyDue settings; now directly changed in the `settings.json` file -->

<!-- ## [1.0.0.b4] - 2024-10-11
### Changed
- now doesn't ask for a 'next action' if there are no open tasks or checklists at the end of a review.
- now won't open the Projects List window after a review is finished, if it wasn't already open

## [1.0.0.b3] - 2024-10-07
### Fixed
- duplicate entries showing if more than one wanted hashtag is configured  (thanks to @drb for spotting it)
- fix to display of projects with literally no tasks
### New
- new setting "Folder to Archive completed/cancelled project notes to". The default remains the built-in Archive location in the sidebar. (For @dvarlot.)

## [1.0.0.b2] - 2024-10-04
### Fixed
- '(Set) New Interval' button not working in top bar (thanks to @drb for spotting it)
- Added what I hope is a workaround for the weird-layout-on-changing-a-toggle problem, **for testing further**. [devs: see reviewHelpers.js > updateDashboardIfOpen()]

## [1.0.0.b1] - 2024-10-03
### New
- can now define an optional 'next action' tag, and the first of these for a given project note are shown in the Project List. (This can be turned off if desired.) (Requested by @matt.)
- if a 'next action' tag is set, then warn user if they're finishing a Review, and no next action tag is found. (Requested by @matt.)
- added 'New Interval' buttons to the top bar and edit dialogs, to change the `@review(...)` interval.
- added "Display only due?" and "Display finished?" toggles to window. NB: they work but currently trigger a long-standing bug in NP where some files get forgotten and the resulting display loses all its theming and formatting.
- added ⌘D and ⌘F shortcuts for changing the "Display only due?" and "Display finished?" toggles.

### Fixed
- calculating % complete where progress line didn't contain a percentage [committed  as 0.14.2]
- 'Refresh' button sometimes not working on Markdown output
- height of some circle icons in first column

### Changes
- doubled speed of generating longer project lists
- tweaked layout of item edit dialog to more closely match the Dashboard plugin
- the Dashboard plugin (if open) will refresh its Project section when the a relevant change is made to a Project in this plugin.
- simplified the "Display finished Projects?" setting to now be just off or on (which displays them after the open projects).

### Changes (under the hood)
- split out Project class definition from reviewHelpers.js
- start transition from tab-separate text file that holds a few details on matching project notes, to a JSON-formatted file, holding all details on all project notes
- tweaked Rich layout slightly to suit adding 'next action' feature
- setting name 'Only display due projects/areas?' is now 'Only display projects/areas ready for review?'
- stopped using NP Preferences for displayFinished and displayOnlyDue settings; now directly changed in the `settings.json` file
-->

## [0.14.1] - 2024-09-03
### New
- new "Remove due dates when pausing a project?" option to unschedule all dates in a project when you pause it (for @lbednarski)
### Changed
- stop projects with a future `@start(...)` date from showing up in the review lists (for @lbednarski)
- stop projects with nested hashtags (e.g. `#project/company`) from showing up in review lists also on parent hashtags (e.g. `#project`) (for @lbednarski)
- folders to include/exclude in the settings are now applied case insensitively (thanks to report by @purpletasker)
- some layout tweaks to align more with Dashboard's display
<!-- - added new _logTimer output in some places -->

## [0.14.0] - 2024-07-13
### Added
- edit icon after each Project in the 'rich' style of Project List, that allows all the commands to be run without using the control bar at the top of the window
- after you change settings for this plugin, it will automatically refresh the rich Project List view if its open (requires NP 3.11beta or later)

### Changed
- sizes of headings and text in the 'rich' style of Project List should better match those of text in the NP editor windows for your chosen theme
- under the hood changes to suit Dashboard 2.0
- changed some icons to match newer set used in the projects section of the Dashboard plugin.
- when writing completed and cancelled project summaries to the yearly note, it now puts them as simple list items, not tasks, to avoid a conflict with a Tidy Plugin command.
- should now offer to install 'Shared' plugin which it depends on, if its not already installed (thanks, @Anton)
- if there are no tasks at all in a project note, the circle display now doesn't show 0% but just a filled circle. (Edge case for @sush.)

### Fixed
- fix to edge case with getNextNoteToReview() for Dashboard plugin

## [0.13.2] - 2024-03-19
- replace the "time" that Project List was updated with a "time since"
- clarified how the 'Folders to include in reviews' and 'Folders to ignore in reviews' settings work. (If the first is set, the second is ignored.) This also fixes project notes in the root folder being included when they shouldn't. (Reported by @dwertheimer.)

## [0.13.1] - 2024-03-04
- added new 'Theme to use in rich project lists' setting for @anton.skliar. If this is set to a valid Theme name from among those you have installed, this one will be used instead of your current one.
- under-the-hood additions so new Dashboard 'action buttons' can work for Projects.
- under-the-hood fix to problems in the Dashboard if Project notes in the Project List were moved or deleted.

## [0.13.0] - 2023-12-26
### Added
- When you complete or cancel a project, and you opt to move it to the Archive, there is a new option that now will move it into the Archive replicating its existing folder structure. (This is the same thing that the Filer plugin's "/archive note using folder structure" command does, though Filer does not need to be installed to use this.)
- When the project list is refreshed, it will now also refresh the Dashboard if it is open, as it can also show project notes waiting for review. (Requires Dashboard plugin to be installed, naturally.)

### Changed
- Now smarter about how it writes a 'project metadata line' if one isn't already present in the note.

## [0.12.5] - 2023-12-22
### Added
- When you refresh the project list it will now keep the window's scroll position (for @anton.skliar)
- Support for themes with headings that have coloured backgrounds (for @JohnnyWhoop)

### Fixes
- now includes relevant files from the root folder too

## [0.12.4] - 2023-08-30
### Fixes
- re-write to allow comment lines to work again when running on macOS Big Sur
- fix regression that meant setting "How to show completed/cancelled projects?" to "hide" didn't work.

## [0.12.3] - 2023-08-22
### Added
- ability to run Project List window at the same time as the Dashboard window etc. (Requires NP v3.9.6.)
### Changes
- all the review actions (finish, skip, pause, complete and cancel) now properly update the summary list in the window, not just the underlying notes. (It had been _trying_ to do this, but I've now found the way around the problem of stale data being returned by the API 🥳.)
- now keeps completion at 99% unless absolutely all tasks are done. Previously it rounded to the nearest %. (suggested by @bethv)

## [0.12.2] - 2023-08-09
- fix in /start reviews and /next project review commands

## [0.12.1] - 2023-07-22
- under-the-hood change to help Dashboard plugin.

## [0.12.0] - 2023-06-24
### Added
- new **/add progress update** command, that prompts for a short progress update (text) and current % complete (number). This is inserted into the metadata area of the current project note. It also updates the `@reviewed(...)` date and refresh the project list display.<!-- first part done in v0.11.1-->
- new control button 'Add Progress' to make it easy to add a 'Progress: ...' line for the currently open project note (for @John1)
- more flexibility for 'Progress:' lines: if you don't supply a percentage completion, then it will now calculate it for you (for @loupgaroublond)
- new **/Projects: update plugin settings** command, that can work on iOS
<!-- ## [0.11.1] - unreleased
### Added -->
- the Review List's window size and position is now saved whenever its content is refreshed, and is reused when you next re-open it. (_This feature requires NP v3.9.1+_)
- when pausing a project (through the review list or the "pause project toggle" command) it now offers to write a reason as a progress update in the metadata.
- the Review List updates itself after every relevant review action. Previously it often required hitting 'Refresh' to show the updated state. (_This feature requires NP v3.9.3+_)
### Changed
- when running '/finishReview' the Review List no longer opens if it isn't already open
### Fixed
- running from x-callbacks with passed parameters e.g. `{"foldersToInclude": "something", "displayOrder": "title" }` (thanks to tip from @1nvictus)

## [0.11.0] - 2023-05-10
### Added
- New "skip review" command. This adds a `@nextReview(date)` of your choosing to the current project note, that overrides the normal review interval for it, and jumps to the next project to review. (for @dbludeau, #417)
- New "How to show completed/cancelled projects?" setting, with options 'display at end', 'display' or 'hide' (for @dwertheimer).
### Changed
- the 'Folders to Ignore' setting now matches anywhere in the folder name (for @dwertheimer)
- Switch note links to using x-callback based on filename, not note title, which avoids problems with duplicate note titles (thanks to @dwertheimer, #447)
- Lots of code tidying, with some further tune ups, preparing for future features.
### Fixes
- hopefully finally found the way to make the displayed lists update properly after most review or project actions 🥳

## [0.10.2] - 2023-05-06
### Changed
- further speed up when calculating set of notes to show (thanks to @dwertheimer)

## [0.10.1] - 2023-05-05
### Changed
- the 'Folders to Include' setting now matches anywhere in the folder name (for @dwertheimer)
### Fixed
- it could fail when running NP 3.9.0 or earlier

## [0.10.0] - 2023-05-04
### New
- big speed up possible on large collections by specifying new 'Folders to Include' setting. (addresses [#442](https://github.com/NotePlan/plugins/issues/442) for @dwertheimer)
### Fixed
- it was possible for `@reviewed(...)` tags to get repeated when a review was finished (thanks for reports by @Denrael and @george65)

## [0.9.5] - 2023-03-25
### Changed
- when making the Project Review list, the matches to 'Hashtags to review' are now case insensitive
### Fixed
- fixed display when a note had more than one matching 'Hashtags to review'

## [0.9.4] - 2023-03-04
### Fixed
- 'start reviews' button not working
- % completion stat for tasks with scheduled dates
- now should only open a new window for 'Markdown' style results when the results aren't already open (requires NP v3.8.1 to operate)

## [0.9.3] - 2023-03-28
### Fixed
- issue with multi-column displays with little data
- removed a dependency on NP 3.8.1

## [0.9.2] - 2023-02-28
### Changed
- improved display of 0% progress circles (in 'rich' display)
- in Project Lists, dates and intervals should now be display in the locale language
- trying full-width result tables (in 'rich' display)
- explanatory tool tips are now shown for the buttons at the top of the 'rich' display window
- quicker window refresh after clicking 'Mark as Reviewed'
### Added
- new setting 'Hide top level folder?' that will suppress higher-level folder names in project list headings if wished.
### Fixed
- date arithmetic for times to next review should now work regardless of time zone

## [0.9.1] - 2023-02-24
### Fixed
- wasn't showing projects due for review today in 'Start Reviews' (thanks to report by @dbr and @Hanideal)

## [0.9.0] - 2023-02-23
### Added
- to speed up reviewing projects when you have the 'Rich' Project List view open, there's now a row of buttons above the table that trigger the following commands: **/finish project review**, **/next project review**, **/complete project**, **/cancel project**, **/pause project toggle**. They work on whatever is the project note that's in NotePlan's main editor window (suggested by @John1).
- the Project list view(s) now automatically update after finishing a review, or completing or cancelling a project.
- can now show more than one review #type in the HTML view.

### Changed
- now picks up `reviewed()` and the other pieces of metadata from anywhere in the note, not just the "metadata line" right after the title.
- now writes to the yearly note on project completion or cancellation (if wanted), rather than a note in the Summaries folder.
- now uses plugin "Shared Resources" to deliver font resources for "Rich" style
- can now write both 'Markdown' and 'Rich' style outputs each time.
- tasks scheduled to the future are now not counted in the % completion figures
- clarified the special #hashtags to use on project metadata lines: now just `#paused`; `#archive` is retired.
- only writes HTML file copy if using DEBUG mode.

### Fixed
- improved notes in lists when projects are completed or cancelled (avoids 'NaN' message @edgaulthier found)
- fixed count of notes to review
- fixed some sorting issues in 'review date' output

<!--
## [0.9.0-beta7] - 2023-02-12
### Changed
- tidied up the "Rich" (HTML) display type, which now includes possibility of multiple columns of output if your window is wide enough.
- now picks up `reviewed()` and the other pieces of metadata from anywhere in the note, not just the "metadata line" right after the title.
- removed the "Toggle Pause" button for now, as there are issues with it. The "/pause project toggle" still works.
- now writes to the yearly note on project completion or cancellation (if wanted), rather than a note in the Summaries folder.
- disabled some older test commands

### Fixed
- fixed some sorting issues in 'review date' output

## [0.9.0-beta6] - 2022-11-04
### Added
- To speed up reviewing projects when you have the 'Rich' Project List view open, there's now a row of buttons above the table that trigger the following commands: **/finish project review**, **/next project review**, **/complete project**, **/cancel project**, **/pause project toggle**. They work on whatever is the project note that's in NotePlan's main editor window (suggested by @John1).
- Ability to pause/unpause a project, by calling new **/pause project toggle** command or adding/removing `#paused` to a project's metadata. When paused this stops the note from being included in reviews, but keeps it visible in the project lists.
- The Project list view(s) now automatically update after finishing a review, or completing or cancelling a project.
- Can now show more than one review #type in the HTML view.

### Changed
- Can now write both 'Markdown' and 'Rich' style outputs each time.
- Can now save 'Markdown' view as well as showing the 'Rich' style for "/project lists"
- Tasks scheduled to the future are now not counted in the % completion figures
- Clarified the special #hashtags to use on project metadata lines: now just `#paused`; `#archive` is retired.
- Only write HTML file copy if using DEBUG mode.

### Fixed
- Improved notes in lists when projects are completed or cancelled (avoids 'NaN' message @edgaulthier found)
- Fixed count of notes to review
-->

## [0.8.0] - 2022-10-10
This is a major new version of the **/project lists** command:
### Added
- option for '**Rich**' style output which shows a list in a new window complete with coloured progress rings and tables (requires NotePlan 3.7)
- now opens the new review list note (if previous '**NotePlan**' style used)
- project progress is now shown either as your most recent `Progress:` field, or as the stats it can calculate (e.g. `75% done (of 32 tasks)`)
- new 'Refresh' button to update the review list (in either style) (suggested by @George65)
- new option 'Display dates?' that can suppress printing project dates if you want (for @LaurenaRehbein)
- new option 'Display progress?' that can suppress printing project progress if you want (for @LaurenaRehbein)
- now can be triggered by an x-callback call (see README for details)
### Changes
- now removes folders with no active projects from the output lists
- now hides the progress spinner when running background updates

## [0.7.1] - 2022-08-03
### Fixed
- fixed crashes, and updated logging

## [0.7.0] - 2022-07-14
### Added
- Now automatically update hidden list of reviews where necessary, avoiding some warning messages.

## [0.6.5] - 2022-06-13
### Added
- % completion to project summary lines (with the /project lists command) (for @DocJulien)
- includes a count of 'future tasks' in project summary lines

## [0.6.4] - 2022-05-13
### Added
- new setting 'Confirm next review' to allow turning off the confirmation dialog before the next review starts from the '/next project review' command (default is now false)

## [0.6.3] - 2022-05-01
### Fixed
- configuration problem, potentially leading to NP crash (reported by @Harv)

## [0.6.2] - 2022-04-25
### Added
- added 6 new settings, to allow you to change the various special project strings from '@start', '@completed', '@cancelled', '@due', '@review' and '@reviewed' to ones of your own choosing.
### Changed
- change to newer logging system
- remove ability to use older _configuration note; now all settings come through the Plugin preference pane's Settings screen.

## [0.6.1] - 2022-02-04
### Changed
- now using new Configuration UI system instead of _configuration.

## [0.6.0] - 2022-01-27
### Added
- new  `/cancel project` command that works analogously to the `/complete project` command
- added new 'finishedListHeading' string setting for these two commands. See README for details.
### Changed
- improved output of `/complete project` and `/cancel project` commands
- re-factored code to make more re-usable

## [0.5.2] - 2022-01-21
### Added
- progress indicator when running longer commands
- `/complete project` now also adds note to a yearly note in Summaries folder (if the folder exists), and offers to move the note to the NotePlan Archive.

## [0.5.1] - 2022-01-03
### Changed
- removed `addProject` command. I've realised the equivalent is now available already by setting up the `/qtn` command in Templates plugin. See my [README](README.md) for details.

## [0.5.0] - 2021-12-28
### Changed
- the `foldersToExclude` setting now means `/startReviews` and `projectLists` commands ignore any sub-folders of the specified ones as well
- tweaked the output to show overdue reviews in **bold**
- improved code documentation

### Fixed
- will no longer ignore notes in the root folder (thanks to @Matthias for the report)

## [0.4.4..0.4.5] - 2021-12-09
### Fixed
- /projectList could fail on invalid `@due()` dates; made the metadata line reader more resilient

## [0.4.1..0.4.3] - 2021-10-24
### Fixed
- updated some warning messages
- found that NP strips out hash symbols from note titles; this led to duplicate Review notes (later reported as #138 by @codedungeon)
- typo in default configuration that gets copied to _configuration

## [0.4.0] - 2021-09-10
### Added
- new command `/addProject` that adds a new note using your template 'New Project Template' (if defined)

### Changed
- under-the-hood change: the `/startReviews` and `nextReview` commands now use the (invisible) preferences system available from v3.1.0, rather than the (visible) `_reviews` note. _This requires NotePlan v3.1.0 (build 654) or greater._

## [0.3.0] - 2021-08-21
### Added
- new support for projects labelled `#cancelled` or `#someday` -- these are marked differently in the output lists
- new setting `displayArchivedProjects` which for the command `/projectLists` controls whether to display project notes marked `#archive`
### Changed
- update: changes the `noteTypeTags` setting to be an array of strings not a comma-separated string. E.g. `noteTypeTags: ["#area", "#project"]`

## [0.2.1..0.2.3] - 2021-08-01
### Added
- new command `/completeProject` that adds a `@completed(today)` date,
- new setting `foldersToIgnore` that allows an array of folder names to ignore in the commands

### Fixed
- contents of sub-folders were being duplicated in the lists
