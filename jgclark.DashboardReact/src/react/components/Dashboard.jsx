// @flow

import React, { useEffect } from 'react'
import { removeDuplicates } from '../support/sectionHelpers.js'
import { findSectionItems } from '../../dataGeneration.js'
// import { type TDialogData } from '../../types.js'
import Header from './Header.jsx'
import Section from './Section.jsx'
import Dialog from './Dialog.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, clo, JSP } from '@helpers/react/reactDev.js'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()

  const { reactSettings, setReactSettings, sendActionToPlugin, sharedSettings } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData

  const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list
  const sections = sharedSettings?.hideDuplicates ? removeDuplicates(origSections.slice(), ['filename', 'content'], sectionPriority) : origSections

  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }

  // when reactSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (reactSettings?.lastChange && typeof reactSettings.lastChange === 'string' && reactSettings.lastChange.length > 0 && reactSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `React settings updated: ${reactSettings.lastChange} sending to plugin to be saved`, reactSettings)
      const trimmedReactSettings = { ...reactSettings, lastChange: '_Saving', dialogData: { isOpen: false, isTask: true, details: {} } }
      const strReactSettings = JSON.stringify(trimmedReactSettings)
      sendActionToPlugin('reactSettingsChanged', { actionType: 'reactSettingsChanged', settings: strReactSettings }, 'Dashboard reactSettings updated', false)
    }
  }, [reactSettings])

  // when sharedSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (sharedSettings?.lastChange && typeof sharedSettings.lastChange === 'string' && sharedSettings.lastChange.length > 0 && sharedSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `Shared settings updated: "${sharedSettings.lastChange}" sending to plugin to be saved`, sharedSettings)
      const strSharedSetings = JSON.stringify(sharedSettings)
      sendActionToPlugin('sharedSettingsChanged', { actionType: 'sharedSettingsChanged', settings: strSharedSetings }, 'Dashboard sharedSettings updated', false)
    }
  }, [sharedSettings])

  // const handleDialogOpen = () => {
  //   updateDialogOpen(true)
  // }

  // Update dialogData when pluginData changes, e.g. when the dialog is open and you are changing things like priority
  useEffect(() => {
    logDebug('Dashboard', `in useEffect one of these changed: pluginData, setReactSettings, reactSettings?.dialogData isOpen=${String(reactSettings?.dialogData?.isOpen)}`)
    if ((!reactSettings?.dialogData || !reactSettings.dialogData.isOpen)) return
    const { dialogData } = reactSettings
    const {details:dialogItemDetails} = dialogData
    logDebug('Dashboard', `dialogData.isOpen: ${String(dialogData.isOpen)}, dialogItemDetails: ${JSP(dialogItemDetails,2)}`)
    if (!dialogData.isOpen  || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    logDebug('Dashboard', `dialogData?.details?.item=${JSP(dialogItemDetails?.item,2)}`)
    if (!(dialogData?.details?.item)) return
    if (dialogItemDetails?.item?.ID) {
      const { ID: openItemInDialogID } = dialogItemDetails.item
      const sectionIndexes = findSectionItems(origSections, ['ID'], { ID: openItemInDialogID })
      logDebug('Dashboard', `sectionIndexes: ${JSP(sectionIndexes,2)}`)
      if (!sectionIndexes?.length) return
      const firstMatch = sectionIndexes[0]
      const newSectionItem = sections[firstMatch.sectionIndex].sectionItems[firstMatch.itemIndex]
      clo('Dashboard',`in useEffect on dialog details change, previous dialogData=${JSP(reactSettings?.dialogData)}`)
      if (newSectionItem && JSON.stringify(newSectionItem) !== JSON.stringify(dialogData?.details?.item)) {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem,2)}\n...will update dialogData`)
        setReactSettings(prev => {
          const newData = {
            ...prev,
            dialogData: {
              ...prev.dialogData,
              details: {
                ...prev.dialogData.details, item: newSectionItem
              }
            },
            lastChange: '_Dialog was open, and data changed underneath'
          }
          logDebug('Dashboard', `in useEffect on dialog details change, setting reactSettings to: ${JSP(newData,2)}`)
          return newData
        })
      } else {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem did not change from previous: ${JSP(newSectionItem,2)}`)
      }
    }
  }, [pluginData, setReactSettings, reactSettings?.dialogData])

  const handleDialogClose = (xWasClicked: boolean = false) => {
    const overdueProcessing = xWasClicked ? { overdueProcessing: false, currentOverdueIndex: -1, dialogData: { isOpen: false, details: null } } : {}
    setReactSettings((prev) => ({ ...prev, dialogData: { isOpen: false, details: {} }, lastChange: `_Dashboard-DialogClosed`, ...overdueProcessing }))
  }

  return (
    <div style={dashboardContainerStyle}>
      {/* CSS for this part is in dashboard.css */}
      <div className="dashboard">
        <Header lastFullRefresh={lastFullRefresh} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
      </div>
      <Dialog onClose={handleDialogClose}
        isOpen={reactSettings?.dialogData?.isOpen || false}
        isTask={reactSettings?.dialogData?.isTask || true}
        details={reactSettings?.dialogData?.details || {}}
      />
    </div>
  )
}

export default Dashboard
