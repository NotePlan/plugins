# 🗃 Filer plugin
This plugin provides the **`/fp`** and **`/mp`** commands to help quickly **file** (**move**) any paragraphs (any sort of line, not just tasks) to different notes in NotePlan.

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in
- current line the cursor is in, plus any indented lines that follow it

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.

It also provides the **`/nns`** **new note from selection** command, which extends the **`/nn`** command. It is interactive, prompting various questions as it works.

## Configuration
If you want to stop date backlinks being added, please insert the following in the first codeblock in your `Templates/_configuration` note:

```javascript
  {
	filer: {
    addDateBacklink = false,
  },
```
The plugin should offer to write the default for you the first time it runs.
