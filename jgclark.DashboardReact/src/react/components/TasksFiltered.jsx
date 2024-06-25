// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an Indicator that a Filter has been applied and so some item(s) have been hidden.
// Called by ItemRow component
// Last updated 25.6.2024 for v2.0.0-b14 by @jgclark
//--------------------------------------------------------------------------
// TasksFiltered.jsx
import * as React from 'react'
import type { TSectionItem } from '../../types.js'

type Props = {
  item: TSectionItem,
}

/**
 * Component for displaying a filter indicator.
 */
const TasksFiltered = ({ item }: Props): React.Node => {
  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="itemIcon">
        <i id={item.ID} className="fa-regular fa-plus"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <span className="content">
          <i>{item?.para?.content || '<no content>'}</i>
        </span>
      </div>
    </div>
  )
}

export default TasksFiltered
