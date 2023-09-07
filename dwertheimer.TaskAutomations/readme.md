# Task Automations plugin

## About

The Task Automation plugin brings NotePlan task management to the next level. Invoke the plugin from anywhere in the open note using `CMD-J` (or typing slash in the Editor) and choosing one of the commands mentioned below.

Automations for handling Tasks:

## Major Task Automation functions

- Find and change overdue tasks (and change their status/reschedule them to a date in the future)
- Find (undated and potentially forgotten) tasks in a previous daily note or buried in a project note
- Sorting tasks (by various task fields or simply bringing tasks to the top of the note)
- Marking a task (or multiple) done and creating a follow-up/related task with a link to the done one
- Marking all tasks complete (or incomplete)
- Copying tags/mentions from previous lines when doing multiple task entry

## Overdue Tasks: Overview

In NotePlan, you can create tasks in any document and tag them with a `>date`, e.g.
  `* Do something on New Year's Day >2023-01-01`
The `>date` in a task line is a ***due date*** (some people call it a "***do*** date")
If you open up your daily note (Calendar Note) on that particular day, you will see a reference to that task in your "References" section at the top of the Daily Note. But once that day is gone, you'll not see any references to that item again. @EduardMe designed the product this way, [stating](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders):
> Tasks do not automatically "roll over" in NotePlan, and this is intentional. The added bit of manual work forces you to reconsider each open point and prevents building up a massive list of tasks.
If you remember to do that work every day and check those items, then bully for you. :) But for the rest of us, we need a little help making sure things don't get lost in the abyss of days gone by. That's where the following commands can be helpful.

## Overdue Tasks: Commands

### Command `/Review overdue tasks (by Task)`

