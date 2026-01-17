// @flow
//--------------------------------------------------------------------------
// Date Format Options Helper
// Shared helper for date format options used by TemplateTagInserter and calendarpicker
//--------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'

export type DateFormatOption = {
  label: string,
  value: string,
  description: string,
  format: string, // moment.js format string
}

/**
 * Get date format options for use in date pickers and template tag inserters
 * @param {boolean} includeObject - Include "[Object]" option for returning Date object
 * @returns {Array<DateFormatOption>} Array of date format options
 */
export function getDateFormatOptions(includeObject: boolean = true): Array<DateFormatOption> {
  // Set locale from NotePlan environment if available
  if (typeof NotePlan !== 'undefined' && NotePlan.environment) {
    const userLocale = `${NotePlan.environment.languageCode || 'en'}${NotePlan.environment.regionCode ? `-${NotePlan.environment.regionCode}` : ''}`
    moment.locale(userLocale)
  }

  // Use a sample date to generate locale-specific examples
  // Use a date that shows various aspects: weekday, month, day, year, time
  const sampleDate = moment('2024-12-22 14:30:45') // Sunday, December 22, 2024, 2:30 PM

  const formats: Array<{ format: string, description: string }> = [
    // ISO and standard formats
    { format: 'YYYY-MM-DD', description: 'ISO date format (default)' },
    { format: 'YYYY-MM-DD HH:mm', description: 'ISO date and time (24-hour)' },
    { format: 'YYYY-MM-DD HH:mm:ss', description: 'ISO date and time with seconds' },

    // US date formats
    { format: 'MM/DD/YYYY', description: 'US date format' },
    { format: 'MM/DD/YY', description: 'US date format (short year)' },
    { format: 'M/D/YYYY', description: 'US date format (no leading zeros)' },

    // European date formats
    { format: 'DD/MM/YYYY', description: 'European date format' },
    { format: 'DD/MM/YY', description: 'European date format (short year)' },
    { format: 'D/M/YYYY', description: 'European date format (no leading zeros)' },

    // Long date formats
    { format: 'MMMM Do, YYYY', description: 'Long date format (e.g., December 22nd, 2024)' },
    { format: 'dddd, MMMM Do, YYYY', description: 'Full date with weekday' },
    { format: 'MMMM Do', description: 'Month and day (e.g., December 22nd)' },

    // Time formats (12-hour with AM/PM)
    { format: 'h:mm A', description: 'Time (12-hour with AM/PM)' },
    { format: 'hh:mm A', description: 'Time (12-hour with AM/PM, leading zero)' },
    { format: 'h:mm:ss A', description: 'Time with seconds (12-hour with AM/PM)' },

    // Time formats (24-hour)
    { format: 'HH:mm', description: 'Time (24-hour)' },
    { format: 'HH:mm:ss', description: 'Time with seconds (24-hour)' },

    // Date and time combinations
    { format: 'MM/DD/YYYY h:mm A', description: 'US date and time (12-hour)' },
    { format: 'MM/DD/YYYY HH:mm', description: 'US date and time (24-hour)' },
    { format: 'DD/MM/YYYY h:mm A', description: 'European date and time (12-hour)' },
    { format: 'DD/MM/YYYY HH:mm', description: 'European date and time (24-hour)' },
    { format: 'MMMM Do, YYYY h:mm A', description: 'Long date and time (12-hour)' },
    { format: 'MMMM Do, YYYY HH:mm', description: 'Long date and time (24-hour)' },

    // Individual components
    { format: 'dddd', description: 'Day of week (full name)' },
    { format: 'ddd', description: 'Day of week (abbreviated)' },
    { format: 'MMMM', description: 'Month name (full)' },
    { format: 'MMM', description: 'Month name (abbreviated)' },
    { format: 'YYYY', description: 'Year (4 digits)' },
    { format: 'YY', description: 'Year (2 digits)' },
    { format: 'Do', description: 'Day of month with ordinal (e.g., 22nd)' },
    { format: 'D', description: 'Day of month (no leading zero)' },
    { format: 'DD', description: 'Day of month (with leading zero)' },

    // Week and quarter
    { format: 'wo [week of] YYYY', description: 'Week number and year' },
    { format: 'Qo [quarter] YYYY', description: 'Quarter and year' },
  ]

  const options: Array<DateFormatOption> = []

  // Add "[Object]" option first if requested
  if (includeObject) {
    options.push({
      label: '[Object]',
      value: '__object__',
      description: 'Return Date object (default behavior)',
      format: '__object__',
    })
  }

  // Add default ISO 8601 format
  options.push({
    label: '8601 Date (default)',
    value: 'YYYY-MM-DD',
    description: 'ISO 8601 date format',
    format: 'YYYY-MM-DD',
  })

  // Add all other formats
  formats.forEach((df) => {
    // Generate locale-specific example using moment
    const example = sampleDate.format(df.format)
    options.push({
      label: `${df.format} (${example})`,
      value: df.format,
      description: df.description,
      format: df.format,
    })
  })

  return options
}
