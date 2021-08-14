# 🕓 Event Helpers plugin
This plugin provides commands to help work with Calendars and Events:

- `/insert day's events as list`: insert list of this day's calendar events at cursor
- `/list day's events to log`: write list of this day's calendar events to console log
- `/insert matching events`: adds this day's calendar events matching certain patterns at cursor
- `/time blocks to calendar`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your current default calendar, as set by iCal.

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system).

Alternatively, in the `Templates/_configuration` note include the following settings you want in the note's first configuration block:

```javascript
...
  events: {
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    confirmEventCreation: false, // optional tag to indicate whether to ask user to confirm each event to be created
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    eventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "#meeting": "### *|TITLE|* (*|START|*)",
      "#webinar": "### *|TITLE|* (*|START|*)",
      "#holiday": "*|TITLE|*",
    },
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)


**Notes**:
- addEventID: whether to add an `[[event:ID]]` internal link when creating an event from a time block. This returns rather long strings (e.g. `[[event:287B39C1-4D0A-46DC-BD72-84D79167EFDF]]`) and so you might want to use a theme option to shorten them until needed.
- processedTagName: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event. This can be used with or without addEventID.
- confirmEventCreation: optional boolean tag to indicate whether to ask user to confirm each event to be created
- removeTimeBlocksWhenProcessed: in `time blocks...` whether to remove time block after making an event from it
- todaysEventsHeading: in `/insert today's events as list` the heading to put before the list of today's events. Optional.
- addMatchingEvents: for `/add matching events` is a set of pairs of strings. The first string is what is matched for in an event's title. If it does match the second string is used as the template for how to insert the event details at the cursor.  This uses the same `TITLE`, `START` and `END` template items below ...

### Using Event Lists from a Template
If you use Templates, this command can be called when a Template is inserted (including in the `/day start` command which applies your `Daily Note Template` file). To do this insert `{{events()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'template:"..."'` parameter to the `{{events()}}` template command that sets how to present the list, and a separate template for items with no start/end times (`'allday_template:"..."`).

If you want you can disable the adding of the heading by applying the `includeHeadings`-flag and set it to `false`.

For example:

```javascript
  {{events({template:"### START-END: TITLE",allday_template:"### TITLE"})}}
```

The `*|TITLE|*`, `*|START|*` and `*|END|*` can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly for each event found. (Note the difference between the } and ) bracket types, and use of double quotes around the template string. I didn't design all of this!)

You can also place  `{{listMatchingEvents()}}` in Templates in a similar way, and similar customisation is possible. However, it is defined in a different way, using the matches and template strings defined in the `_configuration` file's `addMatchingEvents` array, as shown above.
