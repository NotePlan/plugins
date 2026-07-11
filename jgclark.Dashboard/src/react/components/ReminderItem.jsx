//--------------------------------------------------------------------------
// ReminderItem.jsx
// Dashboard React component for an Apple Reminder row:
// icon, title/notes/time/location, listname context.
//
// Open-in-Reminders is NOT supported from Dashboard:
// - NotePlan.openURL only allows http, https, mailto, and noteplan schemes
//   (other schemes fail with "openURL blocked: only http, https, mailto, and noteplan schemes are allowed").
// - https: no documented public URL opens a specific Apple Reminder / list from an EventKit ID.
// - noteplan://: no x-callback action opens or focuses a reminder in NotePlan's UI.
// - x-apple-reminderkit://REMCDReminder/{UUID} works outside NotePlan but is blocked by openURL.
// See also ARCHITECTURE-How_Stuff_Works.md → "Reminders section".
//
// Last updated 2026-07-11 for v2.4.0.b49
//--------------------------------------------------------------------------
// @flow
import React, { type Node } from 'react'
import type { TSection, TSectionItem } from '../../types'
import { useAppContext } from './AppContext.jsx'
import StatusIcon from './StatusIcon.jsx'
import './TaskItem.css'
import { colorToModernSpecWithOpacity } from '@helpers/colors'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Reminder row. Content is intentionally not clickable (cannot deep-link to Reminders via NotePlan.openURL;
 * see file header and ARCHITECTURE-How_Stuff_Works.md). Status icon is read-only (INFO toast).
 * TODO(later): complete / uncomplete via status icon (Calendar update APIs)
 * TODO(later): task-like dialog (edit title/details, reschedule, change list)
 * TODO(later): open in Reminders if NotePlan allows a non-blocked path (or a show-reminder API)
 */
function ReminderItem({ item /*, thisSection */ }: Props): Node {
  const { dashboardSettings } = useAppContext()
  const reminder = item.reminder

  if (!reminder) {
    return null
  }

  const showListnameContext = Boolean(dashboardSettings?.showTaskContext && reminder.listname)
  const listColor = reminder.color || null

  // Build main content: optional time (shared .timeBlock lozenge), title, details, location
  const contentParts: Array<Node> = []
  if (reminder.time) {
    contentParts.push(
      <span key="time" className="timeBlock pad-right">
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
  if (reminder.flagged) {
    contentParts.push(
      <span key="flagged" className="reminderFlagged pad-left-larger" title="Flagged" style={{ color: 'var(--tint-color, #dc8a78)', fontSize: '75%' }}>
        <i className="fa-solid fa-flag" />
      </span>,
    )
  }

  return (
    <div className="sectionItemRow reminderItemRow" id={item.ID}>
      <StatusIcon item={item} respondToClicks={true} iconColor={listColor || undefined} />
      <div className="sectionItemContent reminderItemContent">
        <span className="content reminderContent">{contentParts}</span>
      </div>
    </div>
  )
}

export default ReminderItem
