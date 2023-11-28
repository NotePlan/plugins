# 🕓 Event Helpers plugin
This plugin provides commands to help you do useful things with Events and Calendars that can't (yet) be done by NotePlan itself:

- **insert day's events as list**: insert a list of this day's calendar events into the current note
- **insert matching events**: insert a  list of this day's calendar events that match certain patterns into the current note
- **time blocks to calendar**: takes [NotePlan-defined time blocks](https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking) and converts to them to full Calendar events in your current default calendar, as set by iCal. (See also [Display of Time Blocks](#display-of-time-blocks) below.)
- **process date offsets**: finds date offset patterns and turns them into due dates, based on date at start of section. (See [Date Offsets](#process-date-offsets) below for full details.)
- **shift dates**: takes dates _in the selected lines_ and shifts them forwards or backwards by a given date interval. It works on both `>YYYY-MM-DD` and `>YYYY-Wnn` style dates.  (User George Crump (@george65) has created a [video showing how this command works](https://storone.zoom.us/rec/play/tzI6AreYeKvoyHRw11HX93IGVf2OI-U7WgKXYn2rmGJvbFHXZp8PSr6ajmOrtWymOU5jFIItScSJnL9U.tboBQEXjdw1uRTqu).)

Most of these commands require configuration, described in the sections below. On macOS, click the gear button on the 'Event Helpers' line in the Plugin Preferences panel to access the settings. Or on on iOS/iPadOS devices, use the **Events: update plugin settings** command instead.

## "insert day's events as list"  and "insert matching events" commands
Settings:
- **Events heading**: in `/insert today's events as list` command (or `events()` template call), the heading to put before the list of the day's events. Optional.
- **Events List display format**: the format string to use to customise how events are displayed (when run as a /command, not through a Template). The available placeholders are 'CAL', 'TITLE', 'LOCATION', 'EVENTLINK', 'DATE', 'START', 'END', 'NOTES', 'ATTENDEES', 'NOTES', 'URL', 'MEETINGNOTE'.  (Default is `- (*|CAL, |**|START|*) *|TITLE|**|\nEVENTLINK|**|\nwith ATTENDEES|**|\nNOTES|*`.)
- **Events List display format for all-day events**: the format string to use to customise how all-day events are displayed (when run as a /command, not through a Template). The available placeholders are 'CAL', 'TITLE', 'LOCATION', 'EVENTLINK', 'DATE', 'NOTES', 'ATTENDEES', 'NOTES', 'URL', 'MEETINGNOTE'. (Default is `- (*|CAL, |**|START|*) *|TITLE|**|\nEVENTLINK|**|\nwith ATTENDEES|**|\nNOTES|*`.)
- **Sort order of events list**: by 'time' (= increasing start time of events) or by 'calendar' first, which then secondarily sorts by start time.
- **Calendars to include**: optional ["array","of calendar","names"] to filter by when showing list of events. If empty or missing, no filtering will be done.
- **Calendar name mappings**: optional - add mappings for your calendar names to appear as in the output - e.g. from "Jonathan (iCloud)" to "Me" (and from "Us (iCloud)" to "Us") with `Jonathan (iCloud);Me, Us (iCloud);Us`. Note: separate mapping from main name by `;` a character, and separate mapping pairs with the `,` character.
- **Meeting Note Template title**: use to set which template to pick if you have several; if it isn't set then a list of meeting note templates will be offered.
- **Matching Events heading**: in `/insert matching events` command (or `listMatchingEvents()` template call), the heading to put before the list of matching events
- **Events match list**: for `/add matching events` is an array of pairs of strings. The first string is what is matched for in an event's title. If it does match, the second string is used as the format for how to insert the event details at the cursor.  This uses the `*|TITLE|*`, `*|START|*` (time), `*|END|*` (time), `*|NOTES|*`, `*|ATTENDEES|*`, `*|EVENTLINK|*`, `*|LOCATION|*`, `*|MEETINGNOTE|*` and `*|URL|*` format items below ...
For example:
  ```jsonc
  {
    "#meeting" : "### *|TITLE|* (*|START|*)\nWith *|ATTENDEES|**|\n NOTES|**|\nEVENTLINK|*",
    "holiday" : "*|TITLE|*\nHoliday:: *|NOTES|*"
  }
  ```
  You can also add `*|STOPMATCHING|*` placeholder which will mean only the first match in this list is applied for a given event.
- **Stop after first match in the list above?**: If true, only the first match in the list above is used for a given event. (Note: this doesn't stop matching the rest of the events in the Calendars.) This is the equivalent of setting 'STOPMATCHING' on every item in the above list. _Unfortunately, the NP plugin settings can change the order of the items in this list without warning. So to use this succesfully, you may need to manually edit the settings file, which is found at_ `<NotePlan root>/Plugins/jgclark.EventHelpers/settings.json`. The default is false.
- **Include time blocks from completed tasks?**: whether to include time blocks from lines with completed tasks.
- **Name of Calendar to write to**: the name of the calendar for `/time blocks to calendar` to write events to. Must be a writable calendar. If empty, then the default system calendar will be used. (Note: you have to specifically set a default calendar in the settings of the macOS Calendar app or in iOS Settings app > Calendar > Default Calendar.)
- **Default event duration**: Event duration (in minutes) to use when making an event from a time block, if no end time is given.
- **Confirm Event Creation?**: optional boolean tag to indicate whether to ask user to confirm each event to be created
- **Remove time blocks when processed?**: in `time blocks...` whether to remove time block after making an event from it
- **Add event link?**: whether to add a nicely-formatted event link when creating an event from a time block. (This can return rather long strings (e.g. `⏰event:287B39C1-4D0A-46DC-BD72-84D79167EFDF`) and so you might want to use a theme option to shorten them until needed (details [below](#theme-customisation)).)
- **Processed tag name**: if this is set, then this tag will get added on the end of the line with the time block, to show that it has been processed. Otherwise, next time this command is run, it will create another event. This can be used with or without addEventID.
- **Locale**: optional Locale to use for times in events. If not given, will default to what the OS reports, or failing that, 'en-US'.
- **Time options**: Optional Time format settings. Default is `{\n\t\"hour\": \"2-digit\", \n\t\"minute\": \"2-digit\", \n\t\"hour12\": false\n}`.

### Using Event Lists from a Template
You can use these commands from Templates, when they are applied to a note, or are used to create one:
- **`<%- events(...) %>`** produces a list of all events for the period wherever you wish it to appear in the Template.  By default it gives a simple markdown list of event title and start time for today.
- **`<%- matchingEvents(...) %>`** produces a list of all matching events. This is more powerful, with each configured match able to have a different format of output. The matches and format strings are entered in a JSON-formatted array, which is specified in the Plugin's settings.

These work particularly well in **Daily Note templates**.

To **customise the list display**, you can add a `'format:"..."'` parameter to the `<%- events() %>` command that sets how to present the list, and a separate parameter for items with no start/end times (`'allday_format:"..."`).

**Formats**: The `*|CAL|*`, `*|TITLE|*`, `*|LOCATION|*`, `*|START|*`, `*|END|*`,  `*|DATE|*`,  `*|NOTES|*`, `*|URL|*`,  `*|ATTENDEES|*`, `*|ATTENDEENAMES|*`, `*|LOCATION|*`, `*|MEETINGNOTE|*`,  and `*|EVENTLINK|*` can be mixed with whatever markdown characters or other text you like, and they will get replaced accordingly with the fields from each matching event found. (Note the difference between the } and ) bracket types, and use of double quotes around the parameter's setting. I didn't design this syntax ...)

Most of these are self-explanatory for events in most types of calendars, other than:
- `*|ATTENDEES|*` gives the full details of event attendees provided by the operating system, and can be a mix of names, email addresses, and other details;
- `*|ATTENDEENAMES|*` just gives the name of event attendees, or if that's missing, just the email address;
- `*|DATE|*` is formatted using the locale settings from your operating system, unless you override that with the 'Shared Settings > Locale' setting;
- `*|EVENTLINK|*` is specific to NotePlan: it will make a nicely-formatted link to the actual calendar event, and clicking on it will show a pop with all the event's details.
- `*|MEETINGNOTE|*` will insert a link that when clicked, will help you create a meeting note for this particular event. For this there's a setting 'Meeting Note Template title' which you can use to set which template to pick if you have several; if it isn't set then a list will be presented. **Note:** MEETINGNOTE links requires at least v1.1.2 of the separate "Meeting Notes" plugin.

v0.15.0 added more flexibility in the formatting of event lists. So now instead of including (for example) `*|ATTENDEENAMES|*` you can now include other text (including line breaks indicated by `\n`) within the placeholder. For example in `*|\nwith ATTENDEENAMES|*` if the ATTENDEENAMES is not empty, then it will output the list after a newline and the text 'with '.

Other options:
- If you want to disable the adding of the heading, add the following parameter `includeHeadings:false` (no double quotes around `false` as its being treated as JSON)
- If you want to exclude all-day events, add the following parameter `includeAllDayEvents:false`
- If you want to include only certain calendars, then add the following parameter `calendarSet:"list,of,calendar,names"`
- If you want to include calendar name mapping (see disusssion above), then add something like the following parameter `calendarNameMappings:"Jonathan (iCloud);Me, Us (iCloud);Us"`

For example:

```js
<%- events( {format:"### *|CAL|*: *|TITLE|* (*|START|*-*|END|*)*|\nEVENTLINK|**|with ATTENDEES|**|\nLOCATION|**|\nNOTES|*", allday_format:"### *|TITLE|**|\nEVENTLINK|**|\nNOTES|*", includeHeadings:false, calendars:"home,children"} ) %>
```

If you wish to see multiple day's output, not just the day for the active calendar note, add the `daysToCover` paramter. For example: include `daysToCover: 3` to the parameter string to see events for the selected day, plus the following 2. (Note: if you use this, then H3 date headings will be inserted between dates for clarity, even if the `includingHeadings` parameter is false.)

NB: the `Sort order` setting above also controls how the output of this list is sorted.

## /shift dates
This command takes plain or scheduled day or week dates (i.e. `YYYY-MM-DD`, `>YYYY-MM-DD`, `YYYY-Wnn` or ``>YYYY-Wnn`) in the selected lines and shifts them forwards or backwards by a given date interval. This allows you to copy a set of tasks to use again, and have the dates moved forward by a month or year etc. It doesn't change dates in `@done(...) mentions, or that are in brackets.

Its settings are:
- Remove @done dates? Whether to remove `@done(...)` dates; by default it will. It doesn't remove any dates that are just in `(...)` brackets though. Default: true.
- Set any finished (i.e. completed or cancelled) tasks to open? Default: true.
- Remove any 'processed tag name' on tasks or checklists? Whether to remove any 'processed tag name' (from the settings for "/time blocks to calendar" command above) from tasks or checklists. Default: true.

## /process date offsets
User George Crump (@george65) has created a [video showing how this command works](https://drive.google.com/file/d/10suCe0x8QPbHw_7h4Ao4zwWf_kApEOKH/view).

The command is best understood with some examples. Here's some Christmas planning:

| This ...                                                                                                                                                                        | ... becomes this                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \#\#\# Christmas Cards 2021-12-25<br />\* Write cards {-20d}<br />\* Post overseas cards {-15d}<br />\* Post cards to this country {-10d}<br />\* Store spare cards for next year {+3d} | \#\#\# Christmas Cards 2021-12-25<br />\* Write cards >2021-12-05<br />\* Post overseas cards >2021-12-10<br />* Post cards to this country >2021-12-15<br />\* Store spare cards for next year >2021-12-28 |
| \* Bob's birthday on 2021-09-14<br />&nbsp;&nbsp;\* Find present {-6d}<br />&nbsp;&nbsp;\* Wrap & post present {-3d} <br />&nbsp;&nbsp;\* Call Bob {0d}                                 | \* Bob's birthday on 2021-09-14<br />&nbsp;&nbsp;\* Find present >2021-09-08<br />&nbsp;&nbsp;\* Wrap & post present >2021-09-11<br />&nbsp;&nbsp;\* Call Bob >2021-09-14                                   |

You can use this within a line to have both a **deadline** and a calculated **start date**:

| This ...                                                      | ... becomes this                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| * Post cards deadline 2021-12-18 {-10d} | * Post cards deadline 2021-12-18 >2021-12-08 |

The `/process date offsets` command looks for a valid **base date** in the previous heading, previous main task if it has sub-tasks, or in the line itself. If it does, then it changes any **date offset patterns** (such as `{-10d}`, `{+2w}`, `{-3m}`) into **dates** (e.g. `2022-05-02`). This is particularly useful when set up in **templates**, that when applied to a note, sets the due date at the start, and calculates the other dates for you.

In more detail:
- The **base date** is by default of the form `YYYY-MM-DD`, not preceded by characters `0-9(<`, all of which could confuse.
- Valid **date offsets** are specified as `[^][+/-][0-9][bdwmqyBDWMQY]`. This allows for `b`usiness days,  `d`ays, `w`eeks, `m`onths, `q`uarters or `y`ears. (Business days skip weekends. If the existing date happens to be on a weekend, it's treated as being the next working day. Public holidays aren't accounted for.)  You can use upper- or lower-case letters.- `{+3d}` means three days _after_ the 'base' date
- `{-3d}` means three days _before_ the 'base' date
- You can use `{0d}` to mean no offset -- i.e. on the day itself.
- An offset that starts with `{^...}` calculates before or after the _last calculated date_ (not the base date).  An example of this is:

| For example ...                                                                                                                                                                        | ... becomes                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \* Bob's birthday on 2021-09-05<br />&nbsp;&nbsp;\* Find present {^+6d}<br />&nbsp;&nbsp;\* Wrap & post present {^+3d} <br />&nbsp;&nbsp;\* Call Bob {0d}   | \* Bob's birthday on 2021-09-05 to 2021-09-14<br />&nbsp;&nbsp;\* Find present >2021-09-08<br />&nbsp;&nbsp;\* Wrap & post present >2021-09-11<br />&nbsp;&nbsp;\* Call Bob >2021-09-14 |
| \#\#\# Easter Preparations >2022-03-01<br />\* Use up sweet treats (Shrove Tuesday) {0d}<br />\* Start Lent (Ash Wednesday) {^+1d}<br />\* End of Lent {^+-6w}<br />\* Remember Last Supper {^+1d} <br />\* Good Friday {^+1d} <br />\* Easter Sunday {^+2d} | \#\#\# Easter Preparations >2022-03-01 to >2022-04-17<br />\* Use up sweet treats (Shrove Tuesday) >2022-03-01<br />\* Start Lent (Ash Wednesday) >2022-03-02<br />\* End of Lent >2022-04-13<br />\* Remember Last Supper >2022-04-14<br />\* Good Friday >2022-04-15<br />\* Easter Sunday >2022-04-17 |

If a base date can't be found, the command will ask you to supply a date.

## Display of Time Blocks
If you're using the **time blocks to calendar** command with a format that includes the START and END times, then it's likely that the NotePlan will still see a time block for the text of the event, and so in the calendar area show the event _and_ a time block for it. To avoid this you can either
- put brackets around the START and END times
- or use set something in the 'text must contain' string in NotePlan's 'Todo' preferences pane.

NotePlan allows extensive [customisation of fonts and colours through its Themes](https://help.noteplan.co/article/44-customize-themes). It also supports doing more advanced highlighting using regex. To add **colour highlighting for time blocks**, add the following to your favourite theme's .json file:
```jsonc
"timeblocks": {
  "regex": "(?:^\\s*(?:\\*(?!\\s+\\[[\\-\\>]\\])\\s+|\\-(?!\\h+\\[[\\-\\>]\\]\\s+)|[\\d+]\\.|\\#{1,5}\\s+))(?:\\[\\s\\]\\s+)?.*?\\s(((at|from)\\s+([0-2]?\\d|noon|midnight)(:[0-5]\\d)?(\\s?(AM|am|PM|pm)?)(\\s*(\\-|\\–|\\~|\\〜|to)\\s*([0-2]?\\d)(:[0-5]\\d)?(\\s*(AM|am|PM|pm)?))?|([0-2]?\\d|noon|midnight)(:[0-5]\\d)\\s*(AM|am|PM|pm)?(\\s*(\\-|\\–|\\~|\\〜|to)\\s*([0-2]?\\d|noon|midnight)(:[0-5]\\d)?(\\s*(AM|am|PM|pm)?)?)?))(?=\\s|$)",
  "matchPosition": 1,
  "color": "#CC4999"
}
```

If you're adding event IDs through the `/time blocks to calendar` command, then you might want to hide the long `event:ID` string until you move the cursor to the ⏰ marker. To do this add the following:
```jsonc
"eventID": {
  "regex": "(event:[A-F0-9-]{36,37})",
  "matchPosition": 1,
  "color": "#444444",
  "isHiddenWithoutCursor": true,
  "isRevealOnCursorRange": true
 }
```

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!
## History
See [CHANGELOG](CHANGELOG.md) for the plugin's history.
