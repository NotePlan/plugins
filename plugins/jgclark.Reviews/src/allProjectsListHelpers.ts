/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Supporting functions that deal with the allProjects list.
// by @jgclark
// Last updated 2024-10-11 for v1.0.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  logAvailableSharedResources, logProvidedSharedResources
} from '../../np.Shared/src/index.js'
import {
  getReviewSettings,
  type ReviewConfig,
  updateDashboardIfOpen,
} from './reviewHelpers.js'
import { Project } from './projectClass.js'
import {
  clo, JSP, logDebug, logError, logInfo, logTimer, logWarn,
} from '@np/helpers/dev'
import { getFoldersMatching, getFolderListMinusExclusions } from '@np/helpers/folders'
import {
  displayTitle
} from '@np/helpers/general'
import { findNotesMatchingHashtag } from '@np/helpers/NPnote'
import { sortListBy } from '@np/helpers/sorting'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const allProjectsListFilename = `../${pluginID}/allProjectsList.json` // to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const maxAgeAllProjectsListInHours = 1
const generatedDatePrefName = 'Reviews-lastAllProjectsGenerationTime'

//-------------------------------------------------------------------------------

function stringifyProjectObjects(objArray: Array<any>): string {
  /**
   * a function for JSON.stringify to pass through all except .note property
   * @returns {any}
   */
  function stringifyReplacer(key: string, value: any) {
    // Filtering out properties
    if (key === "note") {
      return undefined
    }
    return value
  }
  const output = JSON.stringify(objArray, stringifyReplacer, 0).replace(/},/g, '},\n')
  return output
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
 * Return all projects as Project instances, that match config items 'projectTypeTags'.
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground?
 * @returns {Promise<Array<Project>>}
 */
async function getAllMatchingProjects(configIn: any, runInForeground: boolean = false): Promise<Array<Project>> {

  const config = configIn ? configIn : await getReviewSettings() // get config from passed config if possible
  if (!config) throw new Error('No config found. Stopping.')

  logDebug('getAllMatchingProjects', `Starting for tags [${String(config.projectTypeTags)}], running in ${runInForeground ? 'foreground' : 'background'}`)
  const startTime = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

  // Get list of folders, excluding @specials and our foldersToInclude or foldersToIgnore settings -- include takes priority over ignore.
  const filteredFolderList = (config.foldersToInclude.length > 0)
    ? getFoldersMatching(config.foldersToInclude, true).sort()
    : getFolderListMinusExclusions(config.foldersToIgnore, true, false).sort()
  // For filtering DataStore, no need to look at folders which are in other folders on the list already
  const filteredFolderListWithoutSubdirs = filteredFolderList.reduce((acc: Array<string>, f: string) => {
    const exists = acc.some((s) => f.startsWith(s))
    if (!exists) acc.push(f)
    return acc
  }, [])
  // logDebug('getAllMatchingProjects', `- filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

  // filter DataStore one time, searching each item to see if it startsWith an item in filterFolderList
  // but need to deal with ignores here because of this optimization (in case an ignore folder is inside an included folder)
  // TODO: make the excludes an includes not startsWith
  let filteredDataStore = DataStore.projectNotes.filter(
    (f) => filteredFolderListWithoutSubdirs.some((s) => f.filename.startsWith(s)) && !config.foldersToIgnore.some((s) => f.filename.includes(`${s}/`.replace('//', '/')))
  )
  // Above ignores root notes, so if we have '/' folder, now need to add them
  if (filteredFolderListWithoutSubdirs.includes('/')) {
    const rootNotes = DataStore.projectNotes.filter((f) => !f.filename.includes('/'))
    filteredDataStore = filteredDataStore.concat(rootNotes)
    // logDebug('getAllMatchingProjects', `Added root folder notes: ${rootNotes.map((n) => n.title).join(' / ')}`)
  }

  logTimer(`getAllMatchingProjects`, startTime, `- filteredDataStore: ${filteredDataStore.length} potential project notes`)

  if (runInForeground) {
    CommandBar.showLoading(true, `Generating Project Review list`)
    // TODO: work out what to do about this: currently commented this out as it gives warnings because Editor is accessed.
    // await CommandBar.onAsyncThread()
  }

  // Iterate over the folders, using settings from config.foldersToProcess and config.foldersToIgnore list
  const projectInstances = []
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use []
    const tags = config.projectTypeTags != null && config.projectTypeTags.length > 0 ? config.projectTypeTags : []

    // Get notes that include projectTag in this folder, ignoring subfolders
    // Note: previous method using (plural) findNotesMatchingHashtags can't distinguish between a note with multiple tags of interest
    for (const tag of tags) {
      logDebug('getAllMatchingProjects', `looking for tag '${tag}' in project notes in folder '${folder}'...`)
      // Note: this is very quick <1ms
      const projectNotesArr = findNotesMatchingHashtag(tag, folder, false, [], true, filteredDataStore, false)
      if (projectNotesArr.length > 0) {
        // Get Project class representation of each note.
        // Save those which are ready for review in projectsReadyToReview array
        for (const n of projectNotesArr) {
          const np = new Project(n, tag, true, config.nextActionTag)
          projectInstances.push(np)
        }
      }
    }
  }
  if (runInForeground) {
    // await CommandBar.onMainThread()
    CommandBar.showLoading(false)
  }
  logTimer('getAllMatchingProjects', startTime, `- found ${projectInstances.length} available project notes`)
  return projectInstances
}

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
    // const startTime = new moment().toDate()
    // Get all project notes as Project instances
    const projectInstances = await getAllMatchingProjects(configIn, runInForeground)

    await writeAllProjectsList(projectInstances)
    return projectInstances
  } catch (error: any) {
    logError('generateAllProjectsList', JSP(error))
    return []
  }
}

