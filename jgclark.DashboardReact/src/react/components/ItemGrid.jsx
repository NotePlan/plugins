// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the main rows of a Section as a grid
// Last updated 15.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import { logDebug } from '@helpers/dev.js'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
// import { useAppContext } from './AppContext.jsx'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
}

/**
 * A grid layout for items within a section.
 */
function ItemGrid(inputObj: Props): React$Node {
  const { items, thisSection } = inputObj
  // const { reactSettings } = useAppContext()
  logDebug(`ItemGrid`, `Inside code for section ${thisSection.sectionType}/${thisSection.ID} with ${items.length} items`)

  // console.log(`ItemGrid for section ${thisSection.sectionType}/${thisSection.ID}: ${items.length} items`)

  // // FIXME:
  // console.log('- reactSettings.filterPriorityItems = ' + String(reactSettings.filterPriorityItems))

  // const visibleItems = items?.map((item, index) => (
  //   !reactSettings.filterPriorityItems || item.para?.priority || 0 > 0
  //     ? <ItemRow key={index} item={item} thisSection={thisSection} />
  //     : null)) ?? []
  // const filteredOut = items.length - visibleItems.length
  // console.log(`- selected ${visibleItems.length} visible items, with ${String(filteredOut)} filtered out`)

  const visibleItems = items?.map((item, index) => <ItemRow key={index} item={item} thisSection={thisSection} />) ?? []

  return (
    // TODO: find a way to include this <!--- Section ${String(sectionNumber)}: ${section.name} Items Grid --->`
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
