// @flow
import * as React from 'react'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { getFolderFromFilename } from '@helpers/folders'

type Props = {
  item: TSectionItem,
}

function ReviewItem({ item }: Props): React.Node {
  const { pluginData, setReactSettings /*, sharedSettings, setSharedSettings */ } = useAppContext()
  const { settings } = pluginData

  const itemFilename = item.project?.filename ?? '<no filename>'
  // const encodedItemFilename = encodeRFC3986URIComponent(itemFilename)
  const noteTitle = item.project?.title ?? '<no title>'
  const folderNamePart = settings?.includeFolderName && getFolderFromFilename(itemFilename) !== '' ? `${getFolderFromFilename(itemFilename)} / ` : ''

  const noteTitleWithOpenAction = (
    <a className="noteTitle sectionItem">
      <i className="fa-regular fa-file-lines pad-right"></i> ${noteTitle}
    </a>
  )

  const projectContent: React.Node = (
    <>
      {folderNamePart}
      {noteTitleWithOpenAction}
    </>
  )

  const handleEditClick = (): void => {
    setReactSettings((prev) => ({ ...prev, lastChange: `_Dashboard-DialogOpen`, dialogData: { isOpen: true, isTask: false, details: dataObjectToPassToControlDialog } }))
  }

  // TODO: most of this can go in just 'item'
  const dataObjectToPassToControlDialog = {
    OS: 'macOS', // TODO: NotePlan.environment.platform,
    itemID: item.ID,
    actionType: 'showNoteInEditorFromFilename',
    filename: itemFilename,
    title: noteTitle,
    encodedContent: '',
    item,
  }

  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="reviewProject todo TaskItem">
        <i id={`${item.ID}I`} className="fa-regular fa-circle-play"></i>
      </div>

      <div className="sectionItemContent sectionItem">
        {projectContent}

        <a className="dialogTrigger">
          <i className="fa-light fa-edit pad-left" onClick={handleEditClick}></i>
        </a>
      </div>
    </div>
  )
}

export default ReviewItem
