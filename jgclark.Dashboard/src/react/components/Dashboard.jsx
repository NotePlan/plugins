// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by parent component.
// Last updated 2024-07-25 for v2.1.0.a7 by @dbw
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import { findSectionItems, copyUpdatedSectionItemData } from '../../dataGeneration.js'
import { allSectionDetails, sectionDisplayOrder, sectionPriority } from "../../constants.js"
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
import { getSectionsWithoutDuplicateLines, countTotalSectionItems, countTotalVisibleSectionItems, sortSections } from './Section/sectionHelpers.js'
// import { type TActionButton } from '../../types.js'
import Header from './Header'
import Section from './Section/Section.jsx'
import Dialog from './Dialog.jsx'
import IdleTimer from './IdleTimer.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, logError, logInfo, clo, clof, JSP } from '@helpers/react/reactDev.js'
import '../css/Dashboard.css'

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
  const { reactSettings, setReactSettings, sendActionToPlugin, dashboardSettings, perspectiveSettings, updatePluginData } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData

  const logSettings = pluginData.logSettings

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  useWatchForResizes(sendActionToPlugin)
  // 5s hack timer to work around cache not being reliable (only runs for users, not DEVs)
  const shortDelayTimerIsOn = logSettings._logLevel !== "DEV"
  const { refreshTimer } = useRefreshTimer({ maxDelay: 5000, enabled: shortDelayTimerIsOn })

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

  let sections = [...origSections]
  let totalSectionItems = countTotalSectionItems(origSections)
  logInfo('Dashboard', `origSections: ${origSections.length} sections with ${String(totalSectionItems)} items`)

  if (sections.length > 1 && dashboardSettings.hideDuplicates) {
    const deduplicatedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, dashboardSettings)
    totalSectionItems = countTotalVisibleSectionItems(deduplicatedSections, dashboardSettings)

    logInfo('Dashboard', `deduplicatedSections: ${deduplicatedSections.length} sections with ${String(totalSectionItems)} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

    sections = deduplicatedSections
    logInfo('Dashboard', `- after hide duplicates: ${sections.length} sections with ${String(countTotalSectionItems(sections))} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)
  }

  sections = sortSections(sections, sectionDisplayOrder)
  logDebug('Dashboard', `sections after sort length: ${sections.length} with ${String(countTotalSectionItems(sections))} items`)
  // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

  // DBW says the 98 was to avoid scrollbars. TEST: removing
  const dashboardContainerStyle = {
    maxWidth: '100vw',  // '98vw',
    width: '100vw', // '98vw',
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  // Force the window to be focused on load so that we can capture clicks on hover
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cssText = `${containerRef.current.style.cssText} outline: none;`
      containerRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (!dashboardSettings) {
      // Fallback or initialization logic for dashboardSettings
      logError('Dashboard', 'dashboardSettings is undefined')
    } 
  }, [dashboardSettings])
  
  // temporary code to output variable changes to Chrome DevTools console
  const logChanges = (label: string, value: any) => (!window.webkit) ? logDebug(`Dashboard`, `${label}${!value || Object.keys(value).length===0 ? ' (not intialized yet)' : ' changed vvv'}`, value) : null
  useEffect(() => {
    (dashboardSettings && Object.keys(dashboardSettings).length > 0) ? logChanges('dashboardSettings', dashboardSettings) : null
  }, [dashboardSettings])
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
    logDebug('Dashboard', `lastFullRefresh: ${lastFullRefresh.toString()} and and sections.length: ${sections.length}`)
    if (origSections.length <= 2) {
      const sectionCodes = allSectionDetails.slice(1).map(s => s.sectionCode)
      sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes, logMessage:'Assuming incremental refresh b/c sections.length <= 2' }, 'Dashboard loaded', true)
    }
  }, [])

  // Change the title when the section data changes
  // TODO(@dbw): this doesn't work and I'm not sure it ever can
  useEffect(() => {
    const windowTitle = `Dashboard - ${totalSectionItems} items`
    if (document.title !== windowTitle) {
      // logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
    }
  }, [pluginData.sections])

  // when dashboardSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  // if settingsMigrated is undefined, then we are doing a first-time migration from plugin settings to dashboardSettings
  useEffect(() => {
    const settingsNeedFirstTimeMigration = dashboardSettings?.settingsMigrated === undefined
    const lastChangeText = (dashboardSettings?.lastChange && typeof dashboardSettings.lastChange === 'string' && dashboardSettings.lastChange.length > 0) ?? ''
    const shouldSendToPlugin = !(lastChangeText && dashboardSettings.lastChange[0] === '_')
    !shouldSendToPlugin && logDebug('Dashboard', `Watcher for dashboardSettings changes. Shared settings updated in React, but not sending to plugin because lastChange="${dashboardSettings.lastChange}"`)
    if (settingsNeedFirstTimeMigration || shouldSendToPlugin) {
      settingsNeedFirstTimeMigration && logDebug('Dashboard(component)', `Settings need first time migration sending to plugin to be saved`, dashboardSettings)
      logDebug('Dashboard', `Watcher for dashboardSettings changes. Shared settings updated: "${dashboardSettings.lastChange}" sending to plugin to be saved`, dashboardSettings)
      const sharedSets = { ...dashboardSettings }
      if (settingsNeedFirstTimeMigration) { 
        sharedSets.settingsMigrated = true
        sharedSets.lastChange = 'Saving first time migration'
      }
      // FIXME: DELETEME after perspective testing
      /perspective/i.test(typeof lastChangeText === "string" ? lastChangeText : '') && logDebug('Dashboard', `Watcher for dashboardSettings. New perspective-related settings: activePerspectiveName:"${sharedSets.activePerspectiveName}"; excludedFolders:${sharedSets.excludedFolders}`, sharedSets)
      sendActionToPlugin('dashboardSettingsChanged', { actionType: 'dashboardSettingsChanged', settings: sharedSets, logMessage: sharedSets.lastChange || '' }, 'Dashboard dashboardSettings updated', true)
    } else if (dashboardSettings && Object.keys(dashboardSettings).length > 0) {
      // logDebug('Dashboard', `Watcher for dashboardSettings changes. Shared settings updated: ${JSON.stringify(dashboardSettings,null,2)}`,dashboardSettings)
    }
  }, [dashboardSettings])

  // When perspectiveSettings changes anywhere, send it to the plugin to save in settings
  useEffect(() => {
     if (perspectiveSettings && perspectiveSettings.length > 0) {
        if (JSON.stringify(perspectiveSettings) !== JSON.stringify(pluginData.perspectiveSettings)) {
          logDebug('Dashboard', `Watcher for perspectiveSettings changes. perspective settings updated`,perspectiveSettings)
          sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: perspectiveSettings, logMessage: `Perspectives array changed (${perspectiveSettings.length} items)` }, 'Dashboard perspectiveSettings updated', true)
        } else {
          logDebug('Dashboard',`Watcher for perspectiveSettings changes. Settings match. Maybe this was the initialization?`)
        }
      }
  }, [perspectiveSettings])

  // Update dialogData when pluginData changes, e.g. when the dialog is open for a task and you are changing things like priority
  useEffect(() => {
    if ((!reactSettings?.dialogData || !reactSettings.dialogData.isOpen) || !reactSettings.dialogData.isTask) return
    const { dialogData } = reactSettings
    const { details: dialogItemDetails } = dialogData
    if (!dialogData.isOpen || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    if (!(dialogData?.details?.item)) return
    if (dialogItemDetails?.item?.ID) {
      const { ID: openItemInDialogID } = dialogItemDetails.item
      // logDebug('Dashboard', `in useEffect on dialog details change, openItemInDialogID: ${openItemInDialogID}`)
      const sectionIndexes = findSectionItems(sections, ['ID'], { ID: openItemInDialogID })
      // logDebug('Dashboard', `JSON data changed; sectionIndexes: ${JSP(sectionIndexes, 2)}`)
      if (!sectionIndexes?.length) return
      const matchingIndex = sectionIndexes[0] // there can only be max one match b/c of the ID matching
      // clo(matchingIndex,`Dashboard: matchingIndex`)
      const { sectionIndex, itemIndex } = matchingIndex
      // clo(sections[sectionIndex].sectionItems, `Dashboard : sections[${sectionIndex}] length=${sections[sectionIndex].sectionItems.length}`)
      const newSectionItem = sections[sectionIndex].sectionItems[itemIndex]
      // clo(newSectionItem, `Dashboard: newSectionItem`)
      // clo(`Dashboard: in useEffect on dialog details change, previous dialogData=${JSP(reactSettings?.dialogData)}\n...incoming data=${JSP(newSectionItem, 2)}`)
      // used to do the JSON.stringify to compare, but now that an .updated field is used, they will be different
      if (newSectionItem && newSectionItem.updated && JSON.stringify(newSectionItem) !== JSON.stringify(dialogData?.details?.item)) {
        // logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem, 2)}\n...will update dialogData`)
        // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change`)
        newSectionItem.updated = false
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
        const updatedSections = copyUpdatedSectionItemData(sectionIndexes, ['updated'], { "updated": false }, sections)
        const newPluginData = { ...pluginData, sections: updatedSections }
        updatePluginData(newPluginData, `Dialog updated data then reset for ${newSectionItem.ID}`)
      } else {
        // logDebug('Dashboard', `Dialog details change, newSectionItem: ${newSectionItem.ID}: ${newSectionItem.para?.content ?? '<no para.content>'}`)
      }
    }
  }, [pluginData, setReactSettings, reactSettings?.dialogData])

  // 
  useEffect(() => {
    if (pluginData.startDelayedRefreshTimer) {
      logDebug('Dashboard', `plugin sent pluginData.startDelayedRefreshTimer=true, setting up delayed timer.`)
      updatePluginData({...pluginData, startRefreshTimer: false},'Got message from plugin; resetting refresh timer')
      !(reactSettings?.interactiveProcessing) && refreshTimer() // start the cache-busting timer if !interactiveProcessing 
    }
  }, [pluginData.startDelayedRefreshTimer])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleDialogClose = (xWasClicked: boolean = false) => {
    // logDebug('Dashboard', `handleDialogClose was called, xWasClicked=${String(xWasClicked)} interactiveProcessing=${JSP(reactSettings?.interactiveProcessing||{})}`)
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
    return <div className="dashboard">Error: No Sections to display ...</div>
  }
  const autoUpdateEnabled = parseInt(dashboardSettings?.autoUpdateAfterIdleTime || "0") > 0

  return (
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef} className={pluginData.platform??''}>
      {autoUpdateEnabled && (
        <IdleTimer
          idleTime={parseInt(dashboardSettings?.autoUpdateAfterIdleTime ? dashboardSettings.autoUpdateAfterIdleTime : "15") * 60 * 1000 /* 15 minutes default */}
          onIdleTimeout={autoRefresh}
        />
      )}
      {/* Note: this is where I might want to put further periodic data generation functions: completed task counter etc. */}
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
      <div id="tooltip-portal"></div>
    </div>
  )
}

export default Dashboard
