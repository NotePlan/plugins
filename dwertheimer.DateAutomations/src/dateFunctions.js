// @flow
// TODO: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

import { getStructuredConfiguration } from '../../nmn.Templates/src/configuration'
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
  const config = await getStructuredConfiguration()
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
  const hour12 = [false, true]

  // Pluck all values except `dateStyle` and `timeStyle`
  const { dateStyle: _1, timeStyle: _2, ...config } = { ...dateConfig }

  // Get user default locale
  const locales = []
  locales.push((dateConfig && dateConfig.locale) || 'en-US')
  // if (dateConfig.locale !== 'sv-SE') locales.push('sv-SE')
  const str8601 = get8601String()
  const options = [
    {
      dateStyle: 'sv-SE',
      timeStyle: 'medium',
      label: `${str8601} (sv-SE,short,medium,[not set])`,
      text: `${str8601}`,
    },
  ]
  locales.forEach((loc) => {
    dateStyles.forEach((ds) =>
      timeStyles.forEach((ts) => {
        hour12.forEach((h12) => {
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
          config.hour12 = h12
          // console.log(`${JSON.stringify(config)}`)
          const text = new Intl.DateTimeFormat(
            loc,
            // $FlowFixMe
            config,
          ).format()

          options.push({
            dateStyle: ds !== '' ? ds : null,
            timeStyle: ts !== '' ? ds : null,
            label: `${text} (${loc}/${ds ? ds : '[not set]'}/${
              ts ? ts : '[not-set]'
            }/${String(h12)})`,
            text: `${text}`,
          })
        })
      }),
    )
  })

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

function get8601String() {
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format()
}
// /now
export async function insertDateTime8601() {
  Editor.insertTextAtCursor(`${get8601String()}`)
}

// /time
export async function insertTime() {
  const { dateStyle: _, ...dateConfig } = await getDateConfig()
  const editableConfig = { ...dateConfig }
  if (!editableConfig.timeStyle) editableConfig.timeStyle = 'medium'
  console.log(`insertTime:${JSON.stringify(editableConfig)}`)
  const timeText = new Intl.DateTimeFormat(
    dateConfig.locale,
    editableConfig,
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
    'Choose format (locale/dateStyle/timeStyle/hour12)',
  )
  Editor.insertTextAtCursor(dateChoices[re.index].text)
}
