# Sweep

Quickly deal with overdue tasks. Reschedule/Move them all to today (or a day in the future)

## /swt
Move/Reschedule all open tasks in current note to today's Calendar Note
## /swa
Sweep (move or reschedule) All tasks from Calendar and Project Notes over a period of time to today's Calendar Note
## /sw7
Silently sweep notes from the last 7 days (no user interaction required) to today's Calendar Note

# History
## 0.0.7 (@dwertheimer)
- Combined Calendar and Notes processing into one file for consistency (removed SweepFile.js and renamed sweepCalendar.js to sweepNote.js)
- Edited messaging for clarity for user
- Added additional messaging for user feedback
- Added /sw7 command to silently sweep notes from the last 7 days (sweep7() in sweepAll.js)
