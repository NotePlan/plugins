# 🧹 Tidy Up plugin

This plugin provides commands to help tidy up your notes:

- **/File root-level notes** (alias "frnl"): For each root-level note, asks which folder you'd like it moved to. (There's a setting for ones to permanently ignore.)
- **/List conflicted notes** (alias "conflicts"): creates/updates a note that lists all your notes on your current device with file-level conflicts, along with summary details about them. It gives options to delete one or other of the conflicted versions. Note: _conflicted notes can appear on each device you run NotePlan on, and the conflicted copies do not sync. Therefore you should consider running this on each of your devices._
    ![](conflicted-notes@2x.png)
- **/List duplicate notes** (alias "dupes"): creates/updates a note that lists all your notes with identical titles, along with summary details about those potential duplicates. It gives options to delete one or other of the conflicted versions:
    ![](duplicate-note-display@2x.png)
- **/List doubled notes**:  creates/updates a note that lists calendar notes that potentially have doubled content (i.e. internal duplication). Note: this is unlikely to happen, but it happened to me a lot for reasons I don't understand. This command helped me go through the notes and manually delete the duplicated content.
- **/List stubs**: creates a note that lists all your notes that have wikilinks that lead nowhere.
- **/Move top-level tasks in Editor to heading** (alias "mtth"): Move tasks orphaned at top of active note (prior to any heading) to under a specified heading. Note: this command does not work inside a template. See details below.
- **/Remove blank notes** (alias: "rbn"): deletes any completely blank notes, or just with a starting '#' character.
- **/Remove orphaned blockIDs** (alias "rob"): Remove blockIDs from lines that had been sync'd, but have become 'orphans' as the other copies of the blockID have since been deleted.
- **/Remove section from recent notes** (alias "rsrn"): Remove a given section (heading + its content block) from recently-changed notes. Can be used with parameters from Template or x-callback.
 - **/Remove section from all notes** (alias "rsan"). Remove a given section (heading + its content block) from _all notes_. Use wisely, as this is dangerous! (original function by @dwertheimer)
- **/Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.
- **/Remove @done() markers** (alias "rdm"): Remove @done(...) markers from recently-updated notes, optionally just from completed checklist items.
- **/Remove >today tags from completed todos** (alias "rmt"): Removes the ">today" tag still attached to completed/cancelled tasks that means they keep showing up in Today's references every day forever. Does not touch open tasks.
- **/Remove triggers from recent calendar notes** (alias "rtcn"): Remove one or more triggers from recently changed calendar notes (in the past).
- **/Log notes changed in interval** (alias "lncii"): Write a list of notes changed in the last interval of days to the plugin console log. It will default to the 'Default Recent Time Interval' setting unless passed as a parameter.

Most can be used with parameters from a Template, or via an x-callback call.

There's also the **/Tidy Up** (alias "tua"), which runs as many of the other commands in this plugin as you have configured in its Settings.

(If these commands are useful to you, you'll probably find the [Note Helpers plugin](https://github.com/NotePlan/plugins/blob/main/jgclark.NoteHelpers/) helpful too. It's rather arbitrary which commands live in which plugin.)

## Automating Tidy Up
If these commands are valuable to you, then you probably want to be running them regularly. NotePlan doesn't yet allow fully automatic running of commands, but you can get close by either including the commands in a frequently-used Template, or from a third-party utility that can invoke x-callback commands. Each are described below.

