# Task Automations plugin

## About

The Task Automation plugin brings NotePlan task management to the next level. Invoke the plugin from anywhere in the open note using `CMD-J` (or typing slash in the Editor) and choosing one of the commands mentioned below.

Automations for handling Tasks:
- Overdue/Forgotten task scanning
- Task sorting within a note\n- Copying #tags/@mentions from one task to another
- Mark all tasks in note open/completed\n- Automatically opening URLs of task lines

## Major Task Automation functions

- Find and change overdue tasks (and change their status/reschedule them to a date in the future)
- Find (undated and potentially forgotten) tasks in a previous daily note or buried in a project note
- Sorting tasks (by various task fields or simply bringing tasks to the top of the note)
- Marking a task (or multiple) done and creating a follow-up/related task with a link to the done one
- Marking all tasks complete (or incomplete)
- Copying tags/mentions from previous lines when doing multiple task entry
- Task Sync - create a page of synced tasks matching a text search criteria (e.g. search for all open todos marked "@bob" and put them in one document)
- Process ">date+" tags (e.g. if you entered >2020-01-01+ on a task somewhere in your notes, and today is that day or greater, the task gets converted to a >today and shows up in your daily references, and /autotimeblocking if you use it)

## Overdue Tasks: Overview

In NotePlan, you can create tasks in any document and tag them with a `>date`, e.g.
  `* Do something on New Year's Day >2023-01-01`
The `>date` in a task line is a ***due date*** (some people call it a "***do*** date")
If you open up your daily note (Calendar Note) on that particular day, you will see a reference to that task in your "References" section at the top of the Daily Note. But once that day is gone, you'll not see any references to that item again. @EduardMe designed the product this way, [stating](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders):
> Tasks do not automatically "roll over" in NotePlan, and this is intentional. The added bit of manual work forces you to reconsider each open point and prevents building up a massive list of tasks.
If you remember to do that work every day and check those items, then bully for you. :) But for the rest of us, we need a little help making sure things don't get lost in the abyss of days gone by. That's where

## Overdue Tasks: Commands

### Command `/Review overdue tasks (by Task)`

Find all overdue tasks (tasks which have a >date earlier than yesterday, and will ask you how you want to deal with that task. After that tag is applied, the task will show up in References of your Daily Note until the task is marked complete). By default, the task will stay where it is but the new date you choose will be appended to it (so it will show up in that day's references). However, if you are on the desktop app, you also have the option of holding down the CMD key when you choose the new date, and the task in question will be moved to the daily or weekly note chosen.

### Command `/Review overdue tasks (in Active Note)`

Same as above, but limited to the foreground note in the Editor

### Command `/Review overdue tasks in <Choose Folder>`

In this version, you will be prompted for a folder in which to search for overdue tasks

### Command `/Review/Reschedule Tasks Scheduled for this week`

Review tasks either on this week's note or tagged for this week

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
