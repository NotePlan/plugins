// ItemGrid.jsx
// @flow
/**
 * A grid layout for items within a section.
 */

import React, { useEffect, useState } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ItemRow from './ItemRow.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, deepCopy } from '@helpers/react/reactDev.js'

type Props = {
  items: Array<TSectionItem>,
  thisSection: TSection,
}

function ItemGrid({ items, thisSection }: Props): React$Node {
  const { reactSettings, setReactSettings } = useAppContext()
  const [itemsCopy, setItemsCopy] = useState<Array<TSectionItem>>([])

  // Initialize itemsCopy once when overdueProcessing starts
  useEffect(() => {
    if (!reactSettings) return
    if (!(thisSection.sectionCode === 'OVERDUE')) return
    if (!reactSettings.overdueProcessing) return
    logDebug('ItemGrid', 'effect 1 should be initializing', reactSettings)
    logDebug('ItemGrid', `reactSettings.overdueProcessing: ${reactSettings?.overdueProcessing} items: ${items.length} items, itemsCopy: ${itemsCopy.length} items`)
    if (reactSettings?.overdueProcessing && items.length > 0 && itemsCopy.length === 0) {
      logDebug('ItemGrid', `setItemsCopy: ${items.length} items`)
      setItemsCopy(deepCopy(items))
    }
  }, [reactSettings?.overdueProcessing, reactSettings, items])

 // Effect to handle item processing
useEffect(() => {
  if (!reactSettings) return
  if (!(thisSection.sectionCode === 'OVERDUE')) return
  if (!reactSettings.overdueProcessing) return
  logDebug('ItemGrid', 'effect 2', reactSettings)
  const currentOverdueIndex = reactSettings.currentOverdueIndex || 0
  const dialogIsOpen = reactSettings.dialogData?.isOpen || false

  // Check to advance to the next item
  // We know the next item is ready to be processed because the dialog was closed
  logDebug('ItemGrid', `currentOverdueIndex: ${currentOverdueIndex}, dialogIsOpen: ${dialogIsOpen}`, itemsCopy[currentOverdueIndex])
  if (!dialogIsOpen && currentOverdueIndex < itemsCopy.length && itemsCopy[currentOverdueIndex]) {
    logDebug('ItemGrid', `Opening next installment ${currentOverdueIndex}`)
    // Open dialog with the next item's details
    setReactSettings((prev) => ({
      ...prev,
      dialogData: {
        isOpen: true,
        details: { item: itemsCopy[currentOverdueIndex] },
      },
      currentOverdueIndex: currentOverdueIndex + 1, // Increment the index here
    }))
  } else if (!dialogIsOpen && currentOverdueIndex >= itemsCopy.length) {
    logDebug('ItemGrid', `Over the limit?  ${currentOverdueIndex >= itemsCopy.length} ${currentOverdueIndex} >= ${itemsCopy.length}`)
    if (itemsCopy?.length > 0) {
      // on first load, we don't want to reset yet
      // All items processed, reset the processing state
      setReactSettings((prev) => ({
        ...prev,
        overdueProcessing: false,
        currentOverdueIndex: -1,
        dialogData: { isOpen: false, details: null },
      }))
      setItemsCopy([]) // Clear itemsCopy to allow for reinitialization later
    }
  }
}, [thisSection.sectionCode, reactSettings, itemsCopy])


  const visibleItems = items.map((item, index) => <ItemRow key={item.ID} item={item} thisSection={thisSection} />)

  return (
    <div className="sectionItemsGrid" id={`${thisSection.ID}-Section`}>
      {visibleItems}
    </div>
  )
}

export default ItemGrid
