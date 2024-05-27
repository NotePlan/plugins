// @flow
//--------------------------------------------------------------------------
// Custom hook to handle dropdown menus in the Header component.
// Last updated 25.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import { useEffect, useState } from 'react'

type DropdownMenuHandlerReturnType = {
  openDropdownMenu: string | null,
  dropdownMenuChangesMade: boolean,
  setDropdownMenuChangesMade: (value: boolean) => void,
  handleToggleDropdownMenu: (dropdown: string) => void,
};

export const useDropdownMenuHandler = (onChangesMade: () => void): DropdownMenuHandlerReturnType => {
  const [openDropdownMenu, setOpenDropdownMenu] = useState<string | null>(null)
  const [dropdownMenuChangesMade, setDropdownMenuChangesMade] = useState(false)

  const handleToggleDropdownMenu = (dropdown: string) => {
    setOpenDropdownMenu(openDropdownMenu === dropdown ? null : dropdown)
  }

  useEffect(() => {
    onChangesMade()
  }, [openDropdownMenu, dropdownMenuChangesMade])

  return {
    openDropdownMenu,
    dropdownMenuChangesMade,
    setDropdownMenuChangesMade,
    handleToggleDropdownMenu,
  }
}
