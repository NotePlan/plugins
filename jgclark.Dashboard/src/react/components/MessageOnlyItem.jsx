// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a simple message with no other styling. Called by ItemRow.
// Last updated 2025-02-23 for v2.2.0 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'

type Props = {
  message: string,
  contentClassName?: string,
  closingFAIconClassName?: string,
}

/**
 * Component for displaying a message when there are no tasks.
 */
const MessageOnlyItem = ({ message, contentClassName = "", closingFAIconClassName = "" }: Props): Node => {
  const contentClassNameToUse = contentClassName || "messageOnlyItem"
  return (
    <div className="sectionItemRow" data-section-type="">
      {/* <div className="TaskItem checked"> */}
      {/* <i className="fa-regular fa-circle-check"></i> */}
      {/* </div> */}
      <div className="sectionItemContent sectionItem">
        <div className={contentClassNameToUse}>
          {message} {closingFAIconClassName && <i className={closingFAIconClassName}></i>}
        </div>
      </div>
    </div >
  )
}

export default MessageOnlyItem
