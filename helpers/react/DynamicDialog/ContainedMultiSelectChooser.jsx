// @flow
//--------------------------------------------------------------------------
// ContainedMultiSelectChooser Component
// A contained multi-select chooser with border, header row (label/filter/clear/select-all/select-none), and scrollable list
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './ContainedMultiSelectChooser.css'

export type ContainedMultiSelectChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "item1,item2" or array ["item1", "item2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  items: Array<string>, // Array of item strings (without prefix)
  getItemDisplayLabel: (item: string) => string, // Function to format item for display (e.g., add # or @ prefix)
  returnAsArray?: boolean, // If true, return as array, otherwise return as comma-separated string (default: false)
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include items
  excludePattern?: string, // Regex pattern to exclude items
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  emptyMessageNoItems?: string,
  emptyMessageNoMatch?: string,
  fieldType?: string, // Field type identifier for CSS classes
  allowCreate?: boolean, // If true, show "+New" button to create new items (default: true)
  onCreate?: (newItem: string) => Promise<void> | void, // Callback when creating a new item
}

/**
 * ContainedMultiSelectChooser Component
 * A contained multi-select chooser with border, header row, and scrollable list
 * @param {ContainedMultiSelectChooserProps} props
 * @returns {React$Node}
 */
export function ContainedMultiSelectChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search...',
  items,
  getItemDisplayLabel,
  returnAsArray = false,
  defaultChecked = false,
  includePattern = '',
  excludePattern = '',
  maxHeight = '200px',
  emptyMessageNoItems = 'No items available',
  emptyMessageNoMatch = 'No items match',
  fieldType = 'contained-multi-select',
  allowCreate = true,
  onCreate,
}: ContainedMultiSelectChooserProps): React$Node {
  const searchInputRef = useRef<?HTMLInputElement>(null)
  const [showCreateMode, setShowCreateMode] = useState<boolean>(false)
  const [createValue, setCreateValue] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  // Filter items based on include/exclude patterns
  const filteredItems = useMemo(() => {
    let filtered = [...items]

    // Apply include pattern if provided
    if (includePattern) {
      try {
        const includeRegex = new RegExp(includePattern)
        filtered = filtered.filter((item: string) => includeRegex.test(item))
      } catch (error) {
        console.error('Invalid includePattern regex:', error)
      }
    }

    // Apply exclude pattern if provided
    if (excludePattern) {
      try {
        const excludeRegex = new RegExp(excludePattern)
        filtered = filtered.filter((item: string) => !excludeRegex.test(item))
      } catch (error) {
        console.error('Invalid excludePattern regex:', error)
      }
    }

    return filtered
  }, [items, includePattern, excludePattern])

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedValues, setSelectedValues] = useState<Array<string>>([])
  const defaultInitializedRef = useRef<boolean>(false)
  const lastSyncedValueRef = useRef<string | Array<string> | null>(null)

  // Initialize from defaultChecked when items first load (only once, when filteredItems becomes available)
  useEffect(() => {
    if (!defaultInitializedRef.current && defaultChecked && (!value || value === '' || (Array.isArray(value) && value.length === 0)) && filteredItems.length > 0) {
      setSelectedValues(filteredItems)
      defaultInitializedRef.current = true
      // Format and store the value we just set
      const formattedItems = filteredItems.map((item: string) => getItemDisplayLabel(item))
      const newValue: string | Array<string> = returnAsArray ? formattedItems : formattedItems.join(',')
      lastSyncedValueRef.current = newValue
      // Call onChange to notify parent component of the initial value
      onChange(newValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length, defaultChecked, value, returnAsArray]) // Only check filteredItems.length, not filteredItems itself. onChange/getItemDisplayLabel are stable or handled elsewhere

  // Parse value prop to get selected values and sync selectedValues
  // Only sync from value prop if it's different from what we last synced (to avoid loops)
  useEffect(() => {
    // Skip if this is the same value we last synced (prevents infinite loops)
    if (lastSyncedValueRef.current === value) {
      return
    }

    // Skip if value is empty and we've already initialized from defaultChecked
    if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
      if (!defaultInitializedRef.current && !defaultChecked) {
        setSelectedValues([])
        defaultInitializedRef.current = true
        lastSyncedValueRef.current = returnAsArray ? [] : ''
      }
      return
    }

    // Value exists - parse it and sync selectedValues
    defaultInitializedRef.current = true // Mark as initialized when value is provided
    let parsed: Array<string>
    if (Array.isArray(value)) {
      // If array, extract item names (remove ALL prefixes if present) and remove duplicates
      const cleaned = value.map((v: string) => {
        let item = v
        while (item.startsWith('#') || item.startsWith('@')) {
          item = item.substring(1)
        }
        return item
      })
      // Remove duplicates
      parsed = Array.from(new Set(cleaned))
    } else {
      // If string, split by comma and extract item names
      const itemList = value.split(',').map((item: string) => item.trim()).filter(Boolean)
      const cleaned = itemList.map((item: string) => {
        let cleanedItem = item
        while (cleanedItem.startsWith('#') || cleanedItem.startsWith('@')) {
          cleanedItem = cleanedItem.substring(1)
        }
        return cleanedItem
      })
      // Remove duplicates
      parsed = Array.from(new Set(cleaned))
    }
    setSelectedValues(parsed)
    // Update ref to track what we synced
    lastSyncedValueRef.current = value
  }, [value, defaultChecked, returnAsArray]) // Only sync from value prop to prevent resetting selections

  // Filter items based on search term
  const displayItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return filteredItems
    }
    const term = searchTerm.toLowerCase()
    return filteredItems.filter((item: string) => item.toLowerCase().includes(term))
  }, [filteredItems, searchTerm])

  // Show create mode automatically when search has no matches and allowCreate is true
  useEffect(() => {
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Effect triggered: searchTerm="${searchTerm}", displayItems.length=${displayItems.length}, filteredItems.length=${filteredItems.length}, showCreateMode=${String(showCreateMode)}`)
    
    if (allowCreate && searchTerm.trim() && displayItems.length === 0 && filteredItems.length > 0) {
      // No matches found for the search term, show create mode with the search term pre-filled
      if (!showCreateMode) {
        logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Auto-showing create mode with searchTerm="${searchTerm.trim()}"`)
        setShowCreateMode(true)
        setCreateValue(searchTerm.trim())
      }
    } else if (displayItems.length > 0 && showCreateMode) {
      // Matches found, hide create mode
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Hiding create mode - matches found (displayItems.length=${displayItems.length})`)
      setShowCreateMode(false)
      setCreateValue('')
    }
  }, [displayItems.length, searchTerm, filteredItems.length, allowCreate, showCreateMode])

  // Handle checkbox toggle
  const handleToggle = (itemName: string) => {
    if (disabled) return

    // Remove duplicates and toggle the item
    const currentSelected = Array.from(new Set(selectedValues))
    const newSelected = currentSelected.includes(itemName)
      ? currentSelected.filter((v: string) => v !== itemName)
      : [...currentSelected, itemName]

    setSelectedValues(newSelected)
    // Format items using getItemDisplayLabel and return (already unique)
    const formattedItems = newSelected.map((item: string) => getItemDisplayLabel(item))
    const newValue = returnAsArray ? formattedItems : formattedItems.join(',')
    // Update ref before calling onChange to prevent re-sync
    lastSyncedValueRef.current = newValue
    onChange(newValue)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (disabled) return
    // Get unique items from displayItems (remove duplicates)
    const allValues = Array.from(new Set(displayItems))
    setSelectedValues(allValues)
    const formattedItems = allValues.map((item: string) => getItemDisplayLabel(item))
    const newValue = returnAsArray ? formattedItems : formattedItems.join(',')
    // Update ref before calling onChange to prevent re-sync
    lastSyncedValueRef.current = newValue
    onChange(newValue)
  }

  // Handle select none
  const handleSelectNone = () => {
    if (disabled) return
    setSelectedValues([])
    if (returnAsArray) {
      const newValue: Array<string> = []
      lastSyncedValueRef.current = newValue
      onChange(newValue)
    } else {
      const newValue: string = ''
      lastSyncedValueRef.current = newValue
      onChange(newValue)
    }
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('')
    setShowCreateMode(false)
    setCreateValue('')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  // Handle new button click
  const handleNewClick = () => {
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleNewClick called: disabled=${String(disabled)}, allowCreate=${String(allowCreate)}`)
    if (disabled || !allowCreate) {
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleNewClick blocked: disabled=${String(disabled)}, allowCreate=${String(allowCreate)}`)
      return
    }
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Setting showCreateMode=true, createValue="${searchTerm.trim()}"`)
    setShowCreateMode(true)
    setCreateValue(searchTerm.trim())
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  // Handle create confirmation
  const handleCreateConfirm = async () => {
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleCreateConfirm called: disabled=${String(disabled)}, allowCreate=${String(allowCreate)}, onCreate=${String(!!onCreate)}, createValue="${createValue}"`)
    
    if (disabled || !allowCreate || !onCreate || !createValue.trim()) {
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleCreateConfirm blocked: disabled=${String(disabled)}, allowCreate=${String(allowCreate)}, onCreate=${String(!!onCreate)}, createValue.trim()="${createValue.trim()}"`)
      return
    }

    const trimmedValue = createValue.trim()
    if (!trimmedValue) {
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleCreateConfirm: trimmedValue is empty`)
      return
    }

    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Starting create process for "${trimmedValue}"`)
    setIsCreating(true)
    try {
      // Call onCreate callback (e.g., to create tag/mention in plugin)
      if (onCreate) {
        logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Calling onCreate("${trimmedValue}")`)
        await onCreate(trimmedValue)
        logDebug('ContainedMultiSelectChooser', `[CREATE MODE] onCreate completed`)
      }

      // After creating, add it to selected values and update onChange
      const newSelected = Array.from(new Set([...selectedValues, trimmedValue]))
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Adding "${trimmedValue}" to selectedValues: ${newSelected.join(', ')}`)
      setSelectedValues(newSelected)

      // Format and update value via onChange
      const formattedItems = newSelected.map((item: string) => getItemDisplayLabel(item))
      const newValue: string | Array<string> = returnAsArray ? formattedItems : formattedItems.join(',')
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Calling onChange with: ${typeof newValue === 'string' ? newValue : newValue.join(',')}`)

      lastSyncedValueRef.current = newValue
      onChange(newValue)

      // Reset create mode but keep the search term so the newly created item is visible and checked
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Resetting create mode, keeping search term="${trimmedValue}"`)
      setShowCreateMode(false)
      setCreateValue('')
      // Keep the search term set to the newly created item so it appears in the filtered list
      setSearchTerm(trimmedValue)
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      }
    } catch (error) {
      logError('ContainedMultiSelectChooser', `[CREATE MODE] Error creating new item: ${error.message}`)
      console.error('Error creating new item:', error)
    } finally {
      setIsCreating(false)
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Create process completed, isCreating=false`)
    }
  }

  // Handle cancel create
  const handleCreateCancel = () => {
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleCreateCancel called, resetting create mode`)
    setShowCreateMode(false)
    setCreateValue('')
    setSearchTerm('')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  return (
    <div className={`contained-multi-select-container ${compactDisplay ? 'compact' : ''}`} data-field-type={fieldType}>
      {label && !compactDisplay && (
        <label className="contained-multi-select-label" htmlFor={`${fieldType}-search`}>
          {label}
        </label>
      )}
      <div className="contained-multi-select-box">
        {/* Top row: Label (compact), Filter, Clear, Select All, Select None */}
        <div className="contained-multi-select-header">
          {label && compactDisplay && (
            <label className="contained-multi-select-label-compact" htmlFor={`${fieldType}-search`}>
              {label}
            </label>
          )}
          <div className="contained-multi-select-search-wrapper">
            <input
              id={`${fieldType}-search`}
              ref={searchInputRef}
              type="text"
              className={`contained-multi-select-search-input ${showCreateMode ? 'create-mode' : ''}`}
              value={showCreateMode ? createValue : searchTerm}
              onChange={(e) => {
                let inputValue = e.target.value
                // Validate: remove spaces for tag-chooser and mention-chooser when in create mode
                // This handles pasted text or other ways spaces might get in
                if (showCreateMode && (fieldType === 'tag-chooser' || fieldType === 'mention-chooser')) {
                  // Remove all spaces from the input
                  inputValue = inputValue.replace(/\s/g, '')
                }
                logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Input onChange: showCreateMode=${String(showCreateMode)}, value="${inputValue}"`)
                if (showCreateMode) {
                  setCreateValue(inputValue)
                } else {
                  setSearchTerm(inputValue)
                }
              }}
              onKeyDown={(e) => {
                // Prevent space key for tag-chooser and mention-chooser when in create mode
                if (showCreateMode && (fieldType === 'tag-chooser' || fieldType === 'mention-chooser') && e.key === ' ') {
                  e.preventDefault()
                }
              }}
              placeholder={showCreateMode ? (fieldType === 'tag-chooser' ? 'Enter new hashtag...' : fieldType === 'mention-chooser' ? 'Enter new mention...' : 'Enter new item...') : placeholder}
              disabled={disabled || isCreating}
            />
            {searchTerm && !showCreateMode && (
              <button
                type="button"
                className="contained-multi-select-clear-search"
                onClick={handleClearSearch}
                disabled={disabled}
                title="Clear search"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            )}
            {showCreateMode && (
              <div className="contained-multi-select-create-actions">
                <button
                  type="button"
                  className="contained-multi-select-create-confirm-btn"
                  onClick={handleCreateConfirm}
                  disabled={disabled || isCreating || !createValue.trim()}
                  title="Create new item"
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="contained-multi-select-create-cancel-btn"
                  onClick={handleCreateCancel}
                  disabled={disabled || isCreating}
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          {allowCreate && (
            <button
              type="button"
              className="contained-multi-select-new-btn"
              onClick={handleNewClick}
              disabled={disabled || showCreateMode}
              title="Create new item"
            >
              +New
            </button>
          )}
          <button
            type="button"
            className="contained-multi-select-select-all-btn"
            onClick={handleSelectAll}
            disabled={disabled || displayItems.length === 0 || showCreateMode}
            title="Select all"
          >
            Select All
          </button>
          <button
            type="button"
            className="contained-multi-select-select-none-btn"
            onClick={handleSelectNone}
            disabled={disabled || selectedValues.length === 0}
            title="Select none"
          >
            Select None
          </button>
        </div>

        {/* Scrollable list with checkboxes */}
        <div className="contained-multi-select-list-container" style={{ maxHeight }}>
          {displayItems.length === 0 ? (
            <div className="contained-multi-select-empty">
              {filteredItems.length === 0 ? emptyMessageNoItems : `${emptyMessageNoMatch} "${searchTerm}"`}
            </div>
          ) : (
            <div className="contained-multi-select-list">
              {displayItems.map((item: string, index: number) => {
                const isChecked = selectedValues.includes(item)
                const displayLabel = getItemDisplayLabel(item)
                return (
                  <div
                    key={`${fieldType}-${index}-${item}`}
                    className={`contained-multi-select-item ${isChecked ? 'checked' : ''}`}
                    onClick={() => handleToggle(item)}
                    title={displayLabel}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(item)}
                      disabled={disabled}
                      onClick={(e) => e.stopPropagation()}
                      className="contained-multi-select-checkbox"
                    />
                    <span className="contained-multi-select-item-label">{displayLabel}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContainedMultiSelectChooser

