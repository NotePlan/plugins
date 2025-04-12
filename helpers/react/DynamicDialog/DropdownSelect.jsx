// @flow
//--------------------------------------------------------------------------
// React component to show an HTML DropdownSelect control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
//
// Includes logic to either disable focus when isEditable=false,
// and logic to only scroll if needed, plus an optional prop to disable scrolling altogether.
// Last updated 2025-04-05 by @jgclark
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, type ElementRef, useLayoutEffect } from 'react'
import './DropdownSelect.css'
import { clo, logDebug, logInfo } from '@helpers/react/reactDev'

declare var NP_THEME: any
const maxChars = 50 // to show in dropdown

export type Option = {
  label: string,
  value: string,
  [string]: any, // Allow additional properties (e.g. isModified)
}

type Styles = {
  container?: { [string]: mixed },
  label?: { [string]: mixed },
  wrapper?: { [string]: mixed },
  inputContainer?: { [string]: mixed },
  input?: { [string]: mixed },
  arrow?: { [string]: mixed },
  dropdown?: { [string]: mixed },
  option?: { [string]: mixed },
  indicator?: { [string]: mixed }, // Style for the indicator
  separator?: { [string]: mixed }, // Style for the separator
}

type DropdownSelectProps = {
  label: string,
  options: Array<string | Option>,
  /**
   * The initial or current value of the dropdown when not controlled externally.
   * Use this prop when the component should manage its own state.
   */
  value?: string | Option,
  /**
   * The value controlled by the parent component.
   * Use this prop to override the internal state and control the dropdown's value externally.
   */
  controlledValue?: string | Option,
  onChange?: ({ [string]: mixed }) => void,
  inputRef?: { current: null | HTMLInputElement },
  compactDisplay?: boolean,
  disabled?: boolean,
  styles?: Styles,
  fullWidthOptions?: boolean,
  showIndicatorOptionProp?: string,
  allowNonMatchingLabel?: boolean,
  noWrapOptions?: boolean,
  fixedWidth?: number,
  className?: string,
  isEditable?: boolean,
  /**
   * Whether to skip automatic scrolling logic entirely.
   * Defaults to false (meaning auto-scroll is active).
   */
  disableAutoScroll?: boolean,
  tabIndex?: number,
}

/**
 * Safely merges two style objects, giving precedence to the second.
 *
 * @param {Object} baseStyles - The base styles.
 * @param {Object} overrideStyles - The styles to override with.
 * @returns {Object} The merged style object.
 */
const mergeStyles = (baseStyles: { [string]: mixed }, overrideStyles: { [string]: mixed } = {}) => {
  return { ...baseStyles, ...overrideStyles }
}

/**
 * DropdownSelect component for rendering a customizable dropdown menu.
 *
 * NOTE: This code reverts to the earlier scroll approach (checking isOutOfView before scrolling)
 * while adding "disableAutoScroll" to allow a parent to skip scrolling logic entirely.
 *
 * @module DropdownSelect
 */

/**
 * DropdownSelect component for rendering a customizable dropdown menu.
 *
 * @param {Object} props - The component props.
 * @param {string} props.label - The label for the dropdown.
 * @param {Array<string | Option>} props.options - The list of options for the dropdown.
 * @param {string | Option} [props.value] - The initial or current value of the dropdown when not controlled externally.
 * @param {string | Option} [props.controlledValue] - The value controlled by the parent component.
 * @param {Function} [props.onChange] - Callback function to handle changes in selection.
 * @param {Object} [props.inputRef] - Ref object for the input element.
 * @param {boolean} [props.compactDisplay] - Whether to display the dropdown in a compact style.
 * @param {boolean} [props.disabled] - Whether the dropdown is disabled.
 * @param {Styles} [props.styles] - Custom styles for the dropdown components.
 * @param {boolean} [props.fullWidthOptions] - Whether options should take full width.
 * @param {string} [props.showIndicatorOptionProp] - Property name to determine if an indicator should be shown.
 * @param {boolean} [props.allowNonMatchingLabel] - Whether to allow labels that don't match any option.
 * @param {boolean} [props.noWrapOptions] - Whether to prevent options from wrapping.
 * @param {number} [props.fixedWidth] - Fixed width for the dropdown.
 * @param {string} [props.className] - Additional class names for the dropdown.
 * @param {boolean} [props.isEditable] - Whether the dropdown input is editable.
 * @param {boolean} [props.disableAutoScroll] - Whether to skip the auto-scrolling logic.
 * @param {number} [props.tabIndex] - Tab index for the dropdown input.
 * @returns {React$Node} The rendered dropdown component.
 */
