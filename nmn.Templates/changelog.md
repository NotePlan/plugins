See Template Plugin [README](https://github.com/NotePlan/plugins/blob/main/nmn.Templates/README.md) for details

# What's Changed in this Plugin?

### 0.10.2 Fixed "/" bug (again) in /qtn (thanks @jgclark!)

### 0.10.1 Fixed "/" bug in /qtn (thanks @jgclark!)

### 0.10.0 Added {{date8601()}}, {{formattedDateTime('%Y-%m-%d %I:%M:%S %P')}}, {{weekDates()}} and /qtn command

### 0.8.2 Now checks for valid-looking API key before making openweathermap.org request

### 0.8.1 Now compiled for macOS versions back to 10.13.0

### 0.8.0 Change to allow for limiting task sweeping to notes or calendars

### 0.7.1 Change name from nmn.templates to nmn.Templates (@dwertheimer)

### 0.6.1 Fix script crasher (@dwertheimer)

### 0.6.0 Lots of tweaks to make inserting templates more obvious (@dwertheimer)

### 0.5.0 Readme/Changelog addition

### 0.4.0 Added sweepTasks() functionality (@dwertheimer)

### Previous versions: @jgclark & @nmn
**v0.3.2**
- under-the-hood improvements to _configuration mechanism and handling error conditions
- under-the-hood updates to match changes to DailyJournal and Event Helpers plugins

**v0.3.0**
- added `{{listTodaysEvents()}}` which inserts list of all today's events [See EventsHelper plugin for details]
- added `{{listMatchingEvents()}}` which inserts list of all today's events matching a configured list [See EventsHelper plugin for details]

**v0.2.0**
- added `{{quote()}}` which inserts a quote from zenquotes.io. See default _configuration file for more configuration options

**v0.1.0**
- added `{{weather()}}` which inserts weather summary for today. See default _configuration file for configuration options