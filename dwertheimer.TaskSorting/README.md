# Task Sorting & Tools Plugin

>**NOTE**: The functions in this plugin were previously part of the "Task Automations" plugin. @eduardme suggested we break out the sorting functions and move them here.

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskSorting/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin

Commands for sorting tasks in a note

## Major Sorting functions

- Sorting tasks (by various task fields or simply bringing tasks to the top of the note)

## Other Task Tools

- Marking a task (or multiple) done and creating a follow-up/related task with a link to the done one
- Marking all tasks complete (or incomplete)
- Copying tags/mentions from previous lines when doing multiple task entry

## Sorting Tasks

### /ts - Tasks Sort (Interactively choose sort order and headings style)

This plugin will sort your tasks in the open note in the Editor interactively so you can choose how you want it to work and output

When you run /ts, it will sort the tasks into task types (open|scheduled|completed|cancelled), and it will ask you how you want to sort within those categories and whether you want the output to have the category type headings or not, e.g.:

#### Parameters (for x-callback-url calls):
- `arg0`: `withUserInput` (true/false) - whether to prompt user interactively
- `arg1`: `sortFields` (comma-separated string) - sort order, e.g. "-priority,content"
- `arg2`: `withHeadings` (true/false) - whether to output section headings like "Open Tasks"
- `arg3`: `subHeadingCategory` (true/false) - whether to output subheadings for each tag/mention
- `arg4`: `interleaveTaskTypes` (true/false) - whether to interleave task types together or keep separate
- `arg5`: `sortInHeadings` (true/false) - whether to sort within each heading separately or treat entire note as one unit

#### Examples:
```text
# Sort by priority without headings, treating entire note as one unit (moves all open tasks to top)
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20on%20the%20page&arg0=false&arg1=-priority,content&arg2=false&arg3=false&arg4=true&arg5=false

# Sort within each heading separately (default behavior)
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20on%20the%20page&arg0=false&arg1=-priority,content&arg2=false&arg3=false&arg4=true&arg5=true
```

**New Feature: Task Type Interleaving (Default Behavior)**
- **By default**, tasks are interleaved: compatible task types are combined and sorted together by priority
- Within each priority level, open tasks appear before checklists
- This allows tasks to be sorted by priority first, then by type (open before checklist)

**Sorting Behavior Options:**
- **`sortInHeadings: true`** (default): Sort tasks within each heading separately. Tasks stay under their original headings but are sorted within each heading.
- **`sortInHeadings: false`**: Treat the entire note as one unit. All open tasks move to the top of the page regardless of which heading they were originally under.
- To use traditional grouping (all open tasks together, then all checklists together), set `interleaveTaskTypes=false`

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

### /tsh - Tasks Sort under Heading (choose)

This command will sort the tasks under a heading that you choose.
You can pass the heading as a parameter, or you can choose it interactively.
You can also pass the sort order as a parameter, e.g. (["-priority", "content"]), or you can choose it interactively.
For example, this command will sort all the tasks under the heading "Open Tasks" by priority and then alphabetically by content.

```
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20under%20heading%20%28choose%29&arg0=Open%20Tasks&arg1=%5B%22-priority%22%2C%22content%22%5D
```

### X-Callback URL Examples

**Sort tasks with interleaving (default behavior):**
```
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20on%20the%20page&arg0=false&arg1=-priority%2Ccontent&arg2=false&arg3=false&arg4=true
```

**Sort tasks with traditional grouping (override default):**
```
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20on%20the%20page&arg0=false&arg1=-priority%2Ccontent&arg2=false&arg3=false&arg4=false
```

**Sort tasks under heading with interleaving (default):**
```
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20under%20heading%20%28choose%29&arg0=Open%20Tasks&arg1=%5B%22-priority%22%2C%22content%22%5D&arg2=null&arg3=true
```

**Sort tasks under heading with traditional grouping:**
```
noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskSorting&command=Sort%20tasks%20under%20heading%20%28choose%29&arg0=Open%20Tasks&arg1=%5B%22-priority%22%2C%22content%22%5D&arg2=null&arg3=false
```

**Parameters explained:**
- `arg0`: withUserInput (false = no prompts)
- `arg1`: sortFields (comma-separated: "-priority,content")
- `arg2`: withHeadings (false = no type headings)
- `arg3`: subHeadingCategory (false = no subheadings)
- `arg4`: interleaveTaskTypes (true = interleave by priority, false = traditional grouping by type)

> **NOTE**: If you are calling this command from a plugin or a template and want to sort tasks under a heading in a specific note (or the Editor) you have been working on, you **should** pass the note as a third parameter to ensure that taskSorting is working on the same Object you have been working on, e.g. ("myHeading",["-priority","content"], Editor). For clarity, Task Sorting plugin works on **Editor.note**, but if you are using Editor (and not Note) you should pass Editor in as the noteOverride parameter, else the delayed write from Editor will overwrite any task sorting you do.

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

### /cnt copy **all** noteTags from "noteTags" in frontMatter to all task in the current note

![NoteTags demo](src/docs/cnt-demo.gif)

## Future Features / Todo List

- Sort tasks via template call
- Sort by task due date
- Bring open tasks to top
