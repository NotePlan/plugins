# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

<!-- - NOT-DO: Search: add an "Ignore Perspective" link to the message which fires off a search without the inclusion/exclusions
- TODO(later): v2.3.0 UI to set the searchTerm and search options.
- TODO: Prevent banner warning when completing non-standard scheduled items (that don't have a `<date` component)
- TODO: ^⌥s triggers the search bar
- TODO: fix long-standing layout bug where some tooltips were getting clipped
- TODO: fix isNoteFromAllowedFolder() for teamspace or possibly 2025-W21.md
-->

## [2.4.0.b21] 2026-02-19 
- new 'Start' review button in project dialog box.
- dev: more robust handling of edge cases in REFRESH_SECTION_IN_JSON
- auto refresh: change exceptions around when it *won't* fire, to now ignore most interactions with Dashboard, other than having a dialog box open.
- add ordering method to description in Active Projects section
- there are reasons that Projects plugin can produce a list with duplicates; Active Projects section now de-dupes them.
- update Project Dialog to add Start Reviews button, and latest progress comment

## [2.4.0.b20] 2026-02-10 
- fix clicking on note title in Task Dialog box opening two notes
- allow Searches to work against either V2 or V3 of Search Extensions plugin
- move "Default Dashboard Window Type" setting to main Dashboard settings dialog, from the NP plugin settings pane.
- new setting "Show only projects with next actions" for the Active Projects section. (This includes any where the Project is defined as being 'Sequential'.)
- change colour of the folder part of shown note links to grey, to de-emphasise them
- allow Headings to be shown in the "Current time block" section, where present
- dev: CSS code tidy up

## [2.4.0.b19] 2026-01-27
- finish hooking up addTaskToNote + UI improvements
- dev: refactor getOpenItemParasForTimePeriod() and add tests to the new smaller functions.
- dev: updates to SearchableChooser etc. from DBW
- fix to refresh after adding task using buttons in today and week section headings
- UX fixes to SearchableChooser, including allowing <Tab> out on new items, not just <Enter>, and using consistent font
- UI fix to validation-message for InputBox ...
- ... but also turn that off, and use a simpler validation-error-highlight instead on <Input>s

## [2.4.0.b18] 2026-01-24
### New
- New Section "Active Projects", which shows a list of all the currently-active projects from the separate Project & Reviews plugin. This includes any currently open projects (i.e. not completed, cancelled or paused) that match its settings, or are included in the current Perspective, if that option is set.  It's designed to complement the existing Projects Section. It also shows the first of any 'Next Actions' as defined by the settings in the Projects plugin.
### Changed
- To make it clearer, renamed the existing "Projects" section to "Projects to Review".
- Generation of sections now happens in the same (possibly-custom) order that they are displayed.
- Turned back on automatic updates from Project plugin's Project List window (if both plugins are running). [Requires Project + Reviews plugin v1.3.0 beta 7 or later]
### Fix
- Display of name of Project notes if they were from a (Team)Space. 

## [2.4.0.b17] 2026-01-21
### New
- added new way to select items to show from Calendar sections: "Calendar note Sections to Include". There is already a way to exclude specific sections in a calendar note; this adds a way to only include specific sections. The matches are partial, so 'Home' will include 'Home' and 'The Home Areas' etc. If left blank, all sections are still included.
- WIP: tried and failed to get 'Rename Perspective' to actually save it fully to settings.json
### Dev
- remove redundant code in index.js::onUpdateOrInstall() now that key renaming doesn't happen there
- removing unused old copy of onUpdateOrInstall() in NPHooks.js

## [2.4.0.b16] 2026-01-20
### New
- the Projects section now shows the latest Project Progress summary for each project, if present.
- the Projects section now shows the first of any 'Next Actions' as defined by the settings in the Projects plugin.
### Fixes
- suppress "showing all 0 items" message when "nothing on this list" message also appears
- stop tag cache source message appearing in Section header when feature flag not turned on
- changing 'Dashboard Theme' setting will now change straight away rather than next time the Dashboard starts.
### Dev
- dev: using new `TProjectForDashboard` type, spread into `TParagraphForDashboard` and `TProjectForDashboard` to show commonality
- dev: new NoteTitleLink component, used by ProjectItem and ItemNoteLink components
- dev: suppress "backup settings" messages to users on upgrades
- align the two different sidebar icon colours
- dev: fix a wrong windowID that had crept in
- dev: check using same winowID throughout

## [2.4.0.b15] 2026-01-17
### Changed
- fix displaying folder names
- add note's `icon` and `icon-color`  properties to display of note title (if set in note's frontmatter) in all Sections

## [2.4.0.b14] 2026-01-16
### Changed
- force iPad and iPhone to run in "main window" mode, not "floating window" mode, if it can.  Where it does, then change layout of right-hand-side of Header.
- now supports the updated Plugins Preference from NP 3.20.1, which includes the ability to add the plugin to the sidebar.

## [2.4.0.b13] 2026-01-09
### Changed
- allowed mainWindow to work on iOS from v3.20.1, now that @EM has added it
- to ease beta testing, particularly for users on iPhone/iPad, made minimum app version 3.20.0
- added 'reload' icon to the NotePlan-added Header bar, as it looks like the usual Refresh button sometimes isn't working on iPad.

