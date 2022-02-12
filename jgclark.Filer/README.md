# 🗃 Filer plugin
This plugin provides the **`/move paragraph`** command to help quickly **file** (**move**) any paragraphs (any sort of line, not just tasks) to different notes in NotePlan.  (This is aliased to **`/mp`** and **`/fp`**.)

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in
- current line the cursor is in, plus any indented lines that follow it
- the whole section around the current line the cursor is in (turn on the setting `useExtendedBlockDefinition`).

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.  NB: due to limitations in the API it's not yet possible to move items to a Calendar note that doesn't already exist. (I will improve this when the API supports it.)

It also provides the **`/nns`** **new note from selection** command, which extends the **`/nn`** command. It is interactive, prompting various questions as it works.

## Configuration
In NotePlan v3.4 and above, please click the gear button on the 'Summaries' line in the Plugin Preferences panel. 
For versions before v3.4 you write settings in the first code block of the special `📋 Templates/_configuration` note, in JSON format. The first time the plugin is run it should detect it doesn't have configuration, and offer to write some to this note. Alternatively, in that note, include the following settings you want in its first code block. This is the annotated list of settings, with their defaults:

If you want , please insert the following in the first codeblock in your `Templates/_configuration` note:

```jsonc
  {
	filer: {
    addDateBacklink: false, // If true, adds date reference on the moved paragraph(s) when moved from a daily note
    dateRefStyle: "link", // The style of date to add 'link' ('>date') or 'at' ('@date') or 'date' (a formatted date string)
    useExtendedBlockDefinition: false, //Controls whether all the lines in the current heading's section are included in the block to move (true) or whether only the following ones that are more deeply indented are included (false; this is the default). In both cases a block is closed by a blank line or a separator (horizontal line).",
    whereToAddInSection: "start" // Controls whether moved lines get inserted at the \"start\" or \"end\" of the chosen section
  },
```

## History
Please see the [CHANGELOG](CHANGELOG.md).
