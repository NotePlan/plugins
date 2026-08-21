//--------------------------------------------------------------------------
// ReminderItem.jsx
// Dashboard React component for an Apple Reminder row:
// icon, title/notes/time/location, listname context (RHS, matching ItemNoteLink).
//
// Open-in-Reminders: when NotePlan >= 3.21.2 (appleAppCallbacksAvailable),
// content click opens via openURL -> x-apple-reminderkit://REMCDReminder/{id}.
// On older builds that scheme is blocked by NotePlan.openURL.
// Edit icon opens DialogForReminderItems (non-IP): complete / delete / open.
// See also ARCHITECTURE-How_Stuff_Works.md -> "Reminders section".
//
// Last updated 2026-08-21 for v2.4.1 by @jgclark + @CursorAI
//--------------------------------------------------------------------------
// @flow
import React, { type Node, useCallback } from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types'
import { useAppContext } from './AppContext.jsx'
import StatusIcon from './StatusIcon.jsx'
import './ItemContent.css'
import './ReminderItem.css'
import { colorToModernSpecWithOpacity } from '@helpers/colors'
import { getAppleRemindersOpenURL, getReminderMarkerColors } from '@helpers/NPReminders'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { logDebug, logWarn } from '@helpers/dev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Reminder row. Content click opens in Apple Reminders when NP supports x-apple-reminderkit via openURL.
 * Status icon: click completes; ⌘-click or ctrl-click deletes (Calendar API).
 * Edit icon opens DialogForReminderItems outside Interactive Processing.
 */
function ReminderItem({ item, thisSection }: Props): Node {
  const { dashboardSettings, pluginData, sendActionToPlugin, setReactSettings } = useAppContext()
  const reminder = item.reminder
  const canOpenInReminders = Boolean(pluginData?.appleAppCallbacksAvailable && reminder?.id)
  const effectiveSectionCode = item.sectionCode ?? thisSection.sectionCode

  const handleContentClick = useCallback(() => {
    if (!reminder?.id || !pluginData?.appleAppCallbacksAvailable) {
      logWarn('ReminderItem', `Content clicked but cannot open reminder (available=${String(pluginData?.appleAppCallbacksAvailable)} id=${String(reminder?.id || '')})`)
      return
    }
    const url = getAppleRemindersOpenURL(reminder.id)
    logDebug('ReminderItem', `Opening reminder in Reminders app: ${url}`)
    const messageObject: MessageDataObject = {
      actionType: 'openURL',
      url,
      item,
    }
    sendActionToPlugin('openURL', messageObject, 'Reminder content clicked', true)
  }, [item, pluginData?.appleAppCallbacksAvailable, reminder, sendActionToPlugin])

  const handleClickToOpenEditDialog = useCallback(
    (event: MouseEvent): void => {
      const clickPosition = { clientY: event.clientY, clientX: event.clientX }
      const { metaKey } = extractModifierKeys(event)
      const messageObject: MessageDataObject = {
        item,
        actionType: '(not yet set)',
        sectionCodes: [effectiveSectionCode],
        modifierKey: metaKey,
      }
      logDebug('ReminderItem/handleClickToOpenEditDialog', `Opening reminder dialog for "${reminder?.title || ''}"`)
      setReactSettings((prev) => ({
        ...prev,
        lastChange: `_Dashboard-ReminderDialogOpen`,
        dialogData: { isOpen: true, isTask: true, details: messageObject, clickPosition },
      }))
    },
    [effectiveSectionCode, item, reminder?.title, setReactSettings],
  )

  if (!reminder) {
    return null
  }

  const showListnameContext = Boolean(dashboardSettings?.showTaskContext && reminder.listname)
  const listColor = reminder.color || null
  // Date lozenge only in REM (calendar/TB sections already convey the day)
  const showDateLozenge = thisSection.sectionCode === 'REM'
  // Time chip only in today's sections (TB holds timed-today reminders; DT holds untimed today)
  const showTimeChip = thisSection.sectionCode === 'TB' || thisSection.sectionCode === 'DT'

  // Build main content: optional date (REM only; omit today like tasks), title, optional time chip (after title, matching NP), details, location
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

  // Same as tasks: wrap the title part in .priorityN (theme flagged-1/2/3 styles).
  // Hide priority markers only strips ! from task text; it must not remove this class.
  const dashboardPriority = Number(reminder.priority) || 0
  const priorityClass = dashboardPriority >= 1 && dashboardPriority <= 3 ? `priority${String(dashboardPriority)}` : ''
  contentParts.push(
    <span key="title" className={`reminderTitle ${priorityClass}`}>
      {reminder.title}
    </span>,
  )
  // NP shows reminder due-time as a chip with bell icon after the title (not the timeBlock clock style)
  if (showTimeChip && reminder.time) {
    const markerColors = getReminderMarkerColors(listColor)
    contentParts.push(
      <span key="time" className="reminderMarker" style={markerColors}>
        <i className="fa-regular fa-fw fa-bell pad-right" />
        {reminder.time}
      </span>,
    )
  }
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

  // Listname on RHS (same float pattern as ItemNoteLink in ItemContent)
  let listnameEl: Node = null
  if (showListnameContext) {
    const listnameBorderColor = listColor || 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.25))'
    const listnameBackgroundColor = listColor
      ? colorToModernSpecWithOpacity(listColor, 0.05) || `rgba(from ${listColor} r g b / 0.05)`
      : 'var(--bg-placeholder-color, rgba(76, 79, 105, 0.05))'
    listnameEl = (
      <span className="itemNoteLinkEnd">
        <span
          className="reminderContext"
          title={`List: ${reminder.listname}`}
          style={{ borderColor: listnameBorderColor, backgroundColor: listnameBackgroundColor }}
        >
          <i className="fa-regular fa-list pad-right" />
          {reminder.listname}
        </span>
      </span>
    )
  }

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
      <StatusIcon item={item} respondToClicks={true} iconColor="rgba(from var(--fg-RemindersColor) r g b / 0.6)" />
      <div className="sectionItemContent reminderItemContent">
        {contentEl}
        <a className="dialogTriggerIcon">
          <i className="fa-light fa-edit" onClick={handleClickToOpenEditDialog} title="Reminder actions"></i>
        </a>
        {listnameEl}
      </div>
    </div>
  )
}

export default ReminderItem
