// @flow
//--------------------------------------------------------------------------
// SearchableChooser Base Component
// A reusable searchable dropdown component that can be configured for different data types
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { calculatePortalPosition } from '@helpers/react/reactUtils.js'
import { getColorStyle } from '@helpers/colors.js'
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
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
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
  width,
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
  const dropdownRef = useRef<?HTMLDivElement>(null)
  // When we programmatically refocus the input (e.g. after clicking an option),
  // we sometimes *don't* want focus to immediately reopen the dropdown.
  const suppressOpenOnFocusRef = useRef<boolean>(false)
  const [closeDropdownTriggered, setCloseDropdownTriggered] = useState<boolean>(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number, left: number, width: number, openAbove: boolean } | null>(null)

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

  // Scroll highlighted item into view when hoveredIndex changes
  useEffect(() => {
    if (isOpen && hoveredIndex != null && hoveredIndex >= 0 && hoveredIndex < filteredItems.length) {
      // Use setTimeout to ensure DOM is updated after state change
      setTimeout(() => {
        // Use dropdownRef (portal dropdown) instead of containerRef since dropdown is portaled
        if (dropdownRef.current) {
          const optionElements = dropdownRef.current.querySelectorAll(`.${classNamePrefix}-option`)
          if (optionElements[hoveredIndex]) {
            optionElements[hoveredIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
        } else if (containerRef.current) {
          // Fallback for non-portal dropdowns (if any)
          const optionElements = containerRef.current.querySelectorAll(`.${classNamePrefix}-option`)
          if (optionElements[hoveredIndex]) {
            optionElements[hoveredIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
        }
      }, 0)
    }
  }, [hoveredIndex, isOpen, filteredItems.length, classNamePrefix])

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

  // Calculate dropdown position when it opens and on scroll/resize
  // Also recalculate when loading completes (for async data loads that might change layout)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Flow typing for requestAnimationFrame / cancelAnimationFrame can vary by environment
      // so we keep this as `any` to avoid incompatible-call noise.
      let rafId: any = null
      const updatePosition = () => {
        // Coalesce bursts of layout changes (async data loads can trigger many resizes)
        if (rafId != null) {
          cancelAnimationFrame(rafId)
        }
        rafId = requestAnimationFrame(() => {
          rafId = null
          const position = calculateDropdownPosition()
          if (position) {
            setDropdownPosition(position)
          }
        })
      }

      // Calculate position immediately
      updatePosition()

      // Listen for window scroll and resize
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)

      // Also listen for scroll events on all scrollable parent elements
      // This ensures the dropdown repositions when a parent container scrolls
      const scrollableParents: Array<HTMLElement> = []
      const inputEl = inputRef.current
      if (inputEl) {
        let parentNode: ?Node = inputEl.parentNode
        while (parentNode && parentNode instanceof HTMLElement) {
          const overflowY = window.getComputedStyle(parentNode).overflowY
          if (overflowY === 'scroll' || overflowY === 'auto') {
            scrollableParents.push(parentNode)
            parentNode.addEventListener('scroll', updatePosition)
          }
          parentNode = parentNode.parentNode
        }
      }

      // Handle layout shifts that *aren't* scroll/resize events (e.g. async data changes dialog height)
      // Use ResizeObserver while dropdown is open to keep the portal aligned.
      let resizeObserver: any = null
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => updatePosition())
        // Observe the nearest dialog (if present) and the chooser container itself
        const dialogEl = inputEl instanceof HTMLElement ? inputEl.closest('.dynamic-dialog') : null
        if (dialogEl instanceof HTMLElement) {
          resizeObserver.observe(dialogEl)
        }
        if (containerRef.current instanceof HTMLElement) {
          resizeObserver.observe(containerRef.current)
        }
      }

      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
        // Remove scroll listeners from parent elements
        scrollableParents.forEach((el) => {
          el.removeEventListener('scroll', updatePosition)
        })
        if (resizeObserver) {
          resizeObserver.disconnect()
        }
        if (rafId != null) {
          cancelAnimationFrame(rafId)
        }
      }
    } else {
      setDropdownPosition(null)
    }
  }, [isOpen, isLoading]) // Recalculate position when loading state changes (for async data loads)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (containerRef.current && target instanceof HTMLElement && !containerRef.current.contains(target) && dropdownRef.current && !dropdownRef.current.contains(target)) {
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
      // Calculate position immediately when opening (synchronously)
      const position = calculateDropdownPosition()
      if (position) {
        setDropdownPosition(position)
      }
    }
  }

  const handleInputFocus = () => {
    if (suppressOpenOnFocusRef.current) {
      suppressOpenOnFocusRef.current = false
      return
    }
    if (debugLogging) {
      console.log(`${fieldType}: Input focused, opening dropdown. items=${items.length}, filteredItems=${filteredItems.length}`)
    }
    if (!isOpen && onOpen) {
      onOpen() // Trigger lazy loading callback
    }
    setIsOpen(true)
    // Calculate position immediately when opening (synchronously)
    const position = calculateDropdownPosition()
    if (position) {
      setDropdownPosition(position)
    }
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
      // Use dropdownRef (portal dropdown) instead of containerRef since dropdown is portaled
      if (dropdownRef.current) {
        const optionElements = dropdownRef.current.querySelectorAll(`.${classNamePrefix}-option`)
        if (optionElements[newIndex]) {
          optionElements[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      } else if (containerRef.current) {
        // Fallback for non-portal dropdowns (if any)
        const optionElements = containerRef.current.querySelectorAll(`.${classNamePrefix}-option`)
        if (optionElements[newIndex]) {
          optionElements[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
      return
    }

    // Handle Tab key: close dropdown and allow normal tab navigation
    if (e.key === 'Tab') {
      if (isOpen) {
        // Close dropdown when Tab is pressed, but don't prevent default
        // This allows normal tab navigation to proceed
        setIsOpen(false)
        setSearchTerm('')
        setHoveredIndex(null)
      }
      // Don't prevent default - allow Tab to move to next field
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault() // Prevent form submission
      e.stopPropagation() // Stop event from bubbling to DynamicDialog

      // If dropdown is closed, reopen it
      if (!isOpen) {
        setIsOpen(true)
        setSearchTerm('')
        setHoveredIndex(null)
        // Calculate position immediately when opening
        const position = calculateDropdownPosition()
        if (position) {
          setDropdownPosition(position)
        }
        // Trigger lazy loading if needed
        if (onOpen) {
          onOpen()
        }
        return
      }

      // Dropdown is open: select an item
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
        // Keep focus on the input to allow tab navigation to continue working
        if (inputRef.current) {
          setTimeout(() => {
            inputRef.current?.focus()
          }, 0)
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
    // Keep focus on the input to allow tab navigation to continue working
    // Use setTimeout to ensure the dropdown closes first, then refocus
    if (inputRef.current) {
      setTimeout(() => {
        suppressOpenOnFocusRef.current = true
        inputRef.current?.focus()
      }, 0)
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
        // It's an object with an id property (event, space, etc.), match by id first
        const matchesById = item.id === displayValue
        if (matchesById) {
          if (debugLogging) {
            console.log(`${fieldType}: Matched item by id: "${item.id}" === "${displayValue}", title: "${item.title || ''}"`)
          }
          return true
        }
        // If id doesn't match, also check display value as fallback
        // This handles cases where value is a display string (e.g., "Private") instead of id (e.g., "")
        const displayVal = getDisplayValue(item)
        const matchesByDisplay = displayVal === displayValue
        if (debugLogging && matchesByDisplay) {
          console.log(`${fieldType}: Matched item by display value: "${displayVal}" === "${displayValue}", id: "${item.id || ''}"`)
        }
        return matchesByDisplay
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

  // Prepare portal container for dropdown
  const portalContainer: ?HTMLElement = typeof document !== 'undefined' && document.body ? document.body : null

  // Helper function to calculate dropdown position using the shared portal positioning helper
  const calculateDropdownPosition = (): ?{ top: number, left: number, width: number, openAbove: boolean } => {
    if (!inputRef.current) return null

    const dropdownMaxHeight = 150 // Match CSS max-height
    const inputRect = inputRef.current.getBoundingClientRect()

    // Use the shared portal positioning helper
    const position = calculatePortalPosition({
      referenceElement: inputRef.current,
      elementWidth: inputRect.width,
      elementHeight: dropdownMaxHeight,
      preferredPlacement: 'below',
      preferredAlignment: 'start',
      offset: 0, // No gap for dropdown (it should connect to input)
      viewportPadding: 10,
    })

    if (!position) return null

    // Determine if dropdown opens above based on placement
    const openAbove = position.placement === 'above'

    return {
      top: position.top,
      left: position.left,
      width: inputRect.width, // Dropdown width matches input width
      openAbove,
    }
  }

  // Recalculate dropdown position when async loading completes
  // This ensures positioning is correct after data finishes loading and DOM layout stabilizes
  // Useful for choosers with async data loading (e.g., EventChooser)
  // This runs separately from the main positioning effect to handle the case where loading
  // completes after the dropdown is already open, ensuring accurate positioning after data loads
  useEffect(() => {
    if (isOpen && !isLoading && inputRef.current) {
      // Use a small delay to ensure DOM has fully updated after loading completes
      // This handles cases where data loading triggers re-renders that affect layout
      const timeoutId = setTimeout(() => {
        const position = calculateDropdownPosition()
        if (position) {
          setDropdownPosition(position)
        }
      }, 50) // Small delay to allow DOM to settle after data loads

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoading, isOpen]) // Recalculate when loading completes

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
      <div
        className={`${classNamePrefix}-input-wrapper`}
        style={
          width
            ? {
                width: width,
                maxWidth: width,
                // Only set min-width for fixed pixel values, not percentages or viewport units
                // This prevents wrapping issues while allowing flexible sizing
                minWidth: width.includes('px') ? width : undefined,
              }
            : undefined
        }
      >
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
          <i
            className={`${typeof iconClass === 'string' && iconClass.startsWith('fa-') ? iconClass : `fa-solid ${iconClass || ''}`} ${classNamePrefix}-icon ${
              isOpen ? 'open' : ''
            }`}
          ></i>
        ) : null}
      </div>
      {showValue && value && (
        <div
          className={`${classNamePrefix}-value-display`}
          style={{ marginTop: '0.25rem', fontSize: '0.85em', color: 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))', fontFamily: 'Menlo, monospace' }}
        >
          <strong>Value:</strong> {value}
        </div>
      )}
      {/* Render dropdown via portal to avoid clipping */}
      {isOpen && portalContainer
        ? createPortal(
            <div
              ref={dropdownRef}
              className={`searchable-chooser-dropdown-portal ${classNamePrefix}-dropdown ${dropdownPosition?.openAbove ? 'open-above' : ''} ${(() => {
                // Check if any items have icons or shortDescriptions
                const itemsToCheck = maxResults != null && maxResults > 0 ? filteredItems.slice(0, maxResults) : filteredItems
                const hasIconsOrDescriptions = itemsToCheck.some((item: any) => {
                  const hasIcon = getOptionIcon ? getOptionIcon(item) : false
                  const hasShortDesc = getOptionShortDescription ? getOptionShortDescription(item) : false
                  return hasIcon || hasShortDesc
                })
                return !hasIconsOrDescriptions ? 'simple-list-no-icons-descriptions' : ''
              })()}`}
              style={{
                position: 'fixed',
                top: dropdownPosition ? `${dropdownPosition.top}px` : '0px',
                left: dropdownPosition ? `${dropdownPosition.left}px` : '0px',
                width: dropdownPosition ? `${dropdownPosition.width}px` : 'auto',
                display: 'block',
                zIndex: 99999,
                opacity: dropdownPosition ? 1 : 0,
                pointerEvents: dropdownPosition ? 'auto' : 'none',
              }}
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
                <div
                  className={`searchable-chooser-empty ${classNamePrefix}-empty`}
                  style={{ padding: '1rem', textAlign: 'center', color: 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))' }}
                >
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
                        color: 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))',
                      }}
                    >
                      Press Enter to use &quot;{searchTerm.trim()}&quot; as {manualEntryIndicator.toLowerCase()}
                    </div>
                  )}
                </div>
              ) : (
                (() => {
                  // Show all items if maxResults is undefined, otherwise limit to maxResults
                  const itemsToShow = maxResults != null && maxResults > 0 ? filteredItems.slice(0, maxResults) : filteredItems
                  if (debugLogging) {
                    console.log(`${fieldType}: Rendering ${itemsToShow.length} options (filtered from ${filteredItems.length} total, maxResults=${maxResults || 'unlimited'})`)
                  }

                  // Check if any items have icons or shortDescriptions (calculate once for all items)
                  const hasIconsOrDescriptions = itemsToShow.some((item: any) => {
                    const hasIcon = getOptionIcon ? getOptionIcon(item) : false
                    const hasShortDesc = getOptionShortDescription ? getOptionShortDescription(item) : false
                    return hasIcon || hasShortDesc
                  })

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
                    let optionShortDesc = getOptionShortDescription ? getOptionShortDescription(item) : null
                    // Hide short description if it's identical to the label text
                    if (optionShortDesc && optionText && optionShortDesc.trim() === optionText.trim()) {
                      optionShortDesc = null
                    }
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
                          className={`searchable-chooser-option searchable-chooser-option-two-line ${classNamePrefix}-option ${classNamePrefix}-option-two-line ${
                            showOptionClickHint ? 'option-click-hint' : ''
                          } ${isSelected ? 'option-selected' : ''}`}
                          onClick={(e) => handleItemSelect(item, e)}
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          title={finalTitle}
                          style={{
                            cursor: showOptionClickHint ? 'pointer' : 'default',
                          }}
                        >
                          <div className={`searchable-chooser-option-first-line ${classNamePrefix}-option-first-line`}>
                            {optionIcon && (
                              <i
                                className={typeof optionIcon === 'string' && optionIcon.startsWith('fa-') ? optionIcon : `fa-solid fa-${optionIcon || ''}`}
                                style={{
                                  marginRight: '0.5rem',
                                  opacity: 0.7,
                                  color: getColorStyle(optionColor),
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
                                color: getColorStyle(optionColor),
                              }}
                            >
                              {truncatedText}
                            </span>
                          </div>
                          <div
                            className={`searchable-chooser-option-second-line ${classNamePrefix}-option-second-line`}
                            style={{
                              color: optionColor ? getColorStyle(optionColor) || 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))' : undefined,
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
                    // Check if this is a simple list (no icons or descriptions)
                    const isSimpleItem = !optionIcon && !optionShortDesc && !hasIconsOrDescriptions
                    return (
                      <div
                        key={`${fieldType}-${index}`}
                        className={`searchable-chooser-option ${classNamePrefix}-option ${showOptionClickHint ? 'option-click-hint' : ''} ${isSelected ? 'option-selected' : ''} ${
                          isSimpleItem ? 'simple-item' : ''
                        }`}
                        onClick={(e) => handleItemSelect(item, e)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        title={finalTitle}
                        style={{
                          cursor: showOptionClickHint ? 'pointer' : 'default',
                        }}
                      >
                        <span className={`searchable-chooser-option-left ${classNamePrefix}-option-left`}>
                          {optionIcon && (
                            <i
                              className={typeof optionIcon === 'string' && optionIcon.startsWith('fa-') ? optionIcon : `fa-solid fa-${optionIcon || ''}`}
                              style={{
                                marginRight: '0.5rem',
                                opacity: 0.7,
                                color: getColorStyle(optionColor),
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
                              color: getColorStyle(optionColor),
                            }}
                          >
                            {truncatedText}
                          </span>
                        </span>
                        {/* Always render right side to reserve space, even if empty */}
                        {/* In single-line mode (not shortDescriptionOnLine2), reserve space even when empty */}
                        {/* But hide it completely for simple lists */}
                        {!isSimpleItem && (
                          <span
                            className={`searchable-chooser-option-right ${classNamePrefix}-option-right`}
                            style={{
                              color: optionColor ? getColorStyle(optionColor) || 'var(--gray-500, #666)' : undefined,
                              // Reserve minimum space when in single-line mode and no shortDescription
                              minWidth: !shortDescriptionOnLine2 && !optionShortDesc ? '8rem' : undefined,
                            }}
                          >
                            {optionShortDesc || ''}
                          </span>
                        )}
                      </div>
                    )
                  })
                })()
              )}
            </div>,
            portalContainer,
          )
        : null}
    </div>
  )
}

export default SearchableChooser
