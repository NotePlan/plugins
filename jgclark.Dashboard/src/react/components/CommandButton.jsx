// @flow
//--------------------------------------------------------------------------
// Buttons on the UI, including adding tasks and checklists to today's note
// Last updated 15.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { showDialog } from '@helpers/react/userInput'
import { logDebug, JSP, clo } from '@helpers/react/reactDev.js'
type ButtonProps = {
  button: TActionButton,
  onClick: (button: TActionButton) => void, // send this button info back up
  className: string,
  // param: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin } = useAppContext()
  const { button, onClick, className } = inputObj

  // logDebug(`CommandButton`,`setting up button: ${button.display}, button=${JSP(button,2)}`)

  // For adding icons to button display, tried this approach but decided it's not flexible enough:
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''
  // Instead will use dangerouslySetInnerHTML, so we can set anything.


  const sendButtonAction = (button: TActionButton, userInputObj: Object) => {
    sendActionToPlugin(button.actionPluginID, {
      actionType: button.actionName,
      toFilename: button.actionParam,
      sectionCodes: button.postActionRefresh,
      userInputObj: userInputObj,
    })
    onClick(button)
  }

  const handleButtonClick = async () => {
    let userInputObj:TAnyObject|null
    if (button.formFields) { // show dialog to get user input if formFields are defined
       userInputObj = await showDialog({ items: button.formFields, title: button.tooltip, submitOnEnter: button.submitOnEnter })
       userInputObj ? sendButtonAction(button, userInputObj) : null
    } else {
      sendButtonAction(button, null)
    }
  }

  return (
    <>
      {/* {' '} */}
      <button
        className={`${className} tooltip`}
        data-tooltip={button.tooltip}
        onClick={handleButtonClick}
        dangerouslySetInnerHTML={{ __html: button.display }}
      >
      </button>
    </>
  )
}

export default CommandButton
