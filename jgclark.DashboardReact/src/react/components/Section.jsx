// @flow
import React from 'react'
import ItemGrid from './ItemGrid.jsx'
import AddButtons from './AddButtons.jsx'

type ItemProps = {
  status: string,
  content: string,
}

type Props = {
  name: string,
  iconString: string,
  description: string,
  items: Array<ItemProps>,
  sendActionToPlugin: (command: string, dataToSend: any) => void /* sends a command and data to the plugin */,
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
const Section = ({ name, description, items, sendActionToPlugin, iconString }: Props): React$Node => {
  return (
    <div className="section">
      <div className="sectionInfo">
        <span className="sidebarDaily sectionName">
          <i className={`sectionIcon fa-light ${iconString}`}></i>
          {name}
        </span>
        {" "}
        <span className="sectionDescription">
          <span id="section0Count">{description}</span>
          { name === "Today" ? <AddButtons sendActionToPlugin={sendActionToPlugin}/>: ''}
        </span>
      </div>
      <ItemGrid items={items} />
    </div>
  )
}

export default Section
