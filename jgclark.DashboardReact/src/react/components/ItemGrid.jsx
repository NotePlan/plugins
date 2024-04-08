// @flow
import React from 'react'
import type { SectionItem } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'

type Props = {
  items: Array<SectionItem>,
}

/**
 * A grid layout for items within a section.
 */
function ItemGrid({ items }: Props): React$Node {
  const { reactSettings } = useAppContext()

  const visibleItems = items?.map((item, index) => (
    !reactSettings.filterPriorityItems || item.priority || 0 > 0
      ? <ItemRow key={index} {...item} />
      : null)) ?? []

  return (
    <div className="sectionItemsGrid">{visibleItems}</div>
  )
}

export default ItemGrid
