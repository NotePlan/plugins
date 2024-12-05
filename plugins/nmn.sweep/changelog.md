Plugin usage instructions: [README](https://github.com/NotePlan/plugins/blob/main/nmn.sweep/readme.md)
# What's Changed?

## [1.4.4] 2022-05-15 @codedimgepm
- Added `sweepTemplate` command (hidden: true) to `plugin.json` so that it can be executed from `invokePluginCommandByName` in `globals.js`

## [1.4.3] 2022-01-01 @dwertheimer
- Fixed /sw7 not running bug

## [1.4.2] 2021-11-06 @dwertheimer
- Fixed (hopefully) bug where it was asking for confirm for 0 tasks

## [1.4.1] 2021-11-05 @dwertheimer
- Made overdue conform to usage in Noteplan UI (for tasks to show up in References section)
- Added ability to leave tasks in place with ">today" or today's date

## [1.4.0] 2021-11-04 @dwertheimer
- Added overdueOnly option to taskSweeper (both /swa interactive version and template version)

## 1.3.0
- adding field to skip folders from template (by default skips the standard Templates folder)

## 1.2.0
- adding separators to the carry-along-with-task list per request from @BorisAnthony

## 1.1.1
- updated: now compiled for macOS versions back to 10.13.0

## 1.1.0 @weyert -
- Added ability to limit task sweeping to project notes (no calendar notes)
- `{{sweepTasks({limit:{ "unit": "day", "num": 3 }, includeHeadings: false, noteTypes: ['note'] })}}`

## 1.0.1 @dwertheimer - metadata tweak

## 1.0.0 @dwertheimer
- Added Template tag for adding tasks to today `{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:false})}}`
Consolidated code

## Previous releases (@nmn & @eduardme)
- Created ability to sweep calendar and project notes for open tasks
