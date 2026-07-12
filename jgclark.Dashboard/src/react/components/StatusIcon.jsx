// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Icon before an item
// Called by TaskItem component.
// Last updated 2026-07-12 for v2.4.0.b49, @jgclark
//--------------------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import type { Node } from 'react'
import type { TActionType, TSectionItem, MessageDataObject } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { clo, JSP, logDebug, logInfo, logWarn } from '@helpers/dev'

type Props = {
  item: TSectionItem,
  respondToClicks: boolean,
  onIconClick?: (item: TSectionItem, actionType: string) => void,
  location?: string, /* where being called from so we can make decisions (currently only #"dialog" to show/not show things) */
  iconColor?: string, /* optional CSS color override for the icon (e.g. reminder list color) */
}

const StatusIcon = ({ item, respondToClicks, onIconClick, location, iconColor }: Props): Node => {
  const { sendActionToPlugin, reactSettings } = useAppContext()

  const dialogIsOpen = reactSettings?.dialogData?.isOpen
  const shouldShowTooltips = !dialogIsOpen || location === 'dialog'
  const isReminder = item.itemType === 'reminder'

  useEffect(() => {
    // This effect runs when `item.itemType` changes
    setIconClassName(getClassNameFromType(item.itemType))
  }, [item.itemType]) // Depend on `item.itemType` to update the icon when it changes

  // Initial state setup for iconClassName based on the item type
  const [iconClassName, setIconClassName] = useState(getClassNameFromType(item.itemType))

  function getClassNameFromType(itemType: string): string {
    switch (itemType) {
      case 'open':
      case 'scheduled':
      case 'reminder': // same circle as tasks; click completes, ctrl deletes
        return 'todo clickTarget fa-regular fa-fw fa-circle'
      case 'cancelled':
        return 'cancelled fa-regular fa-fw fa-circle-xmark'
      case 'checklist':
      case 'checklistScheduled':
        return 'todo clickTarget fa-regular fa-fw fa-square'
      case 'checklistCancelled':
        return 'cancelled fa-regular fa-fw fa-square-xmark'
      case 'itemCongrats':
      case 'projectCongrats':
      case 'winsCongrats':
        return 'fa-regular fa-fw fa-circle-check'
      case 'deleted':
        return 'fa-regular fa-trash-xmark'
      case 'timeblock': // for non-task/checklist timeblock lines
        return 'timeBlockColor fa-regular fa-calendar-clock'
      case 'info': // for Info section lines
        return 'fa-regular fa-bullet'
      case 'noSearchResults':
        return '' // deliberately no icon
      default:
        return 'emptyIcon' // default spacer in place of an icon
    }
  }

  /**
   * Handle internal click events, determine the action, and notify the parent component (which does visual changes).
   */
  function handleIconClick(event: MouseEvent) {
    if (!respondToClicks) return

    const { metaKey, ctrlKey } = extractModifierKeys(event)
    const actionType: ?TActionType = determineActionType(metaKey, ctrlKey)
    if (actionType) {
      const contentLabel = item.para?.content ?? item.reminder?.title ?? '-'
      logDebug('StatusIcon/handleIconClick', `-> actionType:${actionType} for content = ${contentLabel}`)
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
    } else {
      logDebug('StatusIcon/handleIconClick', `-> no actionType returned, so won't take any action.`)
    }
  }

  /**
   * Determine the action type based on the metaKey and item type.
   * Also updates the icon shape based on what action was taken
   */
  function determineActionType(metaKey: boolean, ctrlKey: boolean): ?TActionType {
    switch (item.itemType) {
      case 'open': {
        setIconClassName(getClassNameFromType(metaKey ? 'cancelled' : ctrlKey ? 'deleted' : 'done'))
        return metaKey ? 'cancelTask' : ctrlKey ? 'deleteItem' : 'completeTask'
      }
      case 'checklist': {
        setIconClassName(getClassNameFromType(metaKey ? 'checklistCancelled' : ctrlKey ? 'deleted' : 'checklistDone'))
        return metaKey ? 'cancelChecklist' : ctrlKey ? 'deleteItem' : 'completeChecklist'
      }
      case 'reminder': {
        // Apple Reminders have no cancel state; click completes, ctrl deletes. Meta is ignored.
        if (metaKey && !ctrlKey) {
          logInfo(`StatusIcon`, `Clicked on reminder with metaKey -> no cancel action for reminders`)
          return
        }
        setIconClassName(getClassNameFromType(ctrlKey ? 'deleted' : 'done'))
        return ctrlKey ? 'deleteReminder' : 'completeReminder'
      }
      case 'project': {
        return 'showNoteInEditorFromFilename'
      }
      case 'timeblock': {
        logInfo(`StatusIcon`, `Clicked on timeblock → no action`)
        return
      }
      default:
        logWarn(`StatusIcon`, `No action defined for itemType: ${item.itemType}`)
        return 'unknown'
    }
  }

  const renderedIcon = (
      <div className="sectionItemTodo itemIcon">
      <i className={iconClassName} onClick={handleIconClick} style={iconColor ? { color: iconColor } : undefined}></i>
    </div>
  )

  // Note: trying TooltipOnKeyPress as a span item, and an equivalent empty one if there's no tooltip
  // Reminders: no Cancel (meta); only Delete (ctrl)
  return shouldShowTooltips ? (
    <TooltipOnKeyPress
      ctrlKey={{ text: isReminder ? 'Delete Reminder' : 'Delete Item' }}
      metaKey={isReminder ? undefined : { text: 'Cancel Item' }}
      label={`${item.itemType}_${item.ID}_Icon`}
    >
      {renderedIcon}
    </TooltipOnKeyPress>
  ) : (
    <span>{renderedIcon}</span>
  )
}

export default StatusIcon
