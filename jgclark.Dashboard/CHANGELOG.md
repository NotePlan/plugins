# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

## [0.8.0] - 2024-01-06
- added action button '≯' to 'unschedule' a task. (This is only relevant on tasks referenced/scheduled to calendar notes.)
- added action button '✓then' to complete an overdue task, but marks it `@done(...)` at the original time, not today.
- added action buttons 'skip ...' to items in the Project section. (This does the equivalent of "/skip project review", skipping the review of that note for the period shown.)
- added new 'Theme to use for Dashboard' setting for @anton.skliar. If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme.

## [0.7.4] - 2023-12-26
### Added
- added some action buttons (the ones that appear when you hover) to the Tag section.
- if you use the Projects & Reviews plugin, when the project list is refreshed, it will now also refresh the Dashboard's display of Projects overdue for review if it is open.

### Change
- the 'Max number of items in show in section' setting now applies to the Tag section, as well as the Overdue Tasks section.

### Fixed
- edge case where a weekly item wouldn't move to the next week with '+1w' button

## [0.7.3] - 2023-12-05
### Added
- New action button `pri` that cycles the priority of the current item from none -> `!` -> `!!` -> `!!!` -> `>>` -> none
- New action button `◯/◻︎` that toggles an item between being a task and a checklist
- `⌘R` keyboard shortcut now should refresh the Dashboard if the window has focus -- though it seems to require a first click somewhere in the window before it will work.
### Fixed
- Moving an item to the next week wasn't working where NotePlan's first day of the week was to set to Sunday (thanks to @george65 for helping to get this fixed)

## [0.7.2] - 2023-11-21
### Changed
- Now removes a whole section when the last item in it is completed. (Apart from the 'TODAY' section which always remains, so that the add new task/checklist buttons are still available.)
- Removed the 'preview' effect when hovering the mouse over the open task or checklist marker: when moving the mouse too quickly, this could land up showing misleading state.
### Fixed
- Fix some 'move item' buttons not working in new Overdue Items section

