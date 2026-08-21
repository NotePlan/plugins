// @flow
//--------------------------------------------------------------------------
// Dashboard React dialog for Apple Reminder items (Interactive Processing + actions).
// Complete / delete / open in Reminders; skip controls when IP is active.
// Last updated 2026-08-21 for v2.4.1 by @CursorAI
//--------------------------------------------------------------------------

import React, { useRef, useLayoutEffect, useState, useCallback } from 'react'
import type { MessageDataObject, TSectionCode } from '../../types'
import { useAppContext } from './AppContext.jsx'
import { buildReactSettingsAfterIPAdvance, buildReactSettingsForIPBackNavigate, canNavigateBackInIP } from './interactiveProcessingHelpers.js'
import { getAppleRemindersOpenURL } from '@helpers/NPReminders'
import { logDebug, logWarn } from '@helpers/dev'
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
}

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
  const [animationClass, setAnimationClass] = useState('')

  const { sendActionToPlugin, reactSettings, setReactSettings, dashboardSettings, pluginData } = useAppContext()
  const { interactiveProcessing } = reactSettings ?? {}
  const { currentIPIndex, totalTasks } = interactiveProcessing || {}
  const { enableInteractiveProcessing, enableInteractiveProcessingTransitions } = dashboardSettings || {}
  const showAnimations = Boolean(interactiveProcessing && enableInteractiveProcessing && enableInteractiveProcessingTransitions)

  const item = detailsMessageObject?.item
  const reminder = item?.reminder
  const sectionCode: TSectionCode | string = item?.sectionCode || detailsMessageObject.sectionCodes?.[0] || ''
  const canOpenInReminders = Boolean(pluginData?.appleAppCallbacksAvailable && reminder?.id)

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

  const handleIPItemProcessed = useCallback(
    (skippedItem?: boolean = false, skipForward?: boolean = true) => {
      logDebug('DialogForReminderItems', `handleIPItemProcessed skipped=${String(skippedItem)} skipForward=${String(skipForward)}`)
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

  const handleButtonClick = useCallback(
    (event: MouseEvent, controlStr: string, handlingFunction: string) => {
      const { metaKey } = extractModifierKeys(event)
      logDebug('DialogForReminderItems/handleButtonClick', `controlStr=${controlStr} handlingFunction=${handlingFunction}`)

      if (!item || !reminder) {
        logWarn('DialogForReminderItems', 'Button click with no reminder item')
        return
      }

      if (handlingFunction === 'openURL') {
        if (!reminder.id) {
          logWarn('DialogForReminderItems', 'openURL requested but reminder.id missing')
          return
        }
        const url = getAppleRemindersOpenURL(reminder.id)
        sendActionToPlugin(
          'openURL',
          { ...detailsMessageObject, actionType: 'openURL', controlStr, url, item },
          'Dialog open reminder in Reminders app',
          true,
        )
        // Stay open so IP can continue after peeking in Reminders
        return
      }

      const itemForAction = {
        ...item,
        sectionCode: item.sectionCode || sectionCode,
      }
      const dataToSend = {
        ...detailsMessageObject,
        actionType: handlingFunction,
        controlStr,
        item: itemForAction,
        sectionCodes: sectionCode ? [sectionCode] : detailsMessageObject.sectionCodes || [],
      }
      sendActionToPlugin(handlingFunction, dataToSend, `Dialog requesting ${handlingFunction}`, true)

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
    [closeDialog, detailsMessageObject, item, reactSettings?.interactiveProcessing, reminder, sectionCode, sendActionToPlugin],
  )

  //----------------------------------------------------------------------
  // Validate after hooks
  //----------------------------------------------------------------------

  if (!item || item.itemType !== 'reminder' || !reminder) {
    logWarn('DialogForReminderItems', 'No reminder item to render; bailing.')
    return null
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

  actionButtons.push({
    label: '',
    controlStr: 'deletereminder',
    description: 'Delete reminder',
    handlingFunction: 'deleteReminder',
    icons: [{ className: 'fa-regular fa-trash-can', position: 'left' }],
  })

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
        <div className="preText">From:</div>
        <div className="dialogItemNote reminderDialogFromLabel">
          <i className="fa-regular fa-bell pad-right" />
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
          <div className="preText reminderDialogForLabel">For:</div>
          <div className="reminderDialogTitleLine dialogItemContent">
            <span className="reminderDialogTitleText">{reminder.title || '(untitled reminder)'}</span>
            {reminder.notes ? <span className="reminderDetails pad-left">{reminder.notes}</span> : null}
          </div>

          <div className="preText">Actions:</div>
          <div id="reminderControlDialogActions" className="reminderDialogActions">
            {actionButtons.map((button, index) => (
              <button
                key={index}
                className="PCButton"
                title={button.description ?? ''}
                onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction)}
              >
                {button.icons
                  ?.filter((i) => i.position === 'left')
                  .map((icon, i) => (
                    <i key={`L${i}`} className={`${icon.className} pad-right`} />
                  ))}
                {button.label}
                {button.icons
                  ?.filter((i) => i.position === 'right')
                  .map((icon, i) => (
                    <i key={`R${i}`} className={`${icon.className} pad-left`} />
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
