// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show there are no tasks for today. Called by ItemRow or ItemContent.
// Last updated 24.6.2024 for v2.0.0-b14 by @jgclark
//--------------------------------------------------------------------------

import {type Node} from 'react'

/**
 * Component for displaying a message when there are no tasks.
 */
const NoTasks = (): Node => {
  return (
    <div className="sectionItemRow" data-section-type="">
      <div className="TaskItem checked">
        <i className="fa-regular fa-circle-check"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <div> {/* Note: no className here */}
          <i>
            Nothing left on your list for today: take a break <i className="fa-solid fa-mug pad-left"></i>
          </i>
        </div>
      </div>
    </div>
  )
}

export default NoTasks
