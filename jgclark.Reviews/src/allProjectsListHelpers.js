/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Supporting functions that deal with the allProjects list.
// by @jgclark
// Last updated 2026-01-16 for v1.3.0.b4, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project, calcReviewFieldsForProject } from './projectClass.js'
import {
  getReviewSettings,
  type ReviewConfig,
  updateDashboardIfOpen,
} from './reviewHelpers.js'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toISODateString } from '@helpers/dateTime'
import { getFoldersMatching, getFolderListMinusExclusions } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { findNotesMatchingHashtagOrMentionFromList, getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { smartPrependPara } from '@helpers/paragraph'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const allProjectsListFilename = `../${pluginID}/allProjectsList.json` // fully specified to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const maxAgeAllProjectsListInHours = 1
const generatedDatePrefName = 'Reviews-lastAllProjectsGenerationTime'
const MS_PER_HOUR = 1000 * 60 * 60
const ERROR_FILENAME_PLACEHOLDER = 'error'
const ERROR_READING_PLACEHOLDER = '<error reading'
const SEQUENTIAL_TAG_DEFAULT = '#sequential'

//-------------------------------------------------------------------------------
// Helper functions

/**
 * Convert date strings to Date objects for a project loaded from JSON
 * JSON.parse() converts Date objects to strings, so we need to restore them
 * @param {any} project - Project object loaded from JSON
 * @returns {any} Project object with Date fields converted to Date objects
 * @private
 */
function convertProjectDatesFromJSON(project: any): any {
  // Convert date string fields back to Date objects
  // Handles both old format (full ISO datetime: "2022-03-31T23:00:00.000Z") and new format (simple ISO date: "2022-03-31")
  // The new format stores dates as simple ISO date strings (YYYY-MM-DD) with no time component
  // Note: nextReviewDateStr is kept as a string (YYYY-MM-DD format), not converted to Date
  const dateFields = ['startDate', 'dueDate', 'reviewedDate', 'completedDate', 'cancelledDate']
  const converted = { ...project }
  
  for (const field of dateFields) {
    if (converted[field] != null && typeof converted[field] === 'string') {
      // Parse ISO date string to Date object
      // new Date() can parse both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" formats
      // For "YYYY-MM-DD", it creates a Date at midnight UTC (which may be a different day in local time)
      // but this is fine since we only use the date part for calculations via daysBetween() which handles timezones
      const dateObj = new Date(converted[field])
      // Only convert if the date is valid
      if (!isNaN(dateObj.getTime())) {
        converted[field] = dateObj
      } else {
        logWarn('convertProjectDatesFromJSON', `Invalid date string for ${field}: ${converted[field]}`)
        converted[field] = null
      }
    }
  }
  
  return converted
}

/**
 * Check if a project is ready for review (works with both Project instances and plain objects from JSON)
 * @param {Project | any} project - Project instance or plain object
 * @returns {boolean} True if project is ready for review
 * @private
 */
function isProjectReadyForReview(project: Project | any): boolean {
  // Check if it's a Project instance with the getter
  if (typeof project.isReadyForReview === 'boolean') {
    return project.isReadyForReview
  }
  // For plain objects from JSON, check the condition directly
  return !project.isPaused && !project.isCompleted && project.nextReviewDays != null && !isNaN(project.nextReviewDays) && project.nextReviewDays <= 0
}

/**
 * Find the first project ready for review from a sorted list
 * @param {Array<Project>} projects - Sorted array of projects
 * @returns {?Project} First ready project or null
 * @private
 */
function findFirstReadyProject(projects: Array<Project>): ?Project {
  return projects.find((project) => isProjectReadyForReview(project)) ?? null
}

/**
 * Find projects ready for review, avoiding duplicates
 * @param {Array<Project>} projects - Sorted array of projects
 * @param {number} maxCount - Maximum number to return (0 = no limit)
 * @returns {Array<Project>} Array of ready projects
 * @private
 */
function findReadyProjects(projects: Array<Project>, maxCount: number = 0): Array<Project> {
  const projectsToReview: Array<Project> = []
  let lastFilename = ''

  for (const thisProject of projects) {
    const thisNoteFilename = thisProject.filename ?? ERROR_FILENAME_PLACEHOLDER

    // Skip if duplicate or not ready
    if (thisNoteFilename === lastFilename || !isProjectReadyForReview(thisProject)) {
      lastFilename = thisNoteFilename
      continue
    }

    // Verify note exists
    const thisNote = DataStore.projectNoteByFilename(thisNoteFilename)
    if (!thisNote) {
      logWarn('findReadyProjects', `Couldn't find note '${thisNoteFilename}' -- suggest you should re-run Project Lists to ensure this is up to date`)
      lastFilename = thisNoteFilename
      continue
    }

    projectsToReview.push(thisProject)
    lastFilename = thisNoteFilename

    // Stop if we've reached the limit
    if (maxCount > 0 && projectsToReview.length >= maxCount) {
      break
    }
  }

  return projectsToReview
}

/**
 * Build sorting specification array based on config
 * @param {ReviewConfig} config - Review configuration
 * @returns {Array<string>} Array of field names to sort by
 * @private
 */
function buildSortingSpecification(config: ReviewConfig): Array<string> {
  const sortingSpec: Array<string> = []
  sortingSpec.push('projectTagOrder')

  if (config.displayGroupedByFolder) {
    sortingSpec.push('folder')
  }

  sortingSpec.push('isCancelled', 'isCompleted', 'isPaused') // i.e. 'active' before 'finished'

  switch (config.displayOrder) {
    case 'review':
      sortingSpec.push('nextReviewDays')
      break
    case 'due':
      sortingSpec.push('dueDays')
      break
    case 'title':
      sortingSpec.push('title')
      break
  }

  return sortingSpec
}

function stringifyProjectObjects(objArray: Array<any>): string {
  /**
   * a function for JSON.stringify to pass through all except .note property
   * and convert Date objects to simple ISO date strings (YYYY-MM-DD)
   * This includes: startDate, dueDate, reviewedDate, completedDate, cancelledDate
   * The time portion is never used, so we only store the date part (YYYY-MM-DD)
   * Also normalizes any existing date strings to YYYY-MM-DD format
   * @returns {any}
   */
  const dateFieldNames = ['startDate', 'dueDate', 'reviewedDate', 'completedDate', 'cancelledDate']
  const RE_ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
  
  function stringifyReplacer(key: string, value: any) {
    // Filtering out properties
    if (key === "note") {
      return undefined
    }
    // Remove any old nextReviewDate field (shouldn't exist, but handle legacy data)
    if (key === "nextReviewDate" && value != null) {
      return undefined // Remove this field entirely
    }
    // Only include icon and iconColor if they are set (not null/undefined/empty)
    if ((key === "icon" || key === "iconColor") && (value == null || value === '')) {
      return undefined // Don't include empty/null icon or iconColor
    }
    // Convert Date objects to simple ISO date strings (YYYY-MM-DD)
    // The time portion is never used, so we only store the date part
    if (value instanceof Date) {
      return toISODateString(value)
    }
    // Normalize date strings: if it's a date field and already a string, ensure it's in YYYY-MM-DD format
    // (handles old JSON files that might have full ISO datetime strings)
    if (dateFieldNames.includes(key) && typeof value === 'string' && value !== '') {
      // If it's a full ISO datetime string, extract just the date part
      if (RE_ISO_DATETIME.test(value)) {
        return value.substring(0, 10) // Extract YYYY-MM-DD from YYYY-MM-DDTHH:mm:ss.sssZ
      }
      // If it's already in YYYY-MM-DD format, return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value
      }
    }
    return value
  }
  const output = JSON.stringify(objArray, stringifyReplacer, 0).replace(/},/g, '},\n')
  return output
}

