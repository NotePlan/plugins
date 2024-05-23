// @flow
import { useEffect } from 'react'
import { logDebug } from '@helpers/react/reactDev.js'

const useSharedSettingsLogger = (sharedSettings: any) => {
  useEffect(() => {
    // Log the sharedSettings to see when it changes
    logDebug('Header', 'sharedSettings updated', sharedSettings)
  }, [sharedSettings])
}

export default useSharedSettingsLogger
