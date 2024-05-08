// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Last updated 6.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
// Notes:
// - onClose & details are passed down from Dashboard.jsx::handleDialogClose
//
// TODO: dbw Flip in/out
import React, { useRef, useEffect, useState } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { useAppContext } from './AppContext.jsx'
import useRefreshTimer from './useRefreshTimer.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import { logDebug, clo } from '@helpers/react/reactDev'
import EditableInput from '@helpers/react/EditableInput.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

type RefType<T> = {| current: null | T |}

type TDialogDetails = {
  id: string,
  itemType: string,
  para: TParagraph,
  filename: string,
  title: string,
  reschedOrMove: string,
  content: string,
  noteType: string,
}

type Props = {
  onClose: () => void,
  details: TDialogDetails,
  positionDialog: (dialogRef: RefType<any>) => {},
}

const DialogForTaskItems = ({ details, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')

  logDebug(`DialogForTaskItems`, `inside component code details=`, details)
  // FIXME(@dwertheimer): I create a Type for this, but then your function doesn't like it
  const { id, itemType, para, filename, title, reschedOrMove, content, noteType } = validateAndFlattenMessageObject(details)

  // TODO: disabling this for the moment so we can see logs without refreshes clouding them
  // const { refreshTimer } = useRefreshTimer({ maxDelay: 5000 })

  const { sendActionToPlugin, reactSettings } = useAppContext()
  const inputRef = useRef()
  const dialogRef = useRef(null)

  const dateChangeFunctionToUse = reschedOrMove === 'resched' ? 'updateTaskDate' : 'moveFromCalToCal'

  /**
   * Array of buttons to render.
   */
  const buttons = [
    { label: 'today', controlStr: 't' },
    { label: '+1d', controlStr: '+1d' },
    { label: '+1b', controlStr: '+1b' },
    { label: '+2d', controlStr: '+2d' },
    { label: 'this week', controlStr: '+0w' },
    { label: '+1w', controlStr: '+1w' },
    { label: '+2w', controlStr: '+2w' },
    { label: 'this month', controlStr: '+0m' },
    { label: 'this quarter', controlStr: '+0q' },
  ]
  const otherControlButtons = [
    { label: 'Cancel', controlStr: 'canceltask', handlingFunction: 'cancelTask' },
    { label: 'Move to', controlStr: 'movetonote', handlingFunction: 'moveToNote', icons: [{ className: 'fa-regular fa-file-lines', position: 'left' }] },
    { label: 'Priority', controlStr: 'priup', handlingFunction: 'cyclePriorityStateUp', icons: [{ className: 'fa-regular fa-arrow-up', position: 'left' }] },
    { label: 'Priority', controlStr: 'pridown', handlingFunction: 'cyclePriorityStateDown', icons: [{ className: 'fa-regular fa-arrow-down', position: 'left' }] },
    { label: 'Toggle Type', controlStr: 'tog', handlingFunction: 'toggleType' },
    { label: 'Complete Then', controlStr: 'ct', handlingFunction: 'completeTaskThen' },
    { label: 'Unschedule', controlStr: 'unsched', handlingFunction: 'unscheduleItem' },
  ]

  useEffect(() => {
    logDebug(`DialogForTaskItems`, `BEFORE POSITION details`, details)
    positionDialog(dialogRef)
    logDebug(`DialogForTaskItems`, `AFTER POSITION details`, details)
  }, [])

  function handleTitleClick() {
    const dataObjectToPassToFunction = {
      actionType: 'showNoteInEditorFromFilename',
      ...details,
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Item clicked', true)
  }

  // during overduecycle, user wants to skip this item (leave it overdue)
  const handleSkipClick = () => {
    onClose()
  }

  // Handle the date selected from CalendarPicker
  const handleDateSelect = (date: Date) => {
    if (!date) return
    // turn into 8601 format
    const str = date.toISOString().split('T')[0]
    const actionType = `setSpecificDate`
    logDebug(`DialogForTaskItems`, `Specific Date selected: ${date.toLocaleDateString()} string:${str}`)
    sendActionToPlugin(actionType, { ...details, actionType, dateString: str }, 'Date selected', false)
    onClose()
  }

  function handleButtonClick(event: MouseEvent, controlStr: string, type: string) {
    const { metaKey, altKey, ctrlKey, shiftKey } = extractModifierKeys(event) // Indicates whether a modifier key was pressed
    clo(details, 'handleButtonClick details')
    const currentContent = para.content
    const updatedContent = inputRef?.current?.getValue() || ''
    logDebug(`DialogForTaskItems handleButtonClick`, `Clicked ${controlStr}`)
    console.log(
      `Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, itemType: ${itemType}, Filename: ${filename}, metaKey: ${String(metaKey)} altKey: ${String(
        altKey,
      )} ctrlKey: ${String(ctrlKey)} shiftKey: ${String(shiftKey)}`,
    )
    if (controlStr === 'update') {
      logDebug(`DialogForTaskItems`, `handleButtonClick - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
    }
    const dataToSend = {
      ...details,
      actionType: type,
      controlStr: controlStr,
      updatedContent: '',
    }
    if (currentContent !== updatedContent) dataToSend.updatedContent = updatedContent

    sendActionToPlugin(dataToSend.actionType, dataToSend, `Sending ${type} to plugin`, false)
    if (controlStr === 'openNote' || controlStr.startsWith("pri")) return //don't close dialog yet

    // Send 'refresh' action to plugin after n ms - this is a bit of a hack
    // to get around the updateCache not being reliable.
    // refreshTimer()
    logDebug(`DialogForTaskItems`, `handleButtonClick - !!! REFRESH TIMER TURNED OFF TEMPORARILY !!!`)

    // Start the flip-out animation
    setAnimationClass('flip-out')

    // Dismiss dialog, unless meta key pressed
    if (!metaKey) {
      // Wait for animation to finish before actually closing
      setTimeout(() => {
        onClose()
      }, 500) // Match the duration of the flip-out animation
    } else {
      console.log(`Option key pressed. But closing dialog anyway.`)
      onClose()
    }
  }

  useEffect(() => {
    // Trigger the 'flip-in' effect when the component mounts
    setAnimationClass('flip-in')

    // Setup to flip out before the component unmounts
    return () => {
      setAnimationClass('flip-out')
    }
  }, [])

  return (
    <>
      {/* CSS for this part is in dashboardDialog.css */}
      {/*----------- Single dialog that can be shown for any task-based item -----------*/}
      <dialog
        id="itemControlDialog"
        className={`itemControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on items"
        ref={dialogRef}
      >
        <div className="dialogTitle" onClick={() => handleTitleClick()}>
          From: <i className="pad-left pad-right fa-regular fa-file-lines"></i>
          <b>
            <span id="dialogItemNote">{title}</span>
            {noteType === 'Calendar' ? <span className="dialogItemNoteType"> (Calendar Note)</span> : null}
          </b>
          <div className="dialog-top-right">
            {reactSettings?.overdueProcessing && (<button className="skipButton" onClick={handleSkipClick}>
              <i className="far fa-forward"></i>
            </button>
            )}
            <button className="closeButton" onClick={() => onClose(true)}>
              <i className="fa fa-times"></i>
            </button>
          </div>
        </div>
        <div className="dialogBody">
          <div className="buttonGrid" id="itemDialogButtons">
            <div>For</div>
            <div className="dialogDescription">
              <EditableInput ref={inputRef} initialValue={content} className="fullTextInput dialogItemContent" />
              <button className="updateItemContentButton" data-control-str="update" onClick={(e) => handleButtonClick(e, 'updateItemContent', 'updateItemContent')}>
                Update
              </button>
            </div>
            <div>Move to</div>
            <div id="itemControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr} onClick={(e) => handleButtonClick(e, button.controlStr, dateChangeFunctionToUse)}>
                  {button.label}
                </button>
              ))}
              <CalendarPicker onSelectDate={handleDateSelect} />
            </div>
            <div>Other controls</div>
            <div id="itemControlDialogOtherControls">
              {otherControlButtons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr} onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction)}>
                  {button.icons?.map((icon) => (
                    <i key={icon.className} className={`${icon.className} ${icon.position === 'left' ? 'icon-left pad-right' : 'icon-right pad-left'}`}></i>
                  ))}
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForTaskItems
