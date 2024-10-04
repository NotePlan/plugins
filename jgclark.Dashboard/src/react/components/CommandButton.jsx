// @flow
//--------------------------------------------------------------------------
// Buttons on the UI, including adding tasks and checklists to today's note
// Last updated 15.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { logDebug, JSP } from '@helpers/react/reactDev.js'

type ButtonProps = {
  button: TActionButton,
  onClick: (button: TActionButton) => void, // send this button info back up
  // param: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin, setReactSettings } = useAppContext()
  const { button, onClick } = inputObj

  // logDebug(`CommandButton`,`setting up button: ${button.display}, button=${JSP(button,2)}`)

  // For adding icons to button display, tried this approach but decided it's not flexible enough:
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''
  // Instead will use dangerouslySetInnerHTML, so we can set anything.

  const closeDialog = () => {
    setReactSettings((prev) => ({ ...prev, dynamicDialog: { isOpen: false } }))
  }

  const openDialog = (button: TActionButton) => {

    setReactSettings((prev) => ({
      ...prev,
      dynamicDialog: {
        isOpen: true,
        title: button.tooltip,
        items: button.formFields,
        onSave: (userInputObj) => sendButtonAction(button,userInputObj),
        onCancel: ()=>closeDialog(),
        allowEmptySubmit: false,
        hideDependentItems: true,
        submitOnEnter: button.submitOnEnter ?? true,
      },
    }))
  }

  const sendButtonAction = (button: TActionButton, userInputObj: Object) => {
    sendActionToPlugin(button.actionPluginID, {
      actionType: button.actionName,
      toFilename: button.actionParam,
      sectionCodes: button.postActionRefresh,
      userInputObj: userInputObj,
    })
    closeDialog()
    onClick(button)
  }

  const handleButtonClick = () => {
    logDebug(`CommandButton`, `button clicked: ${button.display}`)
    button.formFields && openDialog(button)
    return
  }

  return (
    <>
      {' '}
      <button
        className="PCButton tooltip"
        data-tooltip={button.tooltip}
        onClick={handleButtonClick}
        dangerouslySetInnerHTML={{ __html: button.display }}
      >
      </button>
    </>
  )
}

export default CommandButton
