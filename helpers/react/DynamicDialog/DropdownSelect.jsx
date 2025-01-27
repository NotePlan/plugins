// @flow
//--------------------------------------------------------------------------
// React component to show an HTML DropdownSelect control, with various possible settings.
// Uses basic HTML controls; it's not a fancy React Component.
// Written by @dwertheimer
// TODO: Have not fully tested the isEditable feature
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, type ElementRef, useLayoutEffect } from 'react'
import './DropdownSelect.css'
import { clo, logDebug } from '@helpers/react/reactDev'

declare var NP_THEME: any

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
  const [calculatedWidth, setCalculatedWidth] = useState(fixedWidth || 200) // Initial width
  const dropdownRef = useRef<?ElementRef<'div'>>(null)
  const optionsRef = useRef<?ElementRef<'div'>>(null)

  // Calculate the width based on the longest option if fixedWidth is not provided
  const calculateWidth = () => {
    if (fixedWidth) return fixedWidth
    const longestOption = normalizedOptions.reduce((max, option) => {
      return option.label.length > max.length ? option.label : max
    }, '')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (context && dropdownRef.current) {
      const computedStyle = window.getComputedStyle(dropdownRef.current)
      context.font = computedStyle.font || '16px Arial' // Use computed font from CSS
      const textWidth = context.measureText(longestOption).width
      return textWidth + 40 // Add extra space for padding and dropdown arrow
    }
    return 200 // Fallback width
  }

  useLayoutEffect(() => {
    const width = calculateWidth()
    setCalculatedWidth(width)
  }, [fixedWidth, normalizedOptions])

  // Filter options based on input value only if editable
  const filteredOptions = useMemo(() => {
    if (!isEditable) return normalizedOptions
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(inputValue.toLowerCase()))
  }, [inputValue, normalizedOptions, isEditable])

  // Handle input change
  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    if (isEditable) {
      setInputValue(event.target.value)
      setIsOpen(true) // Open dropdown when typing
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
    setInputValue(effectiveValue.label)
  }, [effectiveValue])

  // Handle option click
  const handleOptionClick = (option: Option) => {
    logDebug(`DropdownSelect`, `option click: ${option.label}`)
    setSelectedValue(option)
    setInputValue(option.label) // Update inputValue with the selected option's label
    onChange({ label: option.label, value: option.value }) // Ensure onChange is called with a valid object
    setIsOpen(false)
  }

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target
    if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
      logDebug(`handleClickOutside, am outside, making false`)
      setIsOpen(false)
    }
  }

  const findScrollableAncestor = (el: HTMLElement): ?HTMLElement => {
    let currentEl: ?Element = el
    while (currentEl && currentEl.parentElement) {
      currentEl = currentEl.parentElement
      if (currentEl instanceof HTMLElement) {
        const style = window.getComputedStyle(currentEl)
        const overflowY = style.overflowY
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && currentEl.scrollHeight > currentEl.clientHeight
        if (isScrollable) {
          logDebug(`Found scrollable ancestor: `)
          return currentEl
        }
      }
    }
    return null
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

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

  useEffect(() => {
    if (false) {
      // dbw: commenting this out for now, as I'm not sure it's working as expected
      if (isOpen && dropdownRef.current && optionsRef.current) {
        setTimeout(() => {
          if (!dropdownRef.current || !optionsRef.current) return
          const dropdown: HTMLElement = dropdownRef.current
          const options: HTMLElement = optionsRef.current

          const dropdownRect = dropdown.getBoundingClientRect()
          const optionsRect = options.getBoundingClientRect()

          const totalTop = Math.min(dropdownRect.top, optionsRect.top)
          const totalBottom = Math.max(dropdownRect.bottom, optionsRect.bottom)

          const totalRect = {
            top: totalTop,
            bottom: totalBottom,
          }

          const scrollableContainer = findScrollableAncestor(dropdown)

          if (scrollableContainer) {
            const containerRect = scrollableContainer.getBoundingClientRect()

            const isOutOfView = totalRect.bottom > containerRect.bottom || totalRect.top < containerRect.top

            if (isOutOfView) {
              let offset = scrollableContainer.scrollTop + (totalRect.bottom - containerRect.bottom)
              if (totalRect.top < containerRect.top) {
                offset = scrollableContainer.scrollTop - (containerRect.top - totalRect.top)
              }
              scrollableContainer.scrollTo({
                top: offset,
                behavior: 'smooth',
              })
            }
          }
        }, 100)
      }
    }
  }, [isOpen])

  // Determine if the selected option should show the indicator
  const selectedOption = normalizedOptions.find((option) => option.value === effectiveValue.value)
  const shouldShowIndicator = showIndicatorOptionProp && selectedOption ? selectedOption[showIndicatorOptionProp] === true : false

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

  return (
    <div
      className={`${compactDisplay ? 'dropdown-select-container-compact' : 'dropdown-select-container'} ${disabled ? 'disabled' : ''} ${className}`}
      ref={dropdownRef}
      style={mergeStyles({}, styles.container)}
    >
      <label className="dropdown-select-label" style={mergeStyles({}, styles.label)}>
        {label}
      </label>
      <div className="dropdown-select-wrapper" style={mergeStyles({ width: `${calculatedWidth}px` }, styles.wrapper)} onClick={disabled ? undefined : toggleDropdown}>
        <div
          className="dropdown-select-input-container"
          style={mergeStyles(
            {
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              width: `${calculatedWidth}px`,
            },
            styles.inputContainer || {},
          )}
        >
          {showIndicatorOptionProp && <span style={dot(shouldShowIndicator, styles.indicator || {})} />}
          <input
            type="text"
            className="dropdown-select-input"
            value={inputValue}
            onChange={handleInputChange} // Handle input change
            ref={inputRef}
            disabled={disabled}
            readOnly={!isEditable} // Set readOnly based on isEditable prop
            style={mergeStyles({ paddingLeft: showIndicatorOptionProp ? '24px' : '8px' }, styles.input)} // TODO: Ideally find a way to do this in CSS, rather than here. Also do we use Indicator?
          />
          <span className="dropdown-select-arrow" style={mergeStyles({}, styles.arrow)}>
            &#9662;
          </span>
        </div>
        {isOpen && (
          <div className="dropdown-select-dropdiv" ref={optionsRef} style={mergeStyles({ width: `${calculatedWidth}px` }, styles.dropdown)}>
            {filteredOptions.map((option: Option, i) => {
              if (option.type === 'separator') {
                return <div key={option.value} style={styles.separator}></div>
              }
              const showIndicator = showIndicatorOptionProp && option.hasOwnProperty(showIndicatorOptionProp)
              return (
                <div
                  key={`${option.value}-${i}`}
                  className={`dropdown-select-option`}
                  onClick={() => handleOptionClick(option)}
                  style={mergeStyles(
                    {
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
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
