// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard component.
// Last updated 2024-05-28 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import useInteractiveProcessing from '../customHooks/useInteractiveProcessing.jsx'
import CommandButton from './CommandButton.jsx'
import ItemGrid from './ItemGrid.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, logError, JSP } from '@helpers/react/reactDev'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type SectionProps = {
  section: TSection
}

//--------------------------------------------------------------------------
// Section Component Definition
//--------------------------------------------------------------------------
const Section = ({ section }: SectionProps): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { sharedSettings, reactSettings, setReactSettings, pluginData, sendActionToPlugin } = useAppContext()

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [itemsCopy, setItemsCopy] = useState < Array < TSectionItem >> ([])
  const [items, setItems] = useState < Array < TSectionItem >> ([])

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  useEffect(() => {
    if (!section) {
      logError('Section', `❓Section doesn't exist. ${JSP(section)}`)
      return
    }

    if (sharedSettings && section.showSettingName && sharedSettings[section.showSettingName] === false) {
      logDebug('Section', `Section: ${section.ID} ("${section.name}") is currently filtered out sharedSettings?.[section.showSettingName]=${sharedSettings?.[section.showSettingName]}`)
      return
    }

    let sectionItems = section.sectionItems
    if (!sectionItems || sectionItems.length === 0) {
      if (section.ID !== 0) {
        logDebug('Section', `Section: ${section.ID} / ${section.sectionCode} doesn't have any sectionItems, so not displaying.`)
        sectionItems = []
      } else {
        logDebug('Section', `Section 0 doesn't have any sectionItems, so display congrats message`)
        sectionItems = [{
          ID: '0-Congrats',
          itemType: 'congrats',
        }]
      }
    }

    setItems(sectionItems)
  }, [section, sharedSettings])

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  useInteractiveProcessing(items, section, itemsCopy, setItemsCopy, reactSettings, setReactSettings, sendActionToPlugin)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleInteractiveProcessingClick = (e: MouseEvent): void => {
    logDebug(`Section`, `handleInteractiveProcessingClick x,y=(${e.clientX}, ${e.clientY})`)
    const clickPosition = { clientY: e.clientY, clientX: e.clientX + 200 }
    setReactSettings(prevSettings => ({
      ...prevSettings,
      lastChange: `_InteractiveProcessing Click`,
      interactiveProcessing: { sectionName: section.name, currentIPIndex: 0, totalTasks: itemsToShow.length, clickPosition, startingUp: true },
      dialogData: { isOpen: false, isTask: true, details: {}, clickPosition }
    }))
  }

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  const buttons = section.actionButtons?.map((item, index) => <CommandButton key={index} button={item} />) ?? []

  const { FFlag_InteractiveProcessing } = sharedSettings

  const filterPriorityItems = sharedSettings?.filterPriorityItems ?? false
  let maxPrioritySeen = 0
  for (const i of items) {
    if (i.para?.priority && i.para.priority > maxPrioritySeen) {
      maxPrioritySeen = i.para.priority
    }
  }

  const filteredItems = filterPriorityItems ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen) : items.slice()
  const priorityFilteringHappening = items.length > filteredItems.length

  filteredItems.sort((a, b) => {
    if (a.para?.startTime && b.para?.startTime) {
      const startTimeComparison = a.para.startTime.localeCompare(b.para.startTime)
      if (startTimeComparison !== 0) return startTimeComparison
    } else if (a.para?.startTime) {
      return -1
    } else if (b.para?.startTime) {
      return 1
    }

    if (a.para?.endTime && b.para?.endTime) {
      const endTimeComparison = a.para.endTime.localeCompare(b.para.endTime)
      if (endTimeComparison !== 0) return endTimeComparison
    } else if (a.para?.endTime) {
      return -1
    } else if (b.para?.endTime) {
      return 1
    }

    const priorityA = a.para?.priority ?? 0
    const priorityB = b.para?.priority ?? 0
    if (priorityA !== priorityB) {
      return priorityB - priorityA
    }

    const titleA = a.para?.title?.toLowerCase() ?? ''
    const titleB = b.para?.title?.toLowerCase() ?? ''
    return titleA.localeCompare(titleB)
  })

  const limit = 20
  const itemsToShow = filteredItems.slice(0, limit)

  const filteredOut = section.totalCount ? section.totalCount - itemsToShow.length : items.length - itemsToShow.length
  const limitApplied = (section.totalCount ?? 0) > itemsToShow.length

  if (filteredOut > 0) {
    itemsToShow.push({
      ID: `${section.ID}-Filter`,
      itemType: 'filterIndicator',
      para: {
        content: `There are also ${filteredOut} ${priorityFilteringHappening ? 'lower-priority' : ''} items currently hidden`,
        filename: '',
        type: 'text',
        noteType: 'Notes',
        rawContent: '',
        priority: -1,
      },
    })
  }

  let descriptionToUse = section.description
  if (descriptionToUse.includes('{count}')) {
    if (limitApplied) {
      descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'>first ${String(itemsToShow.length)}</span>`)
    } else {
      descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'>${String(itemsToShow.length)}</span>`)
    }
  }
  if (descriptionToUse.includes('{totalCount}')) {
    descriptionToUse = descriptionToUse.replace('{totalCount}', `<span id='section${section.ID}TotalCount'}>${String(filteredOut)}</span>`)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  const hideSection = !items.length || (sharedSettings && sharedSettings[`${section.showSettingName}`] === false)
  const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)

  return hideSection ? null : (
    <div className="section">
      <div className="sectionInfo">
        <div className={`${section.sectionTitleClass} sectionName`}>
          <i className={`sectionIcon ${section.FAIconClass || ''}`}></i>
          {section.sectionCode === 'TAG' ? section.name.replace(/^[#@]/, '') : section.name}
          {sectionIsRefreshing ? <i className="fa fa-spinner fa-spin"></i> : null}
        </div>{' '}
        <div className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></div>
        <div className="sectionButtons">
          {buttons}
          {section.sectionItems.length && section.sectionCode !== "PROJ" && FFlag_InteractiveProcessing && (
            <><button className="PCButton" onClick={handleInteractiveProcessingClick} title="Interactively process tasks one at a time">
              <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i>
              <span className="fa-layers-text" data-fa-transform="shrink-8" style={{ fontWeight: 500, paddingLeft: "3px" }}>{itemsToShow.length}</span>
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
