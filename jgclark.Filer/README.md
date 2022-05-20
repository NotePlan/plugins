# 🗃 Filer plugin
This plugin provides several commands to help move things around in NotePlan.

It has a few settings, which you see and change by clicking on the ⚙️ gear button on the 'Filer' line in the Plugin Preferences panel. 
## /move paragraph
The **/move paragraph** command (aliased to **/mp** and **/fp**) quickly moves (*or files*) lines to different notes in NotePlan, _without having to lose your flow by switching to the other note_. It works on any number and sort of lines in a block, not just tasks.  NB: the basic unit of text in NotePlan is the 'paragraph', but often they're short enough to think of them as 'lines'. In this the two terms are used interchangeably.

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.  

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in, plus any indented ('children') lines that follow it

The 'following section' finishes at the next empty line, heading or horizontal line.

From v0.7.0, you can turn on 'Extended Block Definition' in the settings, which additionally includes the whole section around the current line the cursor is in. (So you don't then have to move to the start of the section.)

NB: due to limitations in the API it's not yet possible to move items to a Calendar note that doesn't already exist. I will improve this when the API supports it.)

## /move block
The **/move block** command (aliased to **/mb** and **/fb**) quickly moves (*or files*) a whole **block of lines** to different notes in NotePlan, _without having to lose your flow by switching to the other note_. It works on any number and sort of lines in a block, not just tasks.

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.  

It includes the whole 'section' around the current line the cursor is in. (So you don't then have to move to the start of the section.) The 'section' finishes at the next empty line, heading or horizontal line.

(NB: due to limitations in the API it's not yet possible to move items to a Calendar note that doesn't already exist. (I will improve this when the API supports it.)

## /add sync'd copy to note
This command (alias **/asc**) adds a sync'd copy of the current line to a section in another note.  Here's a demo with two notes side by side, only to make it clearer:

![](add-link-line-demo-T2.gif)

NB: This only works with the "synced blocks" feature available in the NotePlan Lab from v3.5.2.  (This feature only works on single lines, not whole blocks, at the moment.)

## /new note from clipboard
This command (alias **nnc**) takes the current contents of the clipboard to form a new note. The command asks for the note title and folder location.

## /new note from selection
This command (alias **/nns**) takes the current selected text to form a new note. The command asks for the note title and folder location.

## History
Please see the [CHANGELOG](CHANGELOG.md).
