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

/**
 * Parse a CSV string that supports quoted values containing commas.
 * Simple values are comma-separated, quoted values preserve internal commas.
 *
 * Examples:
 *   "ARPA-H, Personal, Work" → ["ARPA-H", "Personal", "Work"]
 *   "ARPA-H, \"Work, Life Balance\", Personal" → ["ARPA-H", "Work, Life Balance", "Personal"]
 *
 * @param {string} input - The CSV string to parse
 * @returns {Array<string>} Array of parsed values, trimmed
 */
function parseCSVProjectNames(input: string): Array<string> {
  const results: Array<string> = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (char === '"' && (i === 0 || input[i - 1] !== '\\')) {
      // Toggle quote state (ignore escaped quotes)
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // End of value
      const trimmed = current.trim()
      if (trimmed) {
        results.push(trimmed)
      }
      current = ''
    } else {
      current += char
    }
  }

  // Don't forget the last value
  const trimmed = current.trim()
  if (trimmed) {
    results.push(trimmed)
  }

  logDebug(pluginJson, `parseCSVProjectNames: "${input}" → [${results.join(', ')}]`)
  return results
}

/**
 * Known date filter keywords - used to distinguish project names from filters
 */
const DATE_FILTER_KEYWORDS = ['today', 'overdue', 'current', 'all', '3 days', '7 days']

/**
 * Check if a string looks like a date filter keyword
 *
 * @param {string} value - The string to check
 * @returns {boolean} True if it matches a known filter keyword
 */
function isDateFilterKeyword(value: string): boolean {
  return DATE_FILTER_KEYWORDS.includes(value.toLowerCase().trim())
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
  projectPrefix: string,
  sectionFormat: string,
  sectionPrefix: string,
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
  newProjectPrefix: any,
  newSectionFormat: any,
  newSectionPrefix: any,
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
  projectPrefix: 'Blank Line',
  sectionFormat: '#### Section',
  sectionPrefix: 'Blank Line',

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
   * @param {string} passedProjectPrefix
   */
  set newProjectPrefix(passedProjectPrefix: string) {
    setup.projectPrefix = passedProjectPrefix
  },
  /**
   * @param {string} passedSectionFormat
   */
  set newSectionFormat(passedSectionFormat: string) {
    setup.sectionFormat = passedSectionFormat
  },
  /**
   * @param {string} passedSectionPrefix
   */
  set newSectionPrefix(passedSectionPrefix: string) {
    setup.sectionPrefix = passedSectionPrefix
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
  logDebug(pluginJson, `resolveProjectNamesToIds: Looking up ${names.length} project names`)
  const projects = await getTodoistProjects()
  logDebug(pluginJson, `resolveProjectNamesToIds: Found ${projects.length} projects in Todoist`)
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
      logWarn(pluginJson, `No Todoist project found matching: "${name}". Available projects: ${projects.map((p) => p.project_name).join(', ')}`)
    }
  }
  logDebug(pluginJson, `resolveProjectNamesToIds: Resolved ${ids.length} of ${names.length} names`)
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
/**
 * Convert a prefix setting to actual content to insert
 *
 * @param {string} prefixSetting - The prefix setting value
 * @returns {string} The content to insert (may be empty, newline, ---, or both)
 */
function getPrefixContent(prefixSetting: string): string {
  switch (prefixSetting) {
    case 'Blank Line':
      return '\n'
    case 'Horizontal Rule':
      return '---\n'
    case 'Blank Line + Horizontal Rule':
      return '\n---\n'
    case 'Nothing':
    default:
      return ''
  }
}

/**
 * Check if a heading with the given content already exists in the note
 *
 * @param {TNote} note - The note to check
 * @param {string} headingContent - The heading text to look for (e.g., "### Project Name")
 * @returns {boolean} True if the heading exists
 */
function headingExists(note: TNote, headingContent: string): boolean {
  if (!note || !note.paragraphs) return false

  const normalizedTarget = headingContent.trim()

  for (const para of note.paragraphs) {
    if (para.type === 'title' && para.content && para.content.trim() === normalizedTarget) {
      return true
    }
    // Also check rawContent for heading markers like ###
    if (para.rawContent && para.rawContent.trim() === normalizedTarget) {
      return true
    }
  }

  return false
}

