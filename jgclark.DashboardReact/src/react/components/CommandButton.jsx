// Buttons for adding tasks and checklists to today's note
// @flow

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'

type ButtonProps = {
  button: TActionButton,
  filename: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()
  const { button, filename } = inputObj

  console.log('CommandButton: ' + button.display)

  // Tried this approach but decided it's not flexible enough
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''

  return (
    <>
      <button
        className="PCButton tooltip"
        data-tooltip={button.tooltip}
        data-plugin-id={button.actionPluginID}
        // data-command={button.actionFunctionName}
        // data-command-args={filename}
        onClick={() => sendActionToPlugin(button.actionFunctionName, button.actionFunctionParam)}
        dangerouslySetInnerHTML={{ __html: button.display }}
      >
        {/* {possIconBefore}{button.display}{possIconAfter} */}
      </button>
      {' '}
    </>
  )
}

export default CommandButton
