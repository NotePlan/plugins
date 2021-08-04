# Templates

## About Templates
The Templates plugin allows you to create templates for note formats you use frequently (like a meeting note or a daily note). The base capability is essentially a copy/paste of a template file into a new note

Templates gets more interesting when you include tags in your template which get filled in when the template is **first loaded** (keep this in mind...the template tags don't update after the first load).

Some examples (more detail below):
- {{weather()}} -- Pulls and insert the current weather into your note (requires configuration)
- {{quote()}} -- Pulls and insert a random quote into your note (requires configuration)
- {{sweepTasks()}} -- Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
- {{listTodaysEvents()}} -- (requires configuration)
- {{listMatchingTodaysEvents()}} -- (requires configuration)

## Tag Details

### weather() - Insert the current weather into your note
The first time you run the command, it will insert various fields into your Templates/_configuration file, which you will need to fill in in order to get weather (because every user needs their own free API key for weather)

### quote() - Insert quote of the day

### sweepTasks() - Pulls open tasks from previous Project Notes and calendar notes and inserts them in the place of the tag
Does not require any configuration, but if you choose to, you can pass parameters to the function. For example:
`{{sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:true})}}`  // Sweep open tasks from the previous 7 days, but include the headings or indents that the task was under in the original note

### listTodaysEvents() & listMatchingEvents() -- Using Event Lists from a Template
If you use Templates, this command can be called when a Template is inserted (including in the `/day start` command which applies your `Daily Note Template` file). To do this insert `{{listTodaysEvents()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'template:"..."'` parameter to the `{{listTodaysEvents()}}` template command that sets how to present the list, and a separate template for items with no start/end times (`'allday_template:"..."`). For example:

```javascript
  {{listTodaysEvents({template:"### *|START|*-*|END|*: *|TITLE|*",allday_template:"### *|TITLE|*"})}}
```

The *|TITLE|*, *|START|* and *|END|* can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly for each event found. (Note the difference between the } and ) bracket types, and use of double quotes around the template string. I didn't design all of this!)

You can also place  `{{listMatchingEvents()}}` in Templates in a similar way, and similar customisation is possible. However, it is defined in a different way, using the matches and template strings defined in the \_configuration file's `addMatchingEvents` array, as shown above.