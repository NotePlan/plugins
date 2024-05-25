// ItemGrid.jsx
// @flow
/**
 * A grid layout for items within a section.
 */

import React, { useState } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import useInteractiveProcessing from '../customHooks/useInteractiveProcessing.jsx'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
};

function ItemGrid({ items, thisSection }: Props): React$Node {
  const { reactSettings, setReactSettings, sendActionToPlugin } = useAppContext()
  const [itemsCopy, setItemsCopy] = useState<Array<TSectionItem>>([])

  useInteractiveProcessing(items, thisSection, itemsCopy, setItemsCopy, reactSettings, setReactSettings, sendActionToPlugin)

  const visibleItems = items.map((item) => <ItemRow key={item.ID} item={item} thisSection={thisSection} />)

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
 