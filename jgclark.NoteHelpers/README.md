# 📙 NoteHelpers plugin
This plugin provides these commands to help jump quickly between NotePlan notes, and manage them:
- **/open note new window** (alias **/onw**): open a user-selected note in a new window (and places the cursor at what it judges to be the start of the main content)
- **/open note new split** (alias **/ons**): open a user-selected note in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **/open current note new split** (alias **/ocns**): open the current note again in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **/jump to note's heading** (alias **/jh**): jumps the cursor to the selected heading in the current note
- **/jump to note** (alias **/jn**): jump to a different note, and then selected heading
- **/jump to done** (alias **/jd**): simply jumps the cursor to the `## Done` section of the current note (if it exists)
- **/move note** (alias **/mn**): which moves a note to a different folder the user selects
- **/make notes index** (alias **/index**): makes or updates note link Indexes for one or more folders
- **/convert to frontmatter**: convert the current note to use frontmatter syntax, including optional default text that can be added in the Plugin's settings.
- **/add number of days to dates**: looks for bullets in your current open note that end with `[[YYYY-MM-DD]]:` and adds the number of days to or since that date. Useful for making lists of important days and easily knowing number of days to (or since) that day.
- **/enable heading links**: converts Local links to headings (they start with the `#` character) to `x-callback-url` links that makes them work the way you expect them to. *NOTE*: They currently only support links to headings within the same note.
- **/open todo links in browser**: find all open todos in the Editor with URLs and open any URLs in a browser (useful if you have JIRA tasks or other TODOs where you need to reference external items)

## History
See [CHANGELOG](CHANGELOG.md) for the plugin's history.
