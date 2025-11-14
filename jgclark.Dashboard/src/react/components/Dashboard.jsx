// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by WebView component.
// Last updated for v2.2.0.a12
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import useRefreshTimer from '../customHooks/useRefreshTimer.jsx'
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import { dontDedupeSectionCodes, defaultSectionDisplayOrder, sectionPriority } from '../../constants.js'
import { copyUpdatedSectionItemData } from '../../dataGeneration.js'
import { findSectionItems } from '../../dashboardHelpers.js'
import { dashboardSettingDefs, dashboardFilterDefs } from '../../dashboardSettings.js'
import type { TSection, TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import Dialog from './Dialog.jsx'
import { getSectionsWithoutDuplicateLines, countTotalVisibleSectionItems, sortSections, showSectionSettingItems } from './Section/sectionHelpers.js'
import { calculateMaxPriorityAcrossAllSections } from './Section/useSectionSortAndFilter.jsx'
import Header from './Header'
import IdleTimer from './IdleTimer.jsx'
import Section from './Section/Section.jsx'
import '../css/Dashboard.css'
import { getTestGroups } from './testing/tests'
import PerspectivesTable from './PerspectivesTable.jsx'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import DebugPanel from '@helpers/react/DebugPanel'
import { clo, clof, JSP, logDebug, logError, logInfo } from '@helpers/react/reactDev.js'
// import ModalSpinner from '@helpers/react/ModalSpinner'
import NonModalSpinner from '@helpers/react/NonModalSpinner'

export const standardSections: Array<TSettingItem> = showSectionSettingItems

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
declare var globalSharedData: {
  pluginData: {
    sections: Array<Object>,
  },
}

declare function runPluginCommand(command: string, id: string, args: Array<any>): void

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

  const { reactSettings, setReactSettings, sendActionToPlugin, dashboardSettings, perspectiveSettings, updatePluginData } = context

  const { sections: origSections, lastFullRefresh } = pluginData
  // const enabledSectionCodes: Array<TSectionCode> = getListOfEnabledSections(dashboardSettings)

  const logSettings = pluginData.logSettings

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  // Resizing window is only possible on macOS.
  if (pluginData.platform === 'macOS') {
    useWatchForResizes(sendActionToPlugin)
  }
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

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------

  const { sections, totalSectionItems } = useMemo(() => {
    let workingSections = origSections
    if (workingSections.length >= 1 && dashboardSettings?.hideDuplicates) {
      // FIXME: this seems to be called for every section, even on refresh when only 1 section is requested
      // TB and PROJ sections need to be ignored here, as they have different item types
      const dedupedSections = getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, dontDedupeSectionCodes, dashboardSettings)
      workingSections = dedupedSections
    }

    const sortedSections = sortSections(workingSections.slice(), sectionDisplayOrder)
    const totalVisibleAfterSort = countTotalVisibleSectionItems(sortedSections, dashboardSettings)

    // Use memoization to provide a sorted sections array based on section display order.
    // Takes custom section order from dashboardSettings if set; otherwise falls back to default.
    sections = useMemo(
      () => sortSections(sections, defaultSectionDisplayOrder, dashboardSettings?.customSectionDisplayOrder),
      [sections, defaultSectionDisplayOrder, dashboardSettings?.customSectionDisplayOrder]
    )
    // logDebug('Dashboard:sortSections', `after sort: ${sections.length} (${getDisplayListOfSectionCodes(sections)}) with ${String(countTotalSectionItems(sections, dontDedupeSectionCodes))} items`)

    return {
      sections: sortedSections,
      totalSectionItems: totalVisibleAfterSort,
    }
  }, [origSections, dashboardSettings, sectionDisplayOrder])

  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
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

  // During DEV, temporary code to output variable changes to Chrome DevTools console
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

  // At Startup, request the Dashboard Sections content by telling the plugin that Dashboard is loaded
  // Sections starts out as empty array, so this is the first time it will be populated
  useEffect(() => {
    // Note: This executes before globalSharedData is saved into state
    logInfo('Dashboard/useEffect [] (startup only)', `${sections.length} sections (${origSections.length} origSections): [${sections.map((s) => s.sectionCode).join(', ')}]`)
    logDebug('Dashboard', `React: sending reactWindowInitialisedSoStartGeneratingData command to plugin`)
    runPluginCommand('reactWindowInitialisedSoStartGeneratingData', 'jgclark.Dashboard', [''])
  }, [])

  // Change the title when the section data changes
  useEffect(() => {
    const windowTitle = `Dashboard - ${totalSectionItems} items`
    if (document.title !== windowTitle) {
      // logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
    }
  }, [pluginData.sections, totalSectionItems])

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

  // Recalculate maximum priority when sections change (e.g., when items are removed)
  // NOTE: This can conflict with section-level updates during initial render, so we use a ref
  // to track if sections have actually changed (not just pluginData.currentMaxPriorityFromAllVisibleSections)
  const prevSectionsRef = useRef<Array<TSection>>([])
  useEffect(() => {
    // Only recalculate if sections array reference actually changed (items removed/added).
    // Don't recalculate if only currentMaxPriorityFromAllVisibleSections changed (that's handled by sections).
    const sectionsChanged = prevSectionsRef.current !== sections
    if (sectionsChanged) {
      const newMaxPriority = calculateMaxPriorityAcrossAllSections(sections)
      if (newMaxPriority !== pluginData.currentMaxPriorityFromAllVisibleSections) {
        logDebug('Dashboard', `New max priority after sections changed: ${newMaxPriority}`)
        updatePluginData({ ...pluginData, currentMaxPriorityFromAllVisibleSections: newMaxPriority }, `Recalculated max priority after sections changed: ${newMaxPriority}`)
      }
      prevSectionsRef.current = sections
    }
  }, [sections, pluginData.currentMaxPriorityFromAllVisibleSections])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleDialogClose = (xWasClicked: boolean = false) => {
    logDebug('Dashboard', `handleDialogClose() called with xWasClicked=${String(xWasClicked)}`)
    setReactSettings((prevSettings) => ({
      ...prevSettings,
      dialogData: { isOpen: false, isTask: true },
    }))
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

  const autoUpdateEnabled = parseInt(dashboardSettings?.autoUpdateAfterIdleTime || '0') > 0

  const showDebugPanel = (pluginData?.logSettings?._logLevel === 'DEV' && dashboardSettings?.FFlag_DebugPanel) || false
  const testGroups = useMemo(() => getTestGroups(getContext), [getContext])

  /**
   * Maintain a stable button handler reference for each section to avoid unnecessary re-renders.
   *
   * @param {TActionButton} _button - Section action button definition.
   * @returns {void}
   */
  const handleSectionButtonClick = useCallback((_button: TActionButton): void => {}, [])

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
        <main>
          {sections.map((section, index) => (
            <Section key={`${section.sectionCode}-${index}`} section={section} onButtonClick={handleSectionButtonClick} />
          ))}
        </main>
        <Dialog
          onClose={handleDialogClose}
          isOpen={reactSettings?.dialogData?.isOpen ?? false}
          isTask={reactSettings?.dialogData?.isTask ?? false}
          details={reactSettings?.dialogData?.details ?? {}}
        />
      </div>
      {pluginData.perspectiveChanging && (
        <NonModalSpinner textBelow="Switching perspectives" style={{ container: { color: 'var(--tint-color)', textAlign: 'center', marginTop: '0.6rem', marginBottom: '0rem' } }} />
      )}
      {pluginData?.logSettings?._logLevel === 'DEV' && (
        <DebugPanel isVisible={showDebugPanel} getContext={getContext} testGroups={testGroups} defaultExpandedKeys={['Context Variables', 'perspectiveSettings']} />
      )}
      <div id="tooltip-portal"></div>
    </div>
  )
}

export default Dashboard
