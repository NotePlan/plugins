// @flow

import React from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
import Dialog from './Dialog.jsx'
import { useAppContext } from './AppContext.jsx'

// import { useAppContext } from './AppContext.jsx'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
function Dashboard({ pluginData }: Props): React$Node {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()
  const { reactSettings, updateReactSettings } = useAppContext()

  const { sections, lastUpdated } = pluginData
  console.log('Dashboard: pluginData:', pluginData)
  const { dialogData } = reactSettings

  const setDialogOpen = (isOpen: boolean) => {
    updateReactSettings({ ...reactSettings, dialogData: { isOpen } })
  }

  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }

  const handleDialogOpen = () => {
    setDialogOpen(true)
  }
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
      <Dialog onClose={handleDialogClose} isOpen={dialogData?.isOpen} />
    </div>
  )
}

export default Dashboard
