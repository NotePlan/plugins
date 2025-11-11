# dwertheimer.TaskSorting Changelog

## About dwertheimer.TaskSorting Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskSorting/README.md) for details on available commands and use case.

## [1.2.8] - 2025-11-10 (@dwertheimer)

- Fix for sorting tasks with combined/interleaved tasks and checklists

## [1.2.7] - 2025-11-06 (@dwertheimer)

### New Features
- **NEW**: Interactive mode (`/ts`) now prompts users to choose task type grouping (combine related types or keep separate)
- **NEW**: Added plugin setting "Combine Related Task Types?" for quick sort commands (`/tsd`, `/tsm`, `/tst`, `/tsc`)
  - When enabled (default): Combines tasks (`*`) with checklists (`+`) into 4 logical groups
  - When disabled: Keeps all 8 task types completely separate (traditional mode)
- **NEW**: Customizable task type headings - 8 new settings allow you to rename headings for localization or personal preference
  - Configure in Plugin Preferences → "Task Type Heading Customization"
  - Examples: Change "Open Tasks" to "Tareas Abiertas" (Spanish) or "任務開放" (Chinese)
- **NEW**: Setting to control display of empty task category headings
  - "Show Empty Task Category Headings?" (default: off)
  - When disabled, only categories with tasks will show headings

### Bug Fixes
- **FIXED**: Task type headings (e.g. "Open Tasks:", "Completed Tasks:") no longer duplicate when running sort commands multiple times
- **FIXED**: Headings now appear correctly in interactive mode when user selects "yes" to include headings
- **FIXED**: Scheduled tasks now appear under "Scheduled Tasks" heading instead of being incorrectly grouped under "Open Tasks" when both headings and interleaving are enabled
- **FIXED**: Task type sections now output in correct order (Open → Scheduled → Done → Cancelled) instead of reversed order when using headings with interleaving
- **FIXED**: Corrected "Completed Cancelled Items" typo to "Cancelled Checklist Items"
- **FIXED**: Empty task category headings (with no tasks underneath) are now properly removed to avoid clutter

### Improvements
- **IMPROVED**: All default sort commands now respect the new "Combine Related Task Types?" setting
- **IMPROVED**: Better documentation and clearer command descriptions for task grouping feature
- **IMPROVED**: Added detailed logging for interleaving choices in debug mode

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

