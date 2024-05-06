// @flow

import React, { useEffect } from 'react'
import { removeDuplicates } from '../support/sectionHelpers.js'
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
  const { sections: origSections, lastFullRefresh } = pluginData

  const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list
  const sections = reactSettings?.hideDuplicates ? removeDuplicates(origSections.slice(), ['filename', 'content'], sectionPriority) : origSections
  console.log('Dashboard: pluginData:', pluginData, sections)
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
    if (reactSettings?.lastChange && typeof reactSettings.lastChange === 'string' && reactSettings.lastChange.length > 0 && reactSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `React settings updated: ${reactSettings.lastChange} sending to plugin to be saved`, reactSettings)
      const trimmedReactSettings = { ...reactSettings, lastChange: '_Saving', dialogData: { isOpen: false, isTask: true, details: {} } }
      const strReactSettings = JSON.stringify(trimmedReactSettings)
      sendActionToPlugin('reactSettingsChanged', { actionType: 'reactSettingsChanged', reactSettings: strReactSettings }, 'Dashboard reactSettings updated', false)
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
        <Header lastFullRefresh={lastFullRefresh} />
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
