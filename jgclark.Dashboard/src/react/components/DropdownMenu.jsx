// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dropdown menu with display toggles.
// Called by Header component.
// Last updated 2024-08-27 for v2.1.a10 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/DropdownMenu.css' // Import the CSS file
import { logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type DropdownMenuProps = {
  sectionItems?: Array<TSettingItem>,
  otherItems: Array<TSettingItem>,
  handleSwitchChange?: (key: string, e: any) => void,
  handleInputChange?: (key: string, e: any) => void,
  handleComboChange?: (key: string, e: any) => void,
  handleSaveInput?: (key: string, newValue: string) => void,
  onSaveChanges?: () => void,
  iconClass?: string,
  className?: string,
  labelPosition?: 'left' | 'right',
  isOpen: boolean,
  toggleMenu: () => void,
}

//--------------------------------------------------------------------------
// DropdownMenu Component Definition
//--------------------------------------------------------------------------

const DropdownMenu = ({
  sectionItems = [],
  otherItems,
  handleSwitchChange = (key, e) => {},
  handleInputChange = (key, e) => {},
  handleComboChange = (key, e) => {},
  handleSaveInput = (key, newValue) => {},
  onSaveChanges,
  iconClass = 'fa-solid fa-filter',
  className,
  labelPosition = 'right',
  isOpen,
  toggleMenu,
}: DropdownMenuProps): React$Node => {
  // logDebug('DropdownMenu', `Starting with ${otherItems.length} otherItems and ${sectionItems ? sectionItems.length : 0} sectionItems`)
  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const dropdownRef = useRef<?HTMLDivElement>(null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  const handleClickOutside = (event: MouseEvent) => {
    if ((dropdownRef.current && !(event.target instanceof Node)) || (dropdownRef.current && !dropdownRef.current.contains((event.target: any)))) {
      handleSaveChanges()
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleFieldChange = () => {
    logDebug('DropdownMenu', 'Field change detected')
    setChangesMade(true)
  }

  const handleSaveChanges = () => {
    if (changesMade && onSaveChanges) {
      onSaveChanges()
      setChangesMade(false)
    }
    toggleMenu()
  }

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      logDebug('DropdownMenu', 'Escape key detected')
      handleSaveChanges()
    }
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className={`dropdown ${className || ''}`} ref={dropdownRef}>
      <i className={iconClass} onClick={toggleMenu}></i>
      <div className={`dropdown-content  ${isOpen ? 'show' : ''}`}>
        <div className="column">
          {otherItems.map((item, index) =>
            renderItem({
              index,
              item,
              labelPosition,
              handleFieldChange,
              handleSwitchChange,
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
                item,
                labelPosition,
                handleFieldChange,
                handleSwitchChange,
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
