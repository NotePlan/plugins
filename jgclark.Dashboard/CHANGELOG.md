# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

## [Perspectives.a15 - 2.1.0.a15] underway
- (jgc): Child tasks are now ordered following their parents, when sorted by priority
- (jgc): The completed task count is now smarter and quicker at operating, and covers tasks completed in notes not shown in the current Dashboard sections.
- (jgc): Stopped the 'Refresh' button text from becoming 'Refreshing' briefly. It's always been distracting to me the way it changes width. Instead it now dims the text a bit when its refreshing.  See what you think.

## [Perspectives.a14 - 2.1.0.a14] @dbw, 2024-10-24
- Added setting for display of done counts to Dashboard (displayDoneCounts: default true)
- Total refactor of interactive processing code to make it more maintainable and fix some bugs
- Total refactor of Dashboard Settings and PerspectiveSettings components using useReducer for state management and improved visibility
- Improved PerspectiveSelector dropdown data saving (using useReducer) and made it more robust
- Added "Add Perspective" and "Save Perspective" buttons to PerspectiveSelector dropdown
- Added some code back in to make BANNER messages display again at the top of the page when there are errors
- Added a LOT of logging to ensure the right things are happening, but it's super noisy. Will delete most of it before final release.
### Todo
- fix bug in taskdialog where priority markers are not being updated in interface
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
- migrated FFlag_Perspectives to a main, visible, setting showPerspectives, defaulting to true.
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
