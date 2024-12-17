// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by WebView component.
// Last updated for v2.1.0.b
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useMemo } from 'react'
// import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
import {
  dontDedupeSectionCodes, sectionDisplayOrder, sectionPriority,
  // allSectionDetails
} from '../../constants.js'
import { getListOfEnabledSections, getDisplayListOfSectionCodes } from '../../dashboardHelpers'
import { findSectionItems, copyUpdatedSectionItemData } from '../../dataGeneration.js'
import type {
  TSectionCode,
  // TPerspectiveSettings
} from '../../types.js'
// import { cleanDashboardSettings } from '../../perspectiveHelpers.js'
import { dashboardSettingDefs, dashboardFilterDefs } from '../../dashboardSettings.js'
import type { TSettingItem } from '../../../../np.Shared/src/react/DynamicDialog/DynamicDialog.jsx'
import { useAppContext } from './AppContext.jsx'
import Dialog from './Dialog.jsx'
// import useWatchForResizes from '../customHooks/useWatchForResizes.jsx' // jgclark removed in plugin so commenting out here
import { getSectionsWithoutDuplicateLines, countTotalSectionItems, countTotalVisibleSectionItems, sortSections, showSectionSettingItems } from './Section/sectionHelpers.js'
import Header from './Header'
import IdleTimer from './IdleTimer.jsx'
import Section from './Section/Section.jsx'
import '../css/Dashboard.css'
import { getTestGroups } from './testing/tests'
import PerspectivesTable from './PerspectivesTable.jsx'
import DebugPanel from '@helpers/react/DebugPanel'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev.js'

