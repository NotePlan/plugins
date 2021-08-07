# ☀️ Daily Journal plugin
This plugin provides two commands for daily journalling, including start-of-day template, and end-of-day review questions. Both work on the currently open daily calendar note:

- `/dayStart`: Apply your `Daily Note Template` to the currently open calendar note, which by default includes list of today's events and local weather lookup.
- `/dayReview`: Ask journal questions for an end-of-day review in the currently open calendar note.

## Configuration
### /dayStart
`/dayStart` uses the `Daily Note Template` note found in the `Templates` folder. If this note has not been added, it should prompt you to create one.
For details of the commands you can use, including a list of events, a quote-of-the-day or summary weather forecast, see [Templates plugin README](https://github.com/NotePlan/plugins/tree/main/nmn.Templates/).

### /dayReview
You configure the set of questions to ask in the `Templates/_configuration` note. For example:

```javascript
{
	...
	dailyJournal: {
		reviewSectionHeading: "Journal",
		reviewQuestions: "@work(<int>)\n@fruitveg(<int>)\nMood:: <mood>\nGratitude:: <string>\nGod was:: <string>\nAlive:: <string>\nNot Great:: <string>\nWife:: <string>\nRemember:: <string>", // NB: need to use "\n" for linebreaks rather than actual linebreaks, as even JSON5 doesn't fully support multi-line strings.
		moods: "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
	}
```
(This example is in JSON5 format (though labelled 'javascript' for code display purposes): see the help text in `_configuration` note.)

In more detail:
- **reviewSectionHeading**: the name of an existing markdown heading after which the review answers are added. If it doesn't exist, it is added at the end of the note.
- **reviewQuestions**: a string that includes both the questions and how to lay out the answers in the daily note. There are several possible question types: `<int>`, `<number>`, `<string>`, `<mood>`. The first two are integer and any kind of number; the third is a string, and the last pops up a list of moods to select from.  You can indicate new lines with `\n` characters.
- **moods**: a comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.
