// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev dbludeau.TodoistNoteplanSync --test --watch --coverage`
// IMPORTANT: It's a good idea for you to open the settings ASAP in NotePlan Preferences > Plugins and set your plugin's logging level to DEBUG

/**
 * LOGGING
 * A user will be able to set their logging level in the plugin's settings (if you used the plugin:create command)
 * As a general rule, you should use logDebug (see below) for messages while you're developing. As developer,
 * you will set your log level in your plugin preferences to DEBUG and you will see these messages but
 * an ordinary user will not. When you want to output a message,you can use the following.
 * logging level commands for different levels of messages:
 *
 * logDebug(pluginJson,"Only developers or people helping debug will see these messages")
 * log(pluginJson,"Ordinary users will see these informational messages")
 * logWarn(pluginJson,"All users will see these warning/non-fatal messages")
 * logError(pluginJson,"All users will see these fatal/error messages")
 */ 

import {
  getTodaysDateAsArrowDate,
  getTodaysDateUnhyphenated,
} from "../../helpers/dateTime"
import { logInfo } from "../../helpers/dev";
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'


const todo_api: string = 'https://api.todoist.com/rest/v2'

// set some defaults that can be changed in settings
const setup: {
  token: string,
  folder: string,
  addDates: boolean,
  addPriorities: boolean,
  addTags: bool,
  header: string,
  newFolder: any,
  newToken: any,
  syncDates: any,
  syncPriorities: any,
  syncTags: any,
  newHeader: any
} = { 
  token: '',
  folder: 'Todoist',
  addDates: false,
  addPriorities: false,
  addTags: false,
  header: '',

  /**
   * @param {string} passedToken
   */
  set newToken(passedToken: string) {
    this.token = passedToken
  },
  /**
   * @param {string} passedFolder
   */
  set newFolder(passedFolder: string) {
    this.folder = passedFolder
  },
  /**
   * @param {boolean} passedSyncDates
   */
  set syncDates(passedSyncDates: boolean) {
    this.addDates = passedSyncDates
  },
  /**
   * @param {boolean} passedSyncPriorities
   */
  set syncPriorities(passedSyncPriorities: true) {
    this.addPriorities = passedSyncPriorities
  },
  /**
   * @param {boolean} passedSyncTags
   */
  set syncTags(passedSyncTags: boolean) {
    this.addTags = passedSyncTags
  },
  /**
   * @param {string} passedHeader
   */
  set newHeader(passedHeader: string) {
    this.header = passedHeader
  }
}

const closed: Array<any> = []
const existing: Array<any> = []
const existingHeader: {
  exists: boolean,
  headerExists: any
} = {
  exists: false,
  /**
   * @param {boolean} passedHeaderExists
   */
  set headerExists(passedHeaderExists: string) {
    this.exists = passedHeaderExists
  },
}


  /**
 * Synchronizes everything.
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete.
 */
// eslint-disable-next-line require-await
export async function syncEverything() {

  setSettings()

  logDebug(pluginJson, `Folder for everything notes: ${setup.folder}`)
  const folders: Array<any> = DataStore.folders.filter((f) => f.startsWith(setup.folder)) ?? []

  // if we can't find a matching folder, create it
  if (folders.length === 0) {
    try {
      DataStore.createFolder(setup.folder);
      logDebug(pluginJson, `New folder has been created (${setup.folder})`)
    } catch (error) {
      logError(pluginJson, `Unable to create new folder (${setup.folder}) in Noteplan (${JSON.stringify(error)})`)
      process.exit(1)
    }
  }

  // get the todoist projects and write out the new ones
  // needs to be broken into smaller functions, but could not get it to return correctly
  getTodoistProjects()

  // completed correctly (in theory)
  logDebug(pluginJson, 'Plugin completed without errors')
}

/**
 * Synchronize tasks for today.
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete.
 */
// eslint-disable-next-line require-await
export async function syncToday() {
  setSettings()
  // get todays date in the correct format
  const date: string = getTodaysDateUnhyphenated() ?? ''
  const date_string: string = getTodaysDateAsArrowDate() ?? ''
  logInfo(pluginJson, `Todays date is: ${date_string}`)

  if (date) {
    const note: ?TNote = DataStore?.calendarNoteByDateString(date)
    if (note === null) {
      logError(pluginJson, 'unable to find todays note in Noteplan')
      HTMLView.showSheet(`<html><body><p>Unable to find daily note for ${date_string}</p></body></html>`, 450, 50)
      process.exit(1)
    }
    logInfo(pluginJson, `Todays note was found, pulling Today Todoist tasks...`)
    // get the todoist tasks for today
    fetch(`${todo_api}/tasks?filter=today`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${setup.token}`,
        'Content-Type': 'application/json',
      },
    })
    .then((response) => {
      if (setup.header !== '') {
        // check to see if that heading already exists and tab what tasks already exist
        const paragraphs: ?$ReadOnlyArray<TParagraph> = note?.paragraphs

        if (paragraphs) {
          paragraphs.forEach((paragraph) => {
            checkParagraph(paragraph)
          })
        }

        if (!existingHeader.exists) {
          logDebug(pluginJson, `Creating Heading: ${setup.header}`)
          note?.insertHeading(setup.header, 100, 3)
        }
      }
      //close the tasks in Todoist if they are complete in Noteplan`
      closed.forEach(async (t) => {
        await closeTodoistTask(t)
      })
      const tasks: Array<Object> = JSON.parse(response)
      tasks.forEach((task) => {
        if (!existing.includes(task.id)) {
          const fortmatted: string = formatTaskDetails(task)
          logInfo(pluginJson, `Adding task form Todoist to Note`)
          note?.addTodoBelowHeadingTitle(fortmatted, setup.header, true, true)
        }
      })
    })
    .catch((error) => {
      logError(pluginJson, `Error getting today tasks from Todoist (${JSON.stringify(error)})`)
    })
  }
}

