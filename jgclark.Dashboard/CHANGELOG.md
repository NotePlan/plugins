# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

## [Perspectives.a5] @jgc,  2024-08-09 WIP for @dbw
- made a separate perspectiveSettings data structure, than now includes all settings, not just the 5 from the proof of concept. FIXME: something is wrong with the initialisation of perspectives.
- tighten up removal of priority indicators, to only happen at the start of a line's content
- now won't display buttons in the Section header if there are no items to work on. (However, the 'add' buttons in the calendar sections are still shown.)

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

<!-- ## Placeholder for 2.1.0
- TODO: new 'Notes' section ...
- TODO: add active links to section titles in description area -->

## [2.0.5] 2024-07-30
- some layout tweaks in the main Settings dialog
- fix to 'All -> Today' button action in Overdue section (thanks, @Oldielajolla).

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
