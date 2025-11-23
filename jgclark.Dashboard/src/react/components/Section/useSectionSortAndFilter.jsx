// @flow
//-----------------------------------------------------------------------------
// useSectionSortAndFilter.jsx
// Filters, Limits and Sorts items to be shown in a Section.
// - Filter = filter out types we don't want to see (e.g. checklists), or lower-priority items
// - Sort = sort items by priority, startTime, endTime (using itemSort() below)
// - Limit = only show the first N of M items
//
// Last updated 2025-11-23 for v2.3.0.b15, @jgclark
//-----------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react'
import moment from 'moment/min/moment-with-locales'
import type { TSection, TSectionItem } from '../../../types.js'
import { treatSingleItemTypesAsZeroItems } from '../../../constants.js'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev'
import { getStartTimeStrFromParaContent, getEndTimeStrFromParaContent } from '@helpers/timeblocks'

//----------------------------------------------------------------------
// Constants & Types
//----------------------------------------------------------------------

type UseSectionSortAndFilter = {
  filteredItems: Array<TSectionItem>,
  itemsToShow: Array<TSectionItem>,
  numFilteredOutThisSection: number,
  limitApplied: boolean,
  maxPrioritySeenInThisSection: number,
  toggleShowAllTasks: () => void,
}

const DEFAULT_MAX_ITEMS_TO_SHOW = 20
const DEFAULT_FILTER_BY_PRIORITY = false

//----------------------------------------------------------------------
// Main function
//----------------------------------------------------------------------

