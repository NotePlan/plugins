# 🗃 Filer plugin
This plugin provides several commands to help move things around in NotePlan.

It has a few settings, which you review and change by clicking on the ⚙️ gear button on the 'Filer' line in the Plugin Preferences panel. 

## /move paragraph
The **/move paragraph** command (aliased to **/mp** and **/fp**) quickly **files** (moves) lines to different notes in NotePlan, _without having to lose your flow by switching to the other note_. It works on any number and sort of lines in a block, not just tasks.

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after. Where possible it will visually highlight the lines it will be moving (on NotePlan v3.6.2+). You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in, plus any indented ('children') lines that follow it

The 'following section' finishes at the next empty line, heading or horizontal line.

From v0.7.0, you can turn on 'Use a tighter definition of when a Block finishes?' in the settings, which additionally includes the whole section around the current line the cursor is in. Specifically, this means you don't have to move the cursor to the start of the section before you run it.

NB: due to limitations in the API it's not yet possible to move items to a Calendar note that doesn't already exist. I intend to improve this when the API supports it.

## /quick move to ... note
These 4 commands each moves lines to the current weekly note, using the same selection strategy as /mp (see above). The move happens in the background, leaving you in the flow in your current note. (Available with weekly notes from NotePlan v3.6.)

- **/quick move to Today's note** (alias **/qmtd**) -- Note: this is different from the existing 'Move Task To Today ⌘0' shortcut, which actually _schedules_ not moves.
- **/quick move to Tomorrow's note** (alias **/qmtm**) -- Note: this is different from the existing 'Move Task To Tomorrow ⌘1' shortcut, which actually _schedules_ not moves.
- **/quick move to Weekly note** (alias **/qmw**)
- **/quick move to Next Weekly note** (alias **/qmnw**)

They could be mapped to shortcut keys to make using them even faster.

## /add sync'd copy to note
This command (alias **/asc**) adds a sync'd copy of the current line to a section in another note.  Here's a demo with two notes side by side, only to make it clearer:

![](add-link-line-demo-T2.gif)

NB: This only works with the "synced blocks" feature available in the NotePlan Lab from v3.5.2.  (This feature only works on single lines, not whole blocks, at the moment.)

## /new note from clipboard
This command (alias **/nnc**) takes the current text in the clipboard to form the basis of a new note. The command asks for the note title and folder location.

## /new note from selection
This command (alias **/nns**) takes the current selected text to form the basis of a new note. The command asks for the note title and folder location.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
