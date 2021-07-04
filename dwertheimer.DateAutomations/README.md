# Date Functions

## /dp - Date Picker - Choose format/date from Command Bar
Choose from a variety of date/time formats from a menu. This also shows you in parentheses the dateStyle and timeStyle to yield this result (which you could enter into your Template plugin date defaults)
## /ldn - Link Daily Note
Create a link to the daily Calendar Note and insert it at the cursor
## /now - Insert date and time at cursor
e.g. `6/19/2021 06:55:22` (date/time should be your local time -- see note below)

## /date - Insert Date at cursor
e.g. `6/19/2021` (date/time should be your local time -- see note below)

## /time - Insert time at cursor
e.g. `06:55:22` (time should be your local time -- see note below)

## /iso - Insert ISO date/time at cursor
e.g. `6/19/2021T18:55:46.101Z` (date/time is in GMT)

## Note re: Date/Time Formats
By default, the format of dates and times is "en-US" format. However, you can create your own formats by installing the `Templates` plugin and following the directions to create your own `_configuration` note, which can include a `date` property (inside the code fences) like this:

If you install this plugin and run /dp, you will get some ideas for dateStyle and timeStyle settings

...or see [Date Time Formats](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) for more choices/details

## History

