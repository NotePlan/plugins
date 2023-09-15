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

import { getFrontMatterAttributes } from '../../helpers/NPFrontMatter'
import { getTodaysDateAsArrowDate, getTodaysDateUnhyphenated } from '../../helpers/dateTime'
import pluginJson from '../plugin.json'
import { log, logInfo, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

const todo_api: string = 'https://api.todoist.com/rest/v2'

// set some defaults that can be changed in settings
const setup: {
  token: string,
  folder: string,
  addDates: boolean,
  addPriorities: boolean,
  addTags: boolean,
  header: string,
  newFolder: any,
  newToken: any,
  syncDates: any,
  syncPriorities: any,
  syncTags: any,
  newHeader: any,
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
  },
}

const closed: Array<any> = []
const just_written: Array<any> = []
const existing: Array<any> = []
const existingHeader: {
  exists: boolean,
  headerExists: any,
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
      DataStore.createFolder(setup.folder)
      logDebug(pluginJson, `New folder has been created (${setup.folder})`)
    } catch (error) {
      logError(pluginJson, `Unable to create new folder (${setup.folder}) in Noteplan (${JSON.stringify(error)})`)
      process.exit(1)
    }
  }

  // get the todoist projects and write out the new ones
  // needs to be broken into smaller functions, but could not get it to return correctly
  const projects: Array<Object> = await getTodoistProjects()

  if (projects.length > 0) {
    for (let i = 0; i < projects.length; i++) {
      // see if there is an existing note or create it if not
      const note_info: ?Object = getExistingNote(projects[i].project_name)
      if (note_info) {
        //console.log(note_info.title)
        const note: ?TNote = DataStore.projectNoteByFilename(note_info.filename)
        //console.log(note?.filename)
        if (note) {
          // get the completed tasks in Noteplan and close them in Todoist
          reviewExistingNoteplanTasks(note)

          // grab the tasks and write them out with sections
          const id: string = projects[i].project_id
          await projectSync(note, id)
        }
      }

      //close the tasks in Todoist if they are complete in Noteplan`
      closed.forEach(async (t) => {
        await closeTodoistTask(t)
      })
    }
  }
  // completed correctly (in theory)
  logDebug(pluginJson, 'Plugin completed without errors')
}

/**
 * Synchronize the current linked project.
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete
 */
// eslint-disable-next-line require-await
export async function syncProject() {
  setSettings()

  const note: ?TNote = Editor.note
  if (note) {
    // check to see if this has any frontmatter
    const frontmatter: ?Object = getFrontMatterAttributes(note)
    clo(frontmatter)
    let check: boolean = true
    if (frontmatter) {
      if ('todoist_id' in frontmatter) {
        logDebug(pluginJson, `Frontmatter has link to Todoist project -> ${frontmatter.todoist_id}`)

        const paragraphs: ?$ReadOnlyArray<TParagraph> = note.paragraphs
        if (paragraphs) {
          paragraphs.forEach((paragraph) => {
            checkParagraph(paragraph)
          })
        }

        await projectSync(note, frontmatter.todoist_id)
  
        //close the tasks in Todoist if they are complete in Noteplan`
        closed.forEach(async (t) => {
          await closeTodoistTask(t)
        })
      } else {
        check = false
      }
    } else {
      check = false
    }
    if (!check) {
      logWarn(pluginJson, 'Current note has no Todoist project linked currently')
    }
  }
}

/**
 * Syncronize all linked projects.
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete
 */
export async function syncAllProjects() {
  setSettings()

  // sync all projects
  await syncThemAll()
}

/**
 * Syncronize all linked projects and today note.  
 * This will check for duplication between the projects and today.
 * 
 * @returns {Promise<void}
 */
export async function syncAllProjectsAndToday() {
  setSettings()

  // sync all projects
  await syncThemAll()

  // sync todays tasks 
  await syncTodayTasks()
}

/**
 * do the actual work of syncronizing all linked projects
 * 
 * @returns {Promise<void>}
 */
