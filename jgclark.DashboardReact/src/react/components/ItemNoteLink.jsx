// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 13.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { logDebug, clo } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

// import {
//   getAPIDateStrFromDisplayDateStr,
// } from '@helpers/dateTime'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents the main content for a single item within a section
 */
function ItemNoteLink({ item, thisSection }: Props): React$Node {
  const { sendActionToPlugin, reactSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${filename} noteTitle:${noteTitle} thisSection.sectionFilename=${thisSection.sectionFilename || ''}`)

  const handleLinkClick = (e:MouseEvent) => {
    const { modifierName  } = extractModifierKeys(e) // Indicates whether a modifier key was pressed

    const dataObjectToPassToFunction = {
      actionType: 'showNoteInEditorFromFilename',
      modifierKey: modifierName,
      item,
    }
    sendActionToPlugin('showNoteInEditorFromFilename', dataObjectToPassToFunction, `${noteTitle} clicked`, true)
  }

  if (filename !== thisSection.sectionFilename) {
    const dataObjectToPassToFunction = {
      actionType: 'showNoteInEditorFromFilename',
      item,
    }
    return (
      <TooltipOnKeyPress altKey={{ text: 'Open in Split View' }} metaKey={{ text: 'Open in Floating Window' }} label={`${item.itemType}_${item.ID}_Open Note Link`} showAtCursor={true} enabled={!reactSettings?.dialogData?.isOpen}>
      <a className="noteTitle sectionItem" onClick={handleLinkClick}>
        <i className="fa-regular fa-file-lines pad-left pad-right"></i>
        {noteTitle}
      </a>
      </TooltipOnKeyPress>
    )
  }
}

export default ItemNoteLink