/**
 * Calculate file age in milliseconds
 * @param {string} prefName - Preference name storing the timestamp
 * @returns {number} File age in milliseconds, or Infinity if preference doesn't exist
 * @private
 */
function getFileAgeMs(prefName: string): number {
  // $FlowFixMe[incompatible-call] - DataStore.preference returns mixed, but we handle it
  const prefValue: mixed = DataStore.preference(prefName)
  const timestamp: number = typeof prefValue === 'number' ? prefValue : 0
  const reviewListDate = new Date(timestamp)
  return Date.now() - reviewListDate.getTime()
}

/**
 * Check if allProjects list file is too old and needs regeneration
 * @returns {boolean} True if file needs regeneration
 * @private
 */
function shouldRegenerateAllProjectsList(): boolean {
  if (!DataStore.fileExists(allProjectsListFilename)) {
    return true
  }
  const fileAgeMs = getFileAgeMs(generatedDatePrefName)
  const maxAgeMs = MS_PER_HOUR * maxAgeAllProjectsListInHours
  return fileAgeMs > maxAgeMs
}

//-------------------------------------------------------------------------------
// Main functions

/**
 * Filter list of regular notes by folder inclusion and exclusion rules.
 * It selects notes whose filenames start with any of the paths in the filteredFolderListWithoutSubdirs array. If the filteredFolderListWithoutSubdirs array includes '/', it will match all files in the root (i.e. not in a folder).
 * Note: filteredFolderListWithoutSubdirs and foldersToIgnore expect the paths to be without a leading or trailing slash (apart from root folder '/').
 * And it excludes notes whose filenames include any of the paths specified in the foldersToIgnore array.
 * (Note ignored folders can be inside an included folder.)
 * @author @jgclark, aided by oCurr
 * @tests available in jest file
 * @param {$ReadOnlyArray<TNote>} notesArray - Array of regular notes to filter
 * @param {Array<string>} filteredFolderListWithoutSubdirs - Array of folder paths to include
 * @param {Array<string>} foldersToIgnore - Array of folder paths to exclude
 * @returns {Array<TNote>} Filtered array of project notes
 */
