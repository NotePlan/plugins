// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated for v2.1.0.a
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
import { logDebug, logError, JSP, clo } from '@helpers/react/reactDev'
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

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [items, setItems] = useState<Array<TSectionItem>>([])

  //----------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const { sectionFilename, totalCount } = section
  const titleStyle = sectionFilename ? { cursor: 'pointer' } : {}

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
      switch (section.ID) {
        case '0':
          logDebug('Section', `Section 0 (DT) doesn't have any sectionItems, so display congrats message`)
          sectionItems = [
            {
              ID: '0-Congrats',
              itemType: 'itemCongrats',
            },
          ]
          break
        case '14':
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
      logDebug(`Section`, `handleInteractiveProcessingClick x,y=(${e.clientX}, ${e.clientY})`)
      console.log('Section 🥸 handleIPItemProcessed reactSettings at top of handleInteractiveProcessingClick function', reactSettings)

      const clickPosition = { clientY: e.clientY, clientX: e.clientX + 200 }
      const itemDetails = { actionType: '', item: itemsToShow[0] }
      logDebug('Section', `handleInteractiveProcessingClick; setting currentIPIndex=${String(0)} itemDetails=${JSON.stringify(itemDetails)}`)
      setReactSettings((prevSettings) => {
        const newReactSettings = {
          ...prevSettings,
          lastChange: `_InteractiveProcessing Click`,
          interactiveProcessing: { sectionName: section.name, currentIPIndex: 0, totalTasks: itemsToShow.length, visibleItems: [...itemsToShow], clickPosition }, // called when interactive processing on an item is complete
          dialogData: { isOpen: true, isTask: true, details: itemDetails, clickPosition },
        }
        console.log('Section 🥸 newReactSettings.dialogData.details', newReactSettings)
        return newReactSettings
      })
    },
    [section, itemsToShow, reactSettings, setReactSettings],
  )

  const handleCommandButtonClick = (button: TActionButton): void => {
    logDebug(`Section`, `handleCommandButtonClick was called for section ${section.name} section`)
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
  const hideSection = !items.length || (dashboardSettings && dashboardSettings[section.showSettingName] === false)
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)
  const isDesktop = pluginData.platform === 'macOS'
  let numItemsToShow = itemsToShow.length

  // on mobile, let through only the "moveAll to..." buttons (yesterday->today & today->tomorrow) and the "scheduleAllOverdue" button
  section.actionButtons = isDesktop
    ? section.actionButtons
    : section.actionButtons?.filter((b) => b.actionName.startsWith('move') || b.actionName.startsWith('scheduleAllOverdue')) || []

  // If we have no data items to show (other than a congrats message), don't show most buttons
  if (section.actionButtons && numItemsToShow === 1 && (itemsToShow[0].itemType === 'itemCongrats' || section.sectionCode === 'PROJ')) {
    section.actionButtons = section.actionButtons.filter((b) => b.actionName.startsWith('add'))
  }

  // Decrement the number of items to show if the last one is the filterIndicator
  if (numItemsToShow > 0 && itemsToShow[numItemsToShow - 1].itemType === 'filterIndicator') {
    numItemsToShow--
    // logDebug('Section', `Section ${section.ID} has only one item: ${itemsToShow[0].itemType}, so decrement numItemsToShow to ${String(numItemsToShow)}`)
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
    if (numItemsToShow !== 1) {
      descriptionToUse = descriptionToUse.replace('{s}', `s`)
    } else {
      descriptionToUse = descriptionToUse.replace('{s}', ``)
    }
  }

  return hideSection ? null : (
    <div className="section">
      <div className="sectionInfo">
        <TooltipOnKeyPress
          altKey={{ text: 'Open in Split View' }}
          metaKey={{ text: 'Open in Floating Window' }}
          label={`${section.name}_Open Note Link`}
          enabled={!reactSettings?.dialogData?.isOpen && Boolean(sectionFilename)}
        >
          <div className={`${section.sectionTitleClass} sectionName`} onClick={handleSectionClick} style={titleStyle}>
            <i className={`sectionIcon ${section.FAIconClass || ''}`}></i>
            {section.sectionCode === 'TAG' ? section.name.replace(/^[#@]/, '') : section.name}
            {sectionIsRefreshing ? <i className="fa fa-spinner fa-spin pad-left"></i> : null}
          </div>{' '}
        </TooltipOnKeyPress>
        <div className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></div>
        <div className="sectionButtons">
          {section.actionButtons?.map((item, index) => <CommandButton key={index} button={item} onClick={handleCommandButtonClick} />) ?? []}
          {numItemsToShow > 1 && itemsToShow[0].itemType !== 'itemCongrats' && section.sectionCode !== 'PROJ' && dashboardSettings.enableInteractiveProcessing && (
            <>
              <button className="PCButton tooltip" onClick={handleInteractiveProcessingClick} data-tooltip={`Interactively process ${numItemsToShow} ${section.name} items`}>
                {/* <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i> */}
                {/* wanted to use 'fa-arrow-progress' here but not in our build */}
                {/* <i className="fa-regular fa-layer-group fa-rotate-90"></i> */}
                <i className="fa-regular fa-angles-right"></i>
                <span className="interactiveProcessingNumber" style={{ fontWeight: 500, paddingLeft: '3px' }}>
                  {numItemsToShow}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
      <ItemGrid thisSection={section} items={itemsToShow} />
    </div>
  )
}

export default Section
