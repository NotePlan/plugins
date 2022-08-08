# 🔎 Search Extensions plugin
NotePlan can search over your notes, but it is currently not very flexible or easy to use; in particular it's difficult to navigate between the search results and any of the actual notes it shows.  This plugin attempts to add some power and usability to searching.  Most things can be configured, but by default the search runs and **saves the results in a note that it opens as a split view** next to where you're working.

![demo](demo1.gif)

Another neat feature is the inclusion of a " [🔄 Click to refresh results]" pseudo-button under the title of the note. Clicking that runs the search again, and replaces the earlier set of results. (Thanks to @dwertheimer for the suggestion, which is a good use of the x-callback mechanism -- see below.)

![refresh results](highlight-refresh-in-search-results.png)

There are several /commands:

1. **/quickSearch** searches across **all notes** (both calendar and regular notes), saving to a pre-set 'Quick Search Results' note. (Alias: **/qs**.)
2. **/saveSearch** searches across **all notes**  (both calendar and regular notes). (Alias: **/ss**.)
3. **/saveSearchOverNotes** searches across **all regular** (non-calendar) notes.
4. **/saveSearchOverCalendar** searches across **all calendar**  notes.
5. **/saveSearchResultsInPeriod**: searches over the **calendar <!--and weekly--> notes of the time period you select**:

![selecting a period](period-selection.png)

The note is saved with the search terms as its title (apart from /quickSearch), in a "Saved Searches" folder (which is created if necessary). If the same search terms are used again they will *update* the same note.  But you also are given the option of saving to the current note, or to the plugin console.

As the results are saved to a note, the following sorts of uses are then possible:
- keep track of all the great `@win`s or clever `#idea`s you noted down
- show all the things you had `Gratitude:` for in your daily journal

## Notes about searches
- (from v0.5) put a `+`  and `-` search operator on the front of terms that **must** appear, and **must not** appear, respectively.  For example `+must may could -cannot"` has 4 search terms, the first must be present, the last mustn't be present, and the middle two (may, could) can be.
- the test for + and - is done per line in notes. If you wish to ignore the whole note that has a term, you can use the ! operator, e.g. `+must_have_me !no_way_jose`. (thanks @dwertheimer for this suggestion)
- you can also use older search style: for example searching for terms X or Y using `X, Y` or `X OR Y`
- the searches are simple ones, matching on whole or partial words, not using fuzzy matching or regular expressions
- you can set default search terms (in the `Default Search terms` setting); if set you can still always override them.
- all notes in the special folders (@Archive, @Templates and @Trash) are ignored.  Others can be exluded too using the "Folders to exclude" setting.

## Notes about results output
There are two ways results can be displayed, controlled by the "Group results by Note?":
1. matches found within the same note are grouped together ('true', the default)
2. every match is shown with a note link at the end of the match ('false')

You can also set:
- the length of the quote of the matched line can be limited by the "Result quote length" setting.
- the ordering of the results by the title, created date or changed date of the note the search term is found in.
- the commands to automatically decides the name of the note to save the search results to based on the search term, which avoids the final prompt, by the 'Automatically save?' setting.

## Settings
To change the default **settings**, click the gear button on the 'Search Extensions' line in the Plugin Preferences panel to configure this plugin. Each setting has an explanation.

![search settings](search-settings.jpg)

## Results highlighting
To see **highlighting** of matching terms in the output, you'll need to be using a theme that highlights lines using `==this syntax==`. You can [customise an existing theme](https://help.noteplan.co/article/44-customize-themes) by adding something like:

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
    "highlighted-left-marker": {
      "regex": "(==)([^\\s].+)(==)",
      "color": "#AA45A2E5",
      "backgroundColor": "#7745A2E5",
      "isMarkdownCharacter": true,
      "isHiddenWithoutCursor": true,
      "isRevealOnCursorRange": true,
      "matchPosition": 1
    },
    "highlighted-right-marker": {
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
It's possible to call these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=<encoded command name>&arg0=<encoded string>&arg1=<encoded string>
```
Notes:
- the number and order of arguments you pass is important
- where an argument isn't valid, don't include it
- as with all x-callback URLs, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.

| Command | x-callback start | arg0 | arg1 | arg2 |
|-----|-------------|-----|-----|-----|
| /quickSearch | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=quickSearch&` | search term(s) (separated by commas) | terms to filter by paragraph type (separated by commas) | noteTypesToInclude either 'project','calendar' or 'both' |
| /saveSearch | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearch&` | search term(s) (separated by commas) | terms to filter by paragraph type (separated by commas) |  |
| /saveSearchOverCalendar | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchOverCalendar&` | search term(s) (separated by commas) | terms to filter by paragraph type (separated by commas) |  |
| /saveSearchOverNotes | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchOverNotes&` | search term(s) (separated by commas) | terms to filter by paragraph type (separated by commas) |  |
| /saveSearchInPeriod | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions&command=saveSearchInPeriod&` | search term(s) (separated by commas) | start date to search over (YYYYMMDD or YYYY-MM-DD format). If not given, then defaults to 3 months ago. | end date to search over (YYYYMMDD or YYYY-MM-DD format). If not given, then defaults to today. |

## Future work
In time I hope to be able to support searching for phrases such as `Bob Smith`, meaning that exact two-word phrase. However, the underlying API doesn't yet make this a realisitic possibility.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:
![https://www.buymeacoffee.com/revjgc](https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg). Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
