// @flow
//-----------------------------------------------------------------------------
// useSectionSortAndFilter.jsx
// Filters, Limits and Sorts items to be shown in a Section.
// - Filter = filter out types we don't want to see (e.g. checklists), or lower-priority items
// - Sort = sort items by priority, startTime, endTime (using itemSort() below)
// - Limit = only show the first N of M items
//
// Last updated 2025-09-05 for v2.3.0.b10
//-----------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react'
import moment from 'moment/min/moment-with-locales'
import type { TSection, TSectionItem } from '../../../types.js'
import { treatSingleItemTypesAsZeroItems } from '../../../constants.js'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev'
import { getStartTimeStrFromParaContent, getEndTimeStrFromParaContent } from '@helpers/timeblocks'

type UseSectionSortAndFilter = {
  filteredItems: Array<TSectionItem>,
  itemsToShow: Array<TSectionItem>,
  numFilteredOut: number,
  limitApplied: boolean,
  maxPrioritySeenInThisSection: number,
  toggleShowAllTasks: () => void,
}

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
  const [numFilteredOut, setFilteredOut] = useState<number>(0)
  const [limitApplied, setLimitApplied] = useState<boolean>(false)

  // Store the calculated max priority to return immediately
  const [calculatedMaxPriority, setCalculatedMaxPriority] = useState<number>(-1)

  // Local state to track whether to show all tasks (ignore priority filtering)
  const [showAllTasks, setShowAllTasks] = useState<boolean>(false)

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const limitToApply = memoizedDashboardSettings.maxItemsToShowInSection ?? 20
  const filterByPriority = memoizedDashboardSettings.filterPriorityItems ?? false

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    logDebug(
      'useSectionSortAndFilter',
      `Section ${section.sectionCode}${section.sectionCode === 'TAG' ? ` (${section.name})` : ''} useEffect running with ${memoizedItems.length} items`,
    )
    if (memoizedItems.length === 0) {
      setFilteredItems([])
      setItemsToShow([])
      setFilteredOut(0)
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
      const filteredItems = (() => {
        if (!filterByPriority || showAllTasks) {
          return typeWantedItems.slice()
        }

        // If priority filtering is enabled but there are no priority items, show only special message items
        if (currentMaxPriorityFromAllVisibleSections === -1) {
          return specialMessageItems
        }

        // Filter regular task items that have priority >= currentMaxPriorityFromAllVisibleSections
        // Always include special message items
        const filteredRegularItems = regularTaskItems.filter((f) => (f.para?.priority ?? 0) >= currentMaxPriorityFromAllVisibleSections)
        return ([]: Array<TSectionItem>).concat(specialMessageItems, filteredRegularItems)
      })()
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
      const itemsToShow = limitToApply > 0 ? orderedFilteredItems.slice(0, limitToApply) : orderedFilteredItems.slice()
      // TEST: not picking up for PRIORITY
      // Requirement thinking, with example numbers:
      // - dataGen finds 100 (totalCount), but it only sends 30 (first limit)
      // - we then might filter out 10 checklists, so typeWantedItems.length is 20 out of 30
      // - then we want to say 'first 20 of 90 tasks'
      // FIXME: but now '4 [open] tasks ...' listed but only showing 3
      const limitApplied = totalCountToUse > limitToApply

      // Add 'filtered out' display line if relevant
      const numFilteredOut = typeWantedItems.length - itemsToShow.length
      if (numFilteredOut > 0) {
        itemsToShow.push({
          ID: `${section.ID}-Filter`,
          itemType: 'filterIndicator',
          para: {
            content: showAllTasks
              ? `Showing all ${typeWantedItems.length} items (click to filter by priority)`
              : `There ${numFilteredOut >= 2 ? 'are' : 'is'} also ${String(numFilteredOut)} ${priorityFilteringHappening ? 'lower-priority' : ''} ${
                  numFilteredOut >= 2 ? 'items' : 'item'
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
      // logInfo('useSectionSortAndFilter', `${section.sectionCode}: typeWantedItems: ${String(typeWantedItems.length)}; numFilteredOut: ${String(numFilteredOut)}; itemsToShow: ${String(itemsToShow)}; totalCountToUse: ${String(totalCountToUse)}; limitToApply: ${String(limitToApply)}`)

      setFilteredItems(filteredItems)
      setItemsToShow(itemsToShow)
      setFilteredOut(numFilteredOut)
      setLimitApplied(limitApplied)
    }
  }, [section, memoizedItems, memoizedDashboardSettings, currentMaxPriorityFromAllVisibleSections, showAllTasks])

  // Function to toggle showing all tasks
  const toggleShowAllTasks = () => {
    setShowAllTasks(!showAllTasks)
  }

  logDebug('useSectionSortAndFilter', `Section ${section.sectionCode} returning maxPrioritySeenInThisSection: ${calculatedMaxPriority}`)
  return { filteredItems, itemsToShow, numFilteredOut, limitApplied, maxPrioritySeenInThisSection: calculatedMaxPriority, toggleShowAllTasks }
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
      logDebug('useSectionSortAndFilter', `- raised max priority to ${String(maxPrioritySeenInThisSection)}`)
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
