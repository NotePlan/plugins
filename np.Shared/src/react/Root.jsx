/****************************************************************************************************************************
 *                             ROOT COMPONENT
 ****************************************************************************************************************************/
// @flow
/****************************************************************************************************************************
 *                             NOTES
 * This is the root component of the React app - should not be edited
 * It is the parent of all other components on the page
 * dbw: Think about lightweight datastore https://blog.openreplay.com/lightweight-alternatives-to-redux/

// globalSharedData is passed to window load time from the plugin, so you can use it for initial state
*/

/****************************************************************************************************************************
 *                             GLOBAL VARS/FUNCTIONS
 ****************************************************************************************************************************/

declare var globalSharedData: { [string]: any }
declare var WebView: any // No props specified, use an empty object or specific props type
declare function runPluginCommand(command: string, id: string, args: Array<any>): void
declare function sendMessageToPlugin(Array<string | any>): void

// type TWarning = {
//   warn: boolean,
//   msg?: string,
//   color?: string,
//   border?: string,
// }
/****************************************************************************************************************************
 *                             TYPES
 ****************************************************************************************************************************/


/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import React, { useState, useEffect, Profiler, type Node, useRef } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

// import { WebView } from './_Cmp-WebView.jsx' // we are assuming it's externally loaded by HTML
import { MessageBanner } from './MessageBanner.jsx'
import { ErrorFallback } from './ErrorFallback.jsx'
import DynamicDialog /*, { type TDynamicDialogProps } */ from './DynamicDialog'
import { logDebug, formatReactError, JSP, clo, logError } from '@helpers/react/reactDev'

const ROOT_DEBUG = false

// used by the ErrorBoundary component to write out the error to the log
const myErrorLogger = (e: Error, i: { componentStack: string }) => {
  const error = formatReactError(e, i.componentStack)
  console.log(`${window.webkit ? '' : '%c'}React error trapped by Root::ErrorBoundary; error=${JSP(error, 2)}`, 'background: #ff0000; color: #ffffff')
}

/****************************************************************************************************************************
 *                             globalSharedData
 ****************************************************************************************************************************/
// this is the global data object that is passed from the plugin in JS
// the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
// globalSharedData = { data: {}, returnPluginCommand: {command: "", id: ""}
const { lastUpdated = null, /* returnPluginCommand = {},*/ debug = false, /*ENV_MODE,*/ logProfilingMessage = false } = globalSharedData
if (typeof globalSharedData === 'undefined' || !globalSharedData) logDebug('Root: Root: globalSharedData is undefined', globalSharedData)
if (typeof globalSharedData === 'undefined') throw (`Root: globalSharedData is undefined. You must define this field in the initial data passed to the plugin`, globalSharedData)
if (typeof globalSharedData.lastUpdated === 'undefined') throw `Root: globalSharedData.lastUpdated is undefined`

