# ⚡️ QuickCapture plugin
This plugin provides commands to more quickly add tasks/todos or general text to NotePlan notes, _without having to switch away from the note you're currently working on_:

- **/quick add task to inbox** (alias **/int**): Quickly add a task to your chosen Inbox location. (To configure this, see below.)
- **/quick add task under heading** (alias **/qath**): Quickly add a task at the top of a chosen note's heading
- **/quick add line under heading** (alias **/qalh**): Quickly add text lines at the top of a chosen note's heading
- **/quick add to daily note** (alias **/qad**): Quickly add a task to a chosen daily (calendar) note
- **/quick add to weekly note** (alias **/qaw**): Quickly add a task to a chosen weekly note
- **/quick add to journal today** (alias **/qaj**): Quickly add text to the Journal section of today's daily note
- **/quick add task to note** (alias **/qat**): Quickly append a task to a chosen project note
- **/quick prepend task to daily note** (alias **/qpd**): Quickly prepend a task to a chosen daily (calendar) note
- **/quick prepend task to note** (alias **/qpt**): Quickly prepend a task to a chosen project note. (Inserts after title or YAML frontmatter, or starting metadata lines.)

**Tip for macOS users**: add Keyboard Shortcuts to get to these commands even more quickly.


## Configuration
The command `/quick add task to inbox` requires configuring, by clicking on the gear button on the 'Event Helpers' line in the Plugin Preferences panel.

The settings are:
- **Where is your Inbox?**: Select 'Daily' or 'Weekly' to use whatever is the current daily or weekly note. Or  choose 'Fixed' and then add the note title in the next setting
- **InboxTitle**: If the previous setting is set to 'Fixed', this is wherre you set the Title of that note. (Default: "📥 Inbox".)
-	**Where to add in Inbox?**: either "prepend" (start) or "append" (end) in Inbox (and the other commands which use the term 'add')
- **Text to append to new inbox tasks**: optional text  (that can include hashtags or mentions) to append to any tasks captured to the inbox.

## Using from x-callback calls
From v0.9 it's possible to call each of these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=<encoded command name>&arg0=<encoded string>&arg1=<encoded string>&arg2=<encoded string>
```
Notes:
- the number and order of arguments you pass is important
- where an argument isn't valid, don't include it
- as with all x-callback URLs, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.

| Command | x-callback start | arg0 | arg1 | arg2 |
|-----|-------------|-----|-----|-----|
| /quick add task to inbox | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20task%20to%20inbox&` | text to add (to whichever is your configured Inbox location) |  |  |
| /quick add task under heading | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20task%20under%20heading` | note title (can be YYYYMMDD or YYYY-MM-DD for an existing daily note) | note heading to add text under | text to add |
| /quick add line under heading | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20line%20under%20heading` | note title (can be YYYYMMDD or YYYY-MM-DD for an existing daily note) | note heading to add text under | text to add |
| /quick add to daily note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20daily%20note` | note date (YYYYMMDD or YYYY-MM-DD) | text to add |  |
| /quick add to weekly note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20weekly%20note` | note date (YYYY-Mnn) | text to add |  |
| /quick add to journal today | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20journal%20today` | text to add |  |  |
| /quick prepend task to daily note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20daily%20note` | note date (YYYYMMDD) | text to add |  |
| /quick append task to note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20append%20task%20to%20note` | note title | task to append | |
| /quick prepend task to note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20prepend%20task%20to%20note` | note title | task to prepend | |

## History
See [CHANGELOG](CHANGELOG.md)

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:
![https://www.buymeacoffee.com/revjgc](https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg). Thanks!
