// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Icon before an item
// Last updated 2.6.2024 for v2.0.0 by @dbw
//--------------------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import type { Node } from 'react'
import type { TActionType, TSectionItem, MessageDataObject } from '../../types'
import { getFeatureFlags } from '../../shared.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
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
  
  const { sendActionToPlugin, pluginData, sharedSettings } = useAppContext()

  const { FFlag_MetaTooltips} = getFeatureFlags(pluginData.settings, sharedSettings)

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
      case 'deleted':
        return 'fa-regular fa-trash-xmark'
      default:
        return '' // default case if none of the types match
    }
  }

  /**
   * Handle internal click events, determine the action, and notify the parent component.
   */
  function handleIconClick(event: MouseEvent) {
    if (!respondToClicks) return

    logDebug('handleIconClick', `item.para.content = ${item.para?.content ?? '-'}`)
    const { metaKey, altKey } = extractModifierKeys(event)
    const actionType = determineActionType(metaKey, altKey)
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
  function determineActionType(metaKey: boolean, altKey: boolean): TActionType {
    switch (item.itemType) {
      case 'open': {
        setIconClassName(getClassNameFromType(metaKey ? "cancelled" : altKey ? "deleted" : "done"))
        return metaKey ? 'cancelTask' : altKey ? 'deleteItem' : 'completeTask'
      }
      case 'checklist': {
        setIconClassName(getClassNameFromType(metaKey ? "checklistCancelled" : altKey ? "deleted" : "checklistDone"))
        return metaKey ? 'cancelChecklist' : altKey ? "deleteItem" : 'completeChecklist'
      }
      case 'project': {
        return 'showNoteInEditorFromFilename'
      }
      default:
        logDebug(`StatusIcon`, `ERROR - Unknown itemType: ${item.itemType}`)
        return 'unknown'
    }
  }

  const renderedIcon = (<span className="sectionItemTodo itemIcon todo">
    <i className={iconClassName} onClick={handleIconClick}></i>
  </span>)
  return (
    FFlag_MetaTooltips ? (
      <TooltipOnKeyPress altKey={{ text: 'Cancel Item' }} metaKey={{ text: 'Delete Item' }} label={`${item.itemType}_${item.ID}_Icon`}>
        {renderedIcon}
      </TooltipOnKeyPress>
    ) : renderedIcon
  )
}
  export default StatusIcon
