// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by  component
// Last updated 16.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import * as React from 'react'
import type { MessageDataObject, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, clo } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
}

function ReviewItem({ item }: Props): React.Node {
  const { pluginData, setReactSettings /*, sharedSettings, setSharedSettings */ } = useAppContext()
  const { settings } = pluginData

  const itemFilename = item.project?.filename ?? '<no filename>'
  const noteTitle = item.project?.title ?? '<no title>'
  const folderNamePart = settings?.includeFolderName && getFolderFromFilename(itemFilename) !== '' ? `${getFolderFromFilename(itemFilename)} / ` : ''
  // logDebug(`ReviewItem`, `for ${itemFilename} (${folderNamePart} / ${noteTitle})`)

  const noteTitleWithOpenAction = (
    <a className="noteTitle sectionItem">
      <i className="fa-regular fa-file-lines pad-right"></i> {noteTitle}
    </a>
  )

  const projectContent: React.Node = (
    <>
      {folderNamePart}
      {noteTitleWithOpenAction}
    </>
  )

  // const messageObject: MessageDataObject = {
  //   item: item,
  //   actionType: '(not yet set)',
  // }

  // const handleEditClick = (): void => {
  //   setReactSettings((prev) => ({ ...prev, lastChange: `_Dashboard-ProjectDialogOpen`, dialogData: { isOpen: true, isTask: false, details: dataObjectToPassToControlDialog } }))
  // }

  const dataObjectToPassToControlDialog = {
    item: item,
    actionType: '' 
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
          {/* <i className="fa-light fa-edit pad-left" onClick={handleEditClick}></i> */}
          <i className="fa-light fa-edit pad-left" onClick={handleClickToOpenDialog}></i>
        </a>
      </div>
    </div>
  )
}

export default ReviewItem
