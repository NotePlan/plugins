// @flow
import React from 'react'
import {
  // addNoteOpenLinkToString,
  // getSettings,
  // makeNoteTitleWithOpenActionFromFilename,
  makeParaContentToLookLikeNPDisplayInHTML,
} from '../../dashboardHelpers'
import type { SectionItem } from '../../types'

/**
 * Represents a single item within a section, displaying its status, content, and actions.
 */
function ItemRow(item: SectionItem): React$Node {
  const { ID, type, filename, content, noteType, sectionType } = item
  // compute the things we need later
  const divClassName = (item.type === 'open')
    ? 'sectionItemTodo todo'
    : (type === 'checklist')
      ? 'sectionItemChecklist todo'
      : (type === 'congrats')
        ? 'checked'
        : (type === 'review')
          ? 'reviewProject todo'
          : ''
  const iconClassName = (type === 'open')
    ? 'todo fa-regular fa-circle'
    : (type === 'checklist')
      ? 'todo fa-regular fa-square'
      : (type === 'congrats')
        ? 'fa-regular fa-circle-check'
        : (type === 'review')
          ? 'fa-regular fa-circle-play'
          : ''
  const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, '', 'all', 140) // TODO: other cases for this
  const dataObjectToPassToControlDialog = {
    OS: 'macOS', // TODO: NotePlan.environment.platform,
    itemID: ID,
    sectionType: sectionType,
    reschedOrMove: 'move', // TODO: reschedOrMove,
    itemType: 'task',
    noteType: noteType,
  }
  return (
    <div className="sectionItemRow"
      id={ID}
      data-section-type={sectionType}
      data-filename={filename}
      data-content={content}
    >
      <div className={`${divClassName} itemIcon`}><i id={`${ID}I`} className={`${iconClassName}`}></i>
      </div>

      <div className="sectionItemContent sectionItem">
        <a className="content">${paraContent}</a>
        <a className="dialogTrigger"
          onClick={`showItemControlDialog(${dataObjectToPassToControlDialog}`}>
          <i className="fa-light fa-edit pad-left"></i>
        </a>
      </div>
    </div>
  )
}

export default ItemRow