const useSectionSortAndFilter = (
  section: TSection,
  items: Array<TSectionItem>,
  dashboardSettings: any,
  currentMaxPriorityFromAllVisibleSections: number,
): UseSectionSortAndFilter => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------

  // Memoize the items array to prevent unnecessary re-renders
  const memoizedItems = useMemo(() => items, [items])
  const memoizedDashboardSettings = useMemo(() => dashboardSettings, [dashboardSettings])
  // const memoizedCurrentMaxPriorityFromAllVisibleSections = useMemo(() => currentMaxPriorityFromAllVisibleSections, [currentMaxPriorityFromAllVisibleSections])

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  const [filteredItems, setFilteredItems] = useState<Array<TSectionItem>>([])
  const [itemsToShow, setItemsToShow] = useState<Array<TSectionItem>>([])
  const [numFilteredOutThisSection, setNumFilteredOutThisSection] = useState < number > (0)
  const [limitApplied, setLimitApplied] = useState<boolean>(false)

  // Store the calculated max priority to return immediately
  const [calculatedMaxPriority, setCalculatedMaxPriority] = useState<number>(-1)

  // Local state to track whether to show all tasks (ignore priority filtering)
  const [showAllTasks, setShowAllTasks] = useState<boolean>(false)

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const limitToApply = memoizedDashboardSettings.maxItemsToShowInSection ?? DEFAULT_MAX_ITEMS_TO_SHOW
  const filterByPriority = memoizedDashboardSettings.filterPriorityItems ?? DEFAULT_FILTER_BY_PRIORITY

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // This useEffect is responsible for updating the filtered and displayed items in the Dashboard section whenever the relevant inputs change (such as the section, items, dashboard settings, or priority filter).
  // It applies filtering based on checklist/task type, special message handling, section-specific logic (like for timeblocks), and any limit or priority-based filters, then sets the resulting items to display and other related state.
  useEffect(() => {
    logDebug(
      'useSectionSortAndFilter',
      `Section ${section.sectionCode}${section.sectionCode === 'TAG' ? ` (${section.name})` : ''} useEffect running with ${memoizedItems.length} items`,
    )
    if (memoizedItems.length === 0) {
      setFilteredItems([])
      setItemsToShow([])
      setNumFilteredOutThisSection(0)
      setLimitApplied(false)
      setCalculatedMaxPriority(-1)
      return
    }

    // Handle TB section differently
    if (section.sectionCode === 'TB') {
      // logDebug('useSectionSortAndFilter/timeblock', `Starting for TB section with ${memoizedItems.length} items`)
      // Filter out all non-current timeblocks
      // Note: assumes they come in (start) time order.
      const currentTBItems = memoizedItems.filter((i) => {
        const currentTimeMom = moment()
        const para = i.para
        if (!para) return false
        // Borrowing code from getCurrentTimeBlockPara
        const startTimeStr = getStartTimeStrFromParaContent(para.content)
        const startTimeMom = moment(startTimeStr, ['HH:mmA', 'HHA', 'HH:mm', 'HH'])
        const endTimeStr = getEndTimeStrFromParaContent(para.content) ?? ''
        const endTimeMom =
          endTimeStr !== '' && endTimeStr !== 'error'
            ? moment(endTimeStr, ['HH:mmA', 'HHA', 'HH:mm', 'HH'])
            : moment(startTimeStr, ['HH:mmA', 'HHA', 'HH:mm', 'HH']).add(15, 'minutes')
        // Special syntax for moment.isBetween which allows the end time minute to be excluded.
        return currentTimeMom.isBetween(startTimeMom, endTimeMom, undefined, '[)')
      })
      const TBItemOrEmptyList = currentTBItems.length ? currentTBItems : []
      setItemsToShow(TBItemOrEmptyList)
    }
    // Handle INFO section differently: no filtering
    else if (section.sectionCode === 'INFO') {
      setItemsToShow(memoizedItems)
      setLimitApplied(false)
    }
    // Handle PROJECT section differently: no priorities
    else if (section.sectionCode === 'PROJ') {
      // Only apply the limit to the number of items to show
      const needToApplyLimit = limitToApply > 0 && memoizedItems.length > limitToApply
      const itemsToShow = needToApplyLimit ? memoizedItems.slice(0, limitToApply) : memoizedItems
      setItemsToShow(itemsToShow)
      setLimitApplied(needToApplyLimit)
    }
    // Handle all other sections
    else {
      // Drop checklist items (if 'ignoreChecklistItems' is set)
      let typeWantedItems = memoizedItems
      let totalCountToUse = section.totalCount ?? 0
      if (memoizedItems.length > 0 && memoizedDashboardSettings && memoizedDashboardSettings.ignoreChecklistItems) {
        typeWantedItems = memoizedItems.filter((si) => !(si.para?.type === 'checklist'))
        totalCountToUse = totalCountToUse - (memoizedItems.length - typeWantedItems.length)
      }

      // Separate special message types from regular task items
      const specialMessageItems = typeWantedItems.filter((item) => treatSingleItemTypesAsZeroItems.includes(item.itemType))
      const regularTaskItems = typeWantedItems.filter((item) => !treatSingleItemTypesAsZeroItems.includes(item.itemType))

      // Find highest priority seen (globally), and then filter out lower-priority items (if wanted)
      // Only calculate max priority from regular task items, not special message types
      const newCalculatedMaxPriority = getMaxPriorityInItems(regularTaskItems)
      logDebug('useSectionSortAndFilter', `Section ${section.sectionCode} calculated max priority: ${newCalculatedMaxPriority}`)
      setCalculatedMaxPriority(newCalculatedMaxPriority)
      // TODO: but how do we downgrade this after it has been raised?
      // Hopefully by re-setting at start of refresh calls

      // Now filter the items based on priority
      // V1
      // const filteredItems = (() => {
      //   if (!filterByPriority || showAllTasks) {
      //     return typeWantedItems.slice()
      //   }

      //   // If priority filtering is enabled but there are no priority items, show only special message items
      //   if (currentMaxPriorityFromAllVisibleSections === -1) {
      //     return specialMessageItems
      //   }

      //   // Filter regular task items that have priority >= currentMaxPriorityFromAllVisibleSections
      //   const filteredRegularItems = regularTaskItems.filter((f) => (f.para?.priority ?? 0) >= currentMaxPriorityFromAllVisibleSections)
      //   // Always include special message items
      //   return ([]: Array<TSectionItem>).concat(specialMessageItems, filteredRegularItems)
      // })()
      // V2
      let filteredItems = typeWantedItems.slice()
      if (filterByPriority && !showAllTasks && newCalculatedMaxPriority > -1) {
        filteredItems = filteredItems.filter((f) => (f.para?.priority ?? 0) >= newCalculatedMaxPriority)
      }
      if (currentMaxPriorityFromAllVisibleSections === -1) {
        filteredItems = []
      }

      const priorityFilteringHappening = memoizedItems.length > filteredItems.length
      logDebug(
        'useSectionSortAndFilter',
        `${section.sectionCode} ${section.name}: ${memoizedItems.length} items; currentMaxPriorityFromAllVisibleSections = ${String(
          currentMaxPriorityFromAllVisibleSections,
        )}; maxPrioritySeenInThisSection = ${String(newCalculatedMaxPriority)}; leaves ${String(filteredItems.length)} filteredItems`,
      )
      // clo(filteredItems, 'useSectionSortAndFilter filteredItems:')

      filteredItems.sort(itemSort)
      // logDebug('useSectionSortAndFilter', `sorted: ${String(filteredItems.map(fi => fi.ID).join(','))}`)

      const orderedFilteredItems = reorderChildrenAfterParents(filteredItems)
      // logDebug('useSectionSortAndFilter', `after reordering children: ${String(orderedFilteredItems.map(fi => fi.ID).join(','))}`)

      // If more than limitToApply items, then just keep the first 'maxItemsToShowInSection' items, otherwise keep all
      // const itemsToShow = limitToApply > 0 ? orderedFilteredItems.slice(0, limitToApply) : orderedFilteredItems.slice()
      const orderedFilteredLimitedItems = limitToApply > 0 ? orderedFilteredItems.slice(0, limitToApply) : orderedFilteredItems.slice()

      // If we are filtering items out, add 'filtered out' display line
      const numFilteredOutThisSection = typeWantedItems.length - orderedFilteredLimitedItems.length
      if (numFilteredOutThisSection > 0) {
        specialMessageItems.unshift({
          ID: `${section.ID}-Filter`,
          sectionCode: section.sectionCode,
          itemType: 'filterIndicator',
          para: {
            lineIndex: -1,
            content: showAllTasks
              ? `Showing all ${typeWantedItems.length} items (click to filter by priority)`
              : `There ${numFilteredOutThisSection >= 2 ? 'are' : 'is'} also ${String(numFilteredOutThisSection)} ${priorityFilteringHappening ? 'lower-priority' : ''} ${numFilteredOutThisSection >= 2 ? 'items' : 'item'
                } currently hidden (click to show all)`,
            filename: '',
            type: 'text',
            noteType: 'Notes',
            rawContent: '',
            priority: -1,
            indents: 0,
          },
        })

      }
      const itemsToShow = orderedFilteredLimitedItems.concat(specialMessageItems)
      // logInfo('useSectionSortAndFilter', `${section.sectionCode}: typeWantedItems: ${String(typeWantedItems.length)}; numFilteredOutThisSection: ${String(numFilteredOutThisSection)}; itemsToShow: ${String(itemsToShow.length)}; totalCountToUse: ${String(totalCountToUse)}; limitToApply: ${String(limitToApply)}`)

      setFilteredItems(filteredItems)
      setItemsToShow(itemsToShow)
      setNumFilteredOutThisSection(numFilteredOutThisSection)
      setLimitApplied(limitApplied)
    }
  }, [section, memoizedItems, memoizedDashboardSettings, currentMaxPriorityFromAllVisibleSections, showAllTasks])

  // Function to toggle showing all tasks
  const toggleShowAllTasks = () => {
    setShowAllTasks(!showAllTasks)
  }

  // logInfo('useSectionSortAndFilter', `Section ${section.sectionCode} returning: maxPrioritySeenInThisSection: ${calculatedMaxPriority}; itemsToShow: ${itemsToShow.length}; numFilteredOut: ${String(numFilteredOut)}; limitApplied: ${String(limitApplied)}`)
  return { filteredItems, itemsToShow, numFilteredOutThisSection, limitApplied, maxPrioritySeenInThisSection: calculatedMaxPriority, toggleShowAllTasks }
}

