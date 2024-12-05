//--------------------------------------------------------------------------
// TaskItem.jsx
// Dashboard React component to create a full content line for a Task item: 
// icon, content, noteLink and the fa-edit icon at the end.
// 
// Last updated for v2.1.0.a
//--------------------------------------------------------------------------
// @flow
import React, { type Node, useState } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
import ItemContent from './ItemContent.jsx'
import StatusIcon from './StatusIcon.jsx'
import { clo, JSP, logDebug } from '@np/helpers/react/reactDev.js'
// import { getTimeBlockDetails } from '@np/helpers/timeblocks'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
};

function TaskItem({ item, thisSection }: Props): Node {
  // const { setReactSettings, dashboardSettings } = useAppContext()

  const [visible, setVisible] = useState(true)

  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
    sectionCodes: [thisSection.sectionCode], // for the DialogForTaskItems
  }

  // const [possTimeBlockStr, restOfTimeBlockLineStr] = getTimeBlockDetails(item.para?.content ?? '', '')
  // const timeblockStr = (thisSection.sectionCode === 'TB') ? possTimeBlockStr : ''

  // Handle icon click, following action in the lower-level StatusIcon component (e.g. cancel/complete)
  function handleIconClick() {
    const { itemType } = item

    switch (itemType) {
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
        logDebug(`ItemRow`, `ERROR - handleIconClick: unknown itemType: ${itemType}`)
        break
    }
    logDebug('TaskItem/handleIconClick', `-> actionType:${messageObject.actionType} for itemType:${itemType} and i.p.content = ${item.para?.content ?? '-'}`)
    // clo(messageObject, `TaskItem: icon clicked: ${item.ID}`)
  }

  const indentLevel = item.para?.indentLevel ?? 0

  return (
    visible ? (
      <div className="sectionItemRow" id={item.ID} style={{
        paddingLeft: `calc(${indentLevel} * var(--itemIndentWidth))`
      }} >
        <StatusIcon
          item={item}
          respondToClicks={true}
          onIconClick={handleIconClick}
          // timeblockStr={timeblockStr}
        />
        <ItemContent item={item} thisSection={thisSection} />
      </div>
    ) : null
  )
}

export default TaskItem
