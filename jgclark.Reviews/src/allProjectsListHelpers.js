/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Supporting functions that deal with the allProjects list.
// by @jgclark
// Last updated 2026-09-18 for v2.2.1 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project, getNoteChangeTimeMsForCache } from './projectClass.js'
import { calcReviewFieldsForProject, isProjectFinished } from './projectClassCalculations.js'
import {
  getProjectTypeTagsFromNoteMetadata,
  noteHasProjectTypeTag,
  updateDashboardIfOpen,
  updateRichProjectListIfOpen,
} from './reviewHelpers.js'
import { getReviewSettings, type ReviewConfig } from './reviewSettings.js'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toISODateString } from '@helpers/dateTime'
import { getFolderFromFilename, getFoldersMatching, getFolderListMinusExclusions } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { RE_NOTE_FILE_EXTENSION } from '@helpers/NPFileExtensions'
import { getNoteFromFilename, getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { runSyncWorkOnAsyncThread } from '@helpers/NPThreads'
import { smartPrependPara } from '@helpers/paragraph'
import { sortListBy } from '@helpers/sorting'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const allProjectsListFilename = `../${pluginID}/allProjectsList.json` // fully specified to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const maxAgeAllProjectsListInHours = 1
const generatedDatePrefName = 'Reviews-lastAllProjectsGenerationTime'
const lastPerspectivePrefName = 'Reviews-lastAllProjectsPerspective'
const lastFolderFiltersPrefName = 'Reviews-lastAllProjectsFolderFilters'
const MS_PER_HOUR = 1000 * 60 * 60
const ERROR_FILENAME_PLACEHOLDER = 'error'
const ERROR_READING_PLACEHOLDER = '<error reading'
const SEQUENTIAL_TAG_DEFAULT = '#sequential'

/**
 * INFO-level duration for an allProjects list rebuild, incremental update, or access.
 * @param {string} functionName
 * @param {Date} startTime
 * @param {string} operation
 * @param {string} details
 * @returns {void}
 */
function logAllProjectsListDuration(functionName: string, startTime: Date, operation: string, details: string = ''): void {
  const suffix = details !== '' ? ` ${details}` : ''
  logInfo(functionName, `⏱️ ${operation} in ${timer(startTime)}${suffix}`)
}

/**
 * Options for writes to allProjectsList.json that may also refresh open windows.
 * `skipUpdateDashboardIfOpen`: Dashboard PROJ* HTML actions refresh Dashboard in-process instead.
 * `skipRichProjectListIfOpen`: caller will render the Rich list in-process (avoids same-plugin invoke of renderProjectListsIfOpen).
 */
export type AllProjectsListWriteOptions = {
  skipUpdateDashboardIfOpen?: boolean,
  skipRichProjectListIfOpen?: boolean,
}

/**
 * Special folders always excluded from project lists (matches foldersToIgnore setting description).
 * Other @folders (e.g. @Demo) may still be included when excludeSpecialFolders is false.
 */
export const ALWAYS_EXCLUDED_PROJECT_FOLDERS: Array<string> = ['@Archive', '@Templates', '@Trash']

/**
 * Merge user foldersToIgnore with always-excluded special folders (@Archive, @Templates, @Trash).
 * @param {Array<string>} foldersToIgnore - User-configured folders to ignore
 * @returns {Array<string>} Combined ignore list with always-excluded folders first
 */
export function getEffectiveFoldersToIgnore(foldersToIgnore: Array<string> = []): Array<string> {
  const userIgnores = Array.isArray(foldersToIgnore) ? foldersToIgnore.filter(Boolean) : []
  const merged: Array<string> = [...ALWAYS_EXCLUDED_PROJECT_FOLDERS]
  for (const folder of userIgnores) {
    if (!merged.some((f) => f.toLowerCase() === folder.toLowerCase())) {
      merged.push(folder)
    }
  }
  return merged
}

/**
 * Stable key for matching a cached allProjectsList row to `new Project(note, tag, ...)`.
 * @param {string} filename
 * @param {string} tag - Same tag as passed to Project constructor (project type tag)
 * @returns {string}
 */
function makeProjectListCacheKey(filename: string, tag: string): string {
  return `${filename}\u0000${tag}`
}

/**
 * Parse allProjectsList.json file content. Returns null if missing, empty, or not a JSON array (e.g. `{}`).
 * @param {?string} content - Raw file content
 * @returns {?Array<any>} Parsed project rows, or null if unusable
 */
export function parseAllProjectsListFileContent(content: ?string): Array<any> | null {
  if (content == null || content === '') {
    return null
  }
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    logWarn('parseAllProjectsListFileContent', error.message)
    return null
  }
}

/**
 * Read the on-disk allProjects list for constructor cache hints only (no age-based regeneration).
 * @returns {Array<any>}
 */
function loadRawAllProjectsListSnapshot(): Array<any> {
  try {
    if (!DataStore.fileExists(allProjectsListFilename)) {
      return []
    }
    const content = DataStore.loadData(allProjectsListFilename, true)
    return parseAllProjectsListFileContent(content) ?? []
  } catch (error) {
    logWarn('loadRawAllProjectsListSnapshot', error.message)
    return []
  }
}

/**
 * Verb for CommandBar progress while rebuilding the project list.
 * 'Refreshing' when a non-empty list already exists; 'Generating' on first build.
 * @param {Array<any>} [snapshotRows] - optional pre-loaded snapshot (avoids a second disk read)
 * @returns {'Generating' | 'Refreshing'}
 */
function getProjectListProgressVerb(snapshotRows: ?Array<any> = null): 'Generating' | 'Refreshing' {
  const rows = snapshotRows != null ? snapshotRows : loadRawAllProjectsListSnapshot()
  return rows.length > 0 ? 'Refreshing' : 'Generating'
}

//-------------------------------------------------------------------------------
// Helper functions

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
 * Get the primary project tag from a Project instance or project-like JSON object.
 * @param {Project | any} project
 * @returns {string}
 * @private
 */
function getLeadingProjectTag(project: Project | any): string {
  // Flow limitation, not something a real type can express: duck-typing a *class method* (`typeof x.method === 'function'`) always trips
  // [method-unbinding], and re-typing `project` as a structural object/interface only moves the same error to every call site (rows read
  // back from allProjectsList.json are plain objects, so the method genuinely may be absent).
  // Measured: replacing this param with `?{ +getLeadingProjectTag?: () => string, +allProjectTags?: mixed, ... }` turns this 1 suppressed
  // error into 6 real ones (2 each at the Project-instance call sites, lines ~510/952/1071) - a class method cannot flow into a
  // function-typed property slot. The suppression here is the narrowest available form.
  // $FlowIgnore[method-unbinding]
  if (project != null && typeof project.getLeadingProjectTag === 'function') {
    return project.getLeadingProjectTag()
  }
  const tags = Array.isArray(project?.allProjectTags) ? project.allProjectTags : []
  if (tags.length > 0 && typeof tags[0] === 'string' && tags[0].trim() !== '') {
    return tags[0].trim()
  }
  return '#project'
}

/**
 * Build sorting specification array based on config.
 * - firstTag mode: primary tag order per config.projectTypeTags > nextReviewDays > Title
 * - review mode: nextReviewDays > Title
 * - due mode: dueDays > Title
 * - title mode: Title
 * Where .displayGroupedByFolder is true, then add folder as first sort key.
 * @param {ReviewConfig} config - Review configuration
 * @returns {Array<string>} Array of field names to sort by
 */
