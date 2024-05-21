// @flow

import React, { useEffect, useRef } from 'react'
import { getSectionsWithoutDuplicateLines, countTotalVisibleSectionItems, sortSections } from '../support/sectionHelpers.js'
import { findSectionItems } from '../../dataGeneration.js'
import { allSectionDetails, sectionDisplayOrder } from "../../constants.js"
import {getFeatureFlags} from '../../shared.js'
import Header from './Header.jsx'
import Section from './Section.jsx'
import ToolTipOnModifierPress from './ToolTipOnModifierPress.jsx'
import Dialog from './Dialog.jsx'
import IdleTimer from './IdleTimer.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, clo, JSP } from '@helpers/react/reactDev.js'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

const metaKeyConfig = { text: 'Meta Key Pressed', style: { color: 'red' } }
const shiftKeyConfig = { text: 'Shift Key Pressed', style: { color: 'blue' } }
const ctrlKeyConfig = { text: 'Ctrl Key Pressed', style: { color: 'green' } }
const altKeyConfig = { text: 'Alt Key Pressed', style: { color: 'yellow' } }

const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()

  const { reactSettings, setReactSettings, sendActionToPlugin, sharedSettings } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData
  const { metaTooltips: FFlagMetaTooltips, autoRefresh: FFlagAutoRefresh } = getFeatureFlags(pluginData)

  // logDebug('Dashboard', `Feature Flags: metaTooltips: ${FFlagMetaTooltips}, autoRefresh: ${FFlagAutoRefresh}`)

  const containerRef = useRef <? HTMLDivElement > (null)
  let sections = origSections
  const unduplicatedSections = sections.length === 1 ? sections : (sharedSettings ? getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, sharedSettings) : [])
  sections = sharedSettings?.hideDuplicates ? unduplicatedSections : origSections
  sections = sortSections(sections, sectionDisplayOrder)

  // Force the window to be focused on load so that we can capture clicks on hover
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [])

  // temporary code to output settings to Chrome DevTools console
  useEffect(() => {
    if (!(sharedSettings && Object.keys(sharedSettings).length > 0)) return
    if (!window.webkit) {
      logDebug('Dashboard', `sharedSettings changed`)
      logDebug('Dashboard', `pluginData`, pluginData)
      logDebug('Dashboard', `plugin settings`, pluginData.settings)
      logDebug('Dashboard', `sharedSettings`, sharedSettings)
    }
  }, [sharedSettings])

  // Load the rest of the content (Today section loads first)
  useEffect(() => {
    const sectionCodes = allSectionDetails.slice(1).map(s => s.sectionCode)
    sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes }, 'Dashboard loaded', true)
  }, [])

  // Change the title when the section data changes
  // TODO: this doesn't work and I'm not sure it ever can
  useEffect(() => {
    logDebug('Dashboard', `in useEffect for title setting, pluginData.sections changed; document.title was=${document.title}`)
    const totalUnduplicatedSectionItems = countTotalVisibleSectionItems(unduplicatedSections, sharedSettings)
    const windowTitle = `Dashboard (React) - ${totalUnduplicatedSectionItems} items`
    if (document.title !== windowTitle) {
      logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
      logDebug('Dashboard', `in useEffect, document.title now is: ${document.title}`)
    }
  }, [/* pluginData.sections */])

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
      logDebug('Dashboard', `Watcher for sharedSettings changes. Shared settings updated: "${sharedSettings.lastChange}" sending to plugin to be saved`, sharedSettings)
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
    const { details: dialogItemDetails } = dialogData
    logDebug('Dashboard', `dialogData.isOpen: ${String(dialogData.isOpen)}, dialogItemDetails: ${JSP(dialogItemDetails, 2)}`)
    if (!dialogData.isOpen || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    logDebug('Dashboard', `dialogData?.details?.item=${JSP(dialogItemDetails?.item, 2)}`)
    if (!(dialogData?.details?.item)) return
    if (dialogItemDetails?.item?.ID) {
      const { ID: openItemInDialogID } = dialogItemDetails.item
      const sectionIndexes = findSectionItems(origSections, ['ID'], { ID: openItemInDialogID })
      logDebug('Dashboard', `sectionIndexes: ${JSP(sectionIndexes, 2)}`)
      if (!sectionIndexes?.length) return
      const firstMatch = sectionIndexes[0]
      const newSectionItem = sections[firstMatch.sectionIndex].sectionItems[firstMatch.itemIndex]
      clo(`Dashboard: in useEffect on dialog details change, previous dialogData=${JSP(reactSettings?.dialogData)}`)
      if (newSectionItem && JSON.stringify(newSectionItem) !== JSON.stringify(dialogData?.details?.item)) {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem, 2)}\n...will update dialogData`)
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
          logDebug('Dashboard', `in useEffect on dialog details change, setting reactSettings to: ${JSP(newData, 2)}`)
          return newData
        })
      } else {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem did not change from previous: ${JSP(newSectionItem, 2)}`)
      }
    }
  }, [pluginData, setReactSettings, reactSettings?.dialogData])

  const handleDialogClose = (xWasClicked: boolean = false) => {
    const overdueProcessing = xWasClicked ? { overdueProcessing: false, currentOverdueIndex: -1, dialogData: { isOpen: false, details: null } } : {}
    setReactSettings((prev) => ({ ...prev, dialogData: { isOpen: false, details: {} }, lastChange: `_Dashboard-DialogClosed`, ...overdueProcessing }))
  }

  const autoRefresh = () => {
    logDebug('Dashboard', `${new Date().toString()} Auto-Refresh time!`)
    const actionType = 'refresh'
    sendActionToPlugin(actionType, { actionType }, 'Auto-Refresh time!', true)
  }

  // Note the containerRef is used in the CSS to make the dashboard focusable to accept keyboard clicks; must have a non-negative tabIndex
  return (
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef}>
      {FFlagAutoRefresh && <IdleTimer idleTime={5*60*1000 /* 5 minutes */} onIdleTimeout={autoRefresh} />}
      {/* CSS for this part is in dashboard.css */}
      <div className="dashboard" >
        <Header lastFullRefresh={lastFullRefresh} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
        <Dialog onClose={handleDialogClose}
          isOpen={reactSettings?.dialogData?.isOpen ?? false}
          isTask={reactSettings?.dialogData?.isTask ?? false}
          details={reactSettings?.dialogData?.details ?? {}}
        />
      </div>
      {FFlagMetaTooltips && !(reactSettings?.dialogData?.isOpen) && <ToolTipOnModifierPress
        metaKey={metaKeyConfig}
        shiftKey={shiftKeyConfig}
        ctrlKey={ctrlKeyConfig}
        altKey={altKeyConfig}
        disappearAfter={2000} /* milliseconds */
      />}
    </div>
  )
}

export default Dashboard
