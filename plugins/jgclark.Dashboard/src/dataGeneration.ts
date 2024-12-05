// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project } from '../../jgclark.Reviews/src/projectClass.js'
import { getNextProjectsToReview } from '../../jgclark.Reviews/src/allProjectsListHelpers.js' // assumes v0.15+ of Reviews Plugin
import type { TDashboardSettings, TItemType, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSectionDetails, TSettingItem } from './types.js'
import { allSectionCodes } from './constants.js'
import { getTagSectionDetails } from './react/components/Section/sectionHelpers.js'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks.js'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getRelevantOverdueTasks,
  getRelevantPriorityTasks,
  getSectionItemObject,
  getStartTimeFromPara,
  makeDashboardParas,
} from './dashboardHelpers.js'
import { getTimeBlockSectionData, getTodaySectionData, getYesterdaySectionData, getTomorrowSectionData } from './dataGenerationDays.js'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks.js'
import {
  openMonthParas,
  refMonthParas,
  tagParasFromNote,
  nextProjectNoteItems,
} from './demoData.js'
import {
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  filenameIsInFuture,
  includesScheduledFutureDate,
} from '@np/helpers/dateTime'
import { stringListOrArrayToArray } from '@np/helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@np/helpers/dev'
import { getFolderFromFilename } from '@np/helpers/folders'
import { toNPLocaleDateString } from '@np/helpers/NPdateTime'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@np/helpers/NPnote'
import { sortListBy } from '@np/helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@np/helpers/syncedCopies'
import { getCurrentTimeBlockPara, getTimeBlockDetails } from '@np/helpers/timeblocks'
import { isOpen, isOpenTask } from '@np/helpers/utils'

//-----------------------------------------------------------------
// Constants

// const reviewPluginID = 'jgclark.Reviews'
// const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getAllSectionsData(useDemoData: boolean = false, forceLoadAll: boolean = false, useEditorWherePossible: boolean): Promise<Array<TSection>> {
  try {
    const config: any = await getDashboardSettings()
    // clo(config, 'getAllSectionsData config is currently',2)

    // V2
    // Work out which sections to show
    const sectionsToShow: Array<TSectionCode> = forceLoadAll ? allSectionCodes : getListOfEnabledSections(config)
    logInfo('getAllSectionDetails', `${String(sectionsToShow.length)} sections to show: ${String(sectionsToShow)}`)
    const sections: Array<TSection> = await getSomeSectionsData(sectionsToShow, useDemoData, useEditorWherePossible)

    return sections.filter((s) => s) //get rid of any nulls b/c some of the sections above could return null
  } catch (error) {
    logError('getAllSectionDetails', error.message)
    return []
  }
}

