/****************************************************************************************************************************
 *                             ROOT COMPONENT
 ****************************************************************************************************************************/
// @flow
declare var globalSharedData: any
declare var WebView: any
declare function runPluginCommand(command: string, id: string, args: Array<any>): void
declare function sendMessageToPlugin(Array<string | any>): void
type Props = {}

/****************************************************************************************************************************
 *                             NOTES
 * This is the root component of the React app - should not be edited
 * It is the parent of all other components on the page
 * dbw: Think about lightweight datastore https://blog.openreplay.com/lightweight-alternatives-to-redux/

// globalSharedData is passed to window load time from the plugin, so you can use it for initial state
*/

/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import React, { useEffect, Profiler, type Node } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
// import { WebView } from './_Cmp-WebView.jsx' // we are gonna have to hope it's loaded by HTML
import { MessageBanner } from './MessageBanner.jsx'
import { ErrorFallback } from './ErrorFallback.jsx'

// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #62AFEC'
const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)
const logSubtle = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args)
const logTemp = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'background: #fff; color: #000', ...args)

const ROOT_DEBUG = false

// used by the ErrorBoundary component
const myErrorLogger = (error: Error, info: { componentStack: string }) => {
  console.log(`%cRoot: ErrorBoundary got error: error=\n${JSON.stringify(error)},\ninfo=${JSON.stringify(info)}`, 'background: #ff0000; color: #ffffff')
}

/****************************************************************************************************************************
 *                             globalSharedData
 ****************************************************************************************************************************/

// this is the global data object that is passed from the plugin in JS
// the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
// globalSharedData = { data: {}, returnPluginCommand: {command: "", id: ""}
const { lastUpdated = null, returnPluginCommand = {}, debug = false, ENV_MODE } = globalSharedData
if (typeof globalSharedData === 'undefined' || !globalSharedData) logDebug('Root: Root: globalSharedData is undefined', globalSharedData)
if (typeof globalSharedData === 'undefined') throw (`Root: globalSharedData is undefined. You must define this field in the initial data passed to the plugin`, globalSharedData)
if (typeof globalSharedData.lastUpdated === 'undefined') throw `Root: globalSharedData.lastUpdated is undefined`

