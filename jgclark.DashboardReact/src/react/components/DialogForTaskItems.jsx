// @flow
import React from 'react'
import Button from './Button.jsx'

type Props = {
  isOpen: boolean,
  onClose: () => void,
  details: any,
}

const DialogForTaskItems = ({ isOpen, onClose, details }: Props): React$Node => {
  if (!isOpen) return null

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
    { label: 'Cancel', controlStr: 'cancel' },
    { label: 'Move to', controlStr: 'movetonote', icons: [{ className: 'fa-regular fa-file-lines', position: 'right' }] },
    { label: 'Priority', controlStr: 'priup', icons: [{ className: 'fa-regular fa-arrow-up', position: 'left' }] },
    { label: 'Priority', controlStr: 'pridown', icons: [{ className: 'fa-regular fa-arrow-down', position: 'left' }] },
    { label: 'Toggle Type', controlStr: 'tog' },
    { label: 'Complete Then', controlStr: 'ct' },
    { label: 'Unschedule', controlStr: 'unsched' },
  ]

  return (
    <>
      {/* CSS for this part is in dashboardDialog.css */}
      {/*----------- Single dialog that can be shown for any task-based item -----------*/}
      <dialog id="itemControlDialog" className="itemControlDialog" aria-labelledby="Actions Dialog" aria-describedby="Actions that can be taken on items">
        <div className="dialogTitle">
          From <i className="pad-left pad-right fa-regular fa-file-lines"></i>
          <b>
            <span id="dialogItemNote">?</span>
          </b>
        </div>
        <div className="dialogBody">
          <div className="buttonGrid" id="itemDialogButtons">
            <div>For</div>
            <div className="dialogDescription">
              <input type="text" id="dialogItemContent" className="fullTextInput" />
              <button className="updateItemContentButton" data-control-str="update">
                Update
              </button>
            </div>
            <div>Move to</div>
            <div id="itemControlDialogMoveControls">
              {buttons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr}>
                  {button.label}
                </button>
              ))}
            </div>
            <div>Other controls</div>
            <div id="itemControlDialogOtherControls">
              {otherControlButtons.map((button, index) => (
                <button key={index} className="PCButton" data-control-str={button.controlStr}>
                  {button.icons?.map((icon) => (
                    <i key={icon.className} className={`${icon.className} ${icon.position === 'left' ? 'icon-left' : 'icon-right'}`}></i>
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
      <Button text="Close" clickHandler={onClose} />
    </>
  )
}

export default DialogForTaskItems
