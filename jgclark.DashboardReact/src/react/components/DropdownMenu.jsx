// @flow
import React, { useState } from 'react'
import Switch from './Switch.jsx'

type DropdownMenuProps = {
  items: Array<{
    label: string,
    key: string,
    checked: boolean,
  }>,
  handleSwitchChange: (key: string) => (e: any) => void,
  className?:string
}

const DropdownMenu = ({ items, handleSwitchChange, className }: DropdownMenuProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className={`dropdown ${className}`>
      <i className="fa-solid fa-gear" onClick={toggleMenu}></i>
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
