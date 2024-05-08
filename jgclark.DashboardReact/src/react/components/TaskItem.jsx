// @flow
//--------------------------------------------------------------------------
// TaskItem.jsx
// Dashboard React component to create a full content line for a Task item: 
// icon, content, noteLink and the fa-edit icon at the end
// Last updated 6.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React, { useState } from 'react'
import { type Node } from 'react'
import { type TSectionItem, type TSection, type MessageDataObject } from '../../types'
import { useAppContext } from './AppContext.jsx'
import ItemContent from './ItemContent.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import useRefreshTimer from './useRefreshTimer.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { logDebug, clo } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

function TaskItem({ item, thisSection }: Props): Node {
  const { setReactSettings, sendActionToPlugin, pluginData } = useAppContext()
  const { settings } = pluginData

  // Hooks
  const [visible, setVisible] = useState(true)
  const { refreshTimer } = useRefreshTimer({ maxDelay: 5000 })

  const updateObj: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
  }

  /**
   * Handle clicking on item icons
   */
  function handleIconClick(event: MouseEvent) {
    const { metaKey } = extractModifierKeys(event) // Indicates whether a modifier key was pressed
    const { itemType } = item

    switch (itemType) {
      case 'open':
        updateObj.actionType = metaKey ? 'cancelTask' : 'completeTask'
        setVisible(false)
        break
      case 'checklist':
        updateObj.actionType = metaKey ? 'cancelChecklist' : 'completeChecklist'
        setVisible(false)
        break
      case 'project':
        updateObj.actionType = 'showNoteInEditorFromFilename'
        break
      default:
        logDebug(`ItemRow`, `ERROR - handleIconClick: unknown itemType: ${itemType}`)
        break
    }

    clo(updateObj, `ItemRow: item clicked: ${item.ID}`)

    sendActionToPlugin(updateObj.actionType, updateObj, `${item.ID} Row icon clicked`, true)

    // Send 'refresh' action to plugin after n seconds - this is a bit of a hack
    // to get around the updateCache not being reliable.
    refreshTimer()
  }

  const handleDialogClick = (e: MouseEvent): void => {
    logDebug('TaskItem', 'handleDialogClick - setting dialogData to: ', updateObj)
    // NEED TO SAVE JUST THE TWO FIELDS YOU WANT TO PASS TO THE DIALOG
    // IF YOU TRY TO SAVE THE WHOLE OBJECT, IT CAUSES A CIRCULAR REFERENCE
    const clickPosition = { clientY: e.clientY, clientX: e.clientX }
    setReactSettings((prev) => ({ ...prev, lastChange: `_Dashboard-DialogOpen`, dialogData: { isOpen: true, isTask: true, details: updateObj, clickPosition } }))
  }

  const statusDivClass =
    item.itemType === 'open' ? 'sectionItemTodo todo' : item.itemType === 'checklist' ? 'sectionItemChecklist todo' : item.itemType === 'congrats' ? 'checked' : ''
  const iconClassName =
    item.itemType === 'open'
      ? 'todo fa-regular fa-circle'
      : item.itemType === 'checklist'
      ? 'todo fa-regular fa-square'
      : item.itemType === 'congrats'
      ? 'fa-regular fa-circle-check'
      : ''

  // Note the visible && below removes the item immediately
  // Removing that will cause a fade-out to occur but leaves the space on the page

  return (
    visible && (
      <div className={`sectionItemRow${visible ? '' : ' fadeOutAndHide'}`} id={item.ID}>
        <div className={`${statusDivClass} TaskItem`} onClick={handleIconClick}>
          <i id={`${item.ID}I`} className={`${iconClassName}`}></i>
        </div>
        <div className="sectionItemContent sectionItem">
          <ItemContent item={item} />
          {settings?.includeTaskContext ? <ItemNoteLink item={item} thisSection={thisSection} /> : null}
          <a className="dialogTrigger">
            <i className="fa-light fa-edit pad-left" onClick={handleDialogClick}></i>
          </a>
        </div>{' '}
      </div>
    )
  )
}

export default TaskItem
