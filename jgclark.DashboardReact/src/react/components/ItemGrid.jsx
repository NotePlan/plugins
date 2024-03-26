// @flow
import React from 'react'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'
import type { ItemRowType } from './flow-types.js'

type Props = {
  items: Array<ItemRowType>,
}

/**
 * A grid layout for items within a section.
 */
const ItemGrid = ({ items }: Props): React$Node => {
  const { reactSettings } = useAppContext()
  const visibleItems = items.map((item, index) => (!reactSettings.filterPriorityItems || item.priority || 0 > 0 ? <ItemRow key={index} {...item} /> : null))
  return <div className="sectionItemsGrid">{visibleItems}</div>
}

export default ItemGrid
