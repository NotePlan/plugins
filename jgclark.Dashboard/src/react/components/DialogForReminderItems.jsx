// @flow
//--------------------------------------------------------------------------
// Dashboard React dialog for Apple Reminder items (Interactive Processing + actions).
// Edit title/notes/time, reschedule, complete / delete / open in Reminders.
// Last updated 2026-08-22 for v2.4.2 by @CursorAI & @jgclark
//--------------------------------------------------------------------------

import React, { useRef, useLayoutEffect, useState, useCallback } from 'react'
import type { MessageDataObject, TSectionCode } from '../../types'
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import { buildReactSettingsAfterIPAdvance, buildReactSettingsForIPBackNavigate, canNavigateBackInIP } from './interactiveProcessingHelpers.js'
import { getAppleRemindersOpenURL } from '@helpers/NPReminders'
import { getDateObjFromDateString, hyphenatedDateString } from '@helpers/dateTime'
import { logDebug, logWarn } from '@helpers/dev'
import EditableInput from '@helpers/react/EditableInput.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

//----------------------------------------------------------------------

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: ?HTMLElement }) => void,
}

type DialogButtonProps = {
  label: string,
  controlStr: string,
  handlingFunction: string,
  description?: string,
  icons?: Array<{ className: string, position: 'left' | 'right' }>,
  sectionCodesToRefresh?: Array<TSectionCode>,
}

type EditableInputHandle = { getValue: () => string }

/**
 * Reminder actions dialog used by Interactive Processing and by the row edit icon (non-IP).
 * Does not use validateAndFlattenMessageObject (that helper requires a note filename / para).
 * @param {Props} props
 * @returns {?React$Node}
 */
const DialogForReminderItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Refs & state (before any early return - Rules of Hooks)
  //----------------------------------------------------------------------
  const dialogRef: React$RefObject<?HTMLElement> = useRef<?HTMLElement>(null)
  const inputRef: React$RefObject<?EditableInputHandle> = useRef <? EditableInputHandle > (null)
  const notesInputRef: React$RefObject<?EditableInputHandle> = useRef <? EditableInputHandle > (null)
  const timeInputRef: React$RefObject<?HTMLInputElement> = useRef <? HTMLInputElement > (null)
  const [animationClass, setAnimationClass] = useState('')
  const [resetCalendar, setResetCalendar] = useState(false)
  const [contentHasChanged, setContentHasChanged] = useState(false)
  const [notesHasChanged, setNotesHasChanged] = useState(false)
  const [timeHasChanged, setTimeHasChanged] = useState(false)

  const { sendActionToPlugin, reactSettings, setReactSettings, dashboardSettings, pluginData } = useAppContext()
  const { interactiveProcessing } = reactSettings ?? {}
  const { currentIPIndex, totalTasks } = interactiveProcessing || {}
  const { enableInteractiveProcessing, enableInteractiveProcessingTransitions } = dashboardSettings || {}
  const showAnimations = Boolean(interactiveProcessing && enableInteractiveProcessing && enableInteractiveProcessingTransitions)

  const item = detailsMessageObject?.item
  const reminder = item?.reminder
  const sectionCode: TSectionCode | string = item?.sectionCode || detailsMessageObject.sectionCodes?.[0] || ''
  const canOpenInReminders = Boolean(pluginData?.appleAppCallbacksAvailable && reminder?.id)
  const monthsToShow = pluginData.platform === 'iOS' ? 1 : 2
  const shouldStartCalendarOpen = Boolean(detailsMessageObject.modifierKey)
  const startingSelectedDate = reminder?.date ? getDateObjFromDateString(reminder.date) : new Date()

  useLayoutEffect(() => {
    positionDialog(dialogRef)
  }, [positionDialog])

  useLayoutEffect(() => {
    if (showAnimations) {
      setAnimationClass('zoom-in')
    }
    return () => {
      if (showAnimations) {
        setAnimationClass('zoom-out')
      }
    }
  }, [showAnimations])

  const getCurrentTitle = useCallback((): string => reminder?.title || '', [reminder?.title])

  const getCurrentNotes = useCallback((): string => reminder?.notes || '', [reminder?.notes])

  const getCurrentTime = useCallback((): string => reminder?.time || '', [reminder?.time])

  const getEditedTitle = useCallback((): string => inputRef?.current?.getValue() || getCurrentTitle(), [getCurrentTitle])

  const getEditedNotes = useCallback((): string => notesInputRef?.current?.getValue() ?? getCurrentNotes(), [getCurrentNotes])

  const getEditedTime = useCallback((): string => timeInputRef?.current?.value ?? getCurrentTime(), [getCurrentTime])

  const buildUpdatedPayload = useCallback((): {| updatedContent: string, updatedNotes ?: string, updatedTime ?: string |} => {
  const editedTitle = getEditedTitle()
  const editedNotes = getEditedNotes()
  const editedTime = getEditedTime()
  const payload: {| updatedContent: string, updatedNotes?: string, updatedTime?: string |} = { updatedContent: editedTitle }
if (notesHasChanged || editedNotes !== getCurrentNotes()) {
  payload.updatedNotes = editedNotes
}
if (timeHasChanged || editedTime !== getCurrentTime()) {
  payload.updatedTime = editedTime
}
return payload
  }, [getCurrentNotes, getCurrentTime, getEditedNotes, getEditedTime, getEditedTitle, notesHasChanged, timeHasChanged])

  const handleIPItemProcessed = useCallback(
    (skippedItem?: boolean = false, skipForward?: boolean = true) => {
      logDebug('DialogForReminderItems', `handleIPItemProcessed skipped=${String(skippedItem)} skipForward=${String(skipForward)}`)
      setContentHasChanged(false)
      setNotesHasChanged(false)
      setTimeHasChanged(false)
      setReactSettings((prevSettings) =>
        buildReactSettingsAfterIPAdvance(prevSettings, {
          skippedItem,
          skipForward,
          markTaskChildren: false,
        }),
      )
    },
    [setReactSettings],
  )

  const closeDialog = useCallback(
    (forceClose: boolean = false) => {
      logDebug(`DialogForReminderItems`, `closeDialog(forceClose=${String(forceClose)})`)
      if (reactSettings?.interactiveProcessing) {
        if (forceClose) {
          setReactSettings((prevSettings) => ({
            ...prevSettings,
            interactiveProcessing: null,
            dialogData: {
              ...prevSettings.dialogData,
              isOpen: false,
              isTask: true,
            },
          }))
        } else {
          handleIPItemProcessed(false)
        }
        return
      }
      if (showAnimations) {
        setAnimationClass('zoom-out')
      }
      setTimeout(() => {
        setReactSettings((prevSettings) => ({
          ...prevSettings,
          dialogData: {
            ...prevSettings.dialogData,
            isOpen: false,
            isTask: true,
          },
        }))
        onClose(forceClose)
      }, showAnimations ? 300 : 0)
    },
    [handleIPItemProcessed, onClose, reactSettings?.interactiveProcessing, setReactSettings, showAnimations],
  )

  const handleSkipClick = useCallback(
    (skipForward: boolean) => {
      if (!reactSettings?.interactiveProcessing) return
      handleIPItemProcessed(true, skipForward)
    },
    [handleIPItemProcessed, reactSettings?.interactiveProcessing],
  )

  const handleBackNavigateClick = useCallback(() => {
    if (!reactSettings?.interactiveProcessing) return
    logDebug('DialogForReminderItems', 'handleBackNavigateClick')
    setReactSettings((prevSettings) => buildReactSettingsForIPBackNavigate(prevSettings))
  }, [reactSettings?.interactiveProcessing, setReactSettings])