### Using from Templates
You can include Tidy Up commands in your Daily Note Template that you run each day (e.g. via the separate /dayStart command from my [Daily Journal plugin](https://github.com/NotePlan/plugins/blob/main/jgclark.DailyJournal/README.md)).

To call all the checked commands in settings inside your template:

`<% await DataStore.invokePluginCommandByName("Tidy Up","np.Tidy",[])  %>`

To call one of these commands from a Template use this Templating command:

`<% await DataStore.invokePluginCommandByName("<command name>","np.Tidy",['<parameters>'])  %>`

The parameters are passed as `"key":"value"` pairs separated by commas, and surrounded by curly brackets `{...}` (JSON encoding). Note the parameters then need to be surrounded by square brackets and single quotes.

For example, this will remove sections with the heading 'Habit Progress' from notes changed in the last 2 days, running silently:

`<% await DataStore.invokePluginCommandByName("Remove section from notes","np.Tidy",['{"numDays":2, "sectionHeading":"Habit progress", "runSilently": true}'])  %>`

**Tip:** as these are complicated and fiddly to create, **I suggest you use @dwertheimer's excellent [Link Creator plugin](https://github.com/NotePlan/plugins/blob/main/np.CallbackURLs/README.md) command "/Get X-Callback-URL"** which makes it much simpler.

#### Running **/Move top-level tasks in Editor to heading** in a template

This command rewrites the current document in the Editor, moving tasks from the top to underneath a specified heading. It cannot run like the other commands by itself or as part of TidyUp in a template, because the template processor is rewriting the document in parallel. You will get duplicate headings. There is a way to include this in your daily note, however. If you include some code like the following in your daily note template, it will run the command and include the output in the flow of writing the template, and so the document will not be getting written twice in parallel.
```markdown
## Tasks
*
<% const tasks = await DataStore.invokePluginCommandByName("Move top-level tasks in Editor to heading","np.Tidy",["Tasks",true,true]);  -%>
<% if (tasks?.length) { -%>
<%- tasks %>
<% } -%>
```
This piece of my daily note template:
- creates a "Tasks" heading
- creates a blank task underneath for me to enter tasks during the day
- scans note and gets a list of task content that was at the top of the note (saves in "tasks" variable)
- outputs any tasks that were pre-existing in the note under that new Tasks heading that was just created
NOTE: (thx @phenix): The order is important because the task header needs to be added before the tasks are inserted underneath.

> **NOTE:** If you also run the `Tidy Up` command in your template, you should uncheck this command in the TidyUp settings.

### Using from x-callback calls
It's possible to call most of these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:

`noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=<encoded command name>&arg0=<encoded parameters>`

Notes:
- all parameters are passed as `"key":"value"` pairs separated by commas, and surrounded by curly brackets `{...}`. (This is JSON encoding.)
- as with all x-callback URLs, all the arguments (including the command name) need to be URL-encoded. For example, spaces need to be turned into '%20'.

This is an example of a fully URL-encoded call:

| un-encoded call | URL-encoded call |
| ----- | ----- |
| `noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=Remove section from notes&arg0={"numDays":20, "sectionHeading":"Test Delete Me"}` | `noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=Remove%20section%20from%20notes&arg0=%7B%22numDays%22%3A%202%2C%20%22sectionHeading%22%3A%22Test%20Delete%20Me%22%7D` |

The available parameters are:

| command name | parameter name |
| --------- | --------- |
| List conflicted notes | runSilently |
| List duplicate notes | runSilently |
| Remove @done() markers | foldersToExclude, justRemoveFromChecklists, numDays, runSilently |
| Remove orphaned blockIDs | runSilently |
| Remove section from all notes | keepHeading, runSilently, sectionHeading |
| Remove section from recent notes | matchType, sectionHeading |
| Remove time parts from @done() dates | runSilently |
| Remove >today tags from completed todos | runSilently |
| Move top-level tasks in Editor to heading | Heading name to place the tasks under | runSilently |

**Tip:** as these are complicated and fiddly to create, **I strongly suggest you use @dwertheimer's excellent [Link Creator plugin]() command "/Get X-Callback-URL"** which makes it vastly easier.

## Configuration
On macOS, click the gear button on the '🧹 Tidy Up' line in the Plugin Preferences panel, and fill in the settings accordingly. Defaults and descriptions are given for each one.

On iOS/iPadOS, use the "/Update plugin settings" command for this plugin, which will guide you through the options in turn.

## Thanks
@dwertheimer wrote one of the functions used in this plugin, and helped beta test much of the plugin.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
