/****************************************************************************************************************************
 *                             ROOT COMPONENT
 ****************************************************************************************************************************/
// @flow
/****************************************************************************************************************************
 *                             NOTES
 * This is the root component of the React app - should not be edited
 * It is the parent of all other components on the page
 * dbw: Think about lightweight datastore https://blog.openreplay.com/lightweight-alternatives-to-redux/

 * globalSharedData is passed to window load time from the plugin, so you can use it for initial state.

 * It uses css.w3.css for styling the Debug area, when whatever
 main CSS for the plugin might not be available. 
 * It is *not* recommended to use this for styling the plugin itself.
 * For that please use the CSS provided converted from the NP Theme by the HTMLView.js functions.
 */

/****************************************************************************************************************************
 *                             GLOBAL VARS/FUNCTIONS
 ****************************************************************************************************************************/

declare var globalSharedData: { [string]: any }
declare var WebView: any // No props specified, use an empty object or specific props type
declare function runPluginCommand(command: string, id: string, args: Array<any>): void
declare function sendMessageToPlugin(Array<string | any>): void

/****************************************************************************************************************************
 *                             TYPES
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import React, { useState, useEffect, Profiler, type Node, useRef, useCallback, useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
// import { WebView } from './_Cmp-WebView.jsx' // we are assuming it's externally loaded by HTML
import { MessageBanner } from './MessageBanner.jsx'
import { Toast } from './Toast.jsx'
import { ErrorFallback } from './ErrorFallback.jsx'
import { SimpleDialog } from '@helpers/react/SimpleDialog'
import { logDebug, formatReactError, JSP, clo, logError, logInfo } from '@helpers/react/reactDev'
import './Root.css'

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
  const [reactSettings, setReactSettings] = useState({})

  // Initialize warning banner from globalSharedData if provided, otherwise default to hidden
  const initialBannerMessage = {
    type: globalSharedData?.initialBanner?.type || 'INFO',
    msg: globalSharedData?.initialBanner?.msg || '',
    timeout: globalSharedData?.initialBanner?.timeout || 0,
    color: globalSharedData?.initialBanner?.color || '',
    border: globalSharedData?.initialBanner?.border || '',
    icon: globalSharedData?.initialBanner?.icon || '',
    floating: globalSharedData?.initialBanner?.floating || false,
  }
  const [bannerMessage, setBannerMessage] = useState(initialBannerMessage)
  // Initialize toast message (default to hidden)
  const initialToastMessage = {
    type: 'INFO',
    msg: '',
    timeout: 0,
    color: '',
    border: '',
    icon: '',
  }
  const [toastMessage, setToastMessage] = useState(initialToastMessage)
  // const [setMessageFromPlugin] = useState({})
  const [history, setHistory] = useState([lastUpdated])
  const [showSimpleDialogTest, setShowSimpleDialogTest] = useState<boolean>(false)
  const [simpleDialogExample, setSimpleDialogExample] = useState<number>(0)

  // $FlowFixMe
  const tempSavedClicksRef = useRef<Array<TAnyObject>>([]) // temporarily store the clicks in the webview

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  // Ref to store original console methods for log buffer buster
  const originalConsoleMethodsRef = useRef<{ [string]: Function }>({})

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
   * Send data back to the plugin to update the data in the plugin
   * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
   * (for example, scroll position)
   * This function should not be called directly by child components, but rather via the sendActionToPlugin()
   * returnPluginCommand var with {command && id} should be sent in the initial data payload in HTML
   * @param {Array<any>} args to send to NotePlan (typically an array with two items: ["actionName",{an object payload, e.g. row, field, value}])
   * @example sendToPlugin({ choice: action, rows: selectedRows })
   * Memoized with useCallback to ensure stable reference (needed for onMessageReceived dependency).
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

      // Automatically inject __windowId if not already present
      // This ensures all plugin actions include windowId for routing and logging
      const dataWithWindowId = !data.__windowId && globalSharedData?.pluginData?.windowId ? { ...data, __windowId: globalSharedData.pluginData.windowId } : data

      const { command, id } = returnPluginCommand // this comes from the initial data passed to the plugin
      runPluginCommand(command, id, [action, dataWithWindowId, additionalDetails])
    },
    [globalSharedData],
  )

  /**
   * Callback passed to child components that allows them to put a message in the banner.
   * This function should not be called directly by child components, but rather via the dispatch function dispatch('SHOW_BANNER', payload).
   * If color/border/icon are not provided, they will be automatically determined from the type.
   * Memoized with useCallback to ensure stable reference (needed for onMessageReceived dependency).
   * @param {boolean} floating - if true, displays as a floating toast in top-right corner instead of banner at top
   */
  const showBanner = useCallback((type: string, msg: string, color?: string, border?: string, icon?: string, timeout: number = 0, floating: boolean = false) => {
    // If color/border/icon are not provided, determine them from the type
    let colorClass = color
    let borderClass = border
    let iconClass = icon

    if (!colorClass || !borderClass || !iconClass) {
      switch (type.toUpperCase()) {
        case 'INFO':
          colorClass = colorClass || 'color-info'
          borderClass = borderClass || 'border-info'
          iconClass = iconClass || 'fa-regular fa-circle-info'
          break
        case 'WARN':
          colorClass = colorClass || 'color-warn'
          borderClass = borderClass || 'border-warn'
          iconClass = iconClass || 'fa-regular fa-triangle-exclamation'
          break
        case 'ERROR':
          colorClass = colorClass || 'color-error'
          borderClass = borderClass || 'border-error'
          iconClass = iconClass || 'fa-regular fa-circle-exclamation'
          break
        case 'SUCCESS':
          colorClass = colorClass || 'color-success'
          borderClass = borderClass || 'border-success'
          iconClass = iconClass || 'fa-regular fa-circle-check'
          break
        default:
          colorClass = colorClass || 'color-info'
          borderClass = borderClass || 'border-info'
          iconClass = iconClass || 'fa-regular fa-circle-info'
      }
    }

    const bannerMessage = { type, msg, timeout, color: colorClass, border: borderClass, icon: iconClass, floating }
    logDebug(`Root`, `showBanner: ${JSON.stringify(bannerMessage, null, 2)}`)
    // $FlowFixMe - bannerMessage object matches the expected shape
    setBannerMessage(bannerMessage)
  }, []) // State setters are stable, no dependencies needed

  /**
   * handle click on X on banner to hide it
   * Memoized with useCallback to ensure stable reference (needed for onMessageReceived dependency).
   */
  const hideBanner = useCallback(() => {
    logDebug(`Root`, `hideBanner: ${JSON.stringify(bannerMessage, null, 2)}`)
    setBannerMessage({ type: 'REMOVE', msg: '', timeout: 0, color: '', border: '', icon: '', floating: false })
  }, [bannerMessage]) // Depend on bannerMessage for logging, but setBannerMessage is stable

  /**
   * Callback passed to child components that allows them to show a toast notification.
   * This function should not be called directly by child components, but rather via the dispatch function dispatch('SHOW_TOAST', payload).
   * If color/border/icon are not provided, they will be automatically determined from the type.
   * Memoized with useCallback to ensure stable reference (needed for onMessageReceived dependency).
   */
  const showToast = useCallback((type: string, msg: string, color?: string, border?: string, icon?: string, timeout: number = 3000) => {
    // If color/border/icon are not provided, determine them from the type
    let colorClass = color
    let borderClass = border
    let iconClass = icon

    if (!colorClass || !borderClass || !iconClass) {
      switch (type.toUpperCase()) {
        case 'INFO':
          colorClass = colorClass || 'color-info'
          borderClass = borderClass || 'border-info'
          iconClass = iconClass || 'fa-regular fa-circle-info'
          break
        case 'WARN':
          colorClass = colorClass || 'color-warn'
          borderClass = borderClass || 'border-warn'
          iconClass = iconClass || 'fa-regular fa-triangle-exclamation'
          break
        case 'ERROR':
          colorClass = colorClass || 'color-error'
          borderClass = borderClass || 'border-error'
          iconClass = iconClass || 'fa-regular fa-circle-exclamation'
          break
        case 'SUCCESS':
          colorClass = colorClass || 'color-success'
          borderClass = borderClass || 'border-success'
          iconClass = iconClass || 'fa-regular fa-circle-check'
          break
        default:
          colorClass = colorClass || 'color-info'
          borderClass = borderClass || 'border-info'
          iconClass = iconClass || 'fa-regular fa-circle-info'
      }
    }

    const toastMessage = { type, msg, timeout, color: colorClass, border: borderClass, icon: iconClass }
    logDebug(`Root`, `showToast: ${JSON.stringify(toastMessage, null, 2)}`)
    // $FlowFixMe - toastMessage object matches the expected shape
    setToastMessage(toastMessage)
  }, []) // State setters are stable, no dependencies needed

  /**
   * handle click on X on toast to hide it
   * Memoized with useCallback to ensure stable reference (needed for onMessageReceived dependency).
   */
  const hideToast = useCallback(() => {
    logDebug(`Root`, `hideToast: ${JSON.stringify(toastMessage, null, 2)}`)
    setToastMessage({ type: 'REMOVE', level: 'REMOVE', msg: '', timeout: 0, color: '', border: '', icon: '' })
  }, [toastMessage]) // Depend on toastMessage for logging, but setToastMessage is stable

  /**
   * This is effectively a reducer we will use to process messages from the plugin
   * And also from components down the tree, using the dispatch command
   * Memoized with useCallback to ensure stable reference (needed for dispatch dependency)
   */
  const onMessageReceived = useCallback(
    (event: MessageEvent) => {
      const { data } = event
      // logDebug('Root', `onMessageReceived ${event.type} data=${JSP(data, 2)}`)
      if (!shouldIgnoreMessage(event) && data) {
        // const str = JSON.stringify(event, null, 4)
        try {
          // $FlowFixMe
          const { type, payload } = event.data // remember: event is on prototype and not JSON.stringify-able
          if (!type) throw (`onMessageReceived: event.data.type is undefined`, event.data)
          if (!payload) throw (`onMessageReceived: event.data.payload is undefined`, event.data)

          if (type && payload) {
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
            switch (type.toUpperCase()) {
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
                logDebug(
                  `Root`,
                  ` onMessageReceived: Showing banner${payload.floating ? ' (floating toast mode)' : ''}, so we need to scroll the page up to the top so user sees it. (timeout: ${
                    payload.timeout ?? '-'
                  })`,
                )
                setNPData((prevData) => {
                  prevData.passThroughVars = prevData.passThroughVars ?? {}
                  prevData.passThroughVars.lastWindowScrollTop = 0
                  return { ...prevData, ...payload }
                })
                showBanner(payload.type, payload.msg, payload.color, payload.border, payload.icon, payload.timeout, payload.floating)
                // If timeout is a valid positive number, then start a timer to clear the message after the timeout period
                if (typeof payload.timeout === 'number' && payload.timeout > 0 && !isNaN(payload.timeout)) {
                  logDebug(`Root`, ` onMessageReceived: Setting timeout to clear banner after ${payload.timeout}ms`)
                  setTimeout(() => {
                    hideBanner()
                  }, payload.timeout)
                }
                break
              case 'REMOVE_BANNER':
                logInfo(`Root`, ` onMessageReceived: Removing banner`)
                hideBanner()
                break
              case 'SHOW_TOAST':
                logDebug(`Root`, ` onMessageReceived: Showing toast (timeout: ${payload.timeout ?? '-'})`)
                showToast(payload.type, payload.msg, payload.color, payload.border, payload.icon, payload.timeout)
                // If timeout is a valid positive number, then start a timer to clear the message after the timeout period
                if (typeof payload.timeout === 'number' && payload.timeout > 0 && !isNaN(payload.timeout)) {
                  logDebug(`Root`, ` onMessageReceived: Setting timeout to clear toast after ${payload.timeout}ms`)
                  setTimeout(() => {
                    hideToast()
                  }, payload.timeout)
                }
                break
              case 'REMOVE_TOAST':
                logInfo(`Root`, ` onMessageReceived: Removing toast`)
                hideToast()
                break
              case 'SEND_TO_PLUGIN':
                sendToPlugin(payload)
                break
              case 'RESPONSE':
                // Handle response from plugin for request/response pattern
                {
                  const { correlationId, success, data, error } = payload
                  const pending = pendingRequestsRef.current.get(correlationId)
                  if (pending) {
                    pendingRequestsRef.current.delete(correlationId)
                    clearTimeout(pending.timeoutId)
                    if (success) {
                      pending.resolve(data)
                    } else {
                      pending.reject(new Error(error || 'Request failed'))
                    }
                  } else if (ROOT_DEBUG || debug) {
                    // This is normal when child components handle their own request/response pattern
                    logDebug(`Root`, `RESPONSE received for correlationId not in Root's pending map: ${correlationId}`)
                  }
                }
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
    },
    [showBanner, hideBanner, showToast, hideToast, sendToPlugin],
  ) // Depend on memoized helper functions

  /**
   * Dispatcher for child components to update the master data object or show a banner message.
   * Memoized with useCallback to ensure stable reference across renders (prevents infinite loops in child components).
   * @param {'SET_TITLE'|'[SET|UPDATE]_DATA'|'SHOW_BANNER'} action - The action type to dispatch.
   * @param {any} data - The data associated with the action.
   * @param {string} [actionDescriptionForLog] - Optional description of the action for logging purposes.
   */
  // eslint-disable-next-line no-unused-vars
  const dispatch = useCallback(
    (action: string, data: any, actionDescriptionForLog?: string): void => {
      // const desc = `${action}${actionDescriptionForLog ? `: ${actionDescriptionForLog}` : ''}`
      // data.lastUpdated = { msg: desc, date: new Date().toLocaleString() }
      const event = new MessageEvent('message', { data: { type: action, payload: data } })
      onMessageReceived(event)
      // onMessageReceived({ data: { type: action, payload: data } }) // dispatch the message to the reducer
    },
    [onMessageReceived],
  ) // Depend on onMessageReceived, which is now stable

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
   * @param {string} id
   * @param {string} phase
   * @param {number} actualDuration
   * @param {number} baseDuration
   * @param {number} startTime
   * @param {number} commitTime
   * @param {Set<any>} interactions
   */
  function onRender(id: string, phase: string, actualDuration: number, baseDuration: number, startTime: number, commitTime: number, interactions: Set<any>): void {
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
    return () => {
      window.removeEventListener('message', onMessageReceived)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [onMessageReceived]) // Depend on onMessageReceived, which is now stable

  /**
   * Save scrollbar position
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    if (typeof npData?.passThroughVars?.lastWindowScrollTop !== 'undefined' && npData.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      // debug && logDebug(`Root`, ` FYI, underlying data has changed, picked up by useEffect. Scrolling to ${String(npData.lastWindowScrollTop)}`)
      window.scrollTo(0, npData.passThroughVars.lastWindowScrollTop)
    } else {
      // logDebug(`Root`, ` FYI, underlying data has changed, picked up by useEffect. No scroll info to restore, so doing nothing.`)
    }
  }, [npData])

  /****************************************************************************************************************************
   *                             LOG BUFFER BUSTER
   ****************************************************************************************************************************/
  useEffect(() => {
    if (globalSharedData?.pluginData?.logBufferBuster) {
      logDebug(`Root`, ` logBufferBuster is ENABLED in pluginData`)

      const methodsToOverride = ['log', 'error', 'info', 'warn']
      const padding = `${'.'.repeat(10000)}/`

      const overrideConsoleMethod = (methodName: string) => {
        // $FlowIgnore
        const originalMethod = console[methodName]
        originalConsoleMethodsRef.current[methodName] = originalMethod

        // $FlowIgnore
        console[methodName] = (...args: Array<any>) => {
          // NotePlan only captures the first 2 arguments, so we append padding to the first argument
          // Convert first arg to string and append padding to ensure it's always captured
          const paddedArgs = [...args]
          if (paddedArgs.length > 0) {
            // Always append padding to the first argument as a string
            const firstArgStr = typeof paddedArgs[0] === 'string' ? paddedArgs[0] : String(paddedArgs[0])
            paddedArgs[0] = `${firstArgStr}\n${padding}`
          } else {
            // If no arguments, add padding as the first argument
            paddedArgs.push(padding)
          }
          // Call original method with padded arguments
          originalMethod.apply(console, paddedArgs)
        }
      }

      methodsToOverride.forEach((methodName) => {
        overrideConsoleMethod(methodName)
      })

      // Verify override is working
      console.log('LOG_BUFFER_BUSTER_OVERRIDE_ACTIVE')
      console.log('test log buffer buster')

      return () => {
        // Restore original console methods on cleanup
        logDebug(`Root`, ` logBufferBuster is DISABLED or missing in pluginData`)
        methodsToOverride.forEach((methodName) => {
          if (originalConsoleMethodsRef.current[methodName]) {
            // $FlowIgnore
            console[methodName] = originalConsoleMethodsRef.current[methodName]
          }
        })
      }
    } else {
      logDebug(`Root`, ` logBufferBuster is DISABLED or missing in pluginData`)
    }
  }, [npData])

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => {}} onError={myErrorLogger}>
      <div className="Root" onClickCapture={onClickCapture}>
        {logProfilingMessage ? (
          <Profiler id="MemoizedWebView" onRender={onRender}>
            <MessageBanner
              msg={bannerMessage.msg}
              type={bannerMessage.type}
              color={bannerMessage.color || ''}
              border={bannerMessage.border || ''}
              hide={hideBanner}
              icon={bannerMessage.icon || ''}
              floating={bannerMessage.floating || false}
            />
            <MemoizedWebView dispatch={dispatch} data={npData} reactSettings={reactSettings} setReactSettings={setReactSettings} />
            <Toast
              msg={toastMessage.msg}
              type={toastMessage.type}
              color={toastMessage.color || ''}
              border={toastMessage.border || ''}
              hide={hideToast}
              icon={toastMessage.icon || ''}
            />
          </Profiler>
        ) : (
          <>
            <MessageBanner
              msg={bannerMessage.msg}
              type={bannerMessage.type}
              color={bannerMessage.color || ''}
              border={bannerMessage.border || ''}
              hide={hideBanner}
              icon={bannerMessage.icon || ''}
              floating={bannerMessage.floating || false}
            />
            <MemoizedWebView data={npData} dispatch={dispatch} reactSettings={reactSettings} setReactSettings={setReactSettings} />
            <Toast
              msg={toastMessage.msg}
              type={toastMessage.type}
              color={toastMessage.color || ''}
              border={toastMessage.border || ''}
              hide={hideToast}
              icon={toastMessage.icon || ''}
            />
            {showSimpleDialogTest &&
              (() => {
                // Cycle through different examples
                const examples = [
                  {
                    title: 'Example 1: Single OK Button (Default)',
                    message: 'This is the simplest dialog with just a single OK button. This is the default when no buttons are specified.',
                    buttonLabels: undefined, // Will use default OK button
                  },
                  {
                    title: 'Example 2: OK/Cancel Buttons',
                    message: 'This dialog uses buttonLabels with two buttons: Cancel and OK. The last button (OK) is automatically the default.',
                    buttonLabels: ['Cancel', 'OK'],
                  },
                  {
                    title: 'Example 3: Multiple Buttons',
                    message: 'This dialog uses buttonLabels with multiple options. The last button is always the default. Try clicking different buttons!',
                    buttonLabels: ['Cancel', 'Maybe', 'OK'],
                  },
                  {
                    title: 'Example 4: Custom Buttons (Full Control)',
                    message:
                      'This dialog uses the buttons prop for full control. You can specify which button is default. In this case, "Yes" is the default even though it\'s not last.',
                    buttons: [
                      { label: 'No', value: 'no', isDefault: false },
                      { label: 'Yes', value: 'yes', isDefault: true },
                      { label: 'Maybe', value: 'maybe', isDefault: false },
                    ],
                  },
                  {
                    title: 'Example 5: Wide Dialog',
                    message: 'This dialog demonstrates custom width. The dialog is wider than the default square size.',
                    buttonLabels: ['Cancel', 'OK'],
                    width: '700px',
                    maxWidth: '700px',
                  },
                ]
                const currentExample = examples[simpleDialogExample % examples.length]
                return (
                  <SimpleDialog
                    isOpen={showSimpleDialogTest}
                    title={currentExample.title}
                    message={currentExample.message}
                    buttons={currentExample.buttons}
                    buttonLabels={currentExample.buttonLabels}
                    width={currentExample.width}
                    maxWidth={currentExample.maxWidth}
                    onButtonClick={(value) => {
                      logDebug('Root', `SimpleDialog button clicked: ${value}, example: ${simpleDialogExample}`)
                      // If OK/Yes button clicked, show next example
                      const isDefaultButton =
                        value === 'ok' ||
                        value === 'yes' ||
                        (currentExample.buttonLabels && value === currentExample.buttonLabels[currentExample.buttonLabels.length - 1].toLowerCase().replace(/\s+/g, '-'))
                      if (isDefaultButton) {
                        // Update state to show next example - dialog will stay open because we return false
                        setSimpleDialogExample((prev) => {
                          const next = prev + 1
                          logDebug('Root', `Cycling to next example: ${next}`)
                          return next
                        })
                        // Return false to prevent dialog from closing - we want to show the next example
                        return false
                      } else {
                        // Other buttons close the dialog (return undefined/true to allow close)
                        setShowSimpleDialogTest(false)
                        return true
                      }
                    }}
                    onClose={() => setShowSimpleDialogTest(false)}
                  />
                )
              })()}
          </>
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
            <div className="root-test-button black" onClick={() => dispatch('SHOW_BANNER', { type: 'INFO', msg: 'Banner test succeeded' }, `banner test`)}>
              Local Banner Display Test
            </div>
            <div
              className="root-test-button black"
              onClick={() => {
                setSimpleDialogExample(0)
                setShowSimpleDialogTest(true)
              }}
            >
              Test SimpleDialog
            </div>
            <div className="root-test-button black" onClick={testCommsBridge}>
              Test Communication Bridge
            </div>
            <div
              className="root-test-button black"
              onClick={async () => {
                // Scroll to top first so we can see the toast
                window.scrollTo(0, 0)
                const toastTypes = [
                  { type: 'SUCCESS', msg: 'Success toast test! This is a success message.', timeout: 2000 },
                  { type: 'ERROR', msg: 'Error toast test! This is an error message.', timeout: 3000 },
                  { type: 'WARN', msg: 'Warning toast test! This is a warning message.', timeout: 3000 },
                  { type: 'INFO', msg: 'Info toast test! This is an info message.', timeout: 3000 },
                ]
                // Loop through each toast type sequentially
                for (let i = 0; i < toastTypes.length; i++) {
                  const toast = toastTypes[i]
                  dispatch('SHOW_TOAST', toast)
                  // Wait for this toast to disappear (timeout + small buffer) before showing the next
                  if (i < toastTypes.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, toast.timeout + 100))
                  }
                }
              }}
            >
              Test Toast
            </div>
          </React.StrictMode>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Root