/**
 * Check a paragraph for specific conditions and update the state accordingly.
 *
 * @param {TParagraph} paragraph - The paragraph to check.
 * @returns {void}
 */
function checkParagraph(paragraph: TParagraph) {
  const string: string = `### ${setup.header}`
  const regex: any = new RegExp(string)
  if (paragraph.rawContent.match(regex)) {
    existingHeader.headerExists = true
  }

  if (paragraph.type === 'done' || paragraph.type === 'cancelled') {
    const content: string = paragraph.content
    logDebug(pluginJson, `Task content: ${content}`)

    // close these ones in Todoist if they are closed in Noteplan and are todoist tasks
    const found: ?Array<string> = content.match(/showTask\?id=(.*)\)/)
    if (found && found.length > 1) {
      closed.push(found[1])
      // add to existing as well so they do not get rewritten if the timing on closing them is slow
      existing.push(found[1])
    }
  } else if (paragraph.type === 'open') {
    const content: string = paragraph.content
    logDebug(pluginJson, `Task content: ${content}`)
    const found: ?Array<string> = content.match(/showTask\?id=(.*)\)/)
    if (found && found.length > 1) {
      logInfo(pluginJson, `Todoist ID found in Noteplan note (${found[1]})`)
      // check to see if it is already closed in Todoist.
      fetch(`${todo_api}/tasks/${found[1]}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${setup.token}`,
          'Content-Type': 'application/json',
        }
      }).then((task_info: Object) => {
        const completed: boolean = task_info?.is_completed ?? false
        if (completed === true) {
          logDebug(pluginJson, `Going to mark this one closed in Noteplan: ${task_info.content}`)
          paragraph.type = 'done'
        }
      })
      existing.push(found[1])
    }
  }
}

/**
 * Format task details for display.
 *
 * @param {Object} task - The task object to format.
 * @returns {string} The formatted task details.
 */
function formatTaskDetails(task: Object) : string {
  let task_write: string = ''

  // get the priority
  let priorities: string = ''
  if (setup.addPriorities) {
    if (task.priority === 4) {
      priorities = "!!! "
    } else if (task.priority === 3) {
      priorities = "!! "
    } else if (task.priority === 2) {
      priorities = "! "
    }
  }

  // concat the priorities to the front of the string
  task_write = `${priorities}${task.content}`

  // add the Todoist URL to the end of the string
  task_write = `${task_write}[^](${task.url})`

  // add the lables after the URL
  if (setup.addTags) {
    task.labels.forEach((label) => {
      task_write = `${task_write} #${label}`
    })
  }

  // finnally add the due dates at the very end
  if (setup.addDates && task.due !== null) {
    task_write = `${task_write} >${task.due.date}`
  }

  logDebug(pluginJson, `Formatted task details: ${task_write}`)
  return task_write
}

/**
 * Parse the settings set by the user for use throughout the script.
 *
 * @returns {void}
 */
function setSettings() {
  const settings: Object = DataStore.settings ?? {}
  //console.log(JSON.stringify(settings))

  if (settings) {
    // required options that should kill the script if not set
    if ('apiToken' in settings && settings.apiToken !== '') {
      setup.newToken = settings.apiToken
    } else {
      logError(pluginJson, 'Missing API Token')
      HTMLView.showSheet(`<html><body><p>Missing API token. Must be set in settings options</p></body></html>`, 450, 50)
      process.exit(1)
    }

    // optional settings
    if ('folderToUse' in settings && settings.folderToUse !== '') {
      setup.newFolder = settings.folderToUse
    }

    if ('syncDue' in settings) {
      setup.syncDates = settings.syncDue
    }
    if ('syncPriorities' in settings) {
      setup.syncPriorities = settings.syncPriorities
    }

    if ('syncTags' in settings) {
      setup.syncTags = settings.syncTags
    }

    if ('headerToUse' in settings && settings.headerToUse !== '') {
      setup.newHeader = settings.headerToUse
    }
  }
}

/**
 * Get tasks from Todoist and write them to a note.
 *
 * @param {string} project_id - The ID of the project to fetch tasks for.
 * @param {string} note_name - The name of the note to write tasks to.
 * @returns {void}
 */
