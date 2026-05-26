// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dropdown menu with display toggles.
// Called by Header component.
// Note: the changes-pending message and logic was added late in 2.1.0 beta by @DBW
// "because there were massive race conditions which would happen when you made a change and it started a refresh and then made another change and it would start another refresh, etc."
//
// Last updated 2026-05-25 for v2.4.0.b44 by @CursorAI
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, useCallback, type Node } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/DropdownMenu.css' // Import the CSS file
import { logDebug } from '@helpers/dev'

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
  accessKey?: string,
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
  handleSwitchChange: _handleSwitchChange = (_key: string) => (_e: any) => {},
  handleInputChange = (_key, _e) => {},
  handleComboChange = (_key, _e) => {},
  handleSaveInput = (_key: string) => (_newValue: string) => {},
  onSaveChanges,
  iconClass = 'fa-solid fa-filter',
  className = '',
  labelPosition = 'right',
  isOpen,
  toggleMenu,
  accessKey = '',
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

  // Adapt the handleSaveInput function for renderItem
  const adaptedHandleSaveInput = (key: string, newValue: string) => {
    if (key) {
      handleSaveInput(key)(newValue)
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // When the menu closes with pending toggles, save first (while localSwitchStates still
  // reflects user edits). Syncing from props before save wiped FFlags when closing via the header icon.
  useEffect(() => {
    if (!isOpen && changesMade) {
      logDebug('DropdownMenu', `Menu "${className}" closing with pending changes; calling handleSaveChanges`)
      handleSaveChanges(false)
      return
    }
    if (!isOpen) {
      const updatedStates: SwitchStateMap = {}
      ;[...otherItems, ...sectionItems].forEach((item) => {
        if (item.type === 'switch' && item.key) {
          updatedStates[item.key] = item.checked || false
        }
      })
      setLocalSwitchStates((prevStates) => {
        const hasChanged = Object.keys(updatedStates).some((key) => updatedStates[key] !== prevStates[key])
        return hasChanged ? updatedStates : prevStates
      })
    }
  }, [isOpen, changesMade, handleSaveChanges, sectionItems, otherItems, className])

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

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div accessKey={accessKey} className={`button dropdown ${className}`} ref={dropdownRef}>
      <i className={iconClass} onClick={toggleMenu}></i>
      <div className={`dropdown-content  ${isOpen ? 'show' : ''}`}>
        <div className="changes-pending">{changesMade ? `Changes pending. Will be applied when you close the menu.` : ''}</div>
        <div className="column">
          {otherItems.map((item, index) =>
            renderItem({
              index,
              item: { ...item, checked: item.key ? localSwitchStates[item.key] : false },
              labelPosition,
              handleFieldChange,
              handleInputChange,
              handleComboChange,
              handleSaveInput: adaptedHandleSaveInput,
              showDescAsTooltips: true,
            }),
          )}
        </div>
        {sectionItems.length > 0 && (
          <div className="column">
            {sectionItems.map((item, index) =>
              renderItem({
                index,
                item: { ...item, checked: item.key ? localSwitchStates[item.key] : false },
                labelPosition,
                handleFieldChange,
                handleInputChange,
                handleComboChange,
                handleSaveInput: adaptedHandleSaveInput,
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