const handleTimeChange = useCallback(() => {
  setTimeHasChanged(true)
}, [])

  const handleButtonClick = useCallback(
    (event: MouseEvent, controlStr: string, handlingFunction: string, sectionCodesToRefresh: Array<TSectionCode> = []) => {
      const { metaKey } = extractModifierKeys(event)
      logDebug('DialogForReminderItems/handleButtonClick', `controlStr=${controlStr} handlingFunction=${handlingFunction}`)

      if (!item || !reminder) {
        logWarn('DialogForReminderItems', 'Button click with no reminder item')
        return
      }

      const currentTitle = getCurrentTitle()
      const editedTitle = getEditedTitle()
      const editedNotes = getEditedNotes()
      const editedTime = getEditedTime()
      const titleActuallyChanged = editedTitle !== currentTitle
      const notesActuallyChanged = editedNotes !== getCurrentNotes()
      const timeActuallyChanged = editedTime !== getCurrentTime()
      const hasPendingEdits =
        titleActuallyChanged || notesActuallyChanged || timeActuallyChanged || contentHasChanged || notesHasChanged || timeHasChanged

      const sectionCodesToSend = [...sectionCodesToRefresh]
      if (sectionCode && !sectionCodesToSend.includes(sectionCode)) {
        sectionCodesToSend.unshift(sectionCode)
      }

      const itemForAction = {
        ...item,
        sectionCode: item.sectionCode || sectionCode,
      }

      if (handlingFunction === 'openURL') {
        if (!reminder.id) {
          logWarn('DialogForReminderItems', 'openURL requested but reminder.id missing')
          return
        }
        const url = getAppleRemindersOpenURL(reminder.id)
        sendActionToPlugin(
          'openURL',
          { ...detailsMessageObject, actionType: 'openURL', controlStr, url, item: itemForAction },
          'Dialog open reminder in Reminders app',
          true,
        )
        return
      }

      const editPayload = hasPendingEdits ? buildUpdatedPayload() : { updatedContent: '' }
      const dataToSend = {
        ...detailsMessageObject,
        actionType: handlingFunction,
        controlStr,
        item: itemForAction,
        sectionCodes: sectionCodesToSend,
        ...editPayload,
      }

      if (handlingFunction === 'updateReminderContent') {
        if (!titleActuallyChanged && !notesActuallyChanged && !timeActuallyChanged && !contentHasChanged && !notesHasChanged && !timeHasChanged) {
          logDebug('DialogForReminderItems/handleButtonClick', `skipping no-op updateReminderContent`)
          setContentHasChanged(false)
          setNotesHasChanged(false)
          setTimeHasChanged(false)
          return
        }
      }

      sendActionToPlugin(handlingFunction, dataToSend, `Dialog requesting ${handlingFunction}`, true)
      setContentHasChanged(false)
      setNotesHasChanged(false)
      setTimeHasChanged(false)

      if (controlStr === 'openreminder') {
        return
      }

      if (!reactSettings?.interactiveProcessing) {
        setAnimationClass('zoom-out')
      }
      if (!metaKey) {
        setTimeout(() => {
          closeDialog(false)
        }, 300)
      } else {
        closeDialog(false)
      }
    },
    [
      buildUpdatedPayload,
      closeDialog,
      contentHasChanged,
      detailsMessageObject,
      getCurrentNotes,
      getCurrentTime,
      getCurrentTitle,
      getEditedNotes,
      getEditedTime,
      getEditedTitle,
      item,
      notesHasChanged,
      reactSettings?.interactiveProcessing,
      reminder,
      sectionCode,
      sendActionToPlugin,
      timeHasChanged,
    ],
  )

const handleEnterPress = useCallback(() => {
  handleButtonClick(({}: any), 'updateReminderContent', 'updateReminderContent', [])
  }, [handleButtonClick])

const handleContentChange = useCallback((_updatedContent: string) => {
  setContentHasChanged(true)
}, [])