## [2.4.0.b12] 2026-01-09
### Fixed
- **PerspectiveSelector star indicator not displaying**: Fixed issue where the asterisk (*) indicating a modified perspective was not showing in the dropdown selector. The bug was introduced in commit `c493f26d` (2025-12-18, "forms editor v1") when `DropdownSelect` was refactored to find options by value. The component was using the label from the found option in the options array instead of preserving the custom label from `controlledValue` (which includes the asterisk for modified perspectives). The fix ensures that when `controlledValue` is provided as an object with a custom label, that label is used instead of the option's label from the array.
- **PerspectiveSelector using stale perspective data**: Changed `PerspectiveSelector` to use `getActivePerspectiveDef()` instead of `getPerspectiveNamed()` to ensure it always gets the most up-to-date perspective with the correct `isModified` flag directly from `perspectiveSettings`, rather than looking it up by name which could be stale.
- added an automatic refresh of the Dashboard if it's open at midnight

## [2.4.0.b11] 2026-01-09
### Changed
- Refactored request/response handling to use new shared router pattern (`newCommsRouter` from `@helpers/react/routerUtils`). Moved routing logic to `routeRequestsFromReact.js` for better maintainability and consistency with other plugins.
- Improved "Add Task" dialog: now defaults to today's date in ISO format, supports date picker for selecting calendar notes, and provides better error messages with toast notifications for success and banner messages for failures.
- Fixed CSS variable for toolbar height: changed `var(--noteplan-toolbar-height, 0)` to `var(--noteplan-toolbar-height, 0px)` for proper CSS unit handling in mainWindow mode.
### Dev
- Removed extensive encoding debug logging that was added for emoji corruption investigation (no longer needed).
- Added new request handler `addTaskToNote` in `requestHandlers/addTaskToNote.js` (placeholder for @jgclark to implement).
- Added performance logging and position verification for dialog rendering.
- Improved error handling in AddToAnyNote component with request/response pattern instead of sendActionToPlugin.

## [2.4.0.b10] 2026-01-08
- bump mainWindow version to 3.20.1 as @EM has changed it up
- added more details to INFO section to see more clearly what's going on with mainWindow on different platforms

## [2.4.0.b9] 2026-01-07
- Running in "Main Window" mode doesn't seem to work on iPadOS or iOS, so changed it run only in "New Window" mode on those platforms.
- Fixed Settings Dialog CSS positioning to properly center in viewport accounting for toolbar height. Removed transform-based centering and switched to direct top/left calculations for more reliable positioning.
- Adjusted Task and Projects Dialog positioning to take account of the new header bar when running in mainWindow
- Fixed the 'move to today' button not working in Task Dialog from Yesterday section
- More efficient refresh after moving an item from calendar note to a different calendar note

## [2.4.0.b8] 2026-01-05
- now always trigger Timeblock Section generation whenever Today Section is generated. This simplifies some handlers.
- add error message info to click handlers, ready to display in updated MessageBanners
- reduced number of Section updates, by being smarter about which ones might need to be updated.

## [2.4.0.b7] 2026-01-03
- Fixed Settings Dialog and DynamicDialog positioning to center properly in viewport when `--noteplan-toolbar-height` is set. Changed from using percentage-based positioning (which used full page height) to viewport-based units (vh) for proper centering.

## [2.4.0.b6] 2026-01-03
- Fixed height/Y pos issues for Dynamic and Settings dialogs
- dev: added new color definitions to theme CSS generator

## [2.4.0.b5] 2026-01-02
- dev: height/width/sticky fixes to use the new `var(--noteplan-toolbar-height, 0px)` for mainWindow running

## [2.4.0.b4] 2026-01-01
- added support for opening the Dashboard in the main app window or a split view, as well as in a separate window. This is controlled in a new setting in the plugin's original settings screen (NotePlan > Settings… > AI & Plugins > Dashboard > ⚙️)
- fix to Week section which (depending on settings) could be a year out when the week number has already ticked over to `W01` of the next year.
- fix to some Header element sizes which mysteriously shrunk
- another attempt to fix the tooltips getting clipped. Possibly improved some of them, but definitely not all, sorry.
- dev: separated data generation for Timeblocks section from Today section.

## [2.4.0.b3] 2025-12-23
- you can now change the priority shown in the Dashboard of all open items in a note by specifying `note-priority-delta: N` attribute in the note's frontmatter. This adds `N` (or subtracts `-N`) to the relative priority, used when priority filtering is turned on. This is useful if you have a note where everything in it is important, for example a note about filing and paying taxes. This saves having to clutter the note with priority markers.  Note: This doesn't actually change the items, but just how they're displayed in the Dashboard.

## [2.4.0.b2] 2025-12-22
- change name of trigger to `onEditorWillSave`, though the existing one will work for now.
- dev: cursor fixing subtle bugs in demo data mode
- dev: cursor improved code quality of DialogForTaskItems.jsx and DialogForProjectItems.jsx
- turn off auto-refreshes in Demo mode

## [2.4.0.b1] 2025-12-05
- new "Spaces to Include" setting which controls which (Team)Spaces you wish to include, plus whether or not to include the Private "Space" (all notes not in a Space). This is applied per Perspective.
- Improved display of Teamspace part of note links in displayed items
- improve design of toggle switches, and add subtle animation

## [2.3.3] 2025-12-04
- new 'Year' section available
- change order of display of tag sections to the order they are defined in the settings, not alphabetical.
- dev: removed `sectionNumStr` throughout, now using `sectionCode` instead
- remove + icon on the "Showing all N items..." message line

## [2.3.2] 2025-12-02
- fix display when there are no priority items shown.

