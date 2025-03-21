// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated for v2.1.10
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react'
import type { TSection, TSectionItem, TActionButton } from '../../../types.js'
import CommandButton from '../CommandButton.jsx'
import ItemGrid from '../ItemGrid.jsx'
import TooltipOnKeyPress from '../ToolTipOnModifierPress.jsx'
import { useAppContext } from '../AppContext.jsx'
import useSectionSortAndFilter from './useSectionSortAndFilter.jsx'
import { logDebug, logError, logInfo, JSP, clo } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

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
  const { dashboardSettings, reactSettings, setReactSettings, pluginData, sendActionToPlugin } = useAppContext()
  // logDebug('Section', `🔸 Section: ${section.sectionCode} (${String(section.sectionItems?.length ?? 0)} items in '${section.name}')`)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [items, setItems] = useState<Array<TSectionItem>>([])

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const { sectionFilename, totalCount } = section

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  useEffect(() => {
    if (!section) {
      logError('Section', `❓ No Section passed in.`)
      return
    }

    // $FlowIgnore[invalid-computed-prop]
    if (dashboardSettings && section.showSettingName && dashboardSettings[section.showSettingName] === false) {
      return
    }

    let sectionItems = section.sectionItems
    if (!sectionItems || sectionItems.length === 0) {
      switch (section.sectionCode) {
        case 'DT':
        case 'W':
        case 'M':
        case 'Q':
          logDebug('Section', `Section ${section.sectionCode} doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: '0-Congrats',
              itemType: 'itemCongrats',
            },
          ]
          break
        case 'PROJ':
          logDebug('Section', `Section 14 (PROJ) doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: '14-Congrats',
              itemType: 'projectCongrats',
            },
          ]
          break
        default:
          sectionItems = []
      }
    }

    setItems(sectionItems)
  }, [section, dashboardSettings])

  const refresh = useCallback(() => {
    const detailsMessageObject = { actionType: 'refreshSomeSections', sectionCodes: ['TB'] }
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'TBTimer fired refreshSomeSections', true)
  }, [section.sectionCode, sendActionToPlugin])

  /**
   * Set a timer to refresh the TB section every 1 minute.
   * FIXME(dwertheimer): this is what Cursor added on my second attempt -- just trying to keep it all in this file. But doesn't work.
   */
  useEffect(() => {
    const refreshInterval = 50000 // A little less than 1 minute -- don't want it to collide with the IdleTimer if possible
    let timerId

    if (section.sectionCode === 'TB') {
      timerId = setInterval(() => {
        refresh()
      }, refreshInterval)
    }

    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [section.sectionCode, refresh])

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  const { itemsToShow, numFilteredOut, limitApplied } = useSectionSortAndFilter(section, items, dashboardSettings)

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

  const handleSectionClick = (e: MouseEvent): void => {
    if (!sectionFilename) return
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    const detailsMessageObject = { actionType: 'showNoteInEditorFromFilename', modifierKey: modifierName, filename: sectionFilename }
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Title clicked in Section', true)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  // $FlowIgnore[invalid-computed-prop]
  let hideSection = !items.length || (dashboardSettings && dashboardSettings[section.showSettingName] === false) // note this can be updated later
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)
  // const isDesktop = pluginData.platform === 'macOS'
  let numItemsToShow = itemsToShow.length

  const addNewActionButtons = section.actionButtons?.filter((b) => b.actionName.startsWith('add')) // : []
  let processActionButtons = section.actionButtons?.filter((b) => !b.actionName.startsWith('add')) // : []

  // If we have no data items to show (other than a congrats message), remove any processing buttons, and only show 'add...' buttons
  if (numItemsToShow === 1 && ['itemCongrats', 'projectCongrats'].includes(itemsToShow[0].itemType)) {
    processActionButtons = []
  }

  // Decrement the number of items to show if the last one is the filterIndicator
  if (numItemsToShow > 0 && itemsToShow[numItemsToShow - 1].itemType === 'filterIndicator') {
    numItemsToShow--
  }
  if (numItemsToShow === 1 && (itemsToShow[0].itemType === 'itemCongrats' || itemsToShow[0].itemType === 'projectCongrats')) numItemsToShow = 0

  // Replace {count} and {totalCount} placeholders
  let descriptionToUse = section.description
  if (descriptionToUse.includes('{count}')) {
    const totalNumItems = items.length
    if (numFilteredOut > 0) {
      if (descriptionToUse.includes('first')) {
        descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'>${String(numItemsToShow)} of ${String(totalNumItems)}</span >`)
      } else {
        descriptionToUse = descriptionToUse.replace(
          '{count}',
          `<span id='section${section.ID}Count'>${numItemsToShow > 0 ? 'first ' : ''}${String(numItemsToShow)} of ${String(totalNumItems)}</span >`,
        )
      }
    } else if (limitApplied) {
      descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}TotalCount'}>${String(numItemsToShow)} of ${String(totalNumItems)}</span>`)
    } else {
      descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}TotalCount'}>${String(numItemsToShow)}</span>`)
    }
  }
  if (descriptionToUse.includes('{totalCount}')) {
    descriptionToUse = descriptionToUse.replace('{totalCount}', `<span id='section${section.ID}TotalCount'}>${String(totalCount)}</span>`)
  }

  // Pluralise item in description if neccesary
  if (descriptionToUse.includes('{s}')) {
    if (numItemsToShow !== 0) {
      descriptionToUse = descriptionToUse.replace('{s}', `s`)
    } else {
      descriptionToUse = descriptionToUse.replace('{s}', ``)
    }
  }

  // If we have no data items to show (other than a congrats message), don't show description
  const descriptionDiv = numItemsToShow > 0 ? <div className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></div> : <div></div>

  // Decide whether to show interactiveProcessing button
  // TODO(later): enable again for PROJ
  const showIPButton =
    dashboardSettings.enableInteractiveProcessing &&
    numItemsToShow > 1 &&
    !['itemCongrats', 'projectCongrats'].includes(itemsToShow[0].itemType) &&
    section.sectionCode !== 'TB' &&
    section.sectionCode !== 'PROJ'

  const titleStyle: Object = sectionFilename ? { cursor: 'pointer' } : {}
  titleStyle.color = section.sectionTitleColorPart ? `var(--fg-${section.sectionTitleColorPart ?? 'main'})` : 'var(--item-icon-color)'

  // TB section can show up blank, without this extra check
  if (itemsToShow.length === 0) {
    hideSection = true
  }

  /**
   * Layout of sectionInfo = 4 divs:
   * - sectionInfoFirstLine = grid of sectionName div and addNewActionButtons div
   * - sectionDescription
   * - sectionProcessButtons = 0 or more processActionButtons
   * On normal width screen these are a row-based grid (1x3).
   * On narrow window, these are a column-based grid (3x1).
   * Then <SectionGrid> which contains the actual data items.
   */
  return hideSection ? null : (
    <section className="section">
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
          <div className={`addNewActionButtons ${section.sectionTitleColorPart ?? ''}`}>
            {addNewActionButtons?.map((item, index) => <CommandButton key={index} button={item} onClick={handleCommandButtonClick} className="addButton" />) ?? []}
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
              </span>
            </button>
            // </>
          )}
        </div>
      </div>
      <ItemGrid thisSection={section} items={itemsToShow} />
    </section>
  )
}

export default Section
