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

import { getFrontmatterAttributes } from '../../helpers/NPFrontMatter'
import { getTodaysDateAsArrowDate, getTodaysDateUnhyphenated } from '../../helpers/dateTime'
import pluginJson from '../plugin.json'
import { log, logInfo, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

const todo_api: string = 'https://api.todoist.com/api/v1'

// set some defaults that can be changed in settings
const setup: {
  token: string,
  folder: string,
  addDates: boolean,
  addPriorities: boolean,
  addTags: boolean,
  teamAccount: boolean,
  addUnassigned: boolean,
  header: string,
  projectSeparator: string,
  sectionFormat: string,
  newFolder: any,
  newToken: any,
  useTeamAccount: any,
  syncDates: any,
  syncPriorities: any,
  syncTags: any,
  syncUnassigned: any,
  newHeader: any,
  newProjectSeparator: any,
  newSectionFormat: any,
} = {
  token: '',
  folder: 'Todoist',
  addDates: false,
  addPriorities: false,
  addTags: false,
  teamAccount: false,
  addUnassigned: false,
  header: '',
  projectSeparator: '### Project Name',
  sectionFormat: '#### Section',

  /**
   * @param {string} passedToken
   */
  set newToken(passedToken: string) {
    setup.token = passedToken
  },
  /**
   * @param {string} passedFolder
   */
  set newFolder(passedFolder: string) {
    // remove leading and tailing slashes
    passedFolder = passedFolder.replace(/\/+$/, '')
    passedFolder = passedFolder.replace(/^\/+/, '')
    this.folder = passedFolder
  },
  /**
   * @param {boolean} passedSyncDates
   */
  set syncDates(passedSyncDates: boolean) {
    setup.addDates = passedSyncDates
  },
  /**
   * @param {boolean} passedSyncPriorities
   */
  set syncPriorities(passedSyncPriorities: true) {
    setup.addPriorities = passedSyncPriorities
  },
  /**
   * @param {boolean} passedSyncTags
   */
  set syncTags(passedSyncTags: boolean) {
    setup.addTags = passedSyncTags
  },
  /**
   * @param {boolean} passedTeamAccount
   */
  set teamAccount(passedTeamAccount: boolean) {
    this.useTeamAccount = passedTeamAccount
  },
  /**
   * @param {boolean} passedSyncUnassigned
   */
  set syncUnassigned(passedSyncUnassigned: boolean) {
    this.addUnassigned = passedSyncUnassigned
  },
  /**
   * @param {string} passedHeader
   */
  set newHeader(passedHeader: string) {
    setup.header = passedHeader
  },
  /**
   * @param {string} passedProjectSeparator
   */
  set newProjectSeparator(passedProjectSeparator: string) {
    setup.projectSeparator = passedProjectSeparator
  },
  /**
   * @param {string} passedSectionFormat
   */
  set newSectionFormat(passedSectionFormat: string) {
    setup.sectionFormat = passedSectionFormat
  },
}

const closed: Array<any> = []
const just_written: Array<any> = []
const existing: Array<any> = []
const existingHeader: {
  exists: boolean,
  headerExists: string | boolean,
} = {
  exists: false,
  /**
   * @param {boolean} passedHeaderExists
   */
  set headerExists(passedHeaderExists: string) {
    existingHeader.exists = !!passedHeaderExists
  },
}

/**
 * Parse project IDs from a frontmatter value that could be:
 * - A single string ID: "12345"
 * - A JSON array string: '["12345", "67890"]'
 * - A native array: ["12345", "67890"]
 *
 * @param {any} value - The frontmatter value
 * @returns {Array<string>} Array of project IDs
 */
function parseProjectIds(value: any): Array<string> {
  if (!value) return []

  // Already an array
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim())
  }

  // String value - could be single ID or JSON array
  const strValue = String(value).trim()

  // Check if it looks like a JSON array
  if (strValue.startsWith('[') && strValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(strValue)
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id).trim())
      }
    } catch (e) {
      logWarn(pluginJson, `Failed to parse JSON array from frontmatter: ${strValue}`)
    }
  }

  // Single ID
  return [strValue]
}

/**
 * Fetch the project name from Todoist API
 *
 * @param {string} projectId - The Todoist project ID
 * @returns {Promise<string>} The project name or a fallback
 */
