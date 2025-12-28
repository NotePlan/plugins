// @flow
/**
 * FilterableList Component
 * Wrapper component that adds filtering capability to List
 * Can be used with custom filter mechanisms by providing renderFilter prop
 */

import React, { useState, useMemo, type Node } from 'react'
import { List, type ListItemAction } from './List.jsx'
import './FilterableList.css'

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
  listRef?: any,
  // Filter props
  filterText: string,
  onFilterChange: (text: string) => void,
  filterPlaceholder?: string,
  renderFilter?: () => React$Node,
  onFilterKeyDown?: (event: any) => void, // SyntheticKeyboardEvent<HTMLInputElement>
  // Filter function - defaults to case-insensitive search on item label
  filterFunction?: (item: any, filterText: string) => boolean,
  getItemLabel?: (item: any) => string, // Used by default filter function
}

/**
 * FilterableList Component
 * @param {Props} props
 * @returns {React$Node}
 */
export function FilterableList({
  items,
  displayType,
  renderItem,
  onItemClick,
  onItemSelect,
  selectedIndex,
  itemActions,
  emptyMessage = 'No items found',
  loading = false,
  className = '',
  onKeyDown,
  listRef,
  filterText,
  onFilterChange,
  filterPlaceholder = 'Filter...',
  renderFilter,
  onFilterKeyDown,
  filterFunction,
  getItemLabel,
}: Props): Node {
  // Default filter function - case-insensitive search on label
  const defaultFilterFunction = (item: any, text: string): boolean => {
    if (!text) return true
    const label = getItemLabel ? getItemLabel(item) : String(item.label || item.title || item.name || '')
    return label.toLowerCase().includes(text.toLowerCase())
  }

  const filterFn = filterFunction || defaultFilterFunction

  // Filter items based on filterText
  const filteredItems = useMemo(() => {
    if (!filterText) return items
    return items.filter((item) => filterFn(item, filterText))
  }, [items, filterText, filterFn])

  // Reset selected index when filter changes
  const handleFilterChange = (text: string) => {
    onFilterChange(text)
    // Reset selection when filter changes
    if (onItemClick && selectedIndex !== null && selectedIndex !== undefined) {
      // The parent should handle resetting selectedIndex
    }
  }

  const handleFilterKeyDown = (e: any) => { // SyntheticKeyboardEvent<HTMLInputElement>
    // If custom handler provided, use it
    if (onFilterKeyDown) {
      onFilterKeyDown(e)
      return
    }
    // Default behavior: Allow arrow keys to navigate list when filter input is focused
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (onKeyDown) {
        onKeyDown(e.nativeEvent)
      }
    }
  }

  return (
    <div className={`filterable-list-container ${className}`}>
      {renderFilter ? (
        renderFilter()
      ) : (
        <div className="filterable-list-filter-row">
          <input
            type="text"
            className="filterable-list-filter-input"
            placeholder={filterPlaceholder}
            value={filterText}
            onChange={(e) => handleFilterChange(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            autoFocus
          />
        </div>
      )}
      <List
        items={filteredItems}
        displayType={displayType}
        renderItem={renderItem}
        onItemClick={onItemClick}
        onItemSelect={onItemSelect}
        selectedIndex={selectedIndex}
        itemActions={itemActions}
        emptyMessage={filterText ? 'No items match your filter' : emptyMessage}
        loading={loading}
        onKeyDown={onKeyDown}
        listRef={listRef}
      />
    </div>
  )
}

