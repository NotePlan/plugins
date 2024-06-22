// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Called by TaskItem component
// Last updated 14.6.2024 for v2.0.0-b8 by @jgc
//--------------------------------------------------------------------------
// Notes:
// - onClose & detailsMessageObject are passed down from Dashboard.jsx::handleDialogClose
//
import React, { useRef, useEffect, useLayoutEffect, useState, type ElementRef } from 'react'
// import { allSectionDetails } from "../../constants"
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import StatusIcon from './StatusIcon.jsx'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug } from '@helpers/react/reactDev'
import EditableInput from '@helpers/react/EditableInput.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

const DialogForTaskItems = ({ details:detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  // const [detailsMessageObject,setDetailsMessageObject] = useState(details) // was thinking this needed to change, but maybe not
  const inputRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef = useRef <? ElementRef < 'dialog' >> (null)

  clo(detailsMessageObject, `DialogForTaskItems: starting, with details=`, 2)
  const { ID, itemType, para, filename, title, content, noteType, sectionCodes } = validateAndFlattenMessageObject(detailsMessageObject)

  const { sendActionToPlugin, reactSettings, sharedSettings, pluginData } = useAppContext()

  const resched = sharedSettings?.rescheduleNotMove || pluginData?.settings.rescheduleNotMove || false
  // logDebug('DialogForTaskItems', `- rescheduleNotMove: sharedSettings = ${String(sharedSettings?.rescheduleNotMove)} / settings = ${String(pluginData?.settings.rescheduleNotMove)}`)

  // Deduce the action to take when this is a date-changed button
  // - Item in calendar note & move -> move to new calendar note for that picked date: use doMoveFromCalToCal()
  // - All 3 other cases: use doUpdateTaskDate()
  const dateChangeFunctionToUse = (noteType === 'Calendar' && !resched)
    ? 'moveFromCalToCal' : 'updateTaskDate'
  logDebug('DialogForTaskItems', `- dateChangeFunctionToUse = ${dateChangeFunctionToUse} from resched?:${String(resched)}`)

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
    // logDebug(`DialogForTaskItems`, `BEFORE POSITION dialogRef.current.style.topbounds=${String(dialogRef.current?.getBoundingClientRect().top) || ""}`)
    // $FlowIgnore
    positionDialog(dialogRef)
    // logDebug(`DialogForTaskItems`, `AFTER POSITION dialogRef.current.style.top=${String(dialogRef.current?.style.top || '') || ""}`)
  }, [])

  function handleTitleClick(e:MouseEvent) { // MouseEvent will contain the shiftKey, ctrlKey, altKey, and metaKey properties 
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
    detailsMessageObject.modifierKey = modifierName 
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Title clicked in Dialog', true)
  }

  // Handle the shared closing functionality
  const closeDialog = (forceClose: boolean = false) => {
    // Start the zoom-out animation
    showAnimations ? setAnimationClass('zoom-out') : null
    scheduleClose(300, forceClose)  // Match the duration of the animation
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
    // const isoDateStr = date.toISOString().split('T')[0]
    const isoDateStr = hyphenatedDateString(date) // to avoid TZ issues
    sendActionToPlugin(dateChangeFunctionToUse, { ...detailsMessageObject, actionType: dateChangeFunctionToUse, controlStr: isoDateStr }, `${isoDateStr} selected in date picker`, true)
    closeDialog()
  }

  function handleIconClick() {
    logDebug(`DialogForTaskItems/handleIconClick`, `handleIconClick: something was clicked. what to do ❓❓`)
    // TODO(@dwertheimer): I'm confused. This fires, but also goes on to Complete or Cancel an item, but I can't see how that's wired up.
    closeDialog()
  }

  function handleButtonClick(event: MouseEvent, controlStr: string, handlingFunction: string) {
    const { metaKey, altKey, ctrlKey, shiftKey } = extractModifierKeys(event) // Indicates whether a modifier key was pressed
    // clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    const currentContent = para.content
    logDebug(`DialogForTaskItems handleButtonClick`, `Button clicked on ID: ${ID} for controlStr: ${controlStr}, handlingFunction: ${handlingFunction}, itemType: ${itemType}, filename: ${filename}, metaKey: ${String(metaKey)} altKey: ${String(
        altKey,
      )} ctrlKey: ${String(ctrlKey)} shiftKey: ${String(shiftKey)}`,
    )
    // $FlowIgnore
    const updatedContent = inputRef?.current?.getValue() || ''
    if (controlStr === 'update') {
      logDebug(`DialogForTaskItems`, `handleButtonClick - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
    }
    // let handlingFunctionToUse = handlingFunction
    // const actionType = (noteType === 'Calendar' && !resched) ? 'moveFromCalToCal' : 'updateTaskDate'
    // logDebug(`DialogForTaskItems`, `handleButtonClick - actionType calculated:'${actionType}', resched?:${String(resched)}`)

    const dataToSend = {
      ...detailsMessageObject,
      actionType: handlingFunction,
      controlStr: controlStr,
      updatedContent: (currentContent !== updatedContent) ? updatedContent : '',
      sectionCodes: sectionCodes,
    }

    sendActionToPlugin(handlingFunction, dataToSend, `Dialog requesting call to ${handlingFunction}`, true)
    if (controlStr === 'openNote' || controlStr.startsWith("pri") || controlStr === "update") return //don't close dialog yet

    // Start the zoom/flip-out animation
    setAnimationClass('zoom-out') //flip-out

    // Dismiss dialog, unless meta key pressed
    if (!metaKey) {
      // Wait for zoom animation animation to finish before actually closing
      setTimeout(() => {
        onClose(false)
      }, 300) // Match the duration of the animation
    } else {
      console.log(`Option key pressed. Closing without animation.`)
      onClose(false)
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
      {/* TEST: removing most of the ids */}
      {/*----------- Dialog that can be shown for any task-based item -----------*/}
      <dialog
        /*id="itemControlDialog"*/
        className={`itemControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on items"
        ref={dialogRef}
      >
        <div className="dialogTitle">
        <TooltipOnKeyPress altKey={{ text: 'Open in Split View' }} metaKey={{ text: 'Open in Floating Window' }} label={`Task Item Dialog for ${title}`} >
            <div /*id="dialogFileParts"*/ onClick={handleTitleClick} style={{ cursor: 'pointer' }}>
            <span className="preText">From:</span>
            <i className="pad-left pad-right fa-regular fa-file-lines"></i>
              <span className="dialogItemNote">{title}</span>
            {noteType === 'Calendar' ? <span className="dialogItemNoteType"> (Calendar Note)</span> : null}
          </div>
          </TooltipOnKeyPress>
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
                  <i className="fa-solid fa-forward"></i>
                </button>
              </>
            )}
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-square-xmark"></i>
            </button>
          </div>
        </div>

        <div className="dialogBody">
          <div className="buttonGrid taskButtonGrid" /*id="itemDialogButtons"*/>
            {/* line1 ---------------- */}
            <div className="preText">For:</div>
            <div id="taskControlLine1" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {detailsMessageObject?.item ? <StatusIcon
                location={"dialog"}
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
            <div /*id="itemControlDialogOtherControls"*/>
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
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForTaskItems
