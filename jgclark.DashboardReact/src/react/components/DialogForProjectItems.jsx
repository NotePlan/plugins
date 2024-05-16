// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for Projects
// Called by ReviewItem component
// Last updated 16.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React, { useRef, useEffect, useLayoutEffect, useState, type ElementRef } from 'react'
// import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import { clo, logDebug } from '@helpers/react/reactDev'
import '../css/animation.css'

// type RefType<T> = {| current: null | T |}

type Props = {
  onClose: (xWasClicked?: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

const DialogForProjectItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  const inputRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef = useRef <? ElementRef < 'dialog' >> (null)

  clo(detailsMessageObject, `DialogForProjectItems: starting, with details=`)
  // const { ID, itemType, para, filename, title, content, noteType } = validateAndFlattenMessageObject(detailsMessageObject)
  // const { ID, itemType, filename, title, content, noteType } = detailsMessageObject
  const thisItem = detailsMessageObject.item
  if (!thisItem) { throw `Cannot find item` }
  const { ID, itemType } = thisItem
  const thisProject = thisItem.project
  if (!thisProject) { throw `Cannot find project` }
  const { filename } = thisProject

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
    logDebug(`DialogForProjectItems`, `BEFORE POSITION detailsMessageObject`, detailsMessageObject)
    //$FlowIgnore
    positionDialog(dialogRef)
    logDebug(`DialogForProjectItems`, `AFTER POSITION detailsMessageObject`, detailsMessageObject)
  }, [])

  function handleTitleClick() {
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
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
    const str = date.toISOString().split('T')[0]
    const actionType = `setSpecificDate`
    logDebug(`DialogForProjectItems`, `Specific Date selected: ${date.toLocaleDateString()} string:${str}`)
    sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, dateString: str }, 'Date selected', false)
    closeDialog()
  }

  function handleIconClick() {
    closeDialog()
    logDebug(`DialogForProjectItems`, `handleIconClick: something was clicked. what to do?`)
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

    sendActionToPlugin(dataToSend.actionType, dataToSend, `Sending ${type} to plugin`, false)

    // Start the zoom/flip-out animation
    setAnimationClass('zoom-out') //flip-out

    // Dismiss dialog
    // Wait for zoom animation animation to finish before actually closing
    setTimeout(() => {
      onClose()
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
      {/*----------- Single dialog that can be shown for any project item -----------*/}
      <dialog
        id="projectControlDialog"
        className={`projectControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on projects"
        ref={dialogRef}
      >
        <div className="dialogHeader">
          <div className="dialogTitle" onClick={() => handleTitleClick()}>
            For <i className="pad-left pad-right fa-regular fa-file-lines"></i>
            <b>
              <span id="dialogProjectNote">?</span>
            </b>
          </div>
          <div className="dialog-top-right">
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-square-xmark"></i>
            </button>
          </div>
        </div>

        {/* <div className="dialogBody">
          <div className="buttonGrid" id="projectDialogButtons">
            <div>Project Reviews</div>
            <div id="projectControlDialogProjectControls">
              <button data-control-str="finish">
                <i className="fa-regular fa-calendar-check"></i> Finish Review
              </button>
              <button data-control-str="nr+1w">
                <i className="fa-solid fa-forward"></i> Skip 1w
              </button>
              <button data-control-str="nr+2w">
                <i className="fa-solid fa-forward"></i> Skip 2w
              </button>
              <button data-control-str="nr+1m">
                <i className="fa-solid fa-forward"></i> Skip 1m
              </button>
              <button data-control-str="nr+1q">
                <i className="fa-solid fa-forward"></i> Skip 1q
              </button>
            </div>
            <div></div>
            <div>
              <form>
                <button id="closeButton" className="mainButton">
                  Close
                </button>
              </form>
            </div>
          </div>
        </div> */}

        <div className="dialogBody">
          <div className="buttonGrid" id="projectDialogButtons">
            {/* line1 ---------------- */}
            <div>Project Reviews</div>
            <div id="projectControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction)}>
                  {/* {button.icons?.map((icon) => (
                      <i key={icon.className} className={`${icon.className} ${icon.position === 'left' ? 'icon-left pad-right' : 'icon-right pad-left'}`}></i>
                    ))} */}
                  {button.icons?.filter((icon) => icon.position === 'left').map((icon) => (
                    <i key={icon.className} className={`${icon.className} icon-left pad-right`}></i>
                  ))}
                  {button.label}
                  {button.icons?.filter((icon) => icon.position === 'right').map((icon) => (
                    <i key={icon.className} className={`${icon.className} icon-right pad-left`}></i>
                  ))}
                </button>
              ))}
              <CalendarPicker onSelectDate={handleDateSelect} />
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForProjectItems
