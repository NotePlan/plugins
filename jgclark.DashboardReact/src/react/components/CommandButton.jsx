// @flow
// Buttons on the UI, including adding tasks and checklists to today's note
// Note: 

import React from 'react'
import type { TActionButton } from '../../types.js'
import { useAppContext } from './AppContext.jsx'

type ButtonProps = {
  button: TActionButton,
  // param: string,
}

function CommandButton(inputObj: ButtonProps): React$Node {
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()
  const { button } = inputObj

  console.log(`setting up CommandButton: ${button.display}`)

  // For adding icons to button display, tried this approach but decided it's not flexible enough:
  // const possIconBefore = (button.iconBefore !== '') ? <i className={`${button.iconBefore} padRight`}></i> : ''
  // const possIconAfter = (button.iconAfter !== '') ? <i className={`padLeft ${button.iconAfter}`}></i> : ''
  // Instead will use dangerouslySetInnerHTML, so we can set anything.

  // The onClick handler.
  // v1 DBW used the following:
  // onClick={() => sendActionToPlugin(button.actionFunctionName, button.actionFunctionParam, 'CommandButton', false)}
  // v2a JGC tried sendMessageToPlugin route, as used in v1.x. But it doesn't seem available in React context.
  // v2b JGC trying the underlying runPluginCommand route, as used in v1.x
  // It doesn't seem to be available in the React context, so I've copied it in for now.
  // Note: browser inspector reports that there are 4 click event handlers on each of its buttons:
  // - button.PCButton.tooltip -> noop
  // - 1x "div#root" -> anonymous function
  // - 2x "div#root" -> noop
  // This looks odd.

  /**
 * Note: copied in from earlier pluginToHTMLCommsBridge.js
 * Generic callback bridge from HTML to the plugin. We use this to generate the convenience function sendMessageToPlugin(args)
 * This command be used to run any plugin command, but it's better to use one single command: sendMessageToPlugin(args) for everything
 * FIXME(@dwertheimer): this is being called OK on button click, but nothing then happens in plugin
 * @param {string} commandName
 * @param {string} pluginID
 * @param {Array<any>} commandArgs? - optional parameters
 */
  const runPluginCommand = (commandName = '%%commandName%%', pluginID = '%%pluginID%%', commandArgs = []) => {
    const code = '(async function() { await DataStore.invokePluginCommandByName("%%commandName%%", "%%pluginID%%", %%commandArgs%%);})()'
      .replace('%%commandName%%', commandName)
      .replace('%%pluginID%%', pluginID)
      .replace('%%commandArgs%%', JSON.stringify(commandArgs))
    console.log(`runPluginCommand: Sending command "${commandName}" to NotePlan: "${pluginID}" with args: ${JSON.stringify(commandArgs)}`)
    if (window.webkit) {
      console.log(`runPluginCommand: Sending code: "${code}"`)
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: code,
        onHandle: '',
        id: '1',
      })
    } else {
      console.log(`runPluginCommand Simulating: window.runPluginCommand: ${commandName} called`)
    }
  }

  return (
    <>
      {' '}
      <button
        className="PCButton tooltip"
        data-tooltip={button.tooltip}
        // data-plugin-id={button.actionPluginID}
        // v1 onClick={() => sendActionToPlugin(button.actionFunctionName, button.actionFunctionParam, 'CommandButton', false)}
        // v2a onClick={() => sendMessageToPlugin('runPluginCommand', { pluginID: button.actionPluginID, commandName: button.actionFunctionName, commandArgs: button.actionFunctionParam })}
        onClick={() => runPluginCommand(button.actionPluginID, button.actionFunctionName, button.actionFunctionParam)}
        dangerouslySetInnerHTML={{ __html: button.display }}
      >
      </button>
    </>
  )
}

export default CommandButton