async function getProjectName(projectId: string): Promise<string> {
  try {
    const result = await fetch(`${todo_api}/projects/${projectId}`, getRequestObject())
    const project = JSON.parse(result)
    return project?.name ?? `Project ${projectId}`
  } catch (error) {
    logWarn(pluginJson, `Unable to fetch project name for ${projectId}`)
    return `Project ${projectId}`
  }
}

/**
 * Get the heading level (number of #) from the project separator setting
 *
 * @returns {number} The heading level (2, 3, or 4), or 0 for non-heading separators
 */
function getProjectHeadingLevel(): number {
  const separator = setup.projectSeparator
  if (separator === '## Project Name') return 2
  if (separator === '### Project Name') return 3
  if (separator === '#### Project Name') return 4
  return 0 // Horizontal Rule or No Separator
}

/**
 * Generate a heading prefix with the specified level
 *
 * @param {number} level - The heading level (2, 3, 4, 5, etc.)
 * @returns {string} The heading prefix (e.g., "###")
 */
function getHeadingPrefix(level: number): string {
  return '#'.repeat(level)
}

/**
 * Add a project separator to the note based on settings
 *
 * @param {TNote} note - The note to add the separator to
 * @param {string} projectName - The name of the project
 * @param {boolean} isEditorNote - Whether to use Editor.appendParagraph
 * @returns {number} The heading level used (0 if no heading)
 */
