// @flow
import React from 'react'
import Header from './Header.jsx'
import Section from './Section.jsx'
// More imports as necessary

type Props = {
  data: Object /* the data that was sent from the plugin in the field "pluginData" */,
  dispatch: number /* sends a message to the HTML window without necessarily sending info to the plugin */,
  sendActionToPlugin: (command: string, dataToSend: any) => void /* sends a command and data to the plugin */,
}

/**
 * Dashboard component aggregating data and layout for the dashboard.
 */
const Dashboard = ({ data, dispatch, sendActionToPlugin }: Props): React$Node => {
  const {sections, lastUpdated, totalItems} =  data 

  const refreshHandler = () => {
    sendActionToPlugin('refresh', {})
  }

  return (
    <div style={{ maxWidth: '100vw', width: '100vw' }}>
      <div className="dashboard">
        <Header lastUpdated={lastUpdated} totalItems={totalItems} refreshHandler={refreshHandler} />
        {/* Assuming sections data is fetched or defined elsewhere and passed as props */}
        {sections.map((section, index) => (
          <Section key={index} {...section} />
        ))}
      </div>
    </div>
  )
}

export default Dashboard
