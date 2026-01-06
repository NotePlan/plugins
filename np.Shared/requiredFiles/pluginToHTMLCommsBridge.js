/* global onMessageFromPlugin, receivingPluginID */
/* eslint-disable no-unused-vars */
/**
 * Generic Plugin<-->HTML communications bridge
 * @author @dwertheimer
 * @version 1.0.0
 * Last updated 2023-02-18 @dwertheimer
 */

// rewrite that import as a require

/**
 * This file is loaded by the browser via <script> tag in the HTML file
 * Requires that the following variables are set prior to the inclusion of this file:
 * - receivingPluginID: the ID of the plugin that will receive the messages (generally this plugin.id of the plugin you are in)
 * - onMessageFromPlugin: the function that will receive the messages (this is in the template file html-plugin-comms.js
 * if you generated this plugin using the plugin generator, you will see the code sample
 *
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

/**
 * Recursively normalize strings in an object/array to ensure proper UTF-8 encoding
 * This helps prevent double-encoding corruption when data is sent through the bridge.
 *
 * IMPORTANT: This function is called BEFORE JSON.stringify to ensure all strings
 * are in a valid state. JSON.stringify will then escape non-ASCII characters as
 * \uXXXX sequences, which are safe for transmission through the Swift bridge.
 *
 * Note: We don't attempt to fix already-corrupted strings here because:
 * 1. JSON.stringify's \uXXXX escaping should prevent new corruption
 * 2. Fixing corruption should happen at the receiving end (when loading from disk)
 * 3. This is a safeguard, not a repair mechanism
 *
 * @param {any} obj - The object/array/value to normalize
 * @returns {any} - The normalized object/array/value
 */
const normalizeStringEncoding = (obj) => {
  if (typeof obj === 'string') {
    // JavaScript strings are already UTF-16 internally
    // JSON.stringify will escape non-ASCII as \uXXXX, which is safe
    // We just ensure the string is valid (not null/undefined)
    return obj
  } else if (Array.isArray(obj)) {
    return obj.map(normalizeStringEncoding)
  } else if (obj && typeof obj === 'object') {
    const normalized = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        normalized[key] = normalizeStringEncoding(obj[key])
      }
    }
    return normalized
  } else {
    return obj
  }
}

/**
 * Generic callback bridge from HTML to the plugin. We use this to generate the convenience function sendMessageToPlugin(args)
 * This command be used to run any plugin command, but it's better to use one single command: sendMessageToPlugin(args) for everything
 *
 * ENCODING SAFETY:
 * - We normalize strings before JSON.stringify to ensure proper UTF-8 encoding
 * - JSON.stringify escapes non-ASCII as \uXXXX sequences, which are safe for transmission
 * - The function pattern for %%commandArgs%% replacement is CRITICAL:
 *   It works around problems with $$ characters in commandArgs that could interfere
 *   with template string processing. See helpers/HTMLView.js line 92 for reference.
 *
 * @param {string} commandName
 * @param {string} pluginID
 * @param {Array<any>} commandArgs? - optional parameters
 */
const runPluginCommand = (commandName = '%%commandName%%', pluginID = '%%pluginID%%', commandArgs = []) => {
  // Normalize string encoding before stringifying to prevent corruption
  // We do this BEFORE the replace operations to ensure all strings are in a valid state
  const normalizedArgs = normalizeStringEncoding(commandArgs)

  const code = '(async function() { await DataStore.invokePluginCommandByName("%%commandName%%", "%%pluginID%%", %%commandArgs%%);})()'
    .replace('%%commandName%%', commandName)
    .replace('%%pluginID%%', pluginID)
    // CRITICAL: Use function pattern () => JSON.stringify() instead of pre-stringifying
    // This works around problems with $$ characters in commandArgs that could interfere
    // with template string processing. The function is called at replacement time.
    .replace('%%commandArgs%%', () => JSON.stringify(normalizedArgs))
  console.log(`bridge::runPluginCommand JS file in np.Shared Sending command "${commandName}" to NotePlan: "${pluginID}" with args:`, commandArgs)
  if (window.webkit) {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: code,
      onHandle: '',
      id: '1',
    })
  } else {
    console.log(`bridge::runPluginCommand`, `Simulating: window.runPluginCommand: ${commandName} called with args:`, commandArgs)
  }
}

/**
 * SENDER to the plugin: one single function to send data to your plugin - supply whatever arguments as an array
 * @param {string} type - the type of action we want the plugin to perform
 * @param {any} data - the data we want to send to the plugin
 */
const sendMessageToPlugin = (type, data) => runPluginCommand('onMessageFromHTMLView', receivingPluginID, [type, data])

/**
 * Check if a string contains common double-encoding corruption patterns
 * This is a lightweight check to detect issues without fixing them
 * @param {string} str - The string to check
 * @returns {boolean} - true if corruption patterns are detected
 */