export function filterProjectNotesByFolders(
  notesArray: $ReadOnlyArray<TNote>,
  filteredFolderListWithoutSubdirs: Array<string>,
  foldersToIgnore: Array<string>,
): Array<TNote> {
  const folderSet = new Set(filteredFolderListWithoutSubdirs)
  const ignoreSet = new Set(foldersToIgnore.map(s => `${s}/`.replace('//', '/')))
  return notesArray.filter(f => {
    // Check if file is in any of the filtered folders
    // For root folder ('/'), match all files without a folder path
    // Also check if filename starts with any other folder path
    const isRootMatch = folderSet.has('/') && !f.filename.includes('/')
    const isFolderMatch = Array.from(folderSet).some(folder => folder !== '/' && (f.filename === folder || f.filename.startsWith(`${folder}/`)))
    const isInFolder = isRootMatch || isFolderMatch
    const isIgnored = Array.from(ignoreSet).some(ignorePath => f.filename.includes(ignorePath))
    return isInFolder && !isIgnored
  })
}

/**
 * Filter list of regular notes by teamspace inclusion rules.
 * It selects notes that belong to teamspaces (or private space) specified in the includedTeamspaces array.
 * @author @jgclark
 * @param {$ReadOnlyArray<TNote>} notesArray - Array of regular notes to filter
 * @param {Array<string>} includedTeamspaces - Array of teamspace IDs to include ('private' for Private space)
 * @returns {Array<TNote>} Filtered array of project notes
 */
export function filterProjectNotesByTeamspaces(
  notesArray: $ReadOnlyArray<TNote>,
  includedTeamspaces: Array<string>,
): Array<TNote> {
  return notesArray.filter(note => {
    if (note.isTeamspaceNote && note.teamspaceID) {
      // Teamspace note - check if its ID is in the allowed list
      return includedTeamspaces.includes(note.teamspaceID)
    } else {
      // Private note - check if 'private' is in the allowed list
      return includedTeamspaces.includes('private')
    }
  })
}

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export async function logAllProjectsList(): Promise<void> {
  const content = DataStore.loadData(allProjectsListFilename, true) ?? `<error reading ${allProjectsListFilename}>`
  const allProjects = JSON.parse(content)
  console.log(`Contents of Projects List (JSON):`)
  console.log(stringifyProjectObjects(allProjects))
}

/**
 * Return as Project instances all projects that match config items 'foldersToInclude', 'foldersToIgnore', and 'projectTypeTags'.
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground?
 * @returns {Array<Project>}
 */
async function getAllMatchingProjects(configIn: any, runInForeground: boolean = false): Promise<Array<Project>> {
  const config = configIn ? configIn : await getReviewSettings() // get config from passed config if possible
  if (!config) throw new Error('No config found. Stopping.')

  logInfo('getAllMatchingProjects', `Starting for tags [${String(config.projectTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)
  const startTime = moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

  // Get list of folders, excluding @specials and our foldersToInclude or foldersToIgnore settings -- include takes priority over ignore.
  const filteredFolderList = (config.foldersToInclude.length > 0)
    ? getFoldersMatching(config.foldersToInclude, true).sort()
    : getFolderListMinusExclusions(config.foldersToIgnore, true, false).sort()

  // Filter out subdirectories from the list of folders.
  // It iterates over each folder in the filteredFolderList and checks if it is already represented in the accumulator array (acc).
  // The check is done by seeing if any folder in the accumulator starts with the current folder (f).
  // If the current folder is not a subdirectory of any folder already in the accumulator, it is added to the accumulator.
  // The result is an array of folders that do not include any subdirectories of folders already in the list.
  const filteredFolderListWithoutSubdirs = filteredFolderList.reduce((acc: Array<string>, f: string) => {
    const exists = acc.some((s) => f.startsWith(s))
    if (!exists) acc.push(f)
    return acc
  }, [])
  // logDebug('getAllMatchingProjects', `- filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

  // Filter the list of project notes from the DataStore.
  let filteredProjectNotes = filterProjectNotesByFolders(
    DataStore.projectNotes,
    filteredFolderListWithoutSubdirs,
    config.foldersToIgnore,
  )

  // If using Perspectives, also filter by teamspaces
  if (config.usePerspectives && config.includedTeamspaces && config.includedTeamspaces.length > 0) {
    filteredProjectNotes = filterProjectNotesByTeamspaces(
      filteredProjectNotes,
      config.includedTeamspaces,
    )
    logDebug('getAllMatchingProjects', `- after teamspace filter: ${filteredProjectNotes.length} project notes`)
  }

  logTimer(`getAllMatchingProjects`, startTime, `- filteredProjectNotes: ${filteredProjectNotes.length} potential project notes`)

  // Iterate over the folders, looking for notes that match the projectTypeTags
  const projectInstances = []
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use []
    const tags = config.projectTypeTags != null && config.projectTypeTags.length > 0 ? config.projectTypeTags : []

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating Project Review list for notes in folder ${folder}`)
    }

    // Get notes that include projectTag in this folder, ignoring subfolders
    for (const tag of tags) {
      // logDebug('getAllMatchingProjects', `looking for tag '${tag}' in project notes in folder '${folder}'...`)
      // Note: this is very quick <1ms
      const projectNotesArr = findNotesMatchingHashtagOrMentionFromList(tag, filteredProjectNotes, true, false, folder, false, [])
      if (projectNotesArr.length > 0) {
        // Get Project class representation of each note.
        // Save those which are ready for review in projectsReadyToReview array
        if (!runInForeground) {
          await CommandBar.onAsyncThread()
        }
        for (const n of projectNotesArr) {
          const np = new Project(n, tag, true, config.nextActionTags, config.sequentialTag ?? SEQUENTIAL_TAG_DEFAULT)
          projectInstances.push(np)
        }
        if (!runInForeground) {
          await CommandBar.onMainThread()
        }
      }
    }
  }
  if (runInForeground) {
    CommandBar.showLoading(false)
  }
  logTimer('getAllMatchingProjects', startTime, `- found ${projectInstances.length} available matching project notes`)
  return projectInstances
}

//-------------------------------------------------------------------------------
// Main functions

/**
 * Generate JSON representation of all project notes as Project objects that match the main folder and 'projectTypeTags' settings.
 * Not ordered in any particular way.
 * Output is written to file location set by `allProjectsListFilename`.
 * Note: This is V1 for JSON, borrowing from makeFullReviewList v3
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground? (default: false)
 * @returns {Promise<Array<Project>>} Object containing array of all Projects, the same as what was written to disk
 */
export async function generateAllProjectsList(configIn: any, runInForeground: boolean = false): Promise<Array<Project>> {
  try {
    logDebug('generateAllProjectsList', `starting`)
    const startTime = moment().toDate()
    // Get all project notes as Project instances
    const projectInstances = await getAllMatchingProjects(configIn, runInForeground)

    // Log the start this full generation to a special log note
    // Note: This logging may be removed in a future version
    const logNote: ?TNote = await getOrMakeRegularNoteInFolder('Project Generation Log', '@Meta')
    if (logNote) {
      const newLogLine = `${new Date().toLocaleString()}: Reviews (generateAllProjectsList) -> ${projectInstances.length} Project(s) generated, in ${timer(startTime)}`
      smartPrependPara(logNote, newLogLine, 'list')
    }

    await writeAllProjectsList(projectInstances)
    return projectInstances
  } catch (error) {
    logError('generateAllProjectsList', JSP(error))
    return []
  }
}

export async function writeAllProjectsList(projectInstances: Array<Project>): Promise<void> {
  try {
    // write summary to allProjects JSON file, using a replacer to suppress .note
    logInfo('writeAllProjectsList', `Writing ${projectInstances.length} projects to ${allProjectsListFilename} ...`)
    const res = DataStore.saveData(stringifyProjectObjects(projectInstances), allProjectsListFilename, true)

    // If this appears to have worked:
    // - update the datestamp of the Reviews preference
    // - update Dashboard window if open
    if (res) {
      const reviewListDate = Date.now()
      DataStore.setPreference(generatedDatePrefName, reviewListDate)
      logInfo('writeAllProjectsList', `- done at ${String(reviewListDate)}`)
      // await updateDashboardIfOpen() // TEST: leaving to calling functions
    } else {
      throw new Error(`Error writing JSON to '${allProjectsListFilename}'`)
    }
  } catch (error) {
    logError('writeAllProjectsList', JSP(error))
  }
}

/**
 * Update the Project object in allProjects list with matching filename
 * @author @jgclark
 * @param {Project} projectToUpdate
 */
export async function updateProjectInAllProjectsList(projectToUpdate: Project): Promise<void> {
  try {
    const allProjects = await getAllProjectsFromList()
    logDebug('updateProjectInAllProjectsList', `Starting with ${allProjects.length} projectInstances`)

    // find the Project with matching filename
    const projectIndex = allProjects.findIndex((project) => project.filename === projectToUpdate.filename)
    if (projectIndex === -1) {
      logWarn('updateProjectInAllProjectsList', `- couldn't find project with filename '${projectToUpdate.filename}' to update`)
      return
    }
    allProjects[projectIndex] = projectToUpdate
    logDebug('updateProjectInAllProjectsList', `- will update project #${String(projectIndex+1)} filename ${projectToUpdate.filename}`)

    // write to allProjects JSON file
    await writeAllProjectsList(allProjects)
    logDebug('updateProjectInAllProjectsList', `- done writing to allProjects list 🔸`)
  } catch (error) {
    logError('updateProjectInAllProjectsList', JSP(error))
  }
}

