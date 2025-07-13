// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for Projects
// Called by Dialog component
// Last updated 2025-04-06  for v2.2.0.a11
//--------------------------------------------------------------------------

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'
// import type { ElementRef } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject } from "../../types"
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import ProjectIcon from './ProjectIcon'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { hyphenatedDateString, relativeDateFromNumber } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logInfo } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDialogElement | null }) => void,
}

type DialogButtonProps = {
  label: string,
  controlStr: string,
  handlingFunction?: string,
  description?: string,
  icons?: Array<{ className: string, position: 'left' | 'right' }>,
  notOnMobile: boolean, // If true, the button will only be shown on macOS, because of limitations on iOS/iPadOS
}

const DialogForProjectItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  const [animationClass, setAnimationClass] = useState('')
  const [resetCalendar, setResetCalendar] = useState(false)

  // const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
  const dialogRef: React$RefObject<?HTMLDialogElement> = useRef <? HTMLDialogElement > (null)

  // clo(detailsMessageObject, `DialogForProjectItems: starting, with details=`, 2)
  const thisItem = detailsMessageObject?.item
  if (!thisItem) { throw `Cannot find item` }
  const lastProgressText = (thisItem.project?.lastProgressComment) ? `last: ${thisItem.project?.lastProgressComment}` : ''
  const { ID, itemType, filename, title, modifierKey } = validateAndFlattenMessageObject(detailsMessageObject)

  const { sendActionToPlugin, pluginData } = useAppContext()
  const isDesktop = pluginData.platform === 'macOS'
  const monthsToShow = (pluginData.platform === 'iOS') ? 1 : 2

  // We want to open the calendar picker if the meta key was pressed as this was dialog was being triggered.
  const shouldStartCalendarOpen = modifierKey // = boolean for whether metaKey pressed
  // logDebug('DialogForTaskItems', `shouldStartCalendarOpen=${String(shouldStartCalendarOpen)}`)

  const reviewIntervalStr = (thisItem.project?.reviewInterval) ? `reviews: ${thisItem.project.reviewInterval}` : ''
  const reviewDaysStr = (thisItem.project?.nextReviewDays) ? `due ${relativeDateFromNumber(thisItem.project.nextReviewDays, true)}` : ''
  const reviewDetails = (reviewIntervalStr && reviewDaysStr)
    ? `(${reviewIntervalStr}; ${reviewDaysStr})`
    : (!reviewIntervalStr && !reviewDaysStr)
      ? ''
      : `(${reviewIntervalStr}${reviewDaysStr})`

  /**
   * Arrays of buttons to render.
   * Note: Some buttons need to be suppressed on iOS/iPadOS as the CommandBar is not available while the window is open. They get removed below.
   */
  let reviewButtons: Array<DialogButtonProps> = [
    { label: 'Finish Review', controlStr: 'finish', description: 'Update the @review(...) date on the project to today', handlingFunction: 'reviewFinished', icons: [{ className: 'fa-regular fa-calendar-check', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1w', controlStr: 'nr+1w', description: 'Add a @nextReview(...) date for 1 week to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 2w', controlStr: 'nr+2w', description: 'Add a @nextReview(...) date for 2 weeks to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1m', controlStr: 'nr+1m', description: 'Add a @nextReview(...) date for 1 month to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1q', controlStr: 'nr+1q', description: 'Add a @nextReview(...) date for 1 quarter to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
  ]

  let projectButtons: Array<DialogButtonProps> = [
    { label: 'Toggle Pause', controlStr: 'pause', 'description': 'Mark the project as paused', handlingFunction: 'togglePauseProject', icons: [{ className: 'fa-solid fa-circle-pause', position: 'left' }], notOnMobile: false },
    { label: 'Complete', controlStr: 'complete', description: 'Add @completed(...) date to project metadata and remove from review lists', handlingFunction: 'completeProject', icons: [{ className: 'fa-solid fa-circle-check', position: 'left' }], notOnMobile: false },
    { label: 'Cancel', controlStr: 'cancel', description: 'Add @cancelled(...) date to project metadata and remove from review lists', handlingFunction: 'cancelProject', icons: [{ className: 'fa-solid fa-circle-xmark', position: 'left' }], notOnMobile: false },
    // TODO(later): I wanted this icon to be fa-solid fa-arrows-left-right-to-line, but it wasn't available when we made the build of icons.
    { label: 'New Interval', controlStr: 'newint', description: 'Change the @review(...) interval for this project', handlingFunction: 'setNewReviewInterval', icons: [{ className: 'fa-solid fa-arrows-left-right', position: 'left' }], notOnMobile: true },
  ]

  let progressButtons: Array<DialogButtonProps> = [
    { label: 'Add', controlStr: 'progress', description: 'Add a progress comment to the project', handlingFunction: 'addProgress', icons: [{ className: 'fa-solid fa-comment-lines', position: 'left' }], notOnMobile: true },
  ]

  // Filter out buttons that are not available on mobile
  if (!isDesktop) {
    reviewButtons = reviewButtons.filter((button) => !button.notOnMobile)
    progressButtons = progressButtons.filter((button) => !button.notOnMobile)
    projectButtons = projectButtons.filter((button) => !button.notOnMobile)
  }

  useLayoutEffect(() => {
    // logDebug(`DialogForProjectItems`, `BEFORE POSITION detailsMessageObject`, detailsMessageObject)
    // $FlowIgnore[incompatible-call]
    if (dialogRef) positionDialog(dialogRef)
    // logDebug(`DialogForProjectItems`, `AFTER POSITION detailsMessageObject`, detailsMessageObject)
  }, [])

  function handleTitleClick(e:MouseEvent) { // MouseEvent will contain the shiftKey, ctrlKey, altKey, and metaKey properties 
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    detailsMessageObject.actionType = 'showLineInEditorFromFilename'
    detailsMessageObject.modifierKey = modifierName
    sendActionToPlugin(detailsMessageObject.actionType, detailsMessageObject, 'Project Title clicked in Dialog', true)
  }

  // Handle the shared closing functionality
  const closeDialog = (forceClose: boolean = false) => {
    // Start the zoom-out animation
    setAnimationClass('zoom-out')
    scheduleClose(300, forceClose)  // Match the duration of the animation
    // onClose(forceClose)
  }

  const scheduleClose = (delay: number, forceClose: boolean = false) => {
    setTimeout(() => onClose(forceClose), delay)
  }

  // Handle the date selected from CalendarPicker
  const handleDateSelect = (date: Date) => {
    if (!date) return
    const isoDateStr = hyphenatedDateString(date) // to avoid TZ issues
    const actionType = 'setNextReviewDate'

    logDebug(`DialogForProjectItems`, `Specific Date selected: ${String(date)} isoDateStr:${isoDateStr}. Will use actionType ${actionType}`)
    sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, controlStr: isoDateStr }, `${isoDateStr} selected in date picker`, true)

    // reset the calendar picker after some time or in the next render cycle so it forgets the last selected date
    setResetCalendar(true)
    setTimeout(() => setResetCalendar(false), 0) // Reset the calendar in the next render cycle
    closeDialog()
  }

  function handleButtonClick(_event: MouseEvent, controlStr: string, type: string) {
    clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    logDebug(`DialogForProjectItems handleButtonClick`,
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
    // setAnimationClass('zoom-out') //flip-out

    // Dismiss dialog
    // Wait for zoom animation animation to finish before actually closing
    setTimeout(() => {
      onClose(false)
    }, 300) // Match the duration of the animation
    // onClose(false)
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
      {/* CSS for this part is in DashboardDialog.css */}
      {/*----------- Dialog that can be shown for any project item -----------*/}
      <dialog
        id="projectControlDialog"
        className={`projectControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on projects"
        // $FlowIgnore[incompatible-type]
        ref={dialogRef}
      >
        {/* Title area ---------------- */}
        <div className="dialogTitle">
          <div className="projectIcon">
          <ProjectIcon
            item={thisItem}
            />
          </div>
          <TooltipOnKeyPress
            altKey={{ text: 'Open in Split View' }}
            metaKey={{ text: 'Open in Floating Window' }}
            label={`Task Item Dialog for ${title}`}
          >
            <span className="dialogFileParts pad-left pad-right" onClick={handleTitleClick} style={{ cursor: 'pointer' }}>            
              <span className="dialogItemNote" >{title}</span>
            </span>
            {reviewDetails}
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
            <div className="preText">Review:</div>
            <div>
              {reviewButtons.map((button, index) => (
                <button key={index}
                  className="PCButton"
                  title={button.description}
                  onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction ?? '')}>
                  {button.icons?.filter((icon) => icon.position === 'left').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-right`}></i>
                  ))}
                  {button.label}
                  {button.icons?.filter((icon) => icon.position === 'right').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-left`}></i>
                  ))}
                </button>
              ))}
              <CalendarPicker
                onSelectDate={handleDateSelect}
                positionFunction={() => positionDialog(dialogRef)}
                numberOfMonths={monthsToShow}
                resetDateToDefault={resetCalendar}
                startingSelectedDate={null}
                shouldStartOpen={shouldStartCalendarOpen} />
            </div>

            {/* line2: Project Actions ---------------- */}
            <div className="preText">Project:</div>
            <div>
              {projectButtons.map((button, index) => (
                <button key={index}
                  className="PCButton"
                  title={button.description}
                  onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction ?? '')}>
                  {button.icons?.filter((icon) => icon.position === 'left').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-right`}></i>
                  ))}
                  {button.label}
                  {button.icons?.filter((icon) => icon.position === 'right').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-left`}></i>
                  ))}
                </button>
              ))}
            </div>

            {/* line3: Progress ---------------- */}
            <div className="preText">Progress:</div>
            <div>
              {progressButtons.map((button, index) => (
                <button key={index}
                  className="PCButton"
                  title={button.description}
                  onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction ?? '')}>
                  {button.icons?.filter((icon) => icon.position === 'left').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-right`}></i>
                  ))}
                  {button.label}
                  {button.icons?.filter((icon) => icon.position === 'right').map((icon) => (
                    <i key={icon.className} className={`${icon.className} pad-left`}></i>
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
