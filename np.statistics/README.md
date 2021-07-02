# Statistics plugin
This plugin provides some simple count commands:

- `/nc`: shows counts of all the notes in NotePlan
- `/tsp`: shows task statistics for project notes
- `/tc`: shows task counts for the current note
- `/wc`: shows word count and other numbers for the open note

It also provides the `/stp` way of generating some statistics and summaries over time periods: months, quarters, or years.
If first asks what time period you want to generate over.
Then it asks where to save its output: to screen, to console log, or to a specially-created note in the Summaries folder.  (If the latter it will update a previous note for that same time period.)

## Configuration
The `/stp` command requires configuration; the first time its run it should detect it doesn't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 
Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```javascript
...
statistics: {
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

## History
### v0.3.3, 2.7.2021
- tweaks to display; large numbers will now display using local settings for thousands separators

### v0.3.2, 29.6.2021
- add /stp command to generate some statistics and summaries over time periods.

### v0.2.0
- add /tsp, task stats for all projects
- rename commands to use new abbreviated form

### v0.1.0
- first release, with /tc (task count), /wc (word count) and /nc (note count) statistics
