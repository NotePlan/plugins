// @flow

import React from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
// import { useAppContext } from './AppContext.jsx'

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
const Dashboard = ({ pluginData }: Props): React$Node => {
  //   const { sendActionToPlugin, sendToPlugin, dispatch, pluginData }  = useAppContext()
  const { sections, lastUpdated } = pluginData
  const dashboardContainerStyle = {
    maxWidth: '100vw',
    width: '100vw',
  }
  return (
    <div style={dashboardContainerStyle}>
      <div className="dashboard">
        <Header lastUpdated={lastUpdated} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} {...section} />
        ))}
      </div>
    </div>
  )
}

export default Dashboard
