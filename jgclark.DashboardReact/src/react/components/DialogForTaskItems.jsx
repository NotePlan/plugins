// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Called by TaskItem component
// Last updated 16.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
// Notes:
// - onClose & detailsMessageObject are passed down from Dashboard.jsx::handleDialogClose
//
// TODO: dbw Flip in/out
import React, { useRef, useEffect, useLayoutEffect, useState, type ElementRef } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
// import useRefreshTimer from './useRefreshTimer.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import StatusIcon from './StatusIcon.jsx'
import { logDebug, clo, JSP } from '@helpers/react/reactDev'
import EditableInput from '@helpers/react/EditableInput.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
// TODO(dbw): can you explain this kind of import, which I have never seen before:
import '../css/animation.css'

type Props = {
  onClose: (xWasClicked?: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

const DialogForTaskItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  const inputRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef = useRef <? ElementRef < 'dialog' >> (null)

  // clo(detailsMessageObject, `DialogForTaskItems: starting, with details=`)
  const { ID, itemType, para, filename, title, content, noteType } = validateAndFlattenMessageObject(detailsMessageObject)

  // TODO: disabling this for the moment so we can see logs without refreshes clouding them
  // const { refreshTimer } = useRefreshTimer({ maxDelay: 5000 })

  const { sendActionToPlugin, reactSettings, sharedSettings, pluginData } = useAppContext()

  const resched = sharedSettings?.rescheduleNotMove || pluginData?.settings.rescheduleNotMove || false

  const dateChangeFunctionToUse = resched ? 'updateTaskDate' : 'moveFromCalToCal'

  const { interactiveProcessing } = reactSettings??{}
  const { currentIPIndex, totalTasks } = interactiveProcessing || {}
  const { enableInteractiveProcessing, enableInteractiveProcessingTransitions } = sharedSettings || {}
  const showAnimations = interactiveProcessing && enableInteractiveProcessing && enableInteractiveProcessingTransitions
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
  // Note: Extra setup is required for certain buttons:
  // - Cancel button icon circle or square, and function
  // - Toggle Type icon circle or square
  const otherControlButtons = [
    { label: 'Cancel', controlStr: 'canceltask', handlingFunction: (itemType === 'checklist') ? 'cancelChecklist' : 'cancelTask', icons: [{ className: `fa-regular ${(itemType === 'checklist') ? 'fa-square-xmark' : 'fa-circle-xmark'}`, position: 'left' }] },
    { label: 'Move to', controlStr: 'movetonote', handlingFunction: 'moveToNote', icons: [{ className: 'fa-regular fa-file-lines', position: 'left' }] },
    { label: 'Priority', controlStr: 'priup', handlingFunction: 'cyclePriorityStateUp', icons: [{ className: 'fa-regular fa-arrow-up', position: 'left' }] },
    { label: 'Priority', controlStr: 'pridown', handlingFunction: 'cyclePriorityStateDown', icons: [{ className: 'fa-regular fa-arrow-down', position: 'left' }] },
    { label: 'Change to', controlStr: 'tog', handlingFunction: 'toggleType', icons: [{ className: (itemType === 'checklist') ? 'fa-regular fa-circle' : 'fa-regular fa-square', position: 'right' }] },
    { label: 'Complete Then', controlStr: 'ct', handlingFunction: 'completeTaskThen' },
    { label: 'Unschedule', controlStr: 'unsched', handlingFunction: 'unscheduleItem' },
  ]

  useEffect(() => {
    logDebug(`DialogForTaskItems`, `BEFORE POSITION dialogRef.current.style.topbounds=${String(dialogRef.current?.getBoundingClientRect().top) || ""}`)
    //$FlowIgnore
    positionDialog(dialogRef)
    logDebug(`DialogForTaskItems`, `AFTER POSITION dialogRef.current.style.top=${String(dialogRef.current?.style.top || '') || ""}`)
  }, [])

  function handleTitleClick() {
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Title clicked in Dialog', true)
  }

  // Handle the shared closing functionality
  const closeDialog = (forceClose: boolean = false) => {
    // Start the zoom-out animation
    showAnimations ? setAnimationClass('zoom-out') : null
    scheduleClose(500, forceClose)  // Match the duration of the animation
  }

  const scheduleClose = (delay: number, forceClose: boolean = false) => {
    setTimeout(() => onClose(forceClose), delay)
  }

  // during overduecycle, user wants to skip this item (leave it overdue)
  const handleSkipClick = () => {
    closeDialog()
  }

  // Handle the date selected from CalendarPicker
  const handleDateSelect = (date: Date) => {
    if (!date) return
    // turn into 8601 format
    const str = date.toISOString().split('T')[0]
    const actionType = `setSpecificDate`
    logDebug(`DialogForTaskItems`, `Specific Date selected: ${date.toLocaleDateString()} string:${str}`)
    sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, dateString: str }, 'Date selected', true)
    closeDialog()
  }

  function handleIconClick() {
    closeDialog()
    logDebug(`DialogForTaskItems`, `handleIconClick: something was clicked. what to do?`)
  }

  function handleButtonClick(event: MouseEvent, controlStr: string, type: string) {
    const { metaKey, altKey, ctrlKey, shiftKey } = extractModifierKeys(event) // Indicates whether a modifier key was pressed
    // clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    const currentContent = para.content
    // $FlowIgnore
    const updatedContent = inputRef?.current?.getValue() || ''
    logDebug(`DialogForTaskItems handleButtonClick`, `Clicked ${controlStr}`)
    console.log(
      `Button clicked on ID: ${ID} for controlStr: ${controlStr}, type: ${type}, itemType: ${itemType}, Filename: ${filename}, metaKey: ${String(metaKey)} altKey: ${String(
        altKey,
      )} ctrlKey: ${String(ctrlKey)} shiftKey: ${String(shiftKey)}`,
    )
    if (controlStr === 'update') {
      logDebug(`DialogForTaskItems`, `handleButtonClick - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
    }
    const dataToSend = {
      ...detailsMessageObject,
      actionType: type,
      controlStr: controlStr,
      updatedContent: '',
    }
    if (currentContent !== updatedContent) dataToSend.updatedContent = updatedContent

    sendActionToPlugin(dataToSend.actionType, dataToSend, `Sending ${type} to plugin`, true)
    if (controlStr === 'openNote' || controlStr.startsWith("pri") || controlStr === "update") return //don't close dialog yet

    // Send 'refresh' action to plugin after n ms - this is a bit of a hack
    // to get around the updateCache not being reliable.
    // refreshTimer()
    // logDebug(`DialogForTaskItems`, `handleButtonClick - !!! REFRESH TIMER TURNED OFF TEMPORARILY !!!`)

    // Start the zoom/flip-out animation
    setAnimationClass('zoom-out') //flip-out

    // Dismiss dialog, unless meta key pressed
    if (!metaKey) {
      // Wait for zoom animation animation to finish before actually closing
      setTimeout(() => {
        onClose()
      }, 500) // Match the duration of the animation
    } else {
      console.log(`Option key pressed. Closing without animation.`)
      onClose()
    }
  }

  useLayoutEffect(() => {
    // Trigger the 'effect when the component mounts
    showAnimations ? setAnimationClass('zoom-in') : null

    // run before the component unmounts
    return () => {
      showAnimations ? setAnimationClass('zoom-out') : null
    }
  }, [])

  return (
    <>
      {/* CSS for this part is in dashboardDialog.css */}
      {/* TODO(later): can remove most of the ids, I think */}
      {/*----------- Dialog that can be shown for any task-based item -----------*/}
      <dialog
        id="itemControlDialog"
        className={`itemControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on items"
        ref={dialogRef}
      >
        <div className="dialogTitle">
          <div id="dialogFileParts" onClick={() => handleTitleClick()}>
            <span className="preText">From:</span>
            <i className="pad-left pad-right fa-regular fa-file-lines"></i>
            <span className="dialogItemNote" /*id="dialogItemNote"*/>{title}</span>
            {noteType === 'Calendar' ? <span className="dialogItemNoteType"> (Calendar Note)</span> : null}
          </div>
          <div className="dialog-top-right">
            {interactiveProcessing && currentIPIndex !== undefined && (
              <>
                <span className="interactive-processing-status">
                  <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i>
                  <span className="fa-layers-text" data-fa-transform="shrink-8" style={{ fontWeight: 500, paddingLeft: "3px" }}>
                    {currentIPIndex}
                  </span>
                  /
                  <span className="fa-layers-text" data-fa-transform="shrink-8" style={{ fontWeight: 500, paddingLeft: "3px" }}>
                    {totalTasks}
                  </span>
                </span>
                <button className="skip-button" onClick={handleSkipClick} title="Skip this item">
                  <i className="fa-regular fa-forward"></i>
                </button>
              </>
            )}
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-square-xmark"></i>
            </button>
          </div>
        </div>

        <div className="dialogBody">
          <div className="buttonGrid taskButtonGrid" id="itemDialogButtons">
            {/* line1 ---------------- */}
            <div className="preText">For:</div>
            <div id="taskControlLine1">
              {detailsMessageObject?.item ? <StatusIcon
                item={detailsMessageObject?.item}
                respondToClicks={true}
                onIconClick={handleIconClick}
              /> : null}
              {/* $FlowIgnore - Flow doesn't like the ref */}
              <EditableInput ref={inputRef} initialValue={content} className="fullTextInput dialogItemContent" />
              <button className="updateItemContentButton PCButton" onClick={(e) => handleButtonClick(e, 'updateItemContent', 'updateItemContent')}>
                Update
              </button>
            </div>

            {/* line2 ---------------- */}
            <div className="preText">{resched ? 'Reschedule to' : 'Move to'}:</div>
            <div id="itemControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" onClick={(e) => handleButtonClick(e, button.controlStr, dateChangeFunctionToUse)}>
                  {button.label}
                </button>
              ))}
              <CalendarPicker onSelectDate={handleDateSelect} />
            </div>
            {/* </div> */}

            {/* line3 ---------------- */}
            <div className="preText">Other controls:</div>
            <div id="itemControlDialogOtherControls">
              {otherControlButtons.map((button, index) => (
                <button key={index} className="PCButton" onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction)}>
                  {button.icons?.filter((icon) => icon.position === 'left').map((icon) => (
                    <i key={icon.className} className={`${icon.className} icon-left pad-right`}></i>
                  ))}
                  {button.label}
                  {button.icons?.filter((icon) => icon.position === 'right').map((icon) => (
                    <i key={icon.className} className={`${icon.className} icon-right pad-left`}></i>
                  ))}
                </button>
              ))}
            </div>
            {/* </div> */}
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForTaskItems
