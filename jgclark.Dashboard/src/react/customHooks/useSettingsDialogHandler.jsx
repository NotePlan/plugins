/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Custom hook to handle the SettingsDialog in the Header component.
// Last updated 25.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import { useEffect, useState } from 'react'

type SettingsDialogHandlerReturnType = {
  isDialogOpen: boolean,
  handleToggleDialog: () => void,
};

export const useSettingsDialogHandler = (sendActionToPlugin:Function): SettingsDialogHandlerReturnType => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleToggleDialog = () => {
    setIsDialogOpen(!isDialogOpen)
  }

  useEffect(() => {
    // Add any necessary effect logic here
  }, [isDialogOpen])

  return {
    isDialogOpen,
    handleToggleDialog,
  }
}
