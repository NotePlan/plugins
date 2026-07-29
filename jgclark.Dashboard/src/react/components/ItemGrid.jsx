// @flow
//--------------------------------------------------------------------------
// A grid layout for items within a section.
// Called by ItemGrid component.
// Last updated 2026-07-29 for v2.4.0.b55 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { logDebug, logInfo } from '@helpers/dev'

// Set to true to see some subtle shading of section backgrounds
// const showColoredBackgrounds = true

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
  onToggleShowAll?: () => void,
}

/**
 * Stable React key for a section row. Prefer reminder.id (Calendar UUID) over index-based REM-N IDs
 * so StatusIcon local state is not reused when a mid-list item is removed and remaining rows renumber.
 * @param {TSectionItem} item
 * @returns {string}
 */
function itemRowKey(item: TSectionItem): string {
  if (item.reminder?.id) return `reminder:${item.reminder.id}`
  const contentKey = item.para?.content || item.project?.title || item.reminder?.title || item.message || ''
  return `${item.ID}_${contentKey}`
}

function ItemGrid({ items, thisSection, onToggleShowAll }: Props): React$Node {
  const visibleItems = items.length
    ? items.map((item) => (
        // Using a complex key to ensure React updates components when item content changes (not just when ID changes)
        <ItemRow key={itemRowKey(item)} item={item} thisSection={thisSection} onToggleShowAll={onToggleShowAll} />
      ))
    : []

  // Calculate a subtle green background colour for the section if there are no items,
  // or if the first item is a congrats message.
  // or if the section has asked for a coloured background.
  // WINS uses theme alt background only for that section.
  const sectionBackgroundColor =
    thisSection.sectionCode === 'WINS'
      ? 'var(--bg-alt-color)'
      : items.length === 0 || items[0].itemType === 'itemCongrats'
      ? `color-mix(in srgb, var(--bg-main-color), green 4%)`
      : thisSection.showColoredBackground && thisSection.sectionTitleColorPart
      ? `color-mix(in srgb, var(--bg-main-color), var(--fg-${thisSection.sectionTitleColorPart}) 4%)`
      : 'var(--bg-main-color)'
  // if (sectionBackgroundColor !== 'var(--bg-main-color)') logDebug('ItemGrid', `sectionBackgroundColor: ${sectionBackgroundColor} from ${String(items.length)} items`)

  // RENDER ------------------------------------------------------------

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`} style={{ backgroundColor: sectionBackgroundColor }}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
