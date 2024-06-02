// NoTasks.jsx

// @flow
import * as React from 'react'

/**
 * Component for displaying a message when there are no tasks.
 */
const NoTasks = (): React.Node => {
  return (
    <div className="sectionItemRow" data-section-type="">
      <div className="TaskItem checked">
        <i className="fa-regular fa-circle-check"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <div className="content">
          <i>
            Nothing to do: take a break <i className="fa-solid fa-mug pad-left"></i>
          </i>
        </div>
      </div>
    </div>
  )
}

export default NoTasks