export function buildSortingSpecification(
  config: ReviewConfig,
): Array<string> {
  const sortingSpec: Array<string> = []
  if (config.displayGroupedByFolder) {
    sortingSpec.push('folder')
  }
  switch (config.displayOrder) {
    case 'firstTag':
      sortingSpec.push('projectTagOrder', 'nextReviewDays', 'title')
      break
    case 'review':
      sortingSpec.push('nextReviewDays', 'title')
      break
    case 'due':
      sortingSpec.push('dueDays', 'title')
      break
    default:
    // For title and Unknown displayOrder: treat like title-only sort
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
  const dateFieldNames = ['startDate', 'dueDate', 'reviewedDate', 'completedDate', 'cancelledDate', 'nextReviewDateStr']
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
/**
 * Stable fingerprint for folder include/exclude filters (Dashboard perspectives or Reviews settings).
 * @param {ReviewConfig} config
 * @returns {string}
 */
function getFolderFilterFingerprint(config: ReviewConfig): string {
  const include = Array.isArray(config.foldersToInclude) ? config.foldersToInclude.join('\u0001') : String(config.foldersToInclude ?? '')
  const ignore = Array.isArray(config.foldersToIgnore) ? config.foldersToIgnore.join('\u0001') : String(config.foldersToIgnore ?? '')
  const teamspaces = Array.isArray(config.includedTeamspaces) ? config.includedTeamspaces.join('\u0001') : String(config.includedTeamspaces ?? '')
  return `${include}\u0002${ignore}\u0002${teamspaces}`
}

function getFileAgeMs(prefName: string): number {
  const prefValue: mixed = DataStore.preference(prefName)
  const timestamp: number = typeof prefValue === 'number' ? prefValue : 0
  const reviewListDate = new Date(timestamp)
  return Date.now() - reviewListDate.getTime()
}

/**
 * Check if allProjects list file is too old, corrupt, or (when using Dashboard perspectives) out of date for the active perspective.
 * @param {ReviewConfig} config - Current review config
 * @returns {boolean} True if file needs regeneration
 * @private
 */
function shouldRegenerateAllProjectsList(config: ReviewConfig): boolean {
  if (!DataStore.fileExists(allProjectsListFilename)) {
    return true
  }
  const content = DataStore.loadData(allProjectsListFilename, true)
  if (parseAllProjectsListFileContent(content) === null) {
    logWarn('shouldRegenerateAllProjectsList', `allProjectsList.json is missing, empty, or not a JSON array; will regenerate`)
    return true
  }
  const fileAgeMs = getFileAgeMs(generatedDatePrefName)
  const maxAgeMs = MS_PER_HOUR * maxAgeAllProjectsListInHours
  if (fileAgeMs > maxAgeMs) {
    return true
  }
  if (config.usePerspectives && config.perspectiveName) {
    const lastPref: mixed = DataStore.preference(lastPerspectivePrefName)
    const lastPerspective = typeof lastPref === 'string' ? lastPref : ''
    if (lastPerspective !== config.perspectiveName) {
      logInfo(
        'shouldRegenerateAllProjectsList',
        `Dashboard perspective changed ('${lastPerspective}' -> '${config.perspectiveName}'); will regenerate allProjects list`,
      )
      return true
    }
  }
  const fingerprint = getFolderFilterFingerprint(config)
  const lastFingerprintPref: mixed = DataStore.preference(lastFolderFiltersPrefName)
  const lastFingerprint = typeof lastFingerprintPref === 'string' ? lastFingerprintPref : ''
  if (fingerprint !== lastFingerprint) {
    logInfo(
      'shouldRegenerateAllProjectsList',
      `Folder filters changed (foldersToInclude/foldersToIgnore); will regenerate allProjects list`,
    )
    return true
  }
  return false
}

//-------------------------------------------------------------------------------
// Main functions

/**
 * Filter list of regular notes by folder inclusion and exclusion rules.
 * It selects notes whose filenames start with any of the paths in the filteredFolderListWithoutSubdirs array. If the filteredFolderListWithoutSubdirs array includes '/', it will match all files in the root (i.e. not in a folder).
 * Note: filteredFolderListWithoutSubdirs and foldersToIgnore expect the paths to be without a leading or trailing slash (apart from root folder '/').
 * And it excludes notes whose filenames include any of the paths specified in the foldersToIgnore array.
 * (Note ignored folders can be inside an included folder.)
 * Special case: ignoring '/' excludes only root-folder notes (filenames with no '/'), not every nested note.
 * Callers should pass getEffectiveFoldersToIgnore(...) so @Archive, @Templates and @Trash are always excluded.
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
  // Root '/' must not become ignore path '/' via `${s}/`.replace('//','/'), or filename.includes('/') would exclude every nested note.
  const ignoreRoot = foldersToIgnore.some((s) => s === '/')
  const ignoreSet = new Set(
    foldersToIgnore
      .filter((s) => s !== '/')
      .map((s) => (s.endsWith('/') ? s : `${s}/`)),
  )
  return notesArray.filter((f) => {
    // Check if file is in any of the filtered folders
    // For root folder ('/'), match all files without a folder path
    // Also check if filename starts with any other folder path
    const isRootNote = !f.filename.includes('/')
    const isRootMatch = folderSet.has('/') && isRootNote
    const isFolderMatch = Array.from(folderSet).some((folder) => folder !== '/' && (f.filename === folder || f.filename.startsWith(`${folder}/`)))
    const isInFolder = isRootMatch || isFolderMatch
    const isIgnored =
      (ignoreRoot && isRootNote) || Array.from(ignoreSet).some((ignorePath) => f.filename.includes(ignorePath))
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
  const allProjects = parseAllProjectsListFileContent(content)
  console.log(`Contents of Projects List (JSON):`)
  console.log(allProjects != null ? stringifyProjectObjects(allProjects) : String(content))
}

export type ProjectNoteTagPair = {|
  note: TNote,
  projectTypeTag: string,
|}

/**
 * Build full folder include list using foldersToInclude / foldersToIgnore, always excluding
 * @Archive, @Templates and @Trash (other @folders may still be included).
 * When foldersToInclude is set, still apply foldersToIgnore (same as Dashboard's getFoldersMatching(includes, …, excludes)).
 * @param {ReviewConfig} config
 * @returns {Array<string>}
 */
function getFilteredFolderList(config: ReviewConfig): Array<string> {
  const effectiveIgnores = getEffectiveFoldersToIgnore(config.foldersToIgnore ?? [])
  const useIncludeBranch = (config.foldersToInclude?.length ?? 0) > 0
  return useIncludeBranch
    ? getFoldersMatching(config.foldersToInclude, false, effectiveIgnores).sort()
    : getFolderListMinusExclusions(effectiveIgnores, false, false).sort()
}

/**
 * Build folder include list with subdirectories collapsed (same rules as list generation).
 * @param {ReviewConfig} config
 * @returns {Array<string>}
 */
function getFilteredFolderListWithoutSubdirs(config: ReviewConfig): Array<string> {
  const filteredFolderList = getFilteredFolderList(config)
  return filteredFolderList.reduce((acc: Array<string>, f: string) => {
    // Root '/' is not a path prefix of other folders (unlike f.startsWith('/') which is false for
    // normal names, but we also require a trailing-/ boundary so 'Projects' does not swallow 'ProjectsX').
    const exists = acc.some((s) => s !== '/' && (f === s || f.startsWith(`${s}/`)))
    if (!exists) acc.push(f)
    return acc
  }, [])
}

/**
 * Return true when a note matches the current project selection (folder, teamspace, and tag rules).
 * @param {TNote} note
 * @param {ReviewConfig} config
 * @param {string} projectTypeTag
 * @returns {boolean}
 */
export function isNoteInCurrentProjectSelection(note: TNote, config: ReviewConfig, projectTypeTag: string): boolean {
  if (projectTypeTag === '') {
    return false
  }
  const projectTypeTags =
    config.projectTypeTags != null && typeof config.projectTypeTags === 'string'
      ? [config.projectTypeTags]
      : (config.projectTypeTags ?? [])
  if (projectTypeTags.length > 0 && !projectTypeTags.includes(projectTypeTag)) {
    return false
  }

  const filteredFolderListWithoutSubdirs = getFilteredFolderListWithoutSubdirs(config)
  const folderFiltered = filterProjectNotesByFolders([note], filteredFolderListWithoutSubdirs, getEffectiveFoldersToIgnore(config.foldersToIgnore ?? []))
  if (folderFiltered.length === 0) {
    return false
  }

  if (config.usePerspectives && config.includedTeamspaces && config.includedTeamspaces.length > 0) {
    const teamspaceFiltered = filterProjectNotesByTeamspaces([note], config.includedTeamspaces)
    if (teamspaceFiltered.length === 0) {
      return false
    }
  }

  return noteHasProjectTypeTag(note, projectTypeTag)
}

/**
 * Append or replace one Project row in allProjectsList.json when the note is in current project selection.
 * Does not call generateAllProjectsList.
 * @param {TNote} note
 * @param {string} projectTypeTag
 * @param {ReviewConfig} config
 * @param {number} scrollPosForRichList
 * @param {AllProjectsListWriteOptions} options
 * @returns {Promise<boolean>} true when a row was written
 */
export async function addNewProjectToAllProjectsListIfInScope(
  note: TNote,
  projectTypeTag: string,
  config: ReviewConfig,
  scrollPosForRichList: number = 0,
  options?: AllProjectsListWriteOptions,
): Promise<boolean> {
  const startTime = moment().toDate()
  try {
    if (!isNoteInCurrentProjectSelection(note, config, projectTypeTag)) {
      // logDebug('addNewProjectToAllProjectsListIfInScope', `Note '${note.filename ?? '?'}' with tag '${projectTypeTag}' is outside current project selection; skipping list update`)
      logAllProjectsListDuration('addNewProjectToAllProjectsListIfInScope', startTime, 'updated', `(skipped; note outside current project selection)`)
      return false
    }

    let allProjects = await getAllProjectsFromList()
    const cacheKey = makeProjectListCacheKey(note.filename ?? '', projectTypeTag)
    allProjects = allProjects.filter((project) => makeProjectListCacheKey(project.filename ?? '', getLeadingProjectTag(project)) !== cacheKey)

    const newProject = new Project(
      note,
      projectTypeTag,
      true,
      config.nextActionTags,
      config.sequentialTag ?? SEQUENTIAL_TAG_DEFAULT,
      false,
    )
    allProjects.push(newProject)
    logInfo('addNewProjectToAllProjectsListIfInScope', `- Added Project '${newProject.title ?? note.filename ?? '?'}' (${projectTypeTag}) to allProjects list`)
    await writeAllProjectsList(allProjects, scrollPosForRichList, options?.skipUpdateDashboardIfOpen === true, config, options?.skipRichProjectListIfOpen === true)
    logAllProjectsListDuration('addNewProjectToAllProjectsListIfInScope', startTime, 'updated', `(added '${newProject.title ?? note.filename ?? '?'}' with ${projectTypeTag}; list now ${String(allProjects.length)})`)
    return true
  } catch (error) {
    logError('addNewProjectToAllProjectsListIfInScope', JSP(error))
    // logAllProjectsListDuration('addNewProjectToAllProjectsListIfInScope', startTime, 'updated', `(error)`)
    return false
  }
}

/**
 * Sync: build note/tag pairs from already-filtered notes (nested folder × tag × note loops).
 * Safe for `runSyncWorkOnAsyncThread` (only `CommandBar.showLoading` for UI).
 * Progress dialog text shows folder n/m; the progress ring is updated per note (notesProcessed / totalNotes).
 * @param {Array<TNote>} filteredProjectNotes
 * @param {Array<string>} filteredFolderList
 * @param {Array<string>} projectTypeTags
 * @param {boolean} runInForeground
 * @param {'Generating' | 'Refreshing'} progressVerb - 'Refreshing' when an existing list is being updated
 * @returns {Array<ProjectNoteTagPair>}
 */
function buildMatchingProjectNoteTagPairsSync(
  filteredProjectNotes: Array<TNote>,
  filteredFolderList: Array<string>,
  projectTypeTags: Array<string>,
  runInForeground: boolean,
  progressVerb: 'Generating' | 'Refreshing' = 'Generating',
): Array<ProjectNoteTagPair> {
  const pairs: Array<ProjectNoteTagPair> = []
  const tags = projectTypeTags != null && projectTypeTags.length > 0 ? projectTypeTags : []
  const totalFolders = filteredFolderList.length
  const listLabel = `${progressVerb} Project Review list`

  // Index notes by folder once so progress can advance per note (not once per folder).
  const notesByFolder: Map<string, Array<TNote>> = new Map()
  for (const note of filteredProjectNotes) {
    const folderPath = getFolderFromFilename(note.filename)
    const existing = notesByFolder.get(folderPath)
    if (existing) {
      existing.push(note)
    } else {
      notesByFolder.set(folderPath, [note])
    }
  }
  let totalNotes = 0
  for (const folder of filteredFolderList) {
    totalNotes += notesByFolder.get(folder)?.length ?? 0
  }

  let loadingShown = false
  try {
    if (runInForeground && totalFolders > 0) {
      if (totalNotes > 0) {
        CommandBar.showLoading(true, `${listLabel}\n0/${String(totalFolders)} folders`, 0)
      } else {
        CommandBar.showLoading(true, `${listLabel}\n0/${String(totalFolders)} folders`)
      }
      loadingShown = true
    }
    let notesProcessed = 0
    for (const folder of filteredFolderList) {
      const projectNotesInFolder = notesByFolder.get(folder) ?? []
      if (projectNotesInFolder.length === 0) {
        // Keep folder counter text moving; ring stays on notes-based fraction.
        if (loadingShown) {
          const progressFraction = totalNotes > 0 ? notesProcessed / totalNotes : 0
          CommandBar.showLoading(true, `${listLabel}:\nscanning notes in folder '${folder}'`, progressFraction)
        }
        continue
      }
      for (const n of projectNotesInFolder) {
        notesProcessed += 1
        for (const tag of tags) {
          if (noteHasProjectTypeTag(n, tag)) {
            pairs.push({ note: n, projectTypeTag: tag })
          }
        }
        // Update ring per note so % tracks notes, not folders (even when one folder has many notes).
        if (loadingShown && totalNotes > 0) {
          CommandBar.showLoading(true, `${listLabel}:\nscanning notes in folder '${folder}'`, notesProcessed / totalNotes)
        }
      }
    }
  } finally {
    if (loadingShown) {
      CommandBar.showLoading(false)
    }
  }
  return pairs
}

/**
 * Enumerate project notes that match the same folder, tag, and teamspace rules as `allProjectsList.json` / `getAllMatchingProjects`.
 * Does not instantiate `Project` or read the projects-list cache.
 * Heavy nested matching runs on an async thread when NotePlan supports it (3.21.3+).
 * @author @jgclark
 * @param {ReviewConfig} config - Validated review config (caller must not pass null)
 * @param {boolean} runInForeground - When true, shows CommandBar loading per folder (same as list generation)
 * @param {'Generating' | 'Refreshing'} progressVerb - Progress dialog verb when runInForeground (default: Generating)
 * @returns {Promise<Array<ProjectNoteTagPair>>}
 */
export async function enumerateMatchingProjectNoteTagPairs(
  config: ReviewConfig,
  runInForeground: boolean = false,
  progressVerb: 'Generating' | 'Refreshing' = 'Generating',
): Promise<Array<ProjectNoteTagPair>> {
  logDebug('enumerateMatchingProjectNoteTagPairs', `Starting for tags [${String(config.projectTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)

  const startTime = moment().toDate() // use moment to ensure we get a date in the local timezone

  const effectiveIgnores = getEffectiveFoldersToIgnore(config.foldersToIgnore ?? [])
  const filteredFolderList = getFilteredFolderList(config)

  logDebug('enumerateMatchingProjectNoteTagPairs', `${config.usePerspectives ? `using Perspective '${config.perspectiveName ?? '?'}': ` : ''}foldersToInclude=[${String(config.foldersToInclude)}] foldersToIgnore=[${String(effectiveIgnores)}]`)
  const filteredFolderListWithoutSubdirs = getFilteredFolderListWithoutSubdirs(config)
  logDebug('enumerateMatchingProjectNoteTagPairs', `-> ${String(filteredFolderListWithoutSubdirs.length)} filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

  // Filter the list of project notes from the DataStore.
  let filteredProjectNotes = filterProjectNotesByFolders(
    DataStore.projectNotes,
    filteredFolderListWithoutSubdirs,
    effectiveIgnores,
  )

  // If using Perspectives, also filter by teamspaces
  if (config.usePerspectives && config.includedTeamspaces && config.includedTeamspaces.length > 0) {
    filteredProjectNotes = filterProjectNotesByTeamspaces(
      filteredProjectNotes,
      config.includedTeamspaces,
    )
    logDebug('enumerateMatchingProjectNoteTagPairs', `- after teamspace filter: ${filteredProjectNotes.length} project notes`)
  }

  logTimer('enumerateMatchingProjectNoteTagPairs', startTime, `- filteredProjectNotes: ${filteredProjectNotes.length} potential project notes`)

  const projectTypeTags = config.projectTypeTags != null ? config.projectTypeTags : []
  // Side-channel: do not return large arrays from runOnAsyncThread (can hang the Promise).
  let pairsHolder: ?Array<ProjectNoteTagPair> = null
  await runSyncWorkOnAsyncThread('enumerateMatchingProjectNoteTagPairs', () => {
    pairsHolder = buildMatchingProjectNoteTagPairsSync(filteredProjectNotes, filteredFolderList, projectTypeTags, runInForeground, progressVerb)
    return true
  })
  const pairs: Array<ProjectNoteTagPair> =
    pairsHolder != null
      ? pairsHolder
      : buildMatchingProjectNoteTagPairsSync(filteredProjectNotes, filteredFolderList, projectTypeTags, runInForeground, progressVerb)
  if (pairsHolder == null) {
    logWarn('enumerateMatchingProjectNoteTagPairs', `- async result missing; built pairs on main thread`)
  }

  logTimer('enumerateMatchingProjectNoteTagPairs', startTime, `- found ${pairs.length} note/tag pairs`)
  return pairs
}

/**
 * Sync: construct Project instances from note/tag pairs, using allProjectsList cache hits when unchanged.
 * Safe for `runSyncWorkOnAsyncThread` (read-only; migrate flag is false). `showLoading` is allowed.
 * @param {Array<ProjectNoteTagPair>} pairs
 * @param {Map<string, any>} projectListRowByKey
 * @param {Array<string>} nextActionTags
 * @param {string} sequentialTagResolved
 * @param {boolean} runInForeground
 * @param {'Generating' | 'Refreshing'} progressVerb - When Refreshing, progress text uses that verb instead of Building
 * @returns {Array<Project>}
 */
function buildProjectsFromPairsSync(
  pairs: Array<ProjectNoteTagPair>,
  projectListRowByKey: Map<string, any>,
  nextActionTags: Array<string>,
  sequentialTagResolved: string,
  runInForeground: boolean = false,
  progressVerb: 'Generating' | 'Refreshing' = 'Generating',
): Array<Project> {
  const projectInstances: Array<Project> = []
  const total = pairs.length
  const listLabel = progressVerb === 'Refreshing' ? 'Refreshing Project Review list' : 'Building Project Review list'
  let loadingShown = false
  try {
    if (runInForeground && total > 0) {
      CommandBar.showLoading(true, `${listLabel}\n0/${String(total)}`, 0)
      loadingShown = true
    }
    let index = 0
    for (const { note: n, projectTypeTag: tag } of pairs) {
      index += 1
      if (loadingShown) {
        const title = (n.title ?? '').trim() !== '' ? (n.title ?? '').trim() : n.filename
        CommandBar.showLoading(true, `${listLabel}\n${String(index)}/${String(total)}\n${title}`, index / total)
      }
      const currentMs = getNoteChangeTimeMsForCache(n, true)
      const cacheKey = makeProjectListCacheKey(n.filename, tag)
      const cachedRow = projectListRowByKey.get(cacheKey)
      let np: Project
      if (
        currentMs != null &&
        cachedRow != null &&
        typeof cachedRow.noteChangedAtMs === 'number' &&
        cachedRow.noteChangedAtMs === currentMs
      ) {
        // logDebug('getAllMatchingProjects', `- Cache hit for ${tag} '${n.filename}'`)
        const cloned = { ...cachedRow }
        cloned.note = n
        np = calcReviewFieldsForProject(cloned)
      } else {
        logDebug('getAllMatchingProjects', `- Cache MISS, so calling Project constructor for ${tag} '${n.filename}'`)
        np = new Project(n, tag, true, nextActionTags, sequentialTagResolved, false)
      }
      projectInstances.push(np)
    }
  } finally {
    if (loadingShown) {
      CommandBar.showLoading(false)
    }
  }
  return projectInstances
}

/**
 * Return as Project instances all projects that match config items 'foldersToInclude', 'foldersToIgnore', and 'projectTypeTags'.
 * Note: These may be taken from the Perspective settings before being passed to this function.
 * Project construction runs on an async thread when NotePlan supports it (3.21.3+).
 * @author @jgclark
 * @param {ReviewConfig} configIn
 * @param {boolean} runInForeground? (default: false)
 * @returns {Array<Project>}
 */
async function getAllMatchingProjects(
  configIn: ReviewConfig,
  runInForeground: boolean = false,
): Promise<Array<Project>> {
  // get config from passed config if possible
  const config = configIn ? configIn : await getReviewSettings()
  if (!config) throw new Error('No config found. Stopping.')

  logDebug('getAllMatchingProjects', `Starting for tags [${String(config.projectTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)
  // logDebug('getAllMatchingProjects', `- foldersToInclude: [${String(config.foldersToInclude)}]`)
  // logDebug('getAllMatchingProjects', `- foldersToIgnore: [${String(config.foldersToIgnore)}]`)

  const startTime = moment().toDate() // use moment to ensure we get a date in the local timezone

  // Load snapshot first so progress dialogs can say Refreshing vs Generating, and for constructor cache hits.
  const snapshotRows = loadRawAllProjectsListSnapshot()
  const progressVerb = getProjectListProgressVerb(snapshotRows)

  const pairs = await enumerateMatchingProjectNoteTagPairs(config, runInForeground, progressVerb)

  const projectListRowByKey: Map<string, any> = new Map()
  for (const row of snapshotRows) {
    if (row != null && typeof row.filename === 'string' && row.filename !== '') {
      const tagForKey = getLeadingProjectTag(row)
      projectListRowByKey.set(makeProjectListCacheKey(row.filename, tagForKey), row)
    }
  }

  const sequentialTagResolved = config.sequentialTag ? config.sequentialTag : SEQUENTIAL_TAG_DEFAULT
  const nextActionTags = config.nextActionTags ?? []
  // Side-channel: do not return large Project arrays from runOnAsyncThread.
  let projectInstancesHolder: ?Array<Project> = null
  await runSyncWorkOnAsyncThread('getAllMatchingProjects build', () => {
    projectInstancesHolder = buildProjectsFromPairsSync(pairs, projectListRowByKey, nextActionTags, sequentialTagResolved, runInForeground, progressVerb)
    return true
  })
  const projectInstances: Array<Project> =
    projectInstancesHolder != null
      ? projectInstancesHolder
      : buildProjectsFromPairsSync(pairs, projectListRowByKey, nextActionTags, sequentialTagResolved, runInForeground, progressVerb)
  if (projectInstancesHolder == null) {
    logWarn('getAllMatchingProjects', `- async result missing; built projects on main thread`)
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
 * Note: This is taking between 600 and 3,333 ms/project for JGC's large vault in Sep 2026. Eek!
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground? (default: false)
 * @param {number} scrollPosForRichList - passed through to `writeAllProjectsList` for Rich list HTML scroll (pixels)
 * @returns {Promise<Array<Project>>} Object containing array of all Projects, the same as what was written to disk
 */
export async function generateAllProjectsList(
  configIn: any,
  runInForeground: boolean = false,
  scrollPosForRichList: number = 0,
  skipUpdateDashboardIfOpen: boolean = false,
  skipRichProjectListIfOpen: boolean = false,
): Promise<Array<Project>> {
  try {
    logDebug('generateAllProjectsList', `starting with usePerspectives=${String(configIn?.usePerspectives)} perspective='${configIn?.perspectiveName ?? '-'}' foldersToInclude=[${String(configIn?.foldersToInclude)}] foldersToIgnore=[${String(configIn?.foldersToIgnore)}]`)
    const startTime = moment().toDate()

    // Get all project notes as Project instances
    const projectInstances = await getAllMatchingProjects(configIn, runInForeground)
    logInfo('generateAllProjectsList', `enumerated ${projectInstances.length} project instance(s) to write`)

    // Diagnostic: Project Generation Log (gated by _logTimer / DEV). Remove after v2.1.0.
    if (configIn?._logTimer === true || configIn?._logLevel === 'DEV') {
      const logNote: ?TNote = await getOrMakeRegularNoteInFolder('Project Generation Log', '@Meta')
      if (logNote) {
        const perspName = configIn.usePerspectives ? configIn.perspectiveName : '_no_'
        const newLogLine = `${new Date().toLocaleString().slice(0, 17)}: Reviews: (generateAllProjectsList with ${perspName} perspective) -> ${projectInstances.length} Project(s) generated, in ${timer(startTime)}`
        smartPrependPara(logNote, newLogLine, 'list')
      }
    }

    await writeAllProjectsList(projectInstances, scrollPosForRichList, skipUpdateDashboardIfOpen, configIn, skipRichProjectListIfOpen)
    logAllProjectsListDuration('generateAllProjectsList', startTime, 'rebuilt', `(${String(projectInstances.length)} projects @ ${String(Math.round((moment().toDate() - startTime) / projectInstances.length))}ms/project)`)
    return projectInstances
  } catch (error) {
    logError('generateAllProjectsList', JSP(error))
    return []
  }
}

/**
 * Sync: re-parse every snapshot row into Project instances (or keep stale row if note missing).
 * Safe for `runSyncWorkOnAsyncThread` (read-only; migrate flag is false). `showLoading` is allowed.
 * @param {Array<any>} snapshotRows
 * @param {Array<string>} nextActionTags
 * @param {string} sequentialTagResolved
 * @param {boolean} runInForeground
 * @returns {{ rebuilt: Array<Project>, keptStale: number }}
 */
function recalculateProjectsFromSnapshotSync(
  snapshotRows: Array<any>,
  nextActionTags: Array<string>,
  sequentialTagResolved: string,
  runInForeground: boolean,
): { rebuilt: Array<Project>, keptStale: number } {
  const rebuilt: Array<Project> = []
  let keptStale = 0
  const total = snapshotRows.length
  let loadingShown = false
  try {
    if (runInForeground && total > 0) {
      CommandBar.showLoading(true, `Recalculating project list\n0/${String(total)}`, 0)
      loadingShown = true
    }
    let index = 0
    for (const row of snapshotRows) {
      index += 1
      const filename = typeof row?.filename === 'string' ? row.filename : ''
      if (loadingShown) {
        const label = (typeof row?.title === 'string' && row.title.trim() !== '') ? row.title.trim() : (filename !== '' ? filename : `item ${String(index)}`)
        CommandBar.showLoading(true, `Recalculating project list\n${String(index)}/${String(total)}\n${label}`, index / total)
      }
      if (filename === '') {
        logWarn('recalculateAllProjectsListItems', `Skipping row with no filename`)
        continue
      }
      const note = getNoteFromFilename(filename)
      if (!note) {
        logWarn('recalculateAllProjectsListItems', `Couldn't load '${filename}'; keeping previous list row`)
        rebuilt.push(calcReviewFieldsForProject({ ...row }))
        keptStale += 1
        continue
      }
      rebuilt.push(new Project(
        note,
        getLeadingProjectTag(row),
        true,
        nextActionTags,
        sequentialTagResolved,
        false,
      ))
    }
  } finally {
    if (loadingShown) {
      CommandBar.showLoading(false)
    }
  }
  return { rebuilt, keptStale }
}

/**
 * Re-parse every note already stored in allProjectsList.json using current next-action and progress-calculation settings.
 * Does not enumerate the vault (unlike {@link generateAllProjectsList}). If the list file is missing or empty, falls back to a full generate.
 * Note: This is taking 577ms/project for JGC in Sep 2026
 * Heavy re-parse runs on an async thread when NotePlan supports it (3.21.3+).
 * @author @jgclark
 * @param {ReviewConfig} configIn
 * @param {boolean} runInForeground? (default: false)
 * @param {number} scrollPosForRichList - passed through to `writeAllProjectsList` for Rich list HTML scroll (pixels)
 * @param {boolean} skipUpdateDashboardIfOpen
 * @param {boolean} skipRichProjectListIfOpen
 * @returns {Promise<Array<Project>>} Project instances written to disk
 */
export async function recalculateAllProjectsListItems(
  configIn: ReviewConfig,
  runInForeground: boolean = false,
  scrollPosForRichList: number = 0,
  skipUpdateDashboardIfOpen: boolean = false,
  skipRichProjectListIfOpen: boolean = false,
): Promise<Array<Project>> {
  try {
    const config = configIn ? configIn : await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const startTime = moment().toDate()
    const snapshotRows = loadRawAllProjectsListSnapshot()
    if (snapshotRows.length === 0) {
      logInfo('recalculateAllProjectsListItems', `No existing allProjects list rows; falling back to full generate`)
      return await generateAllProjectsList(config, runInForeground, scrollPosForRichList, skipUpdateDashboardIfOpen, skipRichProjectListIfOpen)
    }

    logInfo('recalculateAllProjectsListItems', `Recalculating ${String(snapshotRows.length)} existing allProjects list item(s)`)
    const sequentialTagResolved = config.sequentialTag ? config.sequentialTag : SEQUENTIAL_TAG_DEFAULT
    const nextActionTags = config.nextActionTags ?? []
    // Side-channel: do not return large Project arrays from runOnAsyncThread.
    let recalcHolder: ?{ rebuilt: Array<Project>, keptStale: number } = null
    await runSyncWorkOnAsyncThread('recalculateAllProjectsListItems', () => {
      recalcHolder = recalculateProjectsFromSnapshotSync(snapshotRows, nextActionTags, sequentialTagResolved, runInForeground)
      return true
    })
    const { rebuilt, keptStale } =
      recalcHolder != null
        ? recalcHolder
        : recalculateProjectsFromSnapshotSync(snapshotRows, nextActionTags, sequentialTagResolved, runInForeground)
    if (recalcHolder == null) {
      logWarn('recalculateAllProjectsListItems', `- async result missing; recalculated on main thread`)
    }

    await writeAllProjectsList(rebuilt, scrollPosForRichList, skipUpdateDashboardIfOpen, config, skipRichProjectListIfOpen)
    logAllProjectsListDuration('recalculateAllProjectsListItems', startTime, 'updated', `(recalculated ${String(rebuilt.length)} existing items @ ${String(Math.round((moment().toDate() - startTime) / rebuilt.length))}ms/project; kept stale ${String(keptStale)})`)
    return rebuilt
  } catch (error) {
    logError('recalculateAllProjectsListItems', JSP(error))
    if (runInForeground) {
      CommandBar.showLoading(false)
    }
    return []
  }
}

/**
 * Write the list of project instances to the allProjects list file.
 * After a successful save: updates the Reviews timestamp preference, refreshes the Rich project list (if open), then by default invokes Dashboard PROJ* refresh via {@link updateDashboardIfOpen}.
 *
 * **Same-plugin invoke race (Dashboard bundle):** When this code runs inside the Dashboard plugin (e.g. HTML bridge completing a PROJ* task), `updateDashboardIfOpen` uses `DataStore.invokePluginCommandByName('refreshSectionsByCode', 'jgclark.Dashboard', ...)`.
 * That can return before the webview refresh finishes. The bridge may then send `UPDATE_DATA` using a snapshot taken *before* the refresh, overwriting merged PROJ* data so the new next-action never appears even though `allProjectsList.json` is correct.
 * Callers in that situation pass `skipUpdateDashboardIfOpen: true` and run `refreshSectionsByCode` **in-process** after this function returns (see Dashboard `projectsListSync.js`).
 *
 * @author @jgclark
 * @param {Array<Project>} projectInstances - List of project instances to write
 * @param {number} scrollPosForRichList - Rich Project List HTML scroll (pixels) when `updateRichProjectListIfOpen` runs
 * @param {boolean} skipUpdateDashboardIfOpen - when true, skip `updateDashboardIfOpen` so the caller can refresh Dashboard synchronously (avoids the race above). Default false for normal Reviews-driven writes.
 * @param {ReviewConfig | null} configForMetadata - when set and `usePerspectives`, stores active Dashboard perspective name on successful write
 * @param {boolean} skipRichProjectListIfOpen - when true, skip `updateRichProjectListIfOpen` (caller will render once in-process, e.g. `generateProjectListsAndRenderIfOpen`)
 */
export async function writeAllProjectsList(
  projectInstances: Array<Project>,
  scrollPosForRichList: number = 0,
  skipUpdateDashboardIfOpen: boolean = false,
  configForMetadata: ?ReviewConfig = null,
  skipRichProjectListIfOpen: boolean = false,
): Promise<void> {
  try {
    if (!Array.isArray(projectInstances)) {
      logError('writeAllProjectsList', `Refusing to write: expected array of projects, got ${typeof projectInstances}`)
      return
    }
    // write summary to allProjects JSON file, using a replacer to suppress .note
    logDebug('writeAllProjectsList', `Writing ${projectInstances.length} projects to ${allProjectsListFilename} ...`)
    const res = DataStore.saveData(stringifyProjectObjects(projectInstances), allProjectsListFilename, true)

    // If this appears to have worked:
    // - update the datestamp of the Reviews preference
    // - refresh Rich Project List if open first (Reviews re-render completes before next step)
    // - then update Dashboard PROJ* sections if open (so Dashboard reflects the same JSON after P+R UI)
    if (res) {
      const reviewListDate = Date.now()
      DataStore.setPreference(generatedDatePrefName, reviewListDate)
      // Stamp perspective after every full generate so PROJ* refresh does not re-enter generate via perspective mismatch (see Dashboard perspective-switch path).
      if (configForMetadata?.usePerspectives && configForMetadata.perspectiveName) {
        DataStore.setPreference(lastPerspectivePrefName, configForMetadata.perspectiveName)
      }
      if (configForMetadata) {
        DataStore.setPreference(lastFolderFiltersPrefName, getFolderFilterFingerprint(configForMetadata))
      }
      logDebug('writeAllProjectsList', `- done at ${String(reviewListDate)}`)

      // Order matters: Rich list first, then Dashboard - avoids stale PROJ*; refreshSomeSections does not write JSON (no loop).
      if (!skipRichProjectListIfOpen) {
        await updateRichProjectListIfOpen(scrollPosForRichList)
      }
      if (!skipUpdateDashboardIfOpen) {
        await updateDashboardIfOpen()
      }
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
  const startTime = moment().toDate()
  try {
    const allProjects = await getAllProjectsFromList()
    logDebug('updateProjectInAllProjectsList', `Starting with ${allProjects.length} projectInstances`)

    // find the Project with matching filename
    const projectIndex = allProjects.findIndex((project) => project.filename === projectToUpdate.filename)
    if (projectIndex === -1) {
      logWarn('updateProjectInAllProjectsList', `- couldn't find project with filename '${projectToUpdate.filename}' to update`)
      // logAllProjectsListDuration('updateProjectInAllProjectsList', startTime, 'updated', `(skipped; '${projectToUpdate.filename}' not in list)`)
      return
    }
    allProjects[projectIndex] = projectToUpdate
    logDebug('updateProjectInAllProjectsList', `- will update project #${String(projectIndex+1)} filename ${projectToUpdate.filename}`)

    // write to allProjects JSON file
    await writeAllProjectsList(allProjects)
    logDebug('updateProjectInAllProjectsList', `- done writing to allProjects list 🔸`)
    logAllProjectsListDuration('updateProjectInAllProjectsList', startTime, 'updated', `(replaced '${projectToUpdate.filename}'; list now ${String(allProjects.length)})`)
  } catch (error) {
    logError('updateProjectInAllProjectsList', JSP(error))
    // logAllProjectsListDuration('updateProjectInAllProjectsList', startTime, 'updated', `(error)`)
  }
}

/**
 * Get all Project object instances from JSON list of all available project notes. Doesn't come ordered.
 * First checks how old the list is, and re-generates if more than 'maxAgeAllProjectsListInHours' hours old.
 * @author @jgclark
 * @returns {Promise<Array<Project>>} allProjects Object, the same as what is written to disk
 */
export async function getAllProjectsFromList(): Promise<Array<Project>> {
  try {
    logDebug('getAllProjectsFromList', `Starting ...`)
    const config = await getReviewSettings()
    const startTime = moment().toDate()
    if (!config) {
      logError('getAllProjectsFromList', 'No Reviews config found')
      logAllProjectsListDuration('getAllProjectsFromList', startTime, 'accessed', `(no Reviews config)`)
      return []
    }
    let projectInstances: Array<Project>

    // Check if file exists and is fresh enough
    if (shouldRegenerateAllProjectsList(config)) {
      if (DataStore.fileExists(allProjectsListFilename)) {
        const fileAgeMs = getFileAgeMs(generatedDatePrefName)
        const fileAgeHours = (fileAgeMs / MS_PER_HOUR).toFixed(2)
        logDebug('getAllProjectsFromList', `- Regenerating allProjects list (age ${fileAgeHours}h, corrupt file, and/or perspective change)`)
      } else {
        logDebug('getAllProjectsFromList', `- Generating allProjects list as can't find it`)
      }
      // Silent regen: no Rich/Dashboard side effects (callers refresh UI themselves).
      projectInstances = await generateAllProjectsList(config, false, 0, true, true)
    } else {
      // Read from the list
      const fileAgeMs = getFileAgeMs(generatedDatePrefName)
      const fileAgeHours = (fileAgeMs / MS_PER_HOUR).toFixed(2)
      logDebug('getAllProjectsFromList', `- Reading from current allProjectsList (as only ${fileAgeHours} hours old)`)
      const content = DataStore.loadData(allProjectsListFilename, true) ?? `${ERROR_READING_PLACEHOLDER} ${allProjectsListFilename}>`
      const parsed = parseAllProjectsListFileContent(content)
      if (parsed === null) {
        logWarn('getAllProjectsFromList', `allProjectsList.json is not a valid array; regenerating`)
        projectInstances = await generateAllProjectsList(config, false, 0, true, true)
      } else {
        // Make objects from this (except .note)
        // Date fields (startDate, dueDate, etc.) are stored as ISO strings (YYYY-MM-DD) and left as strings
        projectInstances = parsed
        // Recalculate review fields for all projects since nextReviewDays may be stale
        logDebug('getAllProjectsFromList', `- Recalculating review fields for ${projectInstances.length} projects loaded from JSON`)
        projectInstances = projectInstances.map((project) => calcReviewFieldsForProject(project))
      }
    }
    logTimer(`getAllProjectsFromList`, startTime, `- read ${projectInstances.length} Projects from allProjects list`)
    logAllProjectsListDuration('getAllProjectsFromList', startTime, 'accessed', `(${String(projectInstances.length)} projects)`)

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
 * @returns {?Project}
 */
export async function getSpecificProjectFromList(filename: string): Promise<?Project> {
  try {
    logDebug('getSpecificProjectFromList', `Starting with filename '${filename}' ...`)
    const allProjects = await getAllProjectsFromList() ?? []
    logDebug('getSpecificProjectFromList', `- for ${allProjects.length} projects`)

    // find the Project with matching filename
    const projectInstance: ?Project = allProjects.find((project) => project.filename === filename)
    logDebug(`getSpecificProjectFromList`, `- read ${String(allProjects.length)} Projects from allProjects list`)
    return projectInstance
  }
  catch (error) {
    logError(pluginJson, `getSpecificProjectFromList: ${error.message}`)
    return null
  }
}

/**
 * Resolve a project note from a Rich-list filename without creating a new empty note.
 * After complete/cancel + archive, the list can still hold the pre-move path; try that path,
 * then the same path under `@Archive/`, then the note title (searching all folders).
 * @param {string} filename - Filename from the Rich list click payload
 * @returns {?TNote} Existing note, or null if it cannot be found
 */
export function resolveProjectNoteFromListFilename(filename: string): ?TNote {
  if (!filename) {
    return null
  }
  const direct = getNoteFromFilename(filename)
  if (direct) {
    return direct
  }
  if (!filename.startsWith('@Archive/')) {
    const archived = getNoteFromFilename(`@Archive/${filename}`)
    if (archived) {
      return archived
    }
  }
  const titleGuess = filename.split('/').pop()?.replace(RE_NOTE_FILE_EXTENSION, '') ?? ''
  if (titleGuess === '') {
    return null
  }
  const byTitle = DataStore.projectNoteByTitle(titleGuess, true, true)
  if (byTitle && byTitle.length > 0) {
    const archivedMatch = byTitle.find((n) => (n.filename ?? '').startsWith('@Archive/'))
    return archivedMatch ?? byTitle[0]
  }
  return null
}

/**
 * Filter the list of Projects by finished/paused/due according to config.
 * Used by filterAndSortProjectsList(); can be used when only filtering is needed.
 * @param {Array<Project>} projectInstancesIn projects to filter (e.g. from getAllProjectsFromList)
 * @param {ReviewConfig} config
 * @param {boolean?} dedupeList? (Optional, default is false)
 * @returns {Promise<Array<Project>>} filtered projects (unsorted)
 */
export async function filterProjectsList(
  projectInstancesIn: Array<Project>,
  config: ReviewConfig,
  dedupeList?: boolean = false,
): Promise<Array<Project>> {
  try {
    let projectInstances = projectInstancesIn

    // Filter out finished projects if required
    const displayFinished = config.displayFinished ?? false
    // if (displayFinished === 'hide') {
    if (!displayFinished) {
      projectInstances = projectInstances.filter((pi) => !isProjectFinished(pi))
      logDebug('filterProjectsList', `- after filtering out finished, ${projectInstances.length} projects`)
    }

    // Filter out paused projects if required
    const displayPaused = config.displayPaused ?? true
    if (!displayPaused) {
      projectInstances = projectInstances.filter((pi) => !pi.isPaused)
      logDebug('filterProjectsList', `- after filtering out paused, ${projectInstances.length} projects`)
    }

    // Filter out non-due projects if required
    const displayOnlyDue = config.displayOnlyDue ?? false
    if (displayOnlyDue) {
      projectInstances = projectInstances.filter((pi) => pi.nextReviewDays <= 0)
      logDebug('filterProjectsList', `- after filtering out non-due, ${projectInstances.length} projects`)
    }

    // Dedupe the list if required
    if (dedupeList) {
      // Remove repeated projects with the same filename (keeping the first occurrence)
      const seenFilenames = new Set < string > ()
      projectInstances = projectInstances.filter((pi) => {
        if (seenFilenames.has(pi.filename ?? '')) {
          return false
        } else {
          seenFilenames.add(pi.filename ?? '')
          return true
        }
      })
      logDebug('filterAndSortProjectsList', `- after deduplication, ${projectInstances.length} projects`)
    }
    return projectInstances
  }
  catch (error) {
    logError('filterProjectsList', `error: ${error.message}`)
    return []
  }
}

/**
 * Sort a list of Projects by config-driven keys (see buildSortingSpecification), unless overridden by parameter 'sortingOrder'.
 * Mutates each project to add projectTagOrder (index in config.projectTypeTags for firstTag sort; for debug logging otherwise).
 * @param {Array<Project>} projectInstances projects to sort (e.g. from filterProjectsList)
 * @param {ReviewConfig} config
 * @param {Array<string>?} sortingOrder array of field names to sort by; if given overrides the default sorting order from the Reviews plugin. (Optional)
 * @returns {Array<Project>} sorted projects
 */
export function sortProjectsList(
  projectInstances: Array<Project>,
  config: ReviewConfig,
  sortingOrder: Array<string> = [],
): Array<Project> {
  // logDebug('sortProjectsList', `Starting with input sortingOrder: [${String(sortingOrder)}]`)
  const projectTypeTagsForOrder =
    config.projectTypeTags != null && typeof config.projectTypeTags === 'string' ? [config.projectTypeTags] : (config.projectTypeTags ?? [])
  // Set projectTagOrder (sort key for firstTag mode: order matches config.projectTypeTags); now declared on the Project class
  projectInstances.forEach((pi) => {
    pi.projectTagOrder = projectTypeTagsForOrder.indexOf(getLeadingProjectTag(pi))
  })

  const sortingSpecification = (sortingOrder.length > 0) ? sortingOrder : buildSortingSpecification(config)
  // logDebug('sortProjectsList', `- sorting by ${String(sortingSpecification)}`)
  const sortedProjectInstances = sortListBy(projectInstances, sortingSpecification)
  return sortedProjectInstances
}

/**
 * Filter and sort the list of Projects. Used by renderProjectLists().
 * @param {ReviewConfig} config
 * @param {string?} tag to filter by (optional)
 * @param {Array<string>?} sortingOrder array of field names to sort by; if given overrides the default sorting order from the Reviews plugin. (Optional)
 * @param {boolean?} dedupeList if true, deduplicate the list by removing projects with multiple 'tags'. (Optional, default is false)
 * @returns {Promise<[Array<Project>, number]>} [sorted projects, count after tag filter only - i.e. length before folder/due/paused/dedupe filters; use tuple[0].length for rows in the sorted list]
 */
export async function filterAndSortProjectsList(
  config: ReviewConfig,
  tag: string = '',
  sortingOrder: Array<string> = [],
  dedupeList?: boolean = false,
): Promise<[Array<Project>, number]> {
  const allProjectInstances = await getAllProjectsFromList()
  logInfo('filterAndSortProjectsList', `Starting with tag '${tag}' for ${allProjectInstances.length} projects`)
  
  // Filter out projects that are not tagged with the tag
  const projectInstancesForTag = (tag !== '')
    ? allProjectInstances.filter((pi) => pi.allProjectTags.includes(tag))
    : allProjectInstances

  const filteredProjectList = await filterProjectsList(projectInstancesForTag, config, dedupeList)

  const sortedProjectList = sortProjectsList(filteredProjectList, config, sortingOrder) 
  logInfo('filterAndSortProjectsList', `- filtered ${filteredProjectList.length} projects, sorted ${sortedProjectList.length} projects (before perspective filters: ${String(projectInstancesForTag.length)})`)
  return [sortedProjectList, projectInstancesForTag.length]
}

//-------------------------------------------------------------------------------

/**
 * Update the allProjects list after completing a review or completing/cancelling a whole project.
 * Persists via {@link writeAllProjectsList}, which normally notifies Dashboard. Will notify Dashboard to update itself unless skipped (see below).
 * Note: Called by nextReview, skipReview, skipReviewForNote, completeProject, cancelProject, pauseProject, plus Dashboard when completing/cancelling items in project next-action items.
 *
 * **`options.skipUpdateDashboardIfOpen`:** When the Dashboard HTML bridge calls this after `REMOVE_LINE_FROM_JSON`, pass `{ skipUpdateDashboardIfOpen: true }` so `writeAllProjectsList` does not call `updateDashboardIfOpen`.
 * The bridge then calls `refreshSectionsByCode` in-process so PROJ* merges complete before `processActionOnReturn` re-fetches shared data and sends `UPDATE_DATA` (avoids same-plugin invoke ordering; see `writeAllProjectsList` JSDoc).
 *
 * @author @jgclark
 * @param {string} filename of note that has been updated
 * @param {boolean} simplyDelete the project line?
 * @param {ReviewConfig} config
 * @param {number} scrollPosForRichList - Rich list HTML scroll when list is refreshed after write (default 0)
 * @param {AllProjectsListWriteOptions} options - optional; use `skipUpdateDashboardIfOpen: true` only from Dashboard list-sync path after PROJ* line changes. Use `skipRichProjectListIfOpen: true` when the caller will render the Rich list in-process.
 */
export async function updateAllProjectsListAfterChange(
  filename: string,
  simplyDelete: boolean,
  config: ReviewConfig,
  scrollPosForRichList: number = 0,
  options?: AllProjectsListWriteOptions,
): Promise<void> {
  const startTime = moment().toDate()
  try {
    if (filename === '') {
      throw new Error('Empty filename passed')
    }
    logInfo('updateAllProjectsListAfterChange', `--------- ${simplyDelete ? 'simplyDelete' : 'update'} for '${filename}'`)

    // Get contents of full-review-list
    let allProjects = await getAllProjectsFromList()

    // Find right project to update
    const reviewedProject = allProjects.find((project) => project.filename === filename)
    if (!reviewedProject) {
      logWarn('updateAllProjectsListAfterChange', `Couldn't find '${filename}' to update in allProjects list; trying incremental add if in scope`)
      const noteForAdd = getNoteFromFilename(filename)
      if (noteForAdd && !simplyDelete) {
        const projectTypeTags =
          config.projectTypeTags != null && typeof config.projectTypeTags === 'string'
            ? [config.projectTypeTags]
            : (config.projectTypeTags ?? [])
        const tagsToTry =
          projectTypeTags.length > 0
            ? projectTypeTags
            : getProjectTypeTagsFromNoteMetadata(noteForAdd)
        let added = false
        for (const tag of tagsToTry) {
          if (await addNewProjectToAllProjectsListIfInScope(noteForAdd, tag, config, scrollPosForRichList, options)) {
            added = true
          }
        }
        if (added) {
          // logInfo('updateAllProjectsListAfterChange', `- Incrementally added '${filename}' to allProjects list`)
          logAllProjectsListDuration('updateAllProjectsListAfterChange', startTime, 'updated', `(incrementally added '${filename}')`)
          return
        }
      }
      logWarn('updateAllProjectsListAfterChange', `Incremental add failed or note out of scope; will regenerate whole list.`)
      await generateAllProjectsList(config, false, scrollPosForRichList)
      logAllProjectsListDuration('updateAllProjectsListAfterChange', startTime, 'updated', `(delegated to full rebuild for '${filename}')`)
      return
    }

    const reviewedTitle = reviewedProject.title ?? ERROR_FILENAME_PLACEHOLDER
    logInfo('updateAllProjectsListAfterChange', `- Found '${reviewedTitle}' to update in allProjects list`)

    let updatedProject: ?Project = null
    // add updated item back into the list (unless we simply need to delete)
    if (!simplyDelete) {
      // Use teamspace-aware resolution (same idea as @helpers/NPParagraph completeItem). DataStore.noteByFilename(filename, 'Notes')
      // without teamspaceID returns null for teamspace paths, so we used to return early without writeAllProjectsList - leaving allProjectsList.json stale and PROJACT without the new next action.
      const reviewedNote = getNoteFromFilename(filename)
      if (!reviewedNote) {
        logWarn('updateAllProjectsListAfterChange', `Couldn't load note '${filename}' via getNoteFromFilename; not changing allProjects list`)
        // logAllProjectsListDuration('updateAllProjectsListAfterChange', startTime, 'updated', `(skipped; could not load '${filename}')`)
        return
      }
      // Note: there had been issue of stale data here in the past. Leaving comment in case it's needed again.
      updatedProject = new Project(
        reviewedNote,
        getLeadingProjectTag(reviewedProject),
        true,
        config.nextActionTags,
        config.sequentialTag ?? SEQUENTIAL_TAG_DEFAULT,
        false,
      )
      logInfo('updateAllProjectsListAfterChange', `- Built updated Project '${reviewedTitle}' for list`)
    }

    // Remove old row, then append rebuilt Project (if any), then persist - only after we know we can load the note for updates.
    allProjects = allProjects.filter((project) => project.filename !== filename)
    logInfo('updateAllProjectsListAfterChange', `- Removed '${reviewedTitle}' from in-memory list before re-add`)

    if (updatedProject) {
      allProjects.push(updatedProject)
      logInfo('updateAllProjectsListAfterChange', `- Added Project '${reviewedTitle}'`)
    }
    // re-form the file
    await writeAllProjectsList(allProjects, scrollPosForRichList, options?.skipUpdateDashboardIfOpen === true, config, options?.skipRichProjectListIfOpen === true)
    // logInfo('updateAllProjectsListAfterChange', `- done writing ${allProjects.length} items to updated list 🔸`)
    logAllProjectsListDuration('updateAllProjectsListAfterChange', startTime, 'updated', `(${simplyDelete ? 'deleted' : 'replaced'} '${filename}'; list now ${String(allProjects.length)})`)
  }
  catch (error) {
    logError('updateAllProjectsListAfterChange', JSP(error))
    // logAllProjectsListDuration('updateAllProjectsListAfterChange', startTime, 'updated', `(error)`)
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
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) { throw new Error('Stopping as I can\'t get the Review settings.') }

    // Get all available Projects -- not filtering by projectTag here
    const [allProjectsSorted, _numberProjectsUnfiltered] = await filterAndSortProjectsList(config)

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
        logWarn('getNextNoteToReview', `Couldn't find note '${thisNoteFilename}' -- please re-run Project Lists to ensure this is up to date`)
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
 * Get list of the next Project(s) ready to review (if any).
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
    const [allProjectsSorted, _numberProjectsUnfiltered] = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('reviews/getNextProjectsToReview', `No active projects found, so stopping`)
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

/**
 * Get list of all active Project(s). This is filtered according to the plugin settings, which may come from the Perspective set by the Dashboard.
 * It is sorted per buildSortingSpecification (folder when grouped, then first-tag / dates / title per displayOrder), unless sortingOrder is given instead.
 * If a project has multiple 'projectTags' it can appear multiple times in the list. If you don't want this (e.g. for Dashboard), then send flag 'dedupeList' to true.
 * @author @jgclark
 * @param { Array<string> } sortingOrder - array of field names to sort by; if given overrides the default sorting order from the Reviews plugin. (Optional)
 * @return { Array<Project> } all Projects for current perspective. Can be an empty array. Note: not a TNote but Project object.
 */
export async function getAllActiveProjects(
  sortingOrder: Array<string> = [],
  dedupeList: boolean = false,
): Promise<Array<Project>> {
  try {
    const config: ?ReviewConfig = await getReviewSettings(true)
    if (!config) {
      // Shouldn't get here, but this is a safety check.
      logDebug('reviews/getAllActiveProjects', 'No config found, so assume jgclark.Reviews plugin is not installed. Stopping.')
      return []
    }
    logDebug('reviews/getAllActiveProjects', `Starting for perspective ${config.perspectiveName}`)

    // Get all active Projects, filtered/sorted/deduped as specified according to the current perspective settings (which are overriden in config) and these parameters.
    const [allActiveProjectsSorted, _numberProjectsUnfiltered] = await filterAndSortProjectsList(config, '', sortingOrder, dedupeList)
    if (!allActiveProjectsSorted || allActiveProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return []
    }
    if (allActiveProjectsSorted.length > 0) {
      logDebug('reviews/getAllActiveProjects', `- Returning ${allActiveProjectsSorted.length} projects for current perspective`)
    } else {
      logDebug('reviews/getAllActiveProjects', `- No projects found for current perspective 🎉`)
    }
    return allActiveProjectsSorted
  }
  catch (error) {
    logError('reviews/getAllActiveProjects', JSP(error))
    return []
  }
}
