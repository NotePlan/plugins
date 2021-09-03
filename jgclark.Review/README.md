# 🔬 Reviews  plugin
This plugin provides commands to help review with Project-based notes. This will be of interest for those who use NotePlan to plan and track work in different areas, which could be loosely referred to as 'Projects'. This will be familiar to people who use David Allen's **Getting Things Done** approach, or any other where **regular reviews** are important. It probably won't have much applicability to people who use NotePlan as a Zettelkasten-style knowledge base.

## Using NotePlan for Project-like work
Unlike many task or project management apps, NotePlan is both much less structured, and entirely text/markdown based.  This makes it much more flexible, but makes it less obvious how to use it for project tracking or management.  This is how I use it: there may be better ways for you.

Each **Project** is described by a separate note. Each such project contains the `#project` hashtag, `@review(...)` and some other metadata fields on the line immediately after the title.  For example:

```markdown
# Secret Undertaking
#project @review(2w) @reviewed(2021-07-20) @start(2021-04-05) @due(2021-11-30)
Aim: Do this amazing secret thing

## Details
* recruit James Bond
...
```

The other fields I use are:
- `@review(...)`: interval to use between reviews, of form [nn][dwmqy]
- `@reviewed(YYYY-MM-DD)`: last time this project was reviewed, using this plugin
- `@start(YYY-MM-DD)`: project's start date
- `@due(YYY-MM-DD)`: project's due date

Similarly, if you follow the PARA method, then you will also have "**Areas** of responsibility" to maintain, and I use a `#area` tag to mark these. These don't normally have a start or end date, but they also need reviewing.  For example:

```markdown
# Car maintenance
#area @review(1m) @reviewed(2021-06-25)
Aim: Make sure car continues to run well, is legal etc.

* check tyres @repeat(+1m) >2021-07-23
* pay car/road tax @repeat(1y) >2021-10-11
* book yearly service @repeat(1y) >2022-02-01
...
```

## Reviewing Projects and/or Areas
**NB**: Use the **`noteTypeTags`** setting to control which notes are included in the review lists:
- If this setting is not set, then it will include all notes for review that include a `@review(...)` string.
- if it is set (e.g. "#project, #area"), then it will include just those notes which also have one or more of those tags.

When you have configured the plugin, and added suitable metadata to notes, use some or all of the following commands:

### `/project lists`
This creates/updates a **human-readable** list of project notes, including basic tasks statistics and time until next review, and time until the project is due to complete. This is stored in summary note(s) in the 'Summaries' folder (or whatever you set `folderToStore` setting to be).
You can specify folders to ignore using the `foldersToIgnore` setting, and see Configuration below for more details on the `displayOrder`, `displayGroupedByFolder` and `displayArchivedProjects` settings.

### `/start reviews`
This creates/updates a **machine-readable** list of notes ready for review, in the `_reviews` note in the folder given by the `folderToStore` setting. It then kicks off the most overdue review by opening that note in the editor. When you have finished the review run one of the next two commands ...
You can specify folders to ignore using the `foldersToIgnore` setting.

### `/completeReview`
This updates the current open project's @reviewed() date.

### `/nextReview`
This updates this project's @reviewed() date, and jumps to the next project to review. If there are none left ready for review it will show a congratulations message.

### `/addProject`
Add a new note representing a project, asking for its metadata.  For now it's simply a shortcut to insert your `New Project Template` template to the current note.

### `/completeProject`
This add @completed(today) date to the open project.

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write default configuration to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```jsonc
...
  review: {
    folderToStore: "Reviews" // will be created if necessary
    foldersToIgnore: ["📋 Templates", "Reviews", "Summaries"], // an array of folder names, which can be empty
    noteTypeTags: ["#area", "#project"], // an array of hashtags to indicate notes to include in this review system
    displayOrder: "alpha", // in '/project lists'  the sort options  are "due" date, "review" date or "alpha"
    displayGroupedByFolder: true, // in '/project lists' whether to group the notes by folder
    displayArchivedProjects: true,  // in '/project lists' whether to display project notes marked #archive

...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)

## Changes
Please see the [CHANGELOG](CHANGELOG.md).

## To do
- update the `/project lists` output to use a table view, _when then this is available in NotePlan_
- update the `/addProject` to use better date pickers, _when then this is available in NotePlan_
- _if NotePlan adds support  for frontmatter or YAML blocks_, update the plugin to take advantage of them