async function syncThemAll() {

  const search_string = 'todoist_id:'
  const paragraphs: ?$ReadOnlyArray<TParagraph> = await DataStore.searchProjectNotes(search_string)

  if (paragraphs) {
    for (let i = 0; i < paragraphs.length; i++) {
      const filename = paragraphs[i].filename
      if (filename) {
        logInfo(pluginJson, `Working on note: ${filename}`)
        const note: ?TNote = DataStore.projectNoteByFilename(filename)

        if (note) {
          const paragraphs_to_check: $ReadOnlyArray<TParagraph> = note?.paragraphs
          if (paragraphs_to_check) {
            paragraphs_to_check.forEach((paragraph_to_check) => {
              checkParagraph(paragraph_to_check)
            })
          }

          // get the ID
          let id: string = paragraphs[i].content.split(':')[1]
          id = id.trim()

          logInfo(pluginJson, `Matches up to Todoist project id: ${id}`)
          await projectSync(note, id)
   
          //close the tasks in Todoist if they are complete in Noteplan`
          closed.forEach(async (t) => {
            await closeTodoistTask(t)
          })
        } else {
          logError(pluginJson, `Unable to open note asked requested by script (${filename})`)
        }
      } else {
        logError(pluginJson, `Unable to find filename associated with search results`)
      }
    }
  } else {
    logInfo(pluginJson, `No results found in notes for term: todoist_id.  Make sure frontmatter is set according to plugin instructions`)
  }
}

/**
 * Synchronize tasks for today.
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete.
 */
// eslint-disable-next-line require-await
export async function syncToday() {
  setSettings()
  
  // sync today tasks
  await syncTodayTasks()
}

/**
 * Do the actual work of getting and syncing today tasks
 * 
 * @returns {Promise<void>}
 */
async function syncTodayTasks() {
  console.log(existing)
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
   // check to see if that heading already exists and tab what tasks already exist
   const paragraphs: ?$ReadOnlyArray<TParagraph> = note?.paragraphs
   if (paragraphs) {
     paragraphs.forEach((paragraph) => {
       checkParagraph(paragraph)
     })
   }

   logInfo(pluginJson, `Todays note was found, pulling Today Todoist tasks...`)
   const response = await pullTodoistTasksForToday()
   const tasks: Array<Object> = JSON.parse(response)

   if (tasks.length > 0 && note) {
     for (let i = 0; i < tasks.length; i++) {
       await writeOutTask(note, tasks[i])
     }

     //close the tasks in Todoist if they are complete in Noteplan`
     closed.forEach(async (t) => {
       await closeTodoistTask(t)
     })
   }
 } 
}

/**
 * Get Todoist project tasks and write them out one by one
 * 
 * @param {TNote} note - note that will be written to
 * @param {string} id - Todoist project ID
 * @returns {Promise<void>}
 */
async function projectSync(note: TNote, id: string): Promise<void> {
  console.log(`ID is ${id}`)
  const task_result = await pullTodoistTasksByProject(id)
  console.log(task_result)
  const tasks: Array<Object> = JSON.parse(task_result)
  for (let j = 0; j < tasks.length; j++) {
    await writeOutTask(note, tasks[j])
  }
}

/**
 * Pull todoist tasks from list matching the ID provided
 *
 * @param {string} project_id - the id of the Todoist project
 * @returns {Promise<any>} - promise that resolves into array of task objects or null
 */
async function pullTodoistTasksByProject(project_id: string): Promise<any> {
  if (project_id !== '') {
    const result = await fetch(`${todo_api}/tasks?project_id=${project_id}`, getRequestObject())
    return result
  }
  return null
}

/**
 * Pull todoist tasks with a due date of today
 *
 * @returns {Promise<any>} - promise that resolves into array of task objects or null
 */
