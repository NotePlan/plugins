# 🕓 Event Helpers plugin
This plugin provides commands to help work with Calendars and Events:

- `/insert day's events as list`: insert a list of this day's calendar events into the current note
- `/insert matching events`: insert a  list of this day's calendar events that match certain patterns into the current note
- `/time blocks to calendar`: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to full Calendar events, in your current default calendar, as set by iCal. (If the end time is not given, then the 'defaultEventDuration' setting is used to give it an end time.)
- `/process date offsets`: finds date offset patterns and turns them into due dates, based on date at start of section. (See [Date Offsets](#date-offsets) below for full details.)

The first four of these have a number of [options described below](#configuration).
See [Theme customisation](#theme-customisation) below for more on how to customise display of time blocks and events.

## Sort Order
When using `/insert day's events as list` or `/insert matching events` it defaults orders the list by increasing start time of the events. If you wish to have them ordered first by calendar name then by start time, choose the 'calendar' option for the 'Sort order' setting described below, rather than the 'time' default. _(This was a new default from v0.13.0.)_

## Date Offsets
This is best understood with a quick example:

| For example ...                                                                                                                                                                        | ... becomes                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \#\#\# Christmas Cards 2021-12-25<br />\* Write cards {-20d}<br />\* Post overseas cards {-15d}<br />\* Post cards to this country {-10d}<br />\* Store spare cards for next year {+3d} | \#\#\# Christmas Cards 2021-12-25<br />\* Write cards >2021-12-05<br />\* Post overseas cards >2021-12-10<br />* Post cards to this country >2021-12-15<br />\* Store spare cards for next year >2021-12-28 |
| \* Bob's birthday on 2021-09-14<br />&nbsp;&nbsp;\* Find present {-6d}<br />&nbsp;&nbsp;\* Wrap & post present {-3d} <br />&nbsp;&nbsp;\* Call Bob {0d}                                 | \* Bob's birthday on 2021-09-14<br />&nbsp;&nbsp;\* Find present >2021-09-08<br />&nbsp;&nbsp;\* Wrap & post present >2021-09-11<br />&nbsp;&nbsp;\* Call Bob >2021-09-14                                   |

You can use this within a line to have both a **deadline** and a calculated **start date**:

| For example ...                                                      | ... becomes                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| * Post cards deadline 2021-12-18 {-10d} | * Post cards deadline 2021-12-18 >2021-12-08 |

The `/process date offsets` command looks for a valid date pattern in the previous heading, previous main task if it has sub-tasks, or in the line itself. If it does, then it changes any **date offset patterns** (such as `{-10d}`, `{+2w}`, `{-3m}`) into **scheduled dates** (e.g. `>2021-02-27`). This allows for users to define **formats** and when applied to a note, set the due date at the start, and the other dates to be calculated for you.

In more detail:

- Valid **date offsets** are specified as `[+/-][0-9][bdwmqy]`. This allows for `b`usiness days,  `d`ays, `w`eeks, `m`onths, `q`uarters or `y`ears. (Business days skip weekends. If the existing date happens to be on a weekend, it's treated as being the next working day. Public holidays aren't accounted for.)  There's also the special case `{0d}` meaning on the day itself.
- The base date is by default of the form `YYYY-MM-DD`, not preceded by characters `0-9(<`, all of which could confuse.

## Configuration
Most of these commands require configuration. In NotePlan v3.4 and above, please click the gear button on the 'Event Helpers' line in the Plugin Preferences panel.

Here are details on the various settings:

- **Events heading**: in `/insert today's events as list` command (or `events()` template call), the heading to put before the list of the day's events. Optional.
- **Matching Events heading**: in `/insert matching events` command (or `listMatchingEvents()` template call), the heading to put before the list of matching events
- **Calendars to Scan**: optional ["array","of calendar","names"] to filter by when showing list of events. If empty or missing, no filtering will be done.
- **Events match list**: for `/add matching events` is an array of pairs of strings. The first string is what is matched for in an event's title. If it does match, the second string is used as the format for how to insert the event details at the cursor.  This uses the `*|TITLE|*`, `*|START|*` (time), `*|END|*` (time), `*|NOTES|*`, `*|ATTENDEES|*`, `*|EVENTLINK|*` and `*|URL|*` format items below ...  NB: At this point the 'location' field is unfortunately _not_ available through the API.
For example:
  ```jsonc
  {
    "#meeting" : "### *|TITLE|* (*|START|*)\nWith *|ATTENDEES|*\n*|NOTES|*\n*|EVENTLINK|*",
    "holiday" : "*|TITLE|*\nHoliday:: *|NOTES|*"
  }
  ```
- **Calendar name mappings**: optional - add mappings for your calendar names to appear in the output - e.g. from "Thomas" to "Me" with "Thomas;Me".
- **Name of Calendar to write to**: the name of the calendar for `/time blocks to calendar` to write events to. Must be a writable calendar. If empty, then the default system calendar will be used. (Note: you have to specifically set a default calendar in the settings of the macOS Calendar app or in iOS Settings app > Calendar > Default Calendar.)
- **Default event duration**: Event duration (in minutes) to use when making an event from a time block, if an end time is not given.
- **Confirm Event Creation?**: optional boolean tag to indicate whether to ask user to confirm each event to be created
- **Remove time blocks when processed?**: in `time blocks...` whether to remove time block after making an event from it
- **Add event ID?**: whether to add an `⏰event:ID` string when creating an event from a time block. This returns rather long strings (e.g. `⏰event:287B39C1-4D0A-46DC-BD72-84D79167EFDF`) and so you might want to use a theme option to shorten them until needed (details [below](#theme-customisation)).
- **Processed tag name**: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event. This can be used with or without addEventID.
- **Locale**: optional Locale to use for times in events. If not given, will default to what the OS reports, or failing that, 'en-US'.
- **Time options**: Optional Time format settings. Default is `{\n\t\"hour\": \"2-digit\", \n\t\"minute\": \"2-digit\", \n\t\"hour12\": false\n}`.

## Using Event Lists from a Template
If you use Templating, this command can be called when a Template is inserted (including in the `/dayStart` command which applies your `Daily Note Template`). To do this insert `<%- events() %>` wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time.  To **customise the list display**, you can add a `'format:"..."'` parameter to the `<%- events() %>` command that sets how to present the list, and a separate parameter for items with no start/end times (`'allday_format:"..."`).

**Formats**: The `*|CAL|*`, `*|TITLE|*`, `*|START|*`, `*|END|*`, `*|NOTES|*`, `*|URL|*` and `*|EVENTLINK|*` can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly with the fields from each matching event found. (Note the difference between the } and ) bracket types, and use of double quotes around the parameter's setting. I didn't design this syntax ...)   
Most of these are self-explanatory for events in most types of calendars. However,  `*|EVENTLINK|*` is specific to NotePlan: it will make a nicely-formatted link to the actual calendar event, and clicking on it will show a pop with all the event's details.

If you want to disable the adding of the heading, add the following parameter `includeHeadings:false` (no double quotes around `false` as its being treated as JSON).

For example:

```jsonc
<%- events( {format:"### *|CAL|*: *|TITLE|* (*|START|*-*|END|*)\n*|EVENTLINK|*\n*|NOTES|*", allday_format:"### *|TITLE|*", includeHeadings:false} ) %>
```

If you wish to see multiple day's output, not just the day for the active calendar note, add the `daysToCover` paramter. For example: include `daysToCover: 3` to the parameter string to see events for the selected day, plus the following 2. (Note: if you use this, then H3 date headings will be inserted between dates for clarity, even if the `includingHeadings` parameter is false.)

You can also place  `<%- listMatchingEvents() %>` in Templates in a similar way, and similar customisations are possible. However, as each match can have a different format of output, the matches and format strings are entered in a JSON-formatted array, which is specified in the Plugin's settings.

NB: the `Sort order` setting above also controls how the output of this list is sorted.

## Theme Customisation
NotePlan allows extensive [customisation of fonts and colours through its Themes](https://help.noteplan.co/article/44-customize-themes). It also supports doing more advanced highlighting using regex. To add **colour highlighting for time blocks**, add the following to your favourite theme's .json file:
```jsonc
"timeblocks": {
  "regex": "(?:^\\s*(?:\\*(?!\\s+\\[[\\-\\>]\\])\\s+|\\-(?!\\h+\\[[\\-\\>]\\]\\s+)|[\\d+]\\.|\\#{1,5}\\s+))(?:\\[\\s\\]\\s+)?.*?\\s(((at|from)\\s+([0-2]?\\d|noon|midnight)(:[0-5]\\d)?(\\s?(AM|am|PM|pm)?)(\\s*(\\-|\\–|\\~|\\〜|to)\\s*([0-2]?\\d)(:[0-5]\\d)?(\\s*(AM|am|PM|pm)?))?|([0-2]?\\d|noon|midnight)(:[0-5]\\d)\\s*(AM|am|PM|pm)?(\\s*(\\-|\\–|\\~|\\〜|to)\\s*([0-2]?\\d|noon|midnight)(:[0-5]\\d)?(\\s*(AM|am|PM|pm)?)?)?))(?=\\s|$)",
  "matchPosition": 1,
  "color": "#CC4999"
}
```

If you're adding event IDs through the `/time blocks to calendar` command, then you might want to **hide the long `event:ID` string until you move the cursor to the ⏰ marker**. To do this add the following:
```jsonc
"eventID": {
  "regex": "(event:[A-F0-9-]{36})",
  "matchPosition": 1,
  "color": "#444444",
  "isHiddenWithoutCursor": true,
  "isRevealOnCursorRange": true
 }
```

## Changes
Please see the [CHANGELOG](CHANGELOG.md).