function addProjectSeparator(note: TNote, projectName: string, isEditorNote: boolean = false): number {
  const separator = setup.projectSeparator
  let content = ''
  const headingLevel = getProjectHeadingLevel()

  if (separator === 'No Separator') {
    return 0
  } else if (separator === 'Horizontal Rule') {
    content = '---'
  } else if (headingLevel > 0) {
    content = `${getHeadingPrefix(headingLevel)} ${projectName}`
  }

  if (content) {
    if (isEditorNote) {
      Editor.appendParagraph(content, 'text')
    } else {
      note.appendParagraph(content, 'text')
    }
  }
  return headingLevel
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
 * Synchronize the current linked project (supports both single and multiple projects).
 *
 * @returns {Promise<void>} A promise that resolves once synchronization is complete
 */
// eslint-disable-next-line require-await
export async function syncProject() {
  setSettings()
  const note: ?TNote = Editor.note
  if (!note) return

  // check to see if this has any frontmatter
  const frontmatter: ?Object = getFrontmatterAttributes(note)
  clo(frontmatter)
  if (!frontmatter) {
    logWarn(pluginJson, 'Current note has no frontmatter')
    return
  }

  // Check existing tasks in the note
  const paragraphs: ?$ReadOnlyArray<TParagraph> = note.paragraphs
  if (paragraphs) {
    paragraphs.forEach((paragraph) => {
      checkParagraph(paragraph)
    })
  }

  // Determine project IDs to sync (support both single and multiple)
  // Check todoist_ids first (plural), then todoist_id (singular)
  // Both can contain either a single ID or a JSON array string
  let projectIds: Array<string> = []

  if ('todoist_ids' in frontmatter) {
    projectIds = parseProjectIds(frontmatter.todoist_ids)
    logDebug(pluginJson, `Found todoist_ids: ${projectIds.join(', ')}`)
  } else if ('todoist_id' in frontmatter) {
    projectIds = parseProjectIds(frontmatter.todoist_id)
    logDebug(pluginJson, `Found todoist_id: ${projectIds.join(', ')}`)
  }

  if (projectIds.length === 0) {
    logWarn(pluginJson, 'No valid todoist_id or todoist_ids found in frontmatter')
    return
  }

  // Sync each project
  const isMultiProject = projectIds.length > 1
  for (const projectId of projectIds) {
    let multiProjectContext: ?MultiProjectContext = null

    if (isMultiProject) {
      const projectName = await getProjectName(projectId)
      const headingLevel = addProjectSeparator(note, projectName, true)

      multiProjectContext = {
        projectName: projectName,
        projectHeadingLevel: headingLevel,
        isMultiProject: true,
        isEditorNote: true,
      }
    }

    await projectSync(note, projectId, multiProjectContext)
  }

  // Close completed tasks in Todoist
  for (const t of closed) {
    await closeTodoistTask(t)
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
  // Search for both frontmatter formats and collect unique notes
  const found_notes: Map<string, TNote> = new Map()

  for (const search_string of ['todoist_id:', 'todoist_ids:']) {
    const paragraphs: ?$ReadOnlyArray<TParagraph> = await DataStore.searchProjectNotes(search_string)
    if (paragraphs) {
      for (const p of paragraphs) {
        if (p.filename && !found_notes.has(p.filename)) {
          const note = DataStore.projectNoteByFilename(p.filename)
          if (note) {
            found_notes.set(p.filename, note)
          }
        }
      }
    }
  }

  if (found_notes.size === 0) {
    logInfo(pluginJson, 'No results found in notes for todoist_id or todoist_ids. Make sure frontmatter is set according to plugin instructions')
    return
  }

  for (const [filename, note] of found_notes) {
    logInfo(pluginJson, `Working on note: ${filename}`)

    // Check existing paragraphs for task state
    const paragraphs_to_check: $ReadOnlyArray<TParagraph> = note?.paragraphs ?? []
    if (paragraphs_to_check) {
      paragraphs_to_check.forEach((paragraph_to_check) => {
        checkParagraph(paragraph_to_check)
      })
    }

    // Parse frontmatter to get project IDs
    const frontmatter: ?Object = getFrontmatterAttributes(note)
    if (!frontmatter) {
      logWarn(pluginJson, `Note ${filename} has no frontmatter, skipping`)
      continue
    }

    let projectIds: Array<string> = []

    if ('todoist_ids' in frontmatter) {
      projectIds = parseProjectIds(frontmatter.todoist_ids)
      logDebug(pluginJson, `Found todoist_ids in ${filename}: ${projectIds.join(', ')}`)
    } else if ('todoist_id' in frontmatter) {
      projectIds = parseProjectIds(frontmatter.todoist_id)
      logDebug(pluginJson, `Found todoist_id in ${filename}: ${projectIds.join(', ')}`)
    }

    if (projectIds.length === 0) {
      logWarn(pluginJson, `Note ${filename} has no valid todoist_id or todoist_ids, skipping`)
      continue
    }

    // Sync each project
    const isMultiProject = projectIds.length > 1
    for (const projectId of projectIds) {
      let multiProjectContext: ?MultiProjectContext = null

      if (isMultiProject) {
        const projectName = await getProjectName(projectId)
        const headingLevel = addProjectSeparator(note, projectName, false)

        multiProjectContext = {
          projectName: projectName,
          projectHeadingLevel: headingLevel,
          isMultiProject: true,
          isEditorNote: false,
        }
      }

      logInfo(pluginJson, `Syncing Todoist project id: ${projectId}`)
      await projectSync(note, projectId, multiProjectContext)
    }

    // Close the tasks in Todoist if they are complete in Noteplan
    for (const t of closed) {
      await closeTodoistTask(t)
    }
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

    if (tasks.results && note) {
      tasks.results.forEach(async (t) => {
        await writeOutTask(note, t)
      })

      // close the tasks in Todoist if they are complete in Noteplan`
      closed.forEach(async (t) => {
        await closeTodoistTask(t)
      })
    }
  }
}

/**
 * Multi-project context for organizing tasks under project headings
 */
type MultiProjectContext = {
  projectName: string,
  projectHeadingLevel: number,
  isMultiProject: boolean,
  isEditorNote: boolean,
}

/**
 * Fetch all sections for a project from Todoist
 *
 * @param {string} projectId - The Todoist project ID
 * @returns {Promise<Map<string, string>>} Map of section ID to section name
 */
async function fetchProjectSections(projectId: string): Promise<Map<string, string>> {
  const sectionMap: Map<string, string> = new Map()
  try {
    const result = await fetch(`${todo_api}/sections?project_id=${projectId}`, getRequestObject())
    const parsed = JSON.parse(result)

    // Handle both array and {results: [...]} formats
    const sections = Array.isArray(parsed) ? parsed : (parsed.results || [])

    if (sections && Array.isArray(sections)) {
      sections.forEach((section) => {
        if (section.id && section.name) {
          sectionMap.set(section.id, section.name)
        }
      })
    }
    logDebug(pluginJson, `Found ${sectionMap.size} sections for project ${projectId}`)
  } catch (error) {
    logWarn(pluginJson, `Failed to fetch sections for project ${projectId}: ${String(error)}`)
  }
  return sectionMap
}

/**
 * Add a section heading under a project heading
 *
 * @param {TNote} note - The note to add the heading to
 * @param {string} sectionName - The section name
 * @param {number} projectHeadingLevel - The project heading level
 * @param {boolean} isEditorNote - Whether to use Editor.appendParagraph
 */
function addSectionHeading(note: TNote, sectionName: string, projectHeadingLevel: number, isEditorNote: boolean = false): void {
  // Use the sectionFormat setting to determine how to format section headings
  const format = setup.sectionFormat
  let content = ''

  if (format === '### Section') {
    content = `### ${sectionName}`
  } else if (format === '#### Section') {
    content = `#### ${sectionName}`
  } else if (format === '##### Section') {
    content = `##### ${sectionName}`
  } else if (format === '**Section**') {
    content = `**${sectionName}**`
  } else {
    // Fallback: one level deeper than project heading
    const sectionLevel = projectHeadingLevel + 1
    content = `${getHeadingPrefix(sectionLevel)} ${sectionName}`
  }

  if (isEditorNote) {
    Editor.appendParagraph(content, 'text')
  } else {
    note.appendParagraph(content, 'text')
  }
}

/**
 * Get Todoist project tasks and write them out organized by sections
 *
 * @param {TNote} note - note that will be written to
 * @param {string} id - Todoist project ID
 * @param {?MultiProjectContext} multiProjectContext - context for multi-project mode
 * @returns {Promise<void>}
 */
async function projectSync(note: TNote, id: string, multiProjectContext: ?MultiProjectContext = null): Promise<void> {
  const task_result = await pullTodoistTasksByProject(id)
  const tasks: Array<Object> = JSON.parse(task_result)

  if (!tasks.results || tasks.results.length === 0) {
    logInfo(pluginJson, `No tasks found for project ${id}`)
    return
  }

  // If in multi-project mode with a valid heading level, organize by sections
  if (multiProjectContext && multiProjectContext.isMultiProject && multiProjectContext.projectHeadingLevel > 0) {
    // Fetch all sections for this project
    const sectionMap = await fetchProjectSections(id)

    // Group tasks by section
    const tasksBySection: Map<string, Array<Object>> = new Map()
    const tasksWithoutSection: Array<Object> = []

    for (const task of tasks.results) {
      if (task.section_id && sectionMap.has(task.section_id)) {
        const sectionName = sectionMap.get(task.section_id) ?? ''
        if (!tasksBySection.has(sectionName)) {
          tasksBySection.set(sectionName, [])
        }
        tasksBySection.get(sectionName)?.push(task)
      } else {
        tasksWithoutSection.push(task)
      }
    }

    logDebug(pluginJson, `Organized ${tasks.results.length} tasks: ${tasksWithoutSection.length} without section, ${tasksBySection.size} sections`)

    const isEditorNote = multiProjectContext.isEditorNote

    // Write tasks without sections first (directly under project heading)
    for (const task of tasksWithoutSection) {
      await writeOutTaskSimple(note, task, isEditorNote)
    }

    // Write each section with its tasks
    for (const [sectionName, sectionTasks] of tasksBySection) {
      // Add section heading
      addSectionHeading(note, sectionName, multiProjectContext.projectHeadingLevel, isEditorNote)

      // Write tasks under this section
      for (const task of sectionTasks) {
        await writeOutTaskSimple(note, task, isEditorNote)
      }
    }
  } else {
    // Original behavior for single project or non-heading separators
    for (const t of tasks.results) {
      await writeOutTask(note, t)
    }
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
    let filter = ''
    if (setup.useTeamAccount) {
      if (setup.addUnassigned) {
        filter = '& filter=!assigned to: others'
      } else {
        filter = '& filter=assigned to: me'
      }
    }
    const result = await fetch(`${todo_api}/tasks?project_id=${project_id}${filter}`, getRequestObject())
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
  let filter = '?filter=today'
  if (setup.useTeamAccount) {
    if (setup.addUnassigned) {
      filter = `${filter} & !assigned to: others`
    } else {
      filter = `${filter} & assigned to: me`
    }
  }
  const result = await fetch(`${todo_api}/tasks${filter}`, getRequestObject())
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
    logDebug(pluginJson, `Done or Cancelled Task content: ${content}`)

    // close these ones in Todoist if they are closed in Noteplan and are todoist tasks
    const found: ?Array<string> = content.match(/app\/task\/(.*?)\)/)
    if (found && found.length > 1) {
      logInfo(pluginJson, `Todoist ID found in Noteplan note (${found[1]})`)
      closed.push(found[1])
      // add to existing as well so they do not get rewritten if the timing on closing them is slow
      existing.push(found[1])
    }
  } else if (paragraph.type === 'open') {
    const content: string = paragraph.content
    logDebug(pluginJson, `Open Task content: ${content}`)
    const found: ?Array<string> = content.match(/app\/task\/(.*?)\)/)
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
  task_write = `${task_write}[^](https://app.todoist.com/app/task/${task.id})`

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
  logDebug(pluginJson, JSON.stringify(settings))

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

    if ('teamAccount' in settings) {
      setup.useTeamAccount = settings.teamAccount
    }

    if ('syncUnassigned' in settings) {
      setup.syncUnassigned = settings.syncUnassigned
    }

    if ('headerToUse' in settings && settings.headerToUse !== '') {
      setup.newHeader = settings.headerToUse
    }

    if ('projectSeparator' in settings && settings.projectSeparator !== '') {
      setup.newProjectSeparator = settings.projectSeparator
    }

    if ('sectionFormat' in settings && settings.sectionFormat !== '') {
      setup.newSectionFormat = settings.sectionFormat
    }
  }
}

