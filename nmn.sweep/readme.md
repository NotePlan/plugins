# Sweep Plugin
Quickly deal with overdue tasks. Reschedule/Move them all to today (or a day in the future)

## /swt
Move/Reschedule all open tasks in current note to today's Calendar Note

## /swa
Sweep (move or reschedule) All tasks from Calendar and Project Notes over a period of time to today's Calendar Note

## /sw7
Silently sweep notes from the last 7 days (no user interaction required) to today's Calendar Note

Template:
`{{sweepTasks({limit:{ "unit": "month", "num": 1 }})}}` // Sweep open tasks from the last month from project and calendar notes, pasting just the tasks, no headings or indents above
or
`{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:true, ignoreFolders:['📋 Templates',"AnotherFolderNotToSweep"]})}}`  // Sweep open tasks from the 7 days, and include the headings or indents that the tasks were under in the original note, and **do not** sweep items in a note inside a folder named "AnotherFolderNotToSweep"

If you want to limit the sweepTask command in your templates you can use the `noteTypes` option to cherry pick which
kind of types should be swept. If you only want calendar notes you can use:
`{{sweepTasks({limit:{ "unit": "day", "num": 3 }, includeHeadings: false, noteTypes: ['calendar'] })}}`
or to limit task sweeping to project notes (no calendar notes)
`{{sweepTasks({limit:{ "unit": "day", "num": 3 }, includeHeadings: false, noteTypes: ['note'] })}}`
