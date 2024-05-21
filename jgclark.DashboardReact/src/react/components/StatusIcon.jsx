// StatusIcon.jsx
// @flow
import React, { useState, useEffect } from 'react'
import type { Node } from 'react'
import type { TActionType, TSectionItem, MessageDataObject } from '../../types'
import { useAppContext } from './AppContext.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { logDebug, clo, JSP } from '@helpers/react/reactDev'

type Props = {
    item: TSectionItem,
    respondToClicks: boolean,
    onIconClick?: (item: TSectionItem, actionType: string) => void,
};

const StatusIcon = ({
  item,
  respondToClicks,
  onIconClick,
}: Props): Node => {

  const { sendActionToPlugin } = useAppContext()

  useEffect(() => {
    // This effect runs when `item.itemType` changes
    setIconClassName(getClassNameFromType(item.itemType))
  }, [item.itemType])  // Depend on `item.itemType` to update the icon when it changes


  // Initial state setup for iconClassName based on the item type
  const [iconClassName, setIconClassName] = useState(getClassNameFromType(item.itemType))

  function getClassNameFromType(itemType: string): string {
    switch (itemType) {
      case 'open':
        return 'todo fa-regular fa-circle'
      case 'cancelled':
        return 'todo fa-regular fa-circle-xmark'
      case 'checklist':
        return 'todo fa-regular fa-square'
      case 'checklistCancelled':
        return 'todo fa-regular fa-square-xmark'
      case 'congrats':
        return 'fa-regular fa-circle-check'
      default:
        return '' // default case if none of the types match
    }
  }

  /**
   * Handle internal click events, determine the action, and notify the parent component.
   */
  function handleIconClick(event: MouseEvent) {
    if (!respondToClicks) return

    logDebug('handleIconClick', `item.para.content = ${item.para.content}`)
    const { metaKey } = extractModifierKeys(event)
    const actionType = determineActionType(metaKey)
    const messageObject: MessageDataObject = {
      actionType,
      item,
    }

    // Execute the internal logic before notifying the parent
    sendActionToPlugin(actionType, messageObject, `${item.ID} Row icon clicked`, true)

    // Call the external handler, if provided
    if (onIconClick) {
      onIconClick(item, actionType)
    }
  }

  /**
   * Determine the action type based on the metaKey and item type.
   * Also updates the icon shape based on what action was taken
   */
  function determineActionType(metaKey: boolean): TActionType {
    switch (item.itemType) {
      case 'open': {
        setIconClassName(getClassNameFromType(metaKey ? "open" : "done"))
        return metaKey ? 'cancelTask' : 'completeTask'
      }
      case 'checklist': {
        setIconClassName(getClassNameFromType(metaKey ? "checklistCancelled" : "checklistDone"))
        return metaKey ? 'cancelChecklist' : 'completeChecklist'
      }
      case 'project': {
        return 'showNoteInEditorFromFilename'
      }
      default:
        logDebug(`StatusIcon`, `ERROR - Unknown itemType: ${item.itemType}`)
        return 'unknown'
    }
  }

  return (
    <span className="sectionItemTodo itemIcon todo">
      <i className={iconClassName} onClick={handleIconClick}></i>
    </span>
  )
}

export default StatusIcon