const DropdownSelect = ({
  label,
  options,
  value,
  controlledValue,
  onChange = () => {},
  inputRef,
  compactDisplay = false,
  styles = {},
  fullWidthOptions = false,
  showIndicatorOptionProp = '',
  noWrapOptions = true,
  fixedWidth,
  className = '',
  isEditable = false,
  disabled = false,
  disableAutoScroll = false,
  tabIndex,
}: DropdownSelectProps): React$Node => {
  // Normalize options to a consistent format

  const normalizeOption: (option: string | Option) => Option = (option) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }

  const [isOpen, setIsOpen] = useState(false)
  const normalizedOptions: Array<Option> = useMemo(() => {
    const normalized = options.map(normalizeOption)
    if (value) {
      const normalizedValue = normalizeOption(value)
      const exists = normalized.some((option) => option.value === normalizedValue.value)
      if (!exists) {
        normalized.unshift(normalizedValue)
      }
    }
    return normalized
  }, [options, value])
  const [selectedValue, setSelectedValue] = useState(value ? normalizeOption(value) : options[0] ? normalizeOption(options[0]) : { label: '', value: '' })
  const [inputValue, setInputValue] = useState(selectedValue.label)
  const [calculatedWidth, setCalculatedWidth] = useState(fixedWidth || 200)
  const dropdownRef = useRef<?ElementRef<'div'>>(null)
  const optionsRef = useRef<?ElementRef<'div'>>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [zIndex, setZIndex] = useState(1000)

  // Calculate the width based on the longest option if fixedWidth is not provided
  // v2 calculates in `ch` units; v1 did it in `px` units.
  const calculateWidth = () => {
    if (fixedWidth) return fixedWidth
    const longestOption = normalizedOptions.reduce((max, option) => {
      return option.label.length > max.length ? option.label : max
    }, '')
    // We can still get some ridiculously long options if there are URLs in a heading, so limit to maxChars characters
    // logDebug(`DropdownSelect::calculateWidth`, `longestOption.length: ${longestOption.length} / maxChars: ${maxChars}`)
    return Math.min(longestOption.length, maxChars) // No need in practice to add extra space for padding and dropdown arrow
  }

  useLayoutEffect(() => {
    const width = calculateWidth()
    setCalculatedWidth(width)
  }, [fixedWidth, normalizedOptions])

  // Filter options based on input value only if editable
  const filteredOptions = useMemo(() => {
    if (!isEditable) return normalizedOptions
    if (!inputValue) return normalizedOptions
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(inputValue.toLowerCase()))
  }, [inputValue, normalizedOptions, isEditable])

  // Handle input change
  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    logDebug(`DropdownSelect`, `handleInputChange`, `isEditable: ${String(isEditable)}`)
    if (isEditable) {
      const newValue = event.target.value
      setInputValue(newValue)
      // Keep dropdown open while typing
      setIsOpen(true)
    }
  }

  // Handle input focus
  const handleInputFocus = (event: SyntheticFocusEvent<HTMLInputElement>) => {
    logDebug(`DropdownSelect`, `handleInputFocus`, `isEditable: ${String(isEditable)}`)
    if (isEditable) {
      setIsOpen(true)
    } else {
      event.preventDefault()
    }
  }

  // Helper function to safely normalize an option
  const safeNormalizeOption = (option: ?(string | Option)): Option => {
    if (!option) {
      return { label: '', value: '' } // Default empty option
    }
    return normalizeOption(option)
  }

  // Use controlledValue if provided, otherwise fall back to internal state
  const effectiveValue = controlledValue !== undefined ? safeNormalizeOption(controlledValue) : safeNormalizeOption(value)

  // Update inputValue based on effectiveValue
  useEffect(() => {
    if (!isEditable || !isOpen) {
      setInputValue(effectiveValue.label)
    }
  }, [effectiveValue, isEditable, isOpen])

  // Handle option click
  const handleOptionClick = (option: Option, e?: MouseEvent | KeyboardEvent) => {
    // Stop event from bubbling up
    if (e) {
      e.stopPropagation()
    }
    logDebug(`DropdownSelect`, `option click: ${option.label}`)
    setSelectedValue(option)
    setInputValue(option.label)
    onChange({ label: option.label, value: option.value })
    setIsOpen(false)
    setHighlightedIndex(-1)

    // Focus next tabbable element after animation completes
    setTimeout(() => {
      // Find all tabbable elements in the document
      const allTabbable = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled]), button:not([disabled])'))
      // Find the current input's index
      const currentIndex = allTabbable.findIndex((el) => el === inputRef?.current)
      if (currentIndex >= 0 && currentIndex < allTabbable.length - 1) {
        // Find the next tabbable element that isn't part of this dropdown
        const nextElement = allTabbable.slice(currentIndex + 1).find((el) => {
          return !el.closest('.dropdown-select-container')
        })
        if (nextElement instanceof HTMLElement) {
          nextElement.focus()
        }
      }
    }, 350) // Wait for animation
  }

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = (e: MouseEvent) => {
    logDebug(`DropdownSelect`, `toggleDropdown`, `isOpen: ${String(isOpen)}`)
    // Stop event from bubbling up to prevent clickOutside handler from firing
    if (e) {
      e.stopPropagation()
    }
    // Only toggle closed -> open, never open -> closed via click
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleClickOutside = (event: MouseEvent) => {
    logDebug(`DropdownSelect`, `handleClickOutside`, `isOpen: ${String(isOpen)}`)
    const target = event.target
    if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
      logDebug(`handleClickOutside, am outside, making false`)
      setIsOpen(false)
    }
  }

  // Remove the auto-scroll effect since we want natural dropdown behavior
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    // Cleanup function to ensure the listener is removed when the component unmounts or isOpen changes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(safeNormalizeOption(value))
    }
  }, [value, normalizedOptions])

  // Determine if the selected option should show the indicator
  const selectedOption = normalizedOptions.find((option) => option.value === effectiveValue.value)
  const shouldShowIndicator = showIndicatorOptionProp && selectedOption ? selectedOption[showIndicatorOptionProp] === true : false

  // Calculate z-index based on position in document so that any dropdown overlaps other elements below it properly
  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      // Use the negative of the y position so higher elements get higher z-index
      // Add a base z-index of 1000 to ensure it's above most other elements
      setZIndex(1000 + Math.floor(10000 - rect.top))
    }
  }, [isOpen])

  //----------------------------------------------------------------------
  // Indicator Style Function
  //----------------------------------------------------------------------
  /**
   * Returns style object for the dot indicator.
   *
   * @param {boolean} isVisible - Whether the indicator should be visible.
   * @param {Object} customStyles - Custom styles for the indicator.
   * @returns {Object} Style object for the dot.
   */
  const dot = (isVisible: boolean, customStyles: { [string]: mixed } = {}) =>
    // $FlowFixMe[cannot-spread-indexer]
    ({
      backgroundColor: isVisible ? customStyles.color || 'black' : 'transparent',
      borderRadius: '50%',
      height: 10,
      width: 10,
      marginRight: 8,
      display: 'inline-block',
      flexShrink: 0,
      ...customStyles,
    })

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        if (e.key !== ' ') {
          setHighlightedIndex(e.key === 'ArrowDown' ? 0 : filteredOptions.length - 1)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const option = filteredOptions[highlightedIndex]
          setSelectedValue(option)
          setInputValue(option.label)
          onChange({ label: option.label, value: option.value })
          setIsOpen(false)
          setHighlightedIndex(-1)

          // Focus next tabbable element after animation completes
          setTimeout(() => {
            const allTabbable = document.querySelectorAll('input:not([disabled]), select:not([disabled]), button:not([disabled])')
            const currentIndex = Array.from(allTabbable).findIndex((el) => el === inputRef?.current)
            if (currentIndex >= 0 && currentIndex < allTabbable.length - 1) {
              const nextElement = allTabbable[currentIndex + 1]
              if (nextElement instanceof HTMLElement) {
                nextElement.focus()
              }
            }
          }, 350) // Wait for animation
        }
        break
      case ' ':
        if (!isEditable) {
          e.preventDefault()
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      default:
        break
    }
  }

  // Reset highlighted index when options change or dropdown closes
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions, isOpen])

  return (
    <div
      className={`${compactDisplay ? 'dropdown-select-container-compact' : 'dropdown-select-container'} ${disabled ? 'disabled' : ''} ${className}`}
      ref={dropdownRef}
      style={mergeStyles({}, styles.container)}
    >
      <label className="dropdown-select-label" style={mergeStyles({}, styles.label)}>
        {label}
      </label>
      <div className="dropdown-select-wrapper" style={mergeStyles({}, styles.wrapper)} onClick={disabled ? undefined : toggleDropdown}>
        <div className="dropdown-select-input-container" style={mergeStyles({}, styles.inputContainer || {})}>
          {showIndicatorOptionProp && <span style={dot(shouldShowIndicator, styles.indicator || {})} />}
          <input
            type="text"
            className="dropdown-select-input"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            disabled={disabled}
            readOnly={!isEditable}
            style={mergeStyles({ paddingLeft: showIndicatorOptionProp ? '24px' : '8px' }, styles.input)}
            tabIndex={tabIndex}
          />
          <span className="dropdown-select-arrow" style={mergeStyles({}, styles.arrow)}>
            &#9662;
          </span>
        </div>
        {isOpen && (
          <div
            className="dropdown-select-dropdiv"
            ref={optionsRef}
            style={mergeStyles(
              {
                maxHeight: '80vh',
                overflowY: 'auto',
                zIndex,
              },
              styles.dropdown,
            )}
          >
            {filteredOptions.map((option: Option, i) => {
              if (option.type === 'separator') {
                return <div key={option.value} style={styles.separator}></div>
              }
              const showIndicator = showIndicatorOptionProp && option.hasOwnProperty(showIndicatorOptionProp)
              return (
                <div
                  key={`${option.value}-${i}`}
                  className={`dropdown-select-option ${i === highlightedIndex ? 'highlighted' : ''}`}
                  onClick={(e) => handleOptionClick(option, e)}
                  style={mergeStyles(
                    {
                      padding: '4px 8px',
                      cursor: 'pointer',
                    },
                    styles.option,
                  )}
                >
                  {showIndicator && <span style={dot(option[showIndicatorOptionProp] === true, styles.indicator || {})} />}
                  <span className="option-label" style={noWrapOptions ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}}>
                    {option.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DropdownSelect