/**
 * Get all Project object instances from JSON list of all available project notes. Doesn't come ordered.
 * First checks to see how old the list is, and re-generates more than 'maxAgeAllProjectsListInHours' hours old.
 * @author @jgclark
 * @returns {Promise<Array<Project>>} allProjects Object, the same as what is written to disk
 */
export async function getAllProjectsFromList(): Promise<Array<Project>> {
  try {
    logDebug('getAllProjectsFromList', `Starting ...`)
    const startTime = moment().toDate()
    let projectInstances: Array<Project>

    // Check if file exists and is fresh enough
    if (shouldRegenerateAllProjectsList()) {
      if (DataStore.fileExists(allProjectsListFilename)) {
        const fileAgeMs = getFileAgeMs(generatedDatePrefName)
        const fileAgeHours = (fileAgeMs / MS_PER_HOUR).toFixed(2)
        logDebug('getAllProjectsFromList', `- Regenerating allProjects list as more than ${String(maxAgeAllProjectsListInHours)} hours old (currently ${fileAgeHours} hours)`)
      } else {
        logDebug('getAllProjectsFromList', `- Generating allProjects list as can't find it`)
      }
      projectInstances = await generateAllProjectsList()
    } else {
      // Read from the list
      const fileAgeMs = getFileAgeMs(generatedDatePrefName)
      const fileAgeHours = (fileAgeMs / MS_PER_HOUR).toFixed(2)
      logDebug('getAllProjectsFromList', `- Reading from current allProjectsList (as only ${fileAgeHours} hours old)`)
      const content = DataStore.loadData(allProjectsListFilename, true) ?? `${ERROR_READING_PLACEHOLDER} ${allProjectsListFilename}>`
      // Make objects from this (except .note)
      projectInstances = JSON.parse(content)
      
      // Convert date strings to Date objects (JSON.parse converts Date objects to strings)
      // TODO(later): is this still needed?
      logDebug('getAllProjectsFromList', `- Converting date strings to Date objects for ${projectInstances.length} projects`)
      projectInstances = projectInstances.map((project) => convertProjectDatesFromJSON(project))
      
      // Recalculate review fields for all projects since nextReviewDays may be stale
      // This is necessary because the JSON was written at a previous time, and nextReviewDays
      // needs to be recalculated based on the current date
      logDebug('getAllProjectsFromList', `- Recalculating review fields for ${projectInstances.length} projects loaded from JSON`)
      projectInstances = projectInstances.map((project) => calcReviewFieldsForProject(project))
    }
    logTimer(`getAllProjectsFromList`, startTime, `- read ${projectInstances.length} Projects from allProjects list`)

    return projectInstances
  }
  catch (error) {
    logError('getAllProjectsFromList', error.message)
    return []
  }
}

