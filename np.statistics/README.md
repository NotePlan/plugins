# Statistics plugin
This plugin provides some simple statistics:

- **/note stats** (alias **/nc**): writes counts of notes to a note (default `Note Stats.md`). That note includes a refresh link which runs the command again. Counts are split into Private notes and each Teamspace, plus a combined total of calendar and regular notes. The result is also written to the plugin console.
- **/task stats for all notes** (alias **/tsp**): shows task statistics for all regular and calendar notes (other than in the Archive or Trash) in the CommandBar
- **/task stats for current note** (alias **/tc**): shows task counts for the current note in the CommandBar
- **/word stats for current notes** (alias **/wc**): shows word count and other numbers for the open note in the CommandBar

The task and word commands also write a copy to the plugin console.

## Configuration
**/note stats** has one setting: the filepath of the results note (default `Note Stats.md`). Include a folder if you want the note somewhere other than the root, for example `Stats/Note Stats.md`.

## History
Please see the [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/np.statistics/CHANGELOG.md).
