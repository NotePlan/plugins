// @flow
// TODO: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

import { getDefaultConfiguration } from '../../nmn.Templates/src/configuration'
import { hyphenatedDateString } from '../../nmn.sweep/src/dateHelpers'

const pad = (num) => (num < 10 ? `0${num}` : num)

async function getDateConfig() {
  const config = (await getDefaultConfiguration()) ?? {}
  const dateConfig = config.date ?? null
  if (dateConfig && date.locale) {
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
 * @returns {allDateOptions} props: dateStyle, timeStyle, label, text (to be inserted if chosen)
 */
async function getFormattedDateTime() {
  // pull options and create options for various dateStyles and timeStyles
  const dateConfig = await getDateConfig()
  const dateStyles = ['short', 'medium', 'long'] // pulling out 'full' for now
  const timeStyles = ['', 'short', 'medium', 'long'] // pulling out 'full' for now
  const options = []
  dateStyles.forEach((ds) =>
    timeStyles.forEach((ts) => {
      dateConfig.dateStyle = ds
      if (ds === '') delete dateConfig.dateStyle
      dateConfig.timeStyle = ts
      if (ts === '') delete dateConfig.timeStyle
      const text = new Intl.DateTimeFormat(
        dateConfig.locale,
        dateConfig,
      ).format()
      options.push({
        dateStyle: ds !== '' ? ds : null,
        timeStyle: ts !== '' ? ds : null,
        label: `${text} (${ds}/${ts})`,
        text: `${text}`,
      })
    }),
  )
  // console.log(JSON.stringify(options))
  return options
}

// /iso
export async function insertISODate() {
  const nowISO = new Date().toISOString()
  Editor.insertTextAtCursor(nowISO)
}

// /date
export async function insertDate() {
  const dateConfig = await getDateConfig()
  if (dateConfig.timeStyle) delete dateConfig.timeStyle
  const dateText = new Intl.DateTimeFormat(
    dateConfig.locale,
    dateConfig,
  ).format()
  Editor.insertTextAtCursor(dateText)
}

// /now
export async function insertDateTime() {
  const dateConfig = await getDateConfig()
  if (!dateConfig.dateStyle) dateConfig.dateStyle = 'full'
  if (!dateConfig.timeStyle) dateConfig.timeStyle = 'short'
  const dateText = new Intl.DateTimeFormat(
    dateConfig.locale,
    dateConfig,
  ).format()
  Editor.insertTextAtCursor(`${dateText}`)
}

// /time
export async function insertTime() {
  const dateConfig = await getDateConfig()
  if (dateConfig.dateStyle) delete dateConfig.dateStyle
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
