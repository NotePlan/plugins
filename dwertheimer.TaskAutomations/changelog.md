# Task Automations Plugin Changelog

> **NOTE:**
> See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskAutomations/readme.md) for details on commands and how to use it

# What's Changed in this Plugin?

## [2.3.0] (@dwertheimer) 2022-09-04

- Added overdue task review

## [2.2.0] (@dwertheimer) 2022-08-27

- Add sort by due date

## [2.1.5] (@dwertheimer) 2022-08-27

- Work around bug in removeParagraphs() that resulted in duplicates if lines are not in lineIndex order

## [2.1.4] (@dwertheimer) 2022-08-27

- Add logging to try to identify Editor crash

## [2.1.3] (@dwertheimer) 2022-08-27

- Fix Readme and docs. Thx @jgclark for the Eagle Eye

## [2.1.1] (@dwertheimer) 2022-08-27

- Fix typo
- Attempting to reduce lag in changes reflected in Editor

## [2.1.0] (@dwertheimer)

- Added /tsd default task sorting settings
- Added default settings for headings/subheadings in output
- Added task sort by hashtag/mention (for @George65)

## [2.0.0] 2022-07-12 (@dwertheimer)

- Added commands:
  - /open todo links in browser
  - /open URL on this line

## [1.6.2] 2022-05-17

- adding /cth and copy tags /ctm /ctt

## [1.6.1] 2022-05-09

- added /cta copy tags from line above

## [1.6.0] 2022-03-18

- Add >today and remove @done per @pan's suggestion

## [1.5.1] 2021-12-30 @dwertheimer (thx @jgclark for all the bug reports)

- Fixed edge case where insertion index is different for Project Notes and Calendar Notes

## [1.5.0] 2021-12-30 @dwertheimer (thx @jgclark for all the bug reports)

- Removing /ott for time being due to bugs (swallowing tasks) in the underlying sweepNote code which needs refactoring
- Added question in /tt whether you want headings
- Removed blank line
- Fix readme link

## [1.4.0] 2021-11-29 @dwertheimer

- Minor under-the-hood refactors -- changed imports to use functions that were moved to the helpers/sorting file (deleted them from here)
- Added a line break in one line for output

## 1.3.0

- taskSorter: Added support for bringing indented content under tasks with the tasks
- taskSorter: Started to add support for task sorting in templates [WIP]

## 1.2.0

- Added  to bring OPEN tasks (only) to the top without sorting

## 1.1.0

- Added /tt command to bring tasks to the top of a note without sorting
- Turned off the pre-flight task backup

## 1.0.1

- updated: now compiled for macOS versions back to 10.13.0

1.0.0 Removing "macOS.minVersion" which is no longer necessary due to transpiling
0.0.6 Added subheadings for tags/mentions & headless commands /tsm and /tst
0.0.5 Sort by priority or by #tag or @context/person or content/alphabetical
0.0.4 Added /mat command to reset completed tasks (or to set all open as complete), per request from @JaredOS
0.0.3 Adding  "macOS.minVersion": "10.15.7"
0.0.2 Initial /ts version