## [0.7.1] - 2023-11-20
### Added
- 'Folders to ignore' setting now applies to the Overdue tasks section as well (resolves #496)
  - add '->today' button on Yesterday section items
- two new experimental buttons on Overdue tasks, turned on by new checkbox at bottom of settings screen:
  - complete an overdue task on the day it was due, not today
  - toggle an item between being a task and a checklist
- the plugin should now auto-update to minor and point releases.

## [0.7.0] - 2023-11-17
### Added
- new optional 'Overdue Tasks' section (requested by @dwertheimer and @george65). There are some new settings to help tailor this to your way of working.
- new optional 'Yesterday' section (requested by @george65)

### Changed
- the Tags/Mentions section now excludes open tasks/checklists that are scheduled to the future (using `>date`)
- long raw URLs are now displayed in a shortened form
- minor tweaks (mostly updating libraries)
- removed styling for underlines, as it breaks bare URLs that contain a `~` character

## [0.6.2] - 2023-09-22
- Tasks/checklists in calender notes that are scheduled to the future (by a `>date` string) are now excluded. (Request #471 by @dwertheimer)
- Can now run Dashboard at the same time as other plugins with HTML windows. (Requires NotePlan v3.9.6.)
-  Allow Dashboard to run on iPad again (for @phenix)

## [0.6.0] - 2023-08-25
### Added
- adds tooltip on displayed tasks that allows task to be moved on to next day (`+1d`), next business day (`+1b`), this week's note (`wk`), next week's note (`+1w`) etc. (If you're wondering, this uses the same syntax as my Repeat Extensions plugin.)
- new setting 'Add dashboard auto-update trigger when dashboard opened?' which controls whether to add the auto-update trigger to the frontmatter to the current note in the Editor when you open the dashboard
- new setting 'Exclude tasks that include time blocks?' that controls whether to stop display of open tasks that contain a time block
- new setting 'Exclude checklists that include time blocks?' that controls whether to stop display of open checklists that contain a time block (for @dwertheimer)
- support for new NP theme item 'working-on' (invoked with a `>>` at the start of a task or checklist line)
- support for coloured (and curved) backgrounds on #tags, @mentions, priority !, !!, !!!, >> highlights, `code` fragments, ~underlining~, ~~strikethrough~~ and ==highlights== (if set in the theme)
- now renders ~underlining~, ~~strikethrough~~ and ==highlights== (if set in the theme)
- support for 'arrow date' references (e.g. `>2032-08-22<`).

### Changed
- (finally) **found a way for the very latest updates to be available to display, when using the auto-update trigger**
- the auto-update trigger should now fire when an open task/checklist is edited, not just added
- now truncates very long task/checklist items in the display
- now ignores open tasks/checklists that are in the relevant calendar note, but have a scheduled `>date`
- now will bring the Dashboard window to the front if run from the command bar or an x-callback, but will not take focus if it updates itself via a`` trigger.
- better translation of NP theme vertical spacing to the HTML display
- now hides the `!``, `!!``, `!!!`` or ``>>`` priority markers

### Fixed
- background of tasks with !! or !!! priority markers sometimes wrong
- tasks that include x-callbacks can now be checked off in the dashboard

### Todo
Note: - this plugin has *lots* of moving parts, and many of them have changed in this release. So there are some rough edges still. The main one being HTML layout issues with multiple columns and the floating buttons that I can't figure out (yet). There's also a bug somewhere in NP that means the window occasionally shrinks to zero height and can't be resized ...  Please raise any problems in the Discord `#dashboard-plugin` channel.

## [0.5.1] - 2023-07-21 (unreleased)
### Added
- tasks including markdown bold and italic text are now styled appropriately
- embedded images in tasks are now replaced with an icon
- new 'hover' effect over the todo circle and checklist square, to help hint that clicking will complete it (or command-click will cancel it).

### Fixed
- lots of edge cases
- 'Filter ...' checkbox

## [0.5.0] - 2023-07-14
### Added
- update open icon to completed or cancelled, as it disappears in the animation.

## [0.5.0-b3] - 2023-07-14 (not released)
### Added
- new optional section that displays all open tasks/checklists that contains a #tag or @mention that you can set in the optional new setting '#tag/@mention to show'. This is one way of showing all `#next` actions, for example.
- you can now also **cancel** an open task or checklist by pressing ⌘ (Command) when clicking on the open circle or square.
<!-- ### Changed
- changed message passing to use single object not multiple params
- better handling of strange punctuation in tasks and filenames -->

## [0.5.0-b2] - 2023-05-31 (not released)
### Changed
- tweaked layout of multi-column view to avoid most examples of a single item being split across two columns. (I can't find a way to avoid some cases.)
- will now re-display lower priority tasks when the last higher priority one has been completed.

## [0.5.0-b1] - 2023-06-28 (not released)
### Added
- new UI toggle "Filter out lower-priority items?": If set then items without any extra priority in calendar files will be hidden until there are no remaining priority items that haven't been completed. Priority items are currently indicated by having !!!, !! or ! at the beginning or end of the item.

## [0.4.2] - 2023-05-16
### Added
- now shows 'add task' and 'add checklist' icons, to allow you to add a task directly at the start of the current daily/weekly/monthly/quarterly note
    <img src="add-buttons@2x.png" width="200px">
- it now takes into account user's preferences for whether `*`, `-` and/or `1.` counts as the indicator for todos
- it now saves the size and location of the Dashboard window when you move or resize it, and reuses it when you re-open it, or refresh it. (Requires NP v3.9.1+)
### Changed
- when the dashboard window is refreshed in the background by a trigger, it will no longer 'steal focus' by bringing the window to the front.
- the cursor now changes when over the open task circle or checklist square, to help indicate it can be clicked

## [0.4.1] - 2023-04-16
- fixed bug reported by @csdlajolle
- minor tweaks to column 1 display
- get /demo version of this up to date with new "Show referenced items in separate section?" setting.

## [0.4.0] - 2023-04-08 (first public release)
### Added
- supports open items in quarterly notes too
- new setting "Show referenced items in separate section?" This controls whether to show Today's open tasks and checklists in two separate sections: first from the daily note itself, and second referenced from project notes.\nThe same also goes for Weekly/Monthly/Quarterly notes.

## [0.3.7] - 2023-04-02 (private beta 5)
### Fixed
- regression resulting from new settings 'excluded folders'

## [0.3.6] - 2023-04-02 (private beta 4)
### Added
- new setting 'Folders to ignore when finding linked items' which can help if you have sync'd lines in Saved Searches.
- added links to section titles (e.g. "This Week")
### Fixed
- note links in the 3rd section opened the wrong notes

## [0.3.5] - 2023-04-01 (private beta 3)
### Added
- now shows items from monthly notes as well (for @fulcanelli and @bullseye)
- now suppresses empty sections if there aren't any open tasks in it (apart from the current daily note, where it will still show a congratulatory message)
<!-- split out CSS to a separate file -->
### Fixed
- now supports a special font used in Apple Dark and related themes

## [0.3.4] - 2023-03-31 (private beta 2)
### Added
- will now offer to install the required "Shared Resources" plugin if that's not already installed
- new 'window width' and 'window height' settings to set the default width and height the dashboard will use
### Changed
- made the font size slightly larger, to match that of your normal setting in NotePlan windows (for @fulcanelli)

## [0.3.3] - 2023-03-29 (private beta 1)
### Fixed
- some note-links on section 2 and 4

Note: I'm trying to solve a problem when using this with its trigger, that NP hasn't finished updating itself before it re-calculates the Dashboard display.

## [0.3.2] - 2023-03-25
### Changed
- a new way of testing when to refresh the dashboard based on changes in daily/weekly notes. This avoids most false positives.
### Added
- command to edit settings, even on iOS
- new Debug setting for Triggering dashboard refreshes

## [0.3.1] - 2023-03-15
### Added
- when completing a task/checklist in the dashboard, it will now have a @done(...) date added if the user has 'add completion date' setting ticked.
### Fixed
- clicking note links with apostrophes in them

## [0.3.0] 2023-03-11
### Added
- when clicking on a paragraph, it will now highlight the right paragraph in the editor, not just open the note
- will now automatically update the dashboard window when a change is made in the relevant calendar note. (This requires adding `triggers: onEditorWillSave => jgclark.Dashboard.decideWhetherToUpdateDasboard` to the frontmatter of the relevant daily/weekly note.)
- supports multi-column display, when the window is wide enough
- de-dupes items that would appear twice in a list because the lines are sync'd together
- Now updates the totals and counts

## [0.2.0] 2023-02-28  (unreleased)
### Added
- Tasks and Checklist items can now be marked as completed; the underlying NotePlan note is updated, and the item is removed from the list in the window. (Big thanks to @dwertheimer for the clever bi-directional infrastructure that makes this possible.)
- Note: This relies on the new "Shared Resources" plugin to be installed and active.

## [0.1.0] (unreleased)
- first version, providing read-only view of all tasks and checklists due today or this week. Plus list of the next 3 projects to review (if you use the Projects + Reviews plugin.)
