# 🕓 Event Helpers plugin
This plugin provides commands to help work with Calendars and Events:

- `/insert today's events as list`: insert list of today's calendar events at cursor
- `/list today's events to log`: write list of today's calendar events to console log
- `/insert matching events`: adds today's calendar events matching certain patterns at cursor
- `/time blocks to calendar`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your current default calendar, as set by iCal.

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note include the following settings you want in the note's first configuration block:

```javascript
...
  events: {
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    todaysEventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "#meeting": "### TITLE (START)",
      "#webinar": "### TITLE (START)",
      "#holiday": "TITLE",
    },
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)


**Notes**:
- addEventID: whether to add an `[[event:ID]]` internal link when creating an event from a time block. This returns rather long strings (e.g. `[[event:287B39C1-4D0A-46DC-BD72-84D79167EFDF]]`) and so you might want to use a theme option to shorten them until needed.
- processedTag: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event. This can be used with or without addEventID.
- removeTimeBlocksWhenProcessed: in `time blocks...` whether to remove time block after making an event from it
- todaysEventsHeading: in `/insert today's events as list` the heading to put before the list of today's events. Optional.
- addMatchingEvents: for `/add matching events` is a set of pairs of strings. The first string is what is matched for in an event's title. If it does match the second string is used as the template for how to insert the event details at the cursor.  This uses the same `TITLE`, `START` and `END` template items below ...

### Using Event Lists from a Template
If you use Templates, this command can be called when a Template is inserted (including in the `/day start` command which applies your `Daily Note Template` file). To do this insert `{{listTodaysEvents()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'template:"..."'` parameter to the `{{listTodaysEvents()}}` template command that sets how to present the list. For example:

```
  {{listTodaysEvents({template:"- TITLE (START-END)"})}}
```

The TITLE, START and END can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly for each event found. (Note the difference between the } and ) bracket types, and use of double quotes around the template string. I didn't design all of this!)

You can also place  `{{listMatchingEvents()}}` in Templates in a similar way. However, it has a different sort of customisation. This simply has a prefix string defined in the _configuration file above, _for each different string to match_.

## History
### v0.2.5 1.8.2021
- adds ability to customise the addMatchingEvents lines with template strings, not just prepended string
- fixed issue with running list today's events, due to change in configuration mechanism

### v0.2.4 30.07.2021 @dwertheimer
- (bump) Minor tweak to use template replacement from helperFunctions.js

### v0.2.3, 28.7.2021
- adds ability to pass a parameter to the `{{listTodaysEvents()}}` template command to customise how to present the list of today's events. See 'Using Event Lists from a Template' in the README.

### v0.2.2, 13.7.2021
- add: ability to add `[[event:ID]]` link when creating an event from a time block
- fix: time block parse error (tip off by @nikolaus)

### v0.2.1, 13.7.2021
- refactor to allow to be called from Daily Note Template as either:
  -  `{{listTodaysEvents()}}` or
  -  `{{listMatchingEvents()}}`

### v0.2.0, 12.7.2021
- add: `/add matching events`: adds matching events to today's note
- add: `/insert today's events as list`: insert list of Today's calendar events at cursor

See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.EventHelpers), and how to configure.

### v0.1.1, 2.7.2021
- first release, with `/timeblock` command, and configuration system
