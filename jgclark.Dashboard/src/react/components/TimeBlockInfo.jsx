// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Time Block item for info.Called by ItemRow or ItemContent.
// Last updated for v2.1.0.a
//--------------------------------------------------------------------------

import React, { type Node, useState } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
import ItemContent from './ItemContent.jsx'
import StatusIcon from './StatusIcon.jsx'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'
import { getTimeBlockDetails } from '@helpers/timeblocks'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
};

function TimeBlockInfo({ item, thisSection }: Props): Node {
  const [visible, setVisible] = useState(true)

  const underlyingItemType = ['title', 'list', 'quote'].includes(item.para?.type) ? 'timeblock' : item.para.type

  // Tweak the item to display more usefully
  const [timeblockStr, restOfTimeBlockLineStr] = getTimeBlockDetails(item.para?.content ?? '', '')
  const tweakedItemPara = { ...item.para, content: restOfTimeBlockLineStr }
  const tweakedItem = { ...item, itemType: underlyingItemType, para: tweakedItemPara }
  logDebug('TimeBlockInfo', `timeblockStr: ${timeblockStr} / ${restOfTimeBlockLineStr}`)
  clo(tweakedItem, 'TimeBlockInfo: tweakedItem')

  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
    sectionCodes: [thisSection.sectionCode], // for the DialogForTaskItems
  }

  // Handle icon click, following action in the lower-level StatusIcon component (e.g. cancel/complete)
  function handleIconClick() {
    switch (underlyingItemType) {
      case 'open':
      case 'checklist': {
        // Start the fade out effect
        const fadeElement = document.getElementById(item.ID)
        if (fadeElement) fadeElement.classList.add('fadeOutAndHide')
        // Set visible to false after 500ms
        setTimeout(() => {
          setVisible(false) // Do not hide, because the array is rewritten and it may hide the wrong item
        }, 500)
        break
      }
      case 'project':
        messageObject.actionType = 'showNoteInEditorFromFilename'
        break
      default:
        logDebug(`ItemRow`, `ERROR - handleIconClick: unknown itemType: ${underlyingItemType}`)
        break
    }
    logDebug('TimeBlockInfo/handleIconClick', `-> actionType:${messageObject.actionType} for itemType:${underlyingItemType} and i.p.content = ${item.para?.content ?? '-'}`)
    // clo(messageObject, `TimeBlockInfo: icon clicked: ${item.ID}`)
  }

  return (
    visible ? (
      <div className="sectionItemRow" id={item.ID}>
        <StatusIcon
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[prop-missing]
          item={tweakedItem}
          respondToClicks={true}
          onIconClick={handleIconClick}
          timeblockStr={timeblockStr}
        />
        {/* $FlowFixMe[incompatible-type] */}
        {/* $FlowFixMe[prop-missing]  */}
        <ItemContent item={tweakedItem} thisSection={thisSection} />
      </div>
    ) : null

  )
}

export default TimeBlockInfo
