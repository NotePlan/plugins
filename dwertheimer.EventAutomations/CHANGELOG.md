# AutoTimeBlocking Change Log

README: [How to use AutoTimeBlocking](https://noteplan.co/n/#/1EF12392-B544-4044-AC7A-428F57EB2DFC)

## What's New in AutoTimeBlocking

## [1.18.1] 2024-01-04 @dwertheimer

- Update language around Synced Copies preference (thanks @dutcheness)
- Fix bug where synced copies didn't write if the Editor was not saved yet


## [1.18.0] 2023-10-16 @dwertheimer

- Add Named Timeblocks Mode (BY_TIMEBLOCK_TAG mode)
- Minor calendar event improvement to deal with "today" and "tomorrow" text better in event creation


## [1.17.3] 2023-10-11 @dwertheimer

- EventBlocks: minor change to xcallback support]
## [1.17.2] 2023-09-16 @dwertheimer

- EventBlocks - work around NP limitation that doesn't process "today at 5pm" correctly

## [1.17.1] 2023-09-06 @dwertheimer 2023-09-06

- Add argument for heading to put it under

## [1.17.0] 2023-09-06 @dwertheimer 2023-09-06

- Add interactive plugin settings for iOS
- Added /pevt command for creating a single task using natural language

## [1.16.3] 2023-08-24

- Fix bug where synced lines in today's note were not being timeblocked. Thx @tiffsunbacon

## [1.16.2] 2023-07-13

- Fix bug in non-ATB timeblocks getting deleted
- Allow time to be '1hr or '5min instead of just "h" and "m"

## [1.16.1] 2023-07-05 @dwertheimer

- bump to chase onSettingsUpdated NP bug

## [1.16.0] 2023-07-05 @dwertheimer

