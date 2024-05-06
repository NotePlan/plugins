// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 13.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { logDebug, clo } from '@helpers/react/reactDev'

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
  const { sendActionToPlugin } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${filename} noteTitle:${noteTitle} thisSection.sectionFilename=${thisSection.sectionFilename || ''}`)
  if (filename !== thisSection.sectionFilename) {
    const dataObjectToPassToFunction = {
      itemID: 'fake',
      type: 'showNoteInEditorFromTitle',
      filename: filename,
      content: '-',
    }
    return (
      <a className="noteTitle sectionItem" onClick={() => sendActionToPlugin('showNoteInEditor', dataObjectToPassToFunction, `${noteTitle} clicked`, true)}>
        <i className="fa-regular fa-file-lines pad-left pad-right"></i>
        {noteTitle}
      </a>
    )
  }
}

export default ItemNoteLink
