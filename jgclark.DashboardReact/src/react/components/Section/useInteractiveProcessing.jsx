// useInteractiveProcessing.jsx
// @flow
/**
 * Custom hook for handling interactive processing logic
 * Is loaded by all sections but should only run for the button that was checked
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
import type { TSectionItem, TSection, TSharedSettings } from '../../../types.js'
import { logDebug, JSP } from '@helpers/react/reactDev.js'

function useInteractiveProcessing(
  items: Array<TSectionItem>,
  thisSection: TSection,
  itemsCopy: Array<TSectionItem>,
  setItemsCopy: (Array<TSectionItem>) => void,
  reactSettings: any,
  setReactSettings: (any) => void,
  sendActionToPlugin: (string, Object, string, boolean) => void,
  sharedSettings: TSharedSettings,
): void {

  // Check if this section should process interactively
  const shouldProcess = reactSettings?.interactiveProcessing?.sectionName === thisSection.name

  // Initialization effect
  useEffect(() => {
    if (!shouldProcess) return
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    if (reactSettings.interactiveProcessing.sectionName !== thisSection.name) return
    // logDebug('useInteractiveProcessing', `reactSettings.interactiveProcessing: ${reactSettings?.interactiveProcessing ? 'yes' : 'no'}; items in section ${String(thisSection.name)}: ${items.length} items, itemsCopy (remaining items): ${itemsCopy.length} items`);
    if (reactSettings?.interactiveProcessing && items.length > 0 && reactSettings.interactiveProcessing.startingUp) {
      logDebug('useInteractiveProcessing', `startingUp==true, Initializing itemsCopy to: ${items.length} items`)
      setItemsCopy([...items])
      setReactSettings((prev) => ({ ...prev, interactiveProcessing: { ...prev.interactiveProcessing, startingUp: false } }))
    }
  }, [reactSettings, items, itemsCopy, thisSection, setItemsCopy, setReactSettings, shouldProcess])

  // Remove last processed item from itemsCopy
  useEffect(() => {
    if (!shouldProcess) return
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    if (reactSettings.interactiveProcessing.sectionName !== thisSection.name) return
    const { interactiveProcessing, dialogData } = reactSettings
    const { startingUp, currentIPIndex, totalTasks } = interactiveProcessing
    const dialogIsOpen = dialogData?.isOpen || false
    if (!dialogIsOpen && currentIPIndex < totalTasks && !startingUp) {
      logDebug('useInteractiveProcessing', `dialog was closed; Slicing first item off itemsCopy; currentIPIndex:${currentIPIndex}/${totalTasks} dialogIsOpen:${dialogIsOpen} itemsCopy.length: ${itemsCopy.length}`, itemsCopy[0])
      // remove the first item off itemsCopy
      setItemsCopy([...itemsCopy.slice(1)])
    }
  }, [itemsCopy, reactSettings, setItemsCopy, shouldProcess])

  // Processing effect
  // Sets the next item in itemsCopy to be processed and opens the dialog
  useEffect(() => {
    if (!shouldProcess) return
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    const { interactiveProcessing, dialogData } = reactSettings
    const { startingUp, sectionName, currentIPIndex, totalTasks } = interactiveProcessing
    if (sectionName !== thisSection.name) return
    if (startingUp) return
    logDebug('useInteractiveProcessing', `continuing... Section:${interactiveProcessing.sectionName}" ${interactiveProcessing.currentIPIndex}/${interactiveProcessing.totalTasks}} itemsCopy.length=${itemsCopy.length}`)
    if (itemsCopy.length === 0) return
    const dialogIsOpen = dialogData?.isOpen || false

    if (!dialogIsOpen && currentIPIndex < totalTasks && itemsCopy[0]) {
      logDebug('useInteractiveProcessing', `Opening next item: ${JSP(itemsCopy[0])}`)
      setReactSettings((prev) => ({
        ...prev,
        dialogData: {
          ...prev.dialogData,
          isOpen: true,
          isTask: true,
          details: { ...prev.dialogData.details, item: itemsCopy[0] },
        },
        interactiveProcessing: { ...prev.interactiveProcessing, currentIPIndex: currentIPIndex + 1, startingUp: false }
      }))
      if (sharedSettings.interactiveProcessingHighlightTask) {
        const actionType = 'showLineInEditorFromFilename'
        sendActionToPlugin(actionType, { actionType, item: itemsCopy[0] }, 'Title clicked in Dialog', true)
      }
    } else {
      logDebug('useInteractiveProcessing', `Over the limit? ${currentIPIndex.toString()} >= ${itemsCopy.length.toString()} ${String(currentIPIndex >= itemsCopy.length)}`)
      if (!itemsCopy.length) {
        setReactSettings((prev) => ({
          ...prev,
          interactiveProcessing: false,
          currentIPIndex: -1,
          dialogData: { isOpen: false, details: null },
        }))
        setItemsCopy([])
      }
    }
  }, [thisSection, reactSettings, itemsCopy, setItemsCopy, setReactSettings, sendActionToPlugin, sharedSettings, shouldProcess])
}

export default useInteractiveProcessing