## [2.3.1] 2025-12-01
- fix for possible loss of settings error seen by @Jim when upgrading
- dev: updated default handling for dashboardSettings and perspectiveSettings

## [2.3.0] 2025-11-30
### New
- support for (Team)Space notes in all Dashboard operations
- new % complete pie charts in Section areas for Calendar notes
- you can now change the displayed order of Sections, using a new panel in the Settings window. This is set per Perspective (if used). It can be reset to the default sort order.
- new setting "Do 'Move all items' buttons only move shown items when filtering?"
- new setting 'Include #tag/@mention(s) scheduled to future dates?' (default: false)
- new setting 'How to show progress in Calendar sections?'. If set to 'number closed', then the number of tasks completed in that note will be shown in the section heading area. If set to 'number open', then the number of tasks still open will be shown instead. Or can be set to 'none'. (Default: 'number closed'.)
- new **/backupSettings** command
- added little circles for task completion in section headings, and tweaked the text after it

### Changes
- big speed up of #tag and @mention sections (at least after the first call; it creates a cache in the background for new tags and mentions)
- when the "filter out lower-priority items" is on, this now calculated across all sections, not just each one independently. 
- show Tag/Mention sections that have no items
- hide Referenced calendar sections (e.g. ">Today") that have no items to show
- the label that says there are hidden items now includes "(click to show all)" text to make it clearer how to turn off the filter for that section.
- the Overdue section now shows the number of overdue beyond the 'lookback N days' setting limit, if that's applied (requested by @tastapod)
- a backup of Dashboard settings is created whenever installing a new version
- when using "Move to Note" task action, if the note starts in a Calendar note, and is moved to a Regular note, then that >date is added.
- completing, cancelling or updating an item will also now immediately update the same item if it is shown in a different section (e.g. Yesterday and Overdue).
- change de-duplication of sync'd lines to now favour showing the one in the Regular, not Calendar, note
- the Priority and Overdue sections now apply the 'Apply to sections under Calendar note headings' sub-setting of 'Ignore items in notes with phrase(s)' where set
- lots of visual polish

### Fixed
- fix incorrect display after Unscheduling a task
- fix to Refresh button continually showing 'Generating' long after it should.
- fix to display of hashtags and mentions with included hyphens or underscores
- several fixes to display of URLs
- lots of other small fixes

<!-- 
## [2.3.0.b16] 2025-11-29
- the move "All → ..." buttons now support tasks in (Team)Space notes
- update documentation to refer to (Team)Spaces now, as NP has changed its language
- improve layout in Settings heading area (for @dwertheimer)
- tweak some itemIcon colour/position/cursor
- dev: rationalised CSS definition files
- chore: updated docs and UI to refer to (Team)Spaces, following NP renaming them from v3.19.3.

## [2.3.0.b15] 2025-11-26
- improve the count of completed tasks shown in the Today section.
- get count of completed tasks updated when an task in that seciton is completed.
- fix wording in Project section
- make the info messages (e.g. "There are N overdue tasks ...") more consistent
- improve wording of the Banner messages.
- dev: finally bit the bullet and added 'sectionCode' to TSectionItem.

## [2.3.0.b14] 2025-11-20 (released)
- [Cursor] Refactor tagMentionCache to be more maintainable, and fix errors.

## [2.3.0.b14] 2025-11-18
- Can now change the displayed order of Sections, using a new panel in the Settings window. This is set per Perspective (if used). It can be reset to the default sort order.
- Edit dialog improvements:
  - The text box (where the task text can be ed) is now focused by default
  - Ensured the controls in the top-right hand corner are always shown, even on very narrow screens (thanks, @Aligoran)
  - Further polish to layout at specific widths
