# Filer plugin
This plugin provides the **`/fp`** command to help quickly file any paragraphs (any sort of line, not just tasks) to different notes in NotePlan.

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines; the plugin will grab the whole lines)
- current heading and its following section (up to the next title of the same level or higher)
- current line the cursor is in
- current line the cursor is in, plus any indented lines that follow it

It pops up the command bar to choose the note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel.  The move happens in the background, leaving you in the current note.

## Configuration
If you want to stop date backlinks being added change the line at the top of the plugin'\ `fileItems.js` file to: `const pref_addDateBacklink = false;`

## History
### v0.3.3, 11.6.2021
- remove restriction to move to just project notes
- update code to work with today's API fixes
- bug fixes and additions to README
- add `/mp` (move) as an alias to `/fp` (file)

### v0.3.0, 31.5.2021
- added ability to move any indented paragraphs after the selected line
- creates a `>date` backlink when moving from a calendar note (requested by @Dimitry). Can be turned off by the `pref_addDateBacklink` setting (see above).

### v0.2.2, 26.5.2021
- add ability to move paragraphs to top or bottom of note. (Top of note comes after title if there is one.)
- works when moving to notes with _no title or headings at all_ [Issue 10 by @dwertheimer ]

### v0.2.0, 25.5.2021
- first release