async function pullTodoistTasksForToday(): Promise<any> {
  const result = await fetch(`${todo_api}/tasks?filter=today`, getRequestObject())
  if (result) {
    return result
  }
  return null
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
      fetch(`${todo_api}/tasks/${found[1]}`, getRequestObject()).then((task_info: Object) => {
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
function formatTaskDetails(task: Object): string {
  let task_write: string = ''

  // get the priority
  let priorities: string = ''
  if (setup.addPriorities) {
    if (task.priority === 4) {
      priorities = '!!! '
    } else if (task.priority === 3) {
      priorities = '!! '
    } else if (task.priority === 2) {
      priorities = '! '
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
 * Format and write task to correct noteplan note
 *
 * @param {TNote} note - the note object that will get the task
 * @param {Object} task - the task object that will be written
 */
async function writeOutTask(note: TNote, task: Object) {
  if (note) {
    //console.log(note.content)
    //console.log(task.content)
    const formatted = formatTaskDetails(task)
    if (task.section_id !== null) {
      let section = await fetch(`${todo_api}/sections/${task.section_id}`, getRequestObject())
      section = JSON.parse(section)
      if (section) {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `Task will be added Noteplan (${task.id})`)
          note.addTodoBelowHeadingTitle(formatted, section.name, true, true)
          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        } else {
          logInfo(pluginJson, `Task is already in Noteplan ${task.id}`)
        }
      } else {
        // this one has a section ID but Todoist will not return a name
        // Put it in with no heading
        logWarn(pluginJson, `Section ID ${task.section_id} did not return a section name`)
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `Task will be added to Noteplan (${task.id})`)
          note.appendTodo(formatted)
          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        } else {
          logInfo(pluginJson, `Task is already in Noteplan (${task.id})`)
        }
      }
    } else {
      // check for a default heading
      // if there is a predefined header in settings
      if (setup.header !== '') {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `Adding task form Todoist to Note`)
          note?.addTodoBelowHeadingTitle(formatted, setup.header, true, true)
          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        }
      } else {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `Task will be added to Noteplan (${task.id})`)
          note.appendTodo(formatted)
          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        }
      }
    }
  }
}

/**
 * Create the fetch parameters for a GET operation
 *
 * @returns {Object}
 */
function getRequestObject() {
  const obj: Object = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${setup.token}`,
      'Content-Type': 'application/json',
    },
  }
  return obj
}

/**
 * Create the fetch parameters for a POST operation
 *
 * @returns {Object}
 */
function postRequestObject() {
  const obj: Object = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${setup.token}`,
    },
  }
  return obj
}

/**
 * Will search Noteplan in the set folder for a note that matches the Todoist project name.
 * Will create if it does not exist
 * @param {string} project_name
 * @return {Object}
 */
function getExistingNote(project_name: string): Object {
  let filename = ''
  const existing_notes = DataStore.projectNotes.filter((n) => n.filename.startsWith(`${setup.folder}/${project_name}`))
  if (existing_notes.length > 0) {
    logDebug(pluginJson, `Pulling existing note matching project: ${project_name}.  Note found: ${existing_notes[0].filename}`)
    filename = existing_notes[0].filename
  } else {
    logDebug(pluginJson, `Creating note: ${project_name} in: ${setup.folder}`)
    try {
      filename = DataStore.newNote(project_name, setup.folder)
    } catch (error) {
      logError(pluginJson, `Unable to create new note (${JSON.stringify(error)}`)
    }
  }
  return { filename: filename }
}

/**
 * Review existing tasks in Noteplan.
 *
 * @param {TNote} note - The note to review tasks for.
 * @returns {void}
 */
function reviewExistingNoteplanTasks(note: TNote) {
  // we only need to work on the ones that have a page associated with them
  const paragraphs: $ReadOnlyArray<TParagraph> = note.paragraphs ?? []
  if (paragraphs) {
    paragraphs.forEach((paragraph) => {
      checkParagraph(paragraph)
    })
  }
}

/**
 * Get Todoist projects and synchronize tasks.
 *
 * @returns {Array<Object>}
 */
async function getTodoistProjects() {
  const project_list = []
  const results = await fetch(`${todo_api}/projects`, getRequestObject())
  const projects: ?Array<Object> = JSON.parse(results)
  if (projects) {
    projects.forEach((project) => {
      logDebug(pluginJson, `Project name: ${project.name} Project ID: ${project.id}`)
      project_list.push({ project_name: project.name, project_id: project.id })
    })
  }
  return project_list
}

/**
 * Close a Todoist task.
 *
 * @param {string} task_id - The ID of the task to close.
 * @returns {Promise<void>} A promise that resolves once the task is closed.
 */
async function closeTodoistTask(task_id: string) {
  try {
    await fetch(`${todo_api}/tasks/${task_id}/close`, postRequestObject())
  } catch (error) {
    logError(pluginJson, `Unable to close task (${task_id}) ${JSON.stringify(error)}`)
  }
}