//----------------------------------------------------------------------
// Supporting Functions
//----------------------------------------------------------------------

function getMaxPriorityInItems(items: Array<TSectionItem>): number {
  let maxPrioritySeenInThisSection = -1
  for (const i of items) {
    // Skip special message types when calculating max priority
    if (treatSingleItemTypesAsZeroItems.includes(i.itemType)) {
      continue
    }
    if (i.para?.priority && i.para.priority > maxPrioritySeenInThisSection) {
      maxPrioritySeenInThisSection = i.para.priority
      // logDebug('useSectionSortAndFilter', `- raised max priority to ${String(maxPrioritySeenInThisSection)}`)
    }
  }
  return maxPrioritySeenInThisSection
}

/**
 * Calculate the maximum priority across all visible sections
 * @param {Array<TSection>} sections - All sections to check
 * @returns {number} The maximum priority found across all sections, or -1 if no items have priority
 */
export function calculateMaxPriorityAcrossAllSections(sections: Array<TSection>): number {
  let globalMaxPriority = -1

  sections.forEach((section) => {
    if (section.sectionItems && section.sectionItems.length > 0) {
      const sectionMaxPriority = getMaxPriorityInItems(section.sectionItems)
      if (sectionMaxPriority > globalMaxPriority) {
        globalMaxPriority = sectionMaxPriority
      }
    }
  })

  return globalMaxPriority
}

