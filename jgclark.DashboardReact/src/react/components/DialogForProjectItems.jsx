// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for Projects
// Called by ReviewItem component
// Last updated 24.6.2024 for v2.0.0-b14 by @jgclark
//--------------------------------------------------------------------------

import React, { useRef, useEffect, useLayoutEffect, useState, type ElementRef } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import ProjectIcon from './ProjectIcon'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, logDebug } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

// type RefType<T> = {| current: null | T |}

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

const DialogForProjectItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  // const inputRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef = useRef <? ElementRef < 'dialog' >> (null)

  // clo(detailsMessageObject, `DialogForProjectItems: starting, with details=`)
  // const { ID, itemType, para, filename, title, content, noteType } = validateAndFlattenMessageObject(detailsMessageObject)
  // const { ID, itemType, filename, title, content, noteType } = detailsMessageObject
  const thisItem = detailsMessageObject?.item
  if (!thisItem) { throw `Cannot find item` }
  const lastProgressText = (thisItem.project?.lastProgressComment) ? `last: ${thisItem.project?.lastProgressComment}` : ''
  // const { ID, itemType } = thisItem
  // const thisProject = thisItem.project
  // if (!thisProject) { throw `Cannot find project` }
  // const { filename } = thisProject
  const { ID, itemType, filename, title } = validateAndFlattenMessageObject(detailsMessageObject)

  const { sendActionToPlugin, /* reactSettings, sharedSettings, */ pluginData } = useAppContext()
  const isDesktop = pluginData.platform === 'macOS'

  const reviewDetails = (thisItem.project?.reviewInterval) ? ` (review: ${thisItem.project.reviewInterval})` : ''

  /**
   * Arrays of buttons to render.
   */
  const reviewButtons = [
    { label: 'Finish Review', controlStr: 'finish', handlingFunction: 'reviewFinished', icons: [{ className: 'fa-regular fa-calendar-check', position: 'left' }] },
    { label: 'Skip 1w', controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }] },
    { label: 'Skip 2w', controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }] },
    { label: 'Skip 1m', controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }] },
    { label: 'Skip 1q', controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }] },
  ]

  // Note: These cannot currently be shown on iOS/iPadOS as the CommandBar is not available while the window is open. They get ignored below.
  const projectButtons = [
    { label: 'Complete', controlStr: 'complete', handlingFunction: 'completeProject', icons: [{ className: 'fa-solid fa-circle-check', position: 'left' }] },
    { label: 'Cancel', controlStr: 'cancel', handlingFunction: 'cancelProject', icons: [{ className: 'fa-solid fa-circle-xmark', position: 'left' }] },
    { label: 'Pause', controlStr: 'cancel', handlingFunction: 'togglePauseProject', icons: [{ className: 'fa-solid fa-circle-pause', position: 'left' }] },
    // TODO(later): I wanted this icon to be fa-solid fa-arrows-left-right-to-line, but it wasn't available when we made the build of icons.
    // Will it become available if we switch to SVG delivery ?
    { label: 'New Interval', controlStr: 'newint', handlingFunction: 'setNewReviewInterval', icons: [{ className: 'fa-solid fa-arrows-left-right', position: 'left' }] },
  ]

  // Note: These cannot currently be shown on iOS/iPadOS as the CommandBar is not available while the window is open. They get ignored below.
  const progressButtons = [
    { label: 'Add', controlStr: 'progress', handlingFunction: 'addProgress', icons: [{ className: 'fa-solid fa-comment-lines', position: 'left' }] },
  ]

  useEffect(() => {
    // logDebug(`DialogForProjectItems`, `BEFORE POSITION detailsMessageObject`, detailsMessageObject)
    // $FlowIgnore[incompatible-call]
    if (dialogRef) positionDialog(dialogRef)
    // logDebug(`DialogForProjectItems`, `AFTER POSITION detailsMessageObject`, detailsMessageObject)
  }, [])

  function handleTitleClick(e:MouseEvent) { // MouseEvent will contain the shiftKey, ctrlKey, altKey, and metaKey properties 
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
    detailsMessageObject.modifierKey = modifierName
    logDebug('DFPI', `handleTitleClick`)
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Project Title clicked in Dialog', true)
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

  function handleButtonClick(_event: MouseEvent, controlStr: string, type: string) {
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
      {/*----------- Dialog that can be shown for any project item -----------*/}
      <dialog
        id="projectControlDialog"
        className={`projectControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on projects"
        ref={dialogRef}
      >
        {/* Title area ---------------- */}
        <div className="dialogTitle">
        <TooltipOnKeyPress altKey={{ text: 'Open in Split View' }} metaKey={{ text: 'Open in Floating Window' }} label={`Task Item Dialog for ${title}`}>
          <div className="dialogFileParts" onClick={handleTitleClick} style={{ cursor: 'pointer' }}>
              For <ProjectIcon item={thisItem} />
              <b>
                <span className="dialogItemNote" >{title}</span>
              </b>
              {reviewDetails}
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
            <div>Review:</div>
            <div>
              {reviewButtons.map((button, index) => (
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

            {/* line2 (macOS only) ---------------- */}
            {isDesktop && (
              <>
                <div>Project:</div>
                <div>
                  {projectButtons.map((button, index) => (
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
              </>
            )}

            {/* line3 ---------------- */}
            <div>Progress:</div>
            <div>
              {progressButtons.map((button, index) => (
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
              <span className="pad-left projectProgress">
                {lastProgressText}
              </span>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForProjectItems
