// @flow
//-----------------------------------------------------------------------------
// useInteractiveProcessing.jsx
// Custom hook for handling interactive processing logic.
// Last updated 2024-09-19 for v2.1.0.a11 by @jgclark
//-----------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import type { TSectionItem, TSection, TDashboardSettings } from '../../../types.js'
import { logDebug, logInfo, JSP } from '@helpers/react/reactDev.js'

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
 * @param {Function} sendActionToPlugin - Function to send actions to a plugin, using {actionType, data, logString, updateGlobalData?)
 * @param {Function} dashboardSettings
 * @returns {void}
 */

function useInteractiveProcessing(
  items: Array<TSectionItem>,
  thisSection: TSection,
  itemsCopy: Array<TSectionItem>, // TODO: Why does this come in as a parameter? Should this be local state? 
  setItemsCopy: (Array<TSectionItem>) => void, // TODO: as above
  reactSettings: any,
  setReactSettings: (any) => void,
  sendActionToPlugin: (string, Object, string, boolean) => void,
  dashboardSettings: TDashboardSettings,
): void {

  // Check if this section should process interactively
  const shouldProcess = reactSettings?.interactiveProcessing?.sectionName === thisSection.name

  // TEST: extra states. These didn't help,
  const [currentIPIndex, setCurrentIPIndex] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [startingUp, setStartingUp] = useState(true)

  // Initialization effect
  // TODO: Is there a different way to approach this, DBW? Rather than this useEffect, could we not have a simpler initIP() function that is explicitly called when we want it?
  useEffect(() => {
    if (!shouldProcess) return
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    if (reactSettings.interactiveProcessing.sectionName !== thisSection.name) return
    // logInfo('useInteractiveProcessing', `reactSettings.interactiveProcessing: ${reactSettings?.interactiveProcessing ? 'yes' : 'no'}; init: items in section ${String(thisSection.name)}: ${items.length} items, itemsCopy (remaining items): ${itemsCopy.length} items`);
    if (reactSettings?.interactiveProcessing && items.length > 0 && reactSettings.interactiveProcessing.startingUp) {
      logInfo('useInteractiveProcessing', `startingUp=true, Initializing itemsCopy to: ${items.length} items`)
      setItemsCopy([...items])
      setReactSettings((prev) => ({ ...prev, interactiveProcessing: { ...prev.interactiveProcessing, startingUp: false } }))
      // TEST: use local state as well
      setTotalTasks(items.length)
      setStartingUp(false)
    }
  }, [/*reactSettings,*/ items, /*itemsCopy,*/ thisSection, /*setItemsCopy, setReactSettings,*/ shouldProcess])

  // Remove last processed item from itemsCopy
  // TODO: Is there a different way to approach this, DBW? Rather than this useEffect, could we not have a simpler nextIPItem() function that is explicitly called when we want it?
  // FIXME: Why is this being triggered before user has taken any action on the first item?
  useEffect(() => {
    if (!shouldProcess) return
    if (!itemsCopy[0]) return
    if (!reactSettings) return
    const { interactiveProcessing, dialogData } = reactSettings
    if (!interactiveProcessing) return
    if (interactiveProcessing.sectionName !== thisSection.name) return
    // const { startingUp, currentIPIndex, totalTasks } = interactiveProcessing
    if (startingUp) return // stops it running before user has taken any action.
    const dialogIsOpen = dialogData?.isOpen || false
    if (!dialogIsOpen && currentIPIndex < totalTasks) {
      logInfo('useInteractiveProcessing', `dialog was closed; Slicing first item off itemsCopy; currentIPIndex:${currentIPIndex}/${totalTasks} dialogIsOpen:${dialogIsOpen} itemsCopy.length: ${itemsCopy.length}`, itemsCopy[0])

      // Work out how many items to remove
      let removeCount = 1
      if (itemsCopy[0].para?.hasChild && itemsCopy.length >= 1) {
        // also remove any children of the first item
        for (let i = 1; i < itemsCopy.length; i++) {
          const item = itemsCopy[i]
          logInfo('useInteractiveProcessing', `- checking for children of '${item?.para?.content ?? 'n/a'}'`)
          if (item?.para?.isAChild) {
            logInfo('useInteractiveProcessing', `  - found child '${item.para?.content}'`)
            removeCount++
          } else {
            break // stop looking
          }
        }
      }
      logInfo('useInteractiveProcessing', `removeCount=${String(removeCount)}`)

      // remove the first item(s) off itemsCopy. ✅
      setItemsCopy([...itemsCopy.slice(removeCount)])
      // FIXME: increment currentIPIndex by removeCount.
      setReactSettings((prev) => ({
        ...prev,
        interactiveProcessing: { ...prev.interactiveProcessing, currentIPIndex: currentIPIndex + removeCount }
      }))
      // TEST: use local state as well
      setCurrentIPIndex(currentIPIndex + removeCount)
      logInfo('useInteractiveProcessing', `after removal, ${itemsCopy.length} itemsCopy left, and currentIPIndex will be ${String(currentIPIndex)}`)
    }
  }, [itemsCopy, /*reactSettings, setItemsCopy, shouldProcess*/])

  // Processing effect
  // Sets the next item in itemsCopy to be processed and opens the dialog
  // FIXME: why is this called twice in quick succession? 0/n then 1/n?
  useEffect(() => {
    if (!shouldProcess) return
    if (!reactSettings) return
    if (!reactSettings.interactiveProcessing) return
    const { interactiveProcessing, dialogData } = reactSettings
    // const { startingUp, sectionName, currentIPIndex, totalTasks } = interactiveProcessing
    const { startingUp, sectionName } = interactiveProcessing
    if (sectionName !== thisSection.name) return
    if (startingUp) return // stops it running before user has taken any action
    logInfo('useInteractiveProcessing', `- process Section ${interactiveProcessing.sectionName}: ${interactiveProcessing.currentIPIndex}/${interactiveProcessing.totalTasks} with ${itemsCopy.length} itemsCopy`)
    if (itemsCopy.length === 0) return
    const dialogIsOpen = dialogData?.isOpen || false

    if (!dialogIsOpen && currentIPIndex < totalTasks && itemsCopy[0]) {
      logInfo('useInteractiveProcessing', `Opening next item: '${itemsCopy[0].para?.content}'`)
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
      // TEST: using local state as well
      setCurrentIPIndex(currentIPIndex + 1)
      setStartingUp(false)

      if (dashboardSettings.interactiveProcessingHighlightTask) {
        const actionType = 'showLineInEditorFromFilename'
        // Tell plugin to highlight line in editor, and updateGlobalData (why?)
        sendActionToPlugin(actionType, { actionType, item: itemsCopy[0] }, 'Title clicked in IP Dialog', true)
      }
    } else {
      // FIXME: being called many more times when using IP.
      logInfo('useInteractiveProcessing', `Over the limit? ${String(currentIPIndex)} >= ${String(itemsCopy.length)} ${String(currentIPIndex >= itemsCopy.length)}`)
      if (!itemsCopy.length) {
        setReactSettings((prev) => ({
          ...prev,
          interactiveProcessing: false,
          // currentIPIndex: -1,
          dialogData: { isOpen: false, details: null },
        }))
        setCurrentIPIndex(-1)
        setItemsCopy([])
      }
    }
    // }, [thisSection, reactSettings, itemsCopy, /* setItemsCopy, setReactSettings, sendActionToPlugin, dashboardSettings,  shouldProcess */])
  }, [currentIPIndex, itemsCopy, /* setItemsCopy, setReactSettings, sendActionToPlugin, dashboardSettings,  shouldProcess */])
}

export default useInteractiveProcessing
