// Buttons for adding tasks and checklists to today's note
// @flow

import React from 'react'
import moment from 'moment/min/moment-with-locales'
import { useAppContext } from './AppContext.jsx'

function NextPeriodAddButtons(sectionType: string, filename: string): React$Node {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()

  // this is just cut and paste for now, needs to be refactored to use Button/React
  // TODO(later): change to jgclark.DashboardReact
  // TODO: get .filename
  const durationType = (sectionType === 'DT') ? 'day'
    : (sectionType === 'W') ? 'this week'
      : (sectionType === 'M') ? 'this month'
        : '(error)'
  const nextPeriodFilename = 'TODO' // TODO:  DataStore.calendarNoteByDate(new moment().add(1, durationType).toDate(), durationType)?.filename
  console.log(`NextPeriodAddButtons: durationType=${durationType} nextPeriodFilename=${nextPeriodFilename}`)
  return (
    <>
      <button
        className="PCButton tooltip"
        data-tooltip={`Add a new task for next ${durationType}`}
        data-plugin-id="jgclark.Dashboard"
        data-command="addTask"
        data-command-args={nextPeriodFilename}
        onClick={() => sendActionToPlugin('addTask', filename)}
      >
        <i className="fa-regular fa-circle-arrow-right sidebarDaily"></i>
      </button>{' '}
      <button
        className="PCButton tooltip"
        data-tooltip={`Add a new checklist for next ${durationType}`}
        data-plugin-id="jgclark.Dashboard"
        data-command="addChecklist"
        data-command-args={nextPeriodFilename}
        onClick={() => sendActionToPlugin('addChecklist', filename)}
      >
        <i className="fa-regular fa-square-arrow-right sidebarDaily"></i>
      </button>
    </>
  )
}

export default NextPeriodAddButtons
