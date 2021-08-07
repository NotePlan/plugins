# 🕓 Reminders Helpers plugin
This plugin provides commands to help work with Reminders:

- `/reminders reminders as list`: insert list of this day's calendar reminders at cursor

## Configuration
These commands require configuration; the first time they're run they should detect they don't have configuration, and offer to write some to the first configuration block of the `Templates/_configuration` note (as used by the Templates system).

Alternatively, in the `Templates/_configuration` note include the following settings you want in the note's first configuration block:

```javascript
...
  reminders: {
  }
...
```
(This uses JSON5 format: ensure there are commas at the end of all that lines that need them.)


### Using Reminder Lists from a Template
If you use Templates, this command can be called when a Template is inserted (including in the `/day start` command which applies your `Daily Note Template` file). To do this insert `{{reminders()}}` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of reminder.

For example:

```javascript
  {{reminders()}}
```
