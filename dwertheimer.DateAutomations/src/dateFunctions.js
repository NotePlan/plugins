// @flow
// TODO: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

import { getDefaultConfiguration } from '../../nmn.Templates/src/configuration'
import { hyphenatedDateString } from '../../nmn.sweep/src/dateHelpers'

type DateConfig = $ReadOnly<{
  timezone: string,
  locale: string,
  dateStyle?: string,
  timeStyle?: string,
  hour12?: boolean,
  ...
}>
// This is a function that verifies that an object is of the type
// DateConfig. If it is, it returns an object with the correct type
// If it's not, it returns undefined.
function asDateConfig(obj: mixed): ?DateConfig {
  if (
    typeof obj === 'object' &&
    obj != null &&
    typeof obj.timezone === 'string' &&
    typeof obj.locale === 'string'
  ) {
    const { timezone, locale, dateStyle, timeStyle, hour12, ...other } = obj
    return {
      ...other,
      timezone,
      locale,
      dateStyle: typeof dateStyle === 'string' ? dateStyle : undefined,
      timeStyle: typeof timeStyle === 'string' ? timeStyle : undefined,
      hour12: typeof hour12 === 'boolean' ? hour12 : undefined,
    }
  }
}

async function getDateConfig(): Promise<DateConfig> {
  const config = await getDefaultConfiguration()
  // Verify that the config.date value is a `DateConfig`
  const dateConfig = asDateConfig(config?.date)
  if (dateConfig) {
    return dateConfig
  } else {
    return {
      // Default timezone for date and time.
      timezone: 'automatic',
      // Default locale to format date and time.
      // e.g. en-US will result in mm/dd/yyyy, while en_GB will be dd/mm/yyyy
      locale: 'en-US',
      // can be "short", "medium", "long" or "full"
      dateStyle: 'full',
      // optional key, can be "short", "medium", "long" or "full"
      timeStyle: 'short',
      // can force 24 hour time format, even in america!
      hour12: true,
    }
  }
}

/**
 * Create a list of options for combinations of date & time formats
 * @returns [{allDateOptions}] props: dateStyle, timeStyle, label, text (to be inserted if chosen)
 */
async function getFormattedDateTime() {
  // pull options and create options for various dateStyles and timeStyles
  const dateConfig = await getDateConfig()
  const dateStyles = ['short', 'medium', 'long'] // pulling out 'full' for now
  const timeStyles = ['', 'short', 'medium', 'long'] // pulling out 'full' for now

  const options = []
  dateStyles.forEach((ds) =>
    timeStyles.forEach((ts) => {
      // Pluck all values except `dateStyle` and `timeStyle`
      const { dateStyle: _1, timeStyle: _2, ...config } = { ...dateConfig }

      // conditionall add those keys to config
      if (ds !== '') {
        // Ignore type error for now
        // $FlowFixMe
        config.dateStyle = ds
      }
      if (ts !== '') {
        // $FlowFixMe
        config.timeStyle = ts
      }

      // console.log(`${JSON.stringify(config)}`)
      const text = new Intl.DateTimeFormat(
        config.locale,
        // $FlowFixMe
        config,
      ).format()

      options.push({
        dateStyle: ds !== '' ? ds : null,
        timeStyle: ts !== '' ? ds : null,
        label: `${text} (${ds}/${ts})`,
        text: `${text}`,
      })
    }),
  )

  console.log(JSON.stringify(options, null, 2))
  return options
}

// /iso
export async function insertISODate() {
  const nowISO = new Date().toISOString()
  Editor.insertTextAtCursor(nowISO)
}

// /date
export async function insertDate() {
  const { timeStyle: _, ...dateConfig } = await getDateConfig()
  const dateText = new Intl.DateTimeFormat(
    dateConfig.locale,
    dateConfig,
  ).format()
  Editor.insertTextAtCursor(dateText)
}

// /now
export async function insertDateTime() {
  const _dateConfig = await getDateConfig()
  const dateConfig = {
    ..._dateConfig,
    dateStyle: _dateConfig.dateStyle ?? 'full',
    timeStyle: _dateConfig.timeStyle ?? 'short',
  }
  const dateText = new Intl.DateTimeFormat(
    dateConfig.locale,
    dateConfig,
  ).format()
  Editor.insertTextAtCursor(`${dateText}`)
}

// /time
export async function insertTime() {
  const { dateStyle: _, ...dateConfig } = await getDateConfig()
  const timeText = new Intl.DateTimeFormat(
    dateConfig.locale,
    dateConfig,
  ).format()
  Editor.insertTextAtCursor(timeText)
}

// /ldn
export function insertCalendarNoteLink() {
  Editor.insertTextAtCursor(`[[${hyphenatedDateString(new Date())}]]`)
}

// /dp
export async function datePicker() {
  const dateChoices = await getFormattedDateTime()
  const re = await CommandBar.showOptions(
    dateChoices.map((d) => d.label),
    'Choose a format (dateStyle/timeStyle)',
  )
  Editor.insertTextAtCursor(dateChoices[re.index].text)
}
