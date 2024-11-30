// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML DropdownSelect control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, type ElementRef } from 'react'
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
  value: string | Option,
  onChange: ({ [string]: mixed }) => void,
  inputRef?: { current: null | HTMLInputElement },
  compactDisplay?: boolean,
  disabled?: boolean,
  styles?: Styles,
  fullWidthOptions?: boolean,
  showIndicatorOptionProp?: string,
  allowNonMatchingLabel?: boolean,
  noWrapOptions?: boolean,
  fixedWidth?: number,
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
  fixedWidth = 200, // Default fixed width
}: DropdownSelectProps): React$Node => {
  // Normalize options to a consistent format

  const normalizeOption: (option: string | Option) => Option = (option) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }

  const [isOpen, setIsOpen] = useState(false)
  const normalizedOptions: Array<Option> = useMemo(() => options.map(normalizeOption), [options])
  const [selectedValue, setSelectedValue] = useState(normalizeOption(value))
  const dropdownRef = useRef<?ElementRef<'div'>>(null)
  const optionsRef = useRef<?ElementRef<'div'>>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = () => {
    logDebug(`toggle click`)
    setIsOpen(!isOpen)
  }

  const handleOptionClick = (option: Option) => {
    logDebug(`option click`, option.toString())
    setSelectedValue(option)
    // $FlowFixMe[incompatible-call]
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event: MouseEvent) => {
    logDebug(`handleClickOutside, need to look if outside`)
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
      logDebug(`DropdownSelect useEffect: Adding mousedown listener`)
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      logDebug(`DropdownSelect useEffect: Removing mousedown listener`)
      document.removeEventListener('mousedown', handleClickOutside)
    }

    // Cleanup function to ensure the listener is removed when the component unmounts or isOpen changes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    logDebug(`DropdownSelect useEffect 1`)
    setSelectedValue(normalizeOption(value)) // We need to allow for the value to be something that is not in the options (like Work*)
  }, [value, normalizedOptions])

  useEffect(() => {
    logDebug(`DropdownSelect useEffect 2 isOpen=${String(isOpen)}`)
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

  logDebug(`DropdownSelect Rendering: isOpen=${String(isOpen)} options.length=${normalizedOptions.length}`)
  return (
    <div
      className={`${compactDisplay ? 'dropdown-select-container-compact' : 'dropdown-select-container'} ${disabled ? 'disabled' : ''}`}
      ref={dropdownRef}
      style={mergeStyles({}, styles.container)}
    >
      <label className="dropdown-select-label" style={mergeStyles({}, styles.label)}>
        {label}
      </label>
      <div className="dropdown-select-wrapper" style={mergeStyles({ width: `${fixedWidth}px` }, styles.wrapper)} onClick={disabled ? undefined : toggleDropdown}>
        <div
          className="dropdown-select-input-container"
          style={mergeStyles(
            {
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              width: `${fixedWidth}px`,
            },
            styles.inputContainer || {},
          )}
        >
          {showIndicatorOptionProp && <span style={dot(shouldShowIndicator, styles.indicator || {})} />}
          <input
            type="text"
            className="dropdown-select-input"
            value={selectedValue?.label || ''}
            readOnly
            ref={inputRef}
            disabled={disabled}
            style={mergeStyles({ paddingLeft: showIndicatorOptionProp ? '24px' : '8px', paddingRight: '24px' }, styles.input)}
          />
          <span className="dropdown-select-arrow" style={mergeStyles({}, styles.arrow)}>
            &#9662;
          </span>
        </div>
        {isOpen && (
          <div className="dropdown-select-dropdiv" ref={optionsRef} style={mergeStyles({ width: `${fixedWidth}px` }, styles.dropdown)}>
            {normalizedOptions.map((option: Option) => {
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
