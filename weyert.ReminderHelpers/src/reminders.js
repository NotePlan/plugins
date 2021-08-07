// @flow

// ------------------------------------------------------------------------------------
// Command to turn tasks into full reminder events
// @weyert
// v0.1.0, 7.8.2021
//
// ------------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

import {
  defaultTodoCharacter,
  displayTitle,
  showMessage,
  dateStringFromCalendarFilename,
} from '../../helperFunctions'

// ------------------------------------------------------------------------------------
const DEFAULT_REMINDERS_CONFIG = {}

const minimumConfig = {}

function getDateFromString(dateStr: string): Array<int> {
  if (dateStr.includes('-')) {
    return dateStr
      .split('-')
      .map((item) => parseInt(item, 10))
      .filter((item) => isNaN(item))
  }

  // If the date is not including - we assume its YYYYMMDD
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6))
  const day = parseInt(dateStr.slice(6, 8))
  return [year, month, day]
}

async function getRemindersByDate(
  dateStr: string,
): Promise<Array<TCalendarItem>> {
  console.log(`getRemindersByDate() dateStr: ${dateStr}`)

  const dateElements = getDateFromString(dateStr)
  const [year, month, date] = dateElements
  console.log(`${JSON.stringify(dateElements)}`)

  const startOfDay = Calendar.dateFrom(year, month, date, 0, 0, 0)
  const endOfDay = Calendar.dateFrom(year, month, date, 23, 59, 59)

  const reminders: Array<TCalendarItem> = await Calendar.remindersBetween(
    startOfDay,
    endOfDay,
  )

  return reminders
}

// Go through current Editor note and identify time blocks to turn into events
export async function listReminders(paramString?: string): Promise<string> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return ''
  }
  // $FlowIgnore[incompatible-call]
  const dateStr = dateStringFromCalendarFilename(Editor.filename)
  console.log(
    `\nlistReminders for ${dateStr} with paramString=${String(paramString)}`,
  )

  const { note } = Editor
  const noteTitle = displayTitle(note)
  console.log(`listReminders: starting for note '${noteTitle}'`)
  const reminderConfiguration = await getOrMakeConfigurationSection(
    'reminders',
    DEFAULT_REMINDERS_CONFIG,
    minimumConfig,
  )

  console.log(`Reminder settings are ${JSON.stringify(reminderConfiguration)}`)

  console.log(`Retrieve reminders for '${dateStr}'`)
  const reminders = await getRemindersByDate(dateStr)

  // Check if any reminders are available for today
  console.log(`Total number of reminders: ${reminders.length}`)
  if (reminders.length === 0) {
    return ''
  }

  // Generate a list of tasks from the reminders
  let reminderOutput = ''

  const reminderOpen = defaultTodoCharacter
  const reminderCompleted = '[x]'
  reminders.forEach((reminder: TCalendarItem) => {
    // Add the reminder as a task to the current node
    if (!reminder.isCompleted) {
      reminderOutput += `${reminderOpen} ${reminder.title}\n`
    } else {
      console.log(`Reminder is completed ${reminder.title}`)
      reminderOutput += `${reminderCompleted} ${reminder.title} @done\n`
    }
  })

  return reminderOutput
}

/**
 * Inserts the list of reminders into the active note
 * @param {string} paramString the parameter string
 */
export async function insertReminders(paramString: ?string): Promise<void> {
  console.log(`insertReminders, parameter: ${paramString}`)
  // Get list of events happening on the day of the open note
  let output: string = await listReminders(paramString || '')
  output += output.length === 0 ? '\nNo reminders\n' : '\n'
  Editor.insertTextAtCursor(output)
}