const handleNotesChange = useCallback((_updatedNotes: string) => {
  setNotesHasChanged(true)
}, [])

const handleDateSelect = useCallback(
  (date: Date) => {
    if (!date) return
    const isoDateStr = hyphenatedDateString(date)
    handleButtonClick(({}: any), isoDateStr, 'rescheduleReminder', ['REM', 'DT', 'TB', 'DO', 'DY', 'OVERDUE'])
setResetCalendar(true)
setTimeout(() => setResetCalendar(false), 0)
    },
[handleButtonClick],
  )

const repositionCalendarForPicker = useCallback((): void => {
  positionDialog(dialogRef)
}, [positionDialog])

  //----------------------------------------------------------------------
  // Validate after hooks
  //----------------------------------------------------------------------

  if (!item || item.itemType !== 'reminder' || !reminder) {
    logWarn('DialogForReminderItems', 'No reminder item to render; bailing.')
    return null
  }

// Day-scale reschedule only (week/month/quarter shortcuts omitted for reminders)
const moveButtons: Array<DialogButtonProps> = [
  { label: 'today', controlStr: 't', sectionCodesToRefresh: ['DT', 'TB'] },
  { label: '+1d', controlStr: '+1d', sectionCodesToRefresh: ['DO'] },
  { label: '+1b', controlStr: '+1b', sectionCodesToRefresh: ['DO'] },
  { label: '+2d', controlStr: '+2d', sectionCodesToRefresh: [] },
  { label: '+3d', controlStr: '+3d', sectionCodesToRefresh: [] },
]

if (sectionCode === 'DT') {
  moveButtons.splice(0, 1) // remove 'today' when already in Today
  moveButtons.splice(3, 0, { label: '+3d', controlStr: '+3d', sectionCodesToRefresh: [] })
}

  const actionButtons: Array<DialogButtonProps> = [
    {
      label: '',
      controlStr: 'completereminder',
      description: 'Complete reminder',
      handlingFunction: 'completeReminder',
      icons: [{ className: 'fa-regular fa-circle-check', position: 'left' }],
    },
  ]

  if (canOpenInReminders) {
    actionButtons.push({
      label: 'Open',
      controlStr: 'openreminder',
      description: 'Open in Apple Reminders',
      handlingFunction: 'openURL',
      icons: [{ className: 'fa-regular fa-arrow-up-right-from-square', position: 'right' }],
    })
  }

