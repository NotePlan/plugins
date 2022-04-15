# DateAutomations
DateAutomations includes a number of commands for inserting date/time values into your NotePlan notes

## Commands

### /dp - Date Picker - Choose format/date from Command Bar
Choose from a variety of date/time formats from a menu. This also shows you in parentheses the dateStyle and timeStyle to yield this result (which you could enter into your Template plugin date defaults)

### /ldn - Link Daily Note
Create a link to the daily Calendar Note and insert it at the cursor

### /now - Insert date and time at cursor
e.g. `6/19/2021 06:55:22` (date/time should be your local time -- see note below)

### /now - ISO-8601 standard -- Insert ISO-8601 date+time at cursor
e.g. `2021-08-06 17:20:11`

### /date - Insert Date at cursor
e.g. `6/19/2021` (date/time should be your local time -- see note below)

### /time - Insert time at cursor
e.g. `06:55:22` (time should be your local time -- see note below)

### /iso - Insert ISO date/time at cursor
e.g. `6/19/2021T18:55:46.101Z` (date/time is in GMT)

### /formatted - Insert custom formatted (format) date/time
e.g. `2021-08-14 10:30:00 am` (using default format from `_configuration` file)

## Notes Regarding Date/Time Formats
- By default, the format of dates and times is "en-US" format.
- By default, the `/formatted` command uses `%Y-%m-%d %I:%M:%S %P` (see `Templates` use below)

*Note: You can create your own formats by installing the `Templates` plugin and following the directions to create your own `_configuration` note, which can include a `date` property (inside the code fences)*

If you install this plugin and run `/dp` command, you will get some ideas for dateStyle and timeStyle settings

## References
The following are some useful references which provide more information about formatting date/time values

[Formatting Dates Using strftime](https://www.strfti.me/) for more information about formatting `formatted` date/time value

[Date Time Formats](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) for more choices/details
