# Task Automations plugin

## /mat - Mark All Tasks (as completed or open)
This plugin will give you a choice of whether to mark all open tasks as completed or all completed tasks as open.

## /tst - Tasks Sort by Tag
Sort the Tasks in the open note by (the first) #Tag and display with subheadings for each unique tag
[If you want more granular control over whether there are or aren't headings, use /ts]

## /tsm - Tasks Sort by Mention/Person
Sort the Tasks in the open note by (the first) @Mention and display with subheadings for each unique @mention
[If you want more granular control over whether there are or aren't headings, use /ts]

## /ts - Tasks Sort (Interactively choose sort order and headings style)
This plugin will sort your tasks in the open note in the Editor

When you run /ts, it will sort the tasks into task types (open|scheduled|completed|cancelled), and it will ask you how you want to sort within those categories and whether you want the output to have the category type headings or not, e.g.:

### Open Tasks
  - [ ] Open Task
### Scheduled Tasks
  - [>] Forwarded/Scheduled Task >2030-01-01
### Completed Tasks
  - [x] Completed Task
### Cancelled Tasks
  - [-] Cancelled task

Note: Because the plugin needs to delete the tasks in order to sort and re-insert them in the proper order, as an extra safety measure, the plugin will make a backup of all the tasks you sort just in case something goes wrong. You can find all the tasks backed up at: `@Trash/_Task-sort-backup`, and you should probably clean that document out every so often. :) 

Note: At this time, the plugin will ignore headings that are attached to the tasks (e.g. tasks indented under root-level #headings). I need to understand/think more about this use case and how to deal with it in sorting.

## Configuration
None required

## Future Features / Todo List
- (optionally) Leave tasks with dates in place until they are overdue? [use getOverdueTasks()]

## History
1.0.0 Removing "macOS.minVersion" which is no longer necessary due to transpiling
0.0.6 Added subheadings for tags/mentions & headless commands /tsm and /tst
0.0.5 Sort by priority or by #tag or @context/person or content/alphabetical
0.0.4 Added /mat command to reset completed tasks (or to set all open as complete), per request from @JaredOS
0.0.3 Adding 	"macOS.minVersion": "10.15.7"
0.0.2 Initial /ts version