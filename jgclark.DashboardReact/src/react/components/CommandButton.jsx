// @flow
// Buttons on the UI, including adding tasks and checklists to today's note
// Note: 

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import {logDebug,JSP} from '@helpers/react/reactDev.js'

type ButtonProps = {
  button: TActionButton,
  // param: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()
  const { button } = inputObj

  // logDebug(`CommandButton`,`setting up button: ${button.display}, button=${JSP(button,2)}`)

  // For adding icons to button display, tried this approach but decided it's not flexible enough:
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''
  // Instead will use dangerouslySetInnerHTML, so we can set anything.

  return (
    <>
      {' '}
      <button
        className="PCButton tooltip"
        data-tooltip={button.tooltip}
        // data-plugin-id={button.actionPluginID}
        // v1 onClick={() => sendActionToPlugin(button.actionFunctionName, button.actionFunctionParam, 'CommandButton', false)}
        // v2a onClick={() => sendMessageToPlugin('runPluginCommand', { pluginID: button.actionPluginID, commandName: button.actionFunctionName, commandArgs: button.actionFunctionParam })}
        onClick={() => sendActionToPlugin(button.actionPluginID, {actionType: button.actionFunctionName, toFilename:button.actionFunctionParam})}
        dangerouslySetInnerHTML={{ __html: button.display }}
      >
      </button>
    </>
  )
}

export default CommandButton
