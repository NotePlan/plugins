// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by WebView component.
// Last updated 2024-10-11 for v2.1.0.a13 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import { findSectionItems, copyUpdatedSectionItemData } from '../../dataGeneration.js'
import { allSectionDetails, sectionDisplayOrder, sectionPriority } from "../../constants.js"
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
import { cleanDashboardSettings } from '../../perspectiveHelpers.js'
import { getSectionsWithoutDuplicateLines, countTotalSectionItems, countTotalVisibleSectionItems, sortSections } from './Section/sectionHelpers.js'
// import type { TDashboardSettings } from '../../types.js'
import Header from './Header'
import Section from './Section/Section.jsx'
import Dialog from './Dialog.jsx'
import IdleTimer from './IdleTimer.jsx'
import { useAppContext } from './AppContext.jsx'
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
  const { reactSettings, setReactSettings, sendActionToPlugin, dashboardSettings, perspectiveSettings, setPerspectiveSettings, dispatchDashboardSettings, updatePluginData } = useAppContext()
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

  //
  // Functions
  //
  /**
   * If a perspective is not set, then save current settings to the default "-" perspective because we always
   * want to have the last settings a user chose to be saved in the default perspective (unless they are in a perspective)
   * @param {any} perspectiveSettings 
   * @param {any} newDashboardSettings 
   * @param {Function} setPerspectiveSettings 
   */
  function saveDefaultPerspectiveData(perspectiveSettings: any, newDashboardSettings: any, setPerspectiveSettings: Function) {
    const dashPerspectiveIndex = perspectiveSettings.findIndex(s => s.name === "-")
    if (dashPerspectiveIndex > -1) {
      perspectiveSettings[dashPerspectiveIndex] = { name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(newDashboardSettings) }
    } else {
      logDebug('Dashboard/useEffect(dashboardSettings)', `- Shared settings updated: "${newDashboardSettings.lastChange}" but could not find dashPerspectiveIndex; adding it to the end`, dashboardSettings)
      perspectiveSettings.push({ name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(newDashboardSettings) })
    }
    setPerspectiveSettings(perspectiveSettings)
  }

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------

  let sections = [...origSections]
  let totalSectionItems = countTotalSectionItems(origSections)
  logDebug('Dashboard', `origSections: currently ${origSections.length} sections with ${String(totalSectionItems)} items`)

  if (sections.length >= 1 && dashboardSettings.hideDuplicates) {
    // FIXME: this seems to be called for every section, even on refresh when only 1 section is requested
    const deduplicatedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, dashboardSettings)
    totalSectionItems = countTotalVisibleSectionItems(deduplicatedSections, dashboardSettings)

    logDebug('Dashboard', `deduplicatedSections: ${deduplicatedSections.length} sections with ${String(totalSectionItems)} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)

    sections = deduplicatedSections
    logDebug('Dashboard', `- after hide duplicates: ${sections.length} sections with ${String(countTotalSectionItems(sections))} items`)
    // clof(sections, `Dashboard sections (length=${sections.length})`,['sectionCode','name'],true)
  }

  sections = sortSections(sections, sectionDisplayOrder)
  logDebug('Dashboard', `- sections after sort length: ${sections.length} with ${String(countTotalSectionItems(sections))} items`)
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
    logDebug('WebView', `Detected change in pluginData.dashboardSettings.activePerspectiveName="${pluginData.dashboardSettings.activePerspectiveName}" - lastChange="${pluginData.dashboardSettings.lastChange}"`)
    pluginData.dashboardSettings?.perspectiveSettings ? logDebug(`WebView`, `dashboardSettings had a perspectiveSettings key. this probably should not be the case!!!`) : null
    if (dashboardSettings.lastChange !== "_WebView_DashboardDefaultSettings" && JSON.stringify(pluginData.dashboardSettings) !== JSON.stringify(dashboardSettings)) {

      logDebug(`WebView`, `Looks like dashboardSettings are different. calling dispatchDashboardSettings()`)
      dispatchDashboardSettings({ type: 'SET_DASHBOARD_SETTINGS', payload: pluginData.dashboardSettings, reason: `DashboardSettings changed in WebView` })
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
  useEffect(() => {
    // if we did a force reload (DEV only) of the full sections data, no need to load the rest
    // but if we are doing a normal load, then get the rest of the section data incrementally
    // this executes before globalSharedData is saved into state 
    logDebug('Dashboard/useEffect()', `lastFullRefresh: ${lastFullRefresh.toString()} and and sections.length: ${sections.length}`)
    if (origSections.length <= 2) {
      const sectionCodes = allSectionDetails.slice(1).map(s => s.sectionCode)
      sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes, logMessage: 'Assuming incremental refresh b/c sections.length <= 2' }, 'Dashboard loaded', true)
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

  // when dashboardSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  // if settingsMigrated is undefined, then we are doing a first-time migration from plugin settings to dashboardSettings
  useEffect(() => {
    const lastChangeText = (dashboardSettings?.lastChange && typeof dashboardSettings.lastChange === 'string' && dashboardSettings.lastChange.length > 0) ?? ''
    logDebug('Dashboard/useEffect(dashboardSettings)', `dashboardSettings changed - lastChangeText="${String(lastChangeText) || ''}" activePerspective=${dashboardSettings.activePerspectiveName}`)
    const shouldSendToPlugin = !(lastChangeText && dashboardSettings.lastChange[0] === '_')
    if (shouldSendToPlugin) {
      logDebug('Dashboard/useEffect(dashboardSettings)', `- Shared settings updated: "${dashboardSettings.lastChange}" sending to plugin to be saved`, dashboardSettings)
      const dashboardSettingsCopy = { lastChange: "", activePerspectiveName: "-", ...dashboardSettings }
      // TODO: DELETE this log line after perspective testing is completed
      logDebug('Dashboard/useEffect(dashboardSettings)', `- New perspective-related settings: activePerspectiveName:"${dashboardSettingsCopy.activePerspectiveName}"; excludedFolders:${dashboardSettingsCopy.excludedFolders}`, dashboardSettingsCopy)

      // sendActionToPlugin('dashboardSettingsChanged', { actionType: 'dashboardSettingsChanged', settings: dashboardSettingsCopy, logMessage: dashboardSettingsCopy.lastChange || '' }, 'Dashboard dashboardSettings updated', true)

      // If a perspective is not set (or it is set to "-"), we need to keep the "-" perspective updated with the current settings so that you can return to your last state
      // after switching to a perspective and back to "-". So every time dashboardSettings changes and no perspective is set, we are quietly saving the update
      if (dashboardSettingsCopy.activePerspectiveName === "-" || !(dashboardSettingsCopy.activePerspectiveName)) {
        // If the activePerspectiveName is "-" (meaning default is set) then we need to constantly update that perspective
        // when any settings are changed
        // Note: default perspective is never shown with a "*" on the end.        
        saveDefaultPerspectiveData(perspectiveSettings, dashboardSettingsCopy, setPerspectiveSettings)
      } else {
        // FIXME: dbw: I'm not sure what this following code is or what it does or did, but let's keep an eye on it
        const dashPerspectiveIndex = perspectiveSettings.findIndex(s => s.name === dashboardSettingsCopy.activePerspectiveName) ?? 0
        logDebug('Dashboard/useEffect(dashboardSettings)', `Currenlty doing anything, but log previously said: - Will now need to update perspective "${dashboardSettingsCopy.activePerspectiveName}" to isModified; dashPerspectiveIndex=${dashPerspectiveIndex}`)
        // perspectiveSettings[dashPerspectiveIndex] = { name: "-", isModified: false, dashboardSettings: cleanDashboardSettings(dashboardSettingsCopy) }
      }
    } else if (dashboardSettings && Object.keys(dashboardSettings).length > 0) {
      !shouldSendToPlugin && logDebug('Dashboard/useEffect(dashboardSettings)', `- Shared settings updated in React, but not sending to plugin because lastChange="${dashboardSettings.lastChange}"`)
    }
  }, [dashboardSettings])

  // create a new effect that sets perspectiveSettings in the plugin when pluginData.perspectiveSettings changes
  useEffect(() => {
    if (pluginData.perspectiveSettings && pluginData.perspectiveSettings.length > 0) {
      logDebug('Dashboard/useEffect(pluginData.perspectiveSettings)', `- pluginData.perspectiveSettings changed; activePerspectiveName="${pluginData.dashboardSettings.activePerspectiveName}" dashboardSettings.lastChange="${pluginData.dashboardSettings.lastChange}"`)
      const lastPerspectiveName = pluginData.perspectiveSettings[pluginData.perspectiveSettings.length - 1].name
      logDebug('Dashboard/useEffect(pluginData.perspectiveSettings)', `- lastPerspectiveName in perspectives array: ${lastPerspectiveName}`)
      setPerspectiveSettings(pluginData.perspectiveSettings)
    }
  }, [pluginData.perspectiveSettings])

  // When perspectiveSettings changes anywhere, send it to the plugin to save in settings
  useEffect(() => {
    if (perspectiveSettings && perspectiveSettings.length > 0) {
      if (JSON.stringify(perspectiveSettings) !== JSON.stringify(pluginData.perspectiveSettings)) {
        logDebug('Dashboard', `Watcher for perspectiveSettings changes. perspective settings updated: ${JSON.stringify(compareObjects(pluginData.perspectiveSettings,perspectiveSettings))}\n\tNOTE: Not currently sending this back to plugin because was circular. Need to find a better way.`, perspectiveSettings)
        // sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: perspectiveSettings, logMessage: `Perspectives array changed (${perspectiveSettings.length} items)` }, 'Dashboard perspectiveSettings updated', true)
      } else {
        logDebug('Dashboard', `Watcher for perspectiveSettings changes. Settings match. Probably just newest perspective data sent from plugin. No need to send back again.`)
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

