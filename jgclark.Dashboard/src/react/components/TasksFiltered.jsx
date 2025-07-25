// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an Indicator that a Filter has been applied and so some item(s) have been hidden.
// Called by ItemRow component
// Last updated 2024-10-23 for v2.0.7 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import { DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
}

/**
 * Component for displaying a filter indicator.
 */
const TasksFiltered = ({ item }: Props): Node => {
  const { dashboardSettings, dispatchDashboardSettings } = useAppContext()

  function handleLineClick(_e: MouseEvent) {
    // logDebug('TasksFiltered/handleLineClick', `Trying to update filterPriorityItems setting`)
    // setDashboardSettings((prevSettings) => ({ ...prevSettings, ['filterPriorityItems']: false }))
    const newPayload = {
      ...dashboardSettings,
      ['filterPriorityItems']: false,
    }
    logDebug('TasksFiltered', `handleLineClick Calling UPDATE_DASHBOARD_SETTINGS`)
    dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newPayload, reason: `Turning off filterPriorityItems` })
    //TODO: REFACTOR:Maybe update isModified & sendActionToPlugin to save the settings and remove from the useDashboardSettings hook
  }

  return (
    <div className="sectionItemRow" id={item.ID}>
      {/* This empty span needed to mimic the StatusIcon line */}
      <span>
        <div className="itemIcon todo">
          <i id={item.ID} className="fa-regular fa-plus"></i>
        </div>
      </span>
      <div className="sectionItemContent sectionItem" onClick={(e) => handleLineClick(e)}>
        <span className="content">
          <i>{item?.para?.content || '<no content>'}</i>
        </span>
      </div>
    </div>
  )
}

export default TasksFiltered
