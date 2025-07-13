// @flow
//-----------------------------------------------------------------------------
// Generate Project section data
// Last updated 2025-05-16 for v2.3.0
//-----------------------------------------------------------------------------

import { getNextProjectsToReview } from '../../jgclark.Reviews/src/allProjectsListHelpers'
import { Project } from '../../jgclark.Reviews/src/projectClass'
import { getDashboardSettings } from './dashboardHelpers'
import { nextProjectNoteItems } from './demoData'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import type { TDashboardSettings, TSection, TSectionItem } from './types'
import { logDebug, logTimer, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { pluginIsInstalled } from '@helpers/NPConfiguration'

/**
 * Make a Section for all projects ready for review, using data written by the Projects + Reviews plugin: getNextProjectsToReview().
 * First check that the Projects & Reviews plugin is installed.
 * Note: this is taking 1815ms for JGC
 * @param {TDashboardSettings} _config
 * @param {boolean} useDemoData?
 * @returns
 */

export async function getProjectSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  const sectionNumStr = '15'
  const thisSectionCode = 'PROJ'
  let itemCount = 0
  // const maxProjectsToShow = _config.maxItemsToShowInSection
  let nextProjectsToReview: Array<Project> = []
  const items: Array<TSectionItem> = []
  logDebug('getProjectSectionData', `------- Gathering Project items for section #${String(sectionNumStr)} --------`)
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
      const thisID = `${sectionNumStr}-${itemCount}`
      const thisFilename = p.filename ?? '<filename not found>'
      items.push({
        ID: thisID,
        itemType: 'project',
        // $FlowIgnore[prop-missing]
        project: {
          title: p.title ?? '(error)',
          filename: thisFilename,
          reviewInterval: p.reviewInterval ?? '',
          percentComplete: p.percentComplete ?? NaN,
          lastProgressComment: p.lastProgressComment ?? '',
        },
      })
      itemCount++
    })
  } else {
    // Get the next projects to review from the Project + Reviews plugin.
    if (!(await pluginIsInstalled('jgclark.Reviews'))) {
      logDebug('getProjectSectionData', `jgclark.Reviews plugin is not installed, so not continuing.`)
      // $FlowIgnore[incompatible-return] we cannot return anything if the plugin is not installed
      return null
    }
    // Get all projects to review (and apply maxProjectsToShow limit later)
    // nextProjectsToReview = await getNextProjectsToReview(maxProjectsToShow)
    nextProjectsToReview = await getNextProjectsToReview()

    // add basic filtering by folder for the current Perspective
    // const filteredProjects = nextProjectsToReview.filter((p) => {
    //   const folder = getFolderFromFilename(p.filename)
    //   return allowedFolders.includes(folder)
    // })
    // For P+R v1.1 and later, Perspectives can be used, so this filtering is not needed.
    // if (filteredProjects) {
    //   filteredProjects.map((p) => {
    if (nextProjectsToReview) {
      nextProjectsToReview.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({
          ID: thisID,
          itemType: 'project',
          // $FlowIgnore[prop-missing]
          project: {
            title: p.title,
            filename: p.filename,
            reviewInterval: p.reviewInterval,
            percentComplete: p.percentComplete,
            lastProgressComment: p.lastProgressComment,
          },
        })
        itemCount++
      })
    } else {
      logDebug('getProjectSectionData', `looked but found no notes to review`)
      // $FlowFixMe[incompatible-return]
      return null
    }
  }
  // clo(nextProjectsToReview, "nextProjectsToReview")
  let sectionDescription = `{countWithLimit} projects ready to review`
  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` in ${timer(thisStartTime)}`

  const section = {
    name: 'Projects',
    showSettingName: 'showProjectSection',
    ID: sectionNumStr,
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
  logTimer('getProjectSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
  return section
}
