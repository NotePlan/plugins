// NoTasks.jsx

// @flow
import * as React from 'react'

/**
 * Component for displaying a message when there are no tasks.
 */
const NoTasks = (): React.Node => {
  return (
    <div className="sectionItemRow" data-section-type="">
      <div className="itemIcon checked">
        <i className="fa-regular fa-circle-check"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <a className="content">
          <i>
            Nothing to do: take a break <i className="fa-regular fa-mug"></i>
          </i>
        </a>
      </div>
    </div>
  )
}

export default NoTasks
