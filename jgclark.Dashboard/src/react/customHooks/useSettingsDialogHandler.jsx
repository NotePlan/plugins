/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Custom hook to handle the SettingsDialog state through reactSettings context.
// Last updated 2024-03-27 for v2.2.0 by @jgclark
//--------------------------------------------------------------------------

import { useAppContext } from '../components/AppContext.jsx'
import type { TReactSettings } from '../../types.js'

type SettingsDialogHandlerReturnType = {
  isDialogOpen: boolean,
  openDialog: (scrollTarget?: ?string) => void,
  closeDialog: () => void,
}

export const useSettingsDialogHandler = (): SettingsDialogHandlerReturnType => {
  const { reactSettings, setReactSettings } = useAppContext()

  const openDialog = (scrollTarget?: ?string): void => {
    setReactSettings((prev: TReactSettings) => ({
      ...prev,
      settingsDialog: {
        ...prev?.settingsDialog,
        isOpen: true,
        scrollTarget,
      },
    }))
  }

  const closeDialog = (): void => {
    setReactSettings((prev: TReactSettings) => ({
      ...prev,
      settingsDialog: {
        ...prev?.settingsDialog,
        isOpen: false,
        scrollTarget: null,
      },
    }))
  }

  return {
    isDialogOpen: reactSettings?.settingsDialog?.isOpen ?? false,
    openDialog,
    closeDialog,
  }
}
