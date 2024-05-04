// @flow
import * as React from 'react'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { getFolderFromFilename } from '@helpers/folders'

type Props = {
  item: TSectionItem,
}

function ReviewItem({ item }: Props): React.Node {
  const { pluginData, setReactSettings } = useAppContext()
  const { settings } = pluginData

  const itemFilename = item.itemFilename
  const encodedItemFilename = encodeRFC3986URIComponent(itemFilename)
  const noteTitle = item.itemNoteTitle ?? '<no title>'
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

  const dataObjectToPassToControlDialog = {
    OS: 'macOS', // TODO: NotePlan.environment.platform,
    itemID: item.ID,
    type: 'showNoteInEditorFromFilename',
    encodedFilename: encodedItemFilename,
    encodedTitle: encodeRFC3986URIComponent(noteTitle),
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
