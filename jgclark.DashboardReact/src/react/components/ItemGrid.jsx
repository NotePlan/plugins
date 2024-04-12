// @flow
import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
}

/**
 * A grid layout for items within a section.
 */
function ItemGrid(inputObj: Props): React$Node {
  const { items, thisSection } = inputObj
  const { reactSettings } = useAppContext()

  console.log(`ItemGrid for section ${thisSection.sectionType}/${thisSection.ID}: ${items.length} items`)

  const visibleItems = items?.map((item, index) => (
    !reactSettings.filterPriorityItems || item.para?.priority || 0 > 0
      ? <ItemRow key={index} item={item} thisSection={thisSection} />
      : null)) ?? []

  console.log(`selected ${visibleItems.length} visible items`)

  // TODO: equivalent of:
  // if (filteredOut > 0) {
  //   items = filteredItems
  //   items.push({
  //     ID: `${section.ID}-Filter`,
  //     content: `There are also ${filteredOut} lower-priority items currently hidden`,
  //     rawContent: 'Filtered out',
  //     filename: '',
  //     type: 'filterIndicator',
  //   })
  // }

  return (
    // FIXME: find a way to include this <!--- Section ${String(sectionNumber)}: ${section.name} Items Grid --->`
    <div className="sectionItemsGrid"
      id={`${thisSection.ID}-Section`}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
