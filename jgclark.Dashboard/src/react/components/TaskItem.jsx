//--------------------------------------------------------------------------
// TaskItem.jsx
// Dashboard React component to create a full content line for a Task item: 
// icon, content, noteLink and the fa-edit icon at the end.
// 
// Last updated 2024-09-20 for v2.1.0.a12 by @jgclark
//--------------------------------------------------------------------------
// @flow
import React, { type Node, useState } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
// import { useAppContext } from './AppContext.jsx'
import ItemContent from './ItemContent.jsx'
// import ItemNoteLink from './ItemNoteLink.jsx'
import StatusIcon from './StatusIcon.jsx'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'

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

  // Note: following now moved into ItemContent to make layout easier
  // const handleClickToOpenDialog = (e: MouseEvent): void => {
  //   // logDebug('TaskItem', `handleClickToOpenDialog - setting dialogData to: ${JSP(messageObject)}`)
  //   const clickPosition = { clientY: e.clientY, clientX: e.clientX }
  //   setReactSettings((prev) => ({
  //     ...prev,
  //     lastChange: `_Dashboard-TaskDialogOpen`,
  //     dialogData: { isOpen: true, isTask: true, details: messageObject, clickPosition }
  //   }))
  // }

  const indentLevel = item.para?.indentLevel ?? 0

  return (
    visible ? (
      // <div className="sectionItemRow" id={item.ID} style={{padding-left: calc(${item.para?.indentLevel ?? 0} * 1.35rem)}} >
      <div className="sectionItemRow" id={item.ID} style={{
        paddingLeft: `calc(${indentLevel} * var(--itemIndentWidth))`
      }} >
        <StatusIcon
          item={item}
          respondToClicks={true}
          onIconClick={handleIconClick}
        />
        <ItemContent item={item} thisSection={thisSection} />
        {/* Note: following now moved into ItemContent to make layout easier */}
        {/* {dashboardSettings?.includeTaskContext && <ItemNoteLink item={item} thisSection={thisSection} />} */}
        {/* <a className="dialogTriggerIcon">
          <i className="fa-light fa-edit pad-left-larger" onClick={handleClickToOpenDialog}></i>
        </a> */}
        {/* </ItemContent> */}
      </div>
    ) : null
  )
}

export default TaskItem
