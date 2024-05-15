// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Dialog for tasks
// Last updated 5.5.2024 for v2.0.0 by @jgclark
// TODO: update to use same style as other Dialog Component
//--------------------------------------------------------------------------
import React from 'react'

type RefType<T> = {| current: null | T |}

type Props = {
  onClose: () => void,
  details: any,
  positionDialog: (dialogRef: RefType<any>) => {},
}

/**
 * Array of buttons to render.
 */
const controlButtons = [
  // TODO: write and then use below
  // { label: 'Cancel', controlStr: 'canceltask', handlingFunction: 'cancelTask' },
  // { label: 'Move to', controlStr: 'movetonote', handlingFunction: 'moveToNote', icons: [{ className: 'fa-regular fa-file-lines', position: 'right' }] },
]

const DialogForProjectItems = ({ onClose, details, positionDialog }: Props): React$Node => {
  return (
    <>
      {/*----------- Single dialog that can be shown for any project item -----------*/}
      <dialog id="projectControlDialog" className="projectControlDialog" aria-labelledby="Actions Dialog" aria-describedby="Actions that can be taken on projects">
        <div className="dialogTitle">
          For <i className="pad-left pad-right fa-regular fa-file-lines"></i>
          <b>
            <span id="dialogProjectNote">?</span>
          </b>
        </div>
        <div className="dialogBody">
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
        </div>
      </dialog>
    </>
  )
}

export default DialogForProjectItems
