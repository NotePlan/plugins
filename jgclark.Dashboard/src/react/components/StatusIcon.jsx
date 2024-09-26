// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Icon before an item
// Called by TaskItem component.
// Last updated 2024-07-08 for v2.0.1 by @jgclark
//--------------------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import type { Node } from 'react'
import type { TActionType, TSectionItem, MessageDataObject } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { logDebug, clo, JSP } from '@helpers/react/reactDev'

type Props = {
  item: TSectionItem,
  respondToClicks: boolean,
  onIconClick?: (item: TSectionItem, actionType: string) => void,
  location?: string, /* where being called from so we can make decisions (e.g. "dialog" to show/not show things) */
};

const StatusIcon = ({
  item,
  respondToClicks,
  onIconClick,
  location,
}: Props): Node => {

  const { sendActionToPlugin, reactSettings } = useAppContext()

  const dialogIsOpen = reactSettings?.dialogData?.isOpen
  const shouldShowTooltips = !dialogIsOpen || location === 'dialog'

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
        return 'cancelled fa-regular fa-circle-xmark'
      case 'checklist':
        return 'todo fa-regular fa-square'
      case 'checklistCancelled':
        return 'cancelled fa-regular fa-square-xmark'
      case 'itemCongrats':
      case 'projectCongrats':
        return 'fa-regular fa-circle-check'
      case 'deleted':
        return 'fa-regular fa-trash-xmark'
      default:
        return '' // default case if none of the types match
    }
  }

  /**
   * Handle internal click events, determine the action, and notify the parent component (which does visual changes).
   */
  function handleIconClick(event: MouseEvent) {
    if (!respondToClicks) return

    const { metaKey, ctrlKey } = extractModifierKeys(event)
    const actionType = determineActionType(metaKey, ctrlKey)
    logDebug('StatusIcon/handleIconClick', `-> actionType:${actionType} for i.p.content = ${item.para?.content ?? '-'}`)
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
  function determineActionType(metaKey: boolean, ctrlKey: boolean): TActionType {
    switch (item.itemType) {
      case 'open': {
        setIconClassName(getClassNameFromType(metaKey ? "cancelled" : ctrlKey ? "deleted" : "done"))
        return metaKey ? 'cancelTask' : ctrlKey ? 'deleteItem' : 'completeTask'
      }
      case 'checklist': {
        setIconClassName(getClassNameFromType(metaKey ? "checklistCancelled" : ctrlKey ? "deleted" : "checklistDone"))
        return metaKey ? 'cancelChecklist' : ctrlKey ? "deleteItem" : 'completeChecklist'
      }
      case 'project': {
        return 'showNoteInEditorFromFilename'
      }
      default:
        logDebug(`StatusIcon`, `ERROR - Unknown itemType: ${item.itemType}`)
        return 'unknown'
    }
  }

  const renderedIcon = (<div className="sectionItemTodo itemIcon todo">
    <i className={iconClassName} onClick={handleIconClick}></i>
  </div>)

  // Note: trying TooltipOnKeyPress as a span item, and an equivalent empty one if there's no tooltip
  return shouldShowTooltips ? (
    <TooltipOnKeyPress ctrlKey={{ text: 'Delete Item' }} metaKey={{ text: 'Cancel Item' }} label={`${item.itemType}_${item.ID}_Icon`}>
      {renderedIcon}
    </TooltipOnKeyPress>
  ) : <span>{renderedIcon}</span>
}

export default StatusIcon
