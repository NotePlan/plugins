// useInteractiveProcessing.jsx
// @flow
/**
 * Custom hook for handling overdue processing logic.
 * 
 * @param {Array<TSectionItem>} items - The items in the current section.
 * @param {TSection} thisSection - The current section information.
 * @param {Array<TSectionItem>} itemsCopy - A copy of the items for processing.
 * @param {Function} setItemsCopy - Function to set the items copy state.
 * @param {Object} reactSettings - The current React settings from context.
 * @param {Function} setReactSettings - Function to set the React settings state.
 * @param {Function} sendActionToPlugin - Function to send actions to a plugin.
 * @returns {void}
 */

import { useEffect } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import { logDebug } from '@helpers/react/reactDev.js'

function useInteractiveProcessing(
  items: Array<TSectionItem>,
  thisSection: TSection,
  itemsCopy: Array<TSectionItem>,
  setItemsCopy: (Array<TSectionItem>) => void,
  reactSettings: any,
  setReactSettings: (any) => void,
  sendActionToPlugin: (string, Object, string, boolean) => void
): void {
// Sets the items to be interactively processed when reactSettings.interactiveProcessing has been set
useEffect(() => {
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    if (reactSettings.interactiveProcessing !== thisSection.name) return
    logDebug('useInteractiveProcessing', `reactSettings.interactiveProcessing: ${reactSettings?.interactiveProcessing ? 'yes' : 'no'}; items in section ${String(thisSection.name)}: ${items.length} items, itemsCopy (overdue loop items to work on): ${itemsCopy.length} items`)
    if (reactSettings?.interactiveProcessing && items.length > 0 && itemsCopy.length === 0) {
        logDebug('useInteractiveProcessing', `Initializing itemsCopy to: ${items.length} items`)
        setItemsCopy([...items])
    } else {
        logDebug('useInteractiveProcessing', `No initialization necessary...continuing`)
    }
}, [reactSettings?.interactiveProcessing, reactSettings, items, itemsCopy, thisSection.sectionCode, setItemsCopy])

  // Sets the next item in itemsCopy to be processed and opens the dialog
  useEffect(() => {
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    if (reactSettings.interactiveProcessing !== thisSection.name) return
    if (itemsCopy.length === 0) return
    logDebug('useInteractiveProcessing', 'overdue processing, check for items to process', reactSettings)
    const currentOverdueIndex = reactSettings.currentOverdueIndex || 0
    const dialogIsOpen = reactSettings.dialogData?.isOpen || false

    logDebug('useInteractiveProcessing', `currentOverdueIndex: ${currentOverdueIndex}, dialogIsOpen: ${dialogIsOpen} itemsCopy.length: ${itemsCopy.length}`, itemsCopy[currentOverdueIndex])
    if (!dialogIsOpen && currentOverdueIndex < itemsCopy.length && itemsCopy[currentOverdueIndex]) {
      logDebug('useInteractiveProcessing', `Opening next overdue item at index: ${currentOverdueIndex}`)
      setReactSettings((prev) => ({
        ...prev,
        dialogData: {
          ...prev.dialogData,
          isOpen: true,
          isTask: true,
          details: { ...prev.dialogData.details, item: itemsCopy[currentOverdueIndex] },
        },
        currentOverdueIndex: currentOverdueIndex + 1,
      }))
      const actionType = 'showLineInEditorFromFilename'
      sendActionToPlugin(actionType, { actionType, item: itemsCopy[currentOverdueIndex] }, 'Title clicked in Dialog', true)
    } else if (!dialogIsOpen && currentOverdueIndex >= itemsCopy.length) {
        logDebug('useInteractiveProcessing', `Over the limit?  ${String(currentOverdueIndex >= itemsCopy.length)} ${currentOverdueIndex.toString()} >= ${itemsCopy.length.toString()}`)
        if (itemsCopy?.length > 0) {
            setReactSettings((prev) => ({
                ...prev,
                interactiveProcessing: false,
                currentOverdueIndex: -1,
                dialogData: { isOpen: false, details: null },
            }))
            setItemsCopy([])
        }
    }
  }, [thisSection.sectionCode, reactSettings, itemsCopy, setItemsCopy, setReactSettings, sendActionToPlugin])
}

export default useInteractiveProcessing