/**
 * Get the Project object instance from JSON list that matches by filename.
 * @author @jgclark
 * @param {string} filename
 * @returns {Project}
 */
export async function getSpecificProjectFromList(filename: string): Promise<Project | null> {
  try {
    logDebug('getSpecificProjectFromList', `Starting with filename '${filename}' ...`)
    const allProjects = await getAllProjectsFromList() ?? []
    logDebug('getSpecificProjectFromList', `- for ${allProjects.length} projects`)

    // find the Project with matching filename
    const projectInstance: ?Project = allProjects.find((project) => project.filename === filename)
    logDebug(`getSpecificProjectFromList`, `- read ${String(allProjects.length)} Projects from allProjects list`)
    // $FlowFixMe[incompatible-return]
    return projectInstance
  }
  catch (error) {
    logError(pluginJson, `getSpecificProjectFromList: ${error.message}`)
    return null
  }
}

/**
 * Filter and sort the list of Projects. Used by renderProjectLists().
 * (Last I checked it was running in 2ms.)
 * @param {ReviewConfig} config 
 * @param {string?} projectTag to filter by (optional)
 * @returns 
 */
export async function filterAndSortProjectsList(config: ReviewConfig, projectTag: string = ''): Promise<Array<Project>> {
  try {
    let projectInstances = await getAllProjectsFromList()
    logInfo('filterAndSortProjectsList', `Starting with tag '${projectTag}' for ${projectInstances.length} projects`)

    // Filter out projects that are not tagged with the projectTag
    if (projectTag !== '') {
      projectInstances = projectInstances.filter((pi) => pi.projectTag === projectTag)
    }

    // Filter out finished projects if required
    const displayFinished = config.displayFinished ?? false
    // if (displayFinished === 'hide') {
    if (!displayFinished) {
      projectInstances = projectInstances.filter((pi) => !pi.isCompleted).filter((pi) => !pi.isCancelled)
      logDebug('filterAndSortProjectsList', `- after filtering out finished, ${projectInstances.length} projects`)
    }

    // Filter out non-due projects if required
    const displayOnlyDue = config.displayOnlyDue ?? false
    if (displayOnlyDue) {
      projectInstances = projectInstances.filter((pi) => pi.nextReviewDays <= 0)
      logDebug('filterAndSortProjectsList', `- after filtering out non-due, ${projectInstances.length} projects`)
    }

    // Need to extend projectInstances with a proxy for the 'projectTag' field, so that we can sort by it according to the order it was given in config.projectTypeTags
    projectInstances.forEach((pi) => {
      // $FlowIgnore[prop-missing] deliberate temporary extension to Project class
      pi.projectTagOrder = config.projectTypeTags.indexOf(pi.projectTag)
    })

    // Sort projects by projectTagOrder > folder > [nextReviewDays | dueDays | title]
    const sortingSpecification = buildSortingSpecification(config)
    logDebug('filterAndSortProjectsList', `- sorting by ${String(sortingSpecification)}`)
    const sortedProjectInstances = sortListBy(projectInstances, sortingSpecification)
    // sortedProjectInstances.forEach(pi => logDebug('', `${pi.nextReviewDays}\t${pi.dueDays}\t${pi.filename}`))

    return sortedProjectInstances
  }
  catch (error) {
    logError('filterAndSortProjectsList', `error: ${error.message}`)
    return []
  }
}

