# Sweep

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
`{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:false})}}`  // Sweep open tasks from the 7 days, but include the headings or indents that the task was under in the original note

# History
## 1.0.0 (@dwertheimer)
- Combined Calendar and Notes processing into one file for consistency (sweepNote.js)
- File sweepCalendarNote.js to be removed
- Edited messaging for clarity for user
- Added additional messaging for user feedback
- Added /sw7 command to silently sweep notes from the last 7 days (sweep7() in sweepAll.js)
- Added comments for understanding the indents logic and console.logging
- Started fleshing out this README
- added template tag to insert swept tasks in daily note
