// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 13.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'

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
function ItemNoteLink(inputObj: Props): React$Node {
  const { item, thisSection } = inputObj
  const { sendActionToPlugin } = useAppContext()

  console.log(`ItemNoteLink for ${item.itemFilename}`)

  // compute the things we need later
  const noteTitle = item.itemNoteTitle
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
        onClick={() => sendActionToPlugin('showNoteInEditor', dataObjectToPassToFunction)}
      >
        <i className="fa-regular fa-file-lines pad-left pad-right"></i>
        {noteTitle}
      </a>
    )
  } else {
    console.log()
    return
  }
}

// Now include an active link to the note, if 'noteTitle' is given
// TODO(later): remove once checked that it works in separate function
/**
 *
 * @param {SectionItem} thisItem
 * @param {string?} noteLinkStyle: "append" or "all"
 * @returns {string}
 */
function makeNoteLinkToAppend(thisItem: TSectionItem, noteLinkStyle: string = 'all'): string {
  let output = ''
  const noteTitle = thisItem.para.title
  if (noteTitle) {
    // console.log(`makeParaContet...: - before '${noteLinkStyle}' for ${noteTitle} / {${output}}`)
    switch (noteLinkStyle) {
      case 'append': {
        output += thisItem + makeNoteTitleWithOpenActionFromFilename(thisItem, noteTitle)
        break
      }
      case 'all': {
        output += thisItem
        break
      }
    }
    // console.log(`makeParaContet...: - after: '${noteLinkStyle}' for ${noteTitle} / {${output}}`)
  }
  return output
}

export default ItemNoteLink
