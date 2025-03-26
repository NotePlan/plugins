// @flow
//--------------------------------------------------------------------------
// A grid layout for items within a section.
// Called by ItemGrid component.
// Last updated 2025-02-23 for v2.2.0.a3
//--------------------------------------------------------------------------

import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
// import { useAppContext } from './AppContext.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'

// Set to true to see some subtle shading of section backgrounds
// const showColoredBackgrounds = false

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
}

function ItemGrid({ items, thisSection }: Props): React$Node {
  const visibleItems = items.length
    ? items.map((item) => (
      // Using a complex key to ensure React updates components when item content changes (not just when ID changes)
        <ItemRow key={`${item.ID}_${item.para?.content || item.project?.title || ''}`} item={item} thisSection={thisSection} />
      ))
    : []

  // Add a subtle green background colour to the section if there are no items, or if the first item is a congrats message,
  // or if the section has asked for a coloured background.
  const sectionBackgroundColor =
    items.length === 0 || items[0].itemType === 'itemCongrats'
      ? `color-mix(in srgb, var(--bg-main-color), green 4%)`
      : (thisSection.showColoredBackground && thisSection.sectionTitleColorPart)
        ? `color-mix(in srgb, var(--bg-main-color), var(--fg-${thisSection.sectionTitleColorPart}) 4%)`
      : 'var(--bg-main-color)'
  if (sectionBackgroundColor !== 'var(--bg-main-color)') logDebug('ItemGrid', `sectionBackgroundColor: ${sectionBackgroundColor} from ${String(items.length)} items`)

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`} style={{ backgroundColor: sectionBackgroundColor }}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