/**
 * Generate data for some specified sections (subject to user currently wanting them as well)
 * NOTE: Always refreshes today and the TAG sections
 * @param {Array<string>} sectionCodesToGet (default: allSectionCodes)
 * @param {boolean} useDemoData (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
): Promise<Array<TSection>> {
  try {
    const config: TDashboardSettings = await getDashboardSettings()

    let sections: Array<TSection> = []
    if (sectionCodesToGet.includes('TB')) sections.push(getTimeBlockSectionData(config, useDemoData))
    if (sectionCodesToGet.includes('DT')) sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DO') && config.showWeekSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('LW') && config.showLastWeekSection) sections.push(...getLastWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    // out of display order, but quicker to generate
    if (sectionCodesToGet.includes('PROJ') && config.showProjectSection) {
      const projectSection = await getProjectSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }
    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      const tagSections = getTaggedSections(config, useDemoData).filter((s) => s) //get rid of any nulls
      sections = tagSections.length ? sections.concat(tagSections) : sections
    }
    if (sectionCodesToGet.includes('OVERDUE') && config.showOverdueSection) sections.push(await getOverdueSectionData(config, useDemoData))
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    sections.filter((s) => s) //get rid of any nulls b/c just in case any the sections above could return null
    return sections
  } catch (error) {
    logError('getSomeSectionDetails', error.message)
    return []
  }
}

/**
 * Get open items from this Month's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisMonthSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '8'
    const thisSectionCode = 'M'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPMonthStr(today)
    const NPSettings = getNotePlanSettings()
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openMonthParas : openMonthParas.concat(refMonthParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentMonthlyNote) {
        // const thisFilename = currentMonthlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisMonthSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('month', currentMonthlyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding monthly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisMonthHeadings: Array<string> = currentMonthlyNote ? getHeadingsFromNote(currentMonthlyNote, false, true, true, true) : []
    const nextMonthHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisMonthHeadings.length
        ? // @ts-ignore
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', options: thisMonthHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const nextMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextMonthHeadings.length
        ? // @ts-ignore
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', options: nextMonthHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )

    const section: TSection = {
      ID: sectionNum,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-range',
      sectionTitleColorPart: 'sidebarMonthly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this month's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this month's note",
          display: '<i class= "fa-regular fa-square-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next month's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next month's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '9'
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        sortedRefParas.map((item) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-range',
        sectionTitleColorPart: 'sidebarMonthly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} monthly items from ${thisFilename} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/month', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Quarter's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisQuarterSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '10'
    const thisSectionCode = 'Q'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPQuarterStr(today)
    const NPSettings = getNotePlanSettings()
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // No demo data
    } else {
      if (currentQuarterlyNote) {
        const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisQuarterSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('quarter', currentQuarterlyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')
    const nextPeriodFilename = nextPeriodNote?.filename ?? ''
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisQuarterHeadings: Array<string> = currentQuarterlyNote ? getHeadingsFromNote(currentQuarterlyNote, false, true, true, true) : []
    const nextQuarterHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisQuarterHeadings.length
        ? // @ts-ignore
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', options: thisQuarterHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const nextQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextQuarterHeadings.length
        ? // @ts-ignore
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', options: nextQuarterHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )

    const section: TSection = {
      ID: sectionNum,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-days',
      sectionTitleColorPart: 'sidebarQuarterly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this quarter's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this quarter's note",
          display: '<i class= "fa-regular fa-square-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next quarter's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next quarter's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '11'
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-days',
        sectionTitleColorPart: 'sidebarQuarterly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} quarterly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/quarter', `ERROR: ${error.message}`)
    return []
  }
}

//-----------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is fa-calendar-days (same as quarter). This would be #6
//-----------------------------------------------------------

/**
 * Get the tagged sections for each tag - they will all be sectionCode=TAG
 * sectionName will be the tag name, and showSettingName will be unique for this tag
 * @param {TDashboardSettings} config
 * @param {boolean} [useDemoData=false]
 * @returns {Array<TSection>}
 */
export function getTaggedSections(config: TDashboardSettings, useDemoData: boolean = false): Array<TSection> {
  const startTime = new Date()
  const tagSections = getTagSectionDetails(config)
  // clo(tagSections)
  // logInfo('getTaggedSections', `- after getTagSectionDetails:  ${timer(startTime)}`)

  const output = tagSections.reduce((acc: Array<TSection>, sectionDetail: TSectionDetails, index: number) => {
    // @ts-ignore
    const showSettingForTag = config[sectionDetail.showSettingName]
    // logDebug('getTaggedSections', `sectionDetail.sectionName=${sectionDetail.sectionName} showSettingForTag=${showSettingForTag}`)
    if (typeof showSettingForTag === 'undefined' || showSettingForTag) acc.push(getTaggedSectionData(config, useDemoData, sectionDetail, index))
    return acc // Return the accumulator
  }, [])
  logTimer('getTaggedSections', startTime, `at end`, 1500)
  return output
}