- Create Tasks within named Timeblocks (e.g. #home) - aka BY_TIMEBLOCK_TAG mode (see the README ^^^)
- Change Plugin Name to AutoTimeBlocking/Events
- Add output/notification for tasks that were unable to fit

## [1.15.1] 2023-04-20

- Fix bug in tasks open in today's note.

## [1.15.0] 2023-01-18 @dwertheimer

- Added new preference: when using checklist (+) for your timeblocks, checking the timeblock will find and check the original item

## [1.14.0] 2023-01-17 @dwertheimer

- Checklist support for todo char

## [1.13.5] 2022-12-13 @dwertheimer

- Suppress dialog when no synced tasks to output

## [1.13.4] - 2022-12-08 @dwertheimer

- Fix nasty bug when prefs fields were empty (was deleting all lines in a note). Thx @akra5ia

## [1.13.1] - 2022-11-26 @dwertheimer

- Fix bug when timeblock character is a todo (duplicating time blocks)
- Change default synced copies title to be the link to run it again

## [1.13.0] - 2022-11-11 @dwertheimer

- Added undocumented feature for a template to remove previous days paragraphs under any heading (dbw using to remove "Daily Recurring Tasks" after the day has passed)

## [1.12.0] - TBD @dwertheimer

- Added /mdatb - Mark Done and run ATB command

## [1.11.0] - 2022-10-28 @dwertheimer

- Added setting to create timeblocks for undated tasks in today's note
- Added line-level links to tasks from timeblocks

## [1.10.4] - 2022-10-19 @dwertheimer

- Minor fix to ignore calendar items which are marked as "free" time in Google calendar

## [1.10.3] - 2022-09-29 @dwertheimer

- Bug fix to keep today todos from becoming synced copies

## [1.10.2] - 2022-09-07 @dwertheimer

- Name change (back to EventAutomations) and code clean up

## [1.10.1] - 2022-09-07 @dwertheimer

- Fixed minor bug: datePlusOpenOnly setting missing

## [1.10.0] - 2022-09-02 @dwertheimer

- Moved >date+ functionality to TaskAutomations plugin (and expanded it)

## [1.9.0] - 2022-09-01 @dwertheimer

- Added ability to convert all overdue tasks to >today tasks (when preference setting is off)

## [1.8.0] - 2022-08-22 @dwertheimer

- Ask for calendar selection in Event Blocks Creation
- Work around all-day event bug in CalendarItem API

## [1.7.0] 2022-08-04 @dwertheimer

- Event Blocks: Added temporary display of start time for event
- Fix bug where last event wasn't picked up

## [1.6.0] 2022-07-21 @dwertheimer

- Added Create Events from Text Block capability (/cevt - Create Events from Text)
- Added Log Level Settings in Preferences
- Renamed plugin to AutoTimeBlocking & Event Automations

## [1.5.0] 2022-07-21 @dwertheimer

- Added Log Level Settings in Preferences

## [1.4.0] 2022-07-03 @dwertheimer

- added command "/Update >date+ tags in Notes" (including foldersToIgnore config setting)
- added autoupdater code
- change default TimeBlocks heading to the "button" [Time Blocks](noteplan://runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday%27s%20Tasks)

## [1.3.4] 2022-06-24 @dwertheimer

- Fix race condition calling DataStore.preference too many times quickly on "Remove All Previous..." commands

## [1.3.3] 2022-06-23 @dwertheimer

- Add check for pre-existing timeblocks including the "mustInclude" string (thx @jgclark)

## [1.3.2] 2022-06-21 @dwertheimer

- Fix calendar changeover (00:00) bug

## [1.3.0] 2022-06-21 @dwertheimer

- Added cleanup commands:
  - Remove Synced Todos for Open Calendar Note
  - Remove Time Blocks for Open Calendar Note
  - Remove All Previous Synced Copies Written by this Plugin

## [1.2.1] 2022-07-10 @dwertheimer

- Remove the requirement for Synced lines to run only on today's note (@Stacey's suggestion)

- added: added command "/Insert Synced Today Todos at Cursor" to add synced lines without timeblocks

## [1.2.0] 2022-07-10 @dwertheimer

- added: added command "/Insert Synced Today Todos at Cursor" to add synced lines without timeblocks
- changed plugin name to "AutoTimeBlocking & Synced Today Todos"

## [1.1.6] 2022-07-10 @dwertheimer

- fix: added loading screen during delete/add events to calendar

## [1.1.5] 2022-07-10 @dwertheimer

- fix: made TB tag addition more robust

## [1.1.4] 2022-07-10 @dwertheimer

- fix: pull timeblock string from prefs (DataStore.preference("timeblockTextMustContainString")) and append it
  
## [1.1.3] 2022-07-10 @dwertheimer

- fix: read calendar name after it gets changed by user

## [1.1.2] 2022-07-09 @dwertheimer

- fix: crasher bug in removing items from calendar

## [1.1.1] 2022-07-09 @dwertheimer

- fixed bug found by @atlgc where same text in diff files wouldn't create synced line

## [1.1.0] 2022-05-26 @dwertheimer

- added duplicate removal to eliminate multiple copies of synced lines + tests
- added folding using API
- improved messaging for when /ATB encounters nothing

## [1.0.0] 2022-05-18 @dwertheimer

- added config setting for write synced copy
- moving to 1.0.0 release because /atb has been stable

[0.6.0] 2022-05-06

- remove event note creation functions (they have been superseded by NotePlan Event Templates)
- fix bug that is finding embedded event links and treating them like timeblocks

[0.5.3] 2022-04-02

- fix bug in task exclusion patterns (thx @lt#0807)

[0.5.2] 2022-03-17

- fix done task still showing up (thx @pan)

[0.5.1] 2022-03-15

- add support for items in today's note which are not tasks
- remove a slew of console.logs

[0.5.0] 2022-03-12

- add setting for appending link to task note

[0.4.7] 2022-02-18

- changed default timeblock line to "-" from "*"

[0.4.6] 2022-02-18

- fixing editor open bug

[0.4.5] 2022-02-04

- refactor calendar code under the hood + Eduard fixed some underlying migration code

[0.4.4] 2022-02-04

- add configuration migration

[0.4.3]

- change config to make includeTasksWithText etc. not required

[0.4.2] 2022-01-02 @dwertheimer (in response to great feedback from @stacey)

- change default config to allow for timeblocks all day long (no workDay[Start/End]) sections]
- change preset to do the opposite (allow for workday)

[0.4.0] 2021-12-25 @dwertheimer

- Search today's note for items tagged as >today or >dated

[0.3.4] 2021-12-25 @dwertheimer

- Fixed include/exclude bug thanks to @stacey and @4nd3rs for helping me find it

[0.3.3] 2021-12-24 @dwertheimer

- Added tons of console.logging to help with debugging in NP

[0.3.0] 2021-12-24 @dwertheimer

- Fixed Catalina (and previous OS) date math inconsistency

[0.1.0] 2021-11-04 @dwertheimer

- Initial release
- "Create Note From Calendar Item" command (asks you for a template)
- "Create Note From Calendar Item w/QuickTemplate" command (uses a preset template you established in the _configuration file / quickNotes field)
