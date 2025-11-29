// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an Indicator that a Filter has been applied and so some item(s) have been hidden.
// Called by ItemRow component
// Last updated 2025-11-29 for v2.3.0.b16, @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import { DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
  onToggleShowAll?: () => void,
}

/**
 * Component for displaying a filter indicator.
 */
const TasksFiltered = ({ item, onToggleShowAll }: Props): Node => {
  const { dashboardSettings, dispatchDashboardSettings } = useAppContext()

  function handleLineClick(_e: MouseEvent) {
    if (onToggleShowAll) {
      // Use local toggle function if provided
      logDebug('TasksFiltered', `handleLineClick calling local onToggleShowAll`)
      onToggleShowAll()
    } else {
      // Fall back to global setting update
      logDebug('TasksFiltered', `handleLineClick Calling UPDATE_DASHBOARD_SETTINGS`)
      const newPayload = {
        ...dashboardSettings,
        ['filterPriorityItems']: false,
      }
      dispatchDashboardSettings({ type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS, payload: newPayload, reason: `Turning off filterPriorityItems` })
    }
  }

  return (
    <div className="sectionItemRow messageItemRow" id={item.ID}>
      {/* This empty span needed to mimic the StatusIcon line */}
      <span>
        <div className="itemIcon">
          <i id={item.ID} className="fa-regular fa-plus"></i>
        </div>
      </span>
      <div className="sectionItemContent sectionItem" onClick={(e) => handleLineClick(e)}>
        <span className="messageItemRow">
          <i>{item?.para?.content || '<no content>'}</i>
        </span>
      </div>
    </div>
  )
}

export default TasksFiltered