export const standardSections: Array<TSettingItem> = showSectionSettingItems

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
declare var globalSharedData: {
  pluginData: {
    sections: Array<Object>,
  },
}

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
  const context = useAppContext()
  const contextRef = useRef(context)

  // Update ref when context changes (necessary for DebugPanel context variables)
  useEffect(() => {
    contextRef.current = context
  }, [context])

  // Define getContext function
  const getContext = () => contextRef.current

  const { reactSettings, setReactSettings, sendActionToPlugin, dashboardSettings, perspectiveSettings, updatePluginData } =
    context

  const { sections: origSections, lastFullRefresh } = pluginData
  const enabledSectionCodes: Array<TSectionCode> = getListOfEnabledSections(dashboardSettings)

  const logSettings = pluginData.logSettings

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  // useWatchForResizes(sendActionToPlugin) // jgclark removed in plugin so commenting out here
  // 5s hack timer to work around cache not being reliable (only runs for users, not DEVs)
  const shortDelayTimerIsOn = logSettings._logLevel !== 'DEV'
  const { refreshTimer } = useRefreshTimer({ maxDelay: 5000, enabled: shortDelayTimerIsOn })

  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const containerRef = useRef<?HTMLDivElement>(null)

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
  logDebug('Dashboard:origSections', `starting with ${origSections.length} sections (${getDisplayListOfSectionCodes(origSections)}) with ${String(totalSectionItems)} items`)
  // clof(sections, `Dashboard: origSections (length=${sections.length})`, ['sectionCode', 'name'], true)

  // Memoize deduplicated sections
  const deduplicatedSections = useMemo(() => {
    if (sections.length >= 1 && dashboardSettings.hideDuplicates) {
      // FIXME: this seems to be called for every section, even on refresh when only 1 section is requested
      // But TB and PROJ sections need to be ignored here, as they have different item types
      const dedupedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, dontDedupeSectionCodes, dashboardSettings)
      totalSectionItems = countTotalVisibleSectionItems(dedupedSections, dashboardSettings)

      // logDebug('Dashboard', `deduplicatedSections: ${dedupedSections.length} sections with ${String(totalSectionItems)} items`)
      // clof(sections, `Dashboard sections (length=${sections.length})`, ['sectionCode', 'name'], true)

      return dedupedSections
    }
    return sections
  }, [sections, dashboardSettings, origSections])

  // Use the memoized sections
  sections = deduplicatedSections

  sections = useMemo(() => sortSections(sections, sectionDisplayOrder), [sections, sectionDisplayOrder])
  logDebug('Dashboard:sortSections', `after sort: ${sections.length} (${getDisplayListOfSectionCodes(sections)}) with ${String(countTotalSectionItems(sections, dontDedupeSectionCodes))} items`)
  // clof(sections, `Dashboard: sortSections (length=${sections.length})`, ['sectionCode', 'name'], true)

  // DBW says the 98 was to avoid scrollbars.
  // TODO: JGC use KP's knowledge to have a more universal solution
  const dashboardContainerStyle = {
    maxWidth: '100vw', // '98vw',
    width: '100vw', // '98vw',
  }

  // For PerspectivesTable
  const settingDefs = useMemo(
    () => [
      { label: 'Sections', key: 'sections', type: 'heading' },
      ...standardSections,
      { label: 'Filters', key: 'filters', type: 'heading' },
      ...dashboardFilterDefs,
      ...dashboardSettingDefs,
    ],
    [],
  )

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

  // Log an error if dashboardSettings is undefined (should never happen)
  useEffect(() => {
    if (!dashboardSettings) {
      // Fallback or initialization logic for dashboardSettings
      logError('Dashboard', 'dashboardSettings is undefined')
    }
  }, [dashboardSettings])

  // Durinv DEV, temporary code to output variable changes to Chrome DevTools console
  const logChanges = (label: string, value: any) =>
    !window.webkit ? logDebug(`Dashboard`, `${label}${!value || Object.keys(value).length === 0 ? ' (not intialized yet)' : ' changed vvv'}`, value) : null
  useEffect(() => {
    dashboardSettings && Object.keys(dashboardSettings).length > 0 ? logChanges('dashboardSettings', dashboardSettings) : null
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
    logInfo(
      'Dashboard/useEffect [] (startup only)',
      `lastFullRefresh: ${lastFullRefresh.toString()} and sections.length: ${sections.length}: ${sections.map((s) => s.sectionCode).join(', ')}`,
    )

    // Note: changed from "<= 2" to "=== 1"
    // TODO: DBW had an idea about a cleaner way to trigger this
    if (origSections.length === 1) {
      // Send all enabledSection codes other than the first one already shown
      const sectionCodesToAdd = enabledSectionCodes.filter((sc) => sc !== origSections[0].sectionCode)
      logInfo('Dashboard/useEffect [] (startup only)', `- initial section is ${origSections[0].sectionCode}. sectionCodesToAdd => ${String(sectionCodesToAdd)}`)
      sendActionToPlugin(
        'incrementallyRefreshSomeSections',
        {
          actionType: 'incrementallyRefreshSomeSections',
          sectionCodes: sectionCodesToAdd,
          logMessage: `Kicking off incremental "refresh" of remaining section ${String(sectionCodesToAdd)} b/c sections.length === 1`,
        },
        'Dashboard loaded',
        true,
      )
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

  // Update dialogData when pluginData changes, e.g. when the dialog is open for a task and you are changing things like priority
  useEffect(() => {
    if (!reactSettings?.dialogData || !reactSettings.dialogData.isOpen || !reactSettings.dialogData.isTask) return
    const { dialogData } = reactSettings
    const { details: dialogItemDetails } = dialogData
    if (!dialogData.isOpen || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    if (!dialogData?.details?.item) return
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
        setReactSettings((prev) => {
          const newData = {
            ...prev,
            dialogData: {
              ...prev.dialogData,
              details: {
                ...prev.dialogData.details, // to save the clickPosition
                item: newSectionItem,
              },
            },
            lastChange: '_Dialog was open, and data changed underneath',
          }
          // logDebug('Dashboard', `in useEffect on ${newSectionItem.ID} dialog details change, setting reactSettings to: ${JSP(newData, 2)}`)
          return newData
        })
        const updatedSections = copyUpdatedSectionItemData(sectionIndexes, ['updated'], { updated: false }, sections)
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
      !reactSettings?.interactiveProcessing && refreshTimer() // start the cache-busting timer if !interactiveProcessing
    }
  }, [pluginData.startDelayedRefreshTimer])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleDialogClose = (xWasClicked: boolean = false) => {}

  // Deal with the delayed refresh when a button was clicked
  // Because sections and buttons could be destroyed after a click, we need to refresh from here
  const handleCommandButtonClick = (/*  button: TActionButton */) => {
    // logDebug('Dashboard', `handleCommandButtonClick was called for button: ${button.display}; setting up delayed timer.`)
    // refreshTimer() // for now refresh after every button click, but could be more selective
    // TODO: keep an eye out for times that it could be helpful
  }

  const autoRefresh = () => {
    logDebug('Dashboard', `${new Date().toString()} Auto-Refresh time!`)
    const actionType = 'refreshEnabledSections'
    sendActionToPlugin(actionType, { actionType }, 'Auto-Refresh time!', true)
  }

  const hidePerspectivesTable = () => {
    setReactSettings((prevReactSettings) => ({ ...prevReactSettings, perspectivesTableVisible: false }))
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (sections.length === 0) {
    return <div className="dashboard">Error: No Sections to display ...</div>
  }
  const autoUpdateEnabled = parseInt(dashboardSettings?.autoUpdateAfterIdleTime || '0') > 0

  const showDebugPanel = (pluginData?.logSettings?._logLevel === 'DEV' && dashboardSettings?.FFlag_DebugPanel) || false
  const testGroups = useMemo(() => getTestGroups(getContext), [getContext])

  return (
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef} className={pluginData.platform ?? ''}>
      {autoUpdateEnabled && (
        <IdleTimer idleTime={parseInt(dashboardSettings?.autoUpdateAfterIdleTime ? dashboardSettings.autoUpdateAfterIdleTime : '15') * 60 * 1000} onIdleTimeout={autoRefresh} />
      )}
      {/* Note: this is where I might want to put further periodic data generation functions: completed task counter etc. */}
      {reactSettings?.perspectivesTableVisible && (
        <PerspectivesTable perspectives={perspectiveSettings} settingDefs={settingDefs} onSave={hidePerspectivesTable} onCancel={hidePerspectivesTable} />
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
      {pluginData?.logSettings?._logLevel === 'DEV' && (
        <DebugPanel isVisible={showDebugPanel} getContext={getContext} testGroups={testGroups} defaultExpandedKeys={['Context Variables', 'perspectiveSettings']} />
      )}
      <div id="tooltip-portal"></div>
    </div>
  )
}

export default Dashboard
