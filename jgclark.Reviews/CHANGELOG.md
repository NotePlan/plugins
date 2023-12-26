# What's changed in 🔬 Projects + Reviews plugin?
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.Reviews), and how to configure.
<!-- - resize action -->
<!-- checkboxes for only display overdue, and showing finished items -->
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
- now should only open a new window for 'Markdown' style results when the results aren't already open (requiers NP v3.8.1 to operate)

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
- now picks up `reviewed()` and the other pieces of metadata from anywhere in the note, not just the "metadata line" right after tht title.
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
- now picks up `reviewed()` and the other pieces of metadata from anywhere in the note, not just the "metadata line" right after tht title.
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
- new  `/cancel project` command that works analagously to the `/complete project` command
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
