// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated 2026-07-10 for v2.4.0.b48 by @jgclark + @CursorAI
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
import { countRealSectionItems, getGeneratedDateKey } from './sectionHelpers.js'
import { clo, getDiff, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import './Section.css'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type SectionProps = {
  section: TSection,
  onButtonClick: (button: TActionButton) => void,
  isViewVisible?: boolean,
}

//--------------------------------------------------------------------------
// Section Component Definition
//--------------------------------------------------------------------------
const Section = ({ section, onButtonClick, isViewVisible = true }: SectionProps): React$Node => {
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
        // clo(diff, `Section ${section.sectionCode} ${section.name} diff for ${label}`, 2)
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
  // hideEmptySections: distinguish local last-item completion (keep congrats) from refresh/initial empty (hide).
  // generatedDate is set by dataGeneration* and left unchanged by REMOVE_LINE_FROM_JSON splices.
  const prevGeneratedDateKeyRef = useRef<?string>(null)
  const prevRealItemCountRef = useRef<?number>(null)
  const showCongratsUntilRefreshRef = useRef<boolean>(false)

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
  //
  // hideEmptySections (Display setting "Hide sections with nothing left to do?"):
  // - After refresh / first load with zero open items -> do not inject congrats (section hides via hideSection).
  // - After completing the last item locally (REMOVE_LINE_FROM_JSON; same generatedDate, real count >0 -> 0) -> still inject congrats until next refresh.
  // Search empty messages are always shown (not gated by this setting).
  // WINS: only injects winsCongrats after local completion of defined wins - never an empty-state when none were defined.
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
    const realCount = countRealSectionItems(sectionItems)
    const generatedDateKey = getGeneratedDateKey(section.generatedDate)
    const prevGenKey = prevGeneratedDateKeyRef.current
    const prevRealCount = prevRealItemCountRef.current
    const hideEmptySections = dashboardSettings?.hideEmptySections === true

    // Update "show congrats until refresh" from how this section became empty.
    // Only clear the flag when generatedDate changes (a real refresh), not when the setting is toggled -
    // so turning the setting off and on again still keeps post-completion congrats until refresh.
    if (prevGenKey != null && generatedDateKey !== prevGenKey) {
      showCongratsUntilRefreshRef.current = false
    } else if (prevRealCount != null && prevRealCount > 0 && realCount === 0) {
      // Local REMOVE_LINE emptied this section without regenerating it
      // (set regardless of hideEmptySections so WINS can use this flag alone)
      showCongratsUntilRefreshRef.current = true
    }

    prevGeneratedDateKeyRef.current = generatedDateKey
    prevRealItemCountRef.current = realCount

    // When hideEmptySections is off, always allow empty messages (legacy behaviour).
    // When on, only allow them after a local last-item completion until the next refresh.
    const allowEmptyCongrats = !hideEmptySections || showCongratsUntilRefreshRef.current

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
          } else if (allowEmptyCongrats) {
            logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, so display congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                sectionCode: section.sectionCode,
                itemType: 'itemCongrats',
              },
            ]
          } else {
            logDebug('Section', `- ${section.sectionCode} ${section.name}: hideEmptySections - skipping congrats after refresh/initial empty`)
            sectionItems = []
          }
          break
        case 'WINS':
          // Only show congrats when open wins existed and were all completed locally (until next refresh).
          // Never show an empty-state when no wins were defined for the current calendar sections.
          if (showCongratsUntilRefreshRef.current) {
            logDebug('Section', `- ${section.sectionCode} ${section.name} last win completed locally, so display wins congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                sectionCode: section.sectionCode,
                itemType: 'winsCongrats',
              },
            ]
          } else {
            logDebug('Section', `- ${section.sectionCode} ${section.name}: no open wins defined - skipping wins congrats`)
            sectionItems = []
          }
          break
        case 'TAG':
          if (allowEmptyCongrats) {
            logDebug('Section', `- ${section.sectionCode} ${section.name} doesn't have any sectionItems, so display congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                sectionCode: section.sectionCode,
                itemType: 'itemCongrats',
              },
            ]
          } else {
            logDebug('Section', `- ${section.sectionCode} ${section.name}: hideEmptySections - skipping congrats after refresh/initial empty`)
            sectionItems = []
          }
          break
        case 'PROJACT':
        case 'PROJREVIEW':
          if (allowEmptyCongrats) {
            logDebug('Section', `${section.sectionCode} doesn't have any sectionItems, so display congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                sectionCode: section.sectionCode,
                itemType: 'projectCongrats',
              },
            ]
          } else {
            logDebug('Section', `${section.sectionCode}: hideEmptySections - skipping project congrats after refresh/initial empty`)
            sectionItems = []
          }
          break
        case 'SEARCH':
        case 'SAVEDSEARCH':
          // Search empty state is always shown; not controlled by hideEmptySections
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
   * Set a timer to refresh the TB section every ~1 minute while the Dashboard window is visible.
   * Cleared when the window is hidden (isViewVisible false) or the section unmounts.
   */
  useEffect(() => {
    const refreshInterval = 54000 // A little less than 1 minute -- don't want it to collide with the IdleTimer if possible
    let timerId
    let isTBEnabledInSettings = dashboardSettings?.showTimeBlockSection !== false
    if (section.showSettingName && dashboardSettings) {
      // $FlowIgnore[invalid-computed-prop]
      const showSettingValue = dashboardSettings[section.showSettingName]
      isTBEnabledInSettings = showSettingValue !== false
    }

    if (section.sectionCode === 'TB' && isTBEnabledInSettings && isViewVisible) {
      timerId = setInterval(() => {
        refreshTimeBlockSection()
      }, refreshInterval)
    }

    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [dashboardSettings, section.sectionCode, section.showSettingName, refreshTimeBlockSection, isViewVisible])

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------

  // Note: this is where the display filtering/sorting/limiting happens.
  const {
    filteredItems: _filteredItems,
    itemsToShow,
    allSortedItems,
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
    // logDebug(
    //   'Section',
    //   `Section ${section.sectionCode}${
    //     section.sectionCode === 'TAG' ? ` (${section.name})` : ''
    //   } useEffect running: maxPrioritySeenInThisSection=${maxPrioritySeenInThisSection}, currentMaxPriorityFromAllVisibleSections=${currentMaxPriorityFromAllVisibleSections}`,
    // )

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
  // When moveOnlyShownItemsWhenFiltered is false, include lower-priority (and limit-hidden) items, not just those currently shown.
  const handleInteractiveProcessingClick = useCallback(
    (e: MouseEvent): void => {
      const moveOnlyShownItemsWhenFiltered = dashboardSettings?.moveOnlyShownItemsWhenFiltered ?? true
      const sourceItems = moveOnlyShownItemsWhenFiltered ? itemsToShow : allSortedItems
      const processableItems = sourceItems.filter((row) => row.itemType === 'open' || row.itemType === 'checklist')
      if (processableItems.length === 0) return

      const clickPosition = { clientY: e.clientY, clientX: e.clientX + 200 }
      const itemDetails = { actionType: '', item: processableItems[0], sectionCodes: [section.sectionCode] }
      setReactSettings((prevSettings) => {
        const newReactSettings = {
          ...prevSettings,
          lastChange: `_InteractiveProcessing Click`,
          interactiveProcessing: {
            sectionName: section.name,
            currentIPIndex: 0,
            totalTasks: processableItems.length,
            visibleItems: [...processableItems],
            clickPosition,
          },
          dialogData: { isOpen: true, isTask: true, details: itemDetails, clickPosition },
        }
        return newReactSettings
      })
    },
    [section, itemsToShow, allSortedItems, dashboardSettings?.moveOnlyShownItemsWhenFiltered, setReactSettings],
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

  // FIXME: this is getting called 3 times per section, once for each of the 3 sections in the Dashboard (TB, TAG, PROJREVIEW/PROJACT)
  // FIXME: this is also getting called another set of times after lastUpdated: "UPDATE_DATA Setting firstRun to false after force initial load"

  // $FlowIgnore[invalid-computed-prop]
  let hideSection = !items.length || (dashboardSettings && dashboardSettings[section.showSettingName] === false) // note this can be updated later
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)
  let numItemsToShow = itemsToShow.length

  // Figure out a style for the section title
  const titleStyle: Object = sectionFilename ? { cursor: 'pointer' } : {}
  // If the section title color part is not set, use the main color, otherwise the later code adds the relevant color class name to the div
  // if (!section.sectionTitleColorPart || section.sectionTitleColorPart === 'DailySectionColor') {
  //   titleStyle.color = 'var(--fg-main-color)'
  // }

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
   * - PROJREVIEW: no limit: {T} projects ready to review
   *                limited: {L} of {T} projects ready to review
   * - PROJACT: no limit: {T} active projects
   *             limited: {L} of {T} active projects
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

  // Decide whether to show interactiveProcessing button:
  // - don't show IP button if there are no items to show, or if the first item is a single item type that we don't want to count (e.g. 'Nothing left on this list')
  // - when moveOnlyShownItemsWhenFiltered is false, N and the IP dialog include lower-priority / limit-hidden items as well.
  // - TODO(later): enable for PROJREVIEW/PROJACT
  const moveOnlyShownItemsWhenFiltered = dashboardSettings?.moveOnlyShownItemsWhenFiltered ?? true
  const ipItemCount = moveOnlyShownItemsWhenFiltered
    ? numItemsToShow
    : allSortedItems.filter((row) => row.itemType === 'open' || row.itemType === 'checklist').length
  const showIPButton =
    dashboardSettings.enableInteractiveProcessing &&
    interactiveProcessingPossibleSectionTypes.includes(section.sectionCode) &&
    ipItemCount > 1 &&
    itemsToShow.length > 0 &&
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
        <div className={`sectionInfoFirstLine ${section.sectionTitleColorPart ? section.sectionTitleColorPart : 'DefaultSectionColor'}`}>
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
            <button className="PCButton tooltip" onClick={handleInteractiveProcessingClick} data-tooltip={`Interactively process ${ipItemCount} ${section.name} items`}>
              {/* <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i> */}
              {/* wanted to use 'fa-arrow-progress' here but not in our build */}
              {/* <i className="fa-regular fa-layer-group fa-rotate-90"></i> */}
              <i className="fa-regular fa-angles-right"></i>
              <span className="interactiveProcessingNumber" style={{ fontWeight: 500, paddingLeft: '3px' }}>
                {ipItemCount}
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
