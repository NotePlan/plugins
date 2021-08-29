# Templates plugin

## About Templates
The Templates plugin allows you to create Markdown templates for note formats you use frequently (like a meeting note or a daily note). The base capability is essentially a copy/paste of a template file into a new note. So if you just want to have a basic form to fill in when you need it, you can run:
- `/nn` command to create a new note from a template of your choice/making
- `/it` pastes the template to the note you are already in (inserts the template text at the bottom)

Templates gets more interesting when you include tags in your template which get filled in when the template is **inserted or applied** (keep this in mind ... the template tags don't update after this).

Any {{tag}} that is unknown by the system will pop up a dialog box asking for user input, which is then included in the output.

### For example
This template:
 ```json
 # Daily Note Template
---
{{quote()}}

{{events({template:"- *|TITLE|* (*|START|*)", allday_template:"- *|TITLE|*"})}}

### Tasks for {{me.firstName}} {{me.lastName}}

### Journal
{{weather({template:"Weather: |WEATHER_ICON| |DESCRIPTION| |FEELS_LIKE_LOW|/|FEELS_LIKE_HIGH||UNITS|"})}}
```

when activated in a note could become:
```markdown
> For where your treasure is, there your heart will be also. -- Jesus of Nazareth

### Events Today
- Bob's birthday
- Team #meeting (9:00)
- Lunch with Martha (12:30)
- Gym PT session (19:45)

### Tasks for Jonathan Clark

### Journal
Weather: 🌧️ Moderate rain 14/19°C
```

## Available Tags
Some examples (more detail below):
- `{{meetingName}}` -- a tag unknown by the system, so the user will be prompted to enter a meeting name
- `{{date({locale: 'sv-SE', dateStyle: 'short'})}}` -- Date borrowing the Swedish "Locale" yields ISO-8601 date like `2021-06-21`
- `{{weather()}}` -- Pulls and insert the current weather into your note (requires configuration)
- `{{quote()}}` -- Pulls and insert a random quote into your note (requires configuration)
- `{{sweepTasks()}}` -- Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
- `{{events()}}` or `{{listTodaysEvents()}}` -- insert list of this day's calendar events (requires configuration)
- `{{matchingEvents()}}` or `{{listMatchingEvents()}}` -- insert list of this day's calendar events matching user-defined hashtags (requires configuration)

Most naturally require some configuration before they're useful. These details live in the `_configuration` note in NotePlan's `📋 Templates` folder.

### weather() - Insert the day's weather forecast into your note
This uses OpenWeather service, which is free for simple lookups. 
The first time you run the command, it will insert various fields into your `Templates/_configuration` note:

```javascript
{
  ...
	weather: {
		openWeatherAPIKey: "<secret>", // you need to get your own API key from https://openweathermap.org/
  		latPosition: "51.3", // use your own latitude as a decimal
  		longPosition: "-1.0", // use your own longitude as a decimal
  		openWeatherUnits: "metric", // or "imperial"
	}
  ...
}
```
(This example is in JSON5 format: see the help text in `_configuration` note.)

NOTE: If you want to customize the weather output format in your daily note/template, you can pass a "template" with the format you want. Here's an example with every field:
`{{weather({template:"Weather: |WEATHER_ICON| |DESCRIPTION| |LOW_TEMP||UNITS|-|HIGH_TEMP||UNITS|; Feels like: |FEELS_LIKE_LOW||UNITS|-|FEELS_LIKE_HIGH||UNITS| in |TIMEZONE|")}}`

So if you were to insert that entire string in your Daily Note template, it would return something like:
`Weather: ☁️ Broken clouds 12°C-19°C; Feels like: 14°C-21°C in London/London`

### quote() - Insert quote of the day
Returns a random quote from Zenquotes.

### sweepTasks() - Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
Does not require any configuration, you can run the simple version (which will prompt you for various parameters):
`{{sweepTasks()}}`
but if you choose to, you can pass parameters to the function to have it run automatically. For example:
`{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:true, noteTypes: ['note','calendar'], ignoreFolders:['📋 Templates',"AnotherFolderNotToSweep"]})}}`
sweeps open tasks from the previous 7 days (Project notes & Calendar notes), and includes the headings or indents that the task was under in the original note, but omitting the '📋 Templates' and "AnotherFolderNotToSweep" directories

### events() & listMatchingEvents() -- Using Event Lists from a Template
See the [**Event Helpers** plugin's README](https://github.com/NotePlan/plugins/tree/main/jgclark.EventHelpers) for more details, including configuring this. But in summary:

Insert `{{events()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'template:"..."'` parameter to the `{{events()}}` command that sets how to present the list, and a separate template for items with no start/end times (`'allday_template:"..."`). For example:

  ```javascript
{{events({template:"### *|START|*-*|END|*: *|TITLE|*",allday_template:"### *|TITLE|*"})}}
  ```
It uses date/time mentions which follow your chosen locale settings -- which can now be set specifically in _configuration in the `events` section:
   locale: "en-US",
    timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false }

The `*|TITLE|*`, `*|START|*` and `*|END|*` can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly for each event found. (Note the difference between the } and ) bracket types, and use of double quotes around the template string. I didn't design all of this!)

You can also place  `{{matchingEvents()}}` or `{{listMatchingEvents()}}` in Templates in a similar way, and similar customisation is possible. However, it is defined in a different way, using the matches and template strings defined in the \_configuration file's `addMatchingEvents` array, as shown above.
