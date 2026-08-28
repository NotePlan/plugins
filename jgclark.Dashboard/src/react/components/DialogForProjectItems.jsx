// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for Projects
// Called by Dialog component. Supports Interactive Processing for PROJACT / PROJREVIEW.
// Last updated 2026-08-28 for v2.5.0.b by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import React, { useRef, useLayoutEffect, useState, useCallback } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import { type MessageDataObject, type TSection, type TSectionCode } from '../../types'
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import { buildReactSettingsAfterIPAdvance, buildReactSettingsForIPBackNavigate, canNavigateBackInIP } from './interactiveProcessingHelpers.js'
import SmallCircularProgressIndicator from './SmallCircularProgressIndicator.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { hyphenatedDateString, relativeDateFromNumber } from '@helpers/dateTime'
import { clo, logDebug, logInfo, logWarn } from '@helpers/dev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

//----------------------------------------------------------------------

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: ?HTMLElement }) => void, // matches the React$RefObject<?HTMLElement> declared below (useRef can hold undefined)
}

type DialogButtonProps = {
  label: string,
  controlStr: string,
  handlingFunction?: string,
  description?: string,
  icons?: Array<{ className: string, position: 'left' | 'right' }>,
  notOnMobile: boolean, // If true, the button will only be shown on macOS, because of limitations on iOS/iPadOS
}

/** Actions that open the project note / editor and should not advance IP. */
const STAY_OPEN_HANDLING_FUNCTIONS = new Set(['startReview'])

/**
 * Project actions dialog used by Interactive Processing and by the row edit icon (non-IP).
 * @param {Props} props
 * @returns {?React$Node}
 */
const DialogForProjectItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Refs & state (before any early return - Rules of Hooks)
  //----------------------------------------------------------------------
  const dialogRef: React$RefObject<?HTMLElement> = useRef <? HTMLElement > (null)
  const [animationClass, setAnimationClass] = useState('')
  const [resetCalendar, setResetCalendar] = useState(false)

  const { sendActionToPlugin, pluginData, dashboardSettings, reactSettings, setReactSettings } = useAppContext()
  const { interactiveProcessing } = reactSettings ?? {}
  const { currentIPIndex, totalTasks } = interactiveProcessing || {}
  const { enableInteractiveProcessing, enableInteractiveProcessingTransitions } = dashboardSettings || {}
  // IP: animate only when IP transitions setting is on. Non-IP: keep prior project-dialog zoom when transitions not explicitly off.
  const showAnimations = interactiveProcessing
    ? Boolean(enableInteractiveProcessing && enableInteractiveProcessingTransitions)
    : enableInteractiveProcessingTransitions !== false

  const isDesktop = pluginData.platform === 'macOS'
  const monthsToShow = (pluginData.platform === 'iOS') ? 1 : 2

  const thisItem = detailsMessageObject?.item
  const sectionCode: TSectionCode | '' = thisItem?.sectionCode || detailsMessageObject?.sectionCodes?.[0] || ''
  const thisSection: ?TSection =
    sectionCode !== '' ? pluginData.sections?.find((section) => section.sectionCode === sectionCode) : undefined
  // PROJACT: true back-navigate; PROJREVIEW: forward skip only
  const showBackNavigate = sectionCode === 'PROJACT' && canNavigateBackInIP(currentIPIndex)

  useLayoutEffect(() => {
    if (dialogRef) positionDialog(dialogRef)
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
      logDebug('DialogForProjectItems', `handleIPItemProcessed skipped=${String(skippedItem)} skipForward=${String(skipForward)}`)
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
      logDebug(`DialogForProjectItems`, `closeDialog(forceClose=${String(forceClose)})`)
      if (reactSettings?.interactiveProcessing) {
        if (forceClose) {
          setReactSettings((prevSettings) => ({
            ...prevSettings,
            interactiveProcessing: null,
            dialogData: {
              ...prevSettings.dialogData,
              isOpen: false,
              isTask: false,
            },
          }))
        } else {
          handleIPItemProcessed(false)
        }
        return
      }
      // Non-IP: animate out then let Dialog/onClose clear dialogData
      if (showAnimations) {
        setAnimationClass('zoom-out')
      }
      setTimeout(() => onClose(forceClose), showAnimations ? 300 : 0)
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
    logDebug('DialogForProjectItems', 'handleBackNavigateClick')
    setReactSettings((prevSettings) => buildReactSettingsForIPBackNavigate(prevSettings))
  }, [reactSettings?.interactiveProcessing, setReactSettings])

  // Handle the date selected from CalendarPicker
  const handleDateSelect = useCallback(
    (date: Date) => {
      if (!date) return
      const isoDateStr = hyphenatedDateString(date) // to avoid TZ issues
      const actionType = 'setNextReviewDate'

      logDebug(`DialogForProjectItems`, `Specific Date selected: ${String(date)} isoDateStr:${isoDateStr}. Will use actionType ${actionType}`)
      sendActionToPlugin(actionType, { ...detailsMessageObject, actionType, controlStr: isoDateStr }, `${isoDateStr} selected in date picker`, true)

      // reset the calendar picker after some time or in the next render cycle so it forgets the last selected date
      setResetCalendar(true)
      setTimeout(() => setResetCalendar(false), 0)

      if (!reactSettings?.interactiveProcessing) {
        setAnimationClass('zoom-out')
      }
      setTimeout(() => closeDialog(false), reactSettings?.interactiveProcessing ? 0 : 300)
    },
    [closeDialog, detailsMessageObject, reactSettings?.interactiveProcessing, sendActionToPlugin],
  )

  const handleButtonClick = useCallback(
    (event: MouseEvent, controlStr: string, type: string) => {
      const { metaKey } = extractModifierKeys(event)
      clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
      logDebug(
        `DialogForProjectItems handleButtonClick`,
        `Button clicked for controlStr: ${controlStr}, type: ${type}`,
      )

      const dataToSend = {
        ...detailsMessageObject,
        actionType: type,
        controlStr: controlStr,
        updatedContent: '',
      }

      sendActionToPlugin(dataToSend.actionType, dataToSend, `Sending actionType ${type} and controlStr ${controlStr} to plugin`, true)

      // Start Review opens the note; stay open so IP can continue
      if (STAY_OPEN_HANDLING_FUNCTIONS.has(type)) {
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
    [closeDialog, detailsMessageObject, reactSettings?.interactiveProcessing, sendActionToPlugin],
  )

  //----------------------------------------------------------------------
  // Validate after hooks
  //----------------------------------------------------------------------

  let validated
  try {
    validated = validateAndFlattenMessageObject(detailsMessageObject)
  } catch (error) {
    logWarn('DialogForProjectItems', `No valid details to render (${error.message}); bailing.`)
    return null
  }
  const { ID, itemType, filename, title, modifierKey } = validated
  if (!thisItem) {
    logWarn('DialogForProjectItems', 'Cannot find item; bailing.')
    return null
  }
  logInfo('DialogForProjectItems', `Starting ID=${ID} itemType=${itemType} filename=${filename}`)

  const lastProgressText = thisItem.project?.lastProgressComment ?? ''
  // We want to open the calendar picker if the meta key was pressed as this dialog was being triggered.
  const shouldStartCalendarOpen = modifierKey // = boolean for whether metaKey pressed

  const reviewIntervalStr = (thisItem.project?.reviewInterval) ? `review ${thisItem.project.reviewInterval}` : ''
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
    { label: 'Start', controlStr: 'start', description: 'Open the project note in the Editor', handlingFunction: 'startReview', icons: [{ className: 'fa-solid fa-play', position: 'left' }], notOnMobile: false },
    { label: 'Finish Review', controlStr: 'finish', description: 'Update the @review(...) date on the project to today', handlingFunction: 'reviewFinished', icons: [{ className: 'fa-regular fa-calendar-check', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1w', controlStr: 'nr+1w', description: 'Add a @nextReview(...) date for 1 week to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 2w', controlStr: 'nr+2w', description: 'Add a @nextReview(...) date for 2 weeks to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1m', controlStr: 'nr+1m', description: 'Add a @nextReview(...) date for 1 month to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
    { label: 'Skip 1q', controlStr: 'nr+1q', description: 'Add a @nextReview(...) date for 1 quarter to the project metadata', handlingFunction: 'setNextReviewDate', icons: [{ className: 'fa-solid fa-forward', position: 'left' }], notOnMobile: false },
  ]

  let projectButtons: Array<DialogButtonProps> = [
    { label: 'Toggle Pause', controlStr: 'pause', description: 'Mark the project as paused', handlingFunction: 'togglePauseProject', icons: [{ className: 'fa-solid fa-circle-pause', position: 'left' }], notOnMobile: false },
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

  return (
    <>
      {/* CSS for this part is in DashboardDialog.css */}
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
          <div className="projectIcon">
            <SmallCircularProgressIndicator
            item={thisItem}
            />
          </div>

          <TooltipOnKeyPress
            altKey={{ text: 'Open in Split View' }}
            metaKey={{ text: 'Open in Floating Window' }}
            label={`Project Item Dialog for ${title}`}
          >
            <span className="dialogItemNote">
              {thisSection != null && (
                <ItemNoteLink
                  item={thisItem}
                  thisSection={thisSection}
                  alwaysShowNoteTitle={true}
                  suppressTeamspaceName={false}
                  normalSize={true}
                />
              )}
            </span>
            <span className="reviewDetailsText">{reviewDetails}</span>
          </TooltipOnKeyPress>

          <div className="dialog-top-right">
            {interactiveProcessing && currentIPIndex !== undefined && (
              <span className="interactive-processing-status">
                {showBackNavigate && (
                  <button className="skip-button" onClick={handleBackNavigateClick} title="Go back to previous project">
                    <i className="fa-solid fa-backward"></i>
                  </button>
                )}
                <span>{currentIPIndex + 1}</span>/<span>{totalTasks}</span>
                <button className="skip-button" onClick={() => handleSkipClick(true)} title="Skip this project">
                  <i className="fa-solid fa-forward"></i>
                </button>
              </span>
            )}
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
          </div>
        </div>

        {/* Body area ---------------- */}
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
                startingSelectedDate={new Date()}
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
            <div className="dialogProgressRow">
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
              {lastProgressText && (
                // div required for visual cohesion
                <div>
                  <span className="dialogLatestProgressLabel">Latest: </span>
                  <span className="dialogLatestProgressText">{lastProgressText}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForProjectItems
