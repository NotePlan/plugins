# 🗃 Summaries plugin

This plugin lets you do the following:
- count every time you've noted you've visited  `#family` in your daily notes this month
- summed the length of your `@run(n)`s last quarter
- counted all the times you've met with staff member `@alice` this year so far.
- lists out all the clever `#idea`s you noted down
- shows all the things you had `Gratitude:` for in your journal entries.
<!-- - save the results of a search term given at run time -->

## About
This plugin generates two different sorts of **summaries from your daily notes**, that are saved back into special NotePlan notes in the Summaries folder. They both start by asking for the time period you wish to operate over:

![time period selection](time-period-selection.jpg)

- **`countsInPeriod`** generates some simple counts and other statistics of #hashtags or @mentions that you specify. It asks where to save its output: to screen, to the Plugin Console, or to a specially-created note in the Summaries folder.  (If the latter it will update a previous note for that same time period.)

- **`occurrencesInPeriod`** generates lists of terms you specify found in the daily notes of that time period. This can be words, phrases, #hashtags or @mentions.

## Configuration
These commands require configuration; the first time either is run it should detect it doesn't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 
Alternatively, in that note, include the following settings you want in its first code block. For example:

```jsonc
{
  ...
  summaries: {
    folderToStore: 'Summaries',
    // settings for 'countsInPeriod':
    hashtagCountsHeading: '#hashtag counts',
    mentionCountsHeading: '@mention counts',
    countsHeadingLevel: 2, // one of markdown heading level 1-5
    showAsHashtagOrMention: true, // if false hide the # or @ symbols
    // In the following the includes (if specified) takes precedence over any excludes.
    // Items in the list need to be included in quotes, separated by commas.
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@water', '@sleep']
    excludeMentions: ['@done', '@repeat'],
  // settings for 'occurrencesInPeriod':
    occurrencesHeading: 'Occurrences',
    occurrencesHeadingLevel: 2, // use level 1-5 headings
    occurrencesToMatch: ['idea', '@review', '#question'],
    highlightOccurrences: false, // use ==highlight== of matched occurrences in output
  showEmptyOccurrences: false, // if no occurrences found of this string to match, make this clear
  },
  ...
}
```
(This example fragment is in JSON5 format: ensure there are commas at the end of all that lines that need them.)

To see highlighting of matching terms in the occurrences output, you'll need to be using a theme that includes highlighting using `==this style==`. Or you could customise an existing one, adding something like:
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
- create a version of occurrences to save the results of a search term given at run time
- add ability to have dates as date-links 

## History
NB: `countsInPeriod` command started life as `/stp` (stats for time period) in the Statistics plugin.

Please see the [CHANGELOG](CHANGELOG.md).
