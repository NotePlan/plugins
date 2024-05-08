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
  logDebug(`Dashboard`, `inside component code`)

  const { reactSettings, setReactSettings, sendActionToPlugin, sharedSettings } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData

  const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list
  const sections = sharedSettings?.hideDuplicates ? removeDuplicates(origSections.slice(), ['filename', 'content'], sectionPriority) : origSections
  console.log('Dashboard: pluginData:', pluginData, sections)

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
    clo(sharedSettings, `Dashboard: sharedSettings is currently ${sharedSettings ? 'set to' : 'undefined'}`)
  }, [sharedSettings])

  // const handleDialogOpen = () => {
  //   updateDialogOpen(true)
  // }

  // Update dialogData when pluginData changes, e.g. when the dialog is open and you are changing things like priority
  useEffect(() => {
    if (!(reactSettings?.dialogData?.isOpen)) return
    const { dialogData } = reactSettings
    const {details:dialogItemDetails} = dialogData
    if (!dialogItemDetails) return
    logDebug('Dashboard', `top of useEffect: isOpen=${String(dialogData?.isOpen) || ''} itemID="${reactSettings?.dialogData?.details?.item?.ID || ''}"  dialogData=${JSP(reactSettings?.dialogData) || ''}  pluginData`, pluginData)
    if (dialogData.isOpen && dialogItemDetails?.item.ID) {
      if (!dialogData?.details?.item) return
      const { ID: openItemInDialogID } = dialogItemDetails.item
      const sectionIndexes = findSectionItems(origSections, ['ID'], { ID: openItemInDialogID })
      logDebug('Dashboard', `sectionIndexes: ${JSP(sectionIndexes)}`)
      if (!sectionIndexes?.length) return
      const firstMatch = sectionIndexes[0]
      const newDialogItem = sections[firstMatch.sectionIndex].sectionItems[firstMatch.itemIndex]
      logDebug('Dashboard', `newDialogItem: ${JSON.stringify(newDialogItem)}`)
      if (newDialogItem && JSON.stringify(newDialogItem) !== JSON.stringify(dialogData)) {
        setReactSettings(prev => ({
          ...prev,
          dialogData: {
            ...dialogData,
            details: newDialogItem
          },
          lastChange: '_Dialog was open, and data changed underneath'
        }))
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
