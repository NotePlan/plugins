//--------------------------------------------------------------------------
// TaskItem.jsx
// Dashboard React component to create a full content line for a Task item: 
// icon, content, noteLink and the fa-edit icon at the end
// Last updated 2.6.2024 for v2.0.0 by @dbw
//--------------------------------------------------------------------------
// @flow
import React, { useState } from 'react'
import { type Node } from 'react'
import { type TSectionItem, type TSection, type MessageDataObject } from '../../types'
import { useAppContext } from './AppContext.jsx'
import ItemContent from './ItemContent.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import StatusIcon from './StatusIcon.jsx'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
};

function TaskItem({ item, thisSection }: Props): Node {
  const { setReactSettings, sharedSettings } = useAppContext()

  const [visible, setVisible] = useState(true)

  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
  }

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
    // clo(messageObject, `TaskItem: icon clicked: ${item.ID}`)
  }

  const handleClickToOpenDialog = (e: MouseEvent): void => {
    // logDebug('TaskItem', `handleClickToOpenDialog - setting dialogData to: ${JSP(messageObject)}`)
    const clickPosition = { clientY: e.clientY, clientX: e.clientX }
    setReactSettings((prev) => ({
      ...prev,
      lastChange: `_Dashboard-TaskDialogOpen`,
      dialogData: { isOpen: true, isTask: true, details: messageObject, clickPosition }
    }))
  }

  return (
    visible ? (
      <div className={`sectionItemRow`} id={item.ID}>
        <StatusIcon
          item={item}
          respondToClicks={true}
          onIconClick={handleIconClick}
        />
        <ItemContent item={item} >
        {sharedSettings?.includeTaskContext && <ItemNoteLink item={item} thisSection={thisSection} />}
        <a className="dialogTrigger">
          <i className="fa-light fa-edit pad-left" onClick={handleClickToOpenDialog}></i>
        </a>
        </ItemContent>
      </div>
    ) : null
  )
}

export default TaskItem