/**
 * Generate data for a section for items with a Tag/Mention.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export function getTaggedSectionData(config: TDashboardSettings, useDemoData: boolean = false, sectionDetail: TSectionDetails, index: number): TSection {
  const thisStartTime = new Date()
  const sectionNum = `12-${index}`
  const thisSectionCode = 'TAG'
  const maxInSection = config.maxItemsToShowInSection ?? 30
  logInfo('getTaggedSectionData', `------- Gathering Tag items for section #${String(sectionNum)}: ${sectionDetail.sectionName} --------`)
  // if (config.ignoreChecklistItems) logDebug('getTaggedSectionData', `Note: will filter out checklists`)
  let itemCount = 0
  let totalCount = 0
  const items: Array<TSectionItem> = []
  let isHashtag = false
  let isMention = false
  // const thisStartTime = new Date()

  if (useDemoData) {
    isHashtag = true
    tagParasFromNote.map((item) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    isHashtag = sectionDetail.sectionName.startsWith('#')
    isMention = sectionDetail.sectionName.startsWith('@')
    if (isHashtag || isMention) {
      let filteredTagParas: Array<TParagraph> = []

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      // Note: this is slow (about 1ms per note, so 3100ms for 3250 notes)
      const notesWithTag = findNotesMatchingHashtagOrMention(sectionDetail.sectionName, true)
      logTimer('getTaggedSectionData', thisStartTime, `to find ${notesWithTag.length} notes with ${sectionDetail.sectionName}`)
      for (const n of notesWithTag) {
        // Don't continue if this note is in an excluded folder
        const thisNoteFolder = getFolderFromFilename(n.filename)
        if (stringListOrArrayToArray(config.excludedFolders, ',').includes(thisNoteFolder)) {
          // logDebug('getTaggedSectionData', `- ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const tagParasFromNote = n.paragraphs.filter((p) => p.content?.includes(sectionDetail.sectionName))
        logTimer('getTaggedSectionData', thisStartTime, `- found ${tagParasFromNote.length} paras containing ${sectionDetail.sectionName} in ${n.filename}`)

        // Further filter out checklists and otherwise empty items
        const filteredTagParasFromNote = config.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTask(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpen(p) && p.content.trim() !== '')
        // logTimer('getTaggedSectionData', thisStartTime, `- after filtering for open only (${config.ignoreChecklistItems ? 'tasks only' : 'tasks or checklists'}), ${filteredTagParasFromNote.length} paras`)

        // Save this para, unless in matches the 'ignoreItemsWithTerms' setting
        for (const p of filteredTagParasFromNote) {
          if (!config.ignoreItemsWithTerms || config.ignoreItemsWithTerms === '' || !p.content.includes(config.ignoreItemsWithTerms)) {
            filteredTagParas.push(p)
          } else {
            // logDebug('getTaggedSectionData', `- ignoring para {${p.content}} as it contains '${config.ignoreItemsWithTerms}'`)
          }
        }
        logTimer('getTaggedSectionData', thisStartTime, `- after filtering for ${config.ignoreItemsWithTerms}, ${filteredTagParas.length} paras`)
      }
      // logTimer('getTaggedSectionData', thisStartTime, `- ${filteredTagParas.length} paras`)

      // filter out paras in the future
      const dateToUseUnhyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYYMMDD') : new moment().format('YYYYMMDD')
      filteredTagParas = filteredTagParas.filter((p) => !filenameIsInFuture(p.filename || '', dateToUseUnhyphenated))
      const dateToUseHyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYY-MM-DD') : new moment().format('YYYY-MM-DD')
      filteredTagParas = filteredTagParas.filter((p) => !includesScheduledFutureDate(p.content, dateToUseHyphenated))
      logTimer('getTaggedSectionData', thisStartTime, `- after filtering for future, ${filteredTagParas.length} paras`)

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines
        filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after sync dedupe -> ${filteredTagParas.length}`)
        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // Note: this is a quick operation
        // const filteredReducedParas = removeDuplicates(reducedParas, ['content', 'filename'])

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // Note: this is a quick operation
        const dashboardParas = makeDashboardParas(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after eliminating dupes -> ${dashboardParas.length}`)

        totalCount = dashboardParas.length

        // Sort paragraphs by one of several options
        const sortOrder =
          config.overdueSortOrder === 'priority'
            ? ['-priority', '-changedDate']
            : config.overdueSortOrder === 'earliest'
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
        const sortedTagParas = sortListBy(dashboardParas, sortOrder)
        logTimer('getTaggedSectionData', thisStartTime, `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)}`)

        // Apply limit to set of ordered results
        const sortedTagParasLimited = sortedTagParas.length > maxInSection ? sortedTagParas.slice(0, maxInSection) : sortedTagParas
        logDebug('getTaggedSectionData', `- after applying [${maxInSection}] limit, now ${sortedTagParasLimited.length} items to show for ${sectionDetail.sectionName}`)
        // sortedTagParasLimited.length ? clo(sortedTagParasLimited, 'getTaggedSectionData sortedTagParasLimited') : null
        for (const p of sortedTagParasLimited) {
          const thisID = `${sectionNum}.${itemCount}`
          // const thisFilename = p.filename ?? ''
          // @ts-ignore
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        }
      } else {
        logDebug('getTaggedSectionData', `- no items to show for ${sectionDetail.sectionName}`)
      }
    }
  }

  // Return section details, even if no items found
  // const tagSectionDescription =
  // totalCount > itemCount ? `first {count} from ${String(totalCount)} items ordered by ${config.overdueSortOrder}` : `{count} item{s} ordered by ${config.overdueSortOrder}`
  const tagSectionDescription = `{count} item{s} ordered by ${config.overdueSortOrder}`
  const section: TSection = {
    ID: sectionNum,
    name: sectionDetail.sectionName,
    showSettingName: sectionDetail.showSettingName,
    sectionCode: thisSectionCode,
    description: tagSectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleColorPart: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    totalCount: totalCount, // Note: Now not sure how this is used (if it is)
    generatedDate: new Date(),
    actionButtons: [],
  }
  logTimer('getTaggedSectionData', thisStartTime, `to find ${itemCount} ${sectionDetail.sectionName} items`, 1000)
  return section
}

// ----------------------------------------------------------
/**
 * Generate data for a section for Overdue tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getOverdueSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = '13'
    const thisSectionCode = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getOverdueSectionData', `------- Gathering Overdue Tasks for section #${String(sectionNum)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNum}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : c % 5 === 0 ? '! ' : ''
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${c} >${fakeIsoDateStr}`
        overdueParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Overdue Test Note ${c % 10}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get overdue tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      // overdueParas = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas)
      overdueParas = await getRelevantOverdueTasks(config, [])
      logDebug('getOverdueSectionData', `- found ${overdueParas.length} overdue paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logDebug('getOverdueSectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // Remove possible dupes from sync'd lines
      // Note: currently commented out, to save 2? secs of processing
      // overdueParas = eliminateDuplicateSyncedParagraphs(overdueParas)
      // logDebug('getOverdueSectionData', `- after sync lines dedupe ->  ${overdueParas.length}`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder =
        config.overdueSortOrder === 'priority' ? ['-priority', '-changedDate'] : config.overdueSortOrder === 'earliest' ? ['changedDate', 'priority'] : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logDebug('getOverdueSectionData', `- Sorted ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      const overdueTaskParasLimited = totalOverdue > maxInSection ? sortedOverdueTaskParas.slice(0, maxInSection) : sortedOverdueTaskParas
      logDebug('getOverdueSectionData', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push(getSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logDebug('getOverdueSectionData', `- finished finding overdue items after ${timer(thisStartTime)}`)

    const overdueSectionDescription =
      totalOverdue > itemCount ? `first {count} of {totalCount} ordered by ${config.overdueSortOrder}` : `{count} ordered by ${config.overdueSortOrder}`

    const section: TSection = {
      ID: sectionNum,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thisSectionCode,
      description: overdueSectionDescription,
      FAIconClass: 'fa-regular fa-alarm-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalOverdue,
      actionButtons: [
        {
          actionName: 'scheduleAllOverdueToday',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Schedule all Overdue tasks to Today',
          display: 'All Overdue <i class="fa-solid fa-right-long"></i> Today',
          actionParam: '',
          postActionRefresh: ['OVERDUE'],
        },
      ],
    }
    // console.log(JSON.stringify(section))
    logTimer('getOverdueSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

// ----------------------------------------------------------
/**
 * Generate data for a section of raised Priority tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getPrioritySectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = '14'
    const thisSectionCode = 'PRIORITY'
    let totalPriority = 0
    let itemCount = 0
    let priorityParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getPrioritySectionData', `------- Gathering Priority Tasks for section #${String(sectionNum)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNum}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '>> ' : c % 10 === 0 ? '!!! ' : c % 5 === 0 ? '!! ' : '! '
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test priority item ${c} >${fakeIsoDateStr}`
        priorityParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Priority Test Note ${c % 10}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get priority tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllPriorityOpenToToday() doesn't have all it needs to work
      priorityParas = await getRelevantPriorityTasks(config)
      logDebug('getPrioritySectionData', `- found ${priorityParas.length} priority paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (priorityParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(priorityParas)
      logDebug('getPrioritySectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // TODO(later): Remove possible dupes from sync'd lines
      // priorityParas = eliminateDuplicateSyncedParagraphs(priorityParas)
      // logTimer('getPrioritySectionData', thisStartTime, `- after sync lines dedupe -> ${priorityParas.length}`)

      totalPriority = dashboardParas.length

      // Sort paragraphs by priority
      const sortOrder = ['-priority', '-changedDate']
      const sortedPriorityTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getPrioritySectionData', thisStartTime, `- Sorted ${sortedPriorityTaskParas.length} items`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      const priorityTaskParasLimited = totalPriority > maxInSection ? sortedPriorityTaskParas.slice(0, maxInSection) : sortedPriorityTaskParas
      logDebug('getPrioritySectionData', `- after limit, now ${priorityTaskParasLimited.length} items to show`)
      priorityTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push(getSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logTimer('getPrioritySectionData', thisStartTime, `- finished finding priority items`)

    const prioritySectionDescription = totalPriority > itemCount ? `{count} of {totalCount}` : `{count}`

    const section: TSection = {
      ID: sectionNum,
      name: 'Priority Tasks',
      showSettingName: 'showPrioritySection',
      sectionCode: thisSectionCode,
      description: prioritySectionDescription,
      FAIconClass: 'fa-regular fa-angles-up',
      // FAIconClass: 'fa-light fa-star-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalPriority,
      actionButtons: [],
    }
    logTimer('getPrioritySectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1500)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

/**
 * Make a Section for all projects ready for review
 * Note: this is taking 1815ms for JGC
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns
 */
