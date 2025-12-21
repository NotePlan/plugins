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
}

export type SearchableChooserProps = {
  label?: string,
  value?: string,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  showValue?: boolean, // If true, display the selected value below the input
  config: ChooserConfig,
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
}: SearchableChooserProps): React$Node {
  const {
    items,
    filterFn,
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
    showArrow = false,
  } = config

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filteredItems, setFilteredItems] = useState<Array<any>>(items)
  const [optionKeyPressed, setOptionKeyPressed] = useState<boolean>(false)
  const [hoveredIndex, setHoveredIndex] = useState<?number>(null)
  const containerRef = useRef<?HTMLDivElement>(null)
  const inputRef = useRef<?HTMLInputElement>(null)

  // Debug logging
  useEffect(() => {
    if (debugLogging) {
      console.log(`${fieldType}: maxResults=${maxResults}, filteredItems.length=${filteredItems.length}`)
    }
    if (debugLogging) {
      console.log(`${fieldType}: Component mounted/updated: items=${items?.length || 0}, isOpen=${String(isOpen)}, filteredItems=${filteredItems.length}`)
      if (items && items.length > 0) {
        console.log(`${fieldType}: First few items:`, items.slice(0, 5).map(getDisplayValue).join(', '))
      }
    }
  }, [items, isOpen, filteredItems.length, debugLogging, fieldType, getDisplayValue])

  // Filter items based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(items)
    } else {
      const filtered = items.filter((item: any) => filterFn(item, searchTerm))
      setFilteredItems(filtered)
    }
  }, [searchTerm, items, filterFn])

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
    setIsOpen(true)
  }

  const handleInputKeyDown = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      // Select first filtered result on Enter
      e.preventDefault() // Prevent form submission
      e.stopPropagation() // Stop event from bubbling to DynamicDialog
      handleItemSelect(filteredItems[0])
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      // Close dropdown on ESC, but only if it's open
      if (isOpen) {
        e.preventDefault() // Prevent default behavior
        e.stopPropagation() // Stop event from bubbling to DynamicDialog (preventing window close)
        setIsOpen(false)
        setSearchTerm('')
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
  if (displayValue && items && items.length > 0) {
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
          console.log(`${fieldType}: Example items:`, examples)
        }
      }
    }
  }

  // Only apply JavaScript truncation for very long items (>inputMaxLength)
  // For shorter items, let CSS handle truncation based on actual width
  const truncatedDisplayValue = displayValue && displayValue.length > inputMaxLength ? truncateDisplay(displayValue, inputMaxLength) : displayValue || ''

  if (debugLogging && displayValue) {
    console.log(`${fieldType}: displayValue="${displayValue}", length=${displayValue.length}`)
    console.log(`${fieldType}: truncatedDisplayValue="${truncatedDisplayValue}", length=${truncatedDisplayValue.length}`)
    console.log(`${fieldType}: original value="${value}", truncateDisplay called with maxLength=${inputMaxLength}`)
    const shouldTruncate = displayValue.length > inputMaxLength
    const actuallyTruncated = truncatedDisplayValue !== displayValue
    console.log(`${fieldType}: Should truncate: ${String(shouldTruncate)}, actually truncated: ${String(actuallyTruncated)}`)
  }

  return (
    <div className={`${classNamePrefix}-container ${compactDisplay ? 'compact' : ''}`} ref={containerRef} data-field-type={fieldType}>
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
          className={`${classNamePrefix}-input`}
          value={isOpen ? searchTerm : truncatedDisplayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          title={displayValue || placeholder}
        />
        {showArrow ? (
          <i className={`fa-solid fa-chevron-down ${classNamePrefix}-arrow ${isOpen ? 'open' : ''}`}></i>
        ) : iconClass ? (
          <i className={`fa-solid ${iconClass} ${classNamePrefix}-icon ${isOpen ? 'open' : ''}`}></i>
        ) : null}
        {isOpen && (
          <div className={`${classNamePrefix}-dropdown`} style={{ display: 'block' }}>
            {filteredItems.length === 0 ? (
              <div className={`${classNamePrefix}-empty`}>{items.length === 0 ? emptyMessageNoItems : `${emptyMessageNoMatch} "${searchTerm}"`}</div>
            ) : (
              filteredItems.slice(0, maxResults).map((item: any, index: number) => {
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
                const showOptionClickHint = optionKeyPressed && isHovered && onOptionClick
                const optionClickIcon = optionClickIconProp || 'plus'
                const finalTitle = optionShortDesc ? `${optionTitle}${optionShortDesc ? ` - ${optionShortDesc}` : ''}` : optionTitle

                return (
                  <div
                    key={`${fieldType}-${index}`}
                    className={`${classNamePrefix}-option ${showOptionClickHint ? 'option-click-hint' : ''}`}
                    onClick={(e) => handleItemSelect(item, e)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    title={finalTitle}
                    style={{
                      cursor: showOptionClickHint ? 'pointer' : 'default',
                    }}
                  >
                    <span className={`${classNamePrefix}-option-left`}>
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
                        className={`${classNamePrefix}-option-text`}
                        style={{
                          color: optionColor ? `var(--${optionColor}, inherit)` : undefined,
                        }}
                      >
                        {truncatedText}
                      </span>
                    </span>
                    {optionShortDesc && <span className={`${classNamePrefix}-option-right`}>{optionShortDesc}</span>}
                  </div>
                )
              })
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
