// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an Indicator that a Filter has been applied and so some item(s) have been hidden.
// Called by ItemRow component
// Last updated 2024-07-14 for v2.0.2 by @jgclark
// TODO: be smarter about what to do if this line is clicked on. Or stop it being a link.
//--------------------------------------------------------------------------

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
      {/* This empty span needed to mimic the StatusIcon line */}
      <span>
        <div className="itemIcon todo">
          <i id={item.ID} className="fa-regular fa-plus"></i>
        </div>
      </span>
      <div className="sectionItemContent sectionItem">
        <span className="content">
          <i>{item?.para?.content || '<no content>'}</i>
        </span>
      </div>
    </div>
  )
}

export default TasksFiltered
