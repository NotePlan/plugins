// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by parent component.
// Last updated 2024-05-28 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import { getSectionsWithoutDuplicateLines, countTotalVisibleSectionItems, sortSections } from '../support/sectionHelpers.js'
import { findSectionItems } from '../../dataGeneration.js'
import { allSectionDetails, sectionDisplayOrder } from "../../constants.js"
import { getFeatureFlags } from '../../shared.js'
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
// import { type TActionButton } from '../../types.js'
import Header from './Header.jsx'
import Section from './Section.jsx'
import ToolTipOnModifierPress from './ToolTipOnModifierPress.jsx'
import Dialog from './Dialog.jsx'
import IdleTimer from './IdleTimer.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, logError, clo, clof, JSP } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
declare var globalSharedData: {
  pluginData: {
    sections: Array<Object>,
  },
};

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

//--------------------------------------------------------------------------
// Dashboard Component Definition
//--------------------------------------------------------------------------
const Dashboard = ({ pluginData }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { reactSettings, setReactSettings, sendActionToPlugin, sharedSettings, updatePluginData } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData
  const { FFlag_MetaTooltips } = getFeatureFlags(pluginData.settings, sharedSettings)

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  useWatchForResizes(sendActionToPlugin)
    // 5s hack timer to work around cache not being reliable (only runs for users, not DEVs)
    const { refreshTimer } = useRefreshTimer({ maxDelay: 5000, enabled: pluginData.settings._logLevel !== "DEV" })

  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const containerRef = useRef <? HTMLDivElement > (null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  const metaKeyConfig = { text: 'Meta Key Pressed', style: { color: 'red' } }
  const shiftKeyConfig = { text: 'Shift Key Pressed', style: { color: 'blue' } }
  const ctrlKeyConfig = { text: 'Ctrl Key Pressed', style: { color: 'green' } }
  const altKeyConfig = { text: 'Alt Key Pressed', style: { color: 'yellow' } }

  const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list

  let sections = origSections
  let unduplicatedSections = sections
  
  if (sections.length > 1 && sharedSettings) {
    unduplicatedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, sharedSettings)
  }
  
  logDebug('Dashboard', `origSections length: ${origSections.length}`)
  logDebug('Dashboard', `unduplicatedSections length: ${unduplicatedSections.length}`)
  // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

  sections = sharedSettings?.hideDuplicates ? unduplicatedSections : origSections
  
  logDebug('Dashboard', `sections after hide duplicates: ${sections.length}`)
  // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

  sections = sortSections(sections, sectionDisplayOrder)
  logDebug('Dashboard', `sections after sort length: ${sections.length}`)
  // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)


  const dashboardContainerStyle = {
    maxWidth: '98vw',
    width: '98vw',
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  // Force the window to be focused on load so that we can capture clicks on hover
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (!sharedSettings) {
      // Fallback or initialization logic for sharedSettings
      logError('Dashboard', 'sharedSettings is undefined')
    } 
  }, [sharedSettings])
  
  // temporary code to output variable changes to Chrome DevTools console
  const logChanges = (label: string, value: any) => (!window.webkit) ? logDebug(`Dashboard`, `${label}${!value || Object.keys(value).length===0 ? ' (not intialized yet)' : ' changed vvv'}`, value) : null
  useEffect(() => {
    (sharedSettings && Object.keys(sharedSettings).length > 0) ? logChanges('sharedSettings', sharedSettings) : null
  }, [sharedSettings])
  useEffect(() => {
    logChanges('reactSettings', reactSettings)
  }, [reactSettings])
  useEffect(() => {
    logChanges('pluginData', pluginData)
  }, [pluginData])

  // Load the rest of the content (Today section loads first)
  useEffect(() => {
    // if we did a force reload (DEV only) of the full sections data, no need to load the rest
    // but if we are doing a normal load, then get the rest of the section data incrementally
    // this executes before globalSharedData is saved into state 
    logDebug('Dashboard', `lastFullRefresh: ${lastFullRefresh} and and sections.length: ${sections.length}`)
    if (sections.length <= 2) {
      const sectionCodes = allSectionDetails.slice(1).map(s => s.sectionCode)
      sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes }, 'Dashboard loaded', true)
    }
  }, [])

  // Change the title when the section data changes
  // TODO: this doesn't work and I'm not sure it ever can
  useEffect(() => {
    const totalUnduplicatedSectionItems = countTotalVisibleSectionItems(unduplicatedSections, sharedSettings)
    const windowTitle = `Dashboard (React) - ${totalUnduplicatedSectionItems} items`
    if (document.title !== windowTitle) {
      // logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
    }
  }, [pluginData.sections])

  // when reactSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (reactSettings?.lastChange && typeof reactSettings.lastChange === 'string' && reactSettings.lastChange.length > 0 && reactSettings.lastChange[0] !== '_') {
      const trimmedReactSettings = { ...reactSettings, lastChange: '_Saving', dialogData: { isOpen: false, isTask: true, details: {} } }
      const strReactSettings = JSON.stringify(trimmedReactSettings)
      sendActionToPlugin('reactSettingsChanged', { actionType: 'reactSettingsChanged', settings: strReactSettings }, 'Dashboard reactSettings updated', true)
    }
  }, [reactSettings])

  // when sharedSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (sharedSettings?.lastChange && typeof sharedSettings.lastChange === 'string' && sharedSettings.lastChange.length > 0 && sharedSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `Watcher for sharedSettings changes. Shared settings updated: "${sharedSettings.lastChange}" sending to plugin to be saved`, sharedSettings)
      const strSharedSetings = JSON.stringify(sharedSettings)
      sendActionToPlugin('sharedSettingsChanged', { actionType: 'sharedSettingsChanged', settings: strSharedSetings }, 'Dashboard sharedSettings updated', true)
    } else if (sharedSettings && Object.keys(sharedSettings).length > 0) {
      // logDebug('Dashboard', `Watcher for sharedSettings changes. Shared settings updated: ${JSON.stringify(sharedSettings,null,2)}`,sharedSettings)
    }
  }, [sharedSettings])

  // Update dialogData when pluginData changes, e.g. when the dialog is open and you are changing things like priority
  useEffect(() => {
    if ((!reactSettings?.dialogData || !reactSettings.dialogData.isOpen)) return
    const { dialogData } = reactSettings
    const { details: dialogItemDetails } = dialogData
    if (!dialogData.isOpen || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    if (!(dialogData?.details?.item)) return
    if (dialogItemDetails?.item?.ID) {
      const { ID: openItemInDialogID } = dialogItemDetails.item
      logDebug('Dashboard', `in useEffect on dialog details change, openItemInDialogID: ${openItemInDialogID}`)
      const sectionIndexes = findSectionItems(sections, ['ID'], { ID: openItemInDialogID })
      logDebug('Dashboard', `JSON data changed; sectionIndexes: ${JSP(sectionIndexes, 2)}`)
      if (!sectionIndexes?.length) return
      const matchingIndex = sectionIndexes[0] // there can only be max one match b/c of the ID matching
      clo(matchingIndex,`Dashboard: matchingIndex`)
      const { sectionIndex, itemIndex } = matchingIndex
      // clo(sections[sectionIndex].sectionItems, `Dashboard : sections[${sectionIndex}] length=${sections[sectionIndex].sectionItems.length}`)
      const newSectionItem = sections[sectionIndex].sectionItems[itemIndex]
      clo(newSectionItem, `Dashboard: newSectionItem`)
      clo(`Dashboard: in useEffect on dialog details change, previous dialogData=${JSP(reactSettings?.dialogData)}\n...incoming data=${JSP(newSectionItem, 2)}`)
      // used to do the JSON.stringify to compare, but now that an .updated field is used, they will be different
      if (newSectionItem && newSectionItem.updated /* && JSON.stringify(newSectionItem) !== JSON.stringify(dialogData?.details?.item) */) {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem, 2)}\n...will update dialogData`)
        // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change`)
        setReactSettings(prev => {
          const newData = {
            ...prev,
            dialogData: {
              ...prev.dialogData,
              details: {
                ...prev.dialogData.details /* to save the clickPosition */, 
                item: newSectionItem
              }
            },
            lastChange: '_Dialog was open, and data changed underneath'
          }
          // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change, setting reactSettings to: ${JSP(newData, 2)}`)
          return newData
        })
        logError('Dashboard', `TODO: need to reset the updated field in sections after using it here`)

      } else {
        // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change, newSectionItem did not change from previous: ${JSP(newSectionItem)}`)
      }
    }
  }, [pluginData, setReactSettings, reactSettings?.dialogData])

  // 
  useEffect(() => {
    if (pluginData.startDelayedRefreshTimer) {
      logDebug('Dashboard', `plugin sent pluginData.startDelayedRefreshTimer=true, setting up delayed timer.`)
      updatePluginData({...pluginData, startRefreshTimer: false},'Got message from plugin; resetting refresh timer')
      refreshTimer()
    }
  }, [pluginData.startDelayedRefreshTimer])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleDialogClose = (xWasClicked: boolean = false) => {
    xWasClicked ? null : refreshTimer() // TODO: for now refresh after every dialog close, but could be more selective later
    const interactiveProcessing = xWasClicked ? { interactiveProcessing: false, dialogData: { isOpen: false, details: null } } : {}
    setReactSettings((prev) => ({ ...prev, dialogData: { ...prev.dialogData, isOpen: false }, lastChange: `_Dashboard-DialogClosed`, ...interactiveProcessing }))
  }

  // Deal with the delayed refresh when a button was clicked
  // Because sections and buttons could be destroyed after a click, we need to
  // refresh from here
  const handleCommandButtonClick = (/*  button: TActionButton */) => {
    // logDebug('Dashboard', `handleCommandButtonClick was called for button: ${button.display}; setting up delayed timer.`)
    // refreshTimer() // TODO: for now refresh after every button click, but should be more selective
  }

  const autoRefresh = () => {
    logDebug('Dashboard', `${new Date().toString()} Auto-Refresh time!`)
    const actionType = 'refresh'
    sendActionToPlugin(actionType, { actionType }, 'Auto-Refresh time!', true)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (sections.length === 0) {
    return <div className="dashboard">No Sections to display (this is an error)...</div>
  }
  return (
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef}>
      {sharedSettings.autoUpdateEnabled && (
        <IdleTimer
          idleTime={parseInt(sharedSettings?.autoUpdateAfterIdleTime?.length ? sharedSettings.autoUpdateAfterIdleTime : "5") * 60 * 1000 /* 5 minutes default */}
          onIdleTimeout={autoRefresh}
        />
      )}
      <div className="dashboard">
        <Header lastFullRefresh={lastFullRefresh} />
        {sections.map((section, index) => (
          <Section key={index} section={section} onButtonClick={handleCommandButtonClick} />
        ))}
        <Dialog
          onClose={handleDialogClose}
          isOpen={reactSettings?.dialogData?.isOpen ?? false}
          isTask={reactSettings?.dialogData?.isTask ?? false}
          details={reactSettings?.dialogData?.details ?? {}}
        />
      </div>
      {FFlag_MetaTooltips && !(reactSettings?.dialogData?.isOpen) && (
        <ToolTipOnModifierPress
          metaKey={metaKeyConfig}
          shiftKey={shiftKeyConfig}
          ctrlKey={ctrlKeyConfig}
          altKey={altKeyConfig}
          disappearAfter={2000} /* milliseconds */
        />
      )}
    </div>
  )
}

export default Dashboard
