# 🕓 Event Helpers plugin
This plugin provides a command to help work with Calendars and Events:

- `/timeblocks`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your default system calendar.

## Configuration
The `/timeblocks` command requires configuration; the first time it's run it should detect it doesn't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system). 

Alternatively, in the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```
...
  events: {
    processedTagName: "#event_created",
  },
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)

**Notes**:
- `processedTag`: 

## History
### v0.1.0, 1.7.2021
- first release, with `/timeblock` command, and configuration system
