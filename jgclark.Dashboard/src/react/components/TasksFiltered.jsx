// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an Indicator that a Filter has been applied and so some item(s) have been hidden.
// Called by ItemRow component
// Last updated 2024-08-26 for v2.1.0.a9 by @jgclark
//--------------------------------------------------------------------------

import React,{ type Node } from 'react'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
// import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
}

/**
 * Component for displaying a filter indicator.
 */
const TasksFiltered = ({ item }: Props): Node => {
  const { /*sendActionToPlugin, */ dispatchDashboardSettings } = useAppContext()

  function handleLineClick(e: MouseEvent) {
    // const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed -- Note: not yet used

    // V1 attempt-- not working
    // logDebug('TasksFiltered/handleLineClick', `Trying to use sendActionToPlugin with actionType turnOffPriorityItemsFilter`)
    // const dataObjectToPassToFunction = {
    //   actionType: 'turnOffPriorityItemsFilter',
    //   modifierKey: modifierName,
    //   item,
    // }
    // sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Filter indicator clicked', true)

    // v2
    logDebug('TasksFiltered/handleLineClick', `Trying to update filterPriorityItems setting`)
    dispatchDashboardSettings({ type: 'UPDATE_DASHBOARD_SETTINGS', payload: { filterPriorityItems: false }, reason: 'Filtered tasks link clicked'   })
  }

  return (
    <div className="sectionItemRow" id={item.ID}>
      {/* This empty span needed to mimic the StatusIcon line */}
      <span>
        <div className="itemIcon todo">
          <i id={item.ID} className="fa-regular fa-plus"></i>
        </div>
      </span>
      <div
        className="sectionItemContent sectionItem"
        onClick={(e) => handleLineClick(e)} >
        <span className="content">
          <i>{item?.para?.content || '<no content>'}</i>
        </span>
      </div>
    </div>
  )
}

export default TasksFiltered
