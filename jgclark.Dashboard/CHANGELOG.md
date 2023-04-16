# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's README](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

## [0.4.1] - 2023-04-12 (not publicly released)
- get /demo version of this up to date with new "Show referenced items in separate section?" setting.
- minor tweaks to column 1 display

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
