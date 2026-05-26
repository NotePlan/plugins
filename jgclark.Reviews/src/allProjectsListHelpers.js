/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Supporting functions that deal with the allProjects list.
// by @jgclark
// Last updated 2026-05-11 for v2.0.0.b32 by @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project, getNoteChangeTimeMsForCache } from './projectClass.js'
import { calcReviewFieldsForProject, isProjectFinished } from './projectClassCalculations.js'
import { getReviewSettings, updateDashboardIfOpen, updateRichProjectListIfOpen } from './reviewHelpers.js'
import type { ReviewConfig } from './reviewHelpers.js'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toISODateString } from '@helpers/dateTime'
import { getFolderFromFilename, getFoldersMatching, getFolderListMinusExclusions } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { findNotesMatchingHashtagOrMentionFromList, getNoteFromFilename, getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { smartPrependPara } from '@helpers/paragraph'

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
export function parseAllProjectsListFileContent(content: ?string): ?Array<any> {
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
  return `${include}\u0002${ignore}`
}

function getFileAgeMs(prefName: string): number {
  // $FlowFixMe[incompatible-call] - DataStore.preference returns mixed, but we handle it
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
  const allProjects = parseAllProjectsListFileContent(content)
  console.log(`Contents of Projects List (JSON):`)
  console.log(allProjects != null ? stringifyProjectObjects(allProjects) : String(content))
}

export type ProjectNoteTagPair = {|
  note: TNote,
  projectTypeTag: string,
|}

/**
 * Build folder include list with subdirectories collapsed (same rules as list generation).
 * @param {ReviewConfig} config
 * @returns {Array<string>}
 */
function getFilteredFolderListWithoutSubdirs(config: ReviewConfig): Array<string> {
  const useIncludeBranch = (config.foldersToInclude?.length ?? 0) > 0
  const filteredFolderList = useIncludeBranch
    ? getFoldersMatching(config.foldersToInclude, false).sort()
    : getFolderListMinusExclusions(config.foldersToIgnore, false, false).sort()
  return filteredFolderList.reduce((acc: Array<string>, f: string) => {
    const exists = acc.some((s) => f.startsWith(s))
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
  const folderFiltered = filterProjectNotesByFolders([note], filteredFolderListWithoutSubdirs, config.foldersToIgnore ?? [])
  if (folderFiltered.length === 0) {
    return false
  }

  if (config.usePerspectives && config.includedTeamspaces && config.includedTeamspaces.length > 0) {
    const teamspaceFiltered = filterProjectNotesByTeamspaces([note], config.includedTeamspaces)
    if (teamspaceFiltered.length === 0) {
      return false
    }
  }

  const noteFolder = getFolderFromFilename(note.filename ?? '')
  const tagMatches = findNotesMatchingHashtagOrMentionFromList(projectTypeTag, [note], true, false, noteFolder, false, [])
  return tagMatches.some((n) => n.filename === note.filename)
}

/**
 * Append or replace one Project row in allProjectsList.json when the note is in current project selection.
 * Does not call generateAllProjectsList.
 * @param {TNote} note
 * @param {string} projectTypeTag
 * @param {ReviewConfig} config
 * @param {number} scrollPosForRichList
 * @param {{ skipUpdateDashboardIfOpen?: boolean }} options
 * @returns {Promise<boolean>} true when a row was written
 */
export async function addNewProjectToAllProjectsListIfInScope(
  note: TNote,
  projectTypeTag: string,
  config: ReviewConfig,
  scrollPosForRichList: number = 0,
  options?: { skipUpdateDashboardIfOpen?: boolean },
): Promise<boolean> {
  try {
    if (!isNoteInCurrentProjectSelection(note, config, projectTypeTag)) {
      logDebug('addNewProjectToAllProjectsListIfInScope', `Note '${note.filename ?? '?'}' with tag '${projectTypeTag}' is outside current project selection; skipping list update`)
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
    await writeAllProjectsList(allProjects, scrollPosForRichList, options?.skipUpdateDashboardIfOpen === true, config)
    return true
  } catch (error) {
    logError('addNewProjectToAllProjectsListIfInScope', JSP(error))
    return false
  }
}

/**
 * Enumerate project notes that match the same folder, tag, and teamspace rules as `allProjectsList.json` / `getAllMatchingProjects`.
 * Does not instantiate `Project` or read the projects-list cache.
 * @author @jgclark
 * @param {ReviewConfig} config - Validated review config (caller must not pass null)
 * @param {boolean} runInForeground - When true, shows CommandBar loading per folder (same as list generation)
 * @returns {Promise<Array<ProjectNoteTagPair>>}
 */
export async function enumerateMatchingProjectNoteTagPairs(
  config: ReviewConfig,
  runInForeground: boolean = false,
): Promise<Array<ProjectNoteTagPair>> {
  logDebug('enumerateMatchingProjectNoteTagPairs', `Starting for tags [${String(config.projectTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)

  const startTime = moment().toDate() // use moment to ensure we get a date in the local timezone

  const useIncludeBranch = (config.foldersToInclude?.length ?? 0) > 0
  const filteredFolderList = useIncludeBranch
    ? getFoldersMatching(config.foldersToInclude, false).sort()
    : getFolderListMinusExclusions(config.foldersToIgnore, false, false).sort()

  logDebug('enumerateMatchingProjectNoteTagPairs', `${config.usePerspectives ? `using Perspective '${config.perspectiveName ?? '?'}': ` : ''}foldersToInclude=[${String(config.foldersToInclude)}] foldersToIgnore=[${String(config.foldersToIgnore)}]`)
  const filteredFolderListWithoutSubdirs = getFilteredFolderListWithoutSubdirs(config)
  logDebug('enumerateMatchingProjectNoteTagPairs', `-> ${String(filteredFolderListWithoutSubdirs.length)} filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

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
    logDebug('enumerateMatchingProjectNoteTagPairs', `- after teamspace filter: ${filteredProjectNotes.length} project notes`)
  }

  logTimer('enumerateMatchingProjectNoteTagPairs', startTime, `- filteredProjectNotes: ${filteredProjectNotes.length} potential project notes`)

  const pairs: Array<ProjectNoteTagPair> = []
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use []
    const tags = config.projectTypeTags != null && config.projectTypeTags.length > 0 ? config.projectTypeTags : []

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating Project Review list for notes in folder ${folder}`)
    }

    // Get notes that include projectTag in this folder, ignoring subfolders
    for (const tag of tags) {
      const projectNotesArr = findNotesMatchingHashtagOrMentionFromList(tag, filteredProjectNotes, true, false, folder, false, [])
      for (const n of projectNotesArr) {
        pairs.push({ note: n, projectTypeTag: tag })
      }
    }
  }
  if (runInForeground) {
    CommandBar.showLoading(false)
  }
  logTimer('enumerateMatchingProjectNoteTagPairs', startTime, `- found ${pairs.length} note/tag pairs`)
  return pairs
}

/**
 * Return as Project instances all projects that match config items 'foldersToInclude', 'foldersToIgnore', and 'projectTypeTags'.
 * Note: These may be taken from the Perspective settings before being passed to this function.
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

  const pairs = await enumerateMatchingProjectNoteTagPairs(config, runInForeground)

  const snapshotRows = loadRawAllProjectsListSnapshot()
  const projectListRowByKey: Map<string, any> = new Map()
  for (const row of snapshotRows) {
    if (row != null && typeof row.filename === 'string' && row.filename !== '') {
      const tagForKey = getLeadingProjectTag(row)
      projectListRowByKey.set(makeProjectListCacheKey(row.filename, tagForKey), row)
    }
  }

  const sequentialTagResolved = config.sequentialTag ? config.sequentialTag : SEQUENTIAL_TAG_DEFAULT
  const projectInstances = []
  for (const { note: n, projectTypeTag: tag } of pairs) {
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
      np = new Project(n, tag, true, config.nextActionTags, sequentialTagResolved, false)
    }
    projectInstances.push(np)
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
    logDebug('generateAllProjectsList', `starting`)
    logInfo('generateAllProjectsList', `usePerspectives=${String(configIn?.usePerspectives)} perspective='${configIn?.perspectiveName ?? '-'}' foldersToInclude=[${String(configIn?.foldersToInclude)}] foldersToIgnore=[${String(configIn?.foldersToIgnore)}]`)
    const startTime = moment().toDate()

    // Get all project notes as Project instances
    const projectInstances = await getAllMatchingProjects(configIn, runInForeground)
    logInfo('generateAllProjectsList', `enumerated ${projectInstances.length} project instance(s) to write`)

    // Log the start this full generation to a special log note
    // TODO: Remove when v2.1.0 is released
    if (configIn?._logTimer === true || configIn?._logLevel === 'DEV') {
      const logNote: ?TNote = await getOrMakeRegularNoteInFolder('Project Generation Log', '@Meta')
      if (logNote) {
        const perspName = configIn.usePerspectives ? configIn.perspectiveName : '_no_'
        const newLogLine = `${new Date().toLocaleString().slice(0, 17)}: Reviews: (generateAllProjectsList with ${perspName} perspective) -> ${projectInstances.length} Project(s) generated, in ${timer(startTime)}`
        smartPrependPara(logNote, newLogLine, 'list')
      }
    }

    await writeAllProjectsList(projectInstances, scrollPosForRichList, skipUpdateDashboardIfOpen, configIn, skipRichProjectListIfOpen)
    return projectInstances
  } catch (error) {
    logError('generateAllProjectsList', JSP(error))
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
 * First checks how old the list is, and re-generates if more than 'maxAgeAllProjectsListInHours' hours old.
 * @author @jgclark
 * @returns {Promise<Array<Project>>} allProjects Object, the same as what is written to disk
 */
export async function getAllProjectsFromList(): Promise<Array<Project>> {
  try {
    logDebug('getAllProjectsFromList', `Starting ...`)
    const config = await getReviewSettings()
    if (!config) {
      logError('getAllProjectsFromList', 'No Reviews config found')
      return []
    }
    const startTime = moment().toDate()
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
  // Extend Project with projectTagOrder (sort key for firstTag mode: order matches config.projectTypeTags)
  projectInstances.forEach((pi) => {
    // $FlowIgnore[prop-missing] deliberate temporary extension to Project class
    pi.projectTagOrder = projectTypeTagsForOrder.indexOf(getLeadingProjectTag(pi))
  })

  // TODO: Finish reviewing how allProjectTags is really being used, and remove this logging.
  const sortingSpecification = (sortingOrder.length > 0) ? sortingOrder : buildSortingSpecification(config)
  // logDebug('sortProjectsList', `- sorting by ${String(sortingSpecification)}`)
  const sortedProjectInstances = sortListBy(projectInstances, sortingSpecification)
  // $FlowIgnore[prop-missing] deliberate temporary extension to Project class
  // sortedProjectInstances.forEach(pi => console.log(`${pi.projectTagOrder}\t[${String(pi.allProjectTags)}]\t${pi.nextReviewDays}\t${pi.dueDays}\t${pi.filename}`))
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
 * @param {{ skipUpdateDashboardIfOpen?: boolean }} options - optional; use `skipUpdateDashboardIfOpen: true` only from Dashboard list-sync path after PROJ* line changes
 */
export async function updateAllProjectsListAfterChange(
  filename: string,
  simplyDelete: boolean,
  config: ReviewConfig,
  scrollPosForRichList: number = 0,
  options?: { skipUpdateDashboardIfOpen?: boolean },
): Promise<void> {
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
            : (noteForAdd.hashtags ?? []).filter((tag: string) => tag.startsWith('#') && tag.length > 1)
        let added = false
        for (const tag of tagsToTry) {
          if (await addNewProjectToAllProjectsListIfInScope(noteForAdd, tag, config, scrollPosForRichList, options)) {
            added = true
          }
        }
        if (added) {
          logInfo('updateAllProjectsListAfterChange', `- Incrementally added '${filename}' to allProjects list`)
          return
        }
      }
      logWarn('updateAllProjectsListAfterChange', `Incremental add failed or note out of scope; will regenerate whole list.`)
      await generateAllProjectsList(config, false, scrollPosForRichList)
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
    await writeAllProjectsList(allProjects, scrollPosForRichList, options?.skipUpdateDashboardIfOpen === true, config)
    logInfo('updateAllProjectsListAfterChange', `- done writing ${allProjects.length} items to updated list 🔸`)
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
