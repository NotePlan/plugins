// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for Projects
// Called by ReviewItem component
// Last updated 30.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React, { useRef, useEffect, useLayoutEffect, useState, type ElementRef } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, logDebug } from '@helpers/react/reactDev'
import '../css/animation.css'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

// type RefType<T> = {| current: null | T |}

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

const DialogForProjectItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  const inputRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef = useRef <? ElementRef < 'dialog' >> (null)

  // clo(detailsMessageObject, `DialogForProjectItems: starting, with details=`)
  // const { ID, itemType, para, filename, title, content, noteType } = validateAndFlattenMessageObject(detailsMessageObject)
  // const { ID, itemType, filename, title, content, noteType } = detailsMessageObject
  // const thisItem = detailsMessageObject.item
  // if (!thisItem) { throw `Cannot find item` }
  // const { ID, itemType } = thisItem
  // const thisProject = thisItem.project
  // if (!thisProject) { throw `Cannot find project` }
  // const { filename } = thisProject
  const { ID, itemType, filename, title } = validateAndFlattenMessageObject(detailsMessageObject)

  const { sendActionToPlugin, reactSettings, sharedSettings, pluginData } = useAppContext()

  /**
   * Array of buttons to render.
   */
  const buttons = [
    { label: 'Finish Review', controlStr: 'finish', handlingFunction: 'reviewFinished', icons: [{ className: '<i className="fa-regular fa-calendar-check"></i>', position: 'left' }] },
    { label: 'Skip 1w', controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate', icons: [{ className: '<i className="fa-solid fa-forward"></i>', position: 'left' }] },
    { label: 'Skip 2w', controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate', icons: [{ className: '<i className="fa-solid fa-forward"></i>', position: 'left' }] },
    { label: 'Skip 1m', controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate', icons: [{ className: '<i className="fa-solid fa-forward"></i>', position: 'left' }] },
    { label: 'Skip 1q', controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate', icons: [{ className: '<i className="fa-solid fa-forward"></i>', position: 'left' }] },
  ]

  useEffect(() => {
    // logDebug(`DialogForProjectItems`, `BEFORE POSITION detailsMessageObject`, detailsMessageObject)
    //$FlowIgnore
    positionDialog(dialogRef)
    // logDebug(`DialogForProjectItems`, `AFTER POSITION detailsMessageObject`, detailsMessageObject)
  }, [])

  function handleTitleClick(e:MouseEvent) { // MouseEvent will contain the shiftKey, ctrlKey, altKey, and metaKey properties 
    const { modifierName  } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
    detailsMessageObject.modifierKey = modifierName 
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Title clicked in Dialog', true)
  }

  // Handle the shared closing functionality
  const closeDialog = (forceClose: boolean = false) => {
    // Start the zoom-out animation
    setAnimationClass('zoom-out')
    scheduleClose(500, forceClose)  // Match the duration of the animation
  }

  const scheduleClose = (delay: number, forceClose: boolean = false) => {
    setTimeout(() => onClose(forceClose), delay)
  }

  // Handle the date selected from CalendarPicker
  const handleDateSelect = (date: Date) => {
    if (!date) return
    // turn into 8601 format
    // const isoDateStr = date.toISOString().split('T')[0]
    const isoDateStr = hyphenatedDateString(date) // to avoid TZ issues
    const actionType = 'setNextReviewDate'

    logDebug(`DialogForProjectItems`, `Specific Date selected: ${String(date)} isoDateStr:${isoDateStr}. Will use actionType ${actionType}`)
    // sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, dateString: isoDateStr }, 'Date selected', true)
    sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, controlStr: isoDateStr }, 'Date selected', true)
    closeDialog()
  }

  function handleButtonClick(event: MouseEvent, controlStr: string, type: string) {
    clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    // const currentContent = para.content
    // $FlowIgnore
    // const updatedContent = inputRef?.current?.getValue() || ''
    logDebug(`DialogForProjectItems handleButtonClick`, `Clicked ${controlStr}`)
    console.log(
      `Button clicked on ID: ${ID} for controlStr: ${controlStr}, type: ${type}, itemType: ${itemType}, Filename: ${filename}`,
    )
    const dataToSend = {
      ...detailsMessageObject,
      actionType: type,
      controlStr: controlStr,
      updatedContent: '',
    }

    sendActionToPlugin(dataToSend.actionType, dataToSend, `Sending ${type} to plugin`, true)

    // Start the zoom/flip-out animation
    setAnimationClass('zoom-out') //flip-out

    // Dismiss dialog
    // Wait for zoom animation animation to finish before actually closing
    setTimeout(() => {
      onClose(false)
    }, 500) // Match the duration of the animation
  }

  useLayoutEffect(() => {
    // Trigger the 'effect when the component mounts
    setAnimationClass('zoom-in')

    // run before the component unmounts
    return () => {
      setAnimationClass('zoom-out')
    }
  }, [])

  return (
    <>
      {/* CSS for this part is in dashboardDialog.css */}
      {/* TODO(later): can remove most of the ids, I think */}
      {/*----------- Dialog that can be shown for any project item -----------*/}
      <dialog
        id="projectControlDialog"
        className={`projectControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on projects"
        ref={dialogRef}
      >
        <div className="dialogTitle">
        <TooltipOnKeyPress altKey={{ text: 'Open in Split View' }} metaKey={{ text: 'Open in Floating Window' }} label={`Task Item Dialog for ${title}`} showAtCursor={true}>
          <div className="dialogFileParts" onClick={handleTitleClick} style={{ cursor: 'pointer' }}>
            For <i className="pad-left pad-right fa-regular fa-file-lines"></i>
            <b>
              <span className="dialogItemNote" /*id="dialogProjectNote"*/>{title}</span>
            </b>
          </div>
          </TooltipOnKeyPress>
          <div className="dialog-top-right">
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-square-xmark"></i>
            </button>
          </div>
        </div>

        <div className="dialogBody">
          <div className="buttonGrid projectButtonGrid" id="projectDialogButtons">
            {/* line1 ---------------- */}
            <div>Project Reviews:</div>
            <div id="projectControlDialogMoveControls">
              {buttons.map((button, index) => (
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
              <CalendarPicker onSelectDate={handleDateSelect} numberOfMonths={1} />
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForProjectItems
