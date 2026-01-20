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
import { findHeading } from '../../helpers/paragraph'
import pluginJson from '../plugin.json'
import { log, logInfo, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

const todo_api: string = 'https://api.todoist.com/api/v1'

/**
 * Parse YAML array values from a note's frontmatter paragraphs
 * Handles format like:
 *   todoist_id:
 *     - abc123
 *     - def456
 *
 * @param {TNote} note - The note to parse
 * @param {string} key - The frontmatter key to look for (e.g., 'todoist_id')
 * @returns {Array<string>} Array of values, or empty array if not found
 */
function parseYamlArrayFromNote(note: TNote, key: string): Array<string> {
  const paragraphs = note?.paragraphs ?? []
  const values: Array<string> = []
  let inFrontmatter = false
  let foundKey = false

  logDebug(pluginJson, `parseYamlArrayFromNote: Parsing ${paragraphs.length} paragraphs for key '${key}'`)

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const content = para.content ?? ''
    const rawContent = para.rawContent ?? ''

    // Log first 15 paragraphs to see frontmatter structure
    if (i < 15) {
      logDebug(pluginJson, `  Para[${i}]: type=${para.type}, content="${content.substring(0, 60)}", raw="${rawContent.substring(0, 60)}"`)
    }

    // Track frontmatter boundaries
    if (content === '---' || rawContent === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        logDebug(pluginJson, `  -> Entered frontmatter at para ${i}`)
        continue
      } else {
        logDebug(pluginJson, `  -> Exited frontmatter at para ${i}`)
        break
      }
    }

    if (!inFrontmatter) continue

    // Check if this line starts the key we're looking for (todoist_id or todoist_ids)
    const keyMatch = content.match(new RegExp(`^(${key}s?):(.*)$`))
    if (keyMatch) {
      foundKey = true
      logDebug(pluginJson, `  -> Found key '${keyMatch[1]}' at para ${i}`)
      // Check if there's a value on the same line
      const inlineValue = keyMatch[2].trim()
      if (inlineValue && !inlineValue.startsWith('-')) {
        values.push(inlineValue)
        foundKey = false
      }
      continue
    }

    // If we found the key, look for array items
    if (foundKey) {
      // NotePlan converts YAML "- item" to "* item" (list type)
      // The content is already just the value without the bullet
      if (para.type === 'list' && content.trim()) {
        const value = content.trim()
        logDebug(pluginJson, `  -> Found list item: "${value}"`)
        values.push(value)
        continue
      }

      // Also check for YAML array item in text format (dash or asterisk)
      const arrayItemMatch = content.match(/^\s*[-*]\s*(.+)$/) || rawContent.match(/^\s*[-*]\s*(.+)$/)
      if (arrayItemMatch) {
        const value = arrayItemMatch[1].trim()
        logDebug(pluginJson, `  -> Found array item: "${value}"`)
        values.push(value)
        continue
      }

      // If we hit another key (something:), we're done with this array
      if (content.match(/^\w+:/)) {
        logDebug(pluginJson, `  -> Hit new key, ending array search`)
        foundKey = false
      }
    }
  }

  logDebug(pluginJson, `parseYamlArrayFromNote: Found ${values.length} values for key '${key}': ${values.join(', ')}`)
  return values
}

/**
 * Get a single frontmatter value from note paragraphs (handles YAML format)
 *
 * @param {TNote} note - The note to parse
 * @param {string} key - The frontmatter key to look for
 * @returns {?string} The value or null if not found
 */
function getFrontmatterValueFromNote(note: TNote, key: string): ?string {
  const paragraphs = note?.paragraphs ?? []
  let inFrontmatter = false

  for (const para of paragraphs) {
    const content = para.content ?? ''

    if (content === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      } else {
        break
      }
    }

    if (!inFrontmatter) continue

    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`))
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

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
  projectDateFilter: string,
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
  newProjectDateFilter: any,
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
  projectDateFilter: 'overdue | today',
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
   * @param {string} passedProjectDateFilter
   */
  set newProjectDateFilter(passedProjectDateFilter: string) {
    setup.projectDateFilter = passedProjectDateFilter
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
 * Multi-project context for organizing tasks under project headings
 */
type MultiProjectContext = {
  projectName: string,
  projectHeadingLevel: number,
  isMultiProject: boolean,
  isEditorNote: boolean,
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
 * Resolve project names to IDs by fetching all projects and matching.
 * Supports exact match and case-insensitive matching as a fallback.
 *
 * @param {Array<string>} names - Array of project names to resolve
 * @returns {Promise<Array<string>>} Array of project IDs (may be shorter if some names not found)
 */
async function resolveProjectNamesToIds(names: Array<string>): Promise<Array<string>> {
  const projects = await getTodoistProjects()
  const ids: Array<string> = []

  for (const name of names) {
    // Try exact match first
    let match = projects.find((p) => p.project_name === name)
    // Fall back to case-insensitive
    if (!match) {
      match = projects.find((p) => p.project_name.toLowerCase() === name.toLowerCase())
    }
    if (match) {
      logDebug(pluginJson, `Resolved project name "${name}" to ID: ${match.project_id}`)
      ids.push(match.project_id)
    } else {
      logWarn(pluginJson, `No Todoist project found matching: "${name}"`)
    }
  }
  return ids
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
      Editor.insertTextAtCursor(`${content}\n`)
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
          await projectSync(note, id, null, null)
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
 * Parse the date filter argument from command line
 *
 * @param {string} arg - the argument passed to the command
 * @returns {string | null} - the filter string or null if no override
 */
function parseDateFilterArg(arg: ?string): ?string {
  if (!arg || arg.trim() === '') {
    return null
  }
  const trimmed = arg.trim().toLowerCase()
  if (trimmed === 'today') {
    return 'today'
  } else if (trimmed === 'overdue') {
    return 'overdue'
  } else if (trimmed === 'current') {
    return 'overdue | today'
  } else if (trimmed === '3 days') {
    return '3 days'
  } else if (trimmed === '7 days') {
    return '7 days'
  } else if (trimmed === 'all') {
    return 'all'
  }
  logWarn(pluginJson, `Unknown date filter argument: ${arg}. Using setting value.`)
  return null
}

/**
 * Synchronize the current linked project (supports both single and multiple projects).
 *
 * @param {string} filterArg - optional date filter override (today, overdue, current)
 * @returns {Promise<void>} A promise that resolves once synchronization is complete
 */
// eslint-disable-next-line require-await
export async function syncProject(filterArg: ?string) {
  setSettings()
  const commandLineFilter = parseDateFilterArg(filterArg)
  if (commandLineFilter) {
    logInfo(pluginJson, `Using command-line filter override: ${commandLineFilter}`)
  }

  const note: ?TNote = Editor.note
  if (!note) return

  // check to see if this has any frontmatter
  const frontmatter: ?Object = getFrontmatterAttributes(note)
  clo(frontmatter)
  if (!frontmatter) {
    logWarn(pluginJson, 'Current note has no frontmatter')
    return
  }

  // Determine filter priority: command-line > frontmatter > settings
  let filterOverride = commandLineFilter
  if (!filterOverride) {
    // Try standard frontmatter first, then YAML parsing
    const fmFilter = frontmatter.todoist_filter ?? getFrontmatterValueFromNote(note, 'todoist_filter')
    if (fmFilter) {
      filterOverride = parseDateFilterArg(fmFilter)
      if (filterOverride) {
        logInfo(pluginJson, `Using frontmatter filter: ${filterOverride}`)
      }
    }
  }

  // Check existing tasks in the note
  const paragraphs: ?$ReadOnlyArray<TParagraph> = note.paragraphs
  if (paragraphs) {
    paragraphs.forEach((paragraph) => {
      checkParagraph(paragraph)
    })
  }

  // Determine project IDs to sync (support both single and multiple)
  // Priority: project names first, then IDs (for backward compatibility)
  // Supports: single name/ID, JSON array, or YAML array format
  let projectIds: Array<string> = []

  // Try project name-based lookup first (new user-friendly approach)
  let projectNames: Array<string> = []
  if ('todoist_project_names' in frontmatter && frontmatter.todoist_project_names) {
    projectNames = parseProjectIds(frontmatter.todoist_project_names) // reuse array parsing
    logDebug(pluginJson, `Found todoist_project_names from frontmatter: ${projectNames.join(', ')}`)
  } else if ('todoist_project_name' in frontmatter && frontmatter.todoist_project_name) {
    projectNames = parseProjectIds(frontmatter.todoist_project_name)
    logDebug(pluginJson, `Found todoist_project_name from frontmatter: ${projectNames.join(', ')}`)
  }

  // Try YAML array format for project names if standard parsing failed
  if (projectNames.length === 0) {
    projectNames = parseYamlArrayFromNote(note, 'todoist_project_name')
    if (projectNames.length > 0) {
      logDebug(pluginJson, `Found todoist_project_name(s) from YAML array: ${projectNames.join(', ')}`)
    }
  }

  // Resolve project names to IDs if found
  if (projectNames.length > 0) {
    projectIds = await resolveProjectNamesToIds(projectNames)
  }

  // Fall back to ID-based lookup (backward compatible)
  if (projectIds.length === 0) {
    // Try standard frontmatter parsing first
    if ('todoist_ids' in frontmatter && frontmatter.todoist_ids) {
      projectIds = parseProjectIds(frontmatter.todoist_ids)
      logDebug(pluginJson, `Found todoist_ids from frontmatter: ${projectIds.join(', ')}`)
    } else if ('todoist_id' in frontmatter && frontmatter.todoist_id) {
      projectIds = parseProjectIds(frontmatter.todoist_id)
      logDebug(pluginJson, `Found todoist_id from frontmatter: ${projectIds.join(', ')}`)
    }

    // If standard parsing failed, try YAML array format from raw paragraphs
    if (projectIds.length === 0) {
      logDebug(pluginJson, 'Standard frontmatter parsing failed, trying YAML array format...')
      projectIds = parseYamlArrayFromNote(note, 'todoist_id')
      if (projectIds.length > 0) {
        logDebug(pluginJson, `Found todoist_id(s) from YAML array: ${projectIds.join(', ')}`)
      }
    }
  }

  if (projectIds.length === 0) {
    logWarn(pluginJson, 'No valid todoist_project_name, todoist_id, or their plural forms found in frontmatter')
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

    await projectSync(note, projectId, filterOverride, multiProjectContext, true)
  }

  // Close completed tasks in Todoist
  for (const t of closed) {
    await closeTodoistTask(t)
  }
}

/**
 * Sync project with 'today' filter
 * @returns {Promise<void>}
 */
export async function syncProjectToday(): Promise<void> {
  await syncProject('today')
}

/**
 * Sync project with 'overdue' filter
 * @returns {Promise<void>}
 */
export async function syncProjectOverdue(): Promise<void> {
  await syncProject('overdue')
}

/**
 * Sync project with 'current' (overdue | today) filter
 * @returns {Promise<void>}
 */
export async function syncProjectCurrent(): Promise<void> {
  await syncProject('current')
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
  // Search for all frontmatter formats (ID-based and name-based) and collect unique notes
  const found_notes: Map<string, TNote> = new Map()

  for (const search_string of ['todoist_id:', 'todoist_ids:', 'todoist_project_name:', 'todoist_project_names:']) {
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
    logInfo(pluginJson, 'No results found in notes for todoist_id, todoist_ids, todoist_project_name, or todoist_project_names. Make sure frontmatter is set according to plugin instructions')
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

    // Parse frontmatter to get project IDs and filter
    const frontmatter: ?Object = getFrontmatterAttributes(note)
    if (!frontmatter) {
      logWarn(pluginJson, `Note ${filename} has no frontmatter, skipping`)
      continue
    }

    // Check for per-note filter override (try standard, then YAML parsing)
    let filterOverride = null
    const fmFilter = frontmatter.todoist_filter ?? getFrontmatterValueFromNote(note, 'todoist_filter')
    if (fmFilter) {
      filterOverride = parseDateFilterArg(fmFilter)
      if (filterOverride) {
        logInfo(pluginJson, `Note ${filename} using frontmatter filter: ${filterOverride}`)
      }
    }

    let projectIds: Array<string> = []

    // Try project name-based lookup first (new user-friendly approach)
    let projectNames: Array<string> = []
    if ('todoist_project_names' in frontmatter && frontmatter.todoist_project_names) {
      projectNames = parseProjectIds(frontmatter.todoist_project_names) // reuse array parsing
      logDebug(pluginJson, `Found todoist_project_names in ${filename}: ${projectNames.join(', ')}`)
    } else if ('todoist_project_name' in frontmatter && frontmatter.todoist_project_name) {
      projectNames = parseProjectIds(frontmatter.todoist_project_name)
      logDebug(pluginJson, `Found todoist_project_name in ${filename}: ${projectNames.join(', ')}`)
    }

    // Try YAML array format for project names
    if (projectNames.length === 0) {
      projectNames = parseYamlArrayFromNote(note, 'todoist_project_name')
      if (projectNames.length > 0) {
        logDebug(pluginJson, `Found todoist_project_name(s) from YAML array in ${filename}: ${projectNames.join(', ')}`)
      }
    }

    // Resolve project names to IDs if found
    if (projectNames.length > 0) {
      projectIds = await resolveProjectNamesToIds(projectNames)
    }

    // Fall back to ID-based lookup (backward compatible)
    if (projectIds.length === 0) {
      // Try standard frontmatter parsing first
      if ('todoist_ids' in frontmatter && frontmatter.todoist_ids) {
        projectIds = parseProjectIds(frontmatter.todoist_ids)
        logDebug(pluginJson, `Found todoist_ids in ${filename}: ${projectIds.join(', ')}`)
      } else if ('todoist_id' in frontmatter && frontmatter.todoist_id) {
        projectIds = parseProjectIds(frontmatter.todoist_id)
        logDebug(pluginJson, `Found todoist_id in ${filename}: ${projectIds.join(', ')}`)
      }

      // If standard parsing failed, try YAML array format
      if (projectIds.length === 0) {
        logDebug(pluginJson, `Standard frontmatter parsing failed for ${filename}, trying YAML array format...`)
        projectIds = parseYamlArrayFromNote(note, 'todoist_id')
        if (projectIds.length > 0) {
          logDebug(pluginJson, `Found todoist_id(s) from YAML array in ${filename}: ${projectIds.join(', ')}`)
        }
      }
    }

    if (projectIds.length === 0) {
      logWarn(pluginJson, `Note ${filename} has no valid todoist_project_name, todoist_id, or their plural forms, skipping`)
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
      await projectSync(note, projectId, filterOverride, multiProjectContext, false)
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
 * Filter tasks by date based on the filter setting
 * Note: Todoist API ignores filter param when project_id is specified, so we filter client-side
 *
 * @param {Array<Object>} tasks - array of task objects from Todoist
 * @param {string} dateFilter - the date filter to apply (today, overdue, overdue | today, 3 days, 7 days, all)
 * @returns {Array<Object>} - filtered tasks
 */
function filterTasksByDate(tasks: Array<Object>, dateFilter: ?string): Array<Object> {
  if (!dateFilter || dateFilter === 'all') {
    return tasks
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const threeDaysFromNow = new Date(today)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  return tasks.filter((task) => {
    if (!task.due || !task.due.date) {
      // Tasks without due dates: only include if filter is 'all'
      return false
    }

    const dueDate = new Date(task.due.date)
    dueDate.setHours(0, 0, 0, 0)

    switch (dateFilter) {
      case 'today':
        return dueDate.getTime() === today.getTime()
      case 'overdue':
        return dueDate.getTime() < today.getTime()
      case 'overdue | today':
        return dueDate.getTime() <= today.getTime()
      case '3 days':
        return dueDate.getTime() <= threeDaysFromNow.getTime()
      case '7 days':
        return dueDate.getTime() <= sevenDaysFromNow.getTime()
      default:
        return true
    }
  })
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
    Editor.insertTextAtCursor(`${content}\n`)
  } else {
    note.appendParagraph(content, 'text')
  }
}

/**
 * Get Todoist project tasks and write them out organized by sections
 * Supports both date filtering and multi-project organization
 *
 * @param {TNote} note - note that will be written to
 * @param {string} id - Todoist project ID
 * @param {?string} filterOverride - optional date filter override
 * @param {?MultiProjectContext} multiProjectContext - context for multi-project mode
 * @param {boolean} isEditorNote - whether this is the currently open note in Editor
 * @returns {Promise<void>}
 */
async function projectSync(note: TNote, id: string, filterOverride: ?string, multiProjectContext: ?MultiProjectContext = null, isEditorNote: boolean = false): Promise<void> {
  const task_result = await pullTodoistTasksByProject(id, filterOverride)
  const tasks: Array<Object> = JSON.parse(task_result)

  if (!tasks.results || tasks.results.length === 0) {
    logInfo(pluginJson, `No tasks found for project ${id}`)
    return
  }

  // Determine which filter to use
  const dateFilter = filterOverride ?? setup.projectDateFilter

  // Filter tasks client-side (Todoist API ignores filter when project_id is specified)
  const filteredTasks = filterTasksByDate(tasks.results || [], dateFilter)
  logInfo(pluginJson, `Filtered ${tasks.results?.length || 0} tasks to ${filteredTasks.length} based on filter: ${dateFilter}`)

  if (filteredTasks.length === 0) {
    logInfo(pluginJson, `No tasks match the filter for project ${id}`)
    return
  }

  // If in multi-project mode with a valid heading level, organize by sections
  if (multiProjectContext && multiProjectContext.isMultiProject && multiProjectContext.projectHeadingLevel > 0) {
    // Fetch all sections for this project
    const sectionMap = await fetchProjectSections(id)

    // Group tasks by section
    const tasksBySection: Map<string, Array<Object>> = new Map()
    const tasksWithoutSection: Array<Object> = []

    for (const task of filteredTasks) {
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

    logDebug(pluginJson, `Organized ${filteredTasks.length} tasks: ${tasksWithoutSection.length} without section, ${tasksBySection.size} sections`)

    const useEditor = multiProjectContext.isEditorNote

    // Write tasks without sections first (directly under project heading)
    for (const task of tasksWithoutSection) {
      await writeOutTaskSimple(note, task, useEditor)
    }

    // Write each section with its tasks
    for (const [sectionName, sectionTasks] of tasksBySection) {
      // Add section heading
      addSectionHeading(note, sectionName, multiProjectContext.projectHeadingLevel, useEditor)

      // Write tasks under this section
      for (const task of sectionTasks) {
        await writeOutTaskSimple(note, task, useEditor)
      }
    }
  } else {
    // Original behavior for single project or non-heading separators
    for (const t of filteredTasks) {
      await writeOutTask(note, t, isEditorNote)
    }
  }
}

/**
 * Pull todoist tasks from list matching the ID provided
 *
 * @param {string} project_id - the id of the Todoist project
 * @param {string} filterOverride - optional date filter override (bypasses setting)
 * @returns {Promise<any>} - promise that resolves into array of task objects or null
 */
async function pullTodoistTasksByProject(project_id: string, filterOverride: ?string): Promise<any> {
  if (project_id !== '') {
    const filterParts: Array<string> = []

    // Add date filter: use override if provided, otherwise use setting
    const dateFilter = filterOverride ?? setup.projectDateFilter
    if (dateFilter && dateFilter !== 'all') {
      filterParts.push(dateFilter)
    }

    // Add team account filter if applicable
    if (setup.useTeamAccount) {
      if (setup.addUnassigned) {
        filterParts.push('!assigned to: others')
      } else {
        filterParts.push('assigned to: me')
      }
    }

    // Build the URL with proper encoding
    let url = `${todo_api}/tasks?project_id=${project_id}`
    if (filterParts.length > 0) {
      const filterString = filterParts.join(' & ')
      url = `${url}&filter=${encodeURIComponent(filterString)}`
    }

    logDebug(pluginJson, `Fetching tasks from URL: ${url}`)
    const result = await fetch(url, getRequestObject())
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

    if ('projectDateFilter' in settings && settings.projectDateFilter !== '') {
      setup.newProjectDateFilter = settings.projectDateFilter
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
 * Add a task below a heading, creating the heading if it doesn't exist
 * Uses Editor methods for the currently open note for reliable updates
 *
 * @param {TNote} note - the note to modify
 * @param {string} headingName - the heading to add the task below
 * @param {string} taskContent - the formatted task content
 * @param {boolean} isEditorNote - whether this is the currently open note in Editor
 */
function addTaskBelowHeading(note: TNote, headingName: string, taskContent: string, isEditorNote: boolean = false): void {
  const existingHeading = findHeading(note, headingName)
  if (existingHeading) {
    // Heading exists, use the standard method
    if (isEditorNote) {
      Editor.addTodoBelowHeadingTitle(taskContent, headingName, true, true)
    } else {
      note.addTodoBelowHeadingTitle(taskContent, headingName, true, true)
    }
  } else {
    // Heading doesn't exist - insert at cursor for Editor, append for background
    logInfo(pluginJson, `Creating heading: ${headingName}`)
    if (isEditorNote) {
      Editor.insertTextAtCursor(`### ${headingName}\n- [ ] ${taskContent}\n`)
    } else {
      note.appendParagraph(`### ${headingName}`, 'text')
      note.appendTodo(taskContent)
    }
  }
}

