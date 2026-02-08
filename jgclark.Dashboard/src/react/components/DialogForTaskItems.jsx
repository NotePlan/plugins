// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Called by TaskItem component
// Last updated 2026-02-05 for v2.4.0.b20 by @jgclark
//--------------------------------------------------------------------------
// Notes:
// - onClose & detailsMessageObject are passed down from Dashboard.jsx::handleDialogClose
//
import React, { useRef, useLayoutEffect, useState } from 'react'
import { validateAndFlattenMessageObject } from '../../shared'
import type { MessageDataObject, TSectionCode } from '../../types'
import { useAppContext } from './AppContext.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logInfo, logWarn } from '@helpers/react/reactDev'
import EditableInput from '@helpers/react/EditableInput.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import '../css/animation.css'

//----------------------------------------------------------------------

type Props = {
  onClose: (xWasClicked: boolean) => void,
  details: MessageDataObject,
  positionDialog: (dialogRef: { current: HTMLDivElement | null }) => void,
}

type DialogButtonProps = {
  label: string,
  controlStr: string,
  handlingFunction?: string,
  description?: string,
  icons?: Array<{ className: string, position: 'left' | 'right' }>,
  sectionCodesToRefresh?: Array<TSectionCode>,
}

const DialogForTaskItems = ({ details: detailsMessageObject, onClose, positionDialog }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------

  const inputRef: React$RefObject<?HTMLInputElement> = useRef <? HTMLInputElement > (null)
  const dialogRef: React$RefObject<?HTMLDivElement> = useRef <? HTMLDivElement > (null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  const [animationClass, setAnimationClass] = useState('')
  const [resetCalendar, setResetCalendar] = useState(false) // used to reset the calendar during IP processing if the date picker is open
  const [contentHasChanged, setContentHasChanged] = useState(false) // used to track if the content has changed

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------

  // clo(detailsMessageObject, `DialogForTaskItems: starting, with details=`, 2)
  const { ID, item, itemType, para, filename, title, content, noteType, sectionCodes, modifierKey } = validateAndFlattenMessageObject(detailsMessageObject)
  logDebug('DialogForTaskItems', `ID=${String(ID)} / itemType=${String(itemType)} / filename=${String(filename)} / sectionCodes=${String(sectionCodes)} / para.content={${String(para?.content ?? 'n/a')}}`)
  if (!filename || filename === '') { logWarn('DialogForTaskItems', `filename is undefined or empty`) }

  // sectionCodes in this case will be just the sectionCode of the current item
  const thisSectionCode = sectionCodes[0] ?? ''
  if (!thisSectionCode) { logWarn('DialogForTaskItems', `thisSectionCode is undefined or empty`) }
  logDebug('DialogForTaskItems', `thisSectionCode=${String(thisSectionCode)}`)

  const { sendActionToPlugin, reactSettings, setReactSettings, dashboardSettings, pluginData } = useAppContext()
  const isDesktop = pluginData.platform === 'macOS'
  const monthsToShow = (pluginData.platform === 'iOS') ? 1 : 2

  const resched = dashboardSettings?.rescheduleNotMove || pluginData?.dashboardSettings.rescheduleNotMove || false
  // logDebug('DialogForTaskItems', `- rescheduleNotMove: dashboardSettings = ${String(dashboardSettings?.rescheduleNotMove)} / settings = ${String(pluginData?.dashboardSettings.rescheduleNotMove)}`)

  // We want to open the calendar picker if the meta key was pressed as this was dialog was being triggered.
  const shouldStartCalendarOpen = modifierKey // = boolean for whether metaKey pressed
  // logDebug('DialogForTaskItems', `shouldStartCalendarOpen=${String(shouldStartCalendarOpen)}`)

  // Deduce the action to take when this is a date-changed button:
  // - Item in calendar note & move to new calendar note for that picked date: use moveFromCalToCal()
  // - All 3 other cases: use rescheduleItem()
  const dateChangeFunctionToUse = noteType === 'Calendar' && !resched ? 'moveFromCalToCal' : 'rescheduleItem'
  // logDebug('DialogForTaskItems', `- dateChangeFunctionToUse = ${dateChangeFunctionToUse} from resched?:${String(resched)}`)

  const { interactiveProcessing } = reactSettings ?? {}
  const { currentIPIndex, totalTasks } = interactiveProcessing || {}
  const { enableInteractiveProcessing, enableInteractiveProcessingTransitions } = dashboardSettings || {}
  const showAnimations = interactiveProcessing && enableInteractiveProcessing && enableInteractiveProcessingTransitions

  // Set standard list of buttons to render.
  const buttons: Array<DialogButtonProps> = [
    { label: 'today', controlStr: 't', sectionCodesToRefresh: ['DT'] },
    { label: '+1d', controlStr: '+1d', sectionCodesToRefresh: ['DO'] },
    { label: '+1b', controlStr: '+1b', sectionCodesToRefresh: ['DO'] },
    { label: '+2d', controlStr: '+2d', sectionCodesToRefresh: [] },
    { label: 'this week', controlStr: '+0w', sectionCodesToRefresh: ['W'] },
    { label: '+1w', controlStr: '+1w', sectionCodesToRefresh: [] },
    { label: '+2w', controlStr: '+2w', sectionCodesToRefresh: [] },
    { label: 'this month', controlStr: '+0m', sectionCodesToRefresh: ['M'] },
    { label: '+1m', controlStr: '+1m', sectionCodesToRefresh: [] },
    { label: 'this quarter', controlStr: '+0q', sectionCodesToRefresh: ['Q'] },
  ]

  // Now tweak this list if buttons slightly if we're on a weekly or monthly note etc.
  if (sectionCodes) {
    if (sectionCodes.includes('DT')) {
      buttons.splice(0, 1) // remove the 'today' item, as its redundant
      buttons.splice(3, 0, { label: '+3d', controlStr: '+3d', sectionCodesToRefresh: [] }) // add another one instead
    }
    if (sectionCodes.includes('W')) {
      buttons.splice(4, 1) // remove the 'this week' item, as its redundant
    }
    if (sectionCodes.includes('M')) {
      buttons.splice(7, 1, { label: 'next month', controlStr: '+1m', sectionCodesToRefresh: [] }) // Replace the 'this month' item
    }
    if (sectionCodes.includes('Q')) {
      buttons.splice(8, 1, { label: 'next quarter', controlStr: '+1q', sectionCodesToRefresh: [] }) // Replace the 'this quarter' item
    }
  }

  // Note: Extra setup is required for certain buttons:
  // - Cancel button icon circle or square, and function
  // - Toggle Type icon circle or square
  const initialOtherControlButtons: Array<DialogButtonProps> = [
    {
      label: '',
      controlStr: 'completetask',
      description: 'Complete item',
      handlingFunction: itemType === 'checklist' ? 'completeChecklist' : 'completeTask',
      icons: [{ className: `fa-regular ${itemType === 'checklist' ? 'fa-square-check' : 'fa-circle-check'}`, position: 'left' }],
    },
    {
      label: 'then',
      controlStr: 'commpletethen',
      description: 'Mark the item as completed on the date it was scheduled for',
      handlingFunction: 'completeTaskThen',
      icons: [{ className: `fa-regular ${itemType === 'checklist' ? 'fa-square-check' : 'fa-circle-check'}`, position: 'left' }],
    },
    {
      label: '',
      controlStr: 'canceltask',
      description: 'Cancel item',
      handlingFunction: itemType === 'checklist' ? 'cancelChecklist' : 'cancelTask',
      icons: [{ className: `fa-regular ${itemType === 'checklist' ? 'fa-square-xmark' : 'fa-circle-xmark'}`, position: 'left' }],
    },
    {
      label: 'Move to',
      controlStr: 'movetonote',
      description: 'Move item to a different note',
      handlingFunction: 'moveToNote',
      icons: [{ className: 'fa-regular fa-file-lines', position: 'right' }],
    },
    {
      label: 'Priority',
      controlStr: 'priup',
      description: 'Increase priority of item',
      handlingFunction: 'cyclePriorityStateUp',
      icons: [{ className: 'fa-regular fa-arrow-up', position: 'right' }],
    },
    {
      label: 'Priority',
      controlStr: 'pridown',
      description: 'Decrease priority of item',
      handlingFunction: 'cyclePriorityStateDown',
      icons: [{ className: 'fa-regular fa-arrow-down', position: 'right' }],
    },
    {
      label: 'Change to',
      controlStr: 'tog',
      description: 'Toggle item type between task and checklist',
      handlingFunction: 'toggleType',
      icons: [{ className: itemType === 'checklist' ? 'fa-regular fa-circle' : 'fa-regular fa-square', position: 'right' }],
    },
    {
      label: 'Unsched',
      controlStr: 'unsched',
      description: 'Remove date from this item',
      handlingFunction: 'unscheduleItem',
    },
    {
      label: 'New Task',
      controlStr: 'qath',
      description: 'Add new task',
      handlingFunction: 'addTaskAnywhere',
      icons: [{ className: 'fa-regular fa-square-plus', position: 'left' }],
    },
  ]

  // Now filter out some that cannot be shown:
  // - on iOS/iPadOS those requiring the CommandBar; this is not available while the window is open
  const buttonsToHideOnMobile: Array<string> = ['Move to', 'New Task']
  let otherControlButtons: Array<DialogButtonProps> = initialOtherControlButtons.filter((button): boolean => (isDesktop ? true : !buttonsToHideOnMobile.includes(button.label)))
  // And 'unsched' button makes no sense on a calendar note
  if (noteType === 'Calendar') {
    otherControlButtons = otherControlButtons.filter((button): boolean => button.controlStr !== 'unsched')
  }

  // dbw note 2024-10-08: Trying to keep an eye out for an edge case where changing priority then skipping an item
  // might cause hasChild to be set to true, which seems to make no sense. no idea where it's coming from.
  // but might be the intermittent cache update issue returning children with the para when there are none
  para.hasChild ? clo(para, `DialogForTaskItems hasChild ${para.hasChild} para=`) : null

  //----------------------------------------------------------------------
  // Variables & Helpers
  //----------------------------------------------------------------------

  // get the next index in the visibleItems array to process (default going forward) or go backwards (goBackwards = true)
  const getNextIPIndex = (goBackwards: boolean = false) => {
    const { visibleItems, currentIPIndex } = reactSettings?.interactiveProcessing || {}
    if (!visibleItems || typeof currentIPIndex !== 'number') return -1

    const increment = goBackwards ? -1 : 1
    for (let i = currentIPIndex + increment; i >= 0 && i < visibleItems.length; i += increment) {
      if (!visibleItems[i].processed) {
        return i
      }
    }

    return -1
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useLayoutEffect(() => {
    // logDebug(`DialogForTaskItems`, `BEFORE POSITION dialogRef.current.style.topbounds=${String(dialogRef.current?.getBoundingClientRect().top) || ""}`)
    // $FlowIgnore[incompatible-call]
    positionDialog(dialogRef)
    // logDebug(`DialogForTaskItems`, `AFTER POSITION dialogRef.current.style.top=${String(dialogRef.current?.style.top || '') || ""}`)
  }, [])

  // Trigger the 'zoom-in/out' effects when the component mounts and unmounts
  useLayoutEffect(() => {
    if (showAnimations) {
      setAnimationClass('zoom-in')
    }

    // run before the component unmounts
    return () => {
      if (showAnimations) {
        setAnimationClass('zoom-out')
      }
    }
  }, [showAnimations])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  // handle a single item (and its children) being processed in interactive processing
  const handleIPItemProcessed = (skippedItem?: boolean = false, skipForward?: boolean = true) => {
    logDebug(`DialogForTaskItems`, `handleIPItemProcessed called with skippedItem=${String(skippedItem)}, skipForward=${String(skipForward)}`)
    // clo(reactSettings, `DialogForTaskItems: 🥸 handleIPItemProcessed calling handleIPItemProcessed; reactSettings=`)
    const { visibleItems, currentIPIndex } = reactSettings?.interactiveProcessing || {}
    if (!visibleItems) return
    if (typeof currentIPIndex !== 'number') return

    if (!skippedItem) visibleItems[currentIPIndex].processed = true
    logDebug('DialogForTaskItems', `handleIPItemProcessed currentIPIndex=${String(currentIPIndex)}`)
    // check if there are children to skip over
    if (!skippedItem && visibleItems[currentIPIndex].para?.hasChild) {
    // remove any children of the first item
      for (let i = currentIPIndex + 1; i < visibleItems.length; i++) {
        const item = visibleItems[i]
        logDebug('useInteractiveProcessing', `- checking for children of '${item?.para?.content ?? 'n/a'}'`)
        if (item?.para?.isAChild) {
          logDebug('useInteractiveProcessing', `  - found child '${item.para?.content}'`)
          visibleItems[i].processed = true
        } else {
          break // stop looking
        }
      }
    }
    const newIPIndex = getNextIPIndex(!skipForward)
    if (newIPIndex !== -1) {
      logDebug('DialogForTaskItems', `newIPIndex=${String(newIPIndex)}; visibleItems.length=${String(visibleItems.length)}; about to save to reactSettings`)
      setReactSettings((prevSettings) => ({
        ...prevSettings,
        interactiveProcessing: { ...prevSettings.interactiveProcessing, currentIPIndex: newIPIndex, visibleItems },
        dialogData: { ...prevSettings.dialogData, details: { ...prevSettings.dialogData.details, item: visibleItems[newIPIndex] } },
        lastChange: `_Dashboard-handleIPItemProcessed more IP items to process`,
      }))
    } else {
      logDebug('DialogForTaskItems', `newIPIndex=${String(newIPIndex)}>${visibleItems.length}; about to save to reactSettings`)
      setReactSettings((prevSettings) => ({
        ...prevSettings,
        interactiveProcessing: null,
        dialogData: { isOpen: false, isTask: true },
        lastChange: `_Dashboard-handleIPItemProcessed no more IP items to process`,
      }))
    }
  }

  // Handle the Enter key press (from the editable input box) to trigger the updateItemContent button click
  function handleEnterPress() {
    // $FlowIgnore[incompatible-call] can't manufacture a MouseEvent, but no details are actually needed, I think.
    handleButtonClick({}, 'updateItemContent', 'updateItemContent', [])
  }

  // Handle the content change (from the editable input box) to set a flag that the content has changed
  function handleContentChange(_updatedContent: string) {
    setContentHasChanged(true)
  }

  // Handle button clicks to trigger its handler, and generally close the dialog
  function handleButtonClick(event: MouseEvent, controlStr: string, handlingFunction: string, sectionCodesToRefresh: Array<TSectionCode>) {
    const { metaKey } = extractModifierKeys(event) // Indicates whether ⌘-key was pressed
    // clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    const currentContent = para.content
    logDebug(`DialogForTaskItems/handleButtonClick`, `- button clicked on ID: ${ID} for controlStr: ${controlStr}, handlingFunction: ${handlingFunction}, itemType: ${itemType}, filename: ${filename}, contentHasChanged: ${String(contentHasChanged)}`)

    // prepend the current sectionCode to the section codes to refresh
    const sectionCodesToSend = sectionCodesToRefresh
    if (thisSectionCode) { sectionCodesToSend.unshift(thisSectionCode) }
    logDebug('DialogForTaskItems/handleButtonClick', `sectionCodesToSend=${String(sectionCodesToSend)}`)

    if (contentHasChanged || controlStr === 'updateItemContent') {
      // $FlowIgnore[prop-missing] Cursor says its getValue() not itemValue(). This change works.
      const updatedContent = inputRef?.current?.getValue() || ''
      logDebug(`DialogForTaskItems/handleButtonClick`, ` - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
      const dataToSend = {
        ...detailsMessageObject,
        actionType: 'updateItemContent',
        controlStr: 'updateItemContent',
        updatedContent: currentContent !== updatedContent ? updatedContent : '',
        sectionCodes: sectionCodesToSend,
      }
      sendActionToPlugin('updateItemContent', dataToSend, `Dialog requesting call to updateItemContent`, true)
      setContentHasChanged(false)
    }
    else {
      // Handle all other buttons
      const dataToSend = {
        ...detailsMessageObject,
        actionType: handlingFunction,
        controlStr: controlStr,
        updatedContent: '',
        sectionCodes: sectionCodesToSend,
      }

      sendActionToPlugin(handlingFunction, dataToSend, `Dialog requesting call to ${handlingFunction}`, true)
    }

    // Don't close dialog yet if openNote button or one of the priority buttons clicked
    if (controlStr === 'openNote' || controlStr.startsWith('pri')) {
      return
    }

    // Otherwise, start the zoom/flip-out animation
    if (!reactSettings?.interactiveProcessing) {
      setAnimationClass('zoom-out') // flip-out
    }
    // Dismiss dialog, unless meta key pressed
    if (!metaKey) {
      // Wait for zoom animation animation to finish before actually closing
      setTimeout(() => {
        closeDialog(false)
      }, 300) // Match the duration of the animation
    } else {
      logDebug('DialogForTaskItems', `Meta key pressed. Closing without animation.`)
      closeDialog(false)
    }
  }

  const itemsHaveBeenSkipped = () => {
    let result = false
    const { visibleItems, currentIPIndex } = reactSettings?.interactiveProcessing || {}
    if (visibleItems && typeof currentIPIndex === 'number') {
      result = Boolean(visibleItems.find((item, i) => i < currentIPIndex && item.processed === false))
    }
    return result
  }


  // Handle the close -- start an animation and then schedule the actual close at the end of the animation
  // will eventually call onClose() from Dialog.jsx (does nothing special)
  // and will pass it on to Dashboard::handleDialogClose which (may) refresh the page
  const closeDialog = (forceClose: boolean = false) => {
    logDebug(`DialogForTaskItems closeDialog(${String(forceClose)}) reactSettings; looking for interactiveProcessing`)
    if (reactSettings?.interactiveProcessing) {
      if (forceClose) {
        setReactSettings((prevSettings) => ({
          ...prevSettings,
          interactiveProcessing: null,
          dialogData: { isOpen: false, isTask: true },
        }))
      } else {
        handleIPItemProcessed(false)
        return
      }
    }
    // logDebug('DialogForTaskItems closeDialog() calling setAnimationClass')
    if (showAnimations) {
      setAnimationClass('zoom-out')
    }
    scheduleClose(showAnimations ? 300 : 0, forceClose) // Match the duration of the animation
  }

  const scheduleClose = (delay: number, forceClose: boolean = false) => {
    logDebug(`DialogForTaskItems`, `scheduleClose() ${String(delay)}ms delay, forceClose=${String(forceClose)}`)
    setTimeout(() => {
      logDebug('DialogForTaskItems', `scheduleClose() after timeout reactSettings; looking for interactiveProcessing`)
      setReactSettings((prevSettings) => ({
        ...prevSettings,
        dialogData: { isOpen: false, isTask: true },
      }))
      onClose(forceClose)
    }, delay)
  }

  // during overduecycle, user wants to skip this item (leave it overdue)
  const handleSkipClick = (skipForward: boolean) => {
    // closeDialog()
    logDebug('DialogForTaskItems', `handleSkipClick calling handleIPItemProcessed`)
    if (reactSettings?.interactiveProcessing) {
      const { visibleItems, currentIPIndex } = reactSettings?.interactiveProcessing
      if (visibleItems && typeof currentIPIndex === 'number') {
        visibleItems[currentIPIndex].processed = false
        if (visibleItems[currentIPIndex].para !== para) {
          // clo(para, 'handleSkipClick para had changed and is being updated to')
          visibleItems[currentIPIndex].para = para // update content in case it has changed but not submitted (e.g. priority change)
        }
        const interactiveProcessingToSave = { ...reactSettings.interactiveProcessing, visibleItems }
        setReactSettings((prevSettings) => ({
          ...prevSettings,
          interactiveProcessing: interactiveProcessingToSave,
        }))
      }
    }
    reactSettings?.interactiveProcessing ? handleIPItemProcessed(true, skipForward) : null
  }

  // Handle the date selected from CalendarPicker
  const handleDateSelect = (date: Date) => {
    if (!date) return
    // turn into 8601 format
    // const isoDateStr = date.toISOString().split('T')[0]
    const isoDateStr = hyphenatedDateString(date) // to avoid TZ issues
    sendActionToPlugin(
      dateChangeFunctionToUse,
      { ...detailsMessageObject, actionType: dateChangeFunctionToUse, controlStr: isoDateStr },
      `${isoDateStr} selected in date picker`,
      true,
    )
    // reset the calendar picker after some time or in the next render cycle so it forgets the last selected date
    setResetCalendar(true)
    setTimeout(() => setResetCalendar(false), 0)
    closeDialog()
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  return (
    <>
      {/* CSS for this part is in DashboardDialog.css */}
      {/*----------- Dialog that can be shown for any task-based item -----------*/}
      <dialog
        className={`itemControlDialog ${animationClass}`}
        aria-labelledby="Actions Dialog"
        aria-describedby="Actions that can be taken on items"
        // $FlowIgnore[incompatible-type]
        ref={dialogRef}
      >
        <div className="dialogTitle">
          <div className="preText">From:</div>
          <TooltipOnKeyPress
            altKey={{ text: 'Open in Split View' }}
            metaKey={{ text: 'Open in Floating Window' }}
            label={`Task Item Dialog for ${title}`}
          >
            <div className="dialogItemNote">
              <ItemNoteLink
                item={item}
                thisSection={sectionCodes}
                alwaysShowNoteTitle={true}
                suppressTeamspaceName={false}
              />
            </div>
          </TooltipOnKeyPress>
          <div className="dialog-top-right">
            {interactiveProcessing && currentIPIndex !== undefined && (
              <>
                <span className="interactive-processing-status">
                  {itemsHaveBeenSkipped() && (
                    <button className="skip-button" onClick={() => handleSkipClick(false)} title="Skip this item">
                      <i className="fa-solid fa-backward"></i>
                    </button>
                  )}
                  {/* <i className="fa-solid fa-arrows-rotate" style={{ opacity: 0.7 }}></i> */}
                  {/* <span className="fa-layers-text" data-fa-transform="shrink-8" style={{ fontWeight: 500, paddingLeft: "3px" }}> */}
                  <span>{currentIPIndex + 1}</span>/{/* <span className="fa-layers-text" data-fa-transform="shrink-8" style={{ fontWeight: 500, paddingLeft: "3px" }}> */}
                  <span>{totalTasks}</span>
                  <button className="skip-button" onClick={() => handleSkipClick(true)} title="Skip this item">
                    <i className="fa-solid fa-forward"></i>
                  </button>
                </span>
              </>
            )}
            <button className="closeButton" onClick={() => closeDialog(true)}>
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
          </div>
        </div>

        <div className="dialogBody">
          <div className="buttonGrid taskButtonGrid">

            {/* Item content line ---------------- */}
            <div className="preText">For:</div>
            <div id="taskControlLine1" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {/* Note: 'autofocusMe' attribute does not work */}
              <EditableInput
                // $FlowIgnore - Flow doesn't like the ref
                ref={inputRef}
                initialValue={content}
                className="fullTextInput dialogItemContent"
                useTextArea={pluginData.platform === 'iOS'}
                onEnterPress={handleEnterPress}
                onChange={handleContentChange}
                autofocusMe={true}
              />
              <button
                className="updateItemContentButton PCButton"
                title={'Update the content of this item'}
                onClick={(e) => handleButtonClick(e, 'updateItemContent', 'updateItemContent', [])}
              >
                Update
              </button>
            </div>

            {/* Child indicator line */}
            {para.hasChild ? (
              <>
                <div></div>
                <div className="childDetails">(Has children)</div>
              </>
            ) : null}

            {/* Move controls line ---------------- */}
            <div className="preText">{resched ? 'Reschedule to' : 'Move to'}:</div>
            <div id="itemControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" title={button.description ?? ''} onClick={(e) => handleButtonClick(e, button.controlStr, dateChangeFunctionToUse, button.sectionCodesToRefresh ?? [])}>
                  {button.label}
                </button>
              ))}
              <CalendarPicker
                onSelectDate={handleDateSelect}
                positionFunction={() => positionDialog(dialogRef)}
                numberOfMonths={monthsToShow}
                resetDateToDefault={resetCalendar}
                startingSelectedDate={new Date()}
                shouldStartOpen={shouldStartCalendarOpen}
              />
              {/* TODO: when this does work, it needs copying to DialogForProjectItems as well */}
            </div>

            {/* Other actions line ---------------- */}
            <div className="preText">Other actions:</div>
            <div>
              {otherControlButtons.map((button, index) => (
                <button key={index} className="PCButton" title={button.description ?? ''} onClick={(e) => handleButtonClick(e, button.controlStr, button.handlingFunction ?? '', button.sectionCodesToRefresh ?? [])}>
                  {button.icons
                    ?.filter((icon) => icon.position === 'left')
                    .map((icon) => (
                      <i key={icon.className} className={`${icon.className} ${button.label !== '' ? 'pad-right' : ''}`}></i>
                    ))}
                  {button.label}
                  {button.icons
                    ?.filter((icon) => icon.position === 'right')
                    .map((icon) => (
                      <i key={icon.className} className={`${icon.className} ${button.label !== '' ? 'pad-left' : ''}`}></i>
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
