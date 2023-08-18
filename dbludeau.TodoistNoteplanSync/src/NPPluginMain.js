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

import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

const todo_api = 'https://api.todoist.com/rest/v2'

// set some defaults that can be changed in settings
const setup = {
  token: '',
  folder: 'Todoist',
  addDates: false,
  addPriorities: false,
  addTags: false,
  header: '',

  /**
   * @param {string} passedToken
   */
  set newToken(passedToken) {
    this.token = passedToken
  },
  /**
   * @param {string} passedFolder
   */
  set newFolder(passedFolder) {
    this.folder = passedFolder
  },
  /**
   * @param {boolean} passedSyncDates
   */
  set syncDates(passedSyncDates) {
    this.addDates = passedSyncDates
  },
  /**
   * @param {boolean} passedSyncPriorities
   */
  set syncPriorities(passedSyncPriorities) {
    this.addPriorities = passedSyncPriorities
  },
  /**
   * @param {boolean} passedSyncTags
   */
  set syncTags(passedSyncTags) {
    this.addTags = passedSyncTags
  },
  /**
   * @param {string} passedHeader
   */
  set newHeader(passedHeader) {
    this.header = passedHeader
  },
}

const closed = []
const existing = []
const existingHeader = {
  exists: false,
  /**
   * @param {boolean} passedHeaderExists
   */
  set headerExists(passedHeaderExists) {
    this.exists = passedHeaderExists
  },
}

// Will sync all projects (lists) from Todoists to a matching named note in Noteplan
// eslint-disable-next-line require-await
export async function syncEverything() {
  setSettings()

  logDebug(`Folder for everything notes: ${setup.folder})`)
  const folders = DataStore.folders.filter((f) => f.startsWith(setup.folder))

  // if we can't find a matching folder, create it
  if (folders.length === 0) {
    try {
      DataStore.createFolder(setup.folder)
      logDebug(`New folder has been created (${setup.folder})`)
    } catch (error) {
      logError(`Unable to create new folder (${setup.folder}) in Noteplan (${JSON.stringify(error)})`)
      process.exit(1)
    }
  }

  // get the todoist projects and write out the new ones
  // needs to be broken into smaller functions, but could not get it to return correctly
  getTodoistProjects()

  // completed correctly (in theory)
  logDebug('Plugin completed without errors')
}

// eslint-disable-next-line require-await
export async function syncToday() {
  setSettings()

  // get todays date in the correct format
  const timezone = NotePlan.environment.localTimeZoneAbbreviation
  let date_string = new Date().toLocaleString('en-US', { timezone: timezone })
  date_string = date_string.split(',')[0]
  const date_matches = date_string.split('/')
  const date = date_matches[2] + date_matches[0].padStart(2, '0') + date_matches[1].padStart(2, '0')
  logDebug(`Todays date is: ${date_string}`)

  const note = DataStore?.calendarNoteByDateString(date)
  if (!note) {
    logError('unable to find todays note in Noteplan')
    HTMLView.showSheet(`<html><body><p>Unalbe to find daily note for ${date_string}</p></body></html>`, 450, 50)
    process.exit(1)
  } else {
    // get the todoist tasks for today
    fetch(`${todo_api}/tasks?filter=today`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${setup.token}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        //console.log(response)
        if (setup.header !== '') {
          // check to see if that heading already exists and tab what tasks already exist
          const paragraphs = note.paragraphs

          if (paragraphs) {
            for (let i = 0; i < paragraphs.length; i++) {
              checkParagraph(paragraphs[i])
            }
          }

          if (!existingHeader.exists) {
            logDebug(`Creating Heading: ${setup.header}`)
            note.insertHeading(setup.header, 100, 3)
          }
        }
        //close the tasks in Todoist if they are complete in Noteplan`
        closed.forEach(async (t) => {
          await closeTodoistTask(t)
        })
        const tasks = JSON.parse(response)
        tasks.forEach((task) => {
          if (!existing.includes(task.id)) {
            const fortmatted = formatTaskDetails(task)
            note.addTodoBelowHeadingTitle(fortmatted, setup.header, true, true)
          }
        })
      })
      .catch((error) => {
        // if the user has set a heading, create that
        logError(`Error getting today tasks from Todoist (${JSON.stringify(error)})`)
      })
  }
}

function checkParagraph(paragraph) {
  //console.log(`${setup.header  }:::${  paragraph.rawContent}`)
  const string = `### ${setup.header}`
  const regex = new RegExp(string)
  if (paragraph.rawContent.match(regex)) {
    existingHeader.headerExists = true
  }

  if (paragraph.type === 'done' || paragraph.type === 'cancelled') {
    const content = paragraph.content

    // close these ones in Todoist if they are closed in Noteplan and are todoist tasks
    const found = content.match(/showTask\?id=(.*)\)/)
    if (found) {
      if (found.length > 1) {
        closed.push(found[1])
        // add to existing as well so they do not get rewritten if the timing on closing them is slow
        existing.push(found[1])
      }
    }
  } else if (paragraph.type === 'open') {
    const content = paragraph.content
    const found = content.match(/showTask\?id=(.*)\)/)
    if (found) {
      if (found.length > 1) {
        // check to see if it is already closed in Todoist.
        fetch(`${todo_api}/tasks/${found[1]}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${setup.token}`,
            'Content-Type': 'application/json',
          },
        }).then((response) => {
          const task_info = JSON.parse(response)
          if (task_info.is_completed === true) {
            logDebug(`Going to mark this one closed in Noteplan: ${task_info.content}`)
            paragraph.type = 'done'
          }
        })
        existing.push(found[1])
      }
    }
  }
}

