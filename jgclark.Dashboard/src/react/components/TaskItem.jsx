//--------------------------------------------------------------------------
// TaskItem.jsx
// Dashboard React component to create a full content line for a Task item: 
// icon, content, noteLink and the fa-edit icon at the end.
// 
// Last updated 2025-07-22 for v2.3.0.b6
//--------------------------------------------------------------------------
// @flow
import React, { type Node, useState } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
import ItemContent from './ItemContent.jsx'
import StatusIcon from './StatusIcon.jsx'
import { clo, JSP, logDebug, logInfo, logWarn } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
};

function TaskItem({ item, thisSection }: Props): Node {
  const [visible, setVisible] = useState(true)

  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
    sectionCodes: [thisSection.sectionCode], // for the DialogForTaskItems
  }

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
      case 'project': {
        messageObject.actionType = 'showNoteInEditorFromFilename'
        break
      }
      default: {
        logWarn(`ItemRow`, `Warning: handleIconClick: unknown itemType: ${itemType}`)
        break
      }
    }
    logDebug('TaskItem/handleIconClick', `-> actionType:${messageObject.actionType} for ID:${item.ID} itemType:${itemType} and i.p.content = ${item.para?.content ?? '-'}`)
  }

  // Add an indent level to the start of the item iff it is a child and it has a selected parent and test that parent is being shown!
  // TEST: this. First clause has been commented out for some time.
  const indentLevelToDisplay = item.para?.isAChild && item.parentID && item.parentID !== '' ? (item.para?.indents ?? 0) : 0

  return (
    visible ? (
      <div
        className="sectionItemRow"
        id={item.ID}
        style={{
          paddingLeft: `calc(${indentLevelToDisplay} * var(--itemIndentWidth))`
      }} >
        <StatusIcon
          item={item}
          respondToClicks={true}
          onIconClick={handleIconClick}
        />
        <ItemContent item={item} thisSection={thisSection} />
      </div>
    ) : null
  )
}

export default TaskItem
