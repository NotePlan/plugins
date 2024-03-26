// @flow
import React from 'react'
import ItemGrid from './ItemGrid.jsx'
import AddButtons from './AddButtons.jsx'
import type { ItemRowType } from './flow-types.js'

type Props = {
  name: string,
  iconString: string,
  description: string,
  items: Array<ItemRowType>,
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
const Section = ({ name, description, items, iconString }: Props): React$Node => {
  return (
    <div className="section">
      <div className="sectionInfo">
        <span className="sidebarDaily sectionName">
          <i className={`sectionIcon fa-light ${iconString}`}></i>
          {name}
        </span>{' '}
        <span className="sectionDescription">
          <span id="section0Count">{description}</span>
          {name === 'Today' ? <AddButtons /> : ''}
        </span>
      </div>
      <ItemGrid items={items} />
    </div>
  )
}

export default Section
