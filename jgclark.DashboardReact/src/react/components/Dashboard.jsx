// @flow

import React, { useEffect } from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
import Dialog from './Dialog.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

logDebug(`Dashboard`, `loading file outside component code`)

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()
  logDebug(`Dashboard`, `inside component code`)

  const { reactSettings, setReactSettings, sendActionToPlugin } = useAppContext()

  const { sections, lastUpdated } = pluginData
  console.log('Dashboard: pluginData:', pluginData)
  const { dialogData } = reactSettings ?? {}

  const updateDialogOpen = (isOpen: boolean) => {
    // generally only used for closing dialog
    setReactSettings((prev) => ({ ...prev, dialogData: { isOpen }, lastChange: `_Dashboard-DialogClosed` }))
  }

  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }

  useEffect(() => {
    if (reactSettings?.lastChange && reactSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `React settings updated: ${reactSettings.lastChange} sending to plugin to be saved`, reactSettings)
      const trimmedReactSettings = { ...reactSettings, lastChange: '_PluginSettingsLoaded', dialogData: { isOpen: false, isTask: true, details: {} } }
      const strReactSettings = JSON.stringify(trimmedReactSettings)
      sendActionToPlugin('reactSettingsChanged', strReactSettings, 'Dashboard reactSettings updated', false)
    }
  }, [reactSettings])

  // const handleDialogOpen = () => {
  //   updateDialogOpen(true)
  // }
  const handleDialogClose = () => {
    updateDialogOpen(false)
  }
  return (
    <div style={dashboardContainerStyle}>
      {/* CSS for this part is in dashboard.css */}
      <div className="dashboard">
        <Header lastUpdated={lastUpdated} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
      </div>
      <Dialog onClose={handleDialogClose} isOpen={dialogData?.isOpen || false} isTask={dialogData?.isTask || true} details={dialogData?.details || {}} />
    </div>
  )
}

export default Dashboard
