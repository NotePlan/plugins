# 🗃 Filer plugin
This plugin provides the **`/moveParagraphs`** (was `/mp` and `/fp`) commands to help quickly **move** (**file**) any paragraphs (any sort of line, not just tasks) to different notes in NotePlan.

It works out which line(s) you want moving from the current open note using this priority order:

- currently selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in
- current line the cursor is in, plus any indented lines that follow it

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape at any time to cancel.  The move happens in the background, leaving you in the current note.

It also provides the **`/nns`** **new note from selection** command, which extends the **`/nn`** command. It is interactive, prompting various questions as it works.

## Configuration
You can tweak the behaviour of `/moveParagraphs` in a few ways. To do, please add and update the following in the first codeblock in your `Templates/_configuration` note:

```jsonc
...
  {
	filer: {
    addDateBacklink: false, // to add date backlinks on the moved paragraph(s) set to true
    useExtendedBlockDefinition: false, // to use the extended blocks, set to true
    whereToAddInSection: "start" // Controls whether moved lines get inserted at the "start" or "end" of the chosen section
  },
...
```
The plugin should offer to write the default for you the first time it runs.

## History
Please see the [CHANGELOG](CHANGELOG.md).
