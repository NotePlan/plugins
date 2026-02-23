// @flow
//-----------------------------------------------------------------------------
// Generate Project section data
// Last updated 2026-02-19 for v2.4.0.b21, @jgclark
//-----------------------------------------------------------------------------

import { getNextProjectsToReview, getAllActiveProjects } from '../../jgclark.Reviews/src/allProjectsListHelpers'
import { Project } from '../../jgclark.Reviews/src/projectClass'
import { getDashboardSettings } from './dashboardHelpers'
import { nextProjectNoteItems } from './demoData'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import type { TDashboardSettings, TSection, TSectionItem } from './types'
import { logDebug, logInfo, logTimer, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { pluginIsInstalled } from '@helpers/NPConfiguration'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { getTeamspaceTitleFromID } from '@helpers/NPTeamspace'
import { smartPrependPara } from '@helpers/paragraph'
import { parseTeamspaceFilename } from '@helpers/teamspace'

/**
 * Make a Section for all projects ready for review, using data written by the Projects + Reviews plugin: getNextProjectsToReview().
 * First check that the Projects & Reviews plugin is installed.
 * Note: this is taking 1815ms for JGC
 * @param {TDashboardSettings} _config
 * @param {boolean} useDemoData?
 * @returns {TSection}
 */
export async function getProjectReviewSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  const thisSectionCode = 'PROJREVIEW'
  let itemCount = 0
  // const maxProjectsToShow = _config.maxItemsToShowInSection
  let nextProjectsToReview: Array<Project> = []
  const items: Array<TSectionItem> = []
  logInfo('getProjectReviewSectionData', `------- Gathering Project items for section ${thisSectionCode} --------`)
  const thisStartTime = new Date()
  const dashboardSettings = await getDashboardSettings()
  const allowedFolders = getCurrentlyAllowedFolders(dashboardSettings)

  if (useDemoData) {
    // add basic filtering by folder for the current Perspective
    const filteredProjects = nextProjectNoteItems.filter((p) => {
      const folder = getFolderFromFilename(p.filename)
      return allowedFolders.includes(folder)
    })

    filteredProjects.map((proj) => {
      const thisID = `${thisSectionCode}-${itemCount}`
      const thisFilename = proj.filename ?? '<filename not found>'
      const parsedPossibleTeamspace = parseTeamspaceFilename(thisFilename)
      items.push({
        ID: thisID,
        sectionCode: thisSectionCode,
        itemType: 'project',
        project: {
          filename: thisFilename,
          isTeamspace: parsedPossibleTeamspace?.isTeamspace ?? false, // TODO: is this really needed if we have teamspaceTitle in the item?
          title: proj.title ?? '(error)',
          reviewInterval: proj.reviewInterval ?? '',
          percentComplete: proj.percentComplete ?? NaN,
          lastProgressComment: proj.lastProgressComment ?? '',
          icon: proj.icon ?? undefined,
          iconColor: proj.iconColor ?? undefined,
          nextActions: proj.nextActionsRawContent ?? [],
          nextReviewDays: proj.nextReviewDays ?? 0,
        },
        teamspaceTitle: parsedPossibleTeamspace?.isTeamspace ? getTeamspaceTitleFromID(parsedPossibleTeamspace.teamspaceID ?? '') : undefined,
      })
      itemCount++
    })
  } else {
    // Get the next projects to review from the Project + Reviews plugin.
    if (!(await pluginIsInstalled('jgclark.Reviews'))) {
      logDebug('getProjectReviewSectionData', `jgclark.Reviews plugin is not installed, so returning empty section.`)
      // Continue to return empty section instead of null so it still displays (with appropriate message)
    } else {
      // Get all projects to review (and apply maxProjectsToShow limit later)
      // Note: Perspective filtering is done in P+R (since it was added in v1.1)
      nextProjectsToReview = await getNextProjectsToReview()
      if (nextProjectsToReview && nextProjectsToReview.length > 0) {
        nextProjectsToReview.map((p) => {
          const thisID = `${thisSectionCode}-${itemCount}`
          items.push({
            ID: thisID,
            sectionCode: thisSectionCode,
            itemType: 'project',
            // $FlowIgnore[prop-missing]
            project: {
              title: p.title,
              filename: p.filename,
              reviewInterval: p.reviewInterval,
              percentComplete: p.percentComplete,
              lastProgressComment: p.lastProgressComment,
              icon: p.icon ?? undefined,
              iconColor: p.iconColor ?? undefined,
              nextActions: p.nextActionsRawContent ?? [],
            },
          })
          itemCount++
        })
      } else {
        logDebug('getProjectReviewSectionData', `looked but found no notes to review`)
        // Continue to return empty section instead of null so it still displays
      }
    }
  }
  // clo(nextProjectsToReview, "nextProjectsToReview")
  let sectionDescription = `{countWithLimit} projects ready to review`
  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` in ${timer(thisStartTime)}`

  const section: TSection = {
    name: 'Projects to Review',
    showSettingName: 'showProjectReviewSection',
    ID: thisSectionCode,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    sectionItems: items,
    totalCount: items.length,
    FAIconClass: 'fa-regular fa-chart-gantt',
    // FAIconClass: 'fa-light fa-square-kanban',
    // NP has no sectionTitleColorPart, so will use default
    generatedDate: new Date(),
    isReferenced: false,
    actionButtons: [
      {
        display: '<i class="fa-regular fa-play"></i> Start Reviews',
        actionPluginID: 'jgclark.Reviews',
        actionName: 'startReviews',
        actionParam: '',
        tooltip: 'Start reviewing your Project notes',
      },
    ],
  }
  // console.log(JSON.stringify(section))
  logTimer('getProjectReviewSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)

  // TODO: remove this later.
  // Log the start of the generation to a special log note, if we're running. 
  if (config?.FFlag_ShowSectionTimings) {
    const logNote: ?TNote = await getOrMakeRegularNoteInFolder('Project Generation Log', '@Meta')
    if (logNote) {
      const newLogLine = `${new Date().toLocaleString()}: Dashboard -> ${nextProjectsToReview.length} Project(s) ready to Review, in ${timer(thisStartTime)}`
      smartPrependPara(logNote, newLogLine, 'list')
    }
  }

  return section
}

/**
 * Make a Section for all active projects (i.e. all those in current Perspective or allowed settings), using data written by the Projects + Reviews plugin: getAllActiveProjects().
 * First check that the Projects & Reviews plugin is installed.
 * @param {TDashboardSettings} _config
 * @param {boolean} useDemoData?
 * @returns {TSection}
 */
export async function getProjectActiveSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  const thisSectionCode = 'PROJACT'
  let itemCount = 0
  let allActiveProjects: Array<Project> = []
  const items: Array<TSectionItem> = []
  logInfo('getProjectActiveSectionData', `------- Gathering Active Project items for section ${thisSectionCode} --------`)
  const thisStartTime = new Date()
  const dashboardSettings = await getDashboardSettings()
  const allowedFolders = getCurrentlyAllowedFolders(dashboardSettings)

  if (useDemoData) {
    // add basic filtering by folder for the current Perspective
    const filteredProjects = nextProjectNoteItems.filter((p) => {
      const folder = getFolderFromFilename(p.filename)
      return allowedFolders.includes(folder)
    })

    filteredProjects.map((p) => {
      const thisID = `${thisSectionCode}-${itemCount}`
      const thisFilename = p.filename ?? '<filename not found>'
      items.push({
        ID: thisID,
        sectionCode: thisSectionCode,
        itemType: 'project',
        // $FlowIgnore[prop-missing]
        project: {
          title: p.title ?? '(error)',
          filename: thisFilename,
          reviewInterval: p.reviewInterval ?? '',
          percentComplete: p.percentComplete ?? NaN,
          lastProgressComment: p.lastProgressComment ?? '',
          icon: p.icon ?? undefined,
          iconColor: p.iconColor ?? undefined,
          nextActions: p.nextActionsRawContent ?? [],
        },
      })
      itemCount++
    })
  } else {
    // Get all active projects from the Project + Reviews plugin.
    if (!(await pluginIsInstalled('jgclark.Reviews'))) {
      logDebug('getProjectActiveSectionData', `jgclark.Reviews plugin is not installed, so returning empty section.`)
      // Continue to return empty section instead of null so it still displays (with appropriate message)
    } else {
      // Get all active projects (and apply maxProjectsToShow limit later), ordered in the simpler way for Dashboard, which still uses the main sort order setting from the Reviews plugin.
      // Note: Perspective filtering is done in P+R (since it was added in v1.1)
      allActiveProjects = await getAllActiveProjects(['nextReviewDays', 'title'], true) // true = dedupeList
      if (allActiveProjects && allActiveProjects.length > 0) {
        allActiveProjects.map((p) => {
          const thisID = `${thisSectionCode}-${itemCount}`
          items.push({
            ID: thisID,
            sectionCode: thisSectionCode,
            itemType: 'project',
            // $FlowIgnore[prop-missing]
            project: {
              title: p.title,
              filename: p.filename,
              reviewInterval: p.reviewInterval,
              percentComplete: p.percentComplete,
              lastProgressComment: p.lastProgressComment,
              icon: p.icon ?? undefined,
              iconColor: p.iconColor ?? undefined,
              nextActions: p.nextActionsRawContent ?? [],
            },
          })
          itemCount++
        })
      } else {
        logDebug('getProjectActiveSectionData', `looked but found no active projects`)
        // Continue to return empty section instead of null so it still displays
      }
    }
  }

  let sectionDescription = `{countWithLimit} active projects`

  // Filter out projects without next actions if setting is enabled
  if (dashboardSettings.showProjectActiveOnlyWithNextActions) {
    const originalCount = items.length
    const filteredItems = items.filter((item) => {
      if (item.project && item.project.nextActions) {
        return item.project.nextActions.length > 0
      }
      return false
    })
    items.length = 0 // Clear the array
    items.push(...filteredItems) // Replace with filtered items
    itemCount = items.length
    logDebug('getProjectActiveSectionData', `Filtered ${originalCount} projects to ${itemCount} projects with next actions`)
    if (originalCount > itemCount) sectionDescription += ` with next actions (from ${originalCount})`
  }

  sectionDescription += ` sorted by next review date`

  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` in ${timer(thisStartTime)}`

  const section: TSection = {
    name: 'Active Projects',
    showSettingName: 'showProjectActiveSection',
    ID: thisSectionCode,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    sectionItems: items,
    totalCount: items.length,
    FAIconClass: 'fa-regular fa-chart-gantt',
    // FAIconClass: 'fa-light fa-square-kanban',
    // NP has no sectionTitleColorPart, so will use default
    generatedDate: new Date(),
    isReferenced: false,
    actionButtons: [],
  }
  // console.log(JSON.stringify(section))
  logTimer('getProjectActiveSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)

  // TODO: remove this later.
  // Log the start of the generation to a special log note, if we're running. 
  if (config?.FFlag_ShowSectionTimings) {
    const logNote: ?TNote = await getOrMakeRegularNoteInFolder('Project Generation Log', '@Meta')
    if (logNote) {
      const newLogLine = `${new Date().toLocaleString()}: Dashboard -> ${allActiveProjects.length} Active Project(s), in ${timer(thisStartTime)}`
      smartPrependPara(logNote, newLogLine, 'list')
    }
  }

  return section
}
