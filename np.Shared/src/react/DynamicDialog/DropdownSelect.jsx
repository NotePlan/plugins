// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML DropdownSelect control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef } from 'react'

type DropdownSelectProps = {
  label: string,
  options: Array<string>,
  value: string,
  onChange: (value: string) => void,
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop type
  compactDisplay?: boolean,
  disabled?: boolean,
}

const DropdownSelect = ({
  label,
  options,
  disabled,
  value,
  onChange,
  inputRef,
  compactDisplay = false,
}: DropdownSelectProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const dropdownRef = useRef<?ElementRef<'div'>>(null)
  const optionsRef = useRef<?ElementRef<'div'>>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = () => setIsOpen(!isOpen)

  const handleOptionClick = (option: string) => {
    setSelectedValue(option)
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target
    if (
      dropdownRef.current &&
      target instanceof Node &&
      !dropdownRef.current.contains(target)
    ) {
      setIsOpen(false)
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Function to find the nearest scrollable ancestor
  const findScrollableAncestor = (el: HTMLElement): ?HTMLElement => {
    console.log('findScrollableAncestor called with el:', el)
    let currentEl: ?Element = el // Allow currentEl to be Element or null
    while (currentEl && currentEl.parentElement) {
      currentEl = currentEl.parentElement
      // Check if currentEl is an HTMLElement
      if (currentEl instanceof HTMLElement) {
        const style = window.getComputedStyle(currentEl)
        const overflowY = style.overflowY
        const isScrollable =
          (overflowY === 'auto' || overflowY === 'scroll') &&
          currentEl.scrollHeight > currentEl.clientHeight
        if (isScrollable) {
          console.log('Found scrollable ancestor:', currentEl)
          return currentEl // currentEl is HTMLElement here
        }
      } 
    }
    console.log('No scrollable ancestor found')
    return null
  }

  // Effect to adjust scroll when the dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current && optionsRef.current) {
      setTimeout(() => {
        if (!dropdownRef.current || !optionsRef.current) return
        const dropdown: HTMLElement = dropdownRef.current
        const options: HTMLElement = optionsRef.current

        // Get the bounding rects
        const dropdownRect = dropdown.getBoundingClientRect()
        const optionsRect = options.getBoundingClientRect()

        // Combine the rects to get the total area
        const totalTop = Math.min(dropdownRect.top, optionsRect.top)
        const totalBottom = Math.max(dropdownRect.bottom, optionsRect.bottom)

        // Create a totalRect object
        const totalRect = {
          top: totalTop,
          bottom: totalBottom,
        }

        console.log('Total rect:', totalRect)

        // Find the scrollable container
        const scrollableContainer = findScrollableAncestor(dropdown)
        console.log('Scrollable container:', scrollableContainer)

        if (scrollableContainer) {
          const containerRect = scrollableContainer.getBoundingClientRect()
          console.log('Container rect:', containerRect)

          const isOutOfView =
            totalRect.bottom > containerRect.bottom ||
            totalRect.top < containerRect.top
          console.log('Is dropdown out of view?', isOutOfView)

          if (isOutOfView) {
            // Calculate the offset to scroll
            let offset =
              scrollableContainer.scrollTop +
              (totalRect.bottom - containerRect.bottom)
            if (totalRect.top < containerRect.top) {
              offset =
                scrollableContainer.scrollTop -
                (containerRect.top - totalRect.top)
            }
            console.log('Scrolling container to offset:', offset)
            scrollableContainer.scrollTo({
              top: offset,
              behavior: 'smooth',
            })
          } else {
            console.log('Dropdown is already in view.')
          }
        } else {
          console.log('No scrollable container found.')
        }
      }, 100) // Adjust the delay as needed
    }
  }, [isOpen])

  return (
    <div
      className={`${
        compactDisplay ? 'dropdown-container-compact' : 'dropdown-container'
      } ${disabled ? 'disabled' : ''}`}
      ref={dropdownRef} // Attach the ref to the outer container
    >
      <label className="dropdown-label">{label}</label>
      <div className="dropdown-wrapper" onClick={toggleDropdown}>
        <input
          type="text"
          className="dropdown-input"
          value={selectedValue}
          readOnly
          ref={inputRef} // Pass the inputRef to the input element
        />
        <span className="dropdown-arrow">&#9662;</span>
        {isOpen && (
          <div className="dropdown-dropdown" ref={optionsRef}>
            {options.map((option: string) => (
              <div
                key={option}
                className="dropdown-option"
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DropdownSelect
