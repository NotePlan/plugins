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

  // compute the things we need later
  const noteTitle = item.itemNoteTitle || item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${item.itemFilename} noteTitle:${noteTitle} thisSection.sectionFilename=${thisSection.sectionFilename || ''}`)
  if (noteTitle && noteTitle !== thisSection.sectionFilename) {
    const encodedNoteTitle = encodeURIComponent(noteTitle)

    const dataObjectToPassToFunction = {
      itemID: 'fake',
      type: 'showNoteInEditorFromTitle',
      encodedFilename: encodedNoteTitle,
      encodedContent: '',
    }
    return (
      <a
        className="noteTitle sectionItem"
        // $FlowIgnore[cannot-resolve-name]
        onClick={() => sendActionToPlugin('showNoteInEditor', dataObjectToPassToFunction, `${noteTitle} clicked`, true)}
      >
        <i className="fa-regular fa-file-lines pad-left pad-right"></i>
        {noteTitle}
      </a>
    )
  } else {
    logDebug(`ItemNoteLink`, `No noteTitle found for ${item.itemFilename}`)
    return
  }
}

export default ItemNoteLink
