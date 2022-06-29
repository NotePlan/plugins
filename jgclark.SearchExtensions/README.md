# 🔎 Search Extensions plugin

This plugin lets you do the following sorts of things:
- list out all the great `@win`s or clever `#idea`s you noted down
- show all the things you had `Gratitude:` for in your journal

It does this by adding two new /commands to allow search results to be saved, and updated later:

### /saveSearchResults command
This command searches across **all notes** (both calendar and projects) for a text string you give. It asks where to save its output: to the current note, to the Plugin Console, or to a specially-created note in the Summaries folder.  (It will update the previous note with that same title, if it exists.)

### /saveSearchResultsInPeriod
This command generates all 'occurences' of one or more search terms from the **daily notes** of the time period you select. It offers you your default search terms (if set by the `Default Search terms` setting), or lets you choose. Where an occurrence is in a daily note, this can be appended as a date in your locale or as a date 'link'. 

Otherwise the details are the same as for "/saveSearchResults".

## Notes
- all notes in the special folders (@Archive, @Templates and @Trash) are ignored.  Others can be exluded too using the 'Folders to exclude' setting (see below).
- the **searches** are simple ones, matching on whole words, not using fuzzy matching or regular expressions.
- these commands require **configuration**. Click the gear button on the 'Summaries' line in the Plugin Preferences panel to configure this plugin. Each setting has an explanation, and they are grouped into relevant sections.

### Results highlighting
To see **highlighting** of matching terms in the occurrences output, you'll need to be using a theme that includes highlighting using `==this syntax==`. You can also customise an existing one, adding something like:

```jsonc
{
  ...
    "highlighted": {
      "regex": "(==)([^\\s].+)(==)",
      "backgroundColor": "#55D2D21B",
      "order": 35,
      "matchPosition": 2,
      "isRevealOnCursorRange": true
    },
    "highlighted-left-colon": {
      "regex": "(==)([^\\s].+)(==)",
      "color": "#AA45A2E5",
      "backgroundColor": "#7745A2E5",
      "isMarkdownCharacter": true,
      "isHiddenWithoutCursor": true,
      "isRevealOnCursorRange": true,
      "matchPosition": 1
    },
    "highlighted-right-colon": {
      "regex": "(==)([^\\s].+)(==)",
      "color": "#AA45A2E5",
      "backgroundColor": "#7745A2E5",
      "isMarkdownCharacter": true,
      "isHiddenWithoutCursor": true,
      "isRevealOnCursorRange": true,
      "matchPosition": 3
    },
  ...
}
```

### Using from x-callback calls
It's possible to call some of these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=<encoded command name>&arg0=<encoded string>&arg1=<encoded string>
```
Notes:
- the number and order of arguments you pass is important
- where an argument isn't valid, don't include it
- as with all x-callback URLs, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.

| Command | x-callback start | arg0 | arg1 |
|-----|-------------|-----|-----|
| /saveSearchResults | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResults&` | search term(s) (separated by commas) |   |
| /saveSearchResultsInPeriod | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchResultsInPeriod&` | search term(s) (separated by commas) | optional number of days to search over (from before today). If not given then defaults to 3 months. |

## History
Please see the [CHANGELOG](CHANGELOG.md).
