var WebViewBundle = (function (exports, React) {
  'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

  // This is a context provider for the app. You should generally not need to edit this file.

  /**
   * Type definitions for the application context.
   */

  // Default context value with initial reactSettings and functions.
  const defaultContextValue = {
    sendActionToPlugin: () => {},
    sendToPlugin: () => {},
    dispatch: () => {},
    pluginData: {},
    reactSettings: {},
    // Initial empty reactSettings local
    setReactSettings: () => {},
    // Placeholder function, actual implementation below.
    updatePluginData: () => {} // Placeholder function, actual implementation below.
  };
  /**
   * Create the context with the default value.
   */
  const AppContext = /*#__PURE__*/React.createContext(defaultContextValue);

  // Explicitly annotate the return type of AppProvider as a React element
  const AppProvider = ({
    children,
    sendActionToPlugin,
    sendToPlugin,
    dispatch,
    pluginData,
    updatePluginData,
    reactSettings,
    setReactSettings
  }) => {
    // Provide the context value with all functions and state.
    const contextValue = {
      sendActionToPlugin,
      sendToPlugin,
      dispatch,
      pluginData,
      reactSettings,
      setReactSettings,
      updatePluginData
    };
    return /*#__PURE__*/React__default["default"].createElement(AppContext.Provider, {
      value: contextValue
    }, children);
  };

  // Development-related helper functions
  /**
   * NotePlan API properties which should not be traversed when stringifying an object
   */
  const PARAM_BLACKLIST = ['note', 'referencedBlocks', 'availableThemes', 'currentTheme', 'linkedNoteTitles', 'linkedItems']; // fields not to be traversed (e.g. circular references)

  const dt = () => {
    const d = new Date();
    const pad = value => {
      return value < 10 ? `0${value}` : value.toString();
    };
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString('en-GB')}`;
  };

  /**
   * JSON.stringify() with support for Prototype properties
   * @author @dwertheimer
   *
   * @param {object} obj
   * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
   * @returns {string} stringified object
   * @example console.log(JSP(obj, '\t')) // prints the full object with newlines and tabs for indentation
   */
  function JSP(obj, space = 2) {
    if (typeof obj !== 'object' || obj instanceof Date) {
      return String(obj);
    } else {
      if (Array.isArray(obj)) {
        const arrInfo = [];
        let isValues = false;
        obj.forEach((item, i) => {
          if (typeof item === 'object') {
            arrInfo.push(`[${i}] = ${JSP(item, space)}`);
          } else {
            isValues = true;
            arrInfo.push(`${item}`);
          }
        });
        return `${isValues ? '[' : ''}${arrInfo.join(isValues ? ', ' : ',\n')}${isValues ? ']' : ''}`;
      }
      const propNames = getFilteredProps(obj);
      const fullObj = propNames.reduce((acc, propName) => {
        if (!/^__/.test(propName)) {
          if (Array.isArray(obj[propName])) {
            try {
              if (PARAM_BLACKLIST.indexOf(propName) === -1) {
                acc[propName] = obj[propName].map(x => {
                  if (typeof x === 'object' && !(x instanceof Date)) {
                    return JSP(x, '');
                  } else {
                    return x;
                  }
                });
              } else {
                acc[propName] = obj[propName]; //do not traverse any further
              }
            } catch (error) {
              logDebug$1('helpers/dev', `Caught error in JSP for propname=${propName} : ${error} typeof obj[propName]=${typeof obj[propName]} isArray=${String(Array.isArray(obj[propName]))} len=${obj[propName]?.length} \n VALUE: ${JSON.stringify(obj[propName])}`);
            }
          } else {
            acc[propName] = obj[propName];
          }
        }
        return acc;
      }, {});
      // return cleanStringifiedResults(JSON.stringify(fullObj, null, space ?? null))
      return typeof fullObj === 'object' && !(fullObj instanceof Date) ? JSON.stringify(fullObj, null, space ?? null) : 'date';
    }
  }

  /**
   * Console.logs all property names/values of an object to console with text preamble
   * @author @dwertheimer
   *
   * @param {object} obj - array or object
   * @param {string} preamble - (optional) text to prepend to the output
   * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
   * @example clo(obj, 'myObj:')
   */
  function clo(obj, preamble = '', space = 2) {
    if (!obj) {
      logDebug$1(preamble, `null`);
      return;
    }
    if (typeof obj !== 'object') {
      logDebug$1(preamble, `${obj}`);
    } else {
      logDebug$1(preamble, JSP(obj, space));
    }
  }

  /**
   * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
   * Often includes a bunch of properties that are not useful for the user, e.g. constructor, __proto__
   * See getFilteredProps for a cleaner version
   * @author @dwertheimer (via StackOverflow)
   *
   * @param {object} inObj
   * @returns {Array<string>}
   * @reference https://stackoverflow.com/questions/59228638/console-log-an-object-does-not-log-the-method-added-via-prototype-in-node-js-c
   */
  function getAllPropertyNames(inObj) {
    let obj = inObj;
    const props = [];
    do {
      Object.getOwnPropertyNames(obj).forEach(function (prop) {
        if (props.indexOf(prop) === -1) {
          props.push(prop);
        }
      });
    } while (obj = Object.getPrototypeOf(obj));
    return props;
  }

  /**
   * Get the properties of interest (i.e. excluding all the ones added automatically)
   * @author @dwertheimer
   * @param {object} object
   * @returns {Array<string>} - an array of the interesting properties of the object
   */
  const getFilteredProps = object => {
    const ignore = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'propertyIsEnumerable', 'isPrototypeOf'];
    if (typeof object !== 'object' || Array.isArray(object)) {
      // console.log(`getFilteredProps improper type: ${typeof object}`)
      return [];
    }
    return getAllPropertyNames(object).filter(prop => !/(^__)|(constructor)/.test(prop) && !ignore.includes(prop));
  };

  /**
   * Converts any to message string
   * @author @codedungeon
   * @param {any} message
   * @returns {string}
   */
  const _message = message => {
    let logMessage = '';
    switch (typeof message) {
      case 'string':
        logMessage = message;
        break;
      case 'object':
        if (Array.isArray(message)) {
          logMessage = message.toString();
        } else {
          logMessage = message instanceof Date ? message.toString() : JSON.stringify(message);
        }
        break;
      default:
        logMessage = message.toString();
        break;
    }
    return logMessage;
  };
  const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'none'];
  const LOG_LEVEL_STRINGS = ['| DEBUG |', '| INFO  |', '🥺 WARN🥺', '❗️ERROR❗️', 'none'];

  /**
   * Test _logLevel against logType to decide whether to output
   * @param {string} logType
   * @returns {boolean}
   */
  const shouldOutputForLogLevel = logType => {
    let userLogLevel = 1;
    const thisMessageLevel = LOG_LEVELS.indexOf(logType);
    const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null;
    // Note: Performing a null change against a value that is `undefined` will be true
    // Sure wish NotePlan would not return `undefined` but instead null, then the previous implementataion would not have failed

    // se _logLevel to decide whether to output
    if (pluginSettings && pluginSettings.hasOwnProperty('_logLevel')) {
      userLogLevel = pluginSettings['_logLevel'];
    }
    const userLogLevelIndex = LOG_LEVELS.indexOf(userLogLevel);
    return thisMessageLevel >= userLogLevelIndex;
  };

  /**
   * Test if _logFunctionRE is set and matches the current log details.
   * Note: only works if DataStore is available.
   * @param {any} pluginInfo
   * @returns
   */
  const shouldOutputForFunctionName = pluginInfo => {
    const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null;
    if (pluginSettings && pluginSettings.hasOwnProperty('_logFunctionRE')) {
      const functionRE = new RegExp(pluginSettings['_logFunctionRE'], 'i');
      const infoStr = pluginInfo === 'object' ? pluginInfo['plugin.id'] : String(pluginInfo);
      return functionRE.test(infoStr);
    }
    return false;
  };

  /**
   * Formats log output to include timestamp pluginId, pluginVersion
   * @author @codedungeon extended by @jgclark
   * @param {any} pluginInfo
   * @param {any} message
   * @param {string} type
   * @returns {string}
   */
  function log$1(pluginInfo, message = '', type = 'INFO') {
    let msg = '';
    if (shouldOutputForLogLevel(type) || shouldOutputForFunctionName(pluginInfo)) {
      const thisMessageLevel = LOG_LEVELS.indexOf(type);
      const thisIndicator = LOG_LEVEL_STRINGS[thisMessageLevel];
      let pluginId = '';
      let pluginVersion = '';
      const isPluginJson = typeof pluginInfo === 'object' && pluginInfo.hasOwnProperty('plugin.id');
      if (isPluginJson) {
        pluginId = pluginInfo.hasOwnProperty('plugin.id') ? pluginInfo['plugin.id'] : 'INVALID_PLUGIN_ID';
        pluginVersion = pluginInfo.hasOwnProperty('plugin.version') ? pluginInfo['plugin.version'] : 'INVALID_PLUGIN_VERSION';
        msg = `${dt().padEnd(19)} ${thisIndicator} ${pluginId} v${pluginVersion} :: ${_message(message)}`;
      } else {
        if (message.length > 0) {
          // msg = `${dt().padEnd(19)} | ${thisIndicator.padEnd(7)} | ${pluginInfo} :: ${_message(message)}`
          msg = `${dt().padEnd(19)} ${thisIndicator} ${pluginInfo} :: ${_message(message)}`;
        } else {
          // msg = `${dt().padEnd(19)} | ${thisIndicator.padEnd(7)} | ${_message(pluginInfo)}`
          msg = `${dt().padEnd(19)} ${thisIndicator} ${_message(pluginInfo)}`;
        }
      }
      console.log(msg);
    }
    return msg;
  }

  /**
   * Formats log output as ERROR to include timestamp pluginId, pluginVersion
   * @author @codedungeon
   * @param {any} pluginInfo
   * @param {any} message
   * @returns {string}
   */
  function logError(pluginInfo, error) {
    if (typeof error === 'object' && error != null) {
      const msg = `${error.filename ?? '<unknown file>'} ${error.lineNumber ?? '<unkonwn line>'}: ${error.message}`;
      return log$1(pluginInfo, msg, 'ERROR');
    }
    return log$1(pluginInfo, error, 'ERROR');
  }

  /**
   * Formats log output as INFO to include timestamp pluginId, pluginVersion
   * @author @codedungeon
   * @param {any} pluginInfo
   * @param {any} message
   * @returns {string}
   */
  function logInfo(pluginInfo, message = '') {
    return log$1(pluginInfo, message, 'INFO');
  }

  /**
   * Formats log output as DEBUG to include timestamp pluginId, pluginVersion
   * @author @dwertheimer
   * @param {any} pluginInfo
   * @param {any} message
   * @returns {string}
   */
  function logDebug$1(pluginInfo, message = '') {
    return log$1(pluginInfo, message, 'DEBUG');
  }

  // Functions which can be imported into any React Component

  /****************************************************************************************************************************
   *                             CONSOLE LOGGING
   ****************************************************************************************************************************/
  // color this component's output differently in the console
  /**
   * Generates a readable RGB color from a string's hash.
   * The color is guaranteed to be light enough to be readable on a white background.
   * @param {string} input The input string to hash.
   * @returns {string} The RGB color in the format 'rgb(r, g, b)'.
   */
  function stringToColor(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = input.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00ffffff).toString(16).toUpperCase();
    const hexColor = `#${`000000${color}`.slice(-6)}`;
    const rgb = hexToRgb(hexColor);

    // Adjust the brightness to ensure the color is not too dark
    const brightnessAdjusted = adjustBrightness(rgb.r, rgb.g, rgb.b);
    return `rgb(${brightnessAdjusted.r}, ${brightnessAdjusted.g}, ${brightnessAdjusted.b})`;
  }

  /**
   * Converts a hex color to an RGB object.
   * @param {string} hex The hex color string.
   * @returns {{r: number, g: number, b: number}} RGB representation.
   */
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      r,
      g,
      b
    };
  }

  /**
   * Adjusts the brightness of the color to ensure good readability on a white background.
   * @param {number} r Red component of the color.
   * @param {number} g Green component of the color.
   * @param {number} b Blue component of the color.
   * @returns {{r: number, g: number, b: number}} Brightened RGB color.
   */
  function adjustBrightness(_r, _g, _b) {
    const luminance = 0.2126 * _r + 0.7152 * _g + 0.0722 * _b;
    const brightnessFactor = luminance < 128 ? 0.5 : 0.25;
    const r = Math.floor(Math.min(255, _r + brightnessFactor * 255));
    const g = Math.floor(Math.min(255, _g + brightnessFactor * 255));
    const b = Math.floor(Math.min(255, _b + brightnessFactor * 255));
    return {
      r,
      g,
      b
    };
  }

  /**
   * Logs information to the console.
   * If this is in a browser, use colors
   * @param {string} logType - The type of log (e.g., DEBUG, ERROR).
   * @param {string} componentName - The name of the component.
   * @param {string} [detail] - Additional detail about the log.
   * @param {...any} args - Additional arguments to log.
   * @returns {void}
   */
  const log = (logType, componentName, detail, ...args) => {
    if (shouldOutputForLogLevel(logType)) {
      const isNotePlanConsole = !!window.webkit;
      let arg1, arg2;
      if (isNotePlanConsole) {
        arg1 = `${componentName}${detail ? `: ${detail} ` : ''}`;
        arg2 = ``;
        logType === 'DEBUG' ? logDebug$1(arg1, arg2, ...args) : logType === 'ERROR' ? logError(arg1, arg2, ...args) : logInfo(arg1, arg2, ...args);
      } else {
        // We are in the browser, so can use colors
        arg1 = `%c${componentName}${detail ? `: ${detail} ` : ''}`;
        arg2 = `color: #000; background: ${stringToColor(componentName)}`;
        console[logType.toLowerCase()](arg1, arg2, ...args);
      }
    }
  };

  /**
   * A prettier version of logDebug
   * Looks the same in the NotePlan console, but when debugging in a browser, it colors results with a color based on the componentName text.
   * Uses the same color for each call in a component (based on the first param).
   * @param {string} componentName - The name of the component.
   * @param {string} detail - Additional detail about the log.
   * @param {...any} args - Additional arguments to log.
   * @returns {void}
   */
  const logDebug = (componentName, detail, ...args) => {
    log('DEBUG', componentName, detail, ...args);
  };

  /****************************************************************************************************************************
   *                             WEBVIEW COMPONENT
   * This is your top-level React component. All other React components should be imported and included below
   ****************************************************************************************************************************/

  /****************************************************************************************************************************
   *                             CONSOLE LOGGING
   ****************************************************************************************************************************/
  /**
   * Root element for the Plugin's React Tree
   * @param {any} data
   * @param {Function} dispatch - function to send data back to the Root Component and plugin
   * NOTE: Even though we have named this FormView.jsx, it is exported as WebView because that is what Root expects to load dynamically
   */
  function FormView({
    data,
    dispatch,
    reactSettings,
    setReactSettings
  }) {
    /****************************************************************************************************************************
     *                             HOOKS
     ****************************************************************************************************************************/

    // GENERALLY SPEAKING YOU DO NOT WANT TO USE STATE HOOKS IN THE WEBVIEW COMPONENT
    // because the plugin may need to know what changes were made so when it updates data, it will be consistent
    // otherwise when the plugin updates data, it will overwrite any changes made locally in the Webview
    // instead of using hooks here, save updates to data using:
    // dispatch('UPDATE_DATA', {...data,changesToData})
    // this will save the data at the Root React Component level, which will give the plugin access to this data also
    // sending this dispatch will re-render the Webview component with the new data

    /****************************************************************************************************************************
     *                             VARIABLES
     ****************************************************************************************************************************/

    // destructure all the startup data we expect from the plugin
    const {
      pluginData,
      debug
    } = data;
    const formFields = pluginData.formFields || [];

    /****************************************************************************************************************************
     *                             HANDLERS
     ****************************************************************************************************************************/

    //
    // Dynamic Dialog Example
    //
    const closeDialog = () => {
      setReactSettings(prev => ({
        ...prev,
        dynamicDialog: {
          isOpen: false
        }
      }));
    };
    const handleCancel = () => {
      sendActionToPlugin('onSubmitClick', {
        type: 'cancel'
      });
      closeDialog();
    };
    const handleSave = formValues => {
      clo(formValues, 'DynamicDialog: handleSave: formValues');
      sendActionToPlugin('onSubmitClick', {
        type: 'submit',
        formValues,
        receivingTemplateTitle: pluginData['receivingTemplateTitle'] || ''
      });
      closeDialog();
    };

    // Return true if the string is 'true' (case insensitive), otherwise return false (blank or otherwise)
    const isTrueString = value => value ? /true/i.test(value) : false;
    const openDialog = () => {
      setReactSettings(prev => ({
        ...prev,
        dynamicDialog: {
          isOpen: true,
          title: pluginData?.formTitle || 'Form Entry',
          items: formFields,
          onSave: handleSave,
          onCancel: handleCancel,
          allowEmptySubmit: isTrueString(pluginData.allowEmptySubmit),
          hideDependentItems: isTrueString(pluginData.hideDependentItems)
        }
      }));
    };

    /****************************************************************************************************************************
     *                             EFFECTS
     ****************************************************************************************************************************/

    /**
     * When the data changes, console.log it so we know and scroll the window
     * Fires after components draw
     */
    React.useEffect(() => {
      if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
        window.scrollTo(0, data.passThroughVars.lastWindowScrollTop);
      }
    }, [data]);

    // open the dialog when the page loads
    React.useEffect(() => openDialog(), []);

    /**
     * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
     * Because any data change coming from the plugin will force a React re-render, we can use this to store data that we want to persist
     * (e.g. lastWindowScrollTop)
     * @param {*} data
     * @returns
     */
    const addPassthroughVars = data => {
      const newData = {
        ...data
      };
      if (!newData.passThroughVars) newData.passThroughVars = {};
      // $FlowIgnore
      newData.passThroughVars.lastWindowScrollTop = window.scrollY;
      return newData;
    };

    /**
     * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
     * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
     * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
     * @param {string} command
     * @param {any} dataToSend
     */
    const sendActionToPlugin = (command, dataToSend, additionalDetails = '') => {
      const newData = addPassthroughVars(data); // save scroll position and other data in data object at root level
      dispatch('UPDATE_DATA', newData); // save the data at the Root React Component level, which will give the plugin access to this data also
      sendToPlugin([command, dataToSend, additionalDetails]); // send action to plugin
    };

    /**
     * Send data back to the plugin to update the data in the plugin
     * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
     * In that case, don't call this directly, use sendActionToPlugin() instead
     * @param {[command:string,data:any,additionalDetails:string]} param0
     */
    // $FlowIgnore
    const sendToPlugin = ([command, data, additionalDetails = '']) => {
      if (!command) throw new Error('sendToPlugin: command must be called with a string');
      logDebug(`Webview: sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, data, additionalDetails);
      if (!data) throw new Error('sendToPlugin: data must be called with an object');
      dispatch('SEND_TO_PLUGIN', [command, data], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`);
    };

    /**
     * Updates the pluginData with the provided new data (must be the whole pluginData object)
     *
     * @param {Object} newData - The new data to update the plugin with,
     * @param {string} messageForLog - An optional message to log with the update
     * @throws {Error} Throws an error if newData is not provided or if it does not have more keys than the current pluginData.
     * @return {void}
     */
    const updatePluginData = (newData, messageForLog) => {
      if (!newData) {
        throw new Error('updatePluginData: newData must be called with an object');
      }
      if (Object.keys(newData).length < Object.keys(pluginData).length) {
        throw new Error('updatePluginData: newData must be called with an object that has more keys than the current pluginData. You must send a full pluginData object');
      }
      const newFullData = {
        ...data,
        pluginData: newData
      };
      dispatch('UPDATE_DATA', newFullData, messageForLog); // save the data at the Root React Component level, which will give the plugin access to this data also
    };
    if (!pluginData.reactSettings) pluginData.reactSettings = {};

    /****************************************************************************************************************************
     *                             RENDER
     ****************************************************************************************************************************/

    return /*#__PURE__*/React__default["default"].createElement(AppProvider, {
      sendActionToPlugin: sendActionToPlugin,
      sendToPlugin: sendToPlugin,
      dispatch: dispatch,
      pluginData: pluginData,
      updatePluginData: updatePluginData,
      reactSettings: reactSettings,
      setReactSettings: setReactSettings
    }, /*#__PURE__*/React__default["default"].createElement("div", {
      className: `webview ${pluginData.platform || ''}`
    }, /*#__PURE__*/React__default["default"].createElement("div", {
      style: {
        maxWidth: '100vw',
        width: '100vw'
      }
    })));
  }

  exports.WebView = FormView;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, react);
Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, WebViewBundle)
