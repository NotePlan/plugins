# 🗃 Summaries plugin
This plugin provides two commands:

- `Counts in Period` (was `/stp`) way of generating some statistics and summaries over time periods: months, quarters, or years.
If first asks what time period you want to generate over.
Then it asks where to save its output: to screen, to console log, or to a specially-created note in the Summaries folder.  (If the latter it will update a previous note for that same time period.)

- `Occurrences in Period` ???

## History
Please see the [CHANGELOG](CHANGELOG.md).

## Configuration
These commands require configuration; the first either is run it should detect it doesn't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 
Alternatively, in that note, include the following settings you want in its first code block. For example:

```jsonc
...
summaries: {
  folderToStore: 'Summaries',
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
},
...
```
(This example fragment is in JSON5 format: ensure there are commas at the end of all that lines that need them.)

???
