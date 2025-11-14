// @flow
//--------------------------------------------------------------------------
// OrderingPanel Component
// Allows users to visually reorder dashboard sections using drag-and-drop.
// Written 2025-11-12 for Dashboard v2.3.0.b14 by Cursor AI guided by @jgclark
// Last updated 2025-11-13 by @jgclark
//
// TODO: Needs making generic so it can be used in other plugins. Requires lots of changes here and in Dashboard's SettingsDialog. JGC had one go at it, but it got complicated quickly, so backed out.
//--------------------------------------------------------------------------

import React, { useState, useMemo } from 'react'
import { allSectionDetails } from '../../../jgclark.Dashboard/src/constants.js'
import type { TSection, TSectionCode, TDashboardSettings } from '../../../jgclark.Dashboard/src/types.js'
import './OrderingPanel.css'

type OrderingPanelProps = {
  sections: Array<TSection>,
  dashboardSettings: TDashboardSettings,
  defaultOrder: Array<TSectionCode>,
  onSave: (newOrder: ?Array<TSectionCode>) => void,
}

type DraggableSection = {
  sectionCode: TSectionCode,
  name: string,
  isVisible: boolean,
  isTag: boolean,
}

//--------------------------------------------------------------------------
// Component Definition
//--------------------------------------------------------------------------
const OrderingPanel = ({
  sections,
  dashboardSettings,
  defaultOrder,
  onSave,
}: OrderingPanelProps): React$Node => {

  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  // Removed sendActionToPlugin - parent component handles saving

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)

  // Build list of all possible sections (including hidden ones) for ordering
  const allSectionsForOrdering = useMemo(() => {
    const sectionMap = new Map<TSectionCode, TSection>()
    sections.forEach((section) => {
      sectionMap.set(section.sectionCode, section)
    })

    const result: Array<DraggableSection> = []
    const seenTags = new Set<TSectionCode>()

    // Get unique section codes from allSectionDetails, preserving order
    const allCodes = new Set<TSectionCode>()
    defaultOrder.forEach((code) => allCodes.add(code))
    sections.forEach((section) => allCodes.add(section.sectionCode))

    // Build the list, handling TAG sections specially and excluding SEARCH
    const processedCodes = new Set<TSectionCode>()
    defaultOrder.forEach((code) => {
      if (processedCodes.has(code)) return
      processedCodes.add(code)


      // Skip SEARCH section - it's always first and not in the ordering list
      if (code === 'SEARCH') {
        return
      }

      if (code === 'TAG') {
        // Add TAG as a single entry representing all TAG sections
        const tagSections = sections.filter((s) => s.sectionCode === 'TAG')
        if (tagSections.length > 0 || !sectionMap.has('TAG')) {
          result.push({
            sectionCode: 'TAG',
            name: 'Tag/Mention sections',
            isVisible: tagSections.some((s) => {
              const settingName = s.showSettingName
              // $FlowIgnore[invalid-computed-prop]
              return !settingName || dashboardSettings[settingName] !== false
            }),
            isTag: true,
          })
          seenTags.add('TAG')
        }
      } else {
        // Handle all other sections
        const section = sectionMap.get(code)
        const sectionDetail = allSectionDetails.find((sd) => sd.sectionCode === code)
        if (section || sectionDetail) {
          const settingName = section?.showSettingName || sectionDetail?.showSettingName || ''
          // $FlowIgnore[invalid-computed-prop]
          const isVisible = !settingName || dashboardSettings[settingName] !== false

          result.push({
            sectionCode: code,
            name: section?.name || sectionDetail?.sectionName || code,
            isVisible,
            isTag: false,
          })
        }
      }
    })

    // Add any sections that exist but aren't in default order (excluding SEARCH and TAG)
    sections.forEach((section) => {
      if (!processedCodes.has(section.sectionCode) && section.sectionCode !== 'TAG' && section.sectionCode !== 'SEARCH') {
        const settingName = section.showSettingName
        // $FlowIgnore[invalid-computed-prop]
        const isVisible = !settingName || dashboardSettings[settingName] !== false
        result.push({
          sectionCode: section.sectionCode,
          name: section.name,
          isVisible,
          isTag: false,
        })
      }
    })

    return result
  }, [sections, dashboardSettings, defaultOrder])

  // Initialize order state from custom order or default
  const [sectionOrder, setSectionOrder] = useState<Array<DraggableSection>>(() => {
    const customOrder = dashboardSettings?.customSectionDisplayOrder
    if (customOrder && customOrder.length > 0) {
      // Rebuild order from custom order (excluding SEARCH)
      const ordered: Array<DraggableSection> = []
      const processed = new Set<TSectionCode>()

      customOrder.forEach((code) => {
        if (processed.has(code)) return
        processed.add(code)

        // Skip SEARCH - it's always first and not in the ordering list
        if (code === 'SEARCH') {
          return
        }

        if (code === 'TAG') {
          const tagEntry = allSectionsForOrdering.find((s) => s.sectionCode === 'TAG')
          if (tagEntry) ordered.push(tagEntry)
        } else {
          const entry = allSectionsForOrdering.find((s) => s.sectionCode === code && !s.isTag)
          if (entry) ordered.push(entry)
        }
      })

      // Add any missing sections (excluding SEARCH)
      allSectionsForOrdering.forEach((section) => {
        if (!processed.has(section.sectionCode) && section.sectionCode !== 'SEARCH') {
          ordered.push(section)
        }
      })

      return ordered
    }
    return [...allSectionsForOrdering]
  })

  const [draggedIndex, setDraggedIndex] = useState<?number>(null)
  const [dragOverIndex, setDragOverIndex] = useState<?number>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleDragStart = (e: any, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
    // Create a custom drag image
    if (e.target && document.body) {
      const dragImage = e.target.cloneNode(true)
      if (dragImage instanceof HTMLElement) {
        dragImage.style.opacity = '0.5'
        // $FlowIgnore[incompatible-use]
        document.body.appendChild(dragImage)
        e.dataTransfer.setDragImage(dragImage, 0, 0)
        setTimeout(() => {
          if (document.body && dragImage.parentNode) {
            // $FlowIgnore[incompatible-use]
            document.body.removeChild(dragImage)
          }
        }, 0)
      }
    }
  }

  const handleDragOver = (e: any, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: any, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === undefined || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newOrder = [...sectionOrder]
    const draggedItem = newOrder[draggedIndex]
    if (draggedItem) {
      // Remove the dragged item first (this shifts all indices after draggedIndex down by 1)
      newOrder.splice(draggedIndex, 1)
      
      // Calculate insertion index after removal
      // When dragging up: line above item means "insert before this item"
      // When dragging down: line below item means "insert after this item"
      let insertIndex: number
      
      if (draggedIndex < dropIndex) {
        // Dragging down: 
        // - Before removal: item at dropIndex
        // - After removal: that item is now at (dropIndex - 1)
        // - To insert AFTER the item that was at dropIndex (now at dropIndex-1), we insert at dropIndex
        insertIndex = dropIndex
      } else {
        // Dragging up: the item at dropIndex hasn't shifted (we removed before it)
        // To insert before it, we insert at dropIndex
        insertIndex = dropIndex
      }
      
      // Insert at the calculated position
      newOrder.splice(insertIndex, 0, draggedItem)
    }

    setSectionOrder(newOrder)
    setChangesMade(true)
    
    // Notify parent of the change (extract section codes)
    const newOrderCodes: Array<TSectionCode> = newOrder.map((s) => s.sectionCode)
    onSave(newOrderCodes)
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleReset = () => {
    setSectionOrder([...allSectionsForOrdering])
    setChangesMade(true)
    
    // Notify parent of the reset (extract section codes)
    const newOrderCodes: Array<TSectionCode> = allSectionsForOrdering.map((s) => s.sectionCode)
    onSave(newOrderCodes)
  }


  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  return (
    <div className="ordering-panel-expanded">
      <div className="ordering-panel-header">
        {changesMade && (
          <span className="order-unsaved-indicator">* Unsaved changes</span>
        )}
        <div className="order-header-buttons">
          <button className="PCButton" onClick={handleReset} type="button">
            Reset to Default
          </button>
        </div>
      </div>
      <div className="ordering-panel-content">
        <p className="item-description">
          Drag sections to reorder them. Hidden sections are shown in gray but can still be reordered.
        </p>
        <div className="order-list">
          {sectionOrder.map((section, index) => {
            const isDragging = draggedIndex === index
            const isDragOver = dragOverIndex === index
            const isDisabled = !section.isVisible
            const showDropIndicator = isDragOver && draggedIndex !== null && draggedIndex !== index
            const isDraggingDown = draggedIndex !== null && draggedIndex < index

            return (
              <React.Fragment key={`${section.sectionCode}-${index}`}>
                {/* Show blue drop indicator line above the item when dragging up, below when dragging down */}
                {showDropIndicator && !isDraggingDown && (
                  <div className="order-drop-indicator" />
                )}
                <div
                  className={`order-item ${isDragging ? 'dragging' : ''} ${isDisabled ? 'disabled' : ''}`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="order-handle">
                    <i className="fa-solid fa-grip-vertical"></i>
                  </div>
                  <div className="order-content">
                    <span className="order-name">{section.name}</span>
                    {isDisabled && <span className="order-hidden">(hidden)</span>}
                  </div>
                </div>
                {/* Show blue drop indicator line below the item when dragging down */}
                {showDropIndicator && isDraggingDown && (
                  <div className="order-drop-indicator" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default OrderingPanel

