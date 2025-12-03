// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated 2025-11-22 for v2.3.0.b15
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { allCalendarSectionCodes, interactiveProcessingPossibleSectionTypes, treatSingleItemTypesAsZeroItems } from '../../../constants.js'
import type { TSection, TSectionItem, TActionButton } from '../../../types.js'
import CommandButton from '../CommandButton.jsx'
import ItemGrid from '../ItemGrid.jsx'
import TooltipOnKeyPress from '../ToolTipOnModifierPress.jsx'
import { useAppContext } from '../AppContext.jsx'
import CircularProgressBar from '../CircularProgressBar.jsx'
import useSectionSortAndFilter from './useSectionSortAndFilter.jsx'
import { logDebug, logError, logInfo, JSP, clo } from '@helpers/react/reactDev'
import { getDiff } from '@helpers/dev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import './Section.css'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type SectionProps = {
  section: TSection,
  onButtonClick: (button: TActionButton) => void,
}

//--------------------------------------------------------------------------
// Section Component Definition
//--------------------------------------------------------------------------
const Section = ({ section, onButtonClick }: SectionProps): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, reactSettings, setReactSettings, pluginData, sendActionToPlugin, updatePluginData } = useAppContext()

  // TEST: Track what's changing to debug re-renders
  // const prevPluginDataRef = useRef(pluginData)
  const prevDashboardSettingsRef = useRef(dashboardSettings)
  const prevReactSettingsRef = useRef(reactSettings)
  const prevSectionRef = useRef(section)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  /**
   * Log a diff between previous and current values for easier debugging of re-renders.
   *
   * @param {string} label - Identifier for the value being compared.
   * @param {any} previousValue - The previous render value.
   * @param {any} currentValue - The current render value.
   * @returns {void}
   */
  const logDiffForLabel = useCallback(
    (label: string, previousValue: any, currentValue: any): void => {
      if (previousValue === currentValue || previousValue == null || currentValue == null) {
        return
      }
      const diff: any = getDiff(previousValue, currentValue)
      if (diff != null) {
        clo(diff, `Section ${section.sectionCode} ${section.name} diff for ${label}`, 2)
      }
    },
    [section.sectionCode, section.name],
  )

  // Note: Turn this back on to show the pluginData changes that trigger re-renders.
  // useEffect(() => {
  //   if (prevPluginDataRef.current !== pluginData) {
  //     const changedKeys = Object.keys(pluginData).filter((key) => {
  //       const prevVal = prevPluginDataRef.current[key]
  //       const currVal = pluginData[key]
  //       // Deep comparison for arrays/objects
  //       if (Array.isArray(prevVal) && Array.isArray(currVal)) {
  //         return prevVal.length !== currVal.length || prevVal.some((item, i) => item !== currVal[i])
  //       }
  //       return prevVal !== currVal
  //     })
  //     if (changedKeys.length > 0) {
  //       logDebug('Section', `- ${section.sectionCode} render #${renderCountRef.current}: pluginData changed keys: ${changedKeys.join(', ')}`)
  //       logDiffForLabel('pluginData', prevPluginDataRef.current, pluginData)
  //     }
  //     prevPluginDataRef.current = pluginData
  //   } else {
  //     logDebug('Section', `- ${section.sectionCode} render #${renderCountRef.current}: NO pluginData change: likely prop/context function reference change`)
  //   }
  // })

  useEffect(() => {
    if (prevDashboardSettingsRef.current !== dashboardSettings) {
      logDiffForLabel('dashboardSettings', prevDashboardSettingsRef.current, dashboardSettings)
      prevDashboardSettingsRef.current = dashboardSettings
    }
  }, [dashboardSettings, logDiffForLabel])

  useEffect(() => {
    if (prevReactSettingsRef.current !== reactSettings) {
      logDiffForLabel('reactSettings', prevReactSettingsRef.current, reactSettings)
      prevReactSettingsRef.current = reactSettings
    }
  }, [reactSettings, logDiffForLabel])

  useEffect(() => {
    if (prevSectionRef.current !== section) {
      logDiffForLabel('section prop', prevSectionRef.current, section)
      prevSectionRef.current = section
    }
  }, [section, logDiffForLabel])

  // logDebug('Section', `🔸 Section: ${section.sectionCode} (${String(section.sectionItems?.length ?? 0)} items in '${section.name}')`)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [items, setItems] = useState<Array<TSectionItem>>([])

  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  // Track the last max priority value we updated to prevent duplicate updates
  const lastMaxPriorityUpdateRef = useRef<number>(-1)

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const { sectionFilename, totalCount } = section
  const isReferencedSection = section.isReferenced ?? false

  // Extract only currentMaxPriorityFromAllVisibleSections from pluginData using useMemo.
  // This helps React optimize re-renders by only re-running when this specific value changes
  const currentMaxPriorityFromAllVisibleSections = useMemo(() => {
    return pluginData.currentMaxPriorityFromAllVisibleSections ?? -1
  }, [pluginData.currentMaxPriorityFromAllVisibleSections])

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Watch for changes to currentMaxPriorityFromAllVisibleSections and force re-render. This ensures that when one section updates the global max priority, all other sections will re-render and re-filter their items based on the new priority threshol.
  useEffect(() => {
    logDebug('Section', `- ${section.sectionCode} ${section.name}: Main useEffect has pluginData changed. currentMaxPriFAVS=${currentMaxPriorityFromAllVisibleSections}`)
  }, [currentMaxPriorityFromAllVisibleSections, section.sectionCode, section.name])

  // This useEffect is responsible for preparing and updating the items in a section whenever the section or dashboard settings change.
  // It ensures that if a section has no items, an appropriate message (such as a 'congrats' or empty state indicator) is displayed,
  // and skips processing if the section is disabled in user settings.
  useEffect(() => {
    if (!section) {
      logError('Section', `- No Section passed in!`)
      return
    }

    // Stop here if this section is not currently wanted by user.
    // $FlowIgnore[invalid-computed-prop]
    if (dashboardSettings && section.showSettingName && dashboardSettings[section.showSettingName] === false) {
      return
    }

    let sectionItems = section.sectionItems

    // If the section is present, but has no items, add a suitable message/itemType
    // Note: done here, rather than in the dataGeneration* functions, as items can be removed in the front-end, before the back-end is told to refresh.
    if (!sectionItems || sectionItems.length === 0) {
      switch (section.sectionCode) {
        case 'DT':
        case 'W':
        case 'M':
        case 'Q':
          if (isReferencedSection) {
            logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, but won't be shown, so no need to display congrats message`)
          } else {
            logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, so display congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                sectionCode: section.sectionCode,
                itemType: 'itemCongrats',
              },
            ]
          }
          break
        case 'TAG':
          logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
              sectionCode: section.sectionCode,
              itemType: 'itemCongrats',
            },
          ]
          break
        case 'PROJ':
          logDebug('Section', `PROJ doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
              sectionCode: section.sectionCode,
              itemType: 'projectCongrats',
            },
          ]
          break
        case 'SEARCH':
        case 'SAVEDSEARCH':
          logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
              sectionCode: section.sectionCode,
              itemType: 'noSearchResults',
            },
          ]
          break
        default:
          sectionItems = []
      }
    }

    setItems(sectionItems)
  }, [section, dashboardSettings])

  const refreshTimeBlockSection = useCallback(() => {
    const detailsMessageObject = { actionType: 'refreshSomeSections', sectionCodes: ['TB'] }
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'TBTimer fired refreshSomeSections', true)
  }, [section.sectionCode, sendActionToPlugin])

  /**
   * Set a timer to refresh the TB section every ~1 minute.
   */
  useEffect(() => {
    const refreshInterval = 54000 // A little less than 1 minute -- don't want it to collide with the IdleTimer if possible
    let timerId

    if (section.sectionCode === 'TB') {
      timerId = setInterval(() => {
        refreshTimeBlockSection()
      }, refreshInterval)
    }

    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [section.sectionCode, refreshTimeBlockSection])

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------

  // Note: this is where the display filtering/sorting/limiting happens.
  const {
    filteredItems: _filteredItems,
    itemsToShow,
    numFilteredOutThisSection: _numFilteredOutThisSection,
    limitApplied,
    maxPrioritySeenInThisSection,
    toggleShowAllTasks,
  } = useSectionSortAndFilter(section, items, dashboardSettings, currentMaxPriorityFromAllVisibleSections)

  // Debug: log the values from useSectionSortAndFilter
  // logDebug('Section', `- ${section.sectionCode} ${section.name} after useSectionSortAndFilter: maxPrioritySeenInThisSection=${maxPrioritySeenInThisSection}, itemsToShow=${itemsToShow.length}, numFilteredOutThisSection=${String(numFilteredOutThisSection)}, limitApplied=${String(limitApplied)}`)

  // Update global max priority when this section finds a higher priority
  // Use a ref to prevent duplicate updates to the same value
  useEffect(() => {
    logDebug(
      'Section',
      `Section ${section.sectionCode}${
        section.sectionCode === 'TAG' ? ` (${section.name})` : ''
      } useEffect running: maxPrioritySeenInThisSection=${maxPrioritySeenInThisSection}, currentMaxPriorityFromAllVisibleSections=${currentMaxPriorityFromAllVisibleSections}`,
    )

    // Only update if we found a higher priority AND we haven't already updated to this value
    if (maxPrioritySeenInThisSection > currentMaxPriorityFromAllVisibleSections && lastMaxPriorityUpdateRef.current !== maxPrioritySeenInThisSection) {
      logDebug(
        'Section',
        `Section ${section.sectionCode} found higher priority: ${maxPrioritySeenInThisSection} > ${currentMaxPriorityFromAllVisibleSections}, updating pluginData`,
      )
      lastMaxPriorityUpdateRef.current = maxPrioritySeenInThisSection
      updatePluginData(
        { ...pluginData, currentMaxPriorityFromAllVisibleSections: maxPrioritySeenInThisSection },
        `Section ${section.sectionCode} found higher priority: ${maxPrioritySeenInThisSection}`,
      )
      logDebug('Section', `Section ${section.sectionCode} ${section.name} set currentMaxPriorityFromAllVisibleSections to ${maxPrioritySeenInThisSection}`)
    }
  }, [maxPrioritySeenInThisSection, currentMaxPriorityFromAllVisibleSections, section.sectionCode])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  // handle a click to start interactive processing
  const handleInteractiveProcessingClick = useCallback(
    (e: MouseEvent): void => {
      const clickPosition = { clientY: e.clientY, clientX: e.clientX + 200 }
      const itemDetails = { actionType: '', item: itemsToShow[0], sectionCodes: [section.sectionCode] }
      setReactSettings((prevSettings) => {
        const newReactSettings = {
          ...prevSettings,
          lastChange: `_InteractiveProcessing Click`,
          interactiveProcessing: { sectionName: section.name, currentIPIndex: 0, totalTasks: itemsToShow.length, visibleItems: [...itemsToShow], clickPosition }, // called when interactive processing on an item is complete
          dialogData: { isOpen: true, isTask: true, details: itemDetails, clickPosition },
        }
        return newReactSettings
      })
    },
    [section, itemsToShow, reactSettings, setReactSettings],
  )

  const handleCommandButtonClick = (button: TActionButton): void => {
    // but this section could be empty and go away, so we need to propagate up
    onButtonClick(button)
  }

  // handle a clicking on the section title -> open the note in Editor if it has an associated filename
  const handleSectionClick = (e: MouseEvent): void => {
    if (!sectionFilename) return
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    const detailsMessageObject = { actionType: 'showNoteInEditorFromFilename', modifierKey: modifierName, filename: sectionFilename }
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Title clicked in Section', true)
  }

  //----------------------------------------------------------------------
  // Calculate values to use for rendering
  //----------------------------------------------------------------------

  // FIXME: this is getting called 3 times per section, once for each of the 3 sections in the Dashboard (TB, TAG, PROJ)
  // FIXME: this is also getting called another set of times after lastUpdated: "UPDATE_DATA Setting firstRun to false after force initial load"

  // $FlowIgnore[invalid-computed-prop]
  let hideSection = !items.length || (dashboardSettings && dashboardSettings[section.showSettingName] === false) // note this can be updated later
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)
  let numItemsToShow = itemsToShow.length

  // Figure out colours for section title
  const titleStyle: Object = sectionFilename ? { cursor: 'pointer' } : {}
  titleStyle.color = section.sectionTitleColorPart ? `var(--fg-${section.sectionTitleColorPart ?? 'main'})` : 'var(--item-icon-color)'

  const buttonsWithoutBordersOrBackground = section.actionButtons?.filter((b) => b.actionName.startsWith('add') || b.actionName.startsWith('close'))
  let processActionButtons = section.actionButtons?.filter((b) => !b.actionName.startsWith('add') && !b.actionName.startsWith('close'))

  if (processActionButtons) {
    // Transform "All → ..." buttons to "All shown → ..." when both filterPriorityItems and moveOnlyShownItemsWhenFiltered are active
    const filterPriorityItems = dashboardSettings?.filterPriorityItems ?? false
    const moveOnlyShownItemsWhenFiltered = dashboardSettings?.moveOnlyShownItemsWhenFiltered ?? true
    const shouldShowOnlyShown = filterPriorityItems && moveOnlyShownItemsWhenFiltered

    if (shouldShowOnlyShown) {
      processActionButtons = processActionButtons.map((button) => {
        // Modify actionType to indicate variant if flag is set
        const initialActionName = button.actionName
        let actionName = initialActionName
        if (actionName === 'moveAllTodayToTomorrow') {
          actionName = 'moveOnlyShownTodayToTomorrow'
        } else if (actionName === 'moveAllYesterdayToToday') {
          actionName = 'moveOnlyShownYesterdayToToday'
        } else if (actionName === 'moveAllThisWeekNextWeek') {
          actionName = 'moveOnlyShownThisWeekNextWeek'
        } else if (actionName === 'moveAllLastWeekThisWeek') {
          actionName = 'moveOnlyShownLastWeekThisWeek'
        }
        // If this is a "move only shown" button
        if (actionName.startsWith('moveOnlyShown')) {
          // logInfo('Section', `Section ${section.sectionCode} transforming button action ${initialActionName} to '${button.actionName}', and display from 'All' to 'All shown'`)
          button.actionName = actionName
          button.display = button.display.replace(/^All (?!shown)/, 'All shown ') // the negative lookahead ensures we don't replace 'All shown' with 'All shown shown', which was happening before
          return button
        }
        return button
      })
    }
  }

  // If we have no data items to show (other than a congrats message), remove any processing buttons, and only show 'add...' buttons
  if (numItemsToShow === 1 && treatSingleItemTypesAsZeroItems.includes(itemsToShow[0].itemType)) {
    processActionButtons = []
  }

  // Deal with some special cases where we don't want to show item counts
  // If we have only one item to show, and it's a single item type that we don't want to count (e.g. 'Nothing left on this list'), set numItemsToShow to 0
  if (numItemsToShow === 1 && treatSingleItemTypesAsZeroItems.includes(itemsToShow[0].itemType)) numItemsToShow = 0

  // If the last one is the filterIndicator or offerToFilter, decrement the number of items to show
  if (numItemsToShow > 0 && (itemsToShow[numItemsToShow - 1].itemType === 'filterIndicator' || itemsToShow[numItemsToShow - 1].itemType === 'offerToFilter')) {
    numItemsToShow--
  }

  // Form the description to use, replacing {closedOrOpenTaskCount} and {countWithLimit} placeholders with actual values
  let descriptionToUse = section.description
  /**
   * Requirements for the task completion part of descriptions:
   * - DT etc.: none: {T} from date
   *            open: {circle} {C} of {T} open from date
   *            done: {circle} {D} of {T} done from date
   * - DT(Ref) etc: ANY: {T} scheduled to date
   *           (otherwise too hard to separate direct from referenced)
   * - OVERDUE: no limit: {T} open from last ...
   *             limited: {L} of {T} open from last ...
   * - PRIORITY: no limit: {T} open
   *              limited: {L} of {T} open
   * - TAG: no limit: {T} open
   *         limited: {L} of {T} open
   * - PROJ: no limit: {T} projects ready to review
   *          limited: {L} of {T} projects ready to review
   */
  // Replace {countWithLimit} (e.g. from PROJECT) with the number of items, and pluralise it if neccesary
  descriptionToUse = descriptionToUse.replace('{countWithLimit}', limitApplied ? `first ${numItemsToShow} of ${totalCount ?? '?'}` : `${totalCount ?? '?'}`)

  // Replace {count} with the number of items, and pluralise it if neccesary
  descriptionToUse = descriptionToUse.replace(
    '{count}',
    `${totalCount ?? '?'} ${getTaskOrItemDisplayString(totalCount ?? 0, dashboardSettings.ignoreChecklistItems ? 'task' : 'item')}`,
  )

  // Replace {closedOrOpenTaskCount} with the number of completed or open tasks, depending on the 'showProgressInSections' setting
  const doneCount = section.doneCounts?.completedTasks ?? 0
  if (descriptionToUse.includes('{closedOrOpenTaskCount}')) {
    let closedOrOpenTaskCountString = ''
    switch (dashboardSettings.showProgressInSections) {
      case 'number closed':
        closedOrOpenTaskCountString = `closed ${String(doneCount)} ${getTaskOrItemDisplayString(
          doneCount,
          dashboardSettings.ignoreChecklistItems ? 'task' : 'item',
        )}`
        break
      case 'number open':
        closedOrOpenTaskCountString = `${totalCount ? String(totalCount) : '?'} open ${getTaskOrItemDisplayString(
          totalCount ?? 0,
          dashboardSettings.ignoreChecklistItems ? 'task' : 'item',
        )}`
        break
      default:
        closedOrOpenTaskCountString = String(totalCount ?? 0)
        break
    }
    descriptionToUse = descriptionToUse.replace('{closedOrOpenTaskCount}', closedOrOpenTaskCountString)
  }

  // Replace {itemType} in description, and pluralise it if neccesary
  descriptionToUse = descriptionToUse.replace('{itemType}', getTaskOrItemDisplayString(totalCount ?? 0, dashboardSettings.ignoreChecklistItems ? 'task' : 'item'))

  // logInfo('Section', `- ${section.sectionCode}: limitApplied? ${String(limitApplied)} / numItemsToShow: ${String(numItemsToShow)} / numItems: ${String(items.length)} / numFilteredOutThisSection: ${String(numFilteredOutThisSection)}. ${section.description} -> ${descriptionToUse}`)

  // Prep a task-completion circle to the description for calendar non-referenced sections (where showProgressInSections !== 'none')
  let completionCircle = null
  if (numItemsToShow > 0 && section.doneCounts && dashboardSettings.showProgressInSections !== 'none' && allCalendarSectionCodes.includes(section.sectionCode) && section.isReferenced === false) {
    const percentComplete = (doneCount / (doneCount + items.length)) * 100.0
    completionCircle = (
      <span
        className="sectionCompletionCircle"
        title={`${String(doneCount)} of ${String(doneCount + items.length)} tasks completed`}
        style={{ justifySelf: 'end' }}
      >
        <CircularProgressBar
          // $FlowFixMe[incompatible-type]
          size="0.9rem" // Note: this only works as "Nrem" despite number being expected
          progress={percentComplete}
          backgroundColor="var(--bg-sidebar-color)"
          trackWidth={8} // outer border width
          trackColor="rgb(from var(--fg-main-color) r g b/0.6)" // "var(--fg-done-color)" // {titleStyle.color}
          indicatorRadius={25} // (% of container) of middle of indicator
          indicatorWidth={50} // (% of container)
          indicatorColor="rgb(from var(--fg-main-color) r g b/0.6)" // "var(--fg-done-color)" // {titleStyle.color}
          indicatorCap="butt"
          label=""
          spinnerMode={false}
        />{' '}
      </span>
    )
  }

  // If we have no data items to show (other than a congrats message), don't show description
  // const descriptionDiv = numItemsToShow > 0 ? <div className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></div> : null
  const descriptionDiv =
    numItemsToShow > 0 ? (
      <div className="sectionInfoSecondLine">
        {completionCircle}
        {/* <span id='section${section.ID}Count'>{descriptionToUse}</span> */}
        <span className="sectionDescription">{descriptionToUse}</span>
        {/* <span id='section${section.ID}TotalCount'>{totalCountString}</span> */}
      </div>
    ) : null

  // Decide whether to show interactiveProcessing button
  // Note: don't show IP button if there are no items to show, or if the first item is a single item type that we don't want to count (e.g. 'Nothing left on this list')
  // TODO(later): enable again for PROJ
  const showIPButton =
    dashboardSettings.enableInteractiveProcessing &&
    interactiveProcessingPossibleSectionTypes.includes(section.sectionCode) &&
    numItemsToShow > 1 &&
    // TODO: use this next line instead if we want to pass all items to interactive processing, not just the [possibly filtered] numItemsToShow
    // (numItemsToShow > 1 || (numItemsToShow === 1 && numFilteredOutThisSection > 0)) &&
    !treatSingleItemTypesAsZeroItems.includes(itemsToShow[0].itemType)

  // TB section can show up blank, without this extra check
  if (itemsToShow.length === 0) {
    hideSection = true
  }

  function getTaskOrItemDisplayString(count: number, type: string) {
    return `${count === 1 ? type : `${type}s`}`
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  /**
   * Layout of sectionInfo = 4 divs:
   * - sectionInfoFirstLine = grid of sectionName div and buttonsWithoutBordersOrBackground div
   * - sectionDescription
   * - sectionProcessButtons = 0 or more processActionButtons
   * On normal width screen these are a row-based grid (1x3).
   * On narrow window, these are a column-based grid (3x1).
   * Then <SectionGrid> which contains the actual data items.
   */
  return hideSection ? null : (
    // <section className={`section`}>
    // TODO: get this working. See post in KP Discord about it on 26.5.2025
    <section className={`section ${isReferencedSection ? 'referencedSectionInfo' : 'nonReferencedSectionInfo'}`}>
      <div className="sectionInfo">
        <div className="sectionInfoFirstLine">
          <TooltipOnKeyPress
            altKey={{ text: 'Open in Split View' }}
            metaKey={{ text: 'Open in Floating Window' }}
            label={`${section.name}_Open Note Link`}
            enabled={!reactSettings?.dialogData?.isOpen && Boolean(sectionFilename)}
          >
            <div className={`sectionName`} onClick={handleSectionClick} style={titleStyle}>
              <i className={`sectionIcon ${section.FAIconClass || ''}`}></i>
              {section.sectionCode === 'TAG' ? section.name.replace(/^[#@]/, '') : section.name}
              {sectionIsRefreshing ? <i className="fa fa-spinner fa-spin pad-left"></i> : null}
            </div>
          </TooltipOnKeyPress>
          {/* {' '} */}
          <div className={`buttonsWithoutBordersOrBackground ${section.sectionTitleColorPart ?? ''}`}>
            {buttonsWithoutBordersOrBackground?.map((item, index) => <CommandButton key={index} button={item} onClick={handleCommandButtonClick} className="addButton" />) ?? []}
          </div>
        </div>

        {descriptionDiv}

        <div className="sectionProcessButtons">
          {processActionButtons?.map((item, index) => <CommandButton key={index} button={item} onClick={handleCommandButtonClick} className="PCButton" />) ?? []}
          {showIPButton && (
            // <>
            <button className="PCButton tooltip" onClick={handleInteractiveProcessingClick} data-tooltip={`Interactively process ${numItemsToShow} ${section.name} items`}>
              {/* <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i> */}
              {/* wanted to use 'fa-arrow-progress' here but not in our build */}
              {/* <i className="fa-regular fa-layer-group fa-rotate-90"></i> */}
              <i className="fa-regular fa-angles-right"></i>
              <span className="interactiveProcessingNumber" style={{ fontWeight: 500, paddingLeft: '3px' }}>
                {numItemsToShow}
                {/* Note: use this instead of above if we want to pass all items to interactive processing, not just the [possibly filtered] numItemsToShow */}
                {/* {numItemsToShow + numFilteredOut} */}
              </span>
            </button>
            // </>
          )}
        </div>
      </div>
      <ItemGrid thisSection={section} items={itemsToShow} onToggleShowAll={toggleShowAllTasks} />
    </section>
  )
}

// Memoize Section component to prevent re-renders when props haven't changed
// This helps prevent cascading re-renders when pluginData changes but section prop is the same
// $FlowFixMe[incompatible-type]
const MemoizedSection = (React.memo(Section, (prevProps: SectionProps, nextProps: SectionProps): boolean => {
  // Only re-render if the section object reference changed
  // Note: This won't prevent re-renders from context changes, but will prevent prop-based re-renders
  return prevProps.section === nextProps.section && prevProps.onButtonClick === nextProps.onButtonClick
}): any)

export default MemoizedSection
