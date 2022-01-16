# 🗃 Summaries plugin

This plugin lets you do the following with your daily (calendar) notes:
- list out all the great `@win`s or clever `#idea`s you noted down
- show all the things you had `Gratitude:` for in your journal
- count every time you've noted you've visited  `#family` this month
- sum the length of your `@run()`s last quarter
- automatically add your progress this week against your goal of getting average 8 hours `@sleep()` when you generate your daily note
- count all the times you've met with staff member `@alice` this year so far.
<!-- - save the results of a search term given at run time -->

You can also save results of any search over all notes.

## Commands
This Plugin provides commands that generate several different sorts of **summaries** and **basic stats from your daily notes**, that are saved back into special NotePlan notes in the Summaries folder. Most start by asking for the time period you wish to operate over:

![time period selection](time-period-selection.jpg)

- **`/saveSearchResults`** searches across all notes (both calendar and projects) for a text string you give. It asks where to save its output: to the curre note, to the Plugin Console, or to a specially-created note in the Summaries folder.  (It will update the previous note with that same title, if it exists.)
- **`/occurrencesInPeriod`** generates all occurences of one or more search terms from the daily notes of the time period you select. It offers you your default search terms (if set by ``), or lets you choose. Where an occurrence is in a daily note, this can be appended as a date in your locale or as a date 'link', as configured below.
<!-- TODO: change to  saveSearchResultsInPeriod -->
- **`/countsInPeriod`** generates some simple counts and other statistics of #hashtags or @mentions that you specify. It asks where to save its output: to screen, to the Plugin Console, or to a specially-created note in the Summaries folder.  (It will update the previous note for that same time period, if it exists.)  
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

- **`/insertProgressUpdate`** is a rather niche command to help see progress within the current week or month against numeric items you track. It does this by generating stats for the specified mentions (not hashtags yet) over either the week to date or month to date, and inserts them into the current note. This is designed for use in a Daily Note Template: to use it like this insert the command tag `{{insertProgressUpdate('wtd')}}` (for week to date) or `{{insertProgressUpdate('mtd')}}` (for month to date).   
For example, it produces for me:

```markdown
### Progress Update: Day 14 for Jan 2022
@fruitveg	10	(total 40	average 4.0)
@run	2	(total 10.4	average 5.2)
@sleep	14	(total 103	average 7.4)
@work	11	(total 90	average 8.2)
```

- **`/weeklyStats`** is a very niche command! It generates stats for the specified mentions and hashtags over a period of consecutive weeks, and write out as a CSV table to 'Summaries/weekly_stats'. This is designed for plotting using the third-party gnuplot tool.

**Please note** that in each of these: 
- all notes in the special folders @Archive and @Trash are ignored.  Others can be exluded too using the `foldersToExclude` setting (see below).
- the searches are simple ones, not using fuzzy matching or regular expressions.

## Configuration
These commands require configuration.

In NotePlan v3.3.2 and above, please click the gear button on the 'Summaries' line in the Plugin Preferences panel.

NotePlan v3.3.1 and earlier uses the first configuration block of the special `Templates/_configuration` note. The first time the plugin is run it should detect it doesn't have configuration, and offer to write some to this note. Alternatively, in that note, include the following settings you want in its first code block. This is the annotated list of settings, with their defaults:

```jsonc
{
  ...
  summaries: {
    folderToStore: 'Summaries', // folder to store any output files in
    foldersToExclude: ['📋 Templates', 'Summaries'], // list of folders (and their sub-folders) to exlude in these commands. Note that @Trash and @Archive are always excluded
    headingLevel: 2, // use level 1-5 headings when writing output to notes
    // settings for 'countsInPeriod':
    hashtagCountsHeading: '#hashtag counts',
    mentionCountsHeading: '@mention counts',
    showAsHashtagOrMention: true, // if false hide the # or @ symbols
    // In the following the includes (if specified) takes precedence over any excludes.
    // Items in the list need to be included in quotes, separated by commas.
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@water', '@sleep']
    excludeMentions: ['@done', '@repeat'],
  // settings for 'occurrencesInPeriod':
    occurrencesHeading: 'Occurrences',
    defaultOccurrences: ['idea', '@review', '#question'],
    highlightOccurrences: false, // use ==highlight== of matched occurrences in output
    showEmptyOccurrences: false, // if no occurrences found of this string to match, make this clear
    dateStyle: 'link', // where the context for an occurrence is a date, does it get appended as a `date` using your locale, or as a NP date `link` (`>date`) or `at` (`@date`) or `none`
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@water', '@sleep']
    // In the following the includes (if specified) takes precedence over excludes ...
    progressHeading: 'Progress Update',
    progressHashtags: [], // e.g. ['#gym','#jog']
    progressMentions: [] // e.g. ['@work','@fruitveg','@sleep']
  },
  ...
}
```
(This example fragment is in JSON5 format: ensure there are commas at the end of all that lines that need them.)

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

## To do
- test allowing regular expressions as search terms.

## History
NB: `countsInPeriod` command started life as `/stp` (stats for time period) in the Statistics plugin.

Please see the [CHANGELOG](CHANGELOG.md).