function getAndWriteTasks(project_id, note_name) {

  try {
    fetch(`${todo_api}/tasks?project_id=${project_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${setup.token}`,
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      const tasks: Array<Object> = JSON.parse(response)
      tasks.forEach((task) => {
        const task_write: string = formatTaskDetails(task)

        const note: ?TNote = DataStore.projectNoteByFilename(note_name)
        if (note) {
          if (task.section_id !== null) {
            fetch(`${todo_api}/sections/${task.section_id}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${setup.token}`,
                'Content-Type': 'application/json',
              },
            }).then((response) => {
              const section: ?Object = JSON.parse(response)
              if (section) {
               if (!existing.includes(task.id)) {
                  logInfo(pluginJson, `Task will be added Noteplan (${task.id})`)
                  note.addTodoBelowHeadingTitle(task_write, section.name, true, true)
                } else {
                  logInfo(pluginJson, `Task is already in Noteplan (${task.id})`)
                }
              } else {
                // this one has a section ID but Todoist will not return a name
                // Put it in with no heading
                logWarn(pluginJson, `Section ID ${task.section_id} did not return a section name`)
                if (!existing.includes(task.id)) {
                  logInfo(pluginJson, `Task will be added to Noteplan (${task.id})`)
                  note.prependTodo(task_write)
                } else {
                  logInfo(pluginJson, `Task is already in Noteplan (${task.id})`)
                }
              }
            })
          } else {
            if (!existing.includes(task.id)) {
              logInfo(pluginJson, `Task will be added to Noteplan (${task.id})`)
              note.prependTodo(task_write)
            } else {
              logInfo(pluginJson, `Task is already in Noteplan (${task.id})`)
            }
          }
        }
      })
    })
  } catch (error) {
    logError(pluginJson, `Error in getting tasks from Todoist (${JSON.stringify(error)})`)
  }
  logDebug(pluginJson, `Tasks synced for ${note_name}`)
}


/**
 * Will search Noteplan in the set folder for a note that matches the Todoist project name.
 * Will create if it does not exist
 * @param project_name
 * @return object
 */
function getExistingNote(project_name: string) : Object {
  let name = ''
  let title = ''
  const existing_notes = DataStore.projectNotes.filter((n) => n.filename.startsWith(`${setup.folder}/${project_name}`))
  if (existing_notes.length > 0) {
    logDebug(pluginJson, `Pulling existing note matching project: ${project_name}.  Note found: ${existing_notes[0].filename}`)
    name = existing_notes[0].filename
    title = existing_notes[0].title
  } else {
    logDebug(pluginJson, `Creating note: ${project_name} in: ${setup.folder}`)
    try {
      name = DataStore.newNote(project_name, setup.folder)
      title = project_name
    } catch (error) {
      logError(pluginJson, `Unable to create new note (${JSON.stringify(error)}`)
    }
  }
  return { name: name, title: title }
}

/**
 * Review existing tasks in Noteplan.
 *
 * @param {Object} note - The note to review tasks for.
 * @returns {void}
 */
function reviewExistingNoteplanTasks(note: Object) {

  // we only need to work on the ones that have a page associated with them
  if ('name' in note) {
    const note_to_check: ?TNote = DataStore.projectNoteByFilename(note.name)
    const paragraphs: $ReadOnlyArray<TParagraph> = note_to_check?.paragraphs ?? []
    if (paragraphs) {
      paragraphs.forEach((paragraph) => {
        checkParagraph(paragraph)
      })
    }
  }
}

/**
 * Get Todoist projects and synchronize tasks.
 *
 * @returns {void}
 */
function getTodoistProjects() {

  fetch(`${todo_api}/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${setup.token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      const projects: ?Array<Object> = JSON.parse(response)
      if (projects) {
        projects.forEach((project) => {
          logDebug(pluginJson, `Project name: ${project.name} Project ID: ${project.id}`)

          // see if there is an existing note or create it if not
          const note: ?Object = getExistingNote(project.name)

          if (note) {
            // get the completed tasks in Noteplan and close them in Todoist
            reviewExistingNoteplanTasks(note)
            closed.forEach(async (t) => {
              await closeTodoistTask(t)
            })

            // grab the tasks and write them out with sections
            const id: string = project?.id ?? ''
            const note_name: string = note?.name ?? ''
            if (id !== '' && note_name !== '') {
              getAndWriteTasks(id, note_name)
            }
          }
        })
      }
    })
    .catch((error) => {
      logError(pluginJson, `Unable to retrieve project list from Todoist (${JSON.stringify(error)})`)
      process.exit(1)
    })
}

/**
 * Close a Todoist task.
 *
 * @param {string} task_id - The ID of the task to close.
 * @returns {Promise<void>} A promise that resolves once the task is closed.
 */
async function closeTodoistTask(task_id: string) {
  try {
    await fetch(`${todo_api}/tasks/${task_id}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${setup.token}`,
      },
    })
  } catch (error) {
    logError(pluginJson, `Unable to close task (${task_id}) ${JSON.stringify(error)}`)
  }
}