Find all overdue tasks (tasks which have a >date of yesterday or earlier), and will ask you how you want to deal with that task. By default, the task will stay where it is but the new date you choose will be appended to it (so it will show up in that day's references). However, if you are on the desktop app, you also have the option of holding down the CMD key when you choose the new date/week, and the task in question will be moved to the daily or weekly note chosen. 

>**NOTE**: If you want to edit a task and also reschedule it, hold down the OPT key (on Mac only) when making your selection (e.g. edit or set a new date) and the task will be updated per your choice and you will then get another pop-up to take further action (e.g. edit task or convert to another type or whatever)

> X-Callback link to call this command: `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20overdue%20tasks%20%28by%20Task%29`

>**NOTE**: This and the following command both will scan daily notes and also weekly notes for tasks that are overdue. Monthly, Quarterly, and Yearly notes are not currently processed.

### Command `/Review Overdue Tasks as of <Date>`

This is a more general-purpose version of the previous command. The aforementioned command assumes you are invoking the command at the start of the day and you want to scan backwards for tasks dated yesterday and prior. On the other hand, if you want to search for tasks that **will be** overdue as of some day in the future, use the command: `/Review Overdue Tasks as of <Date>`, and you can select a date. The plugin will then look backwards from that future date looking for open tasks that *will be* overdue at that point in time (including tasks which were dated for today but not yet complete). This is especially useful for people who want to review tasks at night and prepare for tomorrow. But this can also run for other future dates (e.g. you could run it Friday night to plan for Monday).

> X-Callback link to call this command: `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20Overdue%20Tasks%20as%20of%20%3CDate%3E` (runs the default command, where you can choose a date), or `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20Overdue%20Tasks%20as%20of%20%3CDate%3E&arg0=tomorrow` to run specifically for tomorrow.

### Command `/Review overdue tasks (in Active Note)`

Same as above, but limited to the foreground note in the Editor

### Command `/Review overdue tasks in <Choose Folder>`

In this version, you will be prompted for a folder in which to search for overdue tasks

### Command `/Review/Reschedule Tasks Scheduled for this week`

Review tasks either on this week's note or tagged for this week

## Reviewing Overdue Tasks in a Separate Window

You can also review tasks in a separate popup window using the command:
`/Process Overdue Items in Separate Window`
This will pop up a window that shows Overdue (and optionally LeftOpen and Today's tasks). LeftOpen tasks are open tasks in notes in the last 30 days that are still open but not scheduled. By default, the plugin will search for LeftOpen and Today's tasks, but you can turn that off in the plugin settings with the setting: `Review Forgotten Tasks After Overdue`

### Filtering Tasks in the Window

You can filter tasks in the window through the dropdown menu in the upper-right corner. Initially, there are no tasks in the 'Processed' category, but after you change the status or schedule an item in the list, it will be moved to 'Processed'

### Process Overdue Items In Separate Window via X-Callback

This command can be run via xcallback/URL link and when you call it that way, you can control what the default filter is on the page:

### X-Callback: Show Overdue Items

`noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Process%20Overdue%20Items%20in%20Separate%20Window&arg0=Overdue`

> **NOTE:** LeftOpen and Today items are listed only if you have them selected for review in the plugin settings.

### X-Callback: Show Forgotten/Left Open Items

`noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Process%20Overdue%20Items%20in%20Separate%20Window&arg0=LeftOpen`

### X-Callback: Show Today Items

`noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Process%20Overdue%20Items%20in%20Separate%20Window&arg0=Today`

## Follow-up Tasks

<img width="386" alt="Screen Cap 2022-11-05 at 00 01 42@2x" src="https://user-images.githubusercontent.com/8949588/200107300-2e3d5f44-c08e-4a44-8b69-b3cb9f43888b.png">

You can select (or just be on the same line as) a task or multiple tasks and mark them done, while at the same time creating a follow-up or related task underneath the selected task or in a future calendar/weekly note. In either of the commands below, the follow-up task will look like:

- [ ] #FollowUp test1 [original task](noteplan://x-callback-url/openNote?noteTitle=*%20test1%5El1xagv) >2022-11-04

or

- [ ] #FollowUp test2 [[* [x] test1 ^l1xagv^onk7l6]] >2022-11-05

The format can be set in preferences (the preamble -- `#FollowUp` by default) and whether to use wikilinks or URLs

### Command `/Mark done and create follow-up underneath`

Select a task or tasks and this command will mark it/them done/complete and create a follow-up task with a link to the original in the form of:

### Command `/Mark done and create follow-up in future note`

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

## Task Sorting Notes

- At this time, the plugin will ignore headings that are attached to the tasks (e.g. tasks indented under root-level #headings). I need to understand/think more about this use case and how to deal with it in sorting.
- Lines are sorted line-by-line. Currently, no provision is made for indented text/content underneath tasks or tasks that are indented themselves under other content. If this is your use case and you can describe how you think it should work very clearly, please contact @dwertheimer on Discord and help me understand this usage.

## Marking All Tasks

### /mat - Mark All Tasks (as completed or open)

This plugin will give you a choice of whether to mark all open tasks as completed or all completed tasks as open.

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
- (optionally) Leave tasks with dates in place until they are overdue? [use getOverdueTasks()]

## Acknowledgements

Thanks to @docjulien, @george65, @john1, @jgclark, @stacey, @clayrussell, @qualitativeasing for all the ideas and help with use-cases which make this plugin what it is.

## Deprecated Features

## >Date+ tags

>Date+ tags have been obviated by the new overdue task scanner. So at some point, these commands will probably go away.  Sometimes you want to set a >date at which you want something to become a `>today` task rather than tagging it `today` right now. To do this, create a todo and tag it with some date in the future and put a "+" at the end of the date (e.g. >2025-01-01+). This task will show up in your references section on that date, and if you run the command: `/Update >date+ (Date-Plus) tags in Notes` each day, you will convert those tasks from that day forward as `>today` (with user input along the way).

To run the command to convert dates today or prior, run the `/Update >date+ (Date-Plus) tags in Notes` command

However, easiest way to make sure this happens frequently is to put this command within your Daily Note template as a `runPlugin` template, e.g.:

To run with user verification/input:

```text
<% await DataStore.invokePluginCommandByName("Update >date+ (Date-Plus) tags in Notes","dwertheimer.TaskAutomations",[])  -%>
```

To run silently:

```text
<% await DataStore.invokePluginCommandByName("Update >date+ (Date-Plus) tags in Notes","dwertheimer.TaskAutomations",["silent"])  -%>
```
