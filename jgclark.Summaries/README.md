# 🗃 Summaries plugin

This plugin lets you do the following sorts of things with your daily (calendar) notes:
- list out all the great `@win`s or clever `#idea`s you noted down
- show all the things you had `Gratitude:` for in your journal
- count every time you've noted you've visited  `#family` this month
- count the times you've met with staff member `@alice` this year so far
- sum the length of your `@run(...)`s last quarter
- automatically add your progress this week against your goal of getting an average 8 hours `@sleep()` when you generate your daily note

And also:
- save the results of any search over all notes (or a subset of notes by date) to a note
- make a Map of Content (MOC) note for a search term

## Commands
This Plugin provides commands that generate several different sorts of **summaries** and **basic stats from your daily notes**, that are saved back into special NotePlan notes in the Summaries folder. Most start by asking for the time period you wish to operate over:

![time period selection](time-period-selection.jpg)

Each command is considered in turn. 
**Please note** that in each of these: 
- all notes in the special folders (@Archive, @Templates and @Trash) are **ignored**.  Others can be exluded too using the `foldersToExclude` setting (see below).
- the **searches** are simple ones, not using fuzzy matching or regular expressions.
- these commands require **configuration**. See section below for details of how to add/update the relevant settings for each command.

### `/saveSearchResults`
This command searches across **all notes** (both calendar and projects) for a text string you give. It asks where to save its output: to the current note, to the Plugin Console, or to a specially-created note in the Summaries folder.  (It will update the previous note with that same title, if it exists.)

The relevant settings for this command are:
- folderToStore: e.g. 'Summaries'
- foldersToExclude: e.g. ['Summaries']
- headingLevel: e.g. 2
- highlightOccurrences: false or true
- dateStyle: e.g.'link'

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
This command can also be run from an x-callback command (details below).
### `/saveSearchResultsInPeriod`
This command generates all 'occurences' of one or more search terms from the **daily notes** of the time period you select. It offers you your default search terms (if set by the `defaultOccurrences` setting), or lets you choose. Where an occurrence is in a daily note, this can be appended as a date in your locale or as a date 'link'. 

The relevant settings are:
- folderToStore: e.g. 'Summaries'
- foldersToExclude: e.g. ['Summaries']
- headingLevel: e.g. 2
- occurrencesHeading: e.g. 'Search Results',
- defaultOccurrences: ['idea', '@review', '#question'],
- highlightOccurrences: false or true
- showEmptyOccurrences: false or true
- dateStyle: e.g. 'link'

To visually highlight occurrences, please see the note above.

This command can also be run from an x-callback command (details below).

### `/countsInPeriod`
This command generates some simple counts and other statistics of #hashtags or @mentions that you specify. For example:
- **count** every time you've noted you've visited  `#family` this month
- **count** the times you've met with staff member `@alice` this year so far
- **sum** the length of your `@run(...)`s last quarter (where e.g. `@run(5)` means a run of 5km/miles)
- automatically add your progress this week against your goal of getting an **average** 8 hours `@sleep()` when you generate your daily note

(Why use `@run(...)` rather than `#run(...)`? Well, it just felt more right to use `@run()` as there are already `@done(...)` and `@repeat(...)` mentions in use in NotePlan.)

It asks where to save its output: to screen, to the Plugin Console, or to a specially-created note in the Summaries folder.  (It will update the previous note for that same time period, if it exists.)  
For example, it produces for me:

```markdown
# Jan 2022
## #hashtag counts (to 2022-01-14)
#article	1
#bankholiday	1
#closedrings	4
#covidtest	3
...
## @mention counts (to 2022-01-14)
@fruitveg	10	(total 40	average 4.0)
@run	2	(total 10.4	average 5.2)
@sleep	14	(total 103	average 7.4)
...
```

The settings for this command are:
- folderToStore: e.g. 'Summaries'
- foldersToExclude: e.g. ['Summaries']
- headingLevel: e.g. 2
- hashtagCountsHeading: e.g. '#hashtag counts',
- mentionCountsHeading: e.g. '@mention counts'
- showAsHashtagOrMention: true / false -- i.e. whether to include the @ or # characters
- includeHashtags: e.g. ['#holiday','#jog','#commute','#webinar']
- excludeHashtags: e.g. []
- includeMentions: e.g. ['@work','@fruitveg','@water', '@sleep']
- excludeMentions: e.g. ['@done', '@repeat'],

### `/insertProgressUpdate`
This is a rather niche command to help see progress within the current week or month against numeric items you track. It does this by generating stats for the specified mentions (not hashtags yet) over either the week to date or month to date, and inserts them into the current note. This is designed for use in a Daily Note Template: to use it like this include the command tag `{{progressUpdate( {...} )}}` in your Template note. This takes two possible parameters: `{ interval: 'mtd', heading: 'Progress Update'}`, where the first is 'wtd' (week to date) or 'mtd' (month to date), and the second the heading to use before the results.

For example, it produces for me:
```markdown
### Progress Update: Day 14 for Jan 2022
fruitveg	10	(total 40	average 4.0)
run	2	(total 10.4	average 5.2)
sleep	14	(total 103	average 7.4)
work	11	(total 90	average 8.2)
```

The relevant settings for this command are:
- progressHeading: e.g. 'Progress Update'  (this is overriden by a heading parameter if given)
- progressHashtags: e.g. ['#covidtest']
- progressMentions: e.g. ['@done', '@repeat']

### `/weeklyStats`
This is a very niche command! It generates stats for the specified mentions and hashtags over a period of consecutive weeks, and write out as a CSV table to 'Summaries/weekly_stats'. This is designed for plotting using the third-party gnuplot tool.

The relevant settings for this command are:
- folderToStore: e.g. 'Summaries'
- weeklyStatsDuration: e.g. 26

## Using from x-callback calls
From v0.8 it's possible to call some of these commands from [outside NotePlan using the **x-callback mechanism**](https://help.noteplan.co/article/49-x-callback-url-scheme#runplugin). The URL calls all take the same form:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=<encoded command name>&arg0=<encoded string>&arg1=<encoded string>
```
Notes:
- the number and order of arguments you pass is important
- where an argument isn't valid, don't include it
- as with all x-callback URLs, all the arguments (including the command name) need to be URL encoded. For example, spaces need to be turned into '%20'.

| Command | x-callback start | arg0 | arg1 |
|-----|-------------|-----|-----|
| /saveSearchResults | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=saveSearchResults&` | search term(s) (separated by commas) |   |
| /saveSearchResultsInPeriod | `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=saveSearchResultsInPeriod&` | search term(s) (separated by commas) | optional number of days to search over (from before today). If not given then defaults to 3 months. |

## Configuration
Click the gear button on the 'Summaries' line in the Plugin Preferences panel to configure this plugin. Each setting has an explanation.

## History
Please see the [CHANGELOG](CHANGELOG.md).
