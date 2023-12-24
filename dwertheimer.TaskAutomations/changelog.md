# Task Automations Plugin Changelog

> **NOTE:**
> See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskAutomations/readme.md) for details on commands and how to use it

## What's Changed in this Plugin?

## [2.18.0] @dwertheimer 2023-12-?? 

- Started saving most frequently used choices in prefs for future potential use in commandbar options sorting per user
- Refactored much of the overdue processing under the hood to make it more modular and testable for the future
- Bug fixes under the hood

## [2.17.0] @dwertheimer 2023-08-29

- Overdue processing: change edit to allow you to opt-click a date return you to edit
- Overdue processing: added p1,p2,p3 options. Thx @george!

## [2.16.0] @dwertheimer 2023-08-23

- Overdue processing: Add move-to-note as list/checklist option

## [2.15.0] @dwertheimer 2023-06-10

- Removed URL opening commands and moved them to Link Creator

## [2.14.5] @dwertheimer 2023-05-23

- Change order of interactive task review (look for forgotten tasks before week/today)

## [2.14.4] @dwertheimer 2023-05-10

- Improve handling of scheduling overdue tasks for future (e.g. tomorrow):
  - "Review tasks for Today?" was still using *today*, changed it to correctly use whatever day you have been reviewing
  - Same for review for this week

## [2.14.3] @dwertheimer 2023-04-25

- Fix bug that was overlooking forgotten tasks without dates.

## [2.14.2]

- XCallback bug fix

## [2.14.1]  @dwertheimer 2023-04-20

- Processing overdues as of a date in the future. Useful for planning the night before.

## [2.14.0]

- Beta test of processing overdue-tomorrow feature

## [2.13.2] @dwertheimer 2023-04-19

- Fix @jgclark sorting edge case where scheduled type was being calculated and impacting sort

## [2.13.1] @dwertheimer 2023-04-12

- Fix regression bug that was always returning you to Overdue view

## [2.13.0] @dwertheimer 2023-03-10

- Add Overdue Popup Window for a Specific Folder
- Add Today's Tasks to React Popup

## [2.12.5] @dwertheimer 2023-04-08

- Add counts to filter

## [2.12.4] @dwertheimer

- Fix filter dropdown bug 2023-04-08

## [2.12.2] @dwertheimer

- Document xcallbacks for React view

## [2.12.1] @dwertheimer 2023-04-07

- Remove checklists from search which crept in when `isOpen`func was expanded to include them

## [2.12.0] @dwertheimer 2023-04-07

- Add type filter to React View

## [2.11.4] (@dwertheimer) 2023-03-26

- roll back scheduled types per <https://discord.com/channels/763107030223290449/1015086466663202856/1089721078957473813>

## [2.11.3] (@dwertheimer) 2023-03-26

- Bug fix
- Add iOS Preferences

## [2.11.2] (@dwertheimer) 2023-03-26

- Add scheduled tasks to overdue types

## [2.11.1] (@dwertheimer) 2023-03-12

- Removed error noise on task sorting when lines were note tasks

## [2.11.0] (@dwertheimer)

### Added

- Task Sorting: Skip Done/Cancelled; Include Checklist in Sorting
- React Overdue task processing view v1
- Overdue: change to checklist type

## [2.10.0] (@dwertheimer)

- Added weekly note review question after overdue (and \n'/Review/Reschedule Tasks Scheduled for this week' command

## [2.9.2] (@dwertheimer) 2022-11-11

- Improve overdue messaging for Skip/Leave item

## [2.9.1] (@dwertheimer) 2022-11-08

- Open follow up when placed in a future note (so you can edit it)

## [2.9.0] (@dwertheimer) 2022-11-07

- Added 'This reminds me (new task) so you can add a task that just came to mind without stopping the overdue scan

## [2.8.0] (@dwertheimer) 2022-11-06

- Added follow-up tasks (thx @cyberz @antony.sklyar && @QualitativeEasing)

## [2.7.2] (@dwertheimer) 2022-10-24

- More API bug workaround hacks

## [2.7.1] (@dwertheimer) 2022-10-24

- API bug workaround hack (hope to remove it soon)

## [2.7.0] (@dwertheimer) 2022-10-23

- Beta of /task sync for testing

## [2.6.0] (@dwertheimer) 2022-10-19

- Added /sth - sort tasks under heading

## [2.5.0] (@dwertheimer) 2022-10-19

- Added weekly tasks to marooned task search
- Added open task search (separate from overdue)
- Added weekly reschedule tags (to point tasks to weekly note)
- Added capability to review items marked for today
- Added day names for rescheduling
- Added preference to review today's tasks after overdue review
- Removed Date+ - no longer necessary with overdue scan
- /ts - changed the way deletes are done under the hood to make it more reliable
- /ts - add task sort under headings

## [2.4.1] (@dwertheimer) 2022-09-04

- Overdue: Remove tasks which have been dealt with (@jgclark)
- Overdue: Changes to instructions/README (@docjulien)

## [2.4.0] (@dwertheimer) 2022-09-04

- Overdue: Add search in active document only command (@jgclark)
- Overdue: Add search in chosen notes folder command (@jgclark)
- Overdue: Fix documentation and command description (@jgclark)
- Overdue: Add some date choices to bottom of dropdown (@john1)
- Overdue: Change "do not change" to start with "skip" (@john1)
- Task Sorter: @jgclark: sort priority todos to the top, sort remaining open tasks by ascending due date (where given)
- Task Sorter: @jgclark: sort priority todos to the top
- Task Sorter: Add additional /ts filters for @george65
- Task Sorter: Add tertiary sort field (@george65)
- Task Sorter: Fix longstanding bug that would output "@undefined" for items with no defined terms
- Task Sorter: Remove blank headings from previous sorts

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
