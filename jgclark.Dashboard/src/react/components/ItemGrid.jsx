// @flow
//--------------------------------------------------------------------------
// A grid layout for items within a section.
// Called by ItemGrid component.
// Last updated 2024-07-09 for v2.0.0
//--------------------------------------------------------------------------

import React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
};

function ItemGrid({ items, thisSection }: Props): React$Node {
  const { dashboardSettings } = useAppContext()

  const tasksToShow = (dashboardSettings && dashboardSettings.ignoreChecklistItems && items.length) 
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
 