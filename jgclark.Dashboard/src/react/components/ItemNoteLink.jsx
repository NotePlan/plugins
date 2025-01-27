// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 2025-01-13 for v2.1.2 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, clo } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents the main content for a single item within a section
 */
function ItemNoteLink({ item, thisSection }: Props): React$Node {
  const { sendActionToPlugin, dashboardSettings, reactSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${filename} noteTitle:${noteTitle} thisSection.sectionFilename=${thisSection.sectionFilename || ''}`)
  const folderNamePart = dashboardSettings.includeFolderName && filename !== '<no filename found>' && getFolderFromFilename(filename) !== '/' ? `${getFolderFromFilename(filename)} /` : ''
  const handleLinkClick = (e:MouseEvent) => {
    const { modifierName  } = extractModifierKeys(e) // Indicates whether a modifier key was pressed

    const dataObjectToPassToFunction = {
      actionType: 'showLineInEditorFromFilename',
      modifierKey: modifierName,
      item,
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, `${noteTitle} clicked`, true)
  }

  if (filename !== thisSection.sectionFilename) {
    return (
      <TooltipOnKeyPress
        altKey={{ text: 'Open in Split View' }}
        metaKey={{ text: 'Open in Floating Window' }}
        label={`${item.itemType}_${item.ID}_Open Note Link`}
        enabled={!reactSettings?.dialogData?.isOpen}>
        <span className="pad-left-larger folderName pad-right">{folderNamePart}</span>
        <a className="noteTitle sectionItem" onClick={handleLinkClick}>
          <i className="fa-regular fa-file-lines pad-right"></i>
          {noteTitle}
        </a>
      </TooltipOnKeyPress>
    )
  } else {
    return null
  }
}

export default ItemNoteLink
