# dwertheimer.TaskSorting Changelog

## About dwertheimer.TaskSorting Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskSorting/README.md) for details on available commands and use case.

## [1.2.6] - 2025-09-23 (@dwertheimer)

- Add logging for jgclark to sortTasksUnderHeading
- Add ability to pass all params to /ts and /tsh commands
- remove sortTasksViaTemplate code which was never a published command
- change default behavior of /ts* commands to interleave task types (open/checklist together)
- **NEW**: Add `sortInHeadings` parameter to `/ts` command to override DataStore setting
  - `sortInHeadings: false` treats entire note as one unit (moves all open tasks to top)
  - `sortInHeadings: true` sorts tasks within each heading separately (default behavior)
  - Allows x-callback-url calls to specify sorting behavior regardless of user's DataStore settings 
- Fix bug where tasks were not being sorted in headings for frontmatter-only notes

## [1.2.4] - 2025-08-31 (@dwertheimer)

- Add saveEditorIfNecessary() to all commands

## [1.2.3] - 2025-08-29 (@dwertheimer)

- Add sortTasksViaTemplate command to sort tasks via a template.

## [1.2.2] - 2025-08-29 (@dwertheimer)

- Remove NotePlan popup nag on repeat deletion check using Editor.skipNextRepeatDeletionCheck

## [1.2.1] - 2025-08-29 (@dwertheimer)

- Added noteOverride parameter to sortTasksUnderHeading command for @jgclark

## [1.2.0] - 2025-01-25 (@dwertheimer)

- Added sortTasksUnderHeading command to sort tasks under a heading.
- Added /cnt command

## [1.1.0] - 2024-05-26 (@aaronpoweruser)

- Added /cnt command to copy **all** noteTags to **all** tasks in a note.
- Added an onSave trigger command for cnt.


## [1.0.0] - 2024-01-?? (@dwertheimer)

