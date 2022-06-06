# ⚡️ QuickCapture plugin
This plugin provides commands to more quickly add tasks/todos or general text to NotePlan notes, _without having to switch away from the note you're currently working on_:

- **/quick add task to inbox** (was **/int**): Quickly add a task to your '📥 Inbox' note. (To configure this, see below.)
- **/quick add task under heading** (was **/qath**): Quickly add a task at the top of a chosen note's heading
- **/quick add line under heading** (was **/qalh**): Quickly add text lines at the top of a chosen note's heading
- **/quick add to daily note** (was **/qad**): Quickly append a task to a chosen daily (calendar) note
- **/quick add to journal today** (was **/qaj**): Quickly add text to the Journal section of today's daily note
- **/quick add task to note** (was **/qat**): Quickly append a task to a chosen project note
- **/quick prepend task to daily note** (was **/qpd**): Quickly prepend a task to a chosen daily (calendar) note
- **/quick prepend task to note** (was **/qpt**): Quickly prepend a task to a chosen project note. (Inserts after title or YAML frontmatter, or starting metadata lines.)

(You can still use the short command names as is.)

## Configuration
The command `/quick add task to inbox` require configuration. In NotePlan v3.4 and above, please click the gear button on the 'Event Helpers' line in the Plugin Preferences panel.

Here are details on the various settings:
- **InboxTitle**: name of your inbox note, or leave empty to use the daily note instead. (Default: "📥 Inbox".)
-	**Where to Add to Inbox note**: either "prepend" (start) or "append" (end)
- **Text to append to new inbox tasks**: optional text to append to any tasks captured to the inbox through /int

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
| /quick add task to inbox | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20task%20to%20inbox&` | text to add |  |  |
| /quick add task under heading | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20task%20under%20heading` | note title (can be YYYYMMDD or YYYY-MM-DD for an existing daily note) | note heading to add text under | text to add |
| /quick add line under heading | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20line%20under%20heading` | note title (can be YYYYMMDD or YYYY-MM-DD for an existing daily note) | note heading to add text under | text to add |
| /quick add to daily note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20daily%20note` | note date (YYYYMMDD) | text to add |  |
| /quick add to journal today | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20journal%20today` | text to add |  |  |
| /quick prepend task to daily note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20daily%20note` | note date (YYYYMMDD) | text to add |  |
| /quick append task to note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20append%20task%20to%20note` | note title | task to append | |
| /quick prepend task to note | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20prepend%20task%20to%20note` | note title | task to prepend | |

## History
See [CHANGELOG](CHANGELOG.md)