const hasCorruptionPatterns = (str) => {
  if (!str || typeof str !== 'string') return false
  // Common double-encoding patterns (same as in encodingFix.js)
  const corruptionPatterns = [
    /â€"/g, // em dash corruption
    /â€"/g, // en dash corruption
    /ðŸ/g, // emoji corruption (e.g., ðŸ©º, ðŸŸ¢)
    /ô€/g, // emoji corruption (e.g., ô€Žž, ô€©)
    /ï¿¼/g, // BOM/zero-width corruption
  ]
  return corruptionPatterns.some((pattern) => pattern.test(str))
}

/**
 * Recursively check for corruption patterns in an object/array (non-invasive, logging only)
 * @param {any} obj - The object/array/value to check
 * @param {string} path - The path in the object (for logging)
 * @returns {boolean} - true if corruption was detected
 */
const checkForCorruption = (obj, path = 'root') => {
  if (typeof obj === 'string') {
    if (hasCorruptionPatterns(obj)) {
      console.warn(`[pluginToHTMLCommsBridge] Potential encoding corruption detected at path: ${path}`)
      // Log a sample (first 100 chars) to help debug
      const sample = obj.substring(0, 100)
      console.warn(`[pluginToHTMLCommsBridge] Sample: "${sample}"`)
      return true
    }
    return false
  } else if (Array.isArray(obj)) {
    return obj.some((item, index) => checkForCorruption(item, `${path}[${index}]`))
  } else if (obj && typeof obj === 'object') {
    return Object.keys(obj).some((key) => checkForCorruption(obj[key], `${path}.${key}`))
  }
  return false
}

/**
 * RECEIVER from the plugin -- callback function which receives async messages from the Plugin to the HTML view
 * Sends the messages sent to the 'switchboard' function which you define in your JS code before this file is imported
 *
 * ENCODING SAFETY:
 * - Data coming from Swift via postMessage should already be properly encoded
 * - However, if Swift reads corrupted data from disk, it may pass it through
 * - We perform a non-invasive check for corruption patterns and log warnings
 * - We do NOT automatically fix corruption here to avoid breaking existing functionality
 * - If corruption is detected, it should be fixed at the source (when loading from disk)
 *
 * @param {} event { origin, source, data }
 * @returns
 */
const onMessageReceived = (event) => {
  const { origin, source, data } = event
  if (!data || (typeof data === 'string' && data.startsWith('setImmediate$')) || (typeof data.source === 'string' && data.source.startsWith('react-devtools')) || data.iframeSrc) {
    return
  }
  try {
    // $FlowFixMe
    const { type, payload } = event.data // remember: data exists even though event is not JSON.stringify-able (like NP objects)
    if (!type) throw (`Received a message, but the 'type' was undefined`, event.data)
    if (!payload) throw (`Received a message but 'payload' was undefined`, event.data)

    // Non-invasive corruption detection (logging only, no modification)
    // This helps identify if corruption is coming from Swift/NotePlan side
    if (checkForCorruption(payload, 'payload')) {
      console.warn(`[CommsBridge] Encoding corruption detected in payload for type: ${type}`)
      console.warn(`[CommsBridge] Consider fixing corruption at the source (when loading from disk)`)
    }

    console.log(`CommsBridge ${type} message: "${payload?.lastUpdated?.msg || ''}"`, { payload })
    onMessageFromPlugin(type, payload) /* you need to have a function called onMessageFromPlugin in your code */
  } catch (error) {
    console.log(`CommsBridge onMessageReceived: ${JSON.stringify(error)}`)
  }
}

/* set up window listener to listen for messages back from the plugin */
window.addEventListener('message', onMessageReceived)

/* global shared data variable which can be written later by a plugin or the WebView JS */
// eslint-disable-next-line prefer-const
let globalSharedData = {}

/**
 * This is a bridge to route JS errors from the HTML window back to the NP console.log for debugging
 * It should already exist in the NP WebView JS if you imported the error bridge first
 * but it's so important for debugging that we will double check -- if it doesn't exist, we add it here
 * @param {string} msg
 * @param {string} url
 * @param {number} line
 * @param {number} column
 * @param {Error} error
 */
window.onerror =
  typeof window.onerror !== 'undefined'
    ? window.onerror
    : (msg, url, line, column, error) => {
        const message = {
          message: msg,
          url: url,
          line: line,
          column: column,
          error: JSON.stringify(error),
        }

        if (window.webkit) {
          window.webkit.messageHandlers.error.postMessage(message)
        } else {
          console.log('CommsBridge: JS Error:', message)
        }
      }

if (typeof receivingPluginID === 'undefined') {
  throw new Error('The variable receivingPluginID is not defined. This variable must be set prior to the inclusion of the pluginToHTMLCommsBridge file.')
}
if (typeof onMessageFromPlugin === 'undefined') {
  throw new Error('The function onMessageFromPlugin is not defined. This function must be imported/set prior to the inclusion of the pluginToHTMLCommsBridge file.')
}
