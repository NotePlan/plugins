// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Last updated 5.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React, { useRef, useEffect } from 'react'
import { useAppContext } from './AppContext.jsx'
import useRefreshTimer from './useRefreshTimer.jsx'
import { logDebug } from '@helpers/react/reactDev'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import EditableInput from '@helpers/react/EditableInput.jsx'

type RefType<T> = {| current: null | T |}

type Props = {
  onClose: () => void,
  details: any, //FIXME: @jgclark  define a type for this -- comes from detailsToPassToControlDialog
  positionDialog: (dialogRef: RefType<any>) => {},
}

const DialogForTaskItems = ({ details, onClose, positionDialog }: Props): React$Node => {
  logDebug(`DialogForTaskItems`, `inside component code details=`, details)

  const { refreshTimer } = useRefreshTimer({ maxDelay: 5000 })

  const { sendActionToPlugin } = useAppContext()
  const inputRef = useRef()
  const dialogRef = useRef(null)

  const reschedOrMove = details.reschedOrMove // sending as a string, as I couldn't get boolean to be passed correctly
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
      type: 'showNoteInEditorFromFilename',
      filename: details.para.filename,
    }
    sendActionToPlugin('onClickDashboardItem', dataObjectToPassToFunction, 'Item clicked', true)
  }

  function handleButtonClick(controlStr: string, type: string) {
    const { id, itemType, metaModifier, para, item } = details
    const filename = details.para.filename
    const currentContent = para.content
    const updatedContent = inputRef?.current?.getValue() || ''
    logDebug(`DialogForTaskItems handleButtonClick`, `Clicked ${controlStr}`)
    console.log(
      `Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, itemType: ${itemType}, Filename: ${filename}, metaModifier: ${metaModifier}`,
    )
    if (controlStr === 'update') {
      logDebug(`DialogForTaskItems`, `handleButtonClick - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
    }
    const dataToSend = {
      itemID: id,
      type: type,
      itemType: itemType,
      controlStr: controlStr,
      filename: filename,
      content: currentContent,
      updatedContent: updatedContent,
      item,
    }
    if (currentContent !== updatedContent) dataToSend.updatedContent = updatedContent

    sendActionToPlugin('onClickDashboardItem', dataToSend, `Sending ${type} to plugin`, false)
    if (controlStr === 'openNote') return //don't close dialog yet

    // Send 'refresh' action to plugin after n ms - this is a bit of a hack
    // to get around the updateCache not being reliable.
    // refreshTimer()
    logDebug(`DialogForTaskItems`, `handleButtonClick - !!! REFRESH TIMER TURNED OFF TEMPORARILY !!!`)

    // Dismiss dialog, unless meta key pressed
    if (!metaModifier) {
      onClose()
    } else {
      console.log(`Option key pressed. But closing dialog anyway.`)
      onClose()
    }
  }
  return (
    <>
      {/* CSS for this part is in dashboardDialog.css */}
      {/*----------- Single dialog that can be shown for any task-based item -----------*/}
      <dialog id="itemControlDialog" className="itemControlDialog" aria-labelledby="Actions Dialog" aria-describedby="Actions that can be taken on items" ref={dialogRef}>
        <div className="dialogTitle" onClick={() => handleTitleClick()}>
          From: <i className="pad-left pad-right fa-regular fa-file-lines"></i>
          <b>
            <span id="dialogItemNote">{details?.para?.title}</span>
            {details?.noteType === 'Calendar' ? <span className="dialogItemNoteType"> (Calendar Note)</span> : null}
          </b>
        </div>
        <div className="dialogBody">
          <div className="buttonGrid" id="itemDialogButtons">
            <div>For</div>
            <div className="dialogDescription">
              <EditableInput ref={inputRef} initialValue={details?.para?.content} className="fullTextInput dialogItemContent" />
              <button className="updateItemContentButton" data-control-str="update" onClick={() => handleButtonClick('updateItemContent', 'updateItemContent')}>
                Update
              </button>
            </div>
            <div>Move to</div>
            <div id="itemControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr} onClick={() => handleButtonClick(button.controlStr, dateChangeFunctionToUse)}>
                  {button.label}
                </button>
              ))}
            </div>
            <div>Other controls</div>
            <div id="itemControlDialogOtherControls">
              {otherControlButtons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr} onClick={() => handleButtonClick(button.controlStr, button.handlingFunction)}>
                  {button.icons?.map((icon) => (
                    <i key={icon.className} className={`${icon.className} ${icon.position === 'left' ? 'icon-left pad-left' : 'icon-right pad-right'}`}></i>
                  ))}
                  {button.label}
                </button>
              ))}
            </div>

            <div></div>
            <div>
              <form>
                <button id="closeButton" className="mainButton" onClick={onClose}>
                  Close
                </button>
              </form>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default DialogForTaskItems
