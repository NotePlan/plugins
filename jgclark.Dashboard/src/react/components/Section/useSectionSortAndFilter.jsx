// @flow
//-----------------------------------------------------------------------------
// useSectionSortAndFilter.jsx
// Filters and sorts items to be shown in a Section
// Last updated for v2.1.0.b
//-----------------------------------------------------------------------------

import { useState, useEffect } from 'react'
import type { TSection, TSectionItem } from '../../../types.js'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev'

type UseSectionSortAndFilter = {
  filteredItems: Array<TSectionItem>,
  itemsToShow: Array<TSectionItem>,
  numFilteredOut: number,
  limitApplied: boolean,
}

const useSectionSortAndFilter = (section: TSection, items: Array<TSectionItem>, dashboardSettings: any): UseSectionSortAndFilter => {
  const [filteredItems, setFilteredItems] = useState < Array < TSectionItem >> ([])
  const [itemsToShow, setItemsToShow] = useState < Array < TSectionItem >> ([])
  const [numFilteredOut, setFilteredOut] = useState < number > (0)
  const [limitApplied, setLimitApplied] = useState < boolean > (false)

  useEffect(() => {
    const filterPriorityItems = dashboardSettings.filterPriorityItems ?? false
    logDebug('useSectionSortAndFilter', `Start for ${section.sectionCode}: ${items.length} items`)

    // Find highest priority seen
    let maxPrioritySeen = -1
    for (const i of items) {
      if (i.para?.priority && i.para.priority > maxPrioritySeen) {
        maxPrioritySeen = i.para.priority
      }
    }
    // and then filter out lower-priority items (if wanted)
    const filteredItems = filterPriorityItems
      ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen)
      : items.slice()
    const priorityFilteringHappening = items.length > filteredItems.length
    // clo(filteredItems, 'useSectionSortAndFilter filteredItems:')

    filteredItems.sort(itemSort)
    logDebug('useSectionSortAndFilter', `sorted: ${String(filteredItems.map(fi => fi.ID).join(','))}`)

    const filteredOrderedItems = reorderChildrenAfterParents(filteredItems)
    logDebug('useSectionSortAndFilter', `after reordering children: ${String(filteredOrderedItems.map(fi => fi.ID).join(','))}`)

    // If more than limitToApply, then just keep the first items, otherwise keep all
    const limitToApply = dashboardSettings.maxItemsToShowInSection ?? 20
    const itemsToShow = limitToApply > 0 ? filteredOrderedItems.slice(0, limitToApply) : filteredOrderedItems.slice()
    const limitApplied = items.length > itemsToShow.length

    // Add 'filtered out' display line if relevant
    const numFilteredOut = items.length - itemsToShow.length
    if (numFilteredOut > 0) {
      itemsToShow.push({
        ID: `${section.ID}-Filter`,
        itemType: 'filterIndicator',
        para: {
          content: `There ${numFilteredOut >= 2 ? 'are' : 'is'} also ${String(numFilteredOut)} ${priorityFilteringHappening ? 'lower-priority' : ''} ${numFilteredOut >= 2 ? 'items' : 'item'} currently hidden`,
          filename: '',
          type: 'text',
          noteType: 'Notes',
          rawContent: '',
          priority: -1,
          indentLevel: 0
        },
      })
    }

    setFilteredItems(filteredItems)
    setItemsToShow(itemsToShow)
    setFilteredOut(numFilteredOut)
    setLimitApplied(limitApplied)
  }, [section, items, dashboardSettings])

  return { filteredItems, itemsToShow, numFilteredOut, limitApplied }
}

export function     // sort items by priority, startTime, endTime, content
  itemSort(a: TSectionItem, b: TSectionItem): number {
  // Sort by priority (first)
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

  // Finally sort by content (alphabetic)
  const contentA = a.para?.content.toLowerCase() ?? ''
  const contentB = b.para?.content.toLowerCase() ?? ''
  return contentA.localeCompare(contentB)
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
  data.forEach(obj => {
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
    children.forEach(child => {
      orderedData.push(child)
      buildSorted(child.ID)
    })
  }

  // Start by adding top-level parents
  buildSorted('')
  return orderedData
}

export default useSectionSortAndFilter