export function Root(/* props: Props */): Node {
  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  const [npData, setNPData] = useState(globalSharedData) // set it from initial data
  const [dialogIsVisible, setDialogIsVisible] = useState(false)
  const [reactSettings, setReactSettings] = useState({ dynamicDialog: { isOpen: dialogIsVisible || false } })

  const [warning, setWarning] = useState({ warn: false, msg: '', color: 'w3-pale-red', border: 'w3-border-red' })
  // const [setMessageFromPlugin] = useState({})
  const [history, setHistory] = useState([lastUpdated])

  // $FlowFixMe
  const tempSavedClicksRef = useRef < Array < TAnyObject >> ([]) // temporarily store the clicks in the webview

  // NP does not destroy windows on close. So if we have an autorefresh sending requests to NP, it will run forever
  // So we do a check in sendToHTMLWindow to see if the window is still open
  if (npData?.NPWindowID === false) {
    throw new Error('Root: npData.NPWindowID is false; The window must have been closed. Stopping the React app. This is not a problem you need to worry about.')
  }

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/
  const MemoizedWebView = WebView // React.memo(WebView)
  // const Profiler = React.Profiler
  debug &&
    logDebug(
      `Root`,
      ` Running in Debug mode. Note: <React.StrictMode> is enabled which will run effects twice each time they are rendered. This is to help find bugs in your code.`,
    )

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /**
   * For debugging purposes only, when debug:true is passed in the initial data, this will log all clicks
   * So you can see in the log what was clicked before other log output shows up
   * Saves to the history state so you can see it in the UI
   * @param {Event} e
   */
  const onClickCapture = (e: any) => {
    if (!debug) return
    logDebug(`Root`, ` User ${e.type}-ed on "${e.target.outerText}" (${e.target.tagName}.${e.target.className})`)
    // Note: cannot setHistory because the page will refresh and any open dropdown will close, so let's just temp store it until we can write it
    tempSavedClicksRef.current.push({ date: new Date().toLocaleDateString(), msg: `UI_CLICK ${e.type} ${e.target.outerText}` })
  }

  /**
   * Dispatcher for child components to update the master data object or show a banner message.
   * @param {'SET_TITLE'|'[SET|UPDATE]_DATA'|'SHOW_BANNER'} action - The action type to dispatch.
   * @param {any} data - The data associated with the action.
   * @param {string} [actionDescriptionForLog] - Optional description of the action for logging purposes.
   */
  // eslint-disable-next-line no-unused-vars
  const dispatch = (action: string, data: any, actionDescriptionForLog?: string): void => {
    const desc = `${action}${actionDescriptionForLog ? `: ${actionDescriptionForLog}` : ''}`
    // data.lastUpdated = { msg: desc, date: new Date().toLocaleString() }
    const event = new MessageEvent('message', { data: { type: action, payload: data } })
    onMessageReceived(event)
    // onMessageReceived({ data: { type: action, payload: data } }) // dispatch the message to the reducer
  }

  /**
   * Ignore messages that have nothing to do with the plugin
   * @param {Event} event
   * @returns {boolean}
   */
  const shouldIgnoreMessage = (event: MessageEvent): boolean => {
    const { /* origin, source, */ data } = event
    // logDebug(
    //   `Root: shouldIgnoreMessage origin=${origin} source=${source} data=${JSON.stringify(data)} data.source=${
    //     data?.source
    //   } /react-devtools/.test(data?.source=${/react-devtools/.test(data?.source)}}`,
    // )
    return (
      (typeof data === 'string' && data?.startsWith('setImmediate$')) ||
      (typeof data === 'object' && data?.hasOwnProperty('iframeSrc')) ||
      (typeof data === 'object' && typeof data?.source === 'string' && /react-devtools/.test(data?.source))
    )
  }

  /**
   * Replaces a stylesheet's content with a new stylesheet string.
   * @param {string} oldName - The name or href of the stylesheet to be replaced.
   * @param {string} newStyles - The new stylesheet string.
   */
  function replaceStylesheetContent(oldName: string, newStyles: string) {
    // Convert the styleSheets collection to an array
    const styleSheetsArray = Array.from(document.styleSheets)

    // TODO: trying to replace a stylesheet that was loaded as part of the HTML page
    // yields error: "This CSSStyleSheet object was not constructed by JavaScript"
    // So unless we change the way this works to install the initial stylesheet in the HTML page,
    // this approach won't work, so for now, we are going to add it as another stylesheet
    // Find the stylesheet with the specified name or href
    const oldSheet = styleSheetsArray.find((sheet) => sheet && sheet.title === oldName)
    let wasSaved = false
    // $FlowIgnore
    if (oldSheet && typeof oldSheet.replaceSync === 'function') {
      // Use replaceSync to replace the stylesheet's content
      logDebug(`Root`, `replaceStylesheetContent: found existing stylesheet "${oldName}" Will try to replace it.`)
      try {
        // $FlowIgnore
        oldSheet.replaceSync(newStyles)
        wasSaved = true
      } catch (error) {
        logError(`Root`, `Swapping "${oldName}" CSS Failed. replaceStylesheetContent: Error ${JSP(formatReactError(error))}`)
      }
    }
    if (!wasSaved) {
      // If the old stylesheet is not found, create a new one
      const newStyle = document.createElement('style')
      newStyle.title = oldName
      newStyle.textContent = newStyles
      document?.head?.appendChild(newStyle)
      // Check to make sure it's there
      testOutputStylesheets()
      const styleElement = document.querySelector(`style[title="${oldName}"]`)
      if (styleElement) {
        logDebug('CHANGE_THEME replaceStylesheetContent: VERIFIED: CSS has been successfully added to the document')
      } else {
        logDebug("CHANGE_THEME replaceStylesheetContent: CSS has apparently NOT been added. Can't find it in the document")
      }
    }
  }

  // Function to get the first 55 characters of each stylesheet's content
  function testOutputStylesheets() {
    const styleSheets = document.styleSheets
    for (let i = 0; i < styleSheets.length; i++) {
      const styleSheet = styleSheets[i]
      try {
        // $FlowIgnore
        const rules = styleSheet.cssRules || styleSheet.rules
        let cssText = ''
        // $FlowIgnore
        for (let j = 0; j < rules.length; j++) {
          // $FlowIgnore
          cssText += rules[j].cssText
          if (cssText.length >= 55) break
        }
        logDebug(`CHANGE_THEME StyleSheet ${i}: "${styleSheet.title ?? ''}": ${cssText.substring(0, 55).replace(/\n/g, '')}`)
      } catch (e) {
        console.warn(`Unable to access stylesheet: ${styleSheet.href}`, e)
      }
    }
  }

  /**
   * This is effectively a reducer we will use to process messages from the plugin
   * And also from components down the tree, using the dispatch command
   */
  const onMessageReceived = (event: MessageEvent) => {
    const { data } = event
    // console.log(`Root: onMessageReceived ${event.type} data: ${JSON.stringify(data, null, 2)}`)
    if (!shouldIgnoreMessage(event) && data) {
      // const str = JSON.stringify(event, null, 4)
      try {
        // $FlowFixMe
        const { type, payload } = event.data // remember: event is on prototype and not JSON.stringify-able
        if (!type) throw (`onMessageReceived: event.data.type is undefined`, event.data)
        if (!payload) throw (`onMessageReceived: event.data.payload is undefined`, event.data)
        if (type && payload) {
          // logDebug(`Root`, ` onMessageReceived: ${type}`)
          // logDebug(`Root`, ` onMessageReceived: payload:${JSON.stringify(payload, null, 2)}`)
          if (!payload.lastUpdated) payload.lastUpdated = { msg: '(no msg)' }
          // Spread existing state into new object to keep it immutable
          // TODO: ideally, you would use a reducer here
          if (type === 'SHOW_BANNER') {
            if (payload.lastUpdated?.msg) {
              payload.lastUpdated.msg += `: ${payload.msg}`
            } else {
              logDebug(
                `Root`,
                ` onMessageReceived: payload.lastUpdated.msg is undefined: payload.lastUpdated:${payload.lastUpdated} payload.lastUpdated.msg:${payload.lastUpdated.msg}`,
              )
            }
          }
          setHistory((prevData) => [...prevData, ...tempSavedClicksRef.current, payload.lastUpdated])
          tempSavedClicksRef.current = []
          switch (type) {
            case 'SET_TITLE':
              // Note this works because we are using payload.title in npData
              document.title = payload.title
              break
            case 'SET_DATA':
            case 'UPDATE_DATA':
              setNPData((prevData) => ({ ...prevData, ...payload }))
              globalSharedData = { ...globalSharedData, ...payload }
              break
            case 'CHANGE_THEME': {
              const { themeCSS } = payload
              logDebug(`Root`, `CHANGE_THEME changing theme to "${themeCSS.substring(0, 55)}"...`)
              replaceStylesheetContent('Updated Theme Styles', themeCSS)
              break
            }
            case 'SHOW_BANNER':
                logDebug(`Root`, ` onMessageReceived: Showing banner, so we need to scroll the page up to the top so user sees it.`)
                setNPData((prevData) => {
                  prevData.passThroughVars = prevData.passThroughVars ?? {}
                  prevData.passThroughVars.lastWindowScrollTop = 0
                return { ...prevData, ...payload }
              })
          showBanner(payload.msg, payload.color, payload.border)
          break
            case 'SEND_TO_PLUGIN':
  sendToPlugin(payload)
  break
            case 'RETURN_VALUE' /* function called returned a value */:
  // $FlowIgnore
  // setMessageFromPlugin(payload)
  break
            default:
  break
}
        } else {
  logDebug(`Root`, ` onMessageReceived: called but event.data.type and/or event.data.payload is undefined`, event)
}
      } catch (error) {
  logDebug(`Root`, ` onMessageReceived: error=${JSP(formatReactError(error))}`)
}
    } else {
  // logDebug(`Root`,` onMessageReceived: called but event.data is undefined: noop`)
}
  }

/**
 * Send data back to the plugin to update the data in the plugin
 * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
 * (for example, scroll position)
 * This function should not be called directly by child components, but rather via the sendActionToPlugin()
 * returnPluginCommand var with {command && id} should be sent in the initial data payload in HTML
 * @param {Array<any>} args to send to NotePlan (typically an array with two items: ["actionName",{an object payload, e.g. row, field, value}])
 * @example sendToPlugin({ choice: action, rows: selectedRows })
 *
 */
const sendToPlugin = React.useCallback(
  ([action, data, additionalDetails = '']: [string, any, string]) => {
    const returnPluginCommand = globalSharedData.returnPluginCommand || 'undefined'
    if (returnPluginCommand === 'undefined' || !returnPluginCommand?.command || !returnPluginCommand?.id) {
      throw 'returnPluginCommand variable is not passed correctly to set up comms bridge. Check your data object which you are sending to invoke React'
    }
    if (!returnPluginCommand?.command) throw 'returnPluginCommand.cmd is not defined in the intial data passed to the plugin'
    if (!returnPluginCommand?.id) throw 'returnPluginCommand.id is not defined in the intial data passed to the plugin'
    if (!action) throw new Error('sendToPlugin: command/action must be called with a string')
    // logDebug(`Root`, ` sendToPlugin: ${JSON.stringify(action)} ${additionalDetails}`, action, data, additionalDetails)
    if (!data) throw new Error('sendToPlugin: data must be called with an object')
    // logDebug(`Root`, ` sendToPlugin: command:${action} data=${JSON.stringify(data)} `)
    const { command, id } = returnPluginCommand // this comes from the initial data passed to the plugin
    runPluginCommand(command, id, [action, data, additionalDetails])
  },
  [globalSharedData],
)

/**
 * Callback passed to child components that allows them to put a message in the banner
 * This function should not be called directly by child components, but rather via the dispatch function dispatch('SHOW_BANNER', payload)
 */
const showBanner = (msg: string, color: string = 'w3-pale-red', border: string = 'w3-border-red') => {
  const warnObj = { warn: true, msg, color, border }
  logDebug(`Root`, `showBanner zz: ${JSON.stringify(warnObj, null, 2)}`)
  setWarning(warnObj)
}

/**
 * handle click on X on banner to hide it
 */
const hideBanner = () => {
  setWarning({ warn: false, msg: '', color: 'w3-pale-red', border: 'w3-border-red' })
}

/**
 * For debugging purposes, send a message to the plugin to test the comms bridge
 */
const testCommsBridge = () => {
  logDebug(`Root`, ` _Root: testCommsBridge`)
  // send some info to the plugin
  // first param is the action type and the rest are data (can be any form you want)
  // data.foo = 'bar'
  sendMessageToPlugin(['commsBridgeTest', 'some sample', 'data passed'])
}

/**
 * Profiling React Components
 * @param {*} id
 * @param {*} phase
 * @param {*} actualDuration
 * @param {*} baseDuration
 * @param {*} startTime
 * @param {*} commitTime
 */
function onRender(id: string, phase: string, actualDuration: number, baseDuration: number, startTime: number, commitTime: number, interactions: Set<any>) {
  // DBW: MOST OF THIS INFO IS NOT INTERESTING. ONLY THE PHASE IS
  // Much better data is available in the React Dev Tools but only when the page is open in a browser
  logDebug(
    `Root`,
    `\n===================\nPROFILING:${id} phase=${phase} actualDuration=${actualDuration} baseDuration=${baseDuration} startTime=${startTime} commitTime=${commitTime} ${String(
      interactions,
    )}\n===================\n`,
  )
}

/****************************************************************************************************************************
 *                             EFFECTS
 ****************************************************************************************************************************/

/**
 * window listener for messages from the plugin
 */
useEffect(() => {
  // the name of this function is important. it corresponds with the Bridge call in the HTMLView
  // I don't recommend changing this function name here or in the bridge
  window.addEventListener('message', onMessageReceived)
  return () => window.removeEventListener('message', onMessageReceived)
}, [])

/**
 * Save scrollbar position
 * When the data changes, console.log it so we know and scroll the window
 * Fires after components draw
 */
useEffect(() => {
  if (npData?.passThroughVars?.lastWindowScrollTop !== undefined && npData.passThroughVars.lastWindowScrollTop !== window.scrollY) {
    // debug && logDebug(`Root`, ` FYI, underlying data has changed, picked up by useEffect. Scrolling to ${String(npData.lastWindowScrollTop)}`)
    window.scrollTo(0, npData.passThroughVars.lastWindowScrollTop)
  } else {
    // logDebug(`Root`, ` FYI, underlying data has changed, picked up by useEffect. No scroll info to restore, so doing nothing.`)
  }
}, [npData])

useEffect(() => {
  // logDebug('Root', `Noticed a change in reactSettings: ${JSON.stringify(reactSettings)}`)
  if (reactSettings.dynamicDialog.isOpen !== dialogIsVisible) {
    setDialogIsVisible(reactSettings.dynamicDialog.isOpen)
  }
}, [reactSettings])

/****************************************************************************************************************************
 *                             RENDER
 ****************************************************************************************************************************/

return (
  <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => { }} onError={myErrorLogger}>
    <div className="Root" onClickCapture={onClickCapture}>
      {logProfilingMessage ? (
        <Profiler id="MemoizedWebView" onRender={onRender}>
          {dialogIsVisible ? (
            <>
              {/* TODO: do not spread the props. put them all here individually once stable */}
              <DynamicDialog {...reactSettings.dynamicDialog}>
                <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
              </DynamicDialog>
            </>
          ) :
          <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
          }
          <MemoizedWebView dispatch={dispatch} data={npData} reactSettings={reactSettings} setReactSettings={setReactSettings} />
        </Profiler>
      ) : (
        <>
          {dialogIsVisible ? (
            <DynamicDialog {...reactSettings.dynamicDialog}>
              {' '}
              <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
            </DynamicDialog>
          ) :
          <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
          }
          <MemoizedWebView data={npData} dispatch={dispatch} reactSettings={reactSettings} setReactSettings={setReactSettings} />
        </>
      ) 
      }

      {(ROOT_DEBUG || debug) && (
        <React.StrictMode>
          <div className="w3-container w3-red w3-margin-top">Debugging Data (Plugin passed debug:true at window open)</div>
          <div>
            <span id="debugHistory">History (most recent first):</span>
            <ul>
              {history
                .slice()
                .reverse()
                .map((h, i) => (
                  <li style={{ fontSize: '12px' }} key={i}>
                    [{h?.date || ''}]: {h?.msg || ''}
                  </li>
                ))}
            </ul>
            <div className="monospaceData">globalSharedData: {JSON.stringify(globalSharedData, null, 2)}</div>
          </div>
          <div className="w3-button w3-black" onClick={() => dispatch('SHOW_BANNER', { msg: 'Banner test succeeded' }, `banner test`)}>
            Local Banner Display Test
          </div>
          <div className="w3-button w3-black" onClick={testCommsBridge}>
            Test Communication Bridge
          </div>
        </React.StrictMode>
      )}
    </div>
  </ErrorBoundary>
)
}

export default Root