function formatTaskDetails(task) {
  let task_write = ''

  // get the priority
  let priorities = ''
  if (setup.addPriorities) {
    if (task.priority === 4) {
      priorities = "!!! "
    } else if (task.priority === 3) {
      priorities = "!! "
    } else if (task.priority === 2) {
      priorities = "! "
    }
  }

  task_write = `${priorities}${task.content}`

  task_write = `${task_write}[^](${task.url})`

  if (setup.addTags) {
    task.labels.forEach((label) => {
      task_write = `${task_write} #${label}`
    })
  }

  if (setup.addDates && task.due !== null) {
    task_write = `${task_write} >${task.due.date}`
  }
  return task_write
}

// parse the settings set by the user for use throughout the script
function setSettings() {
  const settings = DataStore.settings
  //console.log(JSON.stringify(settings))

  // required options that should kill the script if not set
  if ('apiToken' in settings && settings.apiToken !== '') {
    setup.newToken = settings.apiToken
  } else {
    logError('Missing API Token')
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

/** grab all tasks per Todoist project.
 * Will do the following per project
 * - check the priority in Todoist and match that to Noteplan priority
 * - attach a due date if available
 * - check if the task is in a section in Todoist, will put it under header in Noteplan
 * - check to see if the task is already in Noteplan, will skip these
 **/
// eslint-disable-next-line require-await
function getAndWriteTasks(project_id, note_name) {
  try {
    fetch(`${todo_api}/tasks?project_id=${project_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${setup.token}`,
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      const tasks = JSON.parse(response)
      tasks.forEach((task) => {
        const task_write = formatTaskDetails(task)

        const note = DataStore.projectNoteByFilename(note_name)
        if (note) {
          if (task.section_id !== null) {
            fetch(`${todo_api}/sections/${task.section_id}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${setup.token}`,
                'Content-Type': 'application/json',
              },
            }).then((response) => {
              const section = JSON.parse(response)
              if (!existing.includes(task.id)) {
                note.addTodoBelowHeadingTitle(task_write, section.name, true, true)
              }
            })
          } else {
            if (!existing.includes(task.id)) {
              note.prependTodo(task_write)
            }
          }
        }
      })
    })
  } catch (error) {
    logError(`Error in getting tasks from Todoist (${JSON.stringify(error)})`)
  }
  logDebug(`Tasks synced for ${note_name}`)
}

/**
 * Will search Noteplan in the set folder for a note that matches the Todoist project name.
 * Will create if it does not exist
 * @param project_name
 * @return object
 */
function getExistingNote(project_name) {
  let name = ''
  let title = ''
  const existing_notes = DataStore.projectNotes.filter((n) => n.filename.startsWith(`${setup.folder}/${project_name}`))
  if (existing_notes.length > 0) {
    logDebug(`Pulling existing note matching project: ${project_name}.  Note found: ${existing_notes[0].filename}`)
    name = existing_notes[0].filename
    title = existing_notes[0].title
  } else {
    logDebug(`Creating note: ${project_name} in: ${setup.folder}`)
    try {
      name = DataStore.newNote(project_name, setup.folder)
      title = project_name
    } catch (error) {
      logError(`Unable to create new note (${JSON.stringify(error)}`)
    }
  }
  return { note: name, title: title }
}

/**
 * Check the existing Noteplan note and check for tasks.
 * - if closed will add to array to be closed in Todoist
 * - if open, will check to see if Todoist task is closed. Will close in Noteplan if so.  THIS IS NOT CURRENTLY WORKING.
 * - will track list of other open tasks so they are not repeated
 * @param note
 */
function reviewExistingNoteplanTasks(note) {
  // we only need to work on the ones that have a page associated with them
  if ('note' in note) {
    if (note.note) {
      const note_to_check = DataStore.projectNoteByFilename(note.note)
      const paragraphs = note_to_check?.paragraphs
      if (paragraphs) {
        for (let i = 0; i < paragraphs.length; i++) {
          checkParagraph(paragraphs[i])
        }
      }
    }
  }
}

/**
 * Get a list of Todoist projects (lists)
 */
// eslint-disable-next-line require-await
function getTodoistProjects() {
  fetch(`${todo_api}/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${setup.token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      const projects = JSON.parse(response)
      projects.forEach((project) => {
        logDebug(`Project namee: ${project.name} Project ID: ${project.id}`)
        const name = project?.name ? project.name : ''
        if (name === '') {
          logDebug('No existing project note was found was found, will be created')
          process.exit(1)
        }
        console.log(`Working on ${name}`)

        // see if there is an existing note or create it if not
        const note = getExistingNote(name)

        // get the completed tasks in noteplan and close them in todoist
        reviewExistingNoteplanTasks(note)
        closed.forEach(async (t) => {
          await closeTodoistTask(t)
        })

        // grab the tasks and write them out with sections
        const id = project?.id ? project.id : ''
        const note_name = note?.note ? note?.note : ''
        if (id && name) {
          getAndWriteTasks(id, note_name)
        }
      })
    })
    .catch((error) => {
      logError(`Unable to retrieve project list from Todoist (${error})`)
      process.exit(1)
    })
}

/**
 * Close a task in Todoist
 * @param task_id
 * @return {Promise<void>}
 */
// eslint-disable-next-line require-await
async function closeTodoistTask(task_id) {
  //console.log("Closing this one: " + task_id)
  fetch(`${todo_api}/tasks/${task_id}/close`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${setup.token}`,
    },
  }).catch((error) => {
    console.log(`Unable to close task (${task_id}) ${JSON.stringify(error)}`)
  })
}
