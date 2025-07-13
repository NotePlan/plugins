// @flow
//--------------------------------------------------------------------------
// Buttons on the UI, including adding tasks and checklists to today's note
// Last updated 2025-04-08 for 2.2.0.a12
//--------------------------------------------------------------------------

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { logDebug, JSP, clo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { showDialog } from '@helpers/react/userInput'

type ButtonProps = {
  button: TActionButton,
  onClick: (button: TActionButton) => void, // send this button info back up
  className: string,
  // param: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin } = useAppContext()
  const { button, onClick, className } = inputObj

  // Note: For adding icons to button display, tried this approach but decided it's not flexible enough:
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''
  // Instead will use dangerouslySetInnerHTML, so we can set anything.

  const sendButtonAction = (button: TActionButton, userInputObj: Object, modifierName?: string | null) => {
    sendActionToPlugin(button.actionPluginID, {
      actionType: button.actionName,
      toFilename: button.actionParam,
      sectionCodes: button.postActionRefresh,
      userInputObj: userInputObj,
      modifierKey: modifierName,
    })
    onClick(button)
  }

  const handleButtonClick = async (event: MouseEvent) => {
    const { modifierName } = extractModifierKeys(event)
    // logDebug('CommandButton', `🔸 handleButtonClick: ${button.tooltip}, modifierName=${modifierName ? modifierName : '-'}`)
    let userInputObj: TAnyObject | null
    if (button.formFields) {
      // show dialog to get user input if formFields are defined
      userInputObj = await showDialog({
        items: button.formFields,
        title: button.tooltip,
        submitOnEnter: button.submitOnEnter,
        submitButtonText: button.submitButtonText,
        // TODO: can this be removed or refactored?
        style: {
          top: '40%',
        },

      })
      userInputObj ? sendButtonAction(button, userInputObj, modifierName) : null
    } else {
      sendButtonAction(button, null, modifierName)
    }
  }

  return (
    <>
      {/* {' '} */}
      <button className={`${className} tooltip`} data-tooltip={button.tooltip} onClick={handleButtonClick} dangerouslySetInnerHTML={{ __html: button.display }}></button>
    </>
  )
}

export default CommandButton
