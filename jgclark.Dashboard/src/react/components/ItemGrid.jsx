// @flow
//--------------------------------------------------------------------------
// A grid layout for items within a section.
// Called by ItemGrid component.
// Last updated 2025-01-13 for v2.1.3
//--------------------------------------------------------------------------

import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
// import { useAppContext } from './AppContext.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'

// Set to true to see some subtle shading of section backgrounds
const showColoredBackgrounds = false

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
}

function ItemGrid({ items, thisSection }: Props): React$Node {
  // const { dashboardSettings } = useAppContext()

  // Note: this logic is now moved up to Section's useSectionSortAndFilter
  // const tasksToShow = (dashboardSettings && dashboardSettings.ignoreChecklistItems && items.length)
  // ? items.filter(si => !(si.para?.type === "checklist"))
  // : items
  // const visibleItems = tasksToShow.length ? tasksToShow.map((item) => <ItemRow key={item.ID} item={item} thisSection={thisSection} />) : []

  const visibleItems = items.length
    ? items.map((item) => (
        // Using a complex key to ensure React updates components when item content changes
        <ItemRow key={`${item.ID}_${item.para?.content || item.project?.title || ''}`} item={item} thisSection={thisSection} />
      ))
    : []

  const sectionBackgroundColor =
    items.length === 0 || items[0].itemType === 'itemCongrats'
      ? `color-mix(in srgb, var(--bg-main-color), green 4%)`
      : showColoredBackgrounds && thisSection.sectionTitleColorPart
      ? `color-mix(in srgb, var(--bg-main-color), var(--fg-${thisSection.sectionTitleColorPart}) 4%)`
      : 'var(--bg-main-color)'
  // logDebug('ItemGrid', `sectionBackgroundColor: ${sectionBackgroundColor} from ${String(tasksToShow.length)} items`)

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`} style={{ backgroundColor: sectionBackgroundColor }}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