//-------------------------------------------------------------------------------

/**
 * Update the allProjects list after completing a review or completing/cancelling a whole project.
 * Will notify Dashboard to update itself.
 * Note: Called by nextReview, skipReview, skipReviewForNote, completeProject, cancelProject, pauseProject.
 * @author @jgclark
 * @param {string} filename of note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {ReviewConfig} config
 */
export async function updateAllProjectsListAfterChange(
  // reviewedTitle: string,
  reviewedFilename: string,
  simplyDelete: boolean,
  config: ReviewConfig,
): Promise<void> {
  try {
    if (reviewedFilename === '') {
      throw new Error('Empty filename passed')
    }
    logInfo('updateAllProjectsListAfterChange', `--------- ${simplyDelete ? 'simplyDelete' : 'update'} for '${reviewedFilename}'`)

    // Get contents of full-review-list
    let allProjects = await getAllProjectsFromList()

    // Find right project to update
    const reviewedProject = allProjects.find((project) => project.filename === reviewedFilename)
    if (!reviewedProject) {
      logWarn('updateAllProjectsListAfterChange', `Couldn't find '${reviewedFilename}' to update in allProjects list, so will regenerate whole list.`)
      await generateAllProjectsList(config, false)
      return
    }

    const reviewedTitle = reviewedProject.title ?? ERROR_FILENAME_PLACEHOLDER
    logInfo('updateAllProjectsListAfterChange', `- Found '${reviewedTitle}' to update in allProjects list`)

    // delete this item from the list
    allProjects = allProjects.filter((project) => project.filename !== reviewedFilename)
    logInfo('updateAllProjectsListAfterChange', `- Deleted Project '${reviewedTitle}'`)

    // unless we simply need to delete, add updated item back into the list
    if (!simplyDelete) {
      const reviewedNote = await DataStore.noteByFilename(reviewedFilename, "Notes")
      if (!reviewedNote) {
        logWarn('updateAllProjectsListAfterChange', `Couldn't find '${reviewedFilename}' to update in allProjects list`)
        return
      }
      // Note: there had been issue of stale data here in the past. Leaving comment in case it's needed again.
      const updatedProject = new Project(reviewedNote, reviewedProject.projectTag, true, config.nextActionTags, config.sequentialTag ?? SEQUENTIAL_TAG_DEFAULT)
      // clo(updatedProject, 'in updateAllProjectsListAfterChange() 🟡 updatedProject:')
      allProjects.push(updatedProject)
      logInfo('updateAllProjectsListAfterChange', `- Added Project '${reviewedTitle}'`)
    }
    // re-form the file
    await writeAllProjectsList(allProjects)
    logInfo('updateAllProjectsListAfterChange', `- done writing ${allProjects.length} items to updated list 🔸`)

    // Finally, refresh Dashboard
    await updateDashboardIfOpen()
  }
  catch (error) {
    logError('updateAllProjectsListAfterChange', JSP(error))
  }
}

