// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by WebView component.
// Last updated for v2.1.0.a
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import { dontDedupeSectionCodes, sectionDisplayOrder, sectionPriority } from "../../constants.js"
import { getListOfEnabledSections } from '../../dashboardHelpers'
import { findSectionItems, copyUpdatedSectionItemData } from '../../dataGeneration.js'
import type { TSectionCode } from '../../types.js'
// import { cleanDashboardSettings } from '../../perspectiveHelpers.js'
import { useAppContext } from './AppContext.jsx'
import Dialog from './Dialog.jsx'
import Header from './Header'
import IdleTimer from './IdleTimer.jsx'
import Section from './Section/Section.jsx'
import { getSectionsWithoutDuplicateLines, countTotalSectionItems, countTotalVisibleSectionItems, sortSections } from './Section/sectionHelpers.js'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev.js'
import {compareObjects}  from '@helpers/dev'
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
  pluginData: Object, // the data that was sent from the plugin in the field "pluginData"
}

//--------------------------------------------------------------------------
// Dashboard Component Definition
//--------------------------------------------------------------------------
const Dashboard = ({ pluginData }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const {
    reactSettings, setReactSettings, sendActionToPlugin, dashboardSettings, perspectiveSettings, dispatchPerspectiveSettings, dispatchDashboardSettings, updatePluginData
  } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData

  const enabledSectionCodes: Array<TSectionCode> = getListOfEnabledSections(dashboardSettings)

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

  //
  // Functions
  //

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------

  let sections = [...origSections]
  let totalSectionItems = countTotalSectionItems(origSections, dontDedupeSectionCodes)
  logDebug('Dashboard', `origSections: currently ${origSections.length} sections with ${String(totalSectionItems)} items`)

  if (sections.length >= 1 && dashboardSettings.hideDuplicates) {
    // FIXME: this seems to be called for every section, even on refresh when only 1 section is requested
    // But TB and PROJ sections need to be ignored here, as they have different item types
    const deduplicatedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, dontDedupeSectionCodes, dashboardSettings)
    totalSectionItems = countTotalVisibleSectionItems(deduplicatedSections, dashboardSettings)

    // logDebug('Dashboard', `deduplicatedSections: ${deduplicatedSections.length} sections with ${String(totalSectionItems)} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`, ['sectionCode', 'name'], true)

    sections = deduplicatedSections
    // logDebug('Dashboard', `- after hide duplicates: ${sections.length} sections with ${String(countTotalSectionItems(sections, dontDedupeSectionCodes))} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`, ['sectionCode', 'name'], true)
  }

  sections = sortSections(sections, sectionDisplayOrder)
  // logDebug('Dashboard', `- sections after sort length: ${sections.length} with ${String(countTotalSectionItems(sections, dontDedupeSectionCodes))} items`)
  // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

  // DBW says the 98 was to avoid scrollbars.
  // TODO: JGC use KP's knowledge to have a more universal solution
  const dashboardContainerStyle = {
    maxWidth: '100vw', // '98vw',
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

  // Effect to update dashboardSettings when pluginData.dashboardSettings changes (e.g. the plugin rewrote it)
  useEffect(() => {
    // logDebug('WebView', `Detected change in pluginData.dashboardSettings.activePerspectiveName="${pluginData.dashboardSettings.activePerspectiveName}" - lastChange="${pluginData.dashboardSettings.lastChange}"`)
    pluginData.dashboardSettings?.perspectiveSettings ? logDebug(`WebView`, `dashboardSettings had a perspectiveSettings key. this probably should not be the case!!!`) : null
    if (dashboardSettings.lastChange !== "_WebView_DashboardDefaultSettings" && JSON.stringify(pluginData.dashboardSettings) !== JSON.stringify(dashboardSettings)) {
      let diff = compareObjects(pluginData.dashboardSettings,dashboardSettings)
      diff && clo(diff,`Dashboard pluginData.dashboardSettings watcher diff`)
      if (diff && Object.keys(diff).length === 1 && diff.hasOwnProperty("lastChange")) {
        diff = null
        logDebug(`Dashboard`, `useEffect(pluginData.dashboardSettings) - Only lastChange field was different. (old="${dashboardSettings.lastChange}" new="${pluginData.dashboardSettings.lastChange}") Ignoring.`)
      }
      if (diff) {
        logDebug(`WebView`, `Looks like dashboardSettings are different. calling dispatchDashboardSettings()`)
        dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: pluginData.dashboardSettings })
      }
    }
  }, [pluginData.dashboardSettings])

  // temporary code to output variable changes to Chrome DevTools console
  const logChanges = (label: string, value: any) => (!window.webkit) ? logDebug(`Dashboard`, `${label}${!value || Object.keys(value).length === 0 ? ' (not intialized yet)' : ' changed vvv'}`, value) : null
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
  // DBW: "Just runs once when it loads"
  useEffect(() => {
    // If we did a force reload (DEV only) of the full sections data, no need to load the rest.
    // But if we are doing a normal load, then get the rest of the section data incrementally.
    // This executes before globalSharedData is saved into state 
    logInfo('Dashboard/useEffect [] (startup only)', `lastFullRefresh: ${lastFullRefresh.toString()} and sections.length: ${sections.length}`)

    // Note: changed from "<= 2" to "=== 1"
    // TODO: DBW had an idea about a cleaner way to trigger this
    if (origSections.length === 1) {
      // Send all enabledSection codes other than the first one already shown
      const sectionCodesToAdd = enabledSectionCodes.filter(sc => sc !== origSections[0].sectionCode)
      logInfo('Dashboard/useEffect [] (startup only)', `- initial section is ${origSections[0].sectionCode}. sectionCodesToAdd => ${String(sectionCodesToAdd)}`)
      sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes: sectionCodesToAdd, logMessage: `Kicking off incremental "refresh" of remaining section ${String(sectionCodesToAdd)} b/c sections.length === 1` }, 'Dashboard loaded', true)
    }
  }, [])

  // Change the title when the section data changes
  useEffect(() => {
    const windowTitle = `Dashboard - ${totalSectionItems} items`
    if (document.title !== windowTitle) {
      // logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
    }
  }, [pluginData.sections])

  // create a new effect that sets perspectiveSettings when pluginData.perspectiveSettings changes in the plugin
  useEffect(() => {
    if (pluginData.perspectiveSettings && pluginData.perspectiveSettings.length > 0) {
      // logDebug('Dashboard/useEffect(pluginData.perspectiveSettings)', `changed: activePerspectiveName="${pluginData.dashboardSettings.activePerspectiveName}" dashboardSettings.lastChange="${pluginData.dashboardSettings.lastChange}"`)
      const diff = compareObjects(pluginData.perspectiveSettings, perspectiveSettings)
      if (diff) {
        logDebug('Dashboard/useEffect(pluginData.perspectiveSettings)', `- Perspectives array changed: ${JSON.stringify(diff)}`)
        dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: pluginData.perspectiveSettings, reason: `Perspectives changed by plugin (${JSON.stringify(diff)})` })
      } else {
        // logDebug('Dashboard/useEffect(pluginData.perspectiveSettings)', `- Perspectives array unchanged`)
      }
    }
  }, [pluginData.perspectiveSettings])

  // When perspectiveSettings changes anywhere, send it to the plugin to save in settings
  useEffect(() => {
    if (perspectiveSettings && perspectiveSettings.length > 0) {
      const diff = compareObjects(pluginData.perspectiveSettings, perspectiveSettings)
      if (diff) {
        logDebug('Dashboard/useEffect(perspectiveSettings)', `Watcher for perspectiveSettings changes. perspective settings updated: ${JSON.stringify(compareObjects(pluginData.perspectiveSettings,perspectiveSettings))}\n\tNOTE: Not currently sending this back to plugin because was circular. Need to find a better way.`, perspectiveSettings)
        // sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: perspectiveSettings, logMessage: `Perspectives array changed (${perspectiveSettings.length} items)` }, 'Dashboard perspectiveSettings updated', true)
      } else {
        logDebug('Dashboard/useEffect(perspectiveSettings)', `Watcher for perspectiveSettings changes. Settings match. Probably just newest perspective data sent from plugin. No need to send back again.`)
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
        // TRYING TO FIGURE OUT WHERE hasChild IS BEING SET TO TRUE WHEN IT SHOULDN'T BE I think it's probably the cache update bug
        newSectionItem?.para?.hasChild ? logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem, 2)}\n...will update dialogData`) : null
        // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change`)
        newSectionItem.updated = false
        setReactSettings(prev => {
          const newData = {
            ...prev,
            dialogData: {
              ...prev.dialogData,
              details: {
                ...prev.dialogData.details, // to save the clickPosition
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

  // Catch startDelayedRefreshTimer from plugin
  useEffect(() => {
    if (pluginData.startDelayedRefreshTimer) {
      logDebug('Dashboard', `plugin sent pluginData.startDelayedRefreshTimer=true, setting up delayed timer.`)
      updatePluginData({ ...pluginData, startRefreshTimer: false }, 'Got message from plugin; resetting refresh timer')
      !(reactSettings?.interactiveProcessing) && refreshTimer() // start the cache-busting timer if !interactiveProcessing 
    }
  }, [pluginData.startDelayedRefreshTimer])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleDialogClose = (xWasClicked: boolean = false) => {
    logDebug('Dashboard', `Dashboard::handleDialogClose was called, xWasClicked=${String(xWasClicked)} interactiveProcessing=${JSP(reactSettings?.interactiveProcessing || {})}`)
    // xWasClicked ? null : refreshTimer() // TODO: for now refresh after every dialog close, but could be more selective later NOTE: dbw commented this out on 2024-10-08 after changing how interactiveProcessing works
  }

  // Deal with the delayed refresh when a button was clicked
  // Because sections and buttons could be destroyed after a click, we need to refresh from here
  const handleCommandButtonClick = (/*  button: TActionButton */) => {
    // logDebug('Dashboard', `handleCommandButtonClick was called for button: ${button.display}; setting up delayed timer.`)
    // refreshTimer() // TODO: for now refresh after every button click, but should be more selective // TODO(dbw): review this
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
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef} className={pluginData.platform ?? ''}>
      {autoUpdateEnabled && (
        <IdleTimer
          idleTime={parseInt(dashboardSettings?.autoUpdateAfterIdleTime ? dashboardSettings.autoUpdateAfterIdleTime : "15") * 60 * 1000}
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

