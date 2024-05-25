// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dropdown menu with display toggles.
// Called by Header component.
// Last updated 25.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react'
import type { TDropdownItem } from '../../types'
import Switch from './Switch.jsx'
import InputBox from './InputBox.jsx'
import ComboBox from './ComboBox.jsx'
import TextComponent from './TextComponent.jsx'
import '../css/DropdownMenu.css' // Import the CSS file

type DropdownMenuProps = {
  items: Array<TDropdownItem>,
  handleSwitchChange?: (key: string) => (e: any) => void,
  handleInputChange?: (key: string) => (e: any) => void,
  handleComboChange?: (key: string) => (e: any) => void,
  handleSaveInput?: (key: string) => (newValue: string) => void,
  onChangesMade?: () => void,
  iconClass?: string,
  className?: string,
  labelPosition?: 'left' | 'right',
  isOpen: boolean,
  toggleMenu: () => void,
  style?: Object, // Add style prop
};

const DropdownMenu = ({
  items,
  handleSwitchChange,
  handleInputChange,
  handleComboChange,
  handleSaveInput,
  onChangesMade,
  iconClass = 'fa-solid fa-filter',
  className,
  labelPosition = 'right',
  isOpen,
  toggleMenu,
  style, // Destructure style prop
}: DropdownMenuProps): React$Node => {
  const dropdownRef = useRef<?HTMLDivElement>(null)
  const [changesMade, setChangesMade] = useState(false)

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !(event.target instanceof Node) || (dropdownRef.current &&!dropdownRef.current.contains((event.target: any)))
    ) {
      if (changesMade && onChangesMade) {
        onChangesMade()
      }
      toggleMenu()
    }
  }

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (changesMade && onChangesMade) {
        onChangesMade()
      }
      toggleMenu()
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

  const handleFieldChange = () => {
    setChangesMade(true)
  }

  const renderItem = (item: TDropdownItem) => {
    const element = () => {
      switch (item.type) {
        case 'switch':
          return (
            <Switch
              key={item.key}
              label={item.label || ''}
              checked={item.checked || false}
              onChange={(e) => {
                handleFieldChange()
                if (handleSwitchChange) {
                  handleSwitchChange(item.key)(e)
                }
              }}
              labelPosition={labelPosition}
            />
          )
        case 'input':
          return (
            <InputBox
              key={item.key}
              label={item.label || ''}
              value={item.value || ''}
              onChange={(e) => {
                handleFieldChange()
                if (handleInputChange) {
                  handleInputChange(item.key)(e)
                }
              }}
              onSave={(newValue) => {
                handleFieldChange()
                if (handleSaveInput) {
                  handleSaveInput(item.key)(newValue)
                }
              }}
            />
          )
        case 'combo':
          return (
            <ComboBox
              key={item.key}
              label={item.label || ''}
              options={item.options || []}
              value={item.value || ''}
              onChange={(e) => {
                handleFieldChange()
                if (handleComboChange) {
                  handleComboChange(item.key)(e)
                }
              }}
            />
          )
        case 'text':
          return (
            <TextComponent
              key={item.key}
              textType={item.textType || 'description'}
              label={item.label || ''}
            />
          )
        case 'separator':
          return <hr key={item.key} />
        case 'heading':
          return <div className="dropdown-heading" key={item.key}>{item.label || ''}</div>
        case 'header':
          return <div className="dropdown-header" key={item.key}>{item.label || ''}</div>
        default:
          return null
      }
    }

    return (
      <div className="dropdown-item" key={item.key} title={item.tooltip || ''}>
        {element()}
      </div>
    )
  }

  return (
    <div className={`dropdown ${className || ''}`} ref={dropdownRef}>
      <i className={iconClass} onClick={toggleMenu}></i>
      <div className={`dropdown-content ${isOpen ? 'show' : ''}`} style={style}>
        {items.map(renderItem)}
      </div>
    </div>
  )
}

export default DropdownMenu
