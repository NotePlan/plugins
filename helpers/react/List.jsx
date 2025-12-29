// @flow
/**
 * List Component
 * Core list rendering component that can work with different filter mechanisms
 * Supports two display styles: noteplan-sidebar and chips
 */

import React, { useRef, useEffect, useState, type Node } from 'react'
import { ModifierHints, type ModifierHint } from './ModifierHints.jsx'
import './List.css'

export type ListItemAction = {
  icon: string,
  onClick: (item: any, event: MouseEvent) => void,
  title?: string,
}

// Backward compatibility - CursorDecoration is now an alias for ModifierHint
export type CursorDecoration = ModifierHint

type Props = {
  items: Array<any>,
  displayType: 'noteplan-sidebar' | 'chips',
  renderItem: (item: any, index: number) => React$Node,
  onItemClick?: (item: any, event: MouseEvent) => void, // Called on mouse click or Enter key (actual selection/action)
  onItemSelect?: (item: any, index: number) => void, // Called when selectedIndex changes (for preview behavior, e.g. Forms)
  selectedIndex?: ?number,
  itemActions?: Array<ListItemAction>,
  emptyMessage?: string,
  loading?: boolean,
  className?: string,
  onKeyDown?: (event: KeyboardEvent) => void,
  listRef?: any, // ref to the list container
  // Cursor decoration for modifier keys
  optionKeyDecoration?: CursorDecoration, // Shown when Alt/Option key is pressed
  commandKeyDecoration?: CursorDecoration, // Shown when Cmd/Meta key is pressed
  // Whether to use cursor positioning for hints (default: false, uses decoration mode)
  useCursorPositioning?: boolean,
}

/**
 * List Component
 * @param {Props} props
 * @returns {React$Node}
 */
export function List({
  items,
  displayType,
  renderItem,
  onItemClick,
  onItemSelect,
  selectedIndex = null,
  itemActions = [],
  emptyMessage = 'No items found',
  loading = false,
  className = '',
  onKeyDown,
  listRef: externalListRef,
  optionKeyDecoration,
  commandKeyDecoration,
  useCursorPositioning = false,
}: Props): Node {
  const internalListRef = useRef<?HTMLDivElement>(null)
  const listRef = externalListRef || internalListRef
  const [hoveredIndex, setHoveredIndex] = useState<?number>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number, y: number } | null>(null)

  // Scroll selected item into view and call onItemSelect if provided
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement instanceof HTMLElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
      // Call onItemSelect for preview behavior (e.g. Forms preview)
      if (onItemSelect && selectedIndex < items.length) {
        const item = items[selectedIndex]
        if (item) {
          onItemSelect(item, selectedIndex)
        }
      }
    }
  }, [selectedIndex, listRef, onItemSelect, items])

  if (loading && items.length === 0) {
    return (
      <div className={`list-container list-loading ${className}`}>
        <div className="list-loading-message">Loading...</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`list-container list-empty ${className}`}>
        <div className="list-empty-message">{emptyMessage}</div>
      </div>
    )
  }

  const handleItemClick = (item: any, index: number, event: MouseEvent) => {
    if (onItemClick) {
      onItemClick(item, event)
    }
  }

  const handleActionClick = (action: ListItemAction, item: any, event: MouseEvent) => {
    event.stopPropagation()
    action.onClick(item, event)
  }

  return (
    <div
      ref={listRef}
      className={`list-container list-${displayType} ${className}`}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {items.map((item, index) => {
        const isSelected = selectedIndex === index
        const itemContent = renderItem(item, index)

        const isHovered = hoveredIndex === index

        return (
          <div
            key={index}
            data-index={index}
            className={`list-item list-item-${displayType} ${isSelected ? 'selected' : ''} ${isHovered && (optionKeyDecoration || commandKeyDecoration) ? 'list-item-with-decoration' : ''}`}
            onClick={(e) => handleItemClick(item, index, e)}
            onMouseEnter={(e) => {
              setHoveredIndex(index)
              setCursorPosition({ x: e.clientX, y: e.clientY })
            }}
            onMouseMove={(e) => {
              if (isHovered) {
                setCursorPosition({ x: e.clientX, y: e.clientY })
              }
            }}
            onMouseLeave={() => {
              setHoveredIndex(null)
              setCursorPosition(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleItemClick(item, index, e)
              }
            }}
            tabIndex={0}
            style={isHovered && (optionKeyDecoration || commandKeyDecoration) ? { cursor: 'pointer' } : undefined}
          >
            <div className="list-item-content">{itemContent}</div>
            {isHovered && (optionKeyDecoration || commandKeyDecoration) && (
              <ModifierHints
                optionHint={optionKeyDecoration}
                commandHint={commandKeyDecoration}
                displayMode={useCursorPositioning && cursorPosition ? 'cursor' : 'decoration'}
                show={true}
                position="right"
                cursorX={cursorPosition?.x}
                cursorY={cursorPosition?.y}
                cursorMargin={10}
              />
            )}
            {itemActions && itemActions.length > 0 && (
              <div className="list-item-actions" onClick={(e) => e.stopPropagation()}>
                {itemActions.map((action, actionIndex) => (
                  <button
                    key={actionIndex}
                    className="list-item-action-button"
                    onClick={(e) => handleActionClick(action, item, e)}
                    title={action.title || ''}
                    type="button"
                  >
                    <i className={`fa ${action.icon}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