export async function writeAllProjectsList(projectInstances: Array<Project>): Promise<void> {
  try {
    logDebug('writeAllProjectsList', `starting`)

    // write summary to allProjects JSON file, using a replacer to suppress .note
    logDebug('writeAllProjectsList', `Writing ${projectInstances.length} projects to ${allProjectsListFilename}`)
    const res = DataStore.saveData(stringifyProjectObjects(projectInstances), allProjectsListFilename, true)

    // If this appears to have worked:
    // - update the datestamp of the Reviews preference
    // - refresh Dashboard if open
    if (res) {
      const reviewListDate = Date.now()
      DataStore.setPreference(generatedDatePrefName, reviewListDate)
      await updateDashboardIfOpen()
    } else {
      logWarn(`writeAllProjectsList`, `Seems to be a problem saving JSON to '${allProjectsListFilename}'`)
    }
  } catch (error: any) {
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
    logDebug('updateProjectInAllProjectsList', `starting with ${allProjects.length} projectInstances`)

    // find the Project with matching filename
    const projectIndex = allProjects.findIndex((project) => project.filename === projectToUpdate.filename)
    allProjects[projectIndex] = projectToUpdate
    logDebug('updateProjectInAllProjectsList', `- will update project #${projectIndex} filename ${projectToUpdate.filename}`)

    // write to allProjects JSON file
    logDebug('updateProjectInAllProjectsList', `Writing ${allProjects.length} projects to ${allProjectsListFilename}`)
    await writeAllProjectsList(allProjects)
  } catch (error: any) {
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
    const startTime = new moment().toDate()
    let projectInstances: Array<Project>

    // But first check to see if it is more than a day old
    if (DataStore.fileExists(allProjectsListFilename)) {
      // read this from a NP preference
      // $FlowFixMe[incompatible-call]
      const reviewListDate = new Date(DataStore.preference(generatedDatePrefName) ?? 0)
      const fileAge = Date.now() - reviewListDate
      logDebug('getAllProjectsFromList', `- reviewListDate = ${String(reviewListDate)} = ${String(fileAge)} ago`)
      // If this note is more than a day old, then regenerate it
      if (fileAge > (1000 * 60 * 60 * maxAgeAllProjectsListInHours)) {
        logDebug('getAllProjectsFromList', `Regenerating allProjects list as more than ${String(maxAgeAllProjectsListInHours)} hours old`)
        // Call plugin command generateAllProjectsList (which produces the newer JSON file)
        projectInstances = await generateAllProjectsList()
      } else {
        // Otherwise we can read from the list
        logDebug('getAllProjectsFromList', `Reading from allProjectsList (as only ${(fileAge / (1000 * 60 * 60)).toFixed(2)} hours old)`)
        const content = DataStore.loadData(allProjectsListFilename, true) ?? `<error reading ${allProjectsListFilename}>`
        // Make objects from this (except .note)
        projectInstances = JSON.parse(content)
      }
    } else {
      // Need to generate it
      logDebug('getAllProjectsFromList', `Generating allProjects list as can't find it`)
      projectInstances = await generateAllProjectsList()
    }
    logTimer(`getAllProjectsFromList`, startTime, `- read ${projectInstances.length} Projects from allProjects list`)

    return projectInstances
  }
  catch (error) {
    logError(pluginJson, `generateAllProjectsList: ${error.message}`)
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
    const allProjects = await getAllProjectsFromList() ?? []
    logDebug(`getSpecificProjectFromList`, `- read ${String(allProjects.length)} Projects from allProjects list`)

    // find the Project with matching filename
    const projectInstance: null | void | Project = allProjects.find((project) => project.filename === filename)
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
 * @param {ReviewConfig} config 
 * @param {string?} projectTag to filter by (optional)
 * @returns 
 */
export async function filterAndSortProjectsList(config: ReviewConfig, projectTag: string = ''): Promise<Array<Project>> {
  try {
    // const startTime = new Date()
    let projectInstances = await getAllProjectsFromList()
    logDebug('filterAndSortProjectsList', `Starting for ${projectInstances.length} projects with tag '${projectTag}' ...`)

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

    // Sort projects by folder > nextReviewDays > dueDays > title
    const sortingSpecification = []
    // sortingSpecification.push('isPaused') //  oddly we need to put this first to make sure paused don't come at the top
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    sortingSpecification.push('isCancelled', 'isCompleted', 'isPaused') // i.e. 'active' before 'finished'
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('nextReviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }
    logDebug('filterAndSortProjectsList', `- sorting by ${String(sortingSpecification)}`)
    const sortedProjectInstances = sortListBy(projectInstances, sortingSpecification)
    // sortedProjectInstances.forEach(pi => logDebug('', `${pi.nextReviewDays}\t${pi.dueDays}\t${pi.filename}`))

    // logTimer(`filterAndSortProjectsList`, startTime, `Sorted ${sortedProjectInstances.length} projects`) // 2ms
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
 * @param {any} config
list (optional)
 */
export async function updateAllProjectsListAfterChange(
  // reviewedTitle: string,
  reviewedFilename: string,
  simplyDelete: boolean,
  config: any,
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

    const reviewedTitle = reviewedProject.title ?? 'error'
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
      // FIXME: stale data here TEST: still a problem?
      const updatedProject = new Project(reviewedNote, reviewedProject.projectTag, true, config.nextActionTag)
      clo(updatedProject, '🟡 updatedProject:')
      allProjects.push(updatedProject)
      logInfo('updateAllProjectsListAfterChange', `- Added Project '${reviewedTitle}'`)
    }
    // re-form the file
    await writeAllProjectsList(allProjects)
    logInfo('updateAllProjectsListAfterChange', `- Wrote  ${allProjects.length} items toupdated list`)

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
    // logDebug('getNextNoteToReview', `Starting ...`)
    const config: ReviewConfig = await getReviewSettings()

    // Get all available Projects -- not filtering by projectTag here
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return null
    }

    // Now read from the top until we find an item with 'nextReviewDays' <= 0, and not complete
    for (let i = 0; i < allProjectsSorted.length; i++) {
      const thisProject = allProjectsSorted[i]
      const thisNoteFilename = thisProject.filename ?? 'error'
      const nextReviewDays = thisProject.nextReviewDays ?? NaN
      if (nextReviewDays <= 0 && !thisProject.isCompleted && !thisProject.isPaused) { // = before today, or today, and not completed/paused
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
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `No notes ready or overdue for review 🎉`)
    return null
  } catch (error: any) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return null
  }
}

/**
 * Get list of the next note(s) to review (if any).
 * It assumes the full-review-list exists and is sorted by nextReviewDate (earliest to latest).
 * Note: v2, using the allProjects JSON file (not ordered but detailed)
 * Note: This is a variant of the original singular version above, and is used in jgclark.Dashboard/src/dataGeneration.js
 * @author @jgclark
 * @param { number } numToReturn first n notes to return, or 0 indicating no limit.
 * @return { Array<Project> } next Projects to review, up to numToReturn. Can be an empty array. Note: not a TNote but Project object.
 */
export async function getNextProjectsToReview(numToReturn: number = 6): Promise<Array<Project>> {
  try {
    logDebug(pluginJson, `Starting getNextProjectsToReview(${String(numToReturn)})) ...`)
    const config: ReviewConfig = await getReviewSettings()

    // Get all available Projects -- not filtering by projectTag here
    const allProjectsSorted = await filterAndSortProjectsList(config)

    if (!allProjectsSorted || allProjectsSorted.length === 0) {
      logWarn('getNextNoteToReview', `No active projects found, so stopping`)
      return []
    }

    // Now read from the top until we find an item with 'nextReviewDays' <= 0, and not complete,
    // and not the same as the previous item (which used to happen legitimately).
    // Continue until we have found up to numToReturn such notes.
    const projectsToReview: Array<Project> = []
    let lastFilename = ''
    for (let i = 0; i < allProjectsSorted.length; i++) {
      const thisProject = allProjectsSorted[i]
      const thisNoteFilename = thisProject.filename ?? 'error'
      const nextReviewDays = thisProject.nextReviewDays ?? NaN

      // Get items with review due before today, or today etc.
      if (nextReviewDays <= 0 && !thisProject.isCompleted && !thisProject.isPaused && thisNoteFilename !== lastFilename) {
        const thisNote = DataStore.projectNoteByFilename(thisNoteFilename)
        if (!thisNote) {
          logWarn('getNextNoteToReview', `Couldn't find note '${thisNoteFilename}' -- suggest you should re-run Project Lists to ensure this is up to date`)
          continue
        } else {
          // logDebug('reviews/getNextProjectsToReview', `- Next to review = '${displayTitle(noteToUse)}' with ${nextNotes.length} matches`)
          projectsToReview.push(thisProject)
        }
        if ((numToReturn > 0) && (projectsToReview.length >= numToReturn)) {
          break // stop processing the loop
        }
      }
      lastFilename = thisNoteFilename
    }

    if (projectsToReview.length > 0) {
      logDebug('reviews/getNextProjectsToReview', `- Returning ${projectsToReview.length} project notes ready for review:`)
      projectsToReview.forEach((p) => {
        logDebug('', `${p.title}`)
      })
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
