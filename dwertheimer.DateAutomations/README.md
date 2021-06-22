# Date Functions

## /now - Insert date and time at cursor
e.g. `2021-06-19 06:55:22` (date/time should be your local time -- see note below)

## /date - Insert Date at cursor
e.g. `2021-06-19` (date/time should be your local time -- see note below)

## /time - Insert time at cursor
e.g. `06:55:22` (time should be your local time -- see note below)

## /iso - Insert ISO date/time at cursor
e.g. `2021-06-19T18:55:46.101Z` (date/time is in GMT)

## Note re: Date/Time Formats
By default, the format of dates and times is "en-US" format. However, you can create your own formats by installing the `Templates` plugin and following the directions to create your own `_configuration` note, which can include a `date` property (inside the code fences) like this:

``
  date: {
    // Default timezone for date and time. Or force, e.g. 'America/Los_Angeles'
    timezone: 'automatic',
    // Default locale to format date and time.
    // e.g. en-US will result in mm/dd/yyyy, while en_GB will be dd/mm/yyyy
    locale: 'en-US',
    // can be "short", "medium", "long" or "full"
    dateStyle: 'short',
    // optional key, can be "short", "medium", "long" or "full"
    timeStyle: 'short',
    // can force 24 hour time format, even in america!
    hour12: false,
  }
``

### Some other formats

``
// US English uses month-day-year order
'en-US' → "12/19/2012"

// British English uses day-month-year order
'en-GB' → "19/12/2012"

// Korean uses year-month-day order
'ko-KR' → "2012. 12. 19."

// Arabic in most Arabic speaking countries uses real Arabic digits
'ar-EG' → "١٩‏/١٢‏/٢٠١٢"

// for Japanese, applications may want to use the Japanese calendar,
// where 2012 was the year 24 of the Heisei era
'ja-JP-u-ca-japanese' → "24/12/19"
``
...or see [Date Time Formats](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) for more choices/details

## History

