// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show there are no Projects overdue for review. Called by ItemRow.
// Last updated 2024-07-28 for v2.2.0.a2 by @jgclark
//--------------------------------------------------------------------------

import { type Node } from 'react'

/**
 * Component for displaying a message when there are no tasks.
 */
const NoProjects = (): Node => {
  return (
    <div className="sectionItemRow" data-section-type="">
      <div className="TaskItem checked">
        <i className="fa-regular fa-circle-check"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <div className="content">
          <i>
            No Projects need reviewing: take a break <i className="fa-solid fa-mug pad-left"></i>
          </i>
        </div>
      </div>
    </div>
  )
}

export default NoProjects
