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
  maxRows?: number, // Max number of result rows to show (overrides maxHeight if provided, assumes ~40px per row)
  width?: string, // Custom width for the entire control (e.g., '300px', '80%'). Overrides default width.
  height?: string, // Custom height for the entire control (e.g., '400px'). Overrides maxHeight.
  emptyMessageNoItems?: string,
  emptyMessageNoMatch?: string,
  fieldType?: string, // Field type identifier for CSS classes
  allowCreate?: boolean, // If true, show "+New" button to create new items (default: true)
  onCreate?: (newItem: string) => Promise<void> | void, // Callback when creating a new item
  singleValue?: boolean, // If true, allow selecting only one value (no checkboxes, returns single value) (default: false)
  renderAsDropdown?: boolean, // If true and singleValue is true, render as dropdown-select instead of filterable chooser (default: false)
  fieldKey?: string, // Unique key for this field instance (used to generate unique input id)
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
  maxRows,
  width,
  height,
  emptyMessageNoItems = 'No items available',
  emptyMessageNoMatch = 'No items match',
  fieldType = 'contained-multi-select',
  allowCreate = true,
  onCreate,
  singleValue = false,
  renderAsDropdown = false,
  fieldKey,
}: ContainedMultiSelectChooserProps): React$Node {
  const searchInputRef = useRef<?HTMLInputElement>(null)
  const [showCreateMode, setShowCreateMode] = useState<boolean>(false)
  const [createValue, setCreateValue] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [showList, setShowList] = useState<boolean>(true) // For single-value mode: show list or show selected value
  const [showCheckedOnly, setShowCheckedOnly] = useState<boolean>(false) // Toggle to show only checked items
  
  // Generate unique input id - use fieldKey if provided, otherwise fallback to fieldType with random suffix
  const inputId = fieldKey ? `${fieldType}-${fieldKey}-search` : `${fieldType}-search-${Math.random().toString(36).substr(2, 9)}`

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
      // Filter out "is:checked" to prevent it from being saved as a value
      const filtered = filteredItems.filter((item: string) => item.toLowerCase() !== 'is:checked')
      setSelectedValues(filtered)
      defaultInitializedRef.current = true
      // Format and store the value we just set
      const formattedItems = filtered.map((item: string) => getItemDisplayLabel(item))
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
    if (singleValue) {
      // Single-value mode: value is a single string (with or without prefix)
      if (Array.isArray(value)) {
        // If array, take first item
        let item = value[0] || ''
        while (item.startsWith('#') || item.startsWith('@')) {
          item = item.substring(1)
        }
        parsed = item ? [item] : []
      } else {
        // If string, extract item name (remove ALL prefixes if present)
        // For single value, don't split by comma - treat entire string as one value
        let item = value.trim()
        while (item.startsWith('#') || item.startsWith('@')) {
          item = item.substring(1)
        }
        parsed = item ? [item] : []
      }
    } else {
      // Multi-select mode: parse as before
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
    }
    // Filter out "is:checked" to prevent it from being saved as a value
    parsed = parsed.filter((item: string) => item.toLowerCase() !== 'is:checked')
    setSelectedValues(parsed)
    // Update ref to track what we synced
    lastSyncedValueRef.current = value
  }, [value, defaultChecked, returnAsArray, singleValue]) // Only sync from value prop to prevent resetting selections

  // Calculate effective maxHeight: height prop > maxRows > maxHeight
  const effectiveMaxHeight = useMemo(() => {
    if (height) {
      return height
    }
    if (maxRows && maxRows > 0) {
      // Assume ~40px per row (including padding and border)
      return `${maxRows * 40}px`
    }
    return maxHeight
  }, [height, maxRows, maxHeight])

  // Filter items based on search term and checked filter
  // Also include selected items that aren't in filteredItems yet (e.g., newly created items)
  // Always filter out "is:checked" to prevent it from being displayed or saved
  const displayItems = useMemo(() => {
    const filterOutIsChecked = (items: Array<string>) => items.filter((item: string) => item.toLowerCase() !== 'is:checked')
    
    // If checked filter is active, show only checked items
    if (showCheckedOnly) {
      return filterOutIsChecked(selectedValues)
    }
    
    // Normal filtering based on search term
    if (!searchTerm.trim()) {
      // No search term: show all filtered items plus any selected items not yet in the list
      const selectedNotInList = selectedValues.filter((selected: string) => !filteredItems.includes(selected))
      return filterOutIsChecked([...filteredItems, ...selectedNotInList])
    }
    
    const term = searchTerm.toLowerCase()
    // Check if search term is "is:checked" to show only checked items
    if (term === 'is:checked') {
      // Show only checked items
      return filterOutIsChecked(selectedValues)
    }
    
    // Regular search filtering
    const filtered = filteredItems.filter((item: string) => item.toLowerCase().includes(term))
    // Also include selected items that match the search term but aren't in filteredItems yet
    const selectedMatching = selectedValues.filter(
      (selected: string) => 
        !filteredItems.includes(selected) && 
        selected.toLowerCase().includes(term)
    )
    return filterOutIsChecked([...filtered, ...selectedMatching])
  }, [filteredItems, searchTerm, selectedValues, showCheckedOnly])

  // For single-value mode: determine if we should show the list or the selected value
  const hasSelectedValue = singleValue && selectedValues.length > 0
  const selectedDisplayValue = hasSelectedValue ? getItemDisplayLabel(selectedValues[0]) : ''

  // When a single value is selected, hide the list and show the selected value
  useEffect(() => {
    if (singleValue && selectedValues.length > 0) {
      setShowList(false)
      setSearchTerm('')
    } else if (singleValue && selectedValues.length === 0) {
      setShowList(true)
    }
  }, [singleValue, selectedValues.length])

  // Show create mode automatically when search has no matches and allowCreate is true
  // Skip create mode when "is:checked" filter is active
  useEffect(() => {
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Effect triggered: searchTerm="${searchTerm}", displayItems.length=${displayItems.length}, filteredItems.length=${filteredItems.length}, items.length=${items.length}, showCreateMode=${String(showCreateMode)}, showCheckedOnly=${String(showCheckedOnly)}`)
    
    // Allow create mode when:
    // 1. allowCreate is true
    // 2. There's a search term (not empty)
    // 3. Search term is not "is:checked"
    // 4. "is:checked" filter is not active
    // 5. No display items match the search (displayItems.length === 0)
    // 6. There are items available OR allowCreate is true (allow creation even if all items were filtered out)
    // Note: We check items.length > 0 instead of filteredItems.length > 0 to allow creation even when
    // all items are filtered out (e.g., by templating syntax filter)
    if (allowCreate && searchTerm.trim() && searchTerm.toLowerCase() !== 'is:checked' && !showCheckedOnly && displayItems.length === 0 && items.length > 0) {
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
  }, [displayItems.length, searchTerm, filteredItems.length, items.length, allowCreate, showCreateMode, showCheckedOnly])

  // Handle checkbox toggle (multi-select) or item selection (single-value)
  const handleToggle = (itemName: string) => {
    if (disabled) return

    // Prevent "is:checked" from being added as an item
    if (itemName.toLowerCase() === 'is:checked') {
      logDebug('ContainedMultiSelectChooser', `handleToggle blocked: cannot add "is:checked" as an item`)
      return
    }

    if (singleValue) {
      // Single-value mode: select this item and return immediately
      const formattedValue = getItemDisplayLabel(itemName)
      setSelectedValues([itemName])
      lastSyncedValueRef.current = formattedValue
      onChange(formattedValue)
      // Hide the list after selection
      setShowList(false)
      setSearchTerm('')
    } else {
      // Multi-select mode: toggle the item
      const currentSelected = Array.from(new Set(selectedValues))
      const newSelected = currentSelected.includes(itemName)
        ? currentSelected.filter((v: string) => v !== itemName)
        : [...currentSelected, itemName]

      setSelectedValues(newSelected)
      // Return format based on returnAsArray prop
      // If returnAsArray is true, return original item values (not formatted labels)
      // If returnAsArray is false, return formatted display labels joined by comma
      const newValue = returnAsArray ? newSelected : newSelected.map((item: string) => getItemDisplayLabel(item)).join(',')
      // Update ref before calling onChange to prevent re-sync
      lastSyncedValueRef.current = newValue
      onChange(newValue)
    }
  }

  // Handle clearing selected value in single-value mode
  const handleClearSelection = () => {
    if (disabled) return
    setSelectedValues([])
    setShowList(true)
    setSearchTerm('')
    lastSyncedValueRef.current = returnAsArray ? [] : ''
    onChange(returnAsArray ? [] : '')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  // Handle clicking on the input in single-value mode to show list again
  const handleInputClick = () => {
    if (singleValue && hasSelectedValue && !showList) {
      setShowList(true)
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }
  }

  // Handle keyboard navigation for single-value mode
  const handleKeyDown = (e: { key: string, preventDefault: () => void }, itemName: string) => {
    if (singleValue && e.key === 'Enter') {
      e.preventDefault()
      handleToggle(itemName)
    }
  }

  // Handle select all
  const handleSelectAll = () => {
    if (disabled) return
    // Get unique items from displayItems (remove duplicates and filter out "is:checked")
    const allValues = Array.from(new Set(displayItems)).filter((item: string) => item.toLowerCase() !== 'is:checked')
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
    setShowCheckedOnly(false)
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
    const trimmedSearch = searchTerm.trim()
    // Prevent creating "is:checked" as an item
    if (trimmedSearch.toLowerCase() === 'is:checked') {
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleNewClick blocked: cannot create "is:checked" as an item`)
      return
    }
    logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Setting showCreateMode=true, createValue="${trimmedSearch}"`)
    setShowCreateMode(true)
    setCreateValue(trimmedSearch)
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

    // Prevent creating "is:checked" as an item
    if (trimmedValue.toLowerCase() === 'is:checked') {
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] handleCreateConfirm blocked: cannot create "is:checked" as an item`)
      setShowCreateMode(false)
      setCreateValue('')
      setSearchTerm('')
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

      // Reset create mode and clear search term
      // The newly created item is now in selectedValues and will be visible in the selected items
      logDebug('ContainedMultiSelectChooser', `[CREATE MODE] Resetting create mode, clearing search term`)
      setShowCreateMode(false)
      setCreateValue('')
      setSearchTerm('') // Clear search term so the list shows all items, including the newly created one when items are refreshed
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

  // Container styles
  const containerStyle = useMemo(() => {
    const style: { [string]: string } = {}
    if (width) {
      style.width = width
    }
    return style
  }, [width])

  // Box styles
  const boxStyle = useMemo(() => {
    const style: { [string]: string } = {}
    if (height) {
      style.height = height
    }
    return style
  }, [height])

  // If renderAsDropdown is true and singleValue is true, we need to render as dropdown
  // But we can't do that here since we don't have access to DropdownSelectChooser
  // So we'll handle this in the parent components (TagChooser, MentionChooser, FrontmatterKeyChooser)
  // For now, we'll just render normally

  return (
    <div className={`contained-multi-select-container ${compactDisplay ? 'compact' : ''}`} data-field-type={fieldType} style={containerStyle}>
      {label && !compactDisplay && (
        <label className="contained-multi-select-label" htmlFor={`${fieldType}-search`}>
          {label}
        </label>
      )}
      <div className="contained-multi-select-box" style={boxStyle}>
        {/* Top row: Label (compact), Filter, Clear, Select All, Select None */}
        <div className="contained-multi-select-header">
          {label && compactDisplay && (
            <label className="contained-multi-select-label-compact" htmlFor={inputId}>
              {label}
            </label>
          )}
          <div className="contained-multi-select-search-wrapper">
            <input
              id={inputId}
              name={fieldKey || inputId}
              ref={searchInputRef}
              type="text"
              className={`contained-multi-select-search-input ${showCreateMode ? 'create-mode' : ''} ${singleValue && hasSelectedValue && !showList ? 'single-value-selected' : ''}`}
              value={singleValue && hasSelectedValue && !showList ? selectedDisplayValue : showCreateMode ? createValue : searchTerm}
              onChange={(e) => {
                // In single-value mode with selected value, typing should clear selection and show list
                if (singleValue && hasSelectedValue && !showList) {
                  handleClearSelection()
                  setSearchTerm(e.target.value)
                  return
                }
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
                  // Auto-toggle checked filter when user types "is:checked"
                  if (inputValue.toLowerCase() === 'is:checked') {
                    setShowCheckedOnly(true)
                  } else if (showCheckedOnly && inputValue.toLowerCase() !== 'is:checked') {
                    // If checked filter is on but search term changed, turn off the filter
                    setShowCheckedOnly(false)
                  }
                }
              }}
              onClick={handleInputClick}
              onKeyDown={(e) => {
                // Prevent Enter key from submitting the form
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  // Don't do anything else - just prevent form submission
                  // The input is for filtering/searching, not for submitting
                  return
                }
                // Prevent space key for tag-chooser and mention-chooser when in create mode
                if (showCreateMode && (fieldType === 'tag-chooser' || fieldType === 'mention-chooser') && e.key === ' ') {
                  e.preventDefault()
                }
                // In single-value mode with selected value, pressing any key should clear and start searching
                if (singleValue && hasSelectedValue && !showList && e.key !== 'Enter' && e.key !== 'Escape') {
                  handleClearSelection()
                }
              }}
              placeholder={showCreateMode ? (fieldType === 'tag-chooser' ? 'Enter new hashtag...' : fieldType === 'mention-chooser' ? 'Enter new mention...' : 'Enter new item...') : placeholder}
              disabled={disabled || isCreating}
              readOnly={singleValue && hasSelectedValue && !showList}
            />
            {singleValue && hasSelectedValue && !showList ? (
              <button
                type="button"
                className="contained-multi-select-clear-search"
                onClick={handleClearSelection}
                disabled={disabled}
                title="Clear selection"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            ) : searchTerm && !showCreateMode ? (
              <button
                type="button"
                className="contained-multi-select-clear-search"
                onClick={handleClearSearch}
                disabled={disabled}
                title="Clear search"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            ) : null}
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
          {allowCreate && !(singleValue && hasSelectedValue && !showList) && (
            <button
              type="button"
              className="contained-multi-select-new-btn"
              onClick={handleNewClick}
              disabled={disabled || showCreateMode}
              title="Create new item"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          )}
          {!singleValue && (
            <>
              <button
                type="button"
                className="contained-multi-select-select-all-btn"
                onClick={handleSelectAll}
                disabled={disabled || displayItems.length === 0 || showCreateMode}
                title="Select all"
              >
                <i className="fa-solid fa-check-double"></i>
              </button>
              <button
                type="button"
                className="contained-multi-select-select-none-btn"
                onClick={handleSelectNone}
                disabled={disabled || selectedValues.length === 0}
                title="Select none"
              >
                <i className="fa-solid fa-square"></i>
              </button>
              <button
                type="button"
                className={`contained-multi-select-checked-filter-btn ${showCheckedOnly ? 'active' : ''}`}
                onClick={() => {
                  setShowCheckedOnly(!showCheckedOnly)
                  // If toggling on, set search term to "is:checked", otherwise clear it
                  if (!showCheckedOnly) {
                    setSearchTerm('is:checked')
                  } else {
                    setSearchTerm('')
                  }
                }}
                disabled={disabled || showCreateMode}
                title="Show only checked items"
              >
                <i className="fa-solid fa-filter"></i>
              </button>
            </>
          )}
        </div>

        {/* Scrollable list with checkboxes - hide in single-value mode when value is selected */}
        {!(singleValue && hasSelectedValue && !showList) && (
          <div className="contained-multi-select-list-container" style={{ maxHeight: effectiveMaxHeight }}>
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
                      className={`contained-multi-select-item ${isChecked ? 'checked' : ''} ${singleValue ? 'single-value' : ''}`}
                      onClick={() => handleToggle(item)}
                      onKeyDown={(e) => handleKeyDown(e, item)}
                      tabIndex={singleValue ? 0 : -1}
                      role={singleValue ? 'option' : undefined}
                      aria-selected={singleValue ? isChecked : undefined}
                      title={displayLabel}
                    >
                      {!singleValue && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(item)}
                          disabled={disabled}
                          onClick={(e) => e.stopPropagation()}
                          className="contained-multi-select-checkbox"
                        />
                      )}
                      <span className="contained-multi-select-item-label">{displayLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContainedMultiSelectChooser

