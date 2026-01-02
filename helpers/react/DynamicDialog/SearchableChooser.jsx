// @flow
//--------------------------------------------------------------------------
// SearchableChooser Base Component
// A reusable searchable dropdown component that can be configured for different data types
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react'
import './SearchableChooser.css'

/**
 * Configuration for customizing the chooser behavior
 */
export type ChooserConfig = {
  // Data and filtering
  items: Array<any>,
  filterFn: (item: any, searchTerm: string) => boolean,
  itemFilter?: ?(item: any) => boolean, // Optional function to filter items before search filtering (applied to all items regardless of search term)

  // Display
  getDisplayValue: (item: any) => string, // Gets the value to display in the input
  getOptionText: (item: any) => string, // Gets the text to show in dropdown options
  getOptionTitle: (item: any) => string, // Gets the title/tooltip for dropdown options
  truncateDisplay: (text: string, maxLength: number) => string, // Function to truncate display text

  // Selection
  onSelect: (item: any) => void, // Called when an item is selected

  // Empty states
  emptyMessageNoItems: string,
  emptyMessageNoMatch: string,

  // Styling
  classNamePrefix: string, // Prefix for CSS classes (e.g., 'folder-chooser', 'note-chooser')
  iconClass?: ?string, // FontAwesome icon class (e.g., 'fa-folder', 'fa-file-lines') - optional, if not provided, no icon is shown
  fieldType: string, // Data attribute for field type (e.g., 'folder-chooser', 'note-chooser')
  showArrow?: boolean, // If true, show a down arrow instead of icon (default: false)

  // Optional
  debugLogging?: boolean,
  maxResults?: number, // Max items to show in dropdown (default: 10)
  inputMaxLength?: number, // Max length for input truncation (default: 40)
  dropdownMaxLength?: number, // Max length for dropdown truncation (default: 50)
  onOptionClick?: (item: any) => void, // Optional handler for Option-click on options (replaces right-click)
  optionClickHint?: ?string, // Optional hint text to show when Option key is pressed (e.g., "Create subfolder", "Add to favorites")
  optionClickIcon?: ?string, // Optional icon to show when Option key is pressed (default: 'plus')
  getOptionIcon?: (item: any) => ?string, // Optional function to get icon for option
  getOptionColor?: (item: any) => ?string, // Optional function to get color for option
  getOptionShortDescription?: (item: any) => ?string, // Optional function to get short description for option
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
  allowManualEntry?: boolean, // If true, allow Enter key to accept typed text even if it doesn't match any item
  manualEntryIndicator?: string, // Text to show when value is a manual entry (default: "✏️ Manual entry")
  isManualEntry?: (value: string, items: Array<any>) => boolean, // Function to check if a value is a manual entry (not in items list)
  // Custom rendering
  renderOption?: (
    item: any,
    helpers: {
      index: number,
      isHovered: boolean,
      isSelected: boolean,
      showOptionClickHint: boolean,
      optionClickIcon: ?string,
      optionClickHint?: ?string,
      classNamePrefix: string,
      fieldType: string,
      handleItemSelect: (item: any, e: any) => void,
      setHoveredIndex: (index: number | null) => void,
      getOptionTitle: (item: any) => string,
      getOptionIcon: (item: any) => ?string,
      getOptionColor: (item: any) => ?string,
      getOptionShortDescription: (item: any) => ?string,
    },
  ) => React$Node, // Optional function to completely customize option rendering
}

export type SearchableChooserProps = {
  label?: string,
  value?: string,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  showValue?: boolean, // If true, display the selected value below the input
  config: ChooserConfig,
  closeDropdown?: boolean, // If true, force close the dropdown (resets after closing)
  onOpen?: () => void, // Callback when dropdown opens (for lazy loading) - can be async internally
  isLoading?: boolean, // If true, show loading indicator
}

/**
 * Generic SearchableChooser Component
 * A searchable dropdown that can be configured for different data types
 * Note: Flow doesn't support generic function components well, so we use `any` for the generic type
 * @param {SearchableChooserProps} props
 * @returns {React$Node}
 */
export function SearchableChooser({
  label,
  value = '',
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search...',
  showValue = false,
  config,
  closeDropdown = false,
  onOpen,
  isLoading = false,
}: SearchableChooserProps): React$Node {
  const {
    items,
    filterFn,
    itemFilter,
    getDisplayValue,
    getOptionText,
    getOptionTitle,
    truncateDisplay,
    onSelect,
    emptyMessageNoItems,
    emptyMessageNoMatch,
    classNamePrefix,
    iconClass,
    fieldType,
    debugLogging = false,
    maxResults = 25,
    inputMaxLength = 40,
    dropdownMaxLength = 50,
    onOptionClick,
    optionClickHint,
    optionClickIcon: optionClickIconProp = 'plus',
    getOptionIcon,
    getOptionColor,
    getOptionShortDescription,
    shortDescriptionOnLine2 = false,
    showArrow = false,
    allowManualEntry = false,
    manualEntryIndicator = '✏️ Manual entry',
    isManualEntry,
    renderOption,
  } = config

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filteredItems, setFilteredItems] = useState<Array<any>>(items)
  const [optionKeyPressed, setOptionKeyPressed] = useState<boolean>(false)
  const [hoveredIndex, setHoveredIndex] = useState<?number>(null)
  const containerRef = useRef<?HTMLDivElement>(null)
  const inputRef = useRef<?HTMLInputElement>(null)
  const [closeDropdownTriggered, setCloseDropdownTriggered] = useState<boolean>(false)

  // Handle closeDropdown prop - close dropdown when it becomes true
  useEffect(() => {
    if (closeDropdown && !closeDropdownTriggered) {
      setIsOpen(false)
      setCloseDropdownTriggered(true)
    } else if (!closeDropdown && closeDropdownTriggered) {
      // Reset the trigger when closeDropdown becomes false again
      setCloseDropdownTriggered(false)
    }
  }, [closeDropdown, closeDropdownTriggered])

  // Debug logging (disabled for cleaner console output)
  // useEffect(() => {
  //   if (debugLogging) {
  //     console.log(`${fieldType}: maxResults=${maxResults}, filteredItems.length=${filteredItems.length}`)
  //   }
  //   if (debugLogging) {
  //     console.log(`${fieldType}: Component mounted/updated: items=${items?.length || 0}, isOpen=${String(isOpen)}, filteredItems=${filteredItems.length}`)
  //     if (items && items.length > 0) {
  //       console.log(`${fieldType}: First few items:`, items.slice(0, 5).map(getDisplayValue).join(', '))
  //     }
  //   }
  // }, [items, isOpen, filteredItems.length, debugLogging, fieldType, getDisplayValue])

  // Filter items: first apply itemFilter (if provided), then apply search filter
  useEffect(() => {
    // Apply itemFilter first (if provided) - this filters items regardless of search term
    let preFilteredItems = items
    if (itemFilter) {
      preFilteredItems = items.filter((item: any) => itemFilter(item))
    }

    // Then apply search filter if there's a search term
    if (!searchTerm.trim()) {
      setFilteredItems(preFilteredItems)
    } else {
      const filtered = preFilteredItems.filter((item: any) => filterFn(item, searchTerm))
      setFilteredItems(filtered)
    }
  }, [searchTerm, items, filterFn, itemFilter])

  // Track Option/Alt key for Option-click functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        setOptionKeyPressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        setOptionKeyPressed(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (containerRef.current && target instanceof HTMLElement && !containerRef.current.contains(target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus input when dropdown opens
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleInputChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleInputFocus = () => {
    if (debugLogging) {
      console.log(`${fieldType}: Input focused, opening dropdown. items=${items.length}, filteredItems=${filteredItems.length}`)
    }
    if (!isOpen && onOpen) {
      onOpen() // Trigger lazy loading callback
    }
    setIsOpen(true)
  }

  const handleInputKeyDown = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
    // Handle arrow key navigation when dropdown is open
    if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      e.stopPropagation()
      const currentIndex = hoveredIndex != null ? hoveredIndex : -1
      let newIndex: number
      if (e.key === 'ArrowDown') {
        newIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1
      }
      setHoveredIndex(newIndex)
      // Scroll the selected item into view
      if (containerRef.current) {
        const optionElements = containerRef.current.querySelectorAll(`.${classNamePrefix}-option`)
        if (optionElements[newIndex]) {
          optionElements[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault() // Prevent form submission
      e.stopPropagation() // Stop event from bubbling to DynamicDialog
      // If an item is hovered/highlighted, select that one; otherwise select first
      const itemToSelect =
        hoveredIndex != null && hoveredIndex >= 0 && hoveredIndex < filteredItems.length ? filteredItems[hoveredIndex] : filteredItems.length > 0 ? filteredItems[0] : null

      if (itemToSelect) {
        handleItemSelect(itemToSelect)
      } else if (allowManualEntry && searchTerm.trim()) {
        // Allow manual entry if enabled and there's text typed
        // Create a special manual entry item
        const manualEntryItem = { __manualEntry__: true, value: searchTerm.trim(), display: searchTerm.trim() }
        onSelect(manualEntryItem)
        setIsOpen(false)
        setSearchTerm('')
        if (inputRef.current) {
          inputRef.current.blur()
        }
      }
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      // Close dropdown on ESC, but only if it's open
      if (isOpen) {
        e.preventDefault() // Prevent default behavior
        e.stopPropagation() // Stop event from bubbling to DynamicDialog (preventing window close)
        setIsOpen(false)
        setSearchTerm('')
        setHoveredIndex(null)
        // Blur the input to remove focus
        if (inputRef.current) {
          inputRef.current.blur()
        }
      }
    }
  }

  const handleItemSelect = (item: any, event?: SyntheticMouseEvent<HTMLDivElement>) => {
    // Check if Option/Alt key is pressed
    if (event && (event.altKey || event.metaKey) && onOptionClick) {
      event.preventDefault()
      event.stopPropagation()
      onOptionClick(item)
      return
    }
    onSelect(item)
    setIsOpen(false)
    setSearchTerm('')
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }

  // When displaying the selected value, try to find the item by value and use its display label
  // This ensures we show the label (e.g., note title) rather than the value (e.g., filename)
  let displayValue = value || ''
  let isManualEntryValue = false

  // Check if current value is a manual entry
  if (allowManualEntry && displayValue && isManualEntry) {
    isManualEntryValue = isManualEntry(displayValue, items)
  }

  if (displayValue && items && items.length > 0 && !isManualEntryValue) {
    if (debugLogging) {
      console.log(`${fieldType}: Looking up display value for stored value: "${value}"`)
      console.log(`${fieldType}: Items available: ${items.length}, first item type:`, typeof items[0])
      if (items.length > 0 && typeof items[0] === 'object') {
        console.log(`${fieldType}: First item keys:`, Object.keys(items[0]))
      }
    }

    // Try to find the item that matches this value
    // For notes, we need to match by filename; for folders, by path
    const foundItem = items.find((item: any) => {
      // Check if this item's value matches our stored value
      // For note objects, compare filename; for folder strings, compare the string itself
      if (typeof item === 'string') {
        const matches = item === displayValue
        if (debugLogging && matches) {
          console.log(`${fieldType}: Matched string item: "${item}" === "${displayValue}"`)
        }
        return matches
      } else if (item && typeof item === 'object' && 'filename' in item) {
        // It's a note object, match by filename
        const matches = item.filename === displayValue
        if (debugLogging && matches) {
          console.log(`${fieldType}: Matched note item by filename: "${item.filename}" === "${displayValue}", title: "${item.title}"`)
        }
        return matches
      } else if (item && typeof item === 'object' && 'id' in item) {
        // It's an event object (or similar), match by id
        const matches = item.id === displayValue
        if (debugLogging && matches) {
          console.log(`${fieldType}: Matched event item by id: "${item.id}" === "${displayValue}", title: "${item.title || ''}"`)
        }
        return matches
      }
      // For other object types, try to match by comparing getDisplayValue result
      // or by checking if the item itself is the value
      const displayVal = getDisplayValue(item)
      const matches = item === displayValue || displayVal === displayValue
      if (debugLogging && matches) {
        console.log(`${fieldType}: Matched object item:`, item)
      }
      return matches
    })

    if (foundItem) {
      // Use the display label from the found item
      const originalDisplayValue = displayValue
      displayValue = getDisplayValue(foundItem)
      if (debugLogging) {
        console.log(`${fieldType}: Found item! Original value: "${originalDisplayValue}" -> Display value: "${displayValue}"`)
      }
    } else {
      if (debugLogging) {
        console.log(`${fieldType}: No item found for value "${value}", will display value directly`)
        // Show a few examples of what we're searching through
        if (items.length > 0) {
          const examples = items.slice(0, 3).map((item: any) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'filename' in item) return `{title: "${item.title}", filename: "${item.filename}"}`
            return String(item)
          })
        }
      }
    }
  }

  // Only apply JavaScript truncation for very long items (>inputMaxLength)
  // For shorter items, let CSS handle truncation based on actual width
  const truncatedDisplayValue = displayValue && displayValue.length > inputMaxLength ? truncateDisplay(displayValue, inputMaxLength) : displayValue || ''

  // Debug logging (disabled for cleaner console output)
  // if (debugLogging && displayValue) {
  //   console.log(`${fieldType}: displayValue="${displayValue}", length=${displayValue.length}`)
  //   console.log(`${fieldType}: truncatedDisplayValue="${truncatedDisplayValue}", length=${truncatedDisplayValue.length}`)
  //   console.log(`${fieldType}: original value="${value}", truncateDisplay called with maxLength=${inputMaxLength}`)
  //   const shouldTruncate = displayValue.length > inputMaxLength
  //   const actuallyTruncated = truncatedDisplayValue !== displayValue
  //   console.log(`${fieldType}: Should truncate: ${String(shouldTruncate)}, actually truncated: ${String(actuallyTruncated)}`)
  // }

  return (
    <div className={`searchable-chooser-base ${classNamePrefix}-container ${compactDisplay ? 'compact' : ''}`} ref={containerRef} data-field-type={fieldType}>
      {label && compactDisplay && (
        <label className={`${classNamePrefix}-label`} htmlFor={`${classNamePrefix}-${label}`}>
          {label}
        </label>
      )}
      {label && !compactDisplay && (
        <label className={`${classNamePrefix}-label`} htmlFor={`${classNamePrefix}-${label}`}>
          {label}
        </label>
      )}
      <div className={`${classNamePrefix}-input-wrapper`}>
        <input
          id={`${classNamePrefix}-${label || 'default'}`}
          ref={inputRef}
          type="text"
          className={`${classNamePrefix}-input ${isManualEntryValue ? 'manual-entry' : ''}`}
          value={isOpen ? searchTerm : truncatedDisplayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          title={isManualEntryValue ? `${displayValue} (${manualEntryIndicator})` : displayValue || placeholder}
        />
        {isManualEntryValue && !isOpen && (
          <span className={`${classNamePrefix}-manual-entry-indicator`} title={manualEntryIndicator}>
            {manualEntryIndicator}
          </span>
        )}
        {showArrow ? (
          <i className={`fa-solid fa-chevron-down ${classNamePrefix}-arrow ${isOpen ? 'open' : ''}`}></i>
        ) : iconClass ? (
          <i className={`fa-solid ${iconClass} ${classNamePrefix}-icon ${isOpen ? 'open' : ''}`}></i>
        ) : null}
        {isOpen && (
          <div
            className={`searchable-chooser-dropdown ${classNamePrefix}-dropdown`}
            style={{ display: 'block' }}
            data-debug-isopen={String(isOpen)}
            data-debug-filtered-count={filteredItems.length}
            data-debug-items-count={items.length}
            data-debug-isloading={String(isLoading)}
          >
            {debugLogging &&
              console.log(
                `${fieldType}: Rendering dropdown, isOpen=${String(isOpen)}, isLoading=${String(isLoading)}, items.length=${items.length}, filteredItems.length=${
                  filteredItems.length
                }`,
              )}
            {isLoading ? (
              <div className={`searchable-chooser-empty ${classNamePrefix}-empty`} style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-600, #666)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`searchable-chooser-empty ${classNamePrefix}-empty`}>
                {items.length === 0 ? emptyMessageNoItems : `${emptyMessageNoMatch} "${searchTerm}"`}
                {allowManualEntry && searchTerm.trim() && (
                  <div
                    className={`${classNamePrefix}-manual-entry-hint`}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: 'var(--bg-alt-color, #f5f5f5)',
                      borderRadius: '4px',
                      fontSize: '0.85em',
                      color: 'var(--gray-600, #666)',
                    }}
                  >
                    Press Enter to use &quot;{searchTerm.trim()}&quot; as {manualEntryIndicator.toLowerCase()}
                  </div>
                )}
              </div>
            ) : (
              (() => {
                const itemsToShow = filteredItems.slice(0, maxResults)
                if (debugLogging) {
                  console.log(`${fieldType}: Rendering ${itemsToShow.length} options (filtered from ${filteredItems.length} total, maxResults=${maxResults})`)
                }
                return itemsToShow.map((item: any, index: number) => {
                  const optionText = getOptionText(item)
                  // Only apply JavaScript truncation for very long items (>dropdownMaxLength)
                  // For shorter items, let CSS handle truncation based on actual width
                  const truncatedText = optionText.length > dropdownMaxLength ? truncateDisplay(optionText, dropdownMaxLength) : optionText
                  const optionTitle = getOptionTitle(item)
                  if (debugLogging && index < 3) {
                    const jsTruncated = optionText.length > dropdownMaxLength
                    console.log(
                      `${fieldType}: Dropdown option[${index}]: original="${optionText}", length=${optionText.length}, truncated="${truncatedText}", length=${
                        truncatedText.length
                      }, maxLength=${dropdownMaxLength}, jsTruncated=${String(jsTruncated)}`,
                    )
                  }
                  const optionIcon = getOptionIcon ? getOptionIcon(item) : null
                  const optionColor = getOptionColor ? getOptionColor(item) : null
                  const optionShortDesc = getOptionShortDescription ? getOptionShortDescription(item) : null
                  const isHovered = hoveredIndex === index
                  const isSelected = hoveredIndex === index // For keyboard navigation highlighting
                  const showOptionClickHint: boolean = Boolean(optionKeyPressed && isHovered && !!onOptionClick)
                  const optionClickIcon = optionClickIconProp || 'plus'
                  const finalTitle = optionShortDesc ? `${optionTitle}${optionShortDesc ? ` - ${optionShortDesc}` : ''}` : optionTitle

                  // If custom renderOption is provided, use it
                  if (renderOption) {
                    return (
                      <div key={`${fieldType}-${index}`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                        {renderOption(item, {
                          index,
                          isHovered,
                          isSelected,
                          showOptionClickHint: showOptionClickHint,
                          optionClickIcon,
                          optionClickHint: optionClickHint || undefined,
                          classNamePrefix,
                          fieldType,
                          handleItemSelect,
                          setHoveredIndex,
                          getOptionTitle,
                          getOptionIcon: getOptionIcon || (() => null),
                          getOptionColor: getOptionColor || (() => null),
                          getOptionShortDescription: getOptionShortDescription || (() => null),
                        })}
                      </div>
                    )
                  }

                  // Default rendering
                  if (shortDescriptionOnLine2 && optionShortDesc) {
                    // Two-line layout: icon + label on first line, description on second line
                    return (
                      <div
                        key={`${fieldType}-${index}`}
                        className={`searchable-chooser-option searchable-chooser-option-two-line ${classNamePrefix}-option ${classNamePrefix}-option-two-line ${showOptionClickHint ? 'option-click-hint' : ''} ${isSelected ? 'option-selected' : ''}`}
                        onClick={(e) => handleItemSelect(item, e)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        title={finalTitle}
                        style={{
                          cursor: showOptionClickHint ? 'pointer' : 'default',
                          backgroundColor: isSelected ? 'var(--hover-bg, #f5f5f5)' : undefined,
                        }}
                      >
                        <div className={`searchable-chooser-option-first-line ${classNamePrefix}-option-first-line`}>
                          {optionIcon && (
                            <i
                              className={`fa-solid fa-${optionIcon}`}
                              style={{
                                marginRight: '0.5rem',
                                opacity: 0.7,
                                color: optionColor ? `var(--${optionColor}, inherit)` : undefined,
                              }}
                            />
                          )}
                          {showOptionClickHint && optionClickIcon && (
                            <i
                              className={`fa-solid fa-${optionClickIcon}`}
                              style={{
                                marginRight: '0.5rem',
                                color: 'var(--tint-color, #0066cc)',
                              }}
                              title={optionClickHint || 'Option-click for action'}
                            />
                          )}
                          <span
                            className={`searchable-chooser-option-text ${classNamePrefix}-option-text`}
                            style={{
                              color: optionColor ? `var(--${optionColor}, inherit)` : undefined,
                            }}
                          >
                            {truncatedText}
                          </span>
                        </div>
                        <div
                          className={`searchable-chooser-option-second-line ${classNamePrefix}-option-second-line`}
                          style={{
                            color: optionColor ? `var(--${optionColor}, var(--gray-500, #666))` : undefined,
                          }}
                        >
                          {optionShortDesc}
      </div>
      {/* Placeholder div to reserve space for validation message - outside input wrapper so it doesn't constrain dropdown */}
      <div className="validation-message validation-message-placeholder" aria-hidden="true"></div>
    </div>
  )
}
                  
                  // Single-line layout (default): icon + label + description on one line
                  return (
                    <div
                      key={`${fieldType}-${index}`}
                      className={`searchable-chooser-option ${classNamePrefix}-option ${showOptionClickHint ? 'option-click-hint' : ''} ${isSelected ? 'option-selected' : ''}`}
                      onClick={(e) => handleItemSelect(item, e)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      title={finalTitle}
                      style={{
                        cursor: showOptionClickHint ? 'pointer' : 'default',
                        backgroundColor: isSelected ? 'var(--hover-bg, #f5f5f5)' : undefined,
                      }}
                    >
                      <span className={`searchable-chooser-option-left ${classNamePrefix}-option-left`}>
                        {optionIcon && (
                          <i
                            className={`fa-solid fa-${optionIcon}`}
                            style={{
                              marginRight: '0.5rem',
                              opacity: 0.7,
                              color: optionColor ? `var(--${optionColor}, inherit)` : undefined,
                            }}
                          />
                        )}
                        {showOptionClickHint && optionClickIcon && (
                          <i
                            className={`fa-solid fa-${optionClickIcon}`}
                            style={{
                              marginRight: '0.5rem',
                              color: 'var(--tint-color, #0066cc)',
                            }}
                            title={optionClickHint || 'Option-click for action'}
                          />
                        )}
                        <span
                          className={`searchable-chooser-option-text ${classNamePrefix}-option-text`}
                          style={{
                            color: optionColor ? `var(--${optionColor}, inherit)` : undefined,
                          }}
                        >
                          {truncatedText}
                        </span>
                      </span>
                      {optionShortDesc && (
                        <span
                          className={`searchable-chooser-option-right ${classNamePrefix}-option-right`}
                          style={{
                            color: optionColor ? `var(--${optionColor}, var(--gray-500, #666))` : undefined,
                          }}
                        >
                          {optionShortDesc}
                        </span>
                      )}
                    </div>
                  )
                })
              })()
            )}
          </div>
        )}
      </div>
      {showValue && value && (
        <div className={`${classNamePrefix}-value-display`} style={{ marginTop: '0.25rem', fontSize: '0.85em', color: 'var(--gray-500, #666)', fontFamily: 'Menlo, monospace' }}>
          <strong>Value:</strong> {value}
        </div>
      )}
    </div>
  )
}

export default SearchableChooser