function addProjectSeparator(note: TNote, projectName: string, isEditorNote: boolean = false): number {
  const separator = setup.projectSeparator
  const prefix = getPrefixContent(setup.projectPrefix)
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
    // Check if this heading already exists
    if (headingExists(note, content)) {
      logDebug(pluginJson, `Project heading already exists: ${content}`)
      return headingLevel
    }

    const fullContent = prefix + content
    if (isEditorNote) {
      Editor.insertTextAtCursor(`${fullContent}\n`)
    } else {
      // For non-editor notes, insert prefix lines separately if needed
      if (prefix) {
        const prefixLines = prefix.trim().split('\n')
        prefixLines.forEach((line) => note.appendParagraph(line, 'text'))
      }
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

  // Clear global arrays to ensure clean state for this sync
  closed.length = 0
  just_written.length = 0
  existing.length = 0

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
      // Clear arrays for each project/note (don't carry state between notes)
      closed.length = 0
      just_written.length = 0
      existing.length = 0

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
 * Can specify projects via:
 *   1. Inline argument: array of names OR CSV string (supports quoted values for names with commas)
 *   2. Frontmatter: todoist_project_name(s) or todoist_id(s)
 *
 * @param {string | Array<string>} firstArg - project names (array or CSV string) OR date filter keyword
 * @param {string} secondArg - date filter if first arg was project names
 * @returns {Promise<void>} A promise that resolves once synchronization is complete
 *
 * @example
 *   // With frontmatter (existing behavior)
 *   syncProject()                    // uses frontmatter
 *   syncProject("today")             // uses frontmatter + filter
 *
 *   // With inline project names - array syntax (best for templates)
 *   syncProject(["ARPA-H"])                         // single project
 *   syncProject(["ARPA-H", "Personal"])             // multiple projects
 *   syncProject(["ARPA-H", "Work, Life"])           // names with commas - no escaping needed
 *   syncProject(["ARPA-H", "Personal"], "today")    // with filter
 *
 *   // With inline project names - CSV syntax (for x-callback-urls)
 *   syncProject("ARPA-H")                           // single project
 *   syncProject("ARPA-H, Personal")                 // multiple projects
 *   syncProject("ARPA-H, \"Work, Life\"")           // quoted name with comma
 *   syncProject("ARPA-H, Personal", "today")        // with filter
 */
// eslint-disable-next-line require-await
export async function syncProject(firstArg: ?(string | Array<string>), secondArg: ?string) {
  setSettings()

  const note: ?TNote = Editor.note
  if (!note) return

  // Clear global arrays to ensure clean state for this sync
  closed.length = 0
  just_written.length = 0
  existing.length = 0

  // Determine if firstArg is project names or a date filter
  // Supports: array of names, CSV string of names, or date filter keyword
  let inlineProjectNames: Array<string> = []
  let filterOverride: ?string = null

  if (Array.isArray(firstArg)) {
    // Array of project names (cleanest for template tags)
    inlineProjectNames = firstArg.map((name) => String(name).trim()).filter((name) => name.length > 0)
    logInfo(pluginJson, `Using inline project names (array): ${inlineProjectNames.join(', ')}`)

    // Second arg would be the filter
    if (secondArg && secondArg.trim()) {
      filterOverride = parseDateFilterArg(secondArg)
      if (filterOverride) {
        logInfo(pluginJson, `Using filter from second argument: ${filterOverride}`)
      }
    }
  } else if (typeof firstArg === 'string' && firstArg.trim()) {
    if (isDateFilterKeyword(firstArg)) {
      // First arg is a date filter (backward compatible)
      filterOverride = parseDateFilterArg(firstArg)
      logInfo(pluginJson, `Using command-line filter override: ${String(filterOverride)}`)
    } else {
      // First arg is project name(s) as CSV string
      inlineProjectNames = parseCSVProjectNames(firstArg)
      logInfo(pluginJson, `Using inline project names (CSV): ${inlineProjectNames.join(', ')}`)

      // Second arg would be the filter
      if (secondArg && secondArg.trim()) {
        filterOverride = parseDateFilterArg(secondArg)
        if (filterOverride) {
          logInfo(pluginJson, `Using filter from second argument: ${filterOverride}`)
        }
      }
    }
  }

  // Get frontmatter (may be null if using inline project names)
  const frontmatter: ?Object = getFrontmatterAttributes(note)

  // If no inline names and no frontmatter, we need frontmatter
  if (inlineProjectNames.length === 0 && !frontmatter) {
    logWarn(pluginJson, 'No project names provided and current note has no frontmatter')
    return
  }

  // Determine filter priority: command-line > frontmatter > settings
  if (!filterOverride && frontmatter) {
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

  // Determine project IDs to sync
  // Priority: inline argument > frontmatter project names > frontmatter IDs
  let projectIds: Array<string> = []

  // 1. If inline project names provided, resolve them
  if (inlineProjectNames.length > 0) {
    projectIds = await resolveProjectNamesToIds(inlineProjectNames)
    if (projectIds.length === 0) {
      logWarn(pluginJson, `Could not resolve any project names: ${inlineProjectNames.join(', ')}`)
      return
    }
  }

  // 2. Otherwise, try frontmatter
  if (projectIds.length === 0 && frontmatter) {
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
  }

  if (projectIds.length === 0) {
    logWarn(pluginJson, 'No valid project names or IDs found (checked inline argument and frontmatter)')
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
 * Sync project by name - prompts user for project names and filter
 * @returns {Promise<void>}
 */
export async function syncProjectByName(): Promise<void> {
  // Prompt for project names
  const projectNamesInput = await CommandBar.showInput(
    'Enter Todoist project name(s), comma-separated',
    'e.g., ARPA-H, Personal'
  )

  if (!projectNamesInput || !projectNamesInput.trim()) {
    logWarn(pluginJson, 'No project names entered')
    return
  }

  // Prompt for filter (with options)
  const filterOptions = ['today', 'overdue', 'current (overdue + today)', '7 days', '3 days', 'all', 'use default from settings']
  const selectedFilter = await CommandBar.showOptions(
    filterOptions,
    'Select date filter for tasks'
  )

  if (!selectedFilter || selectedFilter.index === undefined) {
    logWarn(pluginJson, 'No filter selected')
    return
  }

  // Map selection to filter value
  let filterArg: ?string = null
  const filterMap = ['today', 'overdue', 'current', '7 days', '3 days', 'all', null]
  filterArg = filterMap[selectedFilter.index]

  logInfo(pluginJson, `Syncing projects: "${projectNamesInput}" with filter: ${filterArg ?? 'default'}`)

  // Call syncProject with the inputs
  await syncProject(projectNamesInput, filterArg)
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
  // Clear global arrays to ensure clean state for this sync
  closed.length = 0
  just_written.length = 0
  existing.length = 0

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

    // Clear arrays for this specific note (don't carry state between notes)
    closed.length = 0
    just_written.length = 0
    existing.length = 0

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
  // Clear global arrays to ensure clean state for this sync
  closed.length = 0
  just_written.length = 0
  existing.length = 0

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
    const tasks: Array<Object> = await pullAllTodoistTasksByDateFilter('today')

    if (tasks && tasks.length > 0 && note) {
      tasks.forEach(async (t) => {
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
export function filterTasksByDate(tasks: Array<Object>, dateFilter: ?string): Array<Object> {
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

    // Parse YYYY-MM-DD as local date (not UTC)
    // new Date("2026-01-21") parses as UTC, causing timezone issues
    const dateParts = task.due.date.split('-')
    const dueDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10))

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
  let cursor = null
  let pageCount = 0

  try {
    do {
      pageCount++
      const url = cursor
        ? `${todo_api}/sections?project_id=${projectId}&cursor=${cursor}`
        : `${todo_api}/sections?project_id=${projectId}`
      logDebug(pluginJson, `fetchProjectSections: Fetching page ${pageCount} from ${url}`)
      const result = await fetch(url, getRequestObject())
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

      // Check for next page
      cursor = parsed?.next_cursor || null
      logDebug(pluginJson, `fetchProjectSections: Page ${pageCount} returned ${sections?.length || 0} sections. Total: ${sectionMap.size}. Has more: ${!!cursor}`)

      // Safety limit
      if (pageCount >= 10) {
        logWarn(pluginJson, `fetchProjectSections: Reached safety limit of 10 pages.`)
        break
      }
    } while (cursor)

    logDebug(pluginJson, `Found ${sectionMap.size} sections for project ${projectId} across ${pageCount} page(s)`)
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
  const prefix = getPrefixContent(setup.sectionPrefix)
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

  // Check if this heading already exists
  if (headingExists(note, content)) {
    logDebug(pluginJson, `Section heading already exists: ${content}`)
    return
  }

  const fullContent = prefix + content
  if (isEditorNote) {
    Editor.insertTextAtCursor(`${fullContent}\n`)
  } else {
    // For non-editor notes, insert prefix lines separately if needed
    if (prefix) {
      const prefixLines = prefix.trim().split('\n')
      prefixLines.forEach((line) => note.appendParagraph(line, 'text'))
    }
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
  const taskList = await pullTodoistTasksByProject(id, filterOverride)

  if (!taskList || taskList.length === 0) {
    logInfo(pluginJson, `No tasks found for project ${id}`)
    return
  }

  // Determine which filter to use
  const dateFilter = filterOverride ?? setup.projectDateFilter
  logDebug(pluginJson, `projectSync: filterOverride=${String(filterOverride)}, setup.projectDateFilter=${setup.projectDateFilter}, using dateFilter=${String(dateFilter)}`)

  // Filter tasks client-side (Todoist API ignores filter when project_id is specified)
  const filteredTasks = filterTasksByDate(taskList, dateFilter)
  logInfo(pluginJson, `Filtered ${taskList.length} tasks to ${filteredTasks.length} based on filter: ${String(dateFilter)}`)

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
 * Pull todoist tasks from list matching the ID provided.
 * Handles pagination to fetch all tasks.
 *
 * @param {string} project_id - the id of the Todoist project
 * @param {string} filterOverride - optional date filter override (bypasses setting)
 * @returns {Promise<Array<Object>>} - promise that resolves into array of task objects
 */
async function pullTodoistTasksByProject(project_id: string, filterOverride: ?string): Promise<Array<Object>> {
  if (project_id === '') {
    return []
  }

  const allTasks: Array<Object> = []
  let cursor = null
  let pageCount = 0

  const filterParts: Array<string> = []

  // Add date filter: use override if provided, otherwise use setting
  const dateFilter = filterOverride ?? setup.projectDateFilter
  if (dateFilter && dateFilter !== 'all') {
    filterParts.push(dateFilter)
  }

  // Always filter to exclude tasks assigned to others
  filterParts.push('!assigned to: others')

  // Build the base URL
  let baseUrl = `${todo_api}/tasks?project_id=${project_id}`
  if (filterParts.length > 0) {
    const filterString = filterParts.join(' & ')
    baseUrl = `${baseUrl}&filter=${encodeURIComponent(filterString)}`
  }

  try {
    do {
      pageCount++
      const url = cursor ? `${baseUrl}&cursor=${encodeURIComponent(cursor)}` : baseUrl
      logDebug(pluginJson, `pullTodoistTasksByProject: Fetching page ${pageCount} from URL: ${url}`)
      const result = await fetch(url, getRequestObject())
      const parsed = JSON.parse(result)

      // Handle both response formats: {results: [...]} or plain array [...]
      const tasks = Array.isArray(parsed) ? parsed : (parsed.results || [])
      allTasks.push(...tasks)

      // Check for next page
      cursor = parsed?.next_cursor || null
      logDebug(pluginJson, `pullTodoistTasksByProject: Page ${pageCount} returned ${tasks.length} tasks. Total: ${allTasks.length}. Has more: ${!!cursor}`)

      // Safety limit
      if (pageCount >= 50) {
        logWarn(pluginJson, `pullTodoistTasksByProject: Reached safety limit of 50 pages.`)
        break
      }
    } while (cursor)

    logInfo(pluginJson, `pullTodoistTasksByProject: Fetched ${allTasks.length} tasks across ${pageCount} page(s) for project ${project_id}`)
  } catch (error) {
    logError(pluginJson, `pullTodoistTasksByProject: Failed to fetch tasks: ${String(error)}`)
  }

  return allTasks
}

/**
 * Pull Todoist tasks matching a date filter across ALL projects
 *
 * @param {string} dateFilter - The date filter to apply (today, overdue, overdue | today, 3 days, 7 days)
 * @returns {Promise<any>} - promise that resolves into array of task objects or null
 */
async function pullTodoistTasksByDateFilter(dateFilter: string, cursor: ?string = null): Promise<any> {
  // Build the query string - combining date filter with assignment filter
  // Always filter to only show tasks assigned to me or unassigned (exclude tasks assigned to others)
  let queryFilter = `${dateFilter} & !assigned to: others`

  let queryString = `?query=${encodeURIComponent(queryFilter)}`

  // Add cursor for pagination if provided
  if (cursor) {
    queryString = `${queryString}&cursor=${encodeURIComponent(cursor)}`
  }

  const url = `${todo_api}/tasks/filter${queryString}`
  logDebug(pluginJson, `pullTodoistTasksByDateFilter: Fetching from URL: ${url}`)
  const result = await fetch(url, getRequestObject())
  logDebug(pluginJson, `pullTodoistTasksByDateFilter: Raw response (first 500 chars): ${String(result).substring(0, 500)}`)
  return result
}

/**
 * Fetch all tasks matching filter, handling pagination
 *
 * @param {string} dateFilter - The date filter to apply (e.g., 'today', 'overdue')
 * @returns {Promise<Array<Object>>} Array of all task objects
 */
async function pullAllTodoistTasksByDateFilter(dateFilter: string): Promise<Array<Object>> {
  let allTasks: Array<Object> = []
  let cursor: ?string = null
  let pageCount = 0

  do {
    pageCount++
    logDebug(pluginJson, `pullAllTodoistTasksByDateFilter: Fetching page ${pageCount}${cursor ? ` with cursor ${cursor.substring(0, 20)}...` : ''}`)

    const response = await pullTodoistTasksByDateFilter(dateFilter, cursor)
    const parsed = JSON.parse(response)

    const tasks = parsed.results || parsed || []
    allTasks = allTasks.concat(tasks)

    cursor = parsed.next_cursor

    logDebug(pluginJson, `pullAllTodoistTasksByDateFilter: Page ${pageCount} returned ${tasks.length} tasks. Total so far: ${allTasks.length}. Has more: ${!!cursor}`)

    // Safety limit to prevent infinite loops
    if (pageCount >= 100) {
      logWarn(pluginJson, `pullAllTodoistTasksByDateFilter: Reached safety limit of 100 pages. Stopping pagination.`)
      break
    }
  } while (cursor)

  logInfo(pluginJson, `pullAllTodoistTasksByDateFilter: Fetched ${allTasks.length} total tasks across ${pageCount} pages`)
  return allTasks
}

/**
 * Group tasks by project, returning Map of projectName → tasks
 *
 * @param {Array<Object>} tasks - Array of task objects from Todoist
 * @returns {Promise<Map<string, Array<Object>>>} Map of project name to array of tasks
 */
async function groupTasksByProject(tasks: Array<Object>): Promise<Map<string, Array<Object>>> {
  const tasksByProject: Map<string, Array<Object>> = new Map()
  const projectCache: Map<string, string> = new Map() // projectId → projectName

  for (const task of tasks) {
    const projectId = task.project_id

    // Cache project name lookup
    if (!projectCache.has(projectId)) {
      const name = await getProjectName(projectId)
      projectCache.set(projectId, name)
    }

    const projectName = projectCache.get(projectId) ?? `Project ${projectId}`

    if (!tasksByProject.has(projectName)) {
      tasksByProject.set(projectName, [])
    }
    tasksByProject.get(projectName)?.push(task)
  }

  logDebug(pluginJson, `groupTasksByProject: Grouped ${tasks.length} tasks into ${tasksByProject.size} projects`)
  return tasksByProject
}

/**
 * Sync tasks by date filter across all projects, organized by project and section
 *
 * @param {string} dateFilter - The date filter to apply
 * @returns {Promise<void>}
 */
async function syncByProjectWithDateFilter(dateFilter: string): Promise<void> {
  setSettings()

  const note: ?TNote = Editor.note
  if (!note) {
    logWarn(pluginJson, 'No note open in Editor')
    return
  }

  // Clear global arrays to ensure clean state for this sync
  closed.length = 0
  just_written.length = 0
  existing.length = 0

  // Fetch all tasks matching filter (handles pagination automatically)
  const allTasks = await pullAllTodoistTasksByDateFilter(dateFilter)
  logDebug(pluginJson, `syncByProjectWithDateFilter: allTasks is array: ${Array.isArray(allTasks)}, length: ${allTasks.length}`)

  logInfo(pluginJson, `syncByProjectWithDateFilter: Found ${allTasks.length} tasks matching filter: ${dateFilter}`)

  if (allTasks.length === 0) {
    logInfo(pluginJson, `No tasks found matching filter: ${dateFilter}`)
    return
  }

  // Check existing tasks to avoid duplicates
  const paragraphs = note.paragraphs
  if (paragraphs) {
    paragraphs.forEach((p) => checkParagraph(p))
  }

  // Group by project
  const tasksByProject = await groupTasksByProject(allTasks)

  // Write each project with its tasks
  for (const [projectName, projectTasks] of tasksByProject) {
    // Add project heading
    const headingLevel = addProjectSeparator(note, projectName, true)

    // Get section map for this project (all tasks in same project have same project_id)
    const firstTask = projectTasks[0]
    const sectionMap = await fetchProjectSections(firstTask.project_id)

    // Separate sectioned and unsectioned tasks
    const tasksBySection: Map<string, Array<Object>> = new Map()
    const unsectionedTasks: Array<Object> = []

    for (const task of projectTasks) {
      if (task.section_id && sectionMap.has(task.section_id)) {
        const sectionName = sectionMap.get(task.section_id) ?? ''
        if (!tasksBySection.has(sectionName)) {
          tasksBySection.set(sectionName, [])
        }
        tasksBySection.get(sectionName)?.push(task)
      } else {
        unsectionedTasks.push(task)
      }
    }

    logDebug(pluginJson, `Project "${projectName}": ${unsectionedTasks.length} unsectioned, ${tasksBySection.size} sections`)

    // Write unsectioned tasks first
    for (const task of unsectionedTasks) {
      await writeOutTaskSimple(note, task, true)
    }

    // Write each section
    for (const [sectionName, sectionTasks] of tasksBySection) {
      addSectionHeading(note, sectionName, headingLevel, true)
      for (const task of sectionTasks) {
        await writeOutTaskSimple(note, task, true)
      }
    }
  }

  // Close completed tasks
  for (const t of closed) {
    await closeTodoistTask(t)
  }
}

/**
 * Sync tasks due today (API semantics: only today, no overdue), organized by project
 * @returns {Promise<void>}
 */
export async function syncTodayByProject(): Promise<void> {
  await syncByProjectWithDateFilter('today')
}

/**
 * Sync all overdue Todoist tasks, organized by project
 * @returns {Promise<void>}
 */
export async function syncOverdueByProject(): Promise<void> {
  await syncByProjectWithDateFilter('overdue')
}

/**
 * Sync current tasks (today + overdue), organized by project
 * @returns {Promise<void>}
 */
export async function syncCurrentByProject(): Promise<void> {
  await syncByProjectWithDateFilter('today | overdue')
}

/**
 * Sync all Todoist tasks due within 7 days, organized by project
 * @returns {Promise<void>}
 */
export async function syncWeekByProject(): Promise<void> {
  await syncByProjectWithDateFilter('7 days')
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
        const completed: boolean = task_info?.checked === true
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

    if ('projectPrefix' in settings && settings.projectPrefix !== '') {
      setup.newProjectPrefix = settings.projectPrefix
    }

    if ('sectionFormat' in settings && settings.sectionFormat !== '') {
      setup.newSectionFormat = settings.sectionFormat
    }

    if ('sectionPrefix' in settings && settings.sectionPrefix !== '') {
      setup.newSectionPrefix = settings.sectionPrefix
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
 * Handles pagination to fetch all projects.
 *
 * @returns {Array<Object>}
 */
async function getTodoistProjects() {
  const project_list = []
  let cursor = null
  let pageCount = 0

  try {
    do {
      pageCount++
      const url = cursor ? `${todo_api}/projects?cursor=${cursor}` : `${todo_api}/projects`
      logDebug(pluginJson, `getTodoistProjects: Fetching page ${pageCount} from ${url}`)
      const results = await fetch(url, getRequestObject())
      logDebug(pluginJson, `getTodoistProjects: Raw response type: ${typeof results}`)
      const parsed = JSON.parse(results)
      logDebug(pluginJson, `getTodoistProjects: Parsed response keys: ${Object.keys(parsed || {}).join(', ')}`)

      // Handle both array and {results: [...]} formats
      const projects = Array.isArray(parsed) ? parsed : (parsed?.results || parsed)

      if (projects && Array.isArray(projects)) {
        projects.forEach((project) => {
          logDebug(pluginJson, `Project name: ${project.name} Project ID: ${project.id}`)
          project_list.push({ project_name: project.name, project_id: project.id })
        })
      } else {
        logWarn(pluginJson, `getTodoistProjects: Unexpected response format: ${JSON.stringify(parsed).substring(0, 200)}`)
      }

      // Check for next page
      cursor = parsed?.next_cursor || null
      logDebug(pluginJson, `getTodoistProjects: Page ${pageCount} returned ${projects?.length || 0} projects. Total so far: ${project_list.length}. Has more: ${!!cursor}`)

      // Safety limit to prevent infinite loops
      if (pageCount >= 20) {
        logWarn(pluginJson, `getTodoistProjects: Reached safety limit of 20 pages. Stopping pagination.`)
        break
      }
    } while (cursor)
  } catch (error) {
    logError(pluginJson, `getTodoistProjects: Failed to fetch projects: ${String(error)}`)
  }
  logInfo(pluginJson, `getTodoistProjects: Returning ${project_list.length} projects across ${pageCount} page(s)`)
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

// ============================================================================
// CONVERT TO TODOIST TASK FUNCTIONALITY
// ============================================================================

/**
 * Check if a paragraph is a non-Todoist open task
 * (i.e., an open task that doesn't already have a Todoist link)
 *
 * @param {TParagraph} para - The paragraph to check
 * @returns {boolean} True if this is an open task without a Todoist link
 */
function isNonTodoistOpenTask(para: TParagraph): boolean {
  // Check if it's an open task or checklist item
  if (para.type !== 'open' && para.type !== 'checklist') {
    return false
  }

  // Check if content already has a Todoist link
  const content = para.content ?? ''
  const todoistLinkPattern = /\[\^?\]\(https:\/\/app\.todoist\.com\/app\/task\/\d+\)/
  if (todoistLinkPattern.test(content)) {
    return false
  }

  // Check if content is empty
  if (!content.trim()) {
    return false
  }

  return true
}

/**
 * Parse task details from NotePlan content for Todoist API
 *
 * @param {string} content - The raw task content from NotePlan
 * @returns {Object} Object with content, priority, dueDate, and labels
 */
function parseTaskDetailsForTodoist(content: string): { content: string, priority: number, dueDate: ?string, labels: Array<string> } {
  let cleanContent = content.trim()
  let priority = 1 // Todoist default (lowest)
  let dueDate: ?string = null
  const labels: Array<string> = []

  // Extract priority (!!! = p4/highest, !! = p3, ! = p2)
  // Note: Todoist priority is inverted - 4 is highest, 1 is lowest
  if (cleanContent.startsWith('!!! ')) {
    priority = 4
    cleanContent = cleanContent.substring(4)
  } else if (cleanContent.startsWith('!! ')) {
    priority = 3
    cleanContent = cleanContent.substring(3)
  } else if (cleanContent.startsWith('! ')) {
    priority = 2
    cleanContent = cleanContent.substring(2)
  }

  // Extract due date (>YYYY-MM-DD or >today, >tomorrow, etc.)
  const dateMatch = cleanContent.match(/\s*>([\d-]+|today|tomorrow)\s*/)
  if (dateMatch) {
    const dateValue = dateMatch[1]
    if (dateValue === 'today') {
      const today = new Date()
      dueDate = today.toISOString().split('T')[0]
    } else if (dateValue === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = tomorrow.toISOString().split('T')[0]
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      dueDate = dateValue
    }
    cleanContent = cleanContent.replace(dateMatch[0], ' ').trim()
  }

  // Extract hashtag labels (#label1 #label2)
  // Be careful not to match heading markers or other # uses
  const labelMatches = cleanContent.match(/\s#([a-zA-Z0-9_-]+)/g)
  if (labelMatches) {
    for (const match of labelMatches) {
      const label = match.trim().substring(1) // Remove leading space and #
      if (label && !labels.includes(label)) {
        labels.push(label)
      }
    }
    // Remove labels from content
    cleanContent = cleanContent.replace(/\s#([a-zA-Z0-9_-]+)/g, '').trim()
  }

  // Clean up any extra whitespace
  cleanContent = cleanContent.replace(/\s+/g, ' ').trim()

  logDebug(pluginJson, `parseTaskDetailsForTodoist: "${content}" -> content="${cleanContent}", priority=${priority}, dueDate=${dueDate ?? 'none'}, labels=[${labels.join(', ')}]`)

  return { content: cleanContent, priority, dueDate, labels }
}

/**
 * Create a task in Todoist Inbox via POST API
 *
 * @param {string} content - The task content
 * @param {number} priority - Todoist priority (1-4, where 4 is highest)
 * @param {?string} dueDate - Due date in YYYY-MM-DD format (optional)
 * @param {Array<string>} labels - Array of label names (optional)
 * @param {?string} parentId - Parent task ID for subtasks (optional)
 * @returns {Promise<?Object>} The created task object with id, or null on failure
 */
async function createTodoistTaskInInbox(
  content: string,
  priority: number = 1,
  dueDate: ?string = null,
  labels: Array<string> = [],
  parentId: ?string = null
): Promise<?Object> {
  try {
    const body: Object = {
      content: content,
      priority: priority,
    }

    // Add optional fields
    if (dueDate) {
      body.due_date = dueDate
    }
    if (labels.length > 0) {
      body.labels = labels
    }
    if (parentId) {
      body.parent_id = parentId
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${setup.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }

    logDebug(pluginJson, `createTodoistTaskInInbox: Creating task with body: ${JSON.stringify(body)}`)
    const result = await fetch(`${todo_api}/tasks`, requestOptions)
    const parsed = JSON.parse(result)

    if (parsed && parsed.id) {
      logInfo(pluginJson, `createTodoistTaskInInbox: Created task ${parsed.id}: "${content}"`)
      return parsed
    } else {
      logError(pluginJson, `createTodoistTaskInInbox: Failed to create task, response: ${JSON.stringify(parsed)}`)
      return null
    }
  } catch (error) {
    logError(pluginJson, `createTodoistTaskInInbox: Error creating task: ${String(error)}`)
    return null
  }
}

/**
 * Get the target paragraphs based on current selection
 *
 * @returns {Array<TParagraph>} Array of paragraphs to process
 */
function getTargetParagraphs(): Array<TParagraph> {
  const note = Editor.note
  if (!note) {
    return []
  }

  // Check if there's a selection spanning multiple lines
  const selection = Editor.selection
  const selectedParagraphs = Editor.selectedParagraphs

  logDebug(pluginJson, `getTargetParagraphs: selection=${JSON.stringify(selection)}, selectedParagraphs count=${selectedParagraphs?.length ?? 0}`)

  // If we have multiple selected paragraphs (selection spans lines), return them all
  if (selectedParagraphs && selectedParagraphs.length > 1) {
    logDebug(pluginJson, `getTargetParagraphs: Returning ${selectedParagraphs.length} selected paragraphs`)
    // $FlowIgnore - selectedParagraphs is readonly but we need to convert to array
    return [...selectedParagraphs]
  }

  // Otherwise, get the current paragraph (cursor line)
  // If selectedParagraphs has 1 item, use that
  if (selectedParagraphs && selectedParagraphs.length === 1) {
    logDebug(pluginJson, `getTargetParagraphs: Returning single selected paragraph`)
    return [selectedParagraphs[0]]
  }

  // Fallback: find paragraph at cursor position
  if (selection && note.paragraphs) {
    const cursorPos = selection.start
    for (const para of note.paragraphs) {
      if (para.contentRange && cursorPos >= para.contentRange.start && cursorPos <= para.contentRange.end) {
        logDebug(pluginJson, `getTargetParagraphs: Found paragraph at cursor: "${para.content?.substring(0, 50) ?? ''}"`)
        return [para]
      }
    }
  }

  logDebug(pluginJson, `getTargetParagraphs: No paragraphs found`)
  return []
}

/**
 * Get a task and its subtasks (indented tasks below it)
 *
 * @param {TParagraph} para - The parent task paragraph
 * @param {$ReadOnlyArray<TParagraph>} allParagraphs - All paragraphs in the note
 * @returns {{ parent: TParagraph, subtasks: Array<TParagraph> }} Parent and subtasks
 */
function getTaskWithSubtasks(para: TParagraph, allParagraphs: $ReadOnlyArray<TParagraph>): { parent: TParagraph, subtasks: Array<TParagraph> } {
  const subtasks: Array<TParagraph> = []
  const parentIndent = para.indents ?? 0
  const parentIndex = allParagraphs.findIndex((p) => p.lineIndex === para.lineIndex)

  if (parentIndex === -1) {
    return { parent: para, subtasks: [] }
  }

  // Look at consecutive paragraphs after the parent
  for (let i = parentIndex + 1; i < allParagraphs.length; i++) {
    const nextPara = allParagraphs[i]
    const nextIndent = nextPara.indents ?? 0

    // If indent is greater than parent, it's a potential subtask
    if (nextIndent > parentIndent) {
      // Only include if it's an open task or checklist and not already a Todoist task
      if (isNonTodoistOpenTask(nextPara)) {
        subtasks.push(nextPara)
      }
    } else {
      // If we hit same or lower indent, stop
      break
    }
  }

  logDebug(pluginJson, `getTaskWithSubtasks: Found ${subtasks.length} subtasks for "${para.content?.substring(0, 30) ?? ''}"`)
  return { parent: para, subtasks }
}

/**
 * Create Todoist task from paragraph and update the paragraph with link
 *
 * @param {TParagraph} para - The paragraph to convert
 * @param {TNote} _note - The note containing the paragraph (unused, kept for API consistency)
 * @param {?string} parentId - Parent Todoist task ID for subtasks
 * @returns {Promise<?string>} The created Todoist task ID, or null on failure
 */
async function createTodoistTaskAndUpdateParagraph(para: TParagraph, _note: TNote, parentId: ?string = null): Promise<?string> {
  const content = para.content ?? ''
  if (!content.trim()) {
    logWarn(pluginJson, `createTodoistTaskAndUpdateParagraph: Empty content, skipping`)
    return null
  }

  // Parse task details
  const { content: cleanContent, priority, dueDate, labels } = parseTaskDetailsForTodoist(content)

  // Create task in Todoist
  const todoistTask = await createTodoistTaskInInbox(cleanContent, priority, dueDate, labels, parentId)
  if (!todoistTask || !todoistTask.id) {
    return null
  }

  // Append Todoist link to the original paragraph content
  const todoistLink = `[^](https://app.todoist.com/app/task/${todoistTask.id})`
  const newContent = `${content} ${todoistLink}`

  // Update the paragraph
  para.content = newContent
  if (para.note) {
    para.note.updateParagraph(para)
  } else {
    Editor.updateParagraph(para)
  }

  logInfo(pluginJson, `createTodoistTaskAndUpdateParagraph: Updated paragraph with Todoist link for task ${todoistTask.id}`)
  return todoistTask.id
}

/**
 * Convert selected non-Todoist tasks to Todoist tasks in the Inbox.
 * If text selected spanning multiple lines: find all non-Todoist open tasks in selection.
 * If no selection OR selection within a single line: operate on current line only.
 *
 * @returns {Promise<void>}
 */
export async function convertToTodoistTask(): Promise<void> {
  // Load settings (includes API token)
  setSettings()

  const note = Editor.note
  if (!note) {
    logWarn(pluginJson, 'convertToTodoistTask: No note open')
    return
  }

  // Get target paragraphs based on selection
  const targetParagraphs = getTargetParagraphs()
  if (targetParagraphs.length === 0) {
    logWarn(pluginJson, 'convertToTodoistTask: No paragraphs found at cursor/selection')
    await CommandBar.prompt('No tasks found', 'Could not find any paragraphs at the current cursor position.')
    return
  }

  logDebug(pluginJson, `convertToTodoistTask: Processing ${targetParagraphs.length} target paragraphs`)

  // Filter to non-Todoist open tasks only
  const eligibleTasks = targetParagraphs.filter((p) => isNonTodoistOpenTask(p))

  if (eligibleTasks.length === 0) {
    // Check if there were tasks that already had Todoist links
    const alreadyTodoist = targetParagraphs.filter((p) => {
      const content = p.content ?? ''
      return (p.type === 'open' || p.type === 'checklist') && /\[\^?\]\(https:\/\/app\.todoist\.com\/app\/task\/\d+\)/.test(content)
    })

    if (alreadyTodoist.length > 0) {
      await CommandBar.prompt('Already Todoist tasks', `${alreadyTodoist.length} task(s) already have Todoist links.`)
    } else {
      await CommandBar.prompt('No open tasks found', 'No open tasks found in the selection.')
    }
    return
  }

  logInfo(pluginJson, `convertToTodoistTask: Found ${eligibleTasks.length} eligible tasks to convert`)

  // Get all paragraphs for subtask detection
  const allParagraphs = note.paragraphs ?? []

  // Track results
  let successCount = 0
  let failureCount = 0
  const processedLineIndexes: Set<number> = new Set()

  // Process each eligible task
  for (const task of eligibleTasks) {
    // Skip if we already processed this task as a subtask of another
    if (processedLineIndexes.has(task.lineIndex)) {
      continue
    }

    // Check for subtasks
    const { parent, subtasks } = getTaskWithSubtasks(task, allParagraphs)

    // Create parent task
    const parentTodoistId = await createTodoistTaskAndUpdateParagraph(parent, note, null)
    processedLineIndexes.add(parent.lineIndex)

    if (parentTodoistId) {
      successCount++

      // Create subtasks with parent_id
      for (const subtask of subtasks) {
        // Skip if already processed
        if (processedLineIndexes.has(subtask.lineIndex)) {
          continue
        }

        const subtaskTodoistId = await createTodoistTaskAndUpdateParagraph(subtask, note, parentTodoistId)
        processedLineIndexes.add(subtask.lineIndex)

        if (subtaskTodoistId) {
          successCount++
        } else {
          failureCount++
        }
      }
    } else {
      failureCount++
    }
  }

  // Report results
  if (failureCount === 0) {
    await CommandBar.prompt('Tasks converted', `Successfully converted ${successCount} task(s) to Todoist.`)
  } else {
    await CommandBar.prompt('Conversion complete', `Converted ${successCount} task(s). ${failureCount} failed.`)
  }

  logInfo(pluginJson, `convertToTodoistTask: Completed. Success: ${successCount}, Failures: ${failureCount}`)
}

// ============================================================================
// SYNC STATUS ONLY FUNCTIONALITY
// ============================================================================

/**
 * Extract Todoist task ID from paragraph content
 *
 * @param {string} content - The paragraph content
 * @returns {?string} The Todoist task ID or null if not found
 */
function extractTodoistTaskId(content: string): ?string {
  // Task IDs can be numeric or alphanumeric (e.g., 6X4P4Mp38MWX3MW4)
  const match = content.match(/app\/task\/([a-zA-Z0-9]+)\)/)
  return match ? match[1] : null
}

/**
 * Fetch a single Todoist task by ID
 *
 * @param {string} taskId - The Todoist task ID
 * @returns {Promise<?Object>} The task object or null if not found
 */
async function fetchTodoistTask(taskId: string): Promise<?Object> {
  try {
    const url = `${todo_api}/tasks/${taskId}`
    logDebug(pluginJson, `fetchTodoistTask: Fetching ${url}`)
    const result = await fetch(url, getRequestObject())
    logDebug(pluginJson, `fetchTodoistTask: Raw response for ${taskId}: ${result}`)
    const parsed = JSON.parse(result)
    logDebug(pluginJson, `fetchTodoistTask: checked=${parsed.checked}, content=${parsed.content?.substring(0, 50)}`)
    return parsed
  } catch (error) {
    logWarn(pluginJson, `fetchTodoistTask: Could not fetch task ${taskId}: ${String(error)}`)
    return null
  }
}

/**
 * Sync only task completion status between NotePlan and Todoist.
 * Does NOT add or remove any tasks - only syncs status.
 *
 * For each Todoist-linked task in the current note:
 * - If NotePlan task is done/cancelled but Todoist is open → close in Todoist
 * - If NotePlan task is open but Todoist is completed → mark done in NotePlan
 *
 * @returns {Promise<void>}
 */
/**
 * Core function to sync status for a single note.
 * Returns stats about what was synced.
 *
 * @param {TNote} note - The note to sync
 * @param {boolean} useEditor - Whether to use Editor.updateParagraph (true for current note) or note.updateParagraph
 * @returns {Promise<{processed: number, closedInTodoist: number, closedInNotePlan: number, errors: number}>}
 */
async function syncStatusForNote(note: TNote, useEditor: boolean): Promise<{ processed: number, closedInTodoist: number, closedInNotePlan: number, errors: number }> {
  const paragraphs = note.paragraphs
  if (!paragraphs || paragraphs.length === 0) {
    return { processed: 0, closedInTodoist: 0, closedInNotePlan: 0, errors: 0 }
  }

  let closedInTodoist = 0
  let closedInNotePlan = 0
  let errors = 0
  let processed = 0

  for (const para of paragraphs) {
    const content = para.content ?? ''
    const taskId = extractTodoistTaskId(content)

    if (!taskId) {
      continue // Not a Todoist-linked task
    }

    processed++
    const npStatus = para.type // 'open', 'done', 'cancelled', etc.

    // Fetch current Todoist status
    const todoistTask = await fetchTodoistTask(taskId)
    if (!todoistTask) {
      logWarn(pluginJson, `syncStatus: Could not fetch Todoist task ${taskId}`)
      errors++
      continue
    }

    const todoistCompleted = todoistTask.checked === true

    logDebug(pluginJson, `Task ${taskId}: NP=${npStatus}, Todoist=${todoistCompleted ? 'completed' : 'open'}`)

    // Case 1: NotePlan is done/cancelled, Todoist is open → close in Todoist
    if ((npStatus === 'done' || npStatus === 'cancelled') && !todoistCompleted) {
      logInfo(pluginJson, `Closing task ${taskId} in Todoist (marked done in NotePlan)`)
      try {
        await closeTodoistTask(taskId)
        closedInTodoist++
      } catch (error) {
        logError(pluginJson, `Failed to close task ${taskId} in Todoist: ${String(error)}`)
        errors++
      }
    }

    // Case 2: NotePlan is open, Todoist is completed → mark done in NotePlan
    if (npStatus === 'open' && todoistCompleted) {
      logInfo(pluginJson, `Marking task ${taskId} done in NotePlan (completed in Todoist)`)
      para.type = 'done'
      if (useEditor) {
        Editor.updateParagraph(para)
      } else {
        note.updateParagraph(para)
      }
      closedInNotePlan++
    }

    // Case 3: NotePlan is done/cancelled, Todoist is also completed → already in sync
    // Case 4: NotePlan is open, Todoist is also open → already in sync
  }

  return { processed, closedInTodoist, closedInNotePlan, errors }
}

/**
 * Sync task completion status for the current note only.
 * Renamed from syncStatusOnly to syncStatus.
 *
 * @returns {Promise<void>}
 */
export async function syncStatus(): Promise<void> {
  setSettings()

  const note = Editor.note
  if (!note) {
    logWarn(pluginJson, 'syncStatus: No note open')
    return
  }

  logInfo(pluginJson, `syncStatus: Scanning ${note.paragraphs?.length ?? 0} paragraphs for Todoist tasks`)

  const stats = await syncStatusForNote(note, true)

  // Build result message
  const changes: Array<string> = []
  if (stats.closedInTodoist > 0) changes.push(`${stats.closedInTodoist} closed in Todoist`)
  if (stats.closedInNotePlan > 0) changes.push(`${stats.closedInNotePlan} marked done in NotePlan`)

  let message: string
  if (stats.processed === 0) {
    message = 'No Todoist-linked tasks found in this note.'
  } else if (changes.length === 0) {
    message = `All ${stats.processed} Todoist task(s) already in sync.`
  } else {
    message = `Synced ${stats.processed} task(s): ${changes.join(', ')}.`
  }

  if (stats.errors > 0) {
    message += ` (${stats.errors} error(s))`
  }

  await CommandBar.prompt('Status Sync Complete', message)
  logInfo(pluginJson, `syncStatus: ${message}`)
}

/**
 * Sync task completion status across all notes with Todoist frontmatter.
 * Searches for notes with todoist_id, todoist_ids, todoist_project_name, or todoist_project_names.
 *
 * @returns {Promise<void>}
 */
export async function syncStatusAll(): Promise<void> {
  setSettings()

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
    await CommandBar.prompt('Status Sync Complete', 'No notes found with Todoist frontmatter (todoist_id, todoist_ids, todoist_project_name, or todoist_project_names).')
    return
  }

  logInfo(pluginJson, `syncStatusAll: Found ${found_notes.size} notes with Todoist frontmatter`)

  let totalProcessed = 0
  let totalClosedInTodoist = 0
  let totalClosedInNotePlan = 0
  let totalErrors = 0
  let notesWithTasks = 0

  for (const [filename, note] of found_notes) {
    logInfo(pluginJson, `syncStatusAll: Processing ${filename}`)
    const stats = await syncStatusForNote(note, false)

    totalProcessed += stats.processed
    totalClosedInTodoist += stats.closedInTodoist
    totalClosedInNotePlan += stats.closedInNotePlan
    totalErrors += stats.errors

    if (stats.processed > 0) {
      notesWithTasks++
    }
  }

  // Build result message
  const changes: Array<string> = []
  if (totalClosedInTodoist > 0) changes.push(`${totalClosedInTodoist} closed in Todoist`)
  if (totalClosedInNotePlan > 0) changes.push(`${totalClosedInNotePlan} marked done in NotePlan`)

  let message: string
  if (totalProcessed === 0) {
    message = `Scanned ${found_notes.size} note(s), no Todoist-linked tasks found.`
  } else if (changes.length === 0) {
    message = `All ${totalProcessed} task(s) across ${notesWithTasks} note(s) already in sync.`
  } else {
    message = `Synced ${totalProcessed} task(s) across ${notesWithTasks} note(s): ${changes.join(', ')}.`
  }

  if (totalErrors > 0) {
    message += ` (${totalErrors} error(s))`
  }

  await CommandBar.prompt('Status Sync Complete', message)
  logInfo(pluginJson, `syncStatusAll: ${message}`)
}

// ============================================================================
// EXPORTS FOR TESTING
// These functions are exported to allow unit testing of pure logic
// ============================================================================

export {
  // Parsing functions
  extractTodoistTaskId,
  parseTaskDetailsForTodoist,
  isNonTodoistOpenTask,
  isDateFilterKeyword,
  parseDateFilterArg,
  getTaskWithSubtasks,
  parseCSVProjectNames,
  parseProjectIds,
  // API functions (for mocking tests)
  fetchTodoistTask,
  closeTodoistTask,
  createTodoistTaskInInbox,
  pullTodoistTasksByDateFilter,
  pullAllTodoistTasksByDateFilter,
  // Helper functions
  getRequestObject,
  postRequestObject,
}
