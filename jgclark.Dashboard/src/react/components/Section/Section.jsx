// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated 2025-09-05 for v2.3.0.b10
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react'
import type { TSection, TSectionItem, TActionButton } from '../../../types.js'
import { interactiveProcessingPossibleSectionTypes, treatSingleItemTypesAsZeroItems } from '../../../constants.js'
import CommandButton from '../CommandButton.jsx'
import ItemGrid from '../ItemGrid.jsx'
import TooltipOnKeyPress from '../ToolTipOnModifierPress.jsx'
import { useAppContext } from '../AppContext.jsx'
import CircularProgressBar from '../CircularProgressBar.jsx'
import useSectionSortAndFilter from './useSectionSortAndFilter.jsx'
import { logDebug, logError, logInfo, JSP, clo } from '@helpers/react/reactDev'
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
  // logDebug('Section', `🔸 Section: ${section.sectionCode} (${String(section.sectionItems?.length ?? 0)} items in '${section.name}')`)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [items, setItems] = useState<Array<TSectionItem>>([])

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const { sectionFilename, totalCount } = section
  const isReferencedSection = section.isReferenced ?? false

  // Get the current max priority from all visible sections (updated dynamically as sections process)
  const currentMaxPriorityFromAllVisibleSections = pluginData.currentMaxPriorityFromAllVisibleSections

  // Debug: log the values we're getting
  logDebug('Section', `Section ${section.sectionCode} render: currentMaxPriorityFromAllVisibleSections=${currentMaxPriorityFromAllVisibleSections}`)

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Watch for changes to currentMaxPriorityFromAllVisibleSections and force re-render
  // This ensures that when one section updates the global max priority, all other sections
  // will re-render and re-filter their items based on the new priority threshold
  useEffect(() => {
    // This effect will run whenever currentMaxPriorityFromAllVisibleSections changes
    // The dependency on pluginData will trigger a re-render when updatePluginData is called
    // of this component, which will cause useSectionSortAndFilter to recalculate
    logDebug('Section', `Section ${section.sectionCode} detected pluginData change, currentMaxPriorityFromAllVisibleSections=${currentMaxPriorityFromAllVisibleSections}`)
  }, [pluginData, section.sectionCode])
  useEffect(() => {
    if (!section) {
      logError('Section', `No Section passed in.`)
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
            logDebug('Section', `Section ${section.sectionCode} doesn't have any sectionItems, but won't be shown, so no need to display congrats message`)
          } else {
            logDebug('Section', `Section ${section.sectionCode} doesn't have any sectionItems, so display congrats message`)
            sectionItems = [
              {
                ID: `${section.sectionCode}-Empty`,
                itemType: 'itemCongrats',
              },
            ]
          }
          break
        case 'TAG':
          logDebug('Section', `Section ${section.sectionCode} doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
              itemType: 'itemCongrats',
            },
          ]
          break
        case 'PROJ':
          logDebug('Section', `Section PROJ doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
              itemType: 'projectCongrats',
            },
          ]
          break
        case 'SEARCH':
        case 'SAVEDSEARCH':
          logDebug('Section', `Section ${section.sectionCode} doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: `${section.sectionCode}-Empty`,
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
    numFilteredOut: _numFilteredOut,
    limitApplied,
    maxPrioritySeenInThisSection,
    toggleShowAllTasks,
  } = useSectionSortAndFilter(section, items, dashboardSettings, currentMaxPriorityFromAllVisibleSections)

  // Debug: log the values from useSectionSortAndFilter
  logDebug('Section', `Section ${section.sectionCode} after useSectionSortAndFilter: maxPrioritySeenInThisSection=${maxPrioritySeenInThisSection}`)

  // Update global max priority when this section finds a higher priority
  useEffect(() => {
    logDebug(
      'Section',
      `Section ${section.sectionCode}${
        section.sectionCode === 'TAG' ? ` (${section.name})` : ''
      } useEffect running: maxPrioritySeenInThisSection=${maxPrioritySeenInThisSection}, currentMaxPriorityFromAllVisibleSections=${currentMaxPriorityFromAllVisibleSections}`,
    )
    if (maxPrioritySeenInThisSection > currentMaxPriorityFromAllVisibleSections) {
      logDebug('Section', `Section ${section.sectionCode} found higher priority: ${maxPrioritySeenInThisSection} > ${currentMaxPriorityFromAllVisibleSections}, updating pluginData`)
      updatePluginData(
        { ...pluginData, currentMaxPriorityFromAllVisibleSections: maxPrioritySeenInThisSection },
        `Section ${section.sectionCode} found higher priority: ${maxPrioritySeenInThisSection}`,
      )
      logInfo('Section', `Section ${section.sectionCode} set currentMaxPriorityFromAllVisibleSections to ${maxPrioritySeenInThisSection}`)
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

  // $FlowIgnore[invalid-computed-prop]
  let hideSection = !items.length || (dashboardSettings && dashboardSettings[section.showSettingName] === false) // note this can be updated later
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)
  let numItemsToShow = itemsToShow.length

  // Figure out colours for section title
  const titleStyle: Object = sectionFilename ? { cursor: 'pointer' } : {}
  titleStyle.color = section.sectionTitleColorPart ? `var(--fg-${section.sectionTitleColorPart ?? 'main'})` : 'var(--item-icon-color)'

  const buttonsWithoutBordersOrBackground = section.actionButtons?.filter((b) => b.actionName.startsWith('add') || b.actionName.startsWith('close'))
  let processActionButtons = section.actionButtons?.filter((b) => !b.actionName.startsWith('add') && !b.actionName.startsWith('close'))

  // Deal with special cases where we don't want to show item counts
  // If we have no data items to show (other than a congrats message), remove any processing buttons, and only show 'add...' buttons
  if (numItemsToShow === 1 && treatSingleItemTypesAsZeroItems.includes(itemsToShow[0].itemType)) {
    processActionButtons = []
  }
  // If we have only one item to show, and it's a single item type that we don't want to count (e.g. 'Nothing left on this list'), set numItemsToShow to 0
  if (numItemsToShow === 1 && treatSingleItemTypesAsZeroItems.includes(itemsToShow[0].itemType)) numItemsToShow = 0

  // If the last one is the filterIndicator, decrement the number of items to show
  if (numItemsToShow > 0 && itemsToShow[numItemsToShow - 1].itemType === 'filterIndicator') {
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
  // Replace {countWithLimit} with the number of items, and pluralise it if neccesary
  descriptionToUse = descriptionToUse.replace('{countWithLimit}', limitApplied ? `first ${items.length} of ${totalCount ?? '?'}` : `${totalCount ?? '?'}`)

  // Replace {count} with the number of items, and pluralise it if neccesary
  descriptionToUse = descriptionToUse.replace(
    '{count}',
    `${totalCount ?? '?'} ${getTaskOrItemDisplayString(totalCount ?? 0, dashboardSettings.ignoreChecklistItems ? 'task' : 'item')}`,
  )

  // Replace {closedOrOpenTaskCount} with the number of completed or open tasks, depending on the 'showProgressInSections' setting
  if (descriptionToUse.includes('{closedOrOpenTaskCount}')) {
    let closedOrOpenTaskCountString = ''
    switch (dashboardSettings.showProgressInSections) {
      case 'number closed':
        closedOrOpenTaskCountString = `closed ${section.doneCounts?.completedTasks ?? '0'} ${getTaskOrItemDisplayString(
          section.doneCounts?.completedTasks ?? 0,
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

  // logInfo('Section', `${section.sectionCode}: limitApplied? ${String(limitApplied)} / numItemsToShow: ${String(numItemsToShow)} / numItems: ${String(items.length)} / numFilteredOut: ${String(numFilteredOut)}. ${section.description} -> ${descriptionToUse}`)

  // Prep a task-completion circle to the description for calendar non-referenced sections (where showProgressInSections !== 'none')
  let completionCircle = null
  if (numItemsToShow > 0 && ['DT', 'DY', 'W', 'LW', 'M', 'Q', 'Y'].includes(section.sectionCode) && section.doneCounts && dashboardSettings.showProgressInSections !== 'none') {
    const percentComplete = (section.doneCounts.completedTasks / (section.doneCounts.completedTasks + items.length)) * 100.0
    completionCircle = (
      <span
        className="sectionCompletionCircle"
        title={`${section.doneCounts.completedTasks} of ${section.doneCounts.completedTasks + items.length} tasks completed`}
        style={{ justifySelf: 'end' }}
      >
        <CircularProgressBar
          // $FlowFixMe[incompatible-type]
          size="0.9rem" // TODO: this only works as "Nrem" despite number being expected
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
    // (numItemsToShow > 1 || (numItemsToShow === 1 && numFilteredOut > 0)) &&
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

export default Section
