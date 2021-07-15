# 🕓 Event Helpers plugin
This plugin provides commands to help work with Calendars and Events:

- `/insert matching events`: adds matching events to today's note
- `/insert today's events as list`: insert list of Today's calendar events at cursor
- `/time blocks to calendar`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your current default calendar, as set by iCal.

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```javascript
...
  events: {
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    todaysEventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and add this into daily note prepending by string on the right (which can be empty). Can be empty.
      "#meeting": "### ",
      "#webinar": "### ",
      "#holiday": "",
    },
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)

**Notes**:
- addEventID: false,  whether to add an `[[event:ID]]` internal link when creating an event from a time block. This returns rather long strings (e.g. `[[event:287B39C1-4D0A-46DC-BD72-84D79167EFDF]]`) and so you might want to use a theme option to shorten them until needed.
- processedTag: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event. This can be used with or without addEventID.
- removeTimeBlocksWhenProcessed: in `time blocks...` whether to remove time block after making an event from it
- todaysEventsHeading: in `/insert today's events as list` the heading to put before the list of today's events. Optional.
- addMatchingEvents: for `/add matching events` is a set of pairs of strings. The first string is what is matched for in an event's title. If it does match the second string is prepended to it, and added at the cursor.  Can be empty: `{  }`.

## History

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
