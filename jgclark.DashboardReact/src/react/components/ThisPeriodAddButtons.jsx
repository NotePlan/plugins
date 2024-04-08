// Buttons for adding tasks and checklists to today's note
// @flow

import React from 'react'
import { useAppContext } from './AppContext.jsx'

function ThisPeriodAddButtons(sectionType: string, filename: string): React$Node {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()

  // this is just cut and paste for now, needs to be refactored to use Button/React
  // TODO(later): change to jgclark.DashboardReact
  const durationName = (sectionType === 'DT') ? 'today'
    : (sectionType === 'W') ? 'this week'
      : (sectionType === 'M') ? 'this month'
        : '(error)'
  console.log(`NextPeriodAddButtons: durationName=${durationName} filename=${filename}`)
  return (
    <>
      <button
        className="PCButton tooltip"
        data-tooltip={`Add a new task to ${durationName}'s note`}
        data-plugin-id="jgclark.Dashboard"
        data-command="addTask"
        data-command-args={filename}
        onClick={() => sendActionToPlugin('addTask', filename)}
      >
        <i className="fa-regular fa-circle-plus sidebarDaily"></i>
      </button>
      <button
        className="PCButton tooltip"
        data-tooltip={`Add a new checklist to ${durationName}'s note`}
        data-plugin-id="jgclark.Dashboard"
        data-command="addChecklist"
        data-command-args={filename}
        onClick={() => sendActionToPlugin('addChecklist', filename)}
      >
        <i className="fa-regular fa-square-plus sidebarDaily"></i>
      </button>
    </>
  )
}

export default ThisPeriodAddButtons