/**
 * Format and write task to correct noteplan note
 *
 * @param {TNote} note - the note object that will get the task
 * @param {Object} task - the task object that will be written
 * @param {boolean} isEditorNote - whether this is the currently open note in Editor
 */
async function writeOutTask(note: TNote, task: Object, isEditorNote: boolean = false) {
  if (note) {
    logDebug(pluginJson, task)
    const formatted = formatTaskDetails(task)
    if (task.section_id !== null) {
      let section = await fetch(`${todo_api}/sections/${task.section_id}`, getRequestObject())
      section = JSON.parse(section)
      if (section) {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `1. Task will be added to ${note.title} below ${section.name} (${formatted})`)
          addTaskBelowHeading(note, section.name, formatted, isEditorNote)
          just_written.push(task.id)
        } else {
          logInfo(pluginJson, `Task is already in Noteplan ${task.id}`)
        }
      } else {
        // this one has a section ID but Todoist will not return a name
        logWarn(pluginJson, `Section ID ${task.section_id} did not return a section name`)
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `2. Task will be added to ${note.title} (${formatted})`)
          if (isEditorNote) {
            Editor.insertTextAtCursor(`- [ ] ${formatted}\n`)
          } else {
            note.appendTodo(formatted)
          }
          just_written.push(task.id)
        } else {
          logInfo(pluginJson, `Task is already in Noteplan (${formatted})`)
        }
      }
    } else {
      // check for a default heading
      if (setup.header !== '') {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `3. Task will be added to ${note.title} below ${setup.header} (${formatted})`)
          addTaskBelowHeading(note, setup.header, formatted, isEditorNote)
          just_written.push(task.id)
        }
      } else {
        if (!existing.includes(task.id) && !just_written.includes(task.id)) {
          logInfo(pluginJson, `4. Task will be added to ${note.title} (${formatted})`)
          if (isEditorNote) {
            Editor.insertTextAtCursor(`- [ ] ${formatted}\n`)
          } else {
            note.appendTodo(formatted)
          }
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
      Editor.insertTextAtCursor(`- [ ] ${formatted}\n`)
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
