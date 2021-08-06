# Templates

## About Templates
The Templates plugin allows you to create templates for note formats you use frequently (like a meeting note or a daily note). The base capability is essentially a copy/paste of a template file into a new note. So if you just want to have a basic form to fill in when you need it, you can run:
- `/nn` command to create a new note from a template of your choice/making
- `/it` pastes the template to the note you are already in (inserts the template text at the bottom)

Templates gets more interesting when you include tags in your template which get filled in when the template is **first loaded** (keep this in mind...the template tags don't update after the first load).

Any {{tag}} that is unknown by the system will be a prompt for user input

## Template:
![Template](https://user-images.githubusercontent.com/3582514/120062159-8dc0c880-c015-11eb-842e-80473dc663f0.png)
## Result:
![Result](https://user-images.githubusercontent.com/3582514/120062165-90bbb900-c015-11eb-8e5c-2912ff33dc87.png)

Some examples (more detail below):
- `{{meetingName}}` -- a tag unknown by the system, so the user will be prompted to enter a meeting name
- `{{date({locale: 'sv-SE', dateStyle: 'short'})}}` -- Date borrowing the Swedish "Locale" yields ISO-8601 date like `2021-06-21`
- `{{weather()}}` -- Pulls and insert the current weather into your note (requires configuration)
- `{{quote()}}` -- Pulls and insert a random quote into your note (requires configuration)
- `{{sweepTasks()}}` -- Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
- `{{events()}}` or `{{listTodaysEvents()}}` -- (requires configuration)
- `{{matchingEvents()}}` or `{{listMatchingEvents()}}` -- (requires configuration)

## Tag Details

### weather() - Insert the current weather into your note
The first time you run the command, it will insert various fields into your Templates/_configuration file, which you will need to fill in in order to get weather (because every user needs their own free API key for weather)

### quote() - Insert quote of the day

### sweepTasks() - Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
Does not require any configuration, but if you choose to, you can pass parameters to the function. For example:
`{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:true})}}`  // Sweep open tasks from the previous 7 days, but include the headings or indents that the task was under in the original note

### events() & listMatchingEvents() -- Using Event Lists from a Template
If you use Templates, this command can be called when a Template is inserted (including in the `/day start` command which applies your `Daily Note Template` file). To do this insert `{{events()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'template:"..."'` parameter to the `{{events()}}` template command that sets how to present the list, and a separate template for items with no start/end times (`'allday_template:"..."`). For example:

```javascript
  {{events({template:"### *|START|*-*|END|*: *|TITLE|*",allday_template:"### *|TITLE|*"})}}
```
Now uses date/time mentions which follow your chosen locale settings -- which can now be set specifically in _configuration in the `events` section:
   locale: "en-US",
    timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false }

The `*|TITLE|*`, `*|START|*` and `*|END|*` can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly for each event found. (Note the difference between the } and ) bracket types, and use of double quotes around the template string. I didn't design all of this!)

You can also place  `{{matchingEvents()}}` or `{{listMatchingEvents()}}` in Templates in a similar way, and similar customisation is possible. However, it is defined in a different way, using the matches and template strings defined in the \_configuration file's `addMatchingEvents` array, as shown above.
