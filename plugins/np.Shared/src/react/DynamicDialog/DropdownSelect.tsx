// @flow
//--------------------------------------------------------------------------
// React component to show an HTML DropdownSelect control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
// TODO: Have not fully tested the isEditable feature
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, type ElementRef, useLayoutEffect } from 'react'
import './DropdownSelect.css'
import { clo, logDebug } from '@np/helpers/react/reactDev'

declare var NP_THEME: any

export type Option = {
  label: string,
  value: string,
  [k: string]: any, // Allow additional properties (e.g. isModified)
}

type Styles = {
  container?: { [k: string]: unknown },
  label?: { [k: string]: unknown },
  wrapper?: { [k: string]: unknown },
  inputContainer?: { [k: string]: unknown },
  input?: { [k: string]: unknown },
  arrow?: { [k: string]: unknown },
  dropdown?: { [k: string]: unknown },
  option?: { [k: string]: unknown },
  indicator?: { [k: string]: unknown }, // Style for the indicator
  separator?: { [k: string]: unknown }, // Style for the separator
}

type DropdownSelectProps = {
  label: string,
  options: Array<string | Option>,
  value: string | Option,
  onChange: (arg: { [k: string]: unknown }) => void,
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
const mergeStyles = (baseStyles: { [k: string]: unknown }, overrideStyles: { [k: string]: unknown } = {}) => {
  return { ...baseStyles, ...overrideStyles }
}

const DropdownSelect = ({
  label,
  options,
  disabled,
  value,
  onChange,
  inputRef,
  compactDisplay = false,
  styles = {},
  fullWidthOptions = false,
  showIndicatorOptionProp = '',
  noWrapOptions = true,
  fixedWidth,
  className = '',
  isEditable = false,
}: DropdownSelectProps): React.ReactNode => {
  // Normalize options to a consistent format

  const normalizeOption: (option: string | Option) => Option = (option) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }

  const [isOpen, setIsOpen] = useState(false)
  const normalizedOptions: Array<Option> = useMemo(() => options.map(normalizeOption), [options])
  const [selectedValue, setSelectedValue] = useState(normalizeOption(value))
  const [inputValue, setInputValue] = useState(selectedValue.label)
  const [calculatedWidth, setCalculatedWidth] = useState(fixedWidth || 200) // Initial width
  const dropdownRef = useRef<null | ElementRef<'div'>>(null)
  const optionsRef = useRef<null | ElementRef<'div'>>(null)

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
  const handleInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (isEditable) {
      // @ts-expect-error
      setInputValue(event.target.value)
      setIsOpen(true) // Open dropdown when typing
    }
  }

  // Handle option click
  const handleOptionClick = (option: Option) => {
    logDebug(`DropdownSelect`, `option click: ${option.label}`)
    setSelectedValue(option)
    setInputValue(option.label) // Update inputValue with the selected option's label
    onChange(option)
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

  const findScrollableAncestor = (el: HTMLElement): null | void | HTMLElement => {
    let currentEl: null | void | Element = el
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
    setSelectedValue(normalizeOption(value)) // We need to allow for the value to be something that is not in the options (like Work*)
  }, [value, normalizedOptions])

  useEffect(() => {
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
  }, [isOpen])

  // Determine if the selected option should show the indicator
  const selectedOption = normalizedOptions.find((option) => option.value === selectedValue.value)
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
  const dot = (isVisible: boolean, customStyles: { [k: string]: unknown } = {}) => ({
    // @ts-expect-error
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
          {showIndicatorOptionProp && <span style={dot(shouldShowIndicator, styles.indicator || {}) as any} />}
          <input
            type="text"
            className="dropdown-select-input"
            value={inputValue}
            onChange={handleInputChange} // Handle input change
            ref={inputRef}
            disabled={disabled}
            readOnly={!isEditable} // Set readOnly based on isEditable prop
            style={mergeStyles({ paddingLeft: showIndicatorOptionProp ? '24px' : '8px', paddingRight: '24px' }, styles.input)}
          />
          <span className="dropdown-select-arrow" style={mergeStyles({}, styles.arrow)}>
            &#9662;
          </span>
        </div>
        {isOpen && (
          <div className="dropdown-select-dropdiv" ref={optionsRef} style={mergeStyles({ width: `${calculatedWidth}px` }, styles.dropdown)}>
            {filteredOptions.map((option: Option) => {
              // @ts-expect-error
              if (option.type === 'separator') {
                return <div key={option.value} style={styles.separator}></div>
              }
              const showIndicator = showIndicatorOptionProp && option.hasOwnProperty(showIndicatorOptionProp)
              return (
                <div
                  key={option.value}
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
                  {showIndicator && <span style={dot(option[showIndicatorOptionProp] === true, styles.indicator || {}) as any} />}
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
