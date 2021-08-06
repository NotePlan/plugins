# DailyJournal plugin
This plugin provides two commands for daily journalling, including start-of-day template, and end-of-day review questions. Both work on the currently open daily calendar note:

- `/dayStart`: Apply your `Daily Note Template`, which by default includes list of today's events and local weather lookup.
- `/dayReview`: Ask journal questions for an end-of-day review.

## Configuration
### /dayStart
`/dayStart` uses the `Daily Note Template` note found in the `Templates` folder. If this note has not been added, it should prompt you to create one.
If you want to include a short summary of the weather forecast, include a `{{weather()}}` tag at the appropriate place in that template. And then in the `Templates/_configuration` note, including the following settings in the note's first configuration block. For example:

```javascript
{
  ...
	weather: {
		openWeatherAPIKey: "<secret>", // need to get your own API key from openWeather
  		latPosition: "51.3", // use your own latitude as a decimal
  		longPosition: "-1.0", // use your own longitude as a decimal
  		openWeatherUnits: "metric",
	}
  ...
}
```
(This example is in JSON5 format: see the help text in `_configuration` note.)
NOTE: If you want to customize the weather output format in your daily note/template, you can pass a "template" with the format you want. Here's an example with every field:
`{{weather({template:"Weather: |WEATHER_ICON| |DESCRIPTION| |LOW_TEMP||UNITS|-|HIGH_TEMP||UNITS|; Feels like: |FEELS_LIKE_LOW||UNITS|-|FEELS_LIKE_HIGH||UNITS| in |TIMEZONE|")}}`
If you were to insert that entire string in your Daily Note template, it would return something like:
`Weather: ☁️ Broken clouds 68°F-86°F; Feels like: 71°F-83°F in America/Los_Angeles`
### /dayReview
`/dayReview` uses the `Daily Note Template` note found in the `Templates` folder. If this note has not been added, it should prompt you to create one.

In the `Templates/_configuration` note, including the following settings you want in the note's first configuration block. For example:

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
- **reviewSectionHeading**: the name of a heading after which the review answers are added. If it doesn't exist, it is added at the end of the note.
- **reviewQuestions**: a string that includes both the questions and how to lay out the answers in the daily note. There are several possible question types: `<int>`, `<number>`, `<string>`, `<mood>`. The first two are integer and any kind of number; the third is a string, and the last pops up a list of moods to select from.  You can indicate new lines with `\n` characters.
- **moods**: a comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.
