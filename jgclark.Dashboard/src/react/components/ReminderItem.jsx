//--------------------------------------------------------------------------
// ReminderItem.jsx
// Dashboard React component for an Apple Reminder row:
// icon, title/notes/time/location, listname context.
//
// Open-in-Reminders: when NotePlan >= 3.21.2 (appleRemindersCallbackAvailable),
// content click opens via openURL -> x-apple-reminderkit://REMCDReminder/{id}.
// On older builds that scheme is blocked by NotePlan.openURL.
// See also ARCHITECTURE-How_Stuff_Works.md -> "Reminders section".
//
// Last updated 2026-07-15 for v2.4.0.b51 by @CursorAI
//--------------------------------------------------------------------------
// @flow
import React, { type Node, useCallback } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
import { useAppContext } from './AppContext.jsx'
import StatusIcon from './StatusIcon.jsx'
import './TaskItem.css'
import { colorToModernSpecWithOpacity } from '@helpers/colors'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { logDebug, logWarn } from '@helpers/dev'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Reminder row. Content click opens in Apple Reminders when NP supports x-apple-reminderkit via openURL.
 * Status icon: click completes; ⌘-click or ctrl-click deletes (Calendar API).
 * TODO(later): task-like dialog (edit title/details, reschedule, change list)
 */
function ReminderItem({ item, thisSection }: Props): Node {
  const { dashboardSettings, pluginData, sendActionToPlugin } = useAppContext()
  const reminder = item.reminder
  const canOpenInReminders = Boolean(pluginData?.appleRemindersCallbackAvailable && reminder?.id)

  const handleContentClick = useCallback(() => {
    if (!reminder?.id || !pluginData?.appleRemindersCallbackAvailable) {
      logWarn('ReminderItem', `Content clicked but cannot open reminder (available=${String(pluginData?.appleRemindersCallbackAvailable)} id=${String(reminder?.id || '')})`)
      return
    }
    const url = `x-apple-reminderkit://REMCDReminder/${reminder.id}`
    logDebug('ReminderItem', `Opening reminder in Reminders app: ${url}`)
    const messageObject: MessageDataObject = {
      actionType: 'openURL',
      url,
      item,
    }
    sendActionToPlugin('openURL', messageObject, 'Reminder content clicked', true)
  }, [item, pluginData?.appleRemindersCallbackAvailable, reminder, sendActionToPlugin])

  if (!reminder) {
    return null
  }

  const showListnameContext = Boolean(dashboardSettings?.showTaskContext && reminder.listname)
  const listColor = reminder.color || null
  // Date lozenge only in REM (calendar/TB sections already convey the day)
  const showDateLozenge = thisSection.sectionCode === 'REM'

  // Build main content: optional date (REM only; omit today like tasks), optional time, title, details, location
  const contentParts: Array<Node> = []
  const todayHyphenated = getTodaysDateHyphenated()
  if (showDateLozenge && reminder.date && reminder.date !== todayHyphenated) {
    contentParts.push(
      <span key="date" className="scheduledDate margin-right-larger">
        <i className="fa-regular fa-calendar pad-right" />
        {reminder.date}
      </span>,
    )
  }
  if (reminder.time) {
    contentParts.push(
      <span key="time" className="timeBlock margin-right-larger">
        <i className="fa-regular fa-clock pad-right" />
        {reminder.time}
      </span>,
    )
  }
  contentParts.push(
    <span key="title" className="reminderTitle">
      {reminder.title}
    </span>,
  )
  if (reminder.notes) {
    contentParts.push(
      <span key="details" className="reminderDetails pad-left" style={{ color: 'var(--fg-placeholder-color)' }}>
        {reminder.notes}
      </span>,
    )
  }
  if (reminder.location) {
    contentParts.push(
      <span
        key="location"
        className="reminderContext pad-left-larger"
        style={{ color: 'var(--tint-color)', borderColor: 'var(--divider-color)' }}
      >
        <i className="fa-regular fa-location-dot pad-right" />
        {reminder.location}
      </span>,
    )
  }
  if (showListnameContext) {
    const listnameColor = listColor || 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))'
    const listnameBackgroundColor = listColor
      ? colorToModernSpecWithOpacity(listColor, 0.1) || `rgb(from ${listColor} r g b / 0.05)`
      : 'var(--bg-placeholder-color, rgba(76, 79, 105, 0.05))'
    contentParts.push(
      <span
        key="listname"
        className="reminderContext pad-left-larger"
        title={`List: ${reminder.listname}`}
        style={{ borderColor: listnameColor, backgroundColor: listnameBackgroundColor }}
      >
        <i className="fa-regular fa-list pad-right" />
        {reminder.listname}
      </span>,
    )
  }
  // TODO(future): Enable this if the API is extended to cover flagged status
  // if (reminder.flagged) {
  //   contentParts.push(
  //     <span key="flagged" className="reminderFlagged pad-left-larger" title="Flagged" style={{ color: 'var(--tint-color, #dc8a78)', fontSize: '75%' }}>
  //       <i className="fa-solid fa-flag" />
  //     </span>,
  //   )
  // }

  const contentClassName = canOpenInReminders ? 'content clickTarget reminderContent' : 'content reminderContent'
  const contentEl = canOpenInReminders ? (
    <a className={contentClassName} onClick={handleContentClick} title="Open in Reminders">
      {contentParts}
    </a>
  ) : (
    <span className={contentClassName}>{contentParts}</span>
  )

  return (
    <div className="sectionItemRow reminderItemRow" id={item.ID}>
      <StatusIcon item={item} respondToClicks={true} iconColor={listColor || undefined} />
      <div className="sectionItemContent reminderItemContent">{contentEl}</div>
    </div>
  )
}

export default ReminderItem
