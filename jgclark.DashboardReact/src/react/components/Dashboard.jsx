// @flow

import React, { useEffect } from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
import Dialog from './Dialog.jsx'
import { useAppContext, type ReactSettings } from './AppContext.jsx'
import { logDebug } from '@helpers/reactDev.js'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

// Settings which are local to the React window
const defaultReactSettings: ReactSettings = {
  filterPriorityItems: false,
  dialogData: { isOpen: false, isTask: true },
}

logDebug(`Dashboard`, `loading file outside component code`)

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()
  logDebug(`Dashboard`, `inside component code`)

  const { reactSettings, setReactSettings } = useAppContext()

  const { sections, lastUpdated } = pluginData
  console.log('Dashboard: pluginData:', pluginData)
  const { dialogData } = reactSettings ?? {}

  const setDialogOpen = (isOpen: boolean) => {
    setReactSettings((prev) => ({ ...prev, dialogData: { isOpen } }))
  }

  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }

  useEffect(() => logDebug(`Dashboard`, `basic effect running with no deps`), [])

  // set up dialogData in reactSettings if it doesn't exist
  useEffect(() => {
    // Ensure basic reactSettings exists
    if (!reactSettings) {
      logDebug(`Dashboard:`, `reactSettings was null. Setting to: ${JSON.stringify(defaultReactSettings, null, 2)}`)
      if (setReactSettings) {
        setReactSettings((prev) => ({ ...prev, status: 'Dashboard Loaded' }))
      }
    }
  }, [])

  // const handleDialogOpen = () => {
  //   setDialogOpen(true)
  // }
  const handleDialogClose = () => {
    setDialogOpen(false)
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
      <Dialog onClose={handleDialogClose} isOpen={dialogData?.isOpen} isTask={dialogData?.isTask} />
    </div>
  )
}

export default Dashboard
