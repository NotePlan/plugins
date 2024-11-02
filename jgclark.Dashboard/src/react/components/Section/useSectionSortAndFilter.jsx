// @flow
//-----------------------------------------------------------------------------
// useSectionSortAndFilter.jsx
// Filters and sorts items to be shown in a Section
// Last updated for v2.1.0.a
//-----------------------------------------------------------------------------

import { useState, useEffect } from 'react'
import type { TSection, TSectionItem } from '../../../types.js'
import { logDebug, logError, logInfo, JSP, clo } from '@helpers/react/reactDev'

type UseSectionSortAndFilter = {
  filteredItems: Array<TSectionItem>,
  itemsToShow: Array<TSectionItem>,
  numFilteredOut: number,
  limitApplied: boolean,
}

const useSectionSortAndFilter = (section: TSection, items: Array<TSectionItem>, dashboardSettings: any): UseSectionSortAndFilter => {
  const [filteredItems, setFilteredItems] = useState<Array<TSectionItem>>([])
  const [itemsToShow, setItemsToShow] = useState<Array<TSectionItem>>([])
  const [numFilteredOut, setFilteredOut] = useState<number>(0)
  const [limitApplied, setLimitApplied] = useState<boolean>(false)

  useEffect(() => {
    const filterPriorityItems = dashboardSettings.filterPriorityItems ?? false

    // Find highest priority seen
    let maxPrioritySeen = -1
    for (const i of items) {
      if (i.para?.priority && i.para.priority > maxPrioritySeen) {
        maxPrioritySeen = i.para.priority
      }
    }
    // and then filter lower-priority items (if wanted)
    const filteredItems = filterPriorityItems
      ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen)
      : items.slice()
    const priorityFilteringHappening = items.length > filteredItems.length
    // logInfo('useSectionSortAndFilter', `After filter: ${String(priorityFilteringHappening)} and ${filteredItems.length} items`)

    // sort items
    // FIXME: Sort priority filtering of children
    filteredItems.sort((a, b) => {
      if (a.para?.startTime && b.para?.startTime) {
        const startTimeComparison = a.para.startTime.localeCompare(b.para.startTime)
        if (startTimeComparison !== 0) return startTimeComparison
      } else if (a.para?.startTime) {
        return -1
      } else if (b.para?.startTime) {
        return 1
      }

      if (a.para?.endTime && b.para?.endTime) {
        const endTimeComparison = a.para.endTime.localeCompare(b.para.endTime)
        if (endTimeComparison !== 0) return endTimeComparison
      } else if (a.para?.endTime) {
        return -1
      } else if (b.para?.endTime) {
        return 1
      }

      const priorityA = a.para?.priority ?? 0
      const priorityB = b.para?.priority ?? 0
      if (priorityA !== priorityB) {
        return priorityB - priorityA
      }

      const titleA = a.para?.title?.toLowerCase() ?? ''
      const titleB = b.para?.title?.toLowerCase() ?? ''
      return titleA.localeCompare(titleB)
    })

    // If more than limitToApply, then just keep the first items, otherwise keep all
    const limitToApply = dashboardSettings.maxItemsToShowInSection ?? 20
    const itemsToShow = limitToApply > 0 ? filteredItems.slice(0, limitToApply) : filteredItems.slice()
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

export default useSectionSortAndFilter