- Fix to double-escaped JSON in settings.json file. Updated all places it writes, and added a `parseSettings` to tidy up existing files.
- Fix for isModified setting for tags (#703, for @dwertheimer)
- Fix for styling of note links that are from Teamspace notes
- Fix for issue that prevented referenced paras from being shown, if a Teamspace note was being shown.
- Fix to tag/mention Sections not honouring the 'include folders' setting (thanks, @Ryan)
- Tweak to icon positioning in display of icons in edit buttons and noteTitles

## [2.3.0.b13] 2025-11-11
- When lower-priority items filter is turned on, change the move "All → ..." buttons to show "All shown → ..." instead.  Added new setting "Do "Move all items" buttons only move shown items when filtering?" to control this. 

## [2.3.0.b12] 2025-10-10
- Improve /backupSettings command
- Fixed #688 edge case with multiple ellipses (for @dwertheimer)
- Updated to use latest 'cube' icon for Teamspace
- Get Calendar notes from Teamspaces included in calendar sections
- Fix (hopefully) for Week Section on Sundays for users with Sunday as start of week (thanks @oak86 for tip off and @dwertheimer for helping test)
- Improved note picker used by the 'add task anywhere' button (by improving QuickCapture plugin)
- Change calendar section icons to better match newer ones used in NP

## [2.3.0.b11] 2025-10-01
- Save a copy of settings.json if it's discovered that it doesn't contain perspectiveSettings.

## [2.3.0.b10] 2025-09-18
### Changed
- When the "filter out lower-priority items" is on, this now calculated across all sections, not just each one independently. 
- The label that says there are hidden items now includes "(click to show all)" text to make it clearer how to turn off the filter for that section.
- improve cache updates
- now creates a backup of Dashboard settings whenever installing a new version, whether any settings have changed or not.
### Fixed
- the done count not including items from project notes
- note-tags when cache is off
### Dev
- removed dependency on QuickCapture plugin being installed. It now compiles in its code.

## [2.3.0.b9] 2025-09-01
### Changes
- Add another check to regenerate or update tagMentionCache after 24 and 1 hour respectively
- Make 'Show folder name in note link?' setting indented under 'Show note link for tasks?'
- I have stopped some of the unnecessary generation of Project List. Let me know how it goes, @dwertheimer. (Will require rebuilding jgclark.Reviews plugin as well (to v1.2.4).)
- Tweak some TaskDialog button labels
### Fixed
- Fix color of blockID marker in light mode themes
- Further fix to display of calendar events in tasks
### Dev
- Also added some logging to track down when Project list generation is happening when it shouldn't be. If 'Show Section Timings' Flag is on, then it will also write a log to note "@Meta/Project Generation Log".
- Added tagCache age to section info (if 'Comparison' FFlag is turned on)

## [2.3.0.b8] 2025-08-27
- Add temporary workaround for error in DataStore.listOverdueParagraphs() for regular Teamspace notes
- Fix edge case that means Tag sections can fail to be shown

## [2.3.0.b7] 2025-08-18
- When using the top bar '+' button to add a new task anywhere, improved display of list of notes and headings when adding a new task (when running NP 3.18+). Also improved support for adding new tasks to Teamspace notes.
- Fix to the move "All →  X" buttons ignoring indented tasks, or leaving duplicate tasks. (Hopefully ... do report if you still see this happening.)
- Fix calendar links sometimes being rendered oddly (reported by @Clay)
- Fix display of particular @mentions

## [2.3.0.b6] 2025-07-19
- The Overdue section now shows the number of overdue beyond the 'lookback N days' setting limit, if that's applied (requested by @tastapod)
- Fix to the 'All →  ...' move operations failing randomly
- Fix to display of hashtags and mentions with included hyphens or underscores (reported by @chrismetcalf)
- When using "Move to Note" task action, if the note starts in a Calendar note, and is moved to a Regular note, then that >date is added.

## [2.3.0.b5] 2025-07-11
- fix to edit icon colour in Project items
- completing, cancelling or updating an item will also now immediately update the same item if it is shown in a different section (e.g. Yesterday and Overdue).
- fix to Refresh button continually showing 'Generating' long after it should.
- change de-duplication of sync'd lines to now favour showing the one in the Regular, not Calendar, note (for @chrismetcalf)
- lengthen 'Number of days to look back for Overdue tasks' default from 7 to 31.

## [2.3.0.b4] 2025-07-06 (unreleased)
### Improved
- In task dialog don't show 'Unsched' button when task is in a calendar note
- Fix incorrect display after Unscheduling a task
- Fix edge case on display of URLs with embedded ~ characters
- Fix tags being missed when they have a different case (only applies when the new cache isn't being used)
- Smarter refresh of display after moving an item between notes
- the Priority and Overdue sections now applies the 'Apply to sections under Calendar note headings' sub-setting of 'Ignore items in notes with phrase(s)' where set
- will now trigger a tagCache rebuild (if scheduled) after a refresh, as well as after first load
- now rebuilds tagCache after adding a new tag to a perspective before its saved
- fixes when changing perspective settings (DBW)
- made settings system more robust when updating versions (DBW)
### Dev notes
- remove most START_DELAYED_REFRESH_TIMER calls

## [2.3.0.b3] 2025-06-15 (unreleased)
### Improved
- changed 'Nothing left on this list ' to say 'All _N_ items completed on this list' where relevant
- stopped spurious "windowResize" message from appearing on iPhones
### Dev notes
- Turned off windowResize for i(Pad)OS devices, to stop spurious windowResize errors from appearing
- Refactored layout code that avoids the modal dialog close button
- Show FF icon whenever any FF is turned on as well as when we're in DEV logging mode.
- New FF 'FFlag_UseTagCacheAPIComparison'
- Changed from `...DataStore.settings` to `await getSettings('jgclark.Dashboard')` throughout
- Worked around bug (which I can't isolate) where `number` types in dashboardSettings get saved as `string` types.

## [2.3.0.b2] 2025-05-29
- show TAG sections that have no items
- hide Referenced calendar sections (e.g. ">Today") that have no items to show
- added little circles for task completion in section headings, and tweaked the text after it
- new setting 'Include #tag/@mention(s) scheduled to future dates?' (default: false) (for @Bart De Ruyck)
- new setting 'How to show progress in Calendar sections?'. If set to 'number closed', then the number of tasks completed in that note will be shown in the section heading area. If set to 'number open', then the number of tasks still open will be shown instead. Or can be set to 'none'. (Default: 'number closed'.)
- fix to display of complex URLs, including x-callback protocols like `readdle-spark://...` (for @SavageBeginnings)
- made a subtle visual change to more closely tie referenced Calendar sections to their main Calendar section.

### Dev notes
- lots of re-work of tagMentionCache. In particular will not to full generate if cache is missing (or incomplete), but instead fall back to use the API, and schedule full generation after the rest of the Dashboard has been generated.
- restored the tagMentionCache FFlag for DBW
- turned off full cache generation on startup (or Hard Refresh) if logging mode is DEV (or for JGC)

## [2.3.0.b1] 2025-05-15
### Added
- start of support for Teamspaces: open items in its calendar and regular notes are now included, and are shown with the name of the its Teamspace.
- new **backupSettings** command, which can be run from an x-callback as well: `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=backupSettings` See README for details.
- new 'noteTags' that extend Tag sections: this includes all open items in a note, based on 'note-tag' field in frontmatter (e.g. `note-tag: #teamspace, #CTI`)
- new % complete pie charts in Section areas for Calendar notes
### Changed
- big speed-up of Tag/Mention Sections
- improved way note links are shown in sections and the task dialog
- clarified meaning of 'number of days to look back for Overdue tasks' to filter by due date (if set) or on date of a calendar note.
### Fixed
- (hopefully) avoid situation where the 'Switching Perspectives' spinner never goes away
### Dev notes
- added FF for including Teamspace notes, by default turned off.
- fixed more Teamspace handling
-->

## [2.2.1] 2025-04-16
### Changed
- You can now order results in Tag and Overdue sections by due date, as well as by the existing options (for @LauraH)
- Tweak layout of text & stop overscrolling behaviour under an open dialog

## [2.2.0] 2025-04-11
### New
- Search section. Click on the new icon in the header and a small search bar opens up, where you can type a term to search for open tasks and checklists in regular or calendar notes. This uses the extended syntax from my separate [Search Extensions plugin](https://noteplan.co/plugins/jgclark.SearchExtensions/) to allow more complex searches than NotePlan natively allows.  The Search Section stays until either you manually refresh the dashboard, or you click the close `[x]` button. This means you can edit the items like any other section contents, and also use Interactive Processing.
- new `externallyStartSearch` x-callback for this, with arguments: 
  - search terms string
  - search over 'calendar', 'project', or 'both' (optional, default is 'both')
  - ISO start date for calendar notes (optional, default is empty)
  - ISO end date for calendar notes (optional, default is empty)
- add easier x-callback 'showDashboard' command alias
- allow CalendarPicker to be opened when ⌘-clicking the task edit or project edit icon
- add ⌘-click option to 'All → Tomorrow' and similar buttons which temporarily toggles between what is your normal set mode ('move' or 'schedule').
### Changed
- the 'add task to any date' button in the Today section area has moved to the Header bar and is now an 'add task to any (calendar or regular) note'.
- many small improvements to display, layout and tooltips
- removed '<<carry forward>>' as a possible heading from the 'add a new task/checklist' dialog
### Fixed
- when using 'All → Tomorrow' and similar buttons, stop trying to move child tasks, which raises errors, as they've already been moved with their parents
- workaround for child tasks not behaving correctly on iOS
- Made workaround for `undefined` value of NP timeblockTextMustContainString preference 
-->

<!-- Removed 2.2.0 alpha and beta details -->

## [2.1.10] 2025-02-16
### New
- When you move/schedule an item from one note to another, there are two additional workflows:
  1. if you want the current hierarchy of headings to be maintained in the new note (if they aren't already present), you can now use special setting `<<carry forward>>` in 'Section heading to add/move new tasks under'.  For example, if the item to move is in section `### Project VENONA` which in turn is under heading `## Work`, then `## Work` and `### Project VENONA` will be inserted first, if they aren't already present. (For @jgclark)
- 2. now if you set the 'Heading level for new Headings' setting to `0`, that tells the Dashboard to only create the wanted heading if it isn't already present in the destination note. (For @dwertheimer)
### Changed
- Whole Dashboard a little quicker to generate, particularly in the case of notes with many parent/child items.
- The Tag section(s) are now about twice as quick to generate, and if there are multiple ones to show, they start appearing more quickly.
- The Tag section(s) now show "first X of Y items", not "X items".
- Moved the Tag/Mention section settings higher up the list of settings, to come straight after the 'What to Include and Exclude' section. Also improved the description.
### Fixed
- Fix '>Yesterday' section not appearing (thanks, @MC-1848)
- Fix the referenced sections not being removed when 'Show referenced items in separate section' is turned off
- Fix (re)scheduling items when the Heading setting was set to '<<top of note>>' (thanks, @dwertheimer)
### Dev notes
- Speeded up `isAChildPara()` by using `children()` once instead of calling it multiple times. This is called by `makeDashboardParas()` which is used in all generation.
- Restructured makeDashboardParas() and found it could be a lot quicker as a result. I don't understand this, but it's a bonus.

## [2.1.9] 2025-02-08
### Changed
- Larger tap targets for buttons on iOS/iPadOS
- on iOS: Added 'Move all' and 'Interactive Processing' buttons to the Section heading, but removed the 'New Task' button from the edit  dialog (as it can't work there).
- Updated '/generate diagnostics' command to write to a note in the root folder
### Fixed
- Added workaround for slow API response with particularly large notes

## [2.1.8] 2025-02-05
### New
- Added a '+ New Task' button to the end of the Task edit dialog. This effectively runs the '/quick add task under heading' command (from Quick Capture) which allows you to add a new task in any note under any heading without having to leave the Dashboard.
- When you switch to a new Perspective, Dashboard now tells Projects & Reviews plugin (if it is already open) to update.
- New '/generate diagnostics' command to make it easier in future to diagnose problems, as there are so flipping many settings to understand.
### Changed
- When clicking on a Section Title or a note link (which opens the relevant note in the Editor), the Editor is now brought to the front.
- Some colour changes to bring more in line with NP's app sidebar.
- If you have enabled the Timeblock section on, it will now show/hide relevant new timeblocks much more quickly.
- The Edit All Perspectives table now has subtly shaded alternate rows
- The window starts up saying 'Generating' not 'Refreshing'
- Improved text in Projects section heading
- Updated passing of data from Projects & Reviews plugin (v1.1) to Dashboard.
### Fixed
- Issue with 'Last Week' section taking a long time to appear (big thanks to @jpr1972 for tracking it down)
- Issue with 'Last Week' section not working if 'Show referenced items in separate section' was turned on
- Regression with task counts not reducing when completing items
- Issue affecting @MC-1848 with timeblocks (thanks for patiently helping us track it down)
- The 'Add a task' dialog box dropdown menu for Heading was clipped

## [2.1.7] 2025-01-30
### Changed
- Perspectives: if you have 'Apply to sections under headings in Calendar notes?' turned on, this now applies to all the preceding headings up the H5->H1 hierarchy for that line.
- task and project edit dialogs now can be closed by clicking outside the window
- setting 'Automatic Update frequency' renamed to 'Automatic Update interval'
### Fixed
- issue after project edit dialog opened

## [2.1.6] 2025-01-27
### New
- if a task is marked complete, and it has a `@repeat(date)` (using the Repeat Extensions plugin) then it will now automatically generate the new repeat. (This works around a limitation in the API where the usual trigger doesn't fire.)
### Changed
- when you click on a task/checklist line in the Dashboard window, it will highlight that line in the open NP Editor, and now bring the NP window to the front.
- allow all current timeblocks to be shown, not just the first
- styling improvements in Edit All Perspectives... window and various dialogs
### Fixed
- an extra item could stop being displayed when the item before it was marked as complete
- timeblocks in list items ignored if also filtering out checklists

## [2.1.5] 2025-01-21
### New
- when moving an item to a different note, and the item contains a scheduled date, it now offers to remove the date (suggested by @drb)
### Fixes
- fixed regression when (re)scheduling an item (thanks, @SneakAttack)
- fixed timeblock still appearing on completed items (thanks, @MC-1848)
### Dev notes
- changed doMoveToNote to finish with REMOVE_LINE_FROM_JSON not UPDATE_LINE_IN_JSON
- refactored REMOVE_LINE_FROM_JSON to happen in `processActionOnReturn()` not `updateReactWindowFromLineChange()`. This simplifies things a bit. @DBW please review to make sure I'm not doing something silly here.
 
## [2.1.4] 2025-01-19
### Changes
- the 'Edit All Perspectives' dialog now shows a modified Perspective as well as the unmodified version of that Perspective, plus options to 'Save' or 'Revert' those changes.  (Feedback welcome on this.)
### Fixes
- fixed Interactive Processing dialog failing
### Dev notes
- Remove vestiges of showModal() using <Modal> component instead
- Changed some <div>s to be <header>, <main> and <section> instead -- should provide better accessibility, and recommended by ARIA
- Fixed Feature Flags not being saved.

## [2.1.3] 2025-01-16
### New
- the task dialog box is now a bit smarter: it won't display 'this month' when the item is from the monthly note, but will give 'next month' option instead. Similarly for items in 'This week' and 'This Quarter' sections.
### Changes
- made the message to user more useful on (valid) occasions where Dashboard can't update something because its recently changed in the underlying note
### Fixes
- fixed regression that stopped 'hide checklists' from being honoured in some parts of the display
- the 'current timeblock' could stop being displayed too soon
- fixed settings from the Filter dropdown menu getting out of sync
- fixed special '<<top of note>>' option in setting 'Section heading to add/move new tasks under' not being handled properly (thanks, @dwertheimer)
### Dev notes
- I realised that some of the logic for what to display and not is spread out in several places, making it difficult to reason with and test. So I've moved a checklist filter out of ItemGrid up to Section level (through its useSection... effect) which has much more logic about how to filter and display this.

## [2.1.2] 2025-01-13
### New
- Spinner after final section to indicate when a Perspective is still changing
### Fixes
- Today section not showing up before a settings change
- fix perspectives where some tags were being shown even though they were not included in the tagsToShow setting for the current perspective
- settings description for max items to show
- fix ESC key on PerspectiveSelector non-perspective options
- hide Interactive Processing button in Projects section (will be introduced later) (thanks, @Wook5000)
- fix 'Last Week' section not refreshing after clicking 'All->This Week' button
- spacing after folder names in referenced links

## [2.1.1] 2025-01-06
### New
- time blocks are now found in regular notes that reference to today (e.g. `>2025-01-04 at 11:00`) as well as calendar notes
- new 'show Today' toggle, as you can now choose to hide the Today section. [This is in preparation for future changes.]
- new '/test Perspective filter' command in case we still need more logging
### Changed
- eliminated some background refreshes -- feedback wanted on whether any sections are not fully up-to-date straight after an automatic or requested refresh
- removed "Add new Perspective", "Delete Perspective" and "Update current Perspective" commands, as they're now more easily used in the Perspective dropdown menu.
### Fixed
- some open tasks were being included in a Perspective when they shouldn't have been excluded by folder (thanks @ormler, @dwertheimer)
- fixed the Tomorrow Section sometimes not showing
- fixed the (re)schedule actions (e.g. "+1d", "+1w") in the task dialog box not firing in regular notes that are referenced to >today
### Dev note
- cut down logging
- commented out `updateReactWindowData()`
- removed unused version of `getInitialDataForReactWindow` and renamed what we are using to this same name
- testing deactivation of `START_DELAYED_REFRESH_TIMER`

## [2.1.0] 2024-12-31
A major effort by @jgclark and @dwertheimer over the last 5 months. There are lots of new things, particularly **Perspectives, that allow you to switch very quickly between different complete sets of settings**.
### New
- new settings to control what items/folders/sections are shown and what is ignored in a Perspective.
- new Perspectives dropdown menu that allow you to switch very quickly between different complete sets of settings
- this menu also has commands to 'Save As...', 'Delete...', 'Rename...', 'Copy to...' and 'Edit all...' Perspectives
- new "/Add new Perspective", "/Delete Perspective" and "/Update current Perspective" commands
- new `setPerspective` x-callback to use from outside NP
- new 'Current Time Block' section at the top of the window, that only shows if the current time is within a time block defined in your daily note.  (Note: This honours the 'Text must contain' setting in the main NP Todo settings pane.)
- new 'Last Week' section and related 'All → This Week' button
- new 'Add a new task to future note' button on Today Section, which allows you to pick any date for the future task
- added support for 'child' items of tasks:
  - child items are now indented like in the NP Editor
  - an item with children is now shown with a new 'ellipsis' indicator at the end of the item
  - when moving/scheduling items, any child items are moved/scheduled as well.
  - the 'All → Today' and 'All → Tomorrow' buttons now don't try to move child items on their own, but only as part of the block with their parent.
- child tasks are now ordered following their parents, when sorted by priority
- now there is a 'Show completed task count?' setting which can be turned off.
- now uses the user's 'Editor Font Size' setting to determine the base font size for the Dashboard -- and so can be changed up and down quite easily -- rather than only using what the Theme defines.

### Changed
- speeded up data generation significantly in some places (particularly refreshes), and everything else should feel snappier
- parent items now show a '・・・' indicator, like NP does
- child items are now indented like in the NP Editor
- in the item dialog, there's now a note if an item has children
- Turn off 'Referenced' Calendar sections if they have no items to display.
- the "Ignore items in calendar sections with these term(s)" are now checked case-insensitively
- the completed task count is now smarter and quicker at operating, and covers tasks completed in notes not shown in the current Dashboard sections.
- turned off underlining on the 'take a break' message lines, and added colouring of it from your theme's completed task colour
- Week/Month/Quarter sections now show a compact line so that their respective add buttons will show, even when there are no open task/children items to show.
- improved details in title of project dialogs
- changed order of skip buttons in Interactive Processing dialog
- new type of dialog to replace the command bar for adding new tasks/checklists, and some other operations
- the layout has been polished up in lots of places
- removed setting "Add dashboard auto-update trigger when dashboard opened?" ('autoAddTrigger')
- changed callbacks to be showDashboard, showSections and showPerspective. E.g.:
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showDashboard`
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showPerspective&arg0=Work`
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showSections&arg0=DT,DO,@home`

### Fixed
- worked around an API limitation so that you can add tasks/checklists to future calendar notes that don't exist yet.
- fixed some items not being found when referenced to weekly notes
- add time to @done(...) when "completing then"
- fixed spinner icon not spinning
- projects that are paused are now not shown in the projects section
- changed Interactive Processing icon to not imply 'refresh'
- fixed various things related to truncated display of long tasks, particularly those with bare or Markdown-style URLs
- improved ordering and descriptions of some of the settings
- removed warning if Project & Reviews plugin is not installed

<!-- Removed 2.1.0 beta details -->

## [2.0.7] 2024-10-23
### New
- new 'All -> Next Week' button in Week section. 
- clicking on 'there are X items hidden' message lines now turns off filtering in all sections<!-- from 2.1.0.a9-->
- added version number to end of Settings dialog<!-- from 2.1.0.a12-->

### Changed
- under-the-hood changes to match Project + Reviews Plugin v1.0 release.
- stop check dialogs on "Move all ..." operations on iOS/iPadOS, as they stopped them working<!-- from 2.1.0.a11-->
- changed Interactive Processing icon to not imply 'refresh'<!-- from 2.1.0.a11-->
- add time to @done(...) when "completing then"<!-- from 2.1.0.a12 -->

### Fixed
- fixed edge case when filtering lower priority items from the display
- fixed typos in "Move all to today" dialog<!-- from 2.1.0.a11-->
<!-- fixed spinner icon not spinning<!-- from 2.1.0.a11, but not working for some reason here -->

## [2.0.6] 2024-09-06
### Changes
- new setting "When (re)scheduling an item, also show it as a scheduled item in main Editor?". If set on then it uses the `[>]` marker in the underlying Markdown which is shown with 🕓 in the main Editor. By default this is on, to match the standard behaviour of NotePlan's UI. (requested by @tophee in issue 589)

### Fixed
- Fixed full generation sometimes having Project rather than Priority section<!-- from 2.1.0.a8 -->
- Removed double generation of Tag sections in getSomeSectionData()<!-- from 2.1.0.a8 -->
- tighten up removal of priority indicators, to only happen at the start of a line's content<!-- from 2.1.0.a5 -->
- now won't display buttons in the Section header if there are no items to work on. (However, the 'add' buttons in the calendar sections are still shown.)<!-- from 2.1.0.a5 -->
- Fixed project progress 'pie charts'  layout issues, and added them in to the project dialog header.<!-- from 2.1.0.a9 -->
- multi-part hashtags now display properly (thanks for tip, @lbednarski)

## [2.0.5] 2024-07-30
- some layout tweaks in the main Settings dialog
- fix to 'All -> Today' button action in Overdue section (thanks, @Oldielajolla)

## [2.0.4] 2024-07-23 unreleased
- new 'Priority' section for all items with a priority marker (>>, !!!, !! or !) (for @lbednarski). Note: this will be slow to generate, as it can't use any of NotePlan's internal caches.
<!-- Note: I'm not sure that deduping between sections is working as it should -->
- fixed setting 'Add folder name in note link' not working
- updated some of the icons in the section descriptions

## [2.0.3] 2024-07-19
- fixed filter dropdown menu placement issue
- fixed Today section description when there are no open tasks left
- added greyed-out 'save & close' button when opening settings dialog
- added some constraints to number fields in the settings dialog
- fixed tooltips hidden by window header
- tidied up other z-index-ing

## [2.0.2] 2024-07-16
- fixed 'All Overdue → Today' button not working (thanks for the report, @Oldielajolla)
- fix to auto-refresh
- fix to stop 5s refresh in DEV mode
- improve wording around number of open items in section descriptions
- small layout tweaks when on a narrow screen
- reverted the Filters dropdown menu to be single column while we work out why 1 user is having trouble with 2-col layout.

Note: I intend to remove the "Add dashboard auto-update trigger when dashboard opened?" setting and functionality in a future release. It is much less needed now Dashboard can auto-refresh after a given number of minutes.

## [2.0.1] 2024-07-15
### Added
- new x-callback **setSetting** command to change a single Dashboard setting.
- new x-callback **setSettings** command (plural) to change multiple Dashboard settings in one call.
- new **/Make Callback from Current Settings** command that copies the current setting as a URL or a markdown link to the Clipboard.
- dbw: remove "tooltip" prop for featureFlags
- dbw: remove DEV limitation on 5s refresh
- dbw: fix edge case bug on ReactSettings and saving/reading from plugin.settings
- fix issues with logSettings not saving/reading properly and not showing DEV FFlag menu

### Changed/Improved
- made the Filters dropdown menu a two-column display (except on narrow screens)
- removed most settings from old setting system
- removed "edit settings (for iOS)" command, as not needed
- improved spacing and ordering of heading, and made tapping heading elements easier on iOS
- other UI tweaks
- improved communication between Projects and Dashboard plugins
- (under-the-hood) add quite a lot of logTimer() calls, and added a new setting for it to both old and new setting systems
- (under the hood) complete refactoring of settings data structures under the hood

### Fixed
- fix task completion timestamps using GMT not local time (thanks, @mjd9ball).
- updating the Project List (in Projects & Reviews plugin) now refreshes the Project section in the Dashboard again.
- fixed Project item display when project in root folder
- a newly-added Project progress line will now be shown in the main window

## What's improved in v2.0?
### New
- The different sections are now generated or refreshed progressively, so the first sections appear more quickly. When refreshing the display, the dashboard is smarter and will only update the necessary sections, displaying indicators next to the section items as it does so.
- Auto-refresh: by default the Dashboard will now automatically pick up new/changed tasks in NotePlan after it has been idle for 15 minutes (configurable). This means that you probably no longer need to add a trigger to the notes with tasks you're completing/changing frequently.
- New Processing button that opens up the Task Edit dialog showing the first item in the section. When you click on an action button it then updates to show you the next item, and so on. In this mode there's an extra 'forward' button that lets you leave that item where it is.
- Can now show multiple tags/mentions, by specifying them in the setting separated by commas
- New Filter dropdown that allows you to quickly toggle on or off all the main display settings, including which sections to show -- moved from the Preferences Pane
- New Settings button which opens a window that has the rest of the more detailed settings for the plugin -- moved from the Preferences Pane
- In the task dialog box, added a couple of new controls, including the 🗓️ control which opens up a date picker to allow picking any date to move a task to
- In the project dialog box, added:
  - a new 🗓️ control which opens up a date picker to allow picking any date to schedule the next project to
  - new "Complete Project", "Cancel Project", "Pause Project" buttons, that each mimic the same command from the Project & Reviews plugin
  - now shows the latest 'Progress' comment for a project, and a button to add a new comment.
- When the NotePlan Theme is changed (manually or automatically), the Dashboard window will automatically pick this up on the next refresh.
- ^-click (ctrl-click) on an item's status icon now deletes the item entirely (after a check with the user).
- Added an x-callback to allow specifying which sections you want to see. For details see README.
- Note: some of the buttons are hidden when running on iOS or iPadOS because of limitations in the environment the Dashboard runs in. We are hopeful these will be removed in time.

### Changed
- Should now work better on iPhones and iPads
- Removed the separate limit on number of Project items shown; it will now use the main limit setting (if set).
- The 'Update Overdue section when triggered?' setting has been removed, as it is no longer needed with the smarter data generation
- Removed the keyboard shortcuts to toggle sections, as there is the new Filter quick menu.
- The count of tasks done today now includes those completed in project notes, not just from the calendar sections shown. Note: this requires having the NotePlan setting 'Todo > Append Completion Date' setting turned on, as otherwise we can't tell when a task is finished. (As @done(...) dates don't get appended to completed checklists, it's not possible to count completed checklists.) To save space, this is not shown on iOS devices.

### Fixed
- a task in today's note "* a task >today" doesn't show up on today's dashboard
- tasks in future notes showing up in #tag section
- synced copies dated for today were duplicated
- "Dashboard: update plugin settings" command not working (reported by @todd9252 on v1.2)
- other bug fixes

## [1.2.1] - 2024-04-18 by @SirTristam
- Add option to use the current date instead of '>today' to schedule tasks for today
