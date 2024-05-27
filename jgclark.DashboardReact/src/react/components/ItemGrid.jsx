// ItemGrid.jsx
// @flow
/**
 * A grid layout for items within a section.
 */

import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, clof } from '@helpers/react/reactDev.js'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
};

function ItemGrid({ items, thisSection }: Props): React$Node {
  const { sharedSettings /*, reactSettings, setReactSettings, sendActionToPlugin */ } = useAppContext()

  clof(items,'ItemGrid',['type','content','para'])
  const tasksToShow = (sharedSettings && sharedSettings.ignoreChecklistItems && items.length) 
  ? items.filter(si => !(si.para?.type === "checklist")) 
  : items

  const visibleItems = tasksToShow.map((item) => <ItemRow key={item.ID} item={item} thisSection={thisSection} />)

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
 