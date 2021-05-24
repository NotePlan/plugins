# Filer plugin
This plugin provides the **`/fp`** command to help quickly file any paragraphs (any sort of line, not just tasks) to different notes in NotePlan.

It works out what you want moving from the current open note using this priority order:

- current selected region (you don't need to select the whole of the first or last lines)
- current heading + its following section (up to the next title of the same level or higher)
- current line the cursor is in

It pops up the command bar to choose the project note you want to move it to, followed by the heading within that note to move it after.  You can press Escape (on Mac) at any time to cancel the move.

## Configuration
None needed.

## History

### v0.2.0, 25.5.2021
- first release
