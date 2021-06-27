# Task Automations plugin

## /ts - Tasks Sort
This plugin will sort your tasks by priority or by #tag or @context/person. 

When you run /ts, it will sort the tasks into task types (open|scheduled|completed|cancelled), and it will ask you how you want to sort within those categories and whether you want the output to have the category type headings or not, e.g.:

### Open Tasks
  - [ ] Open Task
### Scheduled Tasks
  - [>] Forwarded/Scheduled Task >2030-01-01
### Completed Tasks
  - [x] Completed Task
### Cancelled Tasks
  - [x] Cancelled task

Note: Because the plugin needs to delete the tasks in order to sort and re-insert them in the proper order, as an extra safety measure, the plugin will make a backup of all the tasks you sort just in case something goes wrong. You can find all the tasks backed up at: `@Trash/_Task-sort-backup`, and you should probably clean that document out every so often. :) 

Note: At this time, the plugin will ignore headings that are attached to the tasks (e.g. tasks indented under root-level #headings). I need to understand/think more about this use case and how to deal with it in sorting.

## Configuration

## Future Features / Todo List
- Make silent shortcuts to do specific sorts
## History

0.0.2 Initial version