// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by  component
// Last updated 13.6.2024 for v2.0.0-b7 by @jgclark
//--------------------------------------------------------------------------

import * as React from 'react'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, clo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
}

function ReviewItem({ item }: Props): React.Node {
  const { sendActionToPlugin, setReactSettings, sharedSettings /*, setSharedSettings */ } = useAppContext()

  const itemFilename = item.project?.filename ?? '<no filename>'
  const noteTitle = item.project?.title ?? '<no title>'
  const folderNamePart = sharedSettings?.includeFolderName && getFolderFromFilename(itemFilename) !== '' ? `${getFolderFromFilename(itemFilename)} / ` : ''
  // logDebug(`ReviewItem`, `for ${itemFilename} (${folderNamePart} / ${noteTitle})`)

  const noteTitleWithOpenAction = (
    <a className="noteTitle sectionItem" onClick={(e) => handleTitleClick(e)}>
      <i className="fa-regular fa-file-lines pad-right"></i>{noteTitle}
    </a>
  )

  const projectContent: React.Node = (
    <>
      {folderNamePart}
      {noteTitleWithOpenAction}
    </>
  )

  const dataObjectToPassToControlDialog = {
    item: item,
    actionType: '' 
   }

  function handleTitleClick(e: MouseEvent) {
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    const dataObjectToPassToFunction = {
      actionType: 'showNoteInEditorFromFilename', // we only have note-level data for Project items
      modifierKey: modifierName,
      filename: item.project?.filename ?? '<no filename>',
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Project Title clicked in Dialog', true)
  }

  const handleClickToOpenDialog = (e: MouseEvent): void => {
    // clo(dataObjectToPassToControlDialog, 'ReviewItem: handleClickToOpenDialog - setting dataObjectToPassToControlDialog to: ')
    const clickPosition = { clientY: e.clientY, clientX: e.clientX }
    setReactSettings((prev) => ({
      ...prev,
      lastChange: `_Dashboard-ProjectDialogOpen`,
      dialogData: { isOpen: true, isTask: false, details: dataObjectToPassToControlDialog, clickPosition }
    }))
  }

  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="reviewProject todo TaskItem">
        <i id={`${item.ID}I`} className="fa-regular fa-circle-play"></i>
      </div>

      <div className="sectionItemContent sectionItem">
        {projectContent}

        <a className="dialogTrigger">
          <i className="fa-light fa-edit pad-left" onClick={handleClickToOpenDialog}></i>
        </a>
      </div>
    </div>
  )
}

export default ReviewItem
