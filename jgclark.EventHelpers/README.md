# 🕓 Event Helpers plugin
This plugin provides a command to help work with Calendars and Events:

- `/timeblocks`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your current default calendar, as set by iCal.

## Configuration
The `/timeblocks` command requires configuration; the first time it's run it should detect it doesn't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```javascript
...
  events: {
    processedTagName: "#event_created",
  },
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)

**Notes**:
- `processedTag`: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event.

## To do
I would like to add a command that works the other way: taking events in the calendar that contains certain #tags, and adds items into the daily notes for that day. For example, adding a section to take notes on a "... #webinar" event.  However, this requires some new features in the NotePlan API first.

## History
### v0.1.1, 2.7.2021
- first release, with `/timeblock` command, and configuration system
