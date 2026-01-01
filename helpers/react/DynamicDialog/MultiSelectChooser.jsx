// @flow
//--------------------------------------------------------------------------
// MultiSelectChooser Component
// A scrollable list with checkboxes for multi-selection
// Similar to SearchableChooser but for multiple selections
//--------------------------------------------------------------------------

import React, { useState, useRef, useEffect } from 'react'
import './MultiSelectChooser.css'

export type MultiSelectConfig = {
  items: Array<any>,
  filterFn?: (item: any, searchTerm: string) => boolean,
  getItemLabel: (item: any) => string,
  getItemValue: (item: any) => string,
  getItemTitle?: (item: any) => string,
  getItemIcon?: (item: any) => ?string,
  getItemColor?: (item: any) => ?string,
  emptyMessageNoItems: string,
  emptyMessageNoMatch: string,
  classNamePrefix: string,
  fieldType: string,
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  debugLogging?: boolean,
}

export type MultiSelectChooserProps = {
  label?: string,
  value?: Array<string>, // Array of selected item values
  onChange: (selectedValues: Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  config: MultiSelectConfig,
}

/**
 * MultiSelectChooser Component
 * A scrollable list with checkboxes for multi-selection
 * @param {MultiSelectChooserProps} props
 * @returns {React$Node}
 */
export function MultiSelectChooser({
  label,
  value = [],
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search...',
  config,
}: MultiSelectChooserProps): React$Node {
  const {
    items,
    filterFn,
    getItemLabel,
    getItemValue,
    getItemTitle,
    getItemIcon,
    getItemColor,
    emptyMessageNoItems,
    emptyMessageNoMatch,
    classNamePrefix,
    fieldType,
    maxHeight = '200px',
    debugLogging = false,
  } = config

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedValues, setSelectedValues] = useState<Array<string>>(value || [])
  const containerRef = useRef<?HTMLDivElement>(null)
  const searchInputRef = useRef<?HTMLInputElement>(null)

  // Sync with external value prop
  useEffect(() => {
    if (value && Array.isArray(value)) {
      setSelectedValues(value)
    }
  }, [value])

  // Filter items based on search term
  const filteredItems = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return items
    }
    if (filterFn) {
      return items.filter((item) => filterFn(item, searchTerm))
    }
    // Default filter: search in label
    const term = searchTerm.toLowerCase()
    return items.filter((item) => {
      const label = getItemLabel(item).toLowerCase()
      return label.includes(term)
    })
  }, [items, searchTerm, filterFn, getItemLabel])

  // Handle checkbox toggle
  const handleToggle = (itemValue: string) => {
    if (disabled) return

    const newSelected = selectedValues.includes(itemValue)
      ? selectedValues.filter((v) => v !== itemValue)
      : [...selectedValues, itemValue]

    setSelectedValues(newSelected)
    onChange(newSelected)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (disabled) return
    const allValues = filteredItems.map((item) => getItemValue(item))
    setSelectedValues(allValues)
    onChange(allValues)
  }

  // Handle deselect all
  const handleDeselectAll = () => {
    if (disabled) return
    setSelectedValues([])
    onChange([])
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  const selectedCount = selectedValues.length
  const filteredCount = filteredItems.length
  const allSelected = filteredCount > 0 && filteredItems.every((item) => selectedValues.includes(getItemValue(item)))

  return (
    <div className={`multi-select-chooser-base ${classNamePrefix}-container ${compactDisplay ? 'compact' : ''}`} ref={containerRef} data-field-type={fieldType}>
      {label && !compactDisplay && (
        <label className={`${classNamePrefix}-label`} htmlFor={`${classNamePrefix}-search`}>
          {label}
        </label>
      )}
      <div className={`${classNamePrefix}-wrapper`}>
        {/* Search input */}
        <div className={`${classNamePrefix}-search-wrapper`}>
          <input
            id={`${classNamePrefix}-search`}
            ref={searchInputRef}
            type="text"
            className={`${classNamePrefix}-search-input`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          {searchTerm && (
            <button
              type="button"
              className={`${classNamePrefix}-clear-search`}
              onClick={handleClearSearch}
              disabled={disabled}
              title="Clear search"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          )}
        </div>

        {/* Selection summary */}
        {selectedCount > 0 && (
          <div className={`${classNamePrefix}-selection-summary`}>
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            <button
              type="button"
              className={`${classNamePrefix}-deselect-all`}
              onClick={handleDeselectAll}
              disabled={disabled}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Scrollable list */}
        <div className={`${classNamePrefix}-list-container`} style={{ maxHeight }}>
          {filteredItems.length === 0 ? (
            <div className={`${classNamePrefix}-empty`}>
              {items.length === 0 ? emptyMessageNoItems : `${emptyMessageNoMatch} "${searchTerm}"`}
            </div>
          ) : (
            <>
              {/* Select all / Deselect all controls */}
              {filteredCount > 1 && (
                <div className={`${classNamePrefix}-select-all-controls`}>
                  <button
                    type="button"
                    className={`${classNamePrefix}-select-all-btn`}
                    onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    disabled={disabled}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
              )}

              {/* Items list */}
              <div className={`${classNamePrefix}-list`}>
                {filteredItems.map((item, index) => {
                  const itemValue = getItemValue(item)
                  const itemLabel = getItemLabel(item)
                  const itemTitle = getItemTitle ? getItemTitle(item) : itemLabel
                  const itemIcon = getItemIcon ? getItemIcon(item) : null
                  const itemColor = getItemColor ? getItemColor(item) : null
                  const isChecked = selectedValues.includes(itemValue)

                  return (
                    <div
                      key={`${fieldType}-${index}-${itemValue}`}
                      className={`${classNamePrefix}-item ${isChecked ? 'checked' : ''}`}
                      onClick={() => handleToggle(itemValue)}
                      title={itemTitle}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(itemValue)}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        className={`${classNamePrefix}-checkbox`}
                      />
                      {itemIcon && (
                        <i
                          className={`fa-solid fa-${itemIcon}`}
                          style={{
                            marginRight: '0.5rem',
                            color: itemColor ? `var(--${itemColor}-500, inherit)` : undefined,
                          }}
                        />
                      )}
                      <span className={`${classNamePrefix}-item-label`}>{itemLabel}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MultiSelectChooser



