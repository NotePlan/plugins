// @flow
//-----------------------------------------------------------------------------
// Generate Project section data
// Last updated 2026-02-19 for v2.4.0.b21, @jgclark
//-----------------------------------------------------------------------------

import { getNextProjectsToReview, getAllActiveProjects } from '../../jgclark.Reviews/src/allProjectsListHelpers'
import { Project } from '../../jgclark.Reviews/src/projectClass'
import { getDashboardSettings, makeDashboardParas } from './dashboardHelpers'
import { nextProjectNoteItems } from './demoData'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import type { TDashboardSettings, TSection, TSectionCode, TSectionItem } from './types'
import { logDebug, logInfo, logTimer, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { pluginIsInstalled } from '@helpers/NPConfiguration'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { findParaFromRawContentAndFilename, findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { getTeamspaceTitleFromID } from '@helpers/NPTeamspace'
import { smartPrependPara } from '@helpers/paragraph'
import { parseTeamspaceFilename } from '@helpers/teamspace'

function makeProjectRowItem(sectionCode: TSectionCode, project: any, itemCount: number): TSectionItem {
  const thisID = `${sectionCode}-${itemCount}`
  const thisFilename = project.filename ?? '<filename not found>'
  const parsedPossibleTeamspace = parseTeamspaceFilename(thisFilename)

  return {
    ID: thisID,
    sectionCode: sectionCode,
    itemType: 'project',
    // $FlowIgnore[prop-missing]
    project: {
      filename: thisFilename,
      isTeamspace: parsedPossibleTeamspace?.isTeamspace ?? false,
      title: project.title ?? '(error)',
      reviewInterval: project.reviewInterval ?? '',
      percentComplete: project.percentComplete ?? NaN,
      lastProgressComment: project.lastProgressComment ?? '',
      icon: project.icon ?? undefined,
      iconColor: project.iconColor ?? undefined,
      nextActions: project.nextActionsRawContent ?? [],
      nextReviewDays: project.nextReviewDays ?? 0,
    },
    teamspaceTitle: parsedPossibleTeamspace?.isTeamspace ? getTeamspaceTitleFromID(parsedPossibleTeamspace.teamspaceID ?? '') : undefined,
  }
}

/**
 * Build clickable child task rows from project next-action text.
 * @param {string} sectionCode
 * @param {string} parentID
 * @param {string} projectFilename
 * @param {Array<string>} nextActionsRawContent
 * @param {number} projectIndex
 * @returns {Array<TSectionItem>}
 */
function makeNextActionTaskItems(
  sectionCode: TSectionCode,
  parentID: string,
  projectFilename: string,
  nextActionsRawContent: Array<string> = [],
  projectIndex: number,
): Array<TSectionItem> {
  const outputItems: Array<TSectionItem> = []
  nextActionsRawContent.forEach((nextActionRawContent, actionIndex) => {
    const matchedPara =
      findParaFromRawContentAndFilename(projectFilename, nextActionRawContent) || findParaFromStringAndFilename(projectFilename, nextActionRawContent)
    if (!matchedPara || typeof matchedPara === 'boolean') return

    const dashboardPara = makeDashboardParas([matchedPara], false)[0]
    if (!dashboardPara || (dashboardPara.type !== 'open' && dashboardPara.type !== 'checklist')) return
    dashboardPara.isAChild = true
    dashboardPara.indents = 1

    outputItems.push({
      ID: `${sectionCode}-${projectIndex}-na-${actionIndex}`,
      sectionCode: sectionCode,
      itemType: dashboardPara.type === 'checklist' ? 'checklist' : 'open',
      para: dashboardPara,
      parentID,
    })
  })
  return outputItems
}

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
  logDebug('getProjectReviewSectionData', `------- Gathering Project items for section ${thisSectionCode} --------`)
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
      const projectRow = makeProjectRowItem(thisSectionCode, proj, itemCount)
      items.push(projectRow)
      // Skip child task rows for demo data to keep browser fixture lightweight.
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
          const projectRow = makeProjectRowItem(thisSectionCode, p, itemCount)
          items.push(projectRow)
          const projectFilename = p.filename ?? ''
          if (projectFilename !== '') {
            const nextActionTaskItems = makeNextActionTaskItems(thisSectionCode, projectRow.ID, projectFilename, p.nextActionsRawContent ?? [], itemCount)
            items.push(...nextActionTaskItems)
          }
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
  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

  const section: TSection = {
    name: 'Projects to Review',
    showSettingName: 'showProjectReviewSection',
    ID: thisSectionCode,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    sectionItems: items,
    totalCount: itemCount,
    FAIconClass: 'fa-regular fa-fw fa-chart-gantt',
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
  let totalProjectsBeforeFilter = 0
  const items: Array<TSectionItem> = []
  logDebug('getProjectActiveSectionData', `------- Gathering Active Project items for section ${thisSectionCode} --------`)
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
      const projectRow = makeProjectRowItem(thisSectionCode, p, itemCount)
      items.push(projectRow)
      // Skip child task rows for demo data to keep browser fixture lightweight.
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
      totalProjectsBeforeFilter = allActiveProjects.length

      // Filter by this setting before creating rows so section totalCount remains project-based.
      if (dashboardSettings.showProjectActiveOnlyWithNextActions) {
        allActiveProjects = allActiveProjects.filter((project) => (project.nextActionsRawContent ?? []).length > 0)
        logDebug('getProjectActiveSectionData', `Filtered ${totalProjectsBeforeFilter} projects to ${allActiveProjects.length} projects with next actions`)
      }
      itemCount = allActiveProjects.length

      if (allActiveProjects && allActiveProjects.length > 0) {
        allActiveProjects.map((p, projectIndex) => {
          const projectRow = makeProjectRowItem(thisSectionCode, p, projectIndex)
          items.push(projectRow)
          const projectFilename = p.filename ?? ''
          if (projectFilename !== '') {
            const nextActionTaskItems = makeNextActionTaskItems(thisSectionCode, projectRow.ID, projectFilename, p.nextActionsRawContent ?? [], projectIndex)
            items.push(...nextActionTaskItems)
          }
        })
      } else {
        logDebug('getProjectActiveSectionData', `looked but found no active projects`)
        // Continue to return empty section instead of null so it still displays
      }
    }
  }

  let sectionDescription = `{countWithLimit} active projects`
  if (dashboardSettings.showProjectActiveOnlyWithNextActions && totalProjectsBeforeFilter > itemCount) {
    sectionDescription += ` with next actions (from ${totalProjectsBeforeFilter})`
  }

  sectionDescription += ` sorted by next review date`

  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

  const section: TSection = {
    name: 'Active Projects',
    showSettingName: 'showProjectActiveSection',
    ID: thisSectionCode,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    sectionItems: items,
    totalCount: itemCount,
    FAIconClass: 'fa-regular fa-fw fa-chart-gantt',
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