// sort items by itemType, priority, startTime, endTime
// Note: deliberately not using alphabetic on content, so original note order is preserved as far as possible
export function itemSort(a: TSectionItem, b: TSectionItem): number {
  // Sort by itemType (first) with 'open' and 'checklist' coming before all other types
  // Note: this is a bit of a hack. Ideally we would filter these out before using itemSort.
  const itemTypeA = ['open', 'checklist'].includes(a.itemType) ? 1 : 0
  const itemTypeB = ['open', 'checklist'].includes(b.itemType) ? 1 : 0
  if (itemTypeA !== itemTypeB) {
    return itemTypeB - itemTypeA
  }

  // Sort by priority (second)
  const priorityA = a.para?.priority ?? 0
  const priorityB = b.para?.priority ?? 0
  if (priorityA !== priorityB) {
    return priorityB - priorityA
  }

  // Sort by startTime
  if (a.para?.startTime && b.para?.startTime) {
    const startTimeComparison = a.para.startTime.localeCompare(b.para.startTime)
    if (startTimeComparison !== 0) return startTimeComparison
  } else if (a.para?.startTime) {
    return -1
  } else if (b.para?.startTime) {
    return 1
  }

  // Sort by endTime
  if (a.para?.endTime && b.para?.endTime) {
    const endTimeComparison = a.para.endTime.localeCompare(b.para.endTime)
    if (endTimeComparison !== 0) return endTimeComparison
  } else if (a.para?.endTime) {
    return -1
  } else if (b.para?.endTime) {
    return 1
  }

  // Leave in original order
  return 0
}

/**
 * Reorders an array of objects so that children follow their parents. Relies on having .ID and .parentID? fields in the top level of the object.
 *
 * @param {Array<Object>} data - The array of objects to be reordered. Each object should have a `parentID` property.
 * @returns {Array<Object>} - The reordered array where each child object follows its parent.
 */
export function reorderChildrenAfterParents(data: Array<Object>): Array<Object> {
  const orderedData = []
  // $FlowFixMe[underconstrained-implicit-instantiation] reason for suppression
  const map = new Map()

  // Create a map to store objects by parent
  data.forEach((obj) => {
    const parent = obj.parentID ? obj.parentID : ''
    if (!map.has(parent)) {
      map.set(parent, [])
    }
    // $FlowFixMe[incompatible-use]
    map.get(parent).push(obj)
  })

  // Recursive function to build the sorted array
  const buildSorted = (parentID: string) => {
    const children = map.get(parentID ?? '') || []
    children.forEach((child) => {
      orderedData.push(child)
      buildSorted(child.ID)
    })
  }

  // Start by adding top-level parents
  buildSorted('')
  return orderedData
}

export default useSectionSortAndFilter
