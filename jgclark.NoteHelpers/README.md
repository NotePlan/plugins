# 📙 NoteHelpers plugin
- **/add number of days to dates**: looks for bullets in your current open note that end with `[[YYYY-MM-DD]]:` and adds the number of days to or since that date. Useful for making lists of important days and easily knowing number of days to (or since) that day.
- **/convert to frontmatter**: convert the current note to use frontmatter syntax, including optional default text that can be added in the Plugin's settings.
- **/enable heading links**: converts Local links to headings (they start with the `#` character) to `x-callback-url` links that makes them work the way you expect them to. Note: They currently only support links to headings within the same note.  (by @nmn)
This plugin provides these commands to help do things with NotePlan notes that aren't yet provided in the app:
- **/index folders** (alias **/index**): make/update indexes for all notes in a folder (and sub-folders if wanted)
- **/jump to heading** (alias **/jh**): jumps the cursor to the selected heading in the current note. See below for how to use this from a x-callback-url
- **/jump to note's heading** (alias **/jn**): jump to a different note, and then to the selected heading
- **/jump to done** (alias **/jd**): simply jumps the cursor to the `## Done` section of the current note (if it exists)
- **/move note** (alias **/mn**): which moves a note to a different folder the user selects
- **/open note new window** (alias **/onw**): open a user-selected note in a new window (and places the cursor at what it judges to be the start of the main content)
- **/open note new split** (alias **/ons**): open a user-selected note in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **/open current note new split** (alias **/ocns**): open the current note again in a new split of the main window (and places the cursor at what it judges to be the start of the main content)
- **/rename note filename** renames the currently open note. Note: this changes the underlying _filename_ not the visible _title_.

## Using as an x-callback call
From v0.15 it's possible to call the "/jump to heading" command from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=jump%20to%20heading&arg0=<encoded string>
```

This can be used in a template or shortcut, or any other place a URL can be accessed.
<!-- Notes:
- the number and order of arguments you pass is important
- where an argument isn't valid, don't include it
- as with all x-callback URLs, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.

| Command | x-callback start | arg0 | arg1 | arg2 |
|-----|-------------|-----|-----|-----|
| /quick add task to inbox | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20task%20to%20inbox&` | text to add |  |  | 

-->

## History
See [CHANGELOG](CHANGELOG.md) for the plugin's history.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!
