// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dropdown menu with display toggles.
// Called by Header component.
// Note: the changes-pending message and logic was added late in 2.1.0 beta by @DBW
// "because there were massive race conditions which would happen when you made a change and it started a refresh and then made another change and it would start another refresh, etc."
//
// Last updated 2025-01-16 for v2.1.4
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, useCallback, type Node } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/DropdownMenu.css' // Import the CSS file
import { logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

/**
 * A map of switch keys to their current boolean state.
 */
type SwitchStateMap = { [key: string]: boolean }

type DropdownMenuProps = {
  sectionItems?: Array<TSettingItem>,
  otherItems: Array<TSettingItem>,
  handleSwitchChange?: (key: string) => (e: any) => void,
  handleInputChange?: (key: string, e: any) => void,
  handleComboChange?: (key: string, e: any) => void,
  handleSaveInput?: (key: string) => (newValue: string) => void,
  onSaveChanges: (updatedSettings?: Object) => void,
  iconClass?: string,
  className?: string,
  labelPosition?: 'left' | 'right',
  isOpen: boolean,
  toggleMenu: () => void,
}

//--------------------------------------------------------------------------
// DropdownMenu Component Definition
//--------------------------------------------------------------------------

/**
 * DropdownMenu component to display toggles and input fields for user configuration.
 * @function
 * @param {DropdownMenuProps} props
 * @returns {Node} The rendered component.
 */
function DropdownMenu({
  sectionItems = [],
  otherItems,
  handleSwitchChange = (key: string) => (e: any) => {},
  handleInputChange = (_key, _e) => {},
  handleComboChange = (_key, _e) => {},
  handleSaveInput = (key: string) => (newValue: string) => {},
  onSaveChanges,
  iconClass = 'fa-solid fa-filter',
  className = '',
  labelPosition = 'right',
  isOpen,
  toggleMenu,
}: DropdownMenuProps): Node {
  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const dropdownRef = useRef<?HTMLDivElement>(null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)
  const [localSwitchStates, setLocalSwitchStates] = useState<SwitchStateMap>(() => {
    const initialStates: SwitchStateMap = {}
    ;[...otherItems, ...sectionItems].forEach((item) => {
      if (item.type === 'switch' && item.key) {
        initialStates[item.key] = item.checked || false
      }
    })
    return initialStates
  })

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleFieldChange = (key: string, value: any) => {
    logDebug('DropdownMenu', `menu:"${className}" Field change detected for ${key} with value ${value}`)
    setChangesMade(true)
    setLocalSwitchStates((prevStates) => {
      const revisedSwitchStates = {
        ...prevStates,
        [key]: value,
      }
      logDebug(`DropdownMenu: handleFieldChange: ${key} changed to ${value}, revised localSwitchStates`, { revisedSwitchStates })
      return revisedSwitchStates
    })
  }

  const handleSaveChanges = useCallback(
    (shouldToggleMenu: boolean = true) => {
      logDebug('DropdownMenu/handleSaveChanges:', `menu:"${className}"  changesMade = ${String(changesMade)}`)
      if (changesMade && onSaveChanges) {
        console.log('DropdownMenu', `handleSaveChanges: calling onSaveChanges`, { localSwitchStates })
        onSaveChanges(localSwitchStates)
      }
      setChangesMade(false)
      if (shouldToggleMenu && isOpen) {
        toggleMenu()
      }
    },
    [changesMade, localSwitchStates, onSaveChanges, toggleMenu, isOpen],
  )

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains((event.target: any))) {
        logDebug('DropdownMenu', 'Click outside detected')
        handleSaveChanges()
      }
    },
    [handleSaveChanges],
  )

  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        logDebug('DropdownMenu', 'Escape key detected')
        handleSaveChanges()
      }
    },
    [handleSaveChanges],
  )

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Update localSwitchStates from the sectionItems or otherItems only when
  // the menu is closed. This prevents overwriting user toggles while open.
  useEffect(() => {
    if (!isOpen) {
      const updatedStates: SwitchStateMap = {}
      ;[...otherItems, ...sectionItems].forEach((item) => {
        if (item.type === 'switch' && item.key) {
          updatedStates[item.key] = item.checked || false
        }
      })
      // Only update state if there is a change
      setLocalSwitchStates((prevStates) => {
        const hasChanged = Object.keys(updatedStates).some((key) => updatedStates[key] !== prevStates[key])
        logDebug(`DropdownMenu: useEffect sectionItems or otherItems changed, updating localSwitchStates`, {
          updatedStates,
          prevStates,
          hasChanged,
        })
        return hasChanged ? updatedStates : prevStates
      })
    }
  }, [isOpen, sectionItems, otherItems])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, handleClickOutside, handleEscapeKey])

  // Added useEffect to detect when isOpen changes from true to false
  useEffect(() => {
    if (!isOpen && changesMade) {
      logDebug('DropdownMenu', 'Menu is closing; calling handleSaveChanges')
      handleSaveChanges(false) // We pass false to avoid toggling the menu again
    }
  }, [isOpen, changesMade, handleSaveChanges])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className={`dropdown ${className}`} ref={dropdownRef}>
      <i className={iconClass} onClick={toggleMenu}></i>
      <div className={`dropdown-content  ${isOpen ? 'show' : ''}`}>
        <div className="changes-pending">{changesMade ? `Changes pending. Will be applied when you close the menu.` : ''}</div>
        <div className="column">
          {otherItems.map((item, index) =>
            renderItem({
              index,
              item: { ...item, checked: localSwitchStates[item.key] },
              labelPosition,
              handleFieldChange,
              handleInputChange,
              handleComboChange,
              handleSaveInput,
              showDescAsTooltips: true,
            }),
          )}
        </div>
        {sectionItems.length > 0 && (
          <div className="column">
            {sectionItems.map((item, index) =>
              renderItem({
                index,
                item: { ...item, checked: localSwitchStates[item.key] },
                labelPosition,
                handleFieldChange,
                handleInputChange,
                handleComboChange,
                handleSaveInput,
                showDescAsTooltips: true,
              }),
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DropdownMenu