export function Root(props: Props): Node {
  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  const [npData, setNPData] = React.useState(globalSharedData) // set it from initial data
  const [warning, setWarning] = React.useState({ warn: false, msg: '', color: 'w3-pale-red' })
  const [messageFromPlugin, setMessageFromPlugin] = React.useState({})
  const [history, setHistory] = React.useState([lastUpdated])
  const tempSavedClicksRef = React.useRef([]) //temporarily store the clicks in the webview

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/

  const MemoizedWebView = React.memo(WebView)
  // const Profiler = React.Profiler
  debug &&
    logDebug(`Root: Running in Debug mode. Note: <React.StrictMode> is enabled which will run effects twice each time they are rendered. This is to help find bugs in your code.`)

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /**
   * For debugging purposes only, when debug:true is passed in the initial data, this will log all clicks
   * So you can see in the log what was clicked before other log output shows up
   * Saves to the history state so you can see it in the UI
   * @param {Event} e
   */
  const onClickCapture = (e) => {
    if (!debug) return
    logDebug(`Root: onClickCapture: ${e.target.tagName} ${e.target.className}`)
    logDebug(`Root: onClickCapture ${e.type} ${e.target.outerText} e=`, e)
    // Note: cannot setHistory because the page will refresh and any open dropdown will close, so let's just temp store it until we can write it
    tempSavedClicksRef.current.push({ date: new Date().toLocaleDateString(), msg: `UI_CLICK ${e.type} ${e.target.outerText}` })
  }

  /**
   * handler/dispatcher for child components to update the master data object or show a banner message
   * @param {'SET_TITLE'|'[SET|UPDATE]_DATA'|'SHOW_BANNER'} action
   * @param {any} data
   * @param {string} - description of this action for logging
   */
  const dispatch = (action: string, data: any, actionDescriptionForLog? = '') => {
    const desc = `${action}${actionDescriptionForLog ? `: ${actionDescriptionForLog}` : ''}`
    data.lastUpdated = { msg: desc, date: new Date().toLocaleString() }
    onMessageReceived({ data: { type: action, payload: data } }) // dispatch the message to the reducer
  }

  /**
   * Ignore messages that have nothing to do with the plugin
   * @param {Event} event
   * @returns {boolean}
   */
  const shouldIgnoreMessage = (event) => {
    const { origin, source, data } = event
    // logDebug(
    //   `Root: shouldIgnoreMessage origin=${origin} source=${source} data=${JSON.stringify(data)} data.source=${
    //     data?.source
    //   } /react-devtools/.test(data?.source=${/react-devtools/.test(data?.source)}}`,
    // )
    return (typeof data === 'string' && data?.startsWith('setImmediate$')) || (typeof data === 'object' && data?.hasOwnProperty('iframeSrc')) || /react-devtools/.test(data?.source)
  }

  /**
   * This is effectively a reducer we will use to process messages from the plugin
   * And also from components down the tree, using the dispatch command
   */
  const onMessageReceived = (event: MessageEvent | { data: { type: string, payload: any } }) => {
    const { data } = event
    if (!shouldIgnoreMessage(event) && data) {
      // const str = JSON.stringify(event, null, 4)
      try {
        // $FlowFixMe
        const { type, payload } = event.data // remember: event is on prototype and not JSON.stringify-able
        if (!type) throw (`onMessageReceived: event.data.type is undefined`, event.data)
        if (!payload) throw (`onMessageReceived: event.data.payload is undefined`, event.data)
        if (type && payload) {
          logDebug(`Root: onMessageReceived: ${type} payload:${JSON.stringify(payload, null, 2)}`)
          // Spread existing state into new object to keep it immutable
          // TODO: ideally, you would use a reducer here
          if (type === 'SHOW_BANNER') payload.lastUpdated.msg += `: ${payload.msg}`
          setHistory((prevData) => [...prevData, ...tempSavedClicksRef.current, payload.lastUpdated])
          tempSavedClicksRef.current = []
          // logDebug(`Root: onMessageReceived reducer Action type: ${type || ''} payload: ${JSON.stringify(payload, null, 2)}`)
          switch (type) {
            case 'SET_TITLE':
              // Note this works because we are using payload.title in npData
              document.title = payload.title
              break
            case 'SET_DATA':
            case 'UPDATE_DATA':
              // logDebug('Root: SET_DATA before')
              setNPData((prevData) => ({ ...prevData, ...payload }))
              globalSharedData = { ...globalSharedData, ...payload }
              logDebug('Root: SET_DATA after setting globalSharedData=', globalSharedData)
              break
            case 'SHOW_BANNER':
              showBanner(payload.msg, payload.color, payload.border)
              // const warnObj = { warn: true, msg: payload.msg, color: payload.color ?? 'w3-pale-red', border: payload.border ?? 'w3-border-red' }
              // logDebug(`Root: onMessageReceived: SHOW_BANNER: sending: ${JSON.stringify(warnObj)}`)
              // setWarning(warnObj)
              // logDebug(`Root: onMessageReceived: SHOW_BANNER: sent: ${JSON.stringify(warnObj)}`)
              break
            case 'SEND_TO_PLUGIN':
              sendToPlugin(payload)
              break
            case 'RETURN_VALUE' /* function called returned a value */:
              //FIXME: changing this prop is forcing refresh of all children, resetting data
              // same is true for message banner
              logDebug(`Root: onMessageReceived: processing payload`)
              setMessageFromPlugin(payload)
              break
            default:
              break
          }
        } else {
          logDebug(`Root: onMessageReceived: called but event.data.type and/or event.data.payload is undefined`, event)
        }
      } catch (error) {
        logDebug(`Root: onMessageReceived: error=${JSON.stringify(error)}error=${JSON.stringify(error)}`)
      }
    } else {
      // logDebug(`Root: onMessageReceived: called but event.data is undefined: noop`)
    }
  }

  /**
   * send runplugin command (specified in globalData) to NotePlan to process data
   * This function should not be called directly by child components, but rather via the dispatch function dispatch('SEND_TO_PLUGIN', payload)
   * returnPluginCommand var with {command && id} should be sent in the initial data payload in HTML
   * @param {Array<any>} args to send to NotePlan (typically an array with two items: ["actionName",{an object payload, e.g. row, field, value}])
   * @example sendToPlugin({ choice: action, rows: selectedRows })
   *
   */
  const sendToPlugin = React.useCallback((args) => {
    const returnPluginCommand = globalSharedData.returnPluginCommand || 'undefined'
    if (returnPluginCommand === 'undefined' || !returnPluginCommand?.command || !returnPluginCommand?.id) {
      throw 'returnPluginCommand variable is not passed correctly to set up comms bridge. Check your data object which you are sending to invoke React'
    }
    if (!returnPluginCommand?.command) throw 'returnPluginCommand.cmd is not defined in the intial data passed to the plugin'
    if (!returnPluginCommand?.id) throw 'returnPluginCommand.id is not defined in the intial data passed to the plugin'
    const { command, id } = returnPluginCommand // this comes from the initial data passed to the plugin
    runPluginCommand(command, id, args)
  }, [])

  /**
   * Callback passed to child components that allows them to put a message in the banner
   * This function should not be called directly by child components, but rather via the dispatch function dispatch('SHOW_BANNER', payload)
   */
  const showBanner = (msg, color = 'w3-pale-red', border = 'w3-border-red') => {
    const warnObj = { warn: true, msg, color, border }
    logDebug(`Root: showBanner: sending: ${JSON.stringify(warnObj)}`)
    setWarning(warnObj)
  }

  /**
   * handle click on X on banner to hide it
   */
  const hideBanner = () => {
    setWarning({ warn: false, msg: '', color: 'w3-pale-red' })
  }

  /**
   * For debugging purposes, send a message to the plugin to test the comms bridge
   */
  const testCommsBridge = () => {
    logDebug(`Root: _Root: testCommsBridge`)
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
  function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime, interactions) {
    // DBW: MOST OF THIS INFO IS NOT INTERESTING. ONLY THE PHASE IS
    // Much better data is available in the React Dev Tools but only when the page is open in a browser
    logSubtle(
      `\n===================\nPROFILING:${id} phase=${phase} actualDuration=${actualDuration} baseDuration=${baseDuration} startTime=${startTime} commitTime=${commitTime}\n===================\n`,
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

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => {}} onError={myErrorLogger}>
      <div className="Root" onClickCapture={onClickCapture}>
        <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
        {debug ? (
          <Profiler id="MemoizedWebView" onRender={onRender}>
            <MemoizedWebView
              dispatch={dispatch}
              data={npData}
              /*
                sendToPlugin={sendToPlugin}
                messageFromPlugin={messageFromPlugin}
                ackMessageFromPlugin={ackMessageFromPlugin}
                showBanner={showBanner}
                */
            />
          </Profiler>
        ) : (
          <MemoizedWebView data={npData} dispatch={dispatch} />
        )}

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
