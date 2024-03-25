// @flow
import React from 'react'
import ItemGrid from './ItemGrid.jsx'

type ItemProps = {
  status: string,
  content: string,
}

type Props = {
  name: string,
  description: string,
  items: Array<ItemProps>,
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
const Section = ({ name, description, items }: Props): React$Node => {
  return (
    <div className="section">
      <div className="sectionInfo">
        <span className="sidebarDaily sectionName">
          <i className="sectionIcon fa-light fa-calendar-star"></i>
          {name}
        </span>
        <span className="sectionDescription">
          <span id="section0Count">10</span> from daily note or scheduled to 3/24/2024{' '}
          <button
            className="XCBButton tooltip"
            data-tooltip="Add a new task to today's note"
            data-plugin-id="jgclark.Dashboard"
            data-command="addTask"
            data-command-args="20240324.md"
          >
            <i className="fa-regular fa-circle-plus sidebarDaily"></i>
          </button>
          &nbsp;
          <button
            className="XCBButton tooltip"
            data-tooltip="Add a new checklist to today's note"
            data-plugin-id="jgclark.Dashboard"
            data-command="addChecklist"
            data-command-args="20240324.md"
          >
            <i className="fa-regular fa-square-plus sidebarDaily"></i>
          </button>{' '}
          <button
            className="XCBButton tooltip"
            data-tooltip="Add a new task to tomorrow's note"
            data-plugin-id="jgclark.Dashboard"
            data-command="addTask"
            data-command-args="20240325.md"
          >
            <i className="fa-regular fa-circle-arrow-right sidebarDaily"></i>
          </button>
          &nbsp;
          <button
            className="XCBButton tooltip"
            data-tooltip="Add a new checklist to tomorrow's note"
            data-plugin-id="jgclark.Dashboard"
            data-command="addChecklist"
            data-command-args="20240325.md"
          >
            <i className="fa-regular fa-square-arrow-right sidebarDaily"></i>
          </button>
        </span>
      </div>
      <ItemGrid items={items} />
    </div>
  )
}

export default Section
