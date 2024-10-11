# 🔬 Projects + Reviews plugin
Unlike many task or project management apps, NotePlan has very little enforced structure, and is entirely text/markdown based.  This makes it much more flexible, but makes it less obvious how to use it for tracking and managing complex work, loosely referred to here as 'Projects'.

This plugin provides commands to help **review** Project notes, and it helps me manage at times over 100 such projects. The approach will be familiar to people who use David Allen's **Getting Things Done** methodology, or any other where **regular reviews** are important.

The **/project lists** command shows the Project Review List screen, showing the projects due for review from various different NotePlan folders:

![Project Lists: example in 'Rich' style](review-list-rich-1.0.0.png)

If, like me, you're using the helpful [PARA Approach](https://fortelabs.co/blog/series/para/), then your **Areas** are also a form of Project, at least as far as Reviewing them goes.  I have another 60 of these.

After each project name (the title of the note) is an edit icon, which when clicked opens a dialog with helpful controls for that particular project:

![Edit dialog](edit-dialog-1.0.png)

User George (@george65) has recorded two video walkthroughs that show most of what the plugin does (recorded using an earlier version of the plugin):

- [Inside Look: How George, CMO of Verge.io, Uses NotePlan for Effective Project Management](https://www.youtube.com/watch?v=J-FlyffE9iA) featuring this and my Dashboard plugin.
    [![thumbnail](effective-PM-with-George-thumbnail.jpg)](https://www.youtube.com/watch?v=J-FlyffE9iA)

- [Walk-through of Reviews in NotePlan with Project + Reviews Plugin](https://youtu.be/R-3qn6wdDLk) (Note: this was using v0.10, and there have been important improvements since then.)
    [![thumbnail](georgec-video2-thumbnail.jpg)](https://youtu.be/R-3qn6wdDLk)

You might also like:
- [my description of using PARA in NotePlan at scale](https://noteplan.co/n/BCC8CAFA-273F-4513-9A88-53CA811F3C8D)
- [Antony's description of his process which includes this and other plugins](https://noteplan.co/n/381AC6DF-FB8F-49A5-AF8D-1B43B3092922).

## Using NotePlan for Projects (or Project-like work)
Each **Project** is described by a separate note, and has a lifecycle something like this:

![project lifecycle](project-flowchart_bordered.jpg)

Each such project contains the `#project` hashtag, `@review(...)` and some other **metadata** fields (see below for where to put them).  For example:

```markdown
# Secret Undertaking
#project @review(2w) @reviewed(2021-07-20) @start(2021-04-05) @due(2021-11-30)
Aim: Stop SPECTRE from world domination

## Details
* [x] Get briefing from 'M' at HQ
* [x] recruit James Bond
* [ ] task 'Q' with building a personal jetpack (with USB ports)
* [ ] set up team Deliveroo account
...
```

The fields I use are:
- `@review(...)`: interval to use between reviews, of form [number][bdwmqy]:
    - After the [number] is a character, which is one of: **b**usiness days (ignore weekends, but doesn't ignore public holidays, as they're different for each country), **d**ays, **w**eeks, **m**onths, **q**uarters, **y**ears.
- `@reviewed(YYYY-MM-DD)`: last time this project was reviewed, using this plugin
- `@nextReview(YYY-MM-DD)`: specific date for next review (if wanted)
- `@start(YYY-MM-DD)`: project's start date
- `@due(YYY-MM-DD)`: project's due date
- `@completed(YYY-MM-DD)`: date project was completed (if relevant)
- `@cancelled(YYY-MM-DD)`: date project was cancelled (if relevant)
- `Aim: free text`: optional line, and not used by this plugin
- `Progress: N:YYYY-MM-DD: one-line description`: your latest summary of progress for this N% (optional). If present this is shown in the projects list; if not, the % completion is calculated as the number of open and closed tasks.

Similarly, if you follow the **PARA method**, then you will also have "**Areas** of responsibility" to maintain, and I use a `#area` tag to mark these. These don't normally have start/end/completed dates, but they also need reviewing.  For example:

```markdown
# Car maintenance
#area @review(1m) @reviewed(2021-06-25)
Aim: Make sure 007's Aston Martin continues to run well, is legal etc.

## One-off tasks
* [x] patch up bullet holes after last mission @done(2021-06-20)

## Regular tasks
* check tyres @repeat(+1m) >2021-07-23
* pay road tax @repeat(1y) >2021-10-11
* do yearly service @repeat(1y) >2022-02-01
...
```
(Note: This example uses my related [Repeat Extensions plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.RepeatExtensions/) to give more flexibility than the built-in repeats.)

## Where you can put the metadata fields
The plugin tries to be as flexible as possible about where project metadata can go. It looks in order for:
- the first line starting 'project:' or 'medadata:'
- the first line containing a @review() or @reviewed() mention
- the first line starting with a #hashtag.

If these can't be found, then the plugin creates a new line after the title, or if the note has frontmatter, a 'metadata:' line in the frontmatter.

The first hashtag in the note defines its type, so as well as `#project`, `#area` you could have a `#goal` or whatever makes most sense for you. 

Other notes:
- If you also add the `#paused` tag to the metadata line, then that stops that note from being included in active reviews, but can show up in the lists.
- If there are multiple copies of a metadata field, only the first one is used.
- I'm sometimes asked why I use `@reviewed(2021-06-25)` rather than `@reviewed/2021-06-25`. The answer is that while the latter form is displayed in a neater way in the sidebar, the date part isn't available in the NotePlan API as the part after the slash is not a valid @tag as it doesn't contain an alphabetic character.

## Reviewing Projects and/or Areas
Use the '**Hashtags to review**' setting to control which notes are included in the review lists:
- If this setting is empty, then it will include all notes for review that include a `@review(...)` string.
- if it is set (e.g. `#project, #area, #goal`), then it will include just those notes which also have one or more of those tags.
- Particularly if you have a large collection of notes in NP, you can also specify a 'Folders to include for reviews' setting (which includes any sub-folders).
- You can specify folders to ignore using the 'Folders to Ignore for reviews' setting; I have this set to `Summaries, Reviews, Saved Searches`. Any sub-folders of these will also be ignored. (Note that the special Templates, Archive and Trash are always excluded.)

When you have [configured the plugin](#configuration), and added suitable metadata to notes, you're then ready to use some or all of the following commands:

## The main /project lists command
This shows a list of project notes, including basic tasks statistics and time until next review, and time until the project is due to complete. **Tip**: As you can see in the linked videos above, place this list next to your main NotePlan window, and you can click on each project title in the table, and it will open in the main window ready to review and update.

You can set the '**Output style to use**'. This is either a '**Rich**' (HTML, shown above) or original '**Markdown**' (normal NotePlan) output style:

![Example of 'Markdown' style of Project Lists](review-list-markdown-0.11@2x.png)

Notes about the displays:
- the **Rich style** _isn't a normal NotePlan note that is saved and can be accessed again later_. You will need to re-run the command to see the list again once you close the window.  This 'Rich' style mimics the NotePlan Theme you use (though see below on how to override this).  In this style this heading row deliberately 'sticks' to the top of the window as you scroll the list:
![Buttons in 'Rich' style](top-controls-1.0.png)
- in the Rich style, all #tags to review get shown one after the other in a single window.
- if you can make the window wide enough it will display in 2 (or even 3!) columns
- the **Markdown style** list _is_ stored in summary note(s) in the 'Reviews' folder (or whatever you set the 'Folder to store' setting to be).
- the button 'Start reviews' / 'Start reviewing notes ready for review' is a shortcut to the '/start reviews' command (described below).
- each project title is also an active link which can be clicked to take you to that project note. (Or Option-click to open that in a new split window, which keeps the review list open.)

Other settings:
- Next action tag: #hashtag to include in a task or checklist to indicate its the next action in this project (optional; default '#next').
- Display next actions in output? Whether to display the next action in the output? This requires the previous setting to be set. Note: If there are multiple items with the next action tag, only the first is shown.
- Folders to Include (optional): Specify which folders to include (which includes any of their sub-folders) as a comma-separated list. This match is done anywhere in the folder name, so you could simply say `Project` which would match for `Client A/Projects` as well as `Client B/Projects`. Note also: 
  - if you specify the root folder `/` this only includes the root folder itself, and not all its sub-folders. 
  - If empty, all folders will be used apart from those in the next setting.
- Folders to Ignore (optional): If 'Folders to use in reviews' above is empty, then this setting specifies folders to ignore (which includes any of their sub-folders too) as a comma-separated list. This match is also done anywhere in the folder name. Can be empty. Note also:
  - if you specify the root folder `/` this only ignores the root folder, and not all sub-folders.
  - the special @Trash, @Templates and @Archive folders are always excluded.
- Display order for projects: The sort options  are by 'due' date, by 'review' date or 'title'.
- Display projects grouped by folder? Whether to group the projects by their folder.
- Hide higher-level folder names in headings? If 'Display projects grouped by folder?' (above) is set, this hides all but the lowest-level subfolder name in headings.
- Show completed/cancelled projects? If set, then completed/cancelled projects will be shown at the end of the list of active projects.
- How to show completed/cancelled projects?: The options are 'display at end', 'display' or 'hide'.
- Only display projects/areas ready for review?: If true then it will only display project/area notes ready for review (plus paused ones).
- Display project dates?  Whether to display the project's review and due dates (where set).
- Display project's latest progress?  Whether to show the project's latest progress (where available). If some lines have a specific 'Progress:' field. (See above for details.)
- Confirm next Review?: When running '/next project review' it asks whether to start the next review.
- Theme to use in rich project lists: if set to a valid installed Theme name, then that will always be used in place of the currently active theme for the rest of NotePlan.
- Folder to Archive completed/cancelled project notes to: By default this is the built-in Archive folder (shown in the sidebar) which has the special name '@Archive', but it can be set to any other folder name.
- Archive using folder structure? When you complete or cancel a project, and you opt to move it to the Archive, if set this will replicating the project note's existing folder structure inside your chosen Archive folder (set above). (This is the same thing that the Filer plugin's "/archive note using folder structure" command does, though Filer does not need to be installed to use this.)


## The other Commands
Each command is described in turn. If you have a Rich style project list open, the list will be automatically updated after most of them.

### "/start reviews" command
This kicks off the most overdue review by opening that project's note in the editor. When you have finished the review run one of the next two commands ...

### "/finish project review" command
This updates the current open project's `@reviewed(date)`, and if a Rich style project list is open, it is refreshed.
If the 'Next action tag' setting is set, then it will warn if it finds no example of that tag on all open tasks/checklists.

### "/next project review" command
This updates this project's `@reviewed(date)`, and jumps to the next project to review. If there are none left ready for review it will show a congratulations message.

### "/skip project review" command
This overrides (or skips) the normal review interval for a project, by adding a `@nextReview(...)` date of your choosing to the current project note. It also jumps to the next project to review.  The next time "finish review" command is used on the project note, the `@nextReview(date)` is removed.

### "/complete project" command
This adds a `@completed(date)` to the metadata line of the open project note, adds its details to a yearly note in Summaries folder (if the folder exists), and removes the project/area from the review list. It also offers to move it to NotePlan's separate Archive folder (or alternative folder you set in the settings).

### "/cancel project" command
This adds a `@cancelled(date)` to the metadata line of the open project note, adds its details to a yearly note in Summaries folder (if the folder exists), and removes the project/area from the review list. It also offers to move it to NotePlan's separate Archive folder (or alternative folder you set in the settings).

### "/pause project toggle" command
This is a toggle that adds or removes a `#paused` tag to the metadata line of the open project note. When paused it stops the note being offered with '/next review'. However, it keeps showing it in the review list, so you don't forget about it entirely.

If the 'Remove due dates when pausing a project?' setting is set, then all open tasks and checklists with a `>date` will have that date removed.

### "/add progress update" command
This prompts for a short description of latest progress (as short text string) and current % complete (number). This is inserted into the metadata area of the current project note as:

```markdown
Progress: <num>@YYYY-MM-DD: <short description>
```
It will also update the project's `@reviewed(date)`.

## Capturing Progress
In a project/area note you can, if you wish, include a one-line summary of your view on its current **overall progress**. If given, the latest one is shown in the project lists. To continue the example above, here's the start of the note a few weeks later, showing I think it's only 10% complete:

```markdown
# Secret Undertaking
#project @review(1w) @reviewed(2021-05-20) @start(2021-04-05) @due(2021-11-30)
Aim: Do this amazing secret thing
Progress: 10@2021-05-20: Tracked down 007 and got him on the case
Progress: 0@2021-04-05: Project started with a briefing from M about SPECTRE's dastardly plan

## Details
* [x] Get briefing from 'M' at HQ
* [x] recruit James Bond
* [x] task 'Q' with building a personal jetpack (with USB ports)
* [x] set up team Deliveroo account
* [ ] arrange for 007's parking tickets to be paid
...
```
The starting percentage number doesn't have to be given; if it's not it is calculated from the % of open and completed tasks found in the note (that aren't due in the future). The comment are needed, and the date is inserted automatically.

## Capturing Next Action
Part of the Gettings Things Done methodology is to be clear what your 'next action' is. If you want to put a standard tag on such tasks/checklists -- e.g. `#next`, and put that in the settings, then in the project lists this next action will be shown after the progress summary.

## Creating a new Project/Area note
A good way to quickly create a new Project or Area note is to use the `/np:new` (new note from template) or `/np:qtn` (Quick template note) command from the Templating plugin. Here is what I use as my New Project Template:

```markdown
---
title: Create a new Project note
type: template, quick-note, empty-note, project-note
folder: <select>
---
# <%- prompt('noteTitle', 'Project name') %>
#project @start(<%- promptDate('startDate', 'Enter start date') %>) @due(<%- promptDate('dueDate', 'Enter due date') %>) @review(<%- promptDateInterval('question', 'Enter review interval') %>)
Aim: <%- prompt('aim') %>
Context: <%- prompt('context') %>
```

## Using 'Next Actions'
Part of the GTD methodology is to note which are the 'next actions' for a project. This plugin doesn't have specific commands to manage these, but NP has various other features and plugins that can help.

This is what user @George65 does:
- when reviewing notes I use the "/add sync'd copy to note" command (from the [Filer plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.Filer)) to 'sync' actionable tasks to the current weekly note. (Or, if I know I don't need to get to it until the next week, then it goes into the following week or whatever. If it is actionable but I don't need to get to it until the next month I sync it into that next months task.)
- in essence this recreates the GTD 30 day, and monthly folders, but with the advantage that all these tasks are synced back to their projects.
- each day I drag out from the reference area's week's note any actions I want to do that day, maintaining the Sync line status.
- I also will copy over any tasks I didn't do from the previous day.

Another approach is to add a hashtag like `#next` or `#na` to all actionable tasks. Then you can use the "/searchOpenTasks" command (from the [Search Extensions plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions)) with search term `#next` to sync _all_ your open `#next` tasks to your `#next Search Results` note. You can then use this as the source to drag'n'drop tasks into daily/weekly/monthly notes.

## Using with Dashboard plugin
My separate [Dashboard plugin](https://github.com/NotePlan/plugins/blob/main/jgclark.Dashboard/) shows a simpler version of the data from the Projects Review List in its 'Projects' section. It has the same type of edit dialog to complete/cancel/finish review/skip review, and also shows progress indicators.

## Configuration
These commands require configuration before they will know how you intend to use projects and reviews. On macOS this is done by clicking the gear button on the 'Summaries' line in the Plugin Preferences panel. On iOS/iPadOS run the '/Projects: update plugin settings' command instead.

## Running from an x-callback call
Most of these commands can be run from an x-callback call:

`noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists`

The `command` parameter is the command name (as above), but needs to be 'percent encoded' (i.e. with any spaces changed to `%20`).

If you wish to override your current settings for this call, add `&arg0=` followed by a JSON version of the keys and values e.g.
`arg0={"foldersToInclude":["CCC Projects"],"displayDates":true,"displayProgress":false,"displayGroupedByFolder":false,"displayOrder":"title"}`
that then needs to be URL encoded e.g.
`arg0=%7B%22foldersToInclude%22%3A%5B%22CCC%20Projects%22%5D%2C%22displayDates%22%3Atrue%2C%22displayProgress%22%3Afalse%2C%22displayGroupedByFolder%22%3Afalse%2C%22displayOrder%22%3A%22title%22%7D`

The name of the settings are taken from the `key`s from the plugin's `plugin.json` file, which are mostly the names shown in the settings dialog without spaces.

## Thanks
Particular thanks to George C, 'John1' and David W for their suggestions and beta testing.

## Known issues
There is what I consider to be a bug in the NotePlan API that means most of these commands **can only update a project note if it is open in the main Editor**, not in a separate window, or the non-leftmost split window.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise an ['Issue' of a Bug or Feature Request](https://github.com/NotePlan/plugins/issues).

I'm not part of the NotePlan team, but I've spent at least 3 working weeks on this particular plugin. If you would like to support my late-night hobby extending NotePlan through writing these plugins, you can through

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## Changes
Please see the [CHANGELOG](CHANGELOG.md).