export async function getProjectSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  const sectionNum = '15'
  const thisSectionCode = 'PROJ'
  let itemCount = 0
  const maxProjectsToShow = config.maxItemsToShowInSection
  let nextProjectsToReview: Array<Project> = []
  const items: Array<TSectionItem> = []
  logDebug('getProjectSectionData', `------- Gathering Project items for section #${String(sectionNum)} --------`)
  const thisStartTime = new Date()

  if (useDemoData) {
    // Note: still using the earlier TNote-based demo data, not newer Project-based objects
    nextProjectNoteItems.map((p) => {
      const thisID = `${sectionNum}-${itemCount}`
      const thisFilename = p.filename ?? '<filename not found>'
      items.push({
        ID: thisID,
        itemType: 'project',
        // @ts-ignore
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
    nextProjectsToReview = await getNextProjectsToReview(maxProjectsToShow)

    if (nextProjectsToReview) {
      nextProjectsToReview.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({
          ID: thisID,
          itemType: 'project',
          // @ts-ignore
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

  const section = {
    name: 'Projects',
    showSettingName: 'showProjectSection',
    ID: sectionNum,
    sectionCode: thisSectionCode,
    description: `{count} project{s} ready to review`,
    sectionItems: items,
    FAIconClass: 'fa-regular fa-chart-gantt',
    // FAIconClass: 'fa-light fa-square-kanban',
    // no sectionTitleColorPart, so will use default
    generatedDate: new Date(),
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

/**
 * Finds all items within the provided sections that match the given field/value pairs.
 *
 * @param {Array<TSection>} sections - An array of section objects containing sectionItems.
 * @param {Array<string>} fieldPathsToMatch - An array of field paths (e.g., 'para.filename', 'itemType') to match against.
 * @param {Object<string, string|RegExp>} fieldValues - An object containing the field values to match against. Values can be strings or regular expressions.
 * @returns {Array<SectionItemIndex>} An array of objects containing the section index and item index for each matching item.
 * @example const indexes = findSectionItems(sections, ['itemType', 'filename', 'para.content'], { itemType: /open|checklist/, filename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)

 * @author @dwertheimer
 */
export function findSectionItems(
  sections: Array<TSection>,
  fieldPathsToMatch: Array<string>,
  fieldValues: { [key: string]: string | RegExp },
): Array<{ sectionIndex: number, itemIndex: number }> {
  const matches: Array<{ sectionIndex: number, itemIndex: number }> = []

  sections.forEach((section, sectionIndex) => {
    section.sectionItems.forEach((item, itemIndex) => {
      const isMatch = fieldPathsToMatch.every((fieldPath) => {
        const itemFieldValue = getNestedValue(item, fieldPath)
        if (!itemFieldValue) {
          logDebug(`findSectionItems: ${fieldPath} is undefined in ${JSP(item)} -- may be ok if you are looking for a task and this is a review item`)
          return false
        }
        const fieldValue = fieldValues[fieldPath]
        if (fieldValue instanceof RegExp) {
          return fieldValue.test(itemFieldValue)
        } else {
          // logDebug(
          //   `findSectionItems:`,
          //   `${item.ID} itemFieldValue: ${itemFieldValue} ${
          //     itemFieldValue ? (itemFieldValue === fieldValue ? 'equals' : 'does not equal') : 'is undefined'
          //   } fieldValue: ${fieldValue}`,
          // )
          return itemFieldValue ? itemFieldValue === fieldValue : false
        }
      })

      if (isMatch) {
        matches.push({ sectionIndex, itemIndex })
      }
    })
  })

  return matches
}

/**
 * Copies specified fields from a provided object into the corresponding sectionItems in the sections array.
 *
 * @param {Array<SectionItemIndex>} results - An array of results from the findSectionItems function, containing section and item indices.
 * @param {Array<string>} fieldPathsToReplace - An array of field paths (maybe nested) within TSectionItem (e.g. 'itemType', 'para.filename') to copy from the provided object.
 * @param {Object} updatedValues - The object containing the field values to be copied -- the keys are the field paths (can be strings with dots, e.g. para.filename) and the values are the values to copy.
 * @param {Array<TSection>} sections - The original sections array to be modified.
 * @returns {Array<TSection>} The modified sections array with the specified fields copied into the corresponding sectionItems.
 */
export function copyUpdatedSectionItemData(
  results: Array<{ sectionIndex: number, itemIndex: number }>,
  fieldPathsToReplace: Array<string>,
  updatedValues: { [key: string]: any },
  sections: Array<TSection>,
): Array<TSection> {
  results.forEach(({ sectionIndex, itemIndex }) => {
    const sectionItem = sections[sectionIndex].sectionItems[itemIndex]

    fieldPathsToReplace.forEach((fieldPath) => {
      // const [firstField, ...remainingPath] = fieldPath.split('.')
      const value = getNestedValue(updatedValues, fieldPath)
      if (value !== undefined) {
        setNestedValue(sectionItem, fieldPath, value)
      }
    })
    sectionItem.updated = true
  })

  return sections
}

/**
 * Helper function to get the value of a nested field in an object.
 *
 * @param {Object} obj - The object to search for the nested field.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @returns {any} The value of the nested field, or undefined if the field doesn't exist.
 */
function getNestedValue(obj: any, path: string) {
  const fields = path.split('.')
  let value = obj

  for (const field of fields) {
    if (value && typeof value === 'object' && field in value) {
      value = value[field]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Helper function to set the value of a nested field in an object.
 *
 * @param {Object} obj - The object to set the nested field value in.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @param {any} value - The value to set for the nested field.
 */
function setNestedValue(obj: any, path: string, value: any) {
  const fields = path.split('.')
  let currentObj = obj

  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i]
    if (!currentObj.hasOwnProperty(field)) {
      currentObj[field] = {}
    }
    currentObj = currentObj[field]
  }
  const finalField = fields[fields.length - 1]
  currentObj[finalField] = value
}
