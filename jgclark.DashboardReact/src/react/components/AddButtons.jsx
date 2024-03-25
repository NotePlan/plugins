// Buttons for adding tasks and checklists to today's note
// @flow

import React from 'react'
import { useAppContext } from './AppContext.jsx'

const AddButtons = (): React$Node => {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()

  // this is just cut and paste for now, needs to be refactored to use Button/React
  return (
    <>
      <button
        className="XCBButton tooltip"
        data-tooltip="Add a new task to today's note"
        data-plugin-id="jgclark.Dashboard"
        data-command="addTask"
        data-command-args="20240324.md"
        onClick={() => sendActionToPlugin('addTask', '20240324.md')}
      >
        <i className="fa-regular fa-circle-plus sidebarDaily"></i>
      </button>
      <button
        className="XCBButton tooltip"
        data-tooltip="Add a new checklist to today's note"
        data-plugin-id="jgclark.Dashboard"
        data-command="addChecklist"
        data-command-args="20240324.md"
        onClick={() => sendActionToPlugin('addChecklist', '20240324.md')}
      >
        <i className="fa-regular fa-square-plus sidebarDaily"></i>
      </button>{' '}
      <button
        className="XCBButton tooltip"
        data-tooltip="Add a new task to tomorrow's note"
        data-plugin-id="jgclark.Dashboard"
        data-command="addTask"
        data-command-args="20240325.md"
        onClick={() => sendActionToPlugin('addTask', '20240325.md')}
      >
        <i className="fa-regular fa-circle-arrow-right sidebarDaily"></i>
      </button>{' '}
      <button
        className="XCBButton tooltip"
        data-tooltip="Add a new checklist to tomorrow's note"
        data-plugin-id="jgclark.Dashboard"
        data-command="addChecklist"
        data-command-args="20240325.md"
        onClick={() => sendActionToPlugin('addChecklist', '20240325.md')}
      >
        <i className="fa-regular fa-square-arrow-right sidebarDaily"></i>
      </button>
    </>
  )
}

export default AddButtons
