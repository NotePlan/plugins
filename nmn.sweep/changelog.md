Plugin usage instructions: [README](https://github.com/NotePlan/plugins/blob/main/nmn.sweep/readme.md)
# What's Changed?

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