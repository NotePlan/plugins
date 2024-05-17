// @flow
//--------------------------------------------------------------------------
// The dropdown menu with toggles for what to show.
// Called by Header component.
// Last updated 10.5.2024 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------
import React, { useState } from 'react'
import Switch from './Switch.jsx'

type DropdownMenuProps = {
  items: Array<{
    label: string,
    key: string,
    checked: boolean,
  }>,
  handleSwitchChange: (key: string) => (e: any) => void,
  className?: string,
}

const DropdownMenu = ({ items, handleSwitchChange, className }: DropdownMenuProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className={`dropdown ${className || ''}`}>
      <i className="fa-solid fa-filter" onClick={toggleMenu}></i>
      {isOpen && (
        <div className="dropdown-content">
          {items.map((item) => (
            <Switch key={item.key} label={item.label} checked={item.checked} onChange={handleSwitchChange(item.key)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default DropdownMenu
