# Task Automations plugin

## About

This plugin helps you deal with tasks in the open document in the Editor. Major functions:

- Find and change overdue task dates to >today
- Process ">date+" tags (e.g. if you entered >2020-01-01+ on a task somewhere in your notes, and today is that day or greater, the task gets converted to a >today and shows up in your daily references, and /autotimeblocking if you use it)
- Sorting tasks (by various task fields or simply bringing tasks to the top of the note)
- Marking all tasks complete (or incomplete)
- Copying tags/mentions from previous lines when doing multiple task entry

## Overdue Tasks

### Command `/Review overdue tasks (by Note)`

Find all overdue tasks (tasks which have a >date earlier than yesterday, and change those tasks to have a [>today](https://help.noteplan.co/article/139-workflow-for-daily-recurring-tasks-using-today) tag. After that tag is applied, the task will show up in References of your Daily Note until the task is marked complete).

### Command `/Review overdue tasks (by Task)`

Same as `/Review overdue tasks (by Note)` but skip the Note-level review and review each overdue task invidually

## >Date+ tags

Sometimes you want to set a >date at which you want something to become a `>today` task rather than tagging it `today` right now. To do this, create a todo and tag it with some date in the future and put a "+" at the end of the date (e.g. >2025-01-01+). This task will show up in your references section on that date, and if you run the command: `/Update >date+ (Date-Plus) tags in Notes` each day, you will convert those tasks from that day forward as `>today` (with user input along the way). The easiest way to do this is to run this command within your Daily Note template, e.g.:

```text
To run with user verification/input:
<% await DataStore.invokePluginCommandByName("Update >date+ (Date-Plus) tags in Notes","dwertheimer.TaskAutomations",[])  -%>

To run silently:
<% await DataStore.invokePluginCommandByName("Update >date+ (Date-Plus) tags in Notes","dwertheimer.TaskAutomations",["silent"])  -%>
```

## Sorting Tasks

### /ts - Tasks Sort (Interactively choose sort order and headings style)

This plugin will sort your tasks in the open note in the Editor interactively so you can choose how you want it to work and output

When you run /ts, it will sort the tasks into task types (open|scheduled|completed|cancelled), and it will ask you how you want to sort within those categories and whether you want the output to have the category type headings or not, e.g.:

```text
#### Open Tasks
  - [ ] Open Task
#### Scheduled Tasks
  - [>] Forwarded/Scheduled Task >2030-01-01
#### Completed Tasks
  - [x] Completed Task
#### Cancelled Tasks
  - [-] Cancelled task
```

### /tst - Tasks Sort by Tag

Sort the Tasks in the open note by (the first) #Tag and display with subheadings for each unique tag
[If you want more granular control over whether there are or aren't headings, use /ts]

### /tsc - Tasks Sort by Due Date

Sort the Tasks by Due Date and then Priority
[If you want more granular control over whether there are or aren't headings, use /ts]

### /tstm - Tasks Sort by Tag/Mention

Sort the Tasks in the open note by (the first) #tag (and then by @Mention)
[If you want more granular control over whether there are or aren't headings, use /ts]

### /tsm - Tasks Sort by Mention/Person

Sort the Tasks in the open note by (the first) @Mention and display with subheadings for each unique @mention
[If you want more granular control over whether there are or aren't headings, use /ts]

### /tsd - Task Sort By Default

Sort tasks in note by user setting primary/secondary sort fields
Set the primary and secondary sort order for this default search in plugin preferences

### /tt - Tasks to Top

This command brings all the tasks inside of the currently open note to the top of the note. You can choose whether you want headings (e.g. "Open Tasks", "Sheduled Tasks" etc.) or whether you want just the sorted tasks brought to the top. Note: brings only task lines (not indented underneath)

## Marking All Tasks

### /mat - Mark All Tasks (as completed or open)

This plugin will give you a choice of whether to mark all open tasks as completed or all completed tasks as open.

Note: Because the plugin needs to delete the tasks in order to sort and re-insert them in the proper order, as an extra safety measure, the plugin will make a backup of all the tasks you sort just in case something goes wrong. You can find all the tasks backed up at: `@Trash/_Task-sort-backup`, and you should probably clean that document out every so often. :)

Note: At this time, the plugin will ignore headings that are attached to the tasks (e.g. tasks indented under root-level #headings). I need to understand/think more about this use case and how to deal with it in sorting.

## Copying Tags/Mentions

### /cta - Copy **all** #tags and @mentions from the previous line

### /cth - Copy **all** #tags and @mentions from the heading the task sits under

### /ctm - Duplicate line for each @mention but change the order so each mention shows up first on its own line (and therefore will be sorted under that @mention heading when using /ts - task sorter)

### /ctt - Duplicate line for each @tag but change the order so each tag shows up first on its own line (and therefore will be sorted under that @mention heading when using /ts - task sorter)

## Plugin Settings

The plugin has a variety of settings you can access through the plugin settings panel in NotePlan Preferences

## Future Features / Todo List

- Sort tasks via template call
- Sort by task due date
- Bring open tasks to top
- `/Task Sync` (only available via xcallback/url)
- (optionally) Leave tasks with dates in place until they are overdue? [use getOverdueTasks()]