/**
 * Safely add a todo below a heading, falling back to append if heading not found
 *
 * @param {TNote} note - The note to add the task to
 * @param {string} formatted - The formatted task text
 * @param {string} headingName - The heading to add below
 * @returns {boolean} True if task was added successfully
 */
function safeAddTodoBelowHeading(note: TNote, formatted: string, headingName: string): boolean {
  try {
    note.addTodoBelowHeadingTitle(formatted, headingName, true, true)
    return true
  } catch (error) {
    logWarn(pluginJson, `Heading "${headingName}" not found, appending task to end of note`)
    note.appendTodo(formatted)
    return true
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
    logDebug(pluginJson, task)
    const formatted = formatTaskDetails(task)
    if (task.section_id !== null) {
      let section = await fetch(`${todo_api}/sections/${task.section_id}`, getRequestObject())
      section = JSON.parse(section)
      if (section) {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `1. Task will be added to ${note.title} below ${section.name} (${formatted})`)
          safeAddTodoBelowHeading(note, formatted, section.name)

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
          logInfo(pluginJson, `2. Task will be added to ${note.title} (${formatted})`)
          note.appendTodo(formatted)

          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        } else {
          logInfo(pluginJson, `Task is already in Noteplan (${formatted})`)
        }
      }
    } else {
      // check for a default heading
      // if there is a predefined header in settings
      if (setup.header !== '') {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `3. Task will be added to ${note.title} below ${setup.header} (${formatted})`)
          safeAddTodoBelowHeading(note, formatted, setup.header)

          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        }
      } else {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `4. Task will be added to ${note.title} (${formatted})`)
          note.appendTodo(formatted)

          // add to just_written so they do not get duplicated in the Today note when updating all projects and today
          just_written.push(task.id)
        }
      }
    }
  }
}

/**
 * Simple task writer for multi-project mode - just appends tasks without section logic
 * (section organization is handled by projectSync in multi-project mode)
 *
 * @param {TNote} note - the note object that will get the task
 * @param {Object} task - the task object that will be written
 * @param {boolean} useEditor - whether to use Editor.appendParagraph
 */
async function writeOutTaskSimple(note: TNote, task: Object, useEditor: boolean = false) {
  if (!note) return

  logDebug(pluginJson, task)
  const formatted = formatTaskDetails(task)

  if (!existing.includes(task.id) && !just_written.includes(task.id)) {
    logInfo(pluginJson, `Task will be added to ${note.title}: ${formatted}`)

    if (useEditor) {
      Editor.appendParagraph(`- ${formatted}`, 'text')
    } else {
      note.appendTodo(formatted)
    }

    // add to just_written so they do not get duplicated
    just_written.push(task.id)
  } else {
    logInfo(pluginJson, `Task is already in Noteplan: ${task.id}`)
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
    logInfo(pluginJson, `Closed task (${task_id}) in Todoist`)
  } catch (error) {
    logError(pluginJson, `Unable to close task (${task_id}) ${JSON.stringify(error)}`)
  }
}
