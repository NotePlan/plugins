# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

<!-- - NOT-DO: Search: add an "Ignore Perspective" link to the message which fires off a search without the inclusion/exclusions
- TODO(later): v2.3.0 UI to set the searchTerm and search options.
- TODO: Prevent banner warning when completing non-standard scheduled items (that don't have a `<date` component)
- TODO: ^⌥s triggers the search bar
- TODO: fix long-standing layout bug where some tooltips were getting clipped
- TODO: fix isNoteFromAllowedFolder() for teamspace or possibly 2025-W21.md
- TODO: enlarged default window size on iPads
-->
## [2.3.0.b6] 2025-07-19
- The Overdue section now shows the number of overdue beyond the 'lookback N days' setting limit, if that's applied (requested by @tastapod)
- Fix to the 'All →  ...' move operations failing randomly
- Fix to display of hashtags and mentions with included hyphens or underscores (reported by @chrismetcalf)

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

<!--
## [2.2.0.a12] 2025-04-10
- workaround to children() being unreliable on iOS
- renamed doSettingsChanged() to doDashboardSettingsChanged() for clarity

## [2.2.0.a12] 2025-04-09
- renamed cleanDashboardSettings() to cleanDashboardSettingsInAPerspective(), and added 'usePerspectives' to the items to clean. Fixed rogue 'searchSection' term appearing.
- WIP: stop further perspectiveSettings changes that shouldn't be happening.
- use settings for case sensitive and full word search options from SearchExtensions plugin (if installed)
- when using 'All → Tomorrow' and similar buttons, stop trying to move child tasks, which raises errors, as they've already been moved with their parents
- code tidy
- add ⌘-click option to 'All → Tomorrow' and similar buttons which temporarily toggles between 'move' and 'schedule' modes. 
- The tooltip on the 'All → Tomorrow' and similar buttons now says whether you are going to (re)schedule or move the items.

## [2.2.0.a11] 2025-04-06
- add easier x-callback 'showDashboard' command alias
- allow CalendarPicker to be opened when ⌘-clicking the task edit or project edit icon
- changed DynamicDialog to be a `<dialog .../>` not a `<div .../>`. So far I don't think it looks or behaves any differently. But you will want to be on the lookout as well, as it's a shared component. I didn't have to change anything else for it, so it would be easy to change back if necessary.
- fixed layout of CalendarPicker, and improve its CSS
- only show 1 CalendarPicker in dialogs when run on iPhone

## [2.2.0.a10] 2025-04-04
### Added
New keyboard shortcuts to trigger certain actions (once the window has focus):
- ^⌥a start the add new item function
- ^⌥, opens the settings window
 
### Changed
- improved responsive layout for dialog box titles and dropdown-selectors
- improved keyboard navigation by adding focus indicators. TODO: finish header buttons
- added 'You can turn off Perspective filtering in the Dashboard settings.' help text if you get 0 search results, and quick link to Settings dialog section.
### Fixed
- Black text in number fields in dark mode is now white
- Fixed '... using 'X' Perspective filtering' message sometimes appearing when it shouldn't.
- removed '<<carry forward>>' as a possible heading from the 'add a new task/checklist' dialog
- Made workaround for `undefined` value of NP timeblockTextMustContainString preference

### DEV Changes
- removed `fixedWidth` on add task/checklist dialogs
- changed DropdownSelector to have width in `ch` not `px` units -- the more natural units, and easier to easier calculate
- changed to use fixed-width task & checklist icons in main window, to make layout slightly easier
- Re-enabled tagCache feature flag back in, and relevant commands '/generateTagMentionCache', '/updateTagMentionCache' and '/testTagCache'.
- Changed `= DataStore.settings` to "go the long way around" as well as the setters.
- Added memoization to reduce re-renders:
  1. Memoizing the `PerspectiveSelector` and `RefreshControl` components so they only re-render when their props actually change
  2. Optimizing the `useLastFullRefresh` hook to only update the state when the display text would actually change
  3. Using useCallback to memoize the update function in `useLastFullRefresh`
  The remaining timer in `Section.jsx` that refreshes the TB section every 54 seconds is actually necessary for keeping the timeblock data up to date, so we should keep that one.
  The components will only re-render when:
  1. Their props actually change
  2. The time display needs to update (every minute or so)
  3. The timeblock data needs to refresh (every 54 seconds)
- Turned down some logging

## [2.2.0.a9] 2025-03-27
- ignore notes in @Archive when looking for search results
- DEV: finished (hopefully) changing all the places dashboardSettings get written out, to use the saveSettings() helper instead.

## [2.2.0.a8] 2025-03-26
- Dashboard Header now works better on whatever the window width is.
- DEV: Re-write Header component to use @content queries not @media queries, to provide cleaner and more responsive experience on whatever the window width is.
- DEV: moved renaming of keys to onUpdateOrInstall(), which can be run via x-callback to test.
- DEV: Started to shift the writing of Dashboard's settings to use saveSettings() helper, to avoid the middle of `data/np.Templating/settings.json`, and `todaysChangedNoteList.json` into the same folder.
- DEV: turn doWindowResized back on, for testing

## [2.2.0.a7] 2025-03-07
- DEV: migrate some setting key names
- DEV: move some search settings into consolidated searchSettings object
- when editing the task details in the text box in the task dialog, pressing Enter now updates and closes the dialog.

## [2.2.0.a6] 2025-02-29
Search:
- Changing colours for switch controls to actual Apple values for dark/light mode (other than using our 'tint'). Also added a subtle border in dark mode which Apple doesn't, as it can mandate a particular background color, whereas we use several.
- made the search text fields type 'search' which gives slight automatic UX improvements on some platforms.
Other Dev notes:
- Change so we don't have to be in DEV mode (with its slew of logs) to still see FFlag items.  You will still need to go into DEV mode to see the dropdown, and therefore turn things on/off, but once they're on they stay on even if you go to (say) INFO log level.

## [2.2.0.a5] 2025-02-28
Search functionality:
- Significant speed up (if there are 'ignore terms' set)
- Add in prevent tasks under heading (from Perspective filtering)
- Allow ignoring future dated items found in regular and calendar notes as well.
Search & Header UI:
- (dbw) Fixed focusing in the SearchBar
- Improved display of focus in Header bar and hover animations on icon buttons
- make Header sticky again
- Header shows either SearchBar or SearchPanel (iff FFlag turned on)
- Prototyped UI for Search Panel, and made available as a FeatureFlag. Toggles not hooked up yet.
- improved SearchPanel opening animation
- remove 'show Search' in Filter dropdown (as it can always be used)

## [2.2.0.a4] 2025-02-24
Search:
- New 'Apply current filtering to Search?' setting
- Fixed very long search (where there are no ignore terms)
- Fixed colour of 'close' button
- Added demo data for SAVEDSEARCH section
- Started adding support for Saved Search sections -- currently only for demo data

## [2.2.0.a3] 2025-02-23
- Search: 
  - No search results now gives a message
  - Update background colour slightly
  - Fixed Header dropdown button positioning after adding search bar
- Fixed backgrounds of icons in Section header
### Dev notes
- Moved some Dashboard.css to new Sections..css
- Added 'SAVEDSEARCH' sectionCode for future use

## [2.2.0.a2] 2025-02-22
- basic Search Bar in Header is working
- Improved some icons and their colouring
- Search section will not sync items even if set to do so in SearchExtensions.
- Fixed ordering of Search section
- Added setting to turn off future tasks. _Currently only works on items in future calendar notes._

## [2.2.0.a1] 2025-02-21
### New
- 'Search' section started, and integrated in all relevant search and display logic.
- Added `externallyStartSearch` x-callback for this, with arguments: 
  - search terms string
  - search over 'calendar', 'project', or 'both' (optional, default is 'both')
  - ISO start date for calendar notes (optional, default is empty)
  - ISO end date for calendar notes (optional, default is empty)
- Can close section when finished with
- WIP: Start to make Search Bar in Header.
### Changed
- improves display of non-standard scheduled items (that don't have a `<date` component)
-->

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

<!--
## [2.1.0.b7] 2024-12-31
### Fixed
- should no longer complain if the Project & Reviews plugin is not installed.

## [2.1.0.b6] 2024-12-30
### Changed
- applied the 'ignore terms' to Tag/Mention sections, apart from the tag/mention itself (for @dwertheimer)
### Fixed
- edge cases with markComplete and markCompleteThen when scheduled to '>today'

## [2.1.0.b5] 2024-12-28
### Changed
- now uses the user's 'Editor Font Size' setting to determine the base font size for the Dashboard -- and so can be changed up and down quite easily -- rather than using what the Theme defines.
- now doesn't do any alphabetical ordering of items in a section (prompted by @stacey.)
### Fixed
- fixed edge case when doing operation 'complete then' on a task with a week due date
- now handles 'scheduling' an item properly. Removed the option about 'displaying the 🕓 symbol'. But instead, I've replaced it with an option to "Use simplified (re)scheduling method?". By default this is off, but if selected then the item simply has its `>date` updated in the note it is in. It does not show with the special 🕓 task icon, and a copy isn't added into the date its being scheduled to. (This is my much preferred way of operating, and avoids duplicating unfinished tasks in calendar notes.)

## [2.1.0.b4] 2024-12-21
### New
- New "Apply to sections under headings in Calendar notes?" setting. When turned on, then the phrases in the previous setting will be used to ignore whole sections in Calendar notes, if that section's heading contains any of those phrases.
### Changed
- Turn off 'Referenced' Calendar sections if they have no items to display.
- Optimised Header layout to work on iPhones, iPad as well as macOS sizes. (On iPhone the Refresh button and info is turned off completely.)
- Brought display of dropdown menus into line with other similar input fields.
- Small dialog boxes should now have a more natural width.
### Fixed
- The default perspective on first run should now show all sections.
- Fixed edge case where '>This Week' section could be shown twice.
### Dev only changes
- (dbw) Added new rollup ability to prefix most Dashboard CSS imports.

## [2.1.0.b3] 2024-12-18
### New
- added Perspective filtering to Projects section as well
- start of adding three-dots marker on a parent item -- will improve later
### Changed
- improved the creation of the default perspectives on first run. Now all sections are turned on by default, so new users can appreciate all the possible Sections.
- updated descriptions of the Include and Exclude settings. Changed to default to include root folder, unless specifically excluded.
- moved some settings from the Filter dropdown to the Settings menu. The ones that are left are now more clearly about filtering what is display, not how things are displayed.
- allow Settings dialog to be wider
- the 'Submit' button in 'add task' and the 'Edit All Perspectives' dialogs are now labelled 'Add & Close'
### Fixed
- child items appear without indentation if their parent isn't showing
- child items appear with their parents in all calendar sections
- items that were both referenced and indented are now being included
- order of tag/mention sections is now the same as in the settings (thx, @ChrisMetcalf)
- setting "Ignore items in Calendar sections with these term(s)" corrected to read "Ignore items in notes with these term(s)" (thx, @lbednarski)
- adding to future calendar notes not working if using ".txt" extension (for @grdn)
- now allows for whitespace before the ! priority markers in a line (as NP does) (thanks, @lbednarski)
- improve appearance of scrollbars on dialogs in dark mode
### Still to fix
- on very first run of v2.1.0b3 it may only display the Today section. On refresh it should display all sections.
### Dev only changes
- rescheduling/moving an item now uses REFRESH_ALL_ENABLED_SECTIONS not REFRESH_ALL_SECTIONS
- Make window width wider before 'Hard Refresh' appears, rather than 'HR'. Turn this button off entirely on iPhone.
- action 'refresh' -> 'refreshAll'
- action 'incrementallyRefreshSomeSections' -> 'incrementallyRefreshSomeSections' to better align it against 'refreshSomeSections'

## [2.1.0.b2] 2024-12-09
### Changes
- changed callbacks to be showDashboard, showSections and showPerspective. E.g.:
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showDashboard`
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showPerspective&arg0=Work`
  - `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showSections&arg0=DT,DO,@home`
### Fixed
- Fix Quarter section being shown erroneously (thx, @lbednarski)

### Dev changes
- remove use of combo component and use dropdown instead throughout
- fix errant css which was causing differences in dev rendering in Chrome
- add single line colored output on build success - dwertheimer
- change name of "dropdown" to "dropdown-select" ... - dwertheimer

## [2.1.0.b1] 2024-12-08
First beta for 2.1.0.  A major effort by @jgclark and @dwertheimer over the last 4 months.
### New
- new Perspectives dropdown menu that allow you to switch very quickly between different complete sets of settings.
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

### Changed
- speeded up data generation significantly in some places (particularly refreshes), and everything else should feel snappier
- child items are now indented like in the NP Editor
- in the item dialog, there's now a note if an item has children
- the "Ignore items in calendar sections with these term(s)" are now checked case-insensitively
- the completed task count is now smarter and quicker at operating, and covers tasks completed in notes not shown in the current Dashboard sections.
- turned off underlining on the 'take a break' message lines, and added colouring of it from your theme's completed task colour
- Week/Month/Quarter sections now show a compact line so that their respective add buttons will show, even when there are no open task/children items to show.
- improved details in title of project dialogs
- changed order of skip buttons in Interactive Processing dialog
- new type of dialog to replace the command bar for adding new tasks/checklists, and some other operations
- the layout has been polished up in lots of places
- removed setting "Add dashboard auto-update trigger when dashboard opened?" ('autoAddTrigger')

### Fixed
- worked around an API limitation so that you can add tasks/checklists to future calendar notes that don't exist yet.
- fixed some items not being found when referenced to weekly notes
- add time to @done(...) when "completing then"
- fixed spinner icon not spinning
- projects that are paused are now not shown in the projects section
- changed Interactive Processing icon to not imply 'refresh'
- fixed various things related to truncated display of long tasks, particularly those with bare or Markdown-style URLs
- improved ordering and descriptions of some of the settings

## [Perspectives.a26 = 2.1.0.a26] @jgc, 2024-12-06
- (dbw): Improvements to layout and contents of Perspectives Table
- (dbw + jgc): Improvements to styling of DynamicDialog heading selector
- (jgc): fixed the DynamicDialog header displaying long titles over 2 lines
- (jgc): Moved 'Automatic Update frequency' setting to 'Display settings'
- (jgc): Changed 'calendar add' icon in taskDialog to match what is now on the main window
- (jgc): Sort the perspectives list alphabetically not order of creation
- (jgc): Further fixes to PerspectivesTable layout, particularly for the many switches
- (jgc+dbw): Promote PerspectivesTable out of being an FF, to a  new 'Edit All Perspectives...' menu item.
- (jgc): Further tweaks to titles and descriptions in settings text.
- (jgc): Fix to allow adding tasks to future calendar notes that don't exist yet.

## [Perspectives.a25 = 2.1.0.a25] @jgc, 2024-12-05
- (jgc): New callback `setPerspective&arg0=<name>`; added details to README
- (jgc): Layout tweaks to suit other themes
- (dbw): Pulled 'postcss' out of the rollup again
- (dbw): Added clever computation of DropdownSelect width
- (jgc): Made default Perspective settings generic ready for beta test
- (dbw): New Perspectives Table view
- (jgc): Tweaks to layout of Perspectives Table
- (jgc): Moved 'displayCount' setting into the next section of settings

## [Perspectives.a24 = 2.1.0.a24] @jgc, 2024-12-01
- (dbw): Fixed Bug: Perspective > Save as... is not immediately showing the "Rename/Delete" options #dbwDR 
- (dbw): Fixed Bug: After delete all perspectives, there is still a "rename" etc. in the dropdown
- (dbw): Fixed CI test failing for me but not for jgclark #dbwDR
- (dbw): Add a "copy perspective settings" command whereby you can copy the current settings to an already-existing named perspective. Also the back-end function for copyPerspective.
- (dbw): Dashboard CSS edits don’t fire rollup rollup 
- (dbw): changed the dropdown menu in the new task popup to use my custom dropdown (changed dataGen to use "dropdown" instead of "combo")
- (dbw): styled the separator in the perspectives dropdown

## [Perspectives.a23 = 2.1.0.a23] @jgc, 2024-11-29
- (dbw): fix to add new perspective
- (dbw): fix to rename perspective
- (dbw): add confirmation dialog to delete perspective
- (dbw): More improvements to dev logging for React
- (dbw): Add setting to hide/show the test pane
- (dbw): Show when tests are skipped
- (dbw): Updates to DynamicDialog to allow yes/no dialogs
- (jgc): Removed the unused 'updateTagMentionsOnTrigger' from settings and README etc.
- (jgc): Removed earlier 'ignoreTagMentionsWithPhrase' from settings and README etc. (now ignoreItemsWithTerms)
- (jgc): Changed styling of DynamicDialog to sort the extra flexibility it now has
- (jgc): finished changing the section addButtons to use DynamicDialog not command bar. Applied to D, W, M, Q.
- (jgc): fixed Settings dialog scrollbar colours to work in dark mode, not just light mode

## [Perspectives.a22 = 2.1.0.a22] @jgc, 2024-11-26
- (jgc): Nudge top of settings dialog down slightly, to stop it from sometimes obscuring the current Perspective name.
- (jgc): Add new 'Moving/Scheduling Items' heading in Settings dialog
- (dbw): Lots of fixes and improvements to dev logging for React
- (dbw): Fix switch to clean perspective when modified
- (dbw): Added 'Rename Perspective...' action to UI
- (jgc): Added renamePerspective handler action to back end (but race condition)
- (dbw): Changed cleanDashboardSettings() so perspectives is only global setting
- (jgc): added focus of DD input box for renamePerspective
- (jgc): tweaked and simplified DynamicDialog header layout FIXME: but some CSS is appearing from nowhere that I can find, and so DD title is still too narrow.
- (jgc): started changing the section addButtons to use DynamicDialog not command bar
- (jgc): fix to {s} appearing in section description

## [Perspectives.a21 = 2.1.0.a21] @jgc, 2024-11-23
- (jgc): remove the 'JSON control' and tidy up the area in the settings dialog around where it used to be.
- (jgc): updated README with basic info on Perspectives, ready for limited alpha testing.

## [Perspectives.a20 = 2.1.0.a20] @jgc, 2024-11-22
- (jgc): fix time block section not being generated -- really an error in NP settings, grr
- (jgc): taken out the tweaking of the time block line display, to make it easy to edit and complete etc. 
- (jgc): de-dupe time block section with Today section
- (jgc): on any type of refresh include the TB section (if enabled) to ensure it gets updated as often as possible to catch start/end of TBs
- (jgc): split up clickHandlers file -- now 6 of them
- (dbw): fixed FeatureFlags settings not persisting
- (jgc): yet more tweaking of section and item layout
- (jgc): added new 'Last Week' section and related 'move all' button
- (jgc): fix wrong description for 'Folders to Include' section
- (dbw): fix to '-' perspective updating
- (dbw): fix to add perspective
- (dbw): fix to delete perspective
- (dbw): fixes to new console log view
- (dbw): Make sure dash persp is first in displayed list
- (dbw): fix babel to work for jest and rollup for the app
- (dbw): improve logging
- (jgc): change priority detection to ignore ! not at start of content

## [Perspectives.a19 = 2.1.0.a19] @dbw, 2024-11-19
- MASSIVE MERGE from main into main-perspectives-merge-with-debug branch. (Hopefully) merged your latest changes with the perspectives code which seems to be working fairly reliably.
- In the process, I built a lot of debug tooling (see the DEV menu for FFlag Debug Panel). The testing code is still a WIP. What I find is that the refreshes that happen every time you make a change to settings go on for a long time and there's no way to know for sure when they are over. So it's hard to know when it's safe to test the "stable" state. But I wanted to provide this to you just to hopefully get us back on the same branch.
- added React components react-resizable-panels
- updated react to 18.3.1
- updated chroma-js to 3.1.2

## [Perspectives.a18 = 2.1.0.a18] @jgc, 2024-11-15
- (jgc): new layout in section heading for the add buttons. Also colour them the same as the section title. 
- (jgc): further tweaks to icons, including better optical matching of tasks and checklists
- (jgc): now Week/Month/Quarter sections now show a compact line so that their respective add buttons will show, even when there are no open task/children items to show.
- (dbw): Removed activePerspectiveName from dashboardSettings, and moved it to the perspectiveSettings (isActive flag)
- (dbw): Refactor to move syncing of dashboardSettings to and from the plugin to a single custom hook for better clarity
- (dbw): Built out some testing infrastructure: DebugPanel etc.

## [Perspectives.a17 = 2.1.0.a17] @jgc, 2024-11-13
- (jgc): new response type called "REFRESH_ALL_ENABLED_SECTIONS" and using that in place of "REFRESH_ALL_SECTIONS" in
  - doMoveToNote -- fallback option in case paragraph can't be found
  - doRescheduleItem
- (jgc): Removed REFRESH_ALL_SECTIONS at end of doSettingsChanged(), as that also does a setPluginData() call, which I think triggers updates. Needs checking by DBW
- (jgc): changed Dashboard component "startup only" useEffect to now only generate enabled sections. Updated this to handle new TimeBlock section which is generated and shown before Today section, when enabled.
- (jgc): fixed background color issue from a16
- (jgc): applied the stringListOrArrayToArray() to other places it was needed for excludedFolders 

## [Perspectives.a16 = 2.1.0.a16] @jgc, 2024-11-13
- (jgc): The "Ignore items in calendar sections with these term(s)" are now checked case-insensitively (for @dwertheimer)
- (jgc): Made the "Nothing left on your list for today: take a break" display line show in the colour of a completed task, and gave the background of the section a subtle hue of the completed task color as well.
- (jgc): ItemGrid.jsx has a flag you can set to turn on all sections having a subtle background hue taken from their title color.
- (jgc): new getListOfEnabledSections() dashboardHelpers function.
 
## [Perspectives.a15 = 2.1.0.a15] @jgc, 2024-11-10
- (jgc): Added new 'Current Time Block' section at the top of the window. Prepared two slightly different layouts for it.
- (jgc): Lots of refactoring of the timeblocks.js helper functions, added new ones, and made sure they respect NP's 'timeblockTextMustContain' NP preference, which was added after most of our plugin work on time blocks.
- (jgc): Child tasks are now ordered following their parents, when sorted by priority
- (jgc): The completed task count is now smarter and quicker at operating, and covers tasks completed in notes not shown in the current Dashboard sections.
- (jgc): Stopped the 'Refresh' button text from becoming 'Refreshing' briefly. It's always been distracting to me the way it changes width. Instead it now dims the text a bit when its refreshing.  _David, see what you think, please._

## [Perspectives.a14 = 2.1.0.a14] @dbw, 2024-10-24
- Added setting for display of done counts to Dashboard (displayDoneCounts: default true)
- Total refactor of interactive processing code to make it more maintainable and fix some bugs
- Total refactor of Dashboard Settings and PerspectiveSettings components using useReducer for state management and improved visibility
- Improved PerspectiveSelector dropdown data saving (using useReducer) and made it more robust
- Added "Add Perspective" and "Save Perspective" buttons to PerspectiveSelector dropdown
- Added some code back in to make BANNER messages display again at the top of the page when there are errors
- Added a LOT of logging to ensure the right things are happening, but it's super noisy. Will delete most of it before final release.
### Todo
- fix bug in task dialog where priority markers are not being updated in interface
- (jgclark): fix the CSS selectors that are messing up the rollup build

## [Perspectives.a13] @jgc, 2024-10-11
- fixed build's circular dependency warnings
- optimised the 'Refresh' work: it should now only recalculate the visible sections.
- updated references to newer Dashboard functions
- when adding a new Perspective, ensure no reuse of an existing name, no * at end, and not -
- been testing addPerspective() and deletePerspective(). Confirmed they work OK, writing to disk. FIXME: The messages aren't getting through to the front end though.

## [Perspectives.a12] @jgc, 2024-09-20
- add time to @done(...) when "completing then"
- fixed some items not being found when referenced to weekly notes
- child items are now indented like in the NP Editor
- in the item dialog box, there's now a note if an item has children
- updated demo data to update data structures for children
- tidy up vertical spacing in Settings dialog
- added version number to end of Settings dialog
- improved details in title of project dialogs
- got the linkage between settings items partly working again -- FIXME: though its not updating live
- fixed Interactive Processing bug on close dialog-click
- change button order of skip buttons in Interactive Processing dialog

## [Perspectives.a11] @jgc, 2024-09-19
- added `isAChild` logic, a new marker icon to show children, and a new "Show parent/child markers on items?" setting.
- the 'All -> Today' and 'All -> Tomorrow' buttons now don't try to move child items on their own, but only as part of the block with their parent.
- complete for 'Overdue -> Today' button as well
- TODO: update Interactive Processing button to not show child items that have already been moved. (Started but not finished.)
- fix typos in "Move all to today" dialog 
- fixed spinner icon not spinning
- projects that are paused are now not shown in the projects section
- changed Interactive Processing icon to not imply 'refresh'
- stop check dialogs on "Move all ..." operations on iOS/iPadOS, as they stopped them working
- fixed various things related to truncated display of long tasks, particularly those with bare or Markdown-style URLs
- dbw: brought back the (hidden) plugin settings for ios so that we could tell an iOS or ipad user how to set debug logging by clicking  [Change Dashboard Settings](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Update%20plugin%20settings) TODO: maybe you could include that in a pinned note for dashboard?

## [Perspectives.a10] @jgc, 2024-08-27
- fix a regression in dropdown menu
- add tooltips to buttons in Task and Project dialogs

## [Perspectives.a9] @jgc, 2024-08-26
- migrated FFlag_Perspectives to a main, visible, setting perspectivesEnabled, defaulting to true.
- new `controlsOtherKeys` field in TSettingItem, which will change if/how other settings are shown.
- clicking on 'there are X items hidden' message lines now turns off filtering in all sections (started in a7)
- more layout improvements in Header, including moving Perspective selector back to the left-hand side.
- Fixed project progress 'pie charts'  layout issues, and added them in to the project dialog header.

## [Perspectives.a8] @jgc, 2024-08-21
- Fixed full generation sometimes having Project rather than Priority section
- Removed double generation of Tag sections in getSomeSectionData()
- Updated Demo Data to allow fuller testing of Perspectives and other filtering
- Settings dialog:
  - made <input> boxes wider
  - made the (temporary) currently active perspective box read-only. (There is now a 'input-readonly' type.)
  - improved some other layout. Includes now allowing 'heading' type to have a description ... something I wished EM had added in the main app.
- Tweaked layout in header area
- removed 'autoAddTrigger' setting and logic
- dbw: make "-" an actual perspective that holds the values of your settings when there is "no" perspective
- dbw: add the "*" thing when you edit a saved perspective
- stoped the "*" thing from being appended multiple times
- removed .isActive
- added .isModified throughout, and updated display logic
- lots of work on perspectiveHelpers functions to clarify what each needs to do, and removed some old code. But FIXME: most/all of the comms about changes between backend and frontend doesn't seem to be working.
  - includes new switchToPerspective() function

## [Perspectives.a7] @jgc, 2024-08-14
- removed some of the circular dependencies
- updated names of some settings, particularly `ignoreFolders`
- added updateCurrentPerspectiveDef(), and "/Update current Perspective" command for testing. FIXME: is failing to read dashboardSettings properly.
- added saveAllPerspectiveDefs() to make one place to save changes (at least on the back end). FIXME: need to get this to affect front end too.
- turned off underlining on the 'take a break' message lines
- clicking on 'there are X items hidden' message lines now should turn off filtering. (Incomplete.)
- fixed missing 'enableInteractiveProcessingTransitions' setting in types.js
- dbw: RUN THE /DELETE ALL PERSPECTIVES COMMAND BEFORE YOU TRY ANYTHING BECAUSE THERE WERE LEGACY ISSUES
- dbw: got perspective switching to work reliably
- dbw: fixed bug where watcher was seeing first set of perspectives and calling back-end again
- dbw: got JSON editing in settings panel to work/save reliably
- dbw: fixed bug where saving perspectives JSON in the settings panel was writing the perspectives into the dashboardSettings, creating lots of clutter
- dbw: changed /add new perspective to copy current window settings (init does not copy all settings from defaults, as this is unnecessary)
- dbw: created a cleaning function (cleanSettings()) that cleans keys we don't want to save recursively in dashboardSettings. You will want to complete the list of keys which should *not* be saved because we don't want to overwrite *all* the user's settings (e.g. FFlags etc.)
- dbw: removed pulling of perspectives in the backend. changing a perspective changes all the settings, so the back-end doesn't need to know or do anything different than before
- dbw: fixed a bug in the partially-implemented include/exclude folders bit that was keeping code from running. This code still needs to be completed
- dbw: started trying to fix the dialog-window-needs-repositioning-when-calendar-is-open issue but ran out of time and did not get it to work. I'm confident it's 90% right...just some small edit needed to make it work.

## [Perspectives.a6] @jgc, 2024-08-10 WIP for @dbw
- fixed perspectiveSetting initialisation in WebView (I think) and how to persist it in Dashboard::useEffects (I think)
- BUT FIXME: changing PerspectiveSelector logs the right newValue, but it then fails to get updated anywhere else
- dealt with FIXME in dataGeneration about calling `getProjectSectionData`
- added "/Add new Perspective" to help debug. Simply asks for name/ignoreFolder/includeFolder items for now. FIXME: doesn't persist or show the new perspective, despite it logging ok
- added "/Delete Perspective" and "/Delete all Perspective Settings" commands -- to help debug (actually added in a5)
- added subtle hover effect to UI buttons, using the clever new CSS 'hsl' operator
- changed properly to "Dashboard.css" (capital D) to match the Component name

## [Perspectives.a5] @jgc, 2024-08-09 WIP for @dbw
- made a separate perspectiveSettings data structure, than now includes all settings, not just the 5 from the proof of concept. @dbw: something is wrong with the initialisation of perspectives.
- tighten up removal of priority indicators, to only happen at the start of a line's content
- now won't display buttons in the Section header if there are no items to work on. (However, the 'add' buttons in the calendar sections are still shown.)
- dbw: fixed new circular issue in perspectives import by moving shared items to new perspectivesShared.js file
- dbw: fixed incorrect "import '../css/Dashboard.css'" (Dashboard does not have capital D)
- dbw: removed HTML loading of that CSS file because it is now loaded in React/Rollup
- dbw: TooltipOnModifier: you were correct that the empty div issue was fixed. Removed the FIXME
- dbw: Per your question/comment, changed "getSettingsDefaults()" to "getSettingsObjectFromArray()"
- dbw: Fixed a logDebug that was failing on empty lastFullRefresh
- @jgclark: Pls look at ThemedComboBox - I left you some FIXME questions
- @jgclark: Pls look at my FIXME question in dataGeneration/getAllSectionsData()
- @jgclark: Pls look at initialisePerspectiveSettings() -- I partially fixed it but didn't know how to fix it because I didn't know what it was supposed to do. I really need some direction on the intention so I can suggest how it should work. I think we should go straight to having a perspectives context and this seems to be mixing the two in ways I don't follow. Some line-by-line comments with your intentions would help me.

## [Perspectives.a4] -- all WIP not fully working, @jgc,  2024-08-06
- separated out PerspectiveSelector
- _before transition to separate perspectiveSettings data structure_

## [Perspectives.a3] -- all WIP not fully working, @jgc,  2024-08-04
- new "/Add new Perspective" command (and callback)
- new "/Delete Perspective" command (and callback)
- added Perspective selector to Header bar -- but doesn't get saved
- added JSON setting display/editor to Settings dialog (a temporary measure during development)
- merged changes from v2.0.5 on main branch, so added Priority Section.

## [Perspectives.a2] 
- perspective folder filtering working for Calendar + Project sections
- added a 'congrats' message if there are no Projects left to review

## [Perspectives.a2] 
- can now save activePerspectiveName
- nicer-looking PerspectiveDefinitionSettings component -- though it doesn't yet persist changes
- Projects section now filters using perspective folders
- updated Settings component's display logic to allow a 'compact' mode where sensible

## [Perspectives.a1] 
- remove setting "Add dashboard auto-update trigger when dashboard opened?" ('autoAddTrigger')
- started to add settings to define Perspectives
-->

<!-- ---------------------------------------------------------------------- -->

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
