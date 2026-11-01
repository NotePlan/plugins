// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Icon before an item
// Called by TaskItem component.
// Last updated 2026-07-29 for v2.4.0.b55, @jgclark + @CursorAI
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
  iconColor?: string, /* optional CSS color override for the icon (e.g. Reminders section color) */
}

const StatusIcon = ({ item, respondToClicks, onIconClick, location, iconColor }: Props): Node => {
  const { sendActionToPlugin, reactSettings } = useAppContext()

  const dialogIsOpen = reactSettings?.dialogData?.isOpen
  const shouldShowTooltips = !dialogIsOpen || location === 'dialog'
  const isReminder = item.itemType === 'reminder'

  // Initial state setup for iconClassName based on the item type
  const [iconClassName, setIconClassName] = useState(getClassNameFromType(item.itemType))

  // Reset local icon when the row identity changes. REM section IDs are index-based; after a mid-list
  // complete/delete + refresh, React can reuse this component for a different reminder while keeping
  // stale "done"/empty icon state unless we reset on item.ID (and itemType).
  useEffect(() => {
    setIconClassName(getClassNameFromType(item.itemType))
  }, [item.itemType, item.ID])

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
        return 'fa-regular fa-fw fa-trash-xmark'
      case 'timeblock': // for non-task/checklist timeblock lines
        return 'timeBlockColor fa-regular fa-fw fa-calendar-clock'
      case 'info': // for Info section lines
        return 'fa-regular fa-fw fa-bullet'
      case 'noSearchResults':
        return '' // deliberately no icon
      default:
        return 'emptyIcon' // default spacer in place of an icon
    }
  }

  /**
   * Handle internal click events, determine the action, and notify the parent component (which does visual changes).
   * Optimistic icon / row fade only run when the plugin command was actually accepted (sent or queued).
   */
  function handleIconClick(event: MouseEvent) {
    if (!respondToClicks) return

    const { metaKey, ctrlKey } = extractModifierKeys(event)
    const decided = determineActionType(metaKey, ctrlKey)
    if (!decided) {
      logDebug('StatusIcon/handleIconClick', `-> no actionType returned, so won't take any action.`)
      return
    }
    const { actionType, optimisticIconType } = decided
    const contentLabel = item.para?.content ?? item.reminder?.title ?? '-'
    logDebug('StatusIcon/handleIconClick', `-> actionType:${actionType} for content = ${contentLabel}`)
    const messageObject: MessageDataObject = {
      actionType,
      item,
    }

    // Only update UI when the bridge accepted the command (sent or queued).
    // A dropped in-flight click used to leave reminders with an empty icon and the title still visible.
    const accepted = sendActionToPlugin(actionType, messageObject, `${item.ID} Row icon clicked`, true)
    if (!accepted) {
      logWarn('StatusIcon/handleIconClick', `-> plugin did not accept "${actionType}" (in flight or gated); leaving icon unchanged`)
      return
    }

    // Parent row fade (TaskItem / ReminderItem): keep the circle/square visible so the whole line
    // fades together. Swapping to emptyIcon first made the glyph vanish while the title was still opaque.
    if (onIconClick) {
      onIconClick(item, actionType)
      return
    }
    if (optimisticIconType) {
      setIconClassName(getClassNameFromType(optimisticIconType))
    }
  }

  /**
   * Determine the action type based on the metaKey and item type.
   * Icon class is applied only after sendActionToPlugin accepts the command.
   */
  function determineActionType(metaKey: boolean, ctrlKey: boolean): ?{ actionType: TActionType, optimisticIconType: ?string } {
    switch (item.itemType) {
      case 'open': {
        return {
          actionType: metaKey ? 'cancelTask' : ctrlKey ? 'deleteItem' : 'completeTask',
          optimisticIconType: metaKey ? 'cancelled' : ctrlKey ? 'deleted' : 'done',
        }
      }
      case 'checklist': {
        return {
          actionType: metaKey ? 'cancelChecklist' : ctrlKey ? 'deleteItem' : 'completeChecklist',
          optimisticIconType: metaKey ? 'checklistCancelled' : ctrlKey ? 'deleted' : 'checklistDone',
        }
      }
      case 'reminder': {
        // ⌘ or ctrl deletes; plain click completes (no cancel for reminders)
        return {
          actionType: metaKey || ctrlKey ? 'deleteReminder' : 'completeReminder',
          optimisticIconType: metaKey || ctrlKey ? 'deleted' : 'done',
        }
      }
      case 'project': {
        return { actionType: 'showNoteInEditorFromFilename', optimisticIconType: null }
      }
      case 'timeblock': {
        logInfo(`StatusIcon`, `Clicked on timeblock → no action`)
        return
      }
      default:
        logWarn(`StatusIcon`, `No action defined for itemType: ${item.itemType}`)
        return { actionType: 'unknown', optimisticIconType: null }
    }
  }

  const renderedIcon = (
      <div className="sectionItemTodo itemIcon">
      <i className={iconClassName} onClick={handleIconClick} style={iconColor ? { color: iconColor } : undefined}></i>
    </div>
  )

  // TEST: trying TooltipOnKeyPress as a span item, and an equivalent empty one if there's no tooltip
  return shouldShowTooltips ? (
    <TooltipOnKeyPress
      ctrlKey={{ text: isReminder ? 'Delete reminder' : 'Delete Item' }}
      metaKey={{ text: isReminder ? 'Delete reminder' : 'Cancel Item' }}
      label={`${item.itemType}_${item.ID}_Icon`}
    >
      {renderedIcon}
    </TooltipOnKeyPress>
  ) : (
    <span>{renderedIcon}</span>
  )
}

export default StatusIcon
