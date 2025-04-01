// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a simple message with no other styling. Called by ItemRow.
// Last updated 2025-03-30 for v2.2.0.a10
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import { useAppContext } from './AppContext.jsx'

type Props = {
  message: string,
  contentClassName?: string,
  closingFAIconClassName?: string,
  settingsDialogAnchor?: string,
}

/**
 * Component for displaying a message when there are no tasks.
 */
const MessageOnlyItem = ({ message, contentClassName = '', closingFAIconClassName = '', settingsDialogAnchor = '' }: Props): Node => {
  const { setReactSettings } = useAppContext()
  const contentClassNameToUse = contentClassName || 'messageOnlyItem'

  // Handle clicking the gear icon to open the settings dialog
  const handleSettingsLinkClick = () => {
    setReactSettings((prev) => ({
      ...prev,
      settingsDialog: {
        ...prev?.settingsDialog,
        isOpen: true,
        scrollTarget: settingsDialogAnchor,
      },
    }))
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  return (
    <div className="sectionItemRow" data-section-type="">
      {/* <div className="TaskItem checked"> */}
      {/* <i className="fa-regular fa-fw  fa-circle-check"></i> */}
      {/* </div> */}
      <div className="sectionItemContent sectionItem">
        <div className={contentClassNameToUse}>
          {message} {settingsDialogAnchor && <i className="fa-solid fa-gear" onClick={handleSettingsLinkClick}></i>}{' '}
          {closingFAIconClassName && <i className={closingFAIconClassName}></i>}
        </div>
      </div>
    </div>
  )
}

export default MessageOnlyItem
