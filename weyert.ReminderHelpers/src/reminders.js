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
  toISODateString,
  smartPrependPara,
} from '../../helperFunctions'

// ------------------------------------------------------------------------------------
const DEFAULT_REMINDERS_CONFIG = {}

const minimumConfig = {}

function getDateFromString(dateStr: string): Array<int> {
  console.log(`getDateFromString() dateStr: ${dateStr}`)
  if (dateStr.includes('-')) {
    console.log(`getDateFromString(): Given date string contains -`)
    return dateStr
      .split('-')
      .map((item) => parseInt(item, 10))
      .filter((item) => !isNaN(item))
  }

  // If the date is not including - we assume its YYYYMMDD
  console.log(`getDateFromString() Date string is missing -`)
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6))
  const day = parseInt(dateStr.slice(6, 8))
  return [year, month, day]
}

async function getTasksFromNote() {
  // Get all the available taks from the note
  const allowedTypes = ['open', 'done']
  const noteParagraphs = Editor.note.paragraphs.filter((paragraph) =>
    allowedTypes.includes(paragraph.type),
  )
  console.log(`getTasksFromNote() noteParagraphs: ${noteParagraphs}`)

  return noteParagraphs
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
  console.log(`getRemindersByDate() startOfDay: ${startOfDay}`)
  console.log(`getRemindersByDate() endOfDay: ${endOfDay}`)

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
  const reminderCompleted = `${reminderOpen} [x]`
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
 * Automatically synchronises reminders on the active note with the reminders
 * @param {*} paramString
 */
export async function syncReminders(paramString?: string): Promise<void> {
  console.log(`syncReminders, parameter: ${paramString}`)
  if (Editor.note == null) {
    await showMessage('Please run again with a note open.')
    return ''
  }

  let targetDate = new Date()
  console.log(
    `syncReminders() calendarType: ${Editor.type} -> ${Editor.note.date} [${Editor.note.type}]`,
  )
  if (Editor.note.type === 'Calendar') {
    targetDate = Editor.note.date
  }

  console.log(`syncReminders() targetDate: ${targetDate}`)

  // Retrieve all the reminders for the given date
  const targetDateAsString = toISODateString(targetDate)
  console.log(`syncReminders() targetDateAsString: ${targetDateAsString}`)
  const calendarReminders = await getRemindersByDate(targetDateAsString)
  console.log(`syncReminders() calendarReminders: ${calendarReminders.length}`)

  const noteTasks = await getTasksFromNote()
  console.log(`syncReminders() noteTasks: ${noteTasks.length}`)

  // Iterate through the list of note tasks and check them against the available reminders
  for (const task of noteTasks) {
    console.log(
      `syncReminders() task heading ${task.heading} title: ${task.content}`,
    )
    const sanitisedNoteDetails = getTagsOrMentionsFromText(task.content)
    const relevantReminder = calendarReminders.find((reminder) => {
      const sanitisedReminderDetails = getTagsOrMentionsFromText(reminder.title)
      console.log(
        `syncReminders() compare task '${sanitisedNoteDetails.santisedContent}' against reminder: '${sanitisedReminderDetails.santisedContent}' [${reminder.id}]`,
      )
      return (
        sanitisedNoteDetails.santisedContent ===
        sanitisedReminderDetails.santisedContent
      )
    })

    // Update the task in the active note
    await updateOrInsertReminder(task, relevantReminder)
  }

  //
  for (const reminder of calendarReminders) {
    const sanitisedReminderDetails = getTagsOrMentionsFromText(reminder.title)

    const relevantTask = noteTasks.find((task) => {
      const sanitisedTaskDetails = getTagsOrMentionsFromText(task.content)

      console.log(
        `Task '${sanitisedTaskDetails.santisedContent}' for reminder '${sanitisedReminderDetails.santisedContent}'`,
      )
      return (
        sanitisedTaskDetails.santisedContent ===
        sanitisedReminderDetails.santisedContent
      )
    })

    await updateOrInsertTaskFromReminder(reminder, relevantTask)
  }
}

async function updateOrInsertTaskFromReminder(
  reminder: TCalendarItem,
  task?: TParagraph,
): Promise<void> {
  console.log(
    `updateOrInsertTaskFromReminder() reminder: ${reminder} task: ${task}`,
  )
  if (Editor.note == null) {
    await showMessage('Please run again with a note open.')
    return
  }

  // If reminder and task are both known, we skip it for now
  if (reminder && task) {
    return
  }

  // Do stuff
  if (!task) {
    console.log(
      `updateOrInsertTaskFromReminder() creating task for: ${reminder.title}`,
    )

    const kind = reminder.isCompleted ? 'done' : 'open'
    smartPrependPara(Editor.note, reminder.title, kind)

    // const taskTitle = `${reminder.title} Auto`
    // if (reminder.isCompleted) {
    //   Editor.note.appendParagraph(taskTitle, 'done')
    // } else {
    //   Editor.note.appendParagraph(taskTitle, 'open')
    // }
  }

  console.log(
    `updateOrInsertTaskFromReminder(): Action completed for ${reminder.title}`,
  )
}

/**
 * Update the status of the task and reminder
 * @param {*} task  the relevant task
 * @param {*} reminder the reminder
 */
async function updateOrInsertReminder(
  task: TParagraph,
  reminder?: TCalendarItem,
): Promise<void> {
  console.log(`updateOrInsertReminder() task: ${task} reminder: ${reminder}`)
  const isTaskCompleted = ['done', 'cancelled'].includes(task.type)
  console.log(
    `updateOrInsertReminder() isTaskCompleted: ${isTaskCompleted} [${task.type}]`,
  )

  // If a reminder is not given, create one with the status of the task
  if (!reminder) {
    console.log(
      `updateOrInsertReminder() creating reminder for: ${task.content}`,
    )
    const taskDetails = getTagsOrMentionsFromText(task.content)
    console.log(
      `updateOrInsertReminder() taskTitle: ${taskDetails.santisedContent}`,
    )

    const startDate = new Date()

    try {
      // Create a reminder for the given task
      const reminderForTask = CalendarItem.create(
        taskDetails.santisedContent,
        startDate,
        undefined,
        'reminder',
        true,
        'Reminders',
        isTaskCompleted,
      )

      const createdReminder = Calendar.add(reminderForTask)
      if (!createdReminder) {
        console.log(
          `Failed to create reminder item for task ${taskDetails.santisedContent}`,
        )
        return
      }

      console.log(
        `Reminder has been created with identifier: ${createdReminder.id}`,
      )
    } catch (error) {
      console.log(`Error occurred: ${error.message}`)
    } finally {
      // TODO
    }

    // Exit step
    return
  }

  const isReminderCompleted = reminder.isCompleted === 1
  console.log(
    `updateOrInsertReminder() isReminderCompleted: ${reminder.isCompleted}`,
  )

  // Check if reminder is marked as completed, if not we try to update it
  if (isReminderCompleted !== isTaskCompleted) {
    console.log(`updateOrInsertReminder() Reminder and task are mismatching`)
    if (isReminderCompleted === false && isTaskCompleted) {
      console.log(
        `updateOrInsertReminder()  Reminder is open while task is marked as completed`,
      )
      // TODO: find out how to update a reminder/event
    } else if (isReminderCompleted && !isTaskCompleted) {
      console.log(
        `updateOrInsertReminder()  Reminder is marked as completed while task is not`,
      )

      // Update the status of the task in the note
      task.type = 'done'
      Editor.updateParagraph(task)
    }
  } else {
    console.log(
      `updateOrInsertReminder() Reminder and task state is matching. Nothing to do`,
    )
  }
}

/**
 * @private
 * Extracts the hash tags and mentins from the given string
 * @param {*} content the string
 * @returns
 */
function getTagsOrMentionsFromText(content: string) {
  const listOfTags = []
  const listOfMentions = ['@reminder'] // TODO: fix regex match issue

  // const listOfTags = content
  //   .match(/(^|\s)(#[a-z\d-]+)/g)
  //   .map((item) => item && item.trim())
  //   .filter(Boolean)
  // const listOfMentions = content
  //   .match(/(^|\s)(@[a-z\d-\(\)]+)/g)
  //   .map((item) => item && item.trim())
  //   .filter(Boolean)

  const santisedContent = listOfMentions.reduce((accumulator, currentValue) => {
    const replacedContent = accumulator.replace(currentValue, '')
    return replacedContent
  }, content)

  return {
    tags: listOfTags ? listOfTags : [],
    mentions: listOfMentions ? listOfMentions : [],
    santisedContent: santisedContent.trimRight(),
  }
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
