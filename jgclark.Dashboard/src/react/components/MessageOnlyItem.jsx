// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a simple message with no other styling. Called by ItemRow.
// Last updated 2025-11-23 for v2.3.0.b15, @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import { useAppContext } from './AppContext.jsx'

type Props = {
  message: string,
  contentClassName?: string,
  rowIconClassName?: string,
  closingFAIconClassName?: string,
  settingsDialogAnchor?: string,
}

/**
 * Component for displaying a message when there are no tasks.
 */
const MessageOnlyItem = ({ message,
  contentClassName = '',
  rowIconClassName = '',
  closingFAIconClassName = '',
  settingsDialogAnchor = '' }: Props): Node => {
  const { setReactSettings } = useAppContext()
  const contentClassNameToUse = contentClassName || 'messageItemRow'

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
    <div className="sectionItemRow">
      {rowIconClassName && (
        <div className="itemIcon">
          <i className={rowIconClassName}></i>
        </div>
      )}
      <div className="sectionItemContent sectionItem">
        <div className={contentClassNameToUse}>
          {message}{' '}
          {settingsDialogAnchor && <i className="fa-solid fa-gear clickTarget" onClick={handleSettingsLinkClick}></i>}{' '}
          {closingFAIconClassName && <i className={closingFAIconClassName}></i>}
        </div>
      </div>
    </div>
  )
}

export default MessageOnlyItem