//-------------------------------------------------------------------------------

/**
 * Work out the next note to review (if any).
 * Note: v2, using the allProjects JSON file (not ordered but detailed), rather than the older full-review-list
 * Note: there is now a multi-note variant of this below
 * @author @jgclark
 * @return { ?TNote } next note to review (if any)
 */
export async function getNextNoteToReview(): Promise<?TNote> {
  try {
    logDebug(pluginJson, `getNextNoteToReview() starting ...`)
    const config: ReviewConfig = await getReviewSettings()

    // Get all available Projects -- not filtering by projectTag here
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      // Depending where this is called from, this may be quite possible or more of an error. With Perspective, review this.
      logInfo('getNextNoteToReview', '- No active projects found, so stopping.')
      return null
    }
    logDebug('getNextNoteToReview', `- ${allProjectsSorted.length} in projects list`)

    // Find first project ready for review
    const nextProject = findFirstReadyProject(allProjectsSorted)
    if (nextProject) {
      const thisNoteFilename = nextProject.filename ?? ERROR_FILENAME_PLACEHOLDER
      logDebug('getNextNoteToReview', `- Next to review -> '${thisNoteFilename}'`)
      const nextNote = DataStore.projectNoteByFilename(thisNoteFilename)
      if (!nextNote) {
        logWarn('getNextNoteToReview', `Couldn't find note '${thisNoteFilename}' -- suggest you should re-run Project Lists to ensure this is up to date`)
        return null
      } else {
        logDebug('getNextNoteToReview', `-> ${displayTitle(nextNote)}`)
        return nextNote
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `No notes ready or overdue for review 🎉`)
    return null
  } catch (error) {
    logError(pluginJson, `reviews/getNextNoteToReview: ${error.message}`)
    return null
  }
}

/**
 * Get list of the next Project(s) to review (if any).
 * Note: v2, using the allProjects JSON file (not ordered but detailed).
 * Note: This is a variant of the original singular version above, and is only used by jgclark.Dashboard/src/dataGenerationProjects.js
 * @author @jgclark
 * @param { number } numToReturn first n notes to return, or 0 indicating no limit. (Optional, default is 0)
 * @return { Array<Project> } next Projects to review, up to numToReturn. Can be an empty array. Note: not a TNote but Project object.
 */
export async function getNextProjectsToReview(numToReturn: number = 0): Promise<Array<Project>> {
  try {
    const config: ?ReviewConfig = await getReviewSettings(true)
    if (!config) {
      // Shouldn't get here, but this is a safety check.
      logDebug('reviews/getNextProjectsToReview', 'No config found, so assume jgclark.Reviews plugin is not installed. Stopping.')
      return []
    }
    logDebug('reviews/getNextProjectsToReview', `Called with numToReturn:${String(numToReturn)}`)

    // Get all available Projects -- not filtering by projectTag here
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return []
    }

    // Find projects ready for review, avoiding duplicates
    const projectsToReview = findReadyProjects(allProjectsSorted, numToReturn)

    if (projectsToReview.length > 0) {
      logDebug('reviews/getNextProjectsToReview', `- Returning ${projectsToReview.length} project notes ready for review`)
    } else {
      logDebug('reviews/getNextProjectsToReview', `- No project notes ready for review 🎉`)
    }
    return projectsToReview
  }
  catch (error) {
    logError('reviews/getNextProjectsToReview', JSP(error))
    return []
  }
}