actionButtons.push(
  {
    label: 'Unsched',
    controlStr: 'unsched',
    description: 'Remove due date from this reminder',
    handlingFunction: 'rescheduleReminder',
  },
  {
    label: '',
    controlStr: 'deletereminder',
    description: 'Delete reminder',
    handlingFunction: 'deleteReminder',
    icons: [{ className: 'fa-regular fa-trash-can', position: 'left' }],
  },
)

  const showBackNavigate = canNavigateBackInIP(currentIPIndex)

  const titleParts: Array<string> = []
  if (reminder.listname) titleParts.push(reminder.listname)
  if (reminder.date) titleParts.push(reminder.date)
  if (reminder.time) titleParts.push(reminder.time)
  const fromLabel = titleParts.length > 0 ? titleParts.join(' · ') : 'Apple Reminders'

  logDebug('DialogForReminderItems', `Rendering reminder "${reminder.title || ''}" section=${String(sectionCode)}`)

  return (
    <dialog className={`itemControlDialog reminderControlDialog ${animationClass}`} aria-labelledby="Reminder Actions Dialog" ref={dialogRef}>
      <div className="dialogTitle">
        <div className="preText">List:</div>
        <div className="dialogItemNote reminderDialogFromLabel">
          <i
            className="fa-regular fa-bell pad-right reminderDialogBellIcon"
            style={reminder.color ? { color: reminder.color } : undefined}
          />
          {fromLabel}
        </div>
        <div className="dialog-top-right">
          {interactiveProcessing && currentIPIndex !== undefined && (
            <span className="interactive-processing-status">
              {showBackNavigate && (
                <button className="skip-button" onClick={handleBackNavigateClick} title="Go back to previous item">
                  <i className="fa-solid fa-backward"></i>
                </button>
              )}
              <span>{currentIPIndex + 1}</span>/<span>{totalTasks}</span>
              <button className="skip-button" onClick={() => handleSkipClick(true)} title="Skip this item">
                <i className="fa-solid fa-forward"></i>
              </button>
            </span>
          )}
          <button className="closeButton" onClick={() => closeDialog(true)}>
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        </div>
      </div>

      <div className="dialogBody">
        <div className="buttonGrid reminderButtonGrid">
          <div className="preText reminderDialogRowLabel">Reminder:</div>
          <div id="reminderControlLine1" className="reminderDialogEditLine">
            <EditableInput
              ref={inputRef}
              initialValue={reminder.title || ''}
              className="fullTextInput dialogItemContent"
              useTextArea={pluginData.platform === 'iOS'}
              onEnterPress={handleEnterPress}
              onChange={handleContentChange}
              autofocusMe={true}
            />
          </div>

          <div className="preText reminderDialogRowLabel">Notes:</div>
          <div id="reminderControlLineNotes" className="reminderDialogEditLine">
            <EditableInput
              ref={notesInputRef}
              initialValue={reminder.notes || ''}
              placeholder="Notes (optional)"
              className="fullTextInput dialogItemContent reminderNotesInput"
              useTextArea={pluginData.platform === 'iOS'}
              onEnterPress={handleEnterPress}
              onChange={handleNotesChange}
              autofocusMe={false}
            />
            <button
              className="updateItemContentButton PCButton"
              title="Update the reminder text, notes, and time"
              onClick={(e) => handleButtonClick(e, 'updateReminderContent', 'updateReminderContent', [])}
            >
              Update
            </button>
          </div>

          <div className="preText reminderDialogRowLabel">Schedule:</div>
          <div id="reminderControlDialogMoveControls" className="reminderDialogScheduleLine">
            <input
              ref={timeInputRef}
              className="fullTextInput reminderTimeInput"
              defaultValue={reminder.time || ''}
              placeholder="HH:MM"
              title="Due time (optional)"
              onChange={handleTimeChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEnterPress()
                }
              }}
            />
            {moveButtons.map((button, index) => (
              <button
                key={index}
                className="PCButton"
                title={button.description ?? ''}
                onClick={(e) => handleButtonClick(e, button.controlStr, 'rescheduleReminder', button.sectionCodesToRefresh ?? [])}
              >
                {button.label}
              </button>
            ))}
            <CalendarPicker
              onSelectDate={handleDateSelect}
              positionFunction={repositionCalendarForPicker}
              numberOfMonths={monthsToShow}
              resetDateToDefault={resetCalendar}
              startingSelectedDate={startingSelectedDate || new Date()}
              shouldStartOpen={shouldStartCalendarOpen}
            />
          </div>

          <div className="preText reminderDialogRowLabel">Actions:</div>
          <div id="reminderControlDialogActions" className="reminderDialogActions">
            {actionButtons.map((button, index) => (
              <button
                key={index}
                className="PCButton"
                title={button.description ?? ''}
                onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction, button.sectionCodesToRefresh ?? [])}
              >
                {button.icons
                  ?.filter((i) => i.position === 'left')
                  .map((icon, i) => (
                    <i key={`L${i}`} className={`${icon.className} ${button.label !== '' ? 'pad-right' : ''}`} />
                  ))}
                {button.label}
                {button.icons
                  ?.filter((i) => i.position === 'right')
                  .map((icon, i) => (
                    <i key={`R${i}`} className={`${icon.className} ${button.label !== '' ? 'pad-left' : ''}`} />
                  ))}
              </button>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  )
}

export default DialogForReminderItems
