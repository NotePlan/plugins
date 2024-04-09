// @flow
import React from 'react'
import {
  // addNoteOpenLinkToString,
  // getSettings,
  // makeNoteTitleWithOpenActionFromFilename,
  makeParaContentToLookLikeNPDisplayInHTML,
} from '../../dashboardHelpers'
import type { TSection, TSectionItem } from '../../types'

type Props = {
  // key: number,
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a single item within a section, displaying its status, content, and actions.
 */
function ItemRow(inputObj: Props): React$Node {
  const { item, thisSection } = inputObj
  const para = item.para
  const itemType = para.type

  console.log(`ItemRow for section ${thisSection.sectionType}/${thisSection.ID}:  '${para.content}'`)

  // compute the things we need later
  const divClassName = (itemType === 'open')
    ? 'sectionItemTodo todo'
    : (itemType === 'checklist')
      ? 'sectionItemChecklist todo'
      : (itemType === 'congrats')
        ? 'checked'
        : (itemType === 'review')
          ? 'reviewProject todo'
          : ''
  const iconClassName = (itemType === 'open')
    ? 'todo fa-regular fa-circle'
    : (itemType === 'checklist')
      ? 'todo fa-regular fa-square'
      : (itemType === 'congrats')
        ? 'fa-regular fa-circle-check'
        : (itemType === 'review')
          ? 'fa-regular fa-circle-play'
          : ''
  const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, '', 'all', 140) // TODO: other cases for this
  const dataObjectToPassToControlDialog = {
    OS: 'macOS', // TODO: NotePlan.environment.platform,
    itemID: item.ID,
    sectionType: thisSection.sectionType,
    reschedOrMove: 'move', // TODO: reschedOrMove,
    itemType: 'task',
    noteType: para.noteType,
  }
  return (
    <div className="sectionItemRow"
      id={item.ID}
      data-section-type={thisSection.sectionType}
      data-filename={para.filename}
      data-content={para.content}
    >
      <div className={`${divClassName} itemIcon`}><i id={`${item.ID}I`} className={`${iconClassName}`}></i>
      </div>

      <div className="sectionItemContent sectionItem">
        <a className="content">${paraContent}</a>
        <a className="dialogTrigger"
          // eslint-disable-next-line no-undef
          onClick={() => showItemControlDialog(dataObjectToPassToControlDialog)}>
          <i className="fa-light fa-edit pad-left"></i>
        </a>
      </div>
    </div>
  )
}

export default ItemRow
