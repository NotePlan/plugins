# DailyJournal plugin
This plugin provides two commands for daily journalling, including start-of-day template, and end-of-day review questions:

- `/dayStart`: Start today's daily note with a template, including local weather lookup.
- `/dayReview`: Ask journal questions for an end-of-day review.

## Configuration
### /dayStart
`/dayStart` now uses the `Daily Note Template` note found in the `Templates` folder. If it's not been added, it should prompt you to create one.
If you want to include a short summary of the weather forecast, include a `{{weather()}}` tag at the appropriate place in that template. And then in the `Templates/_configuration` note, including the following in the note's first configuration block. For example:

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

### /dayReview
For now this needs manually configuring at the top of the plugin's `script.js` file.

```
// Items that should come from the Preference framework in time:
var pref_templateTitle = "Daily Note Template"
var pref_reviewSectionHeading = "Journal"
var pref_reviewQuestions = "@work(<int>)\n@fruitveg(<int>)\nMood:: <mood>\nGratitude:: <string>\nGod was:: <string>\nAlive:: <string>\nNot Great:: <string>\nWife:: <string>\nRemember:: <string>"
var pref_moods = "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
```

In more detail:
- **pref_templateTitle**: a string that is appended onto the end of today's daily note
- **pref_reviewQuestions**: a string that includes both the questions and how to lay out the answers in the daily note. There are several possible question types: `<int>`, `<string>`, `<mood>`. The first two are integer and general string, and the last pops up a list of moods to select from.  You can indicate new lines with `\n` characters.  I have a preference for using `::` to indicate attributes, but you can do whatever you prefer.
- **pref_moods**: a comma-separated list of possible moods to select from.  They don't have to have emoji, but I rather like them.
- **pref_reviewSectionHeading**: the name of a heading after which the review answers are added. If it doesn't exist, it is added first at the end of the note.


## History

### v0.6.0, 8.6.2021
- internal change: restructure code to use parts of the related 'Templates' plugin
- now `/dayStart` use the Templates plugin function to apply the `Daily Note Template` template. To include a weather forecast, now include the `{{weather()}}` tag in that template, and configure the OpenWeather calls as described in the `Templates/_configuration` file (described above).

### v0.5.0, 27.5.2021
- change: use Template system (from '**NoteHelpers**' plugin) to provide the `Daily Note Template`. This template title defaults to 'Daily Note Template', but can be configured in `pref_templateText ` (as above).
- update code to use newer NotePlan APIs

### v0.4.1, 16.5.2021
- add this README.md

### v0.4.0, 24.4.2021
- first main release
