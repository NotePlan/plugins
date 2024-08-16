var RootBundle = (function (exports, React$1) {
  'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var React__default = /*#__PURE__*/_interopDefaultLegacy(React$1);

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
  const shouldOutputForLogLevel = logType => {
    let userLogLevel = 1;
    const thisMessageLevel = LOG_LEVELS.indexOf(logType);
    const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null;
    // this was the main offender.  Perform a null change against a value that is `undefined` will be true
    // sure wish NotePlan would not return `undefined` but instead null, then the previous implementataion would not have failed
    if (pluginSettings && pluginSettings.hasOwnProperty('_logLevel')) {
      // eslint-disable-next-line
      userLogLevel = pluginSettings['_logLevel'];
    }
    const userLogLevelIndex = LOG_LEVELS.indexOf(userLogLevel);
    return thisMessageLevel >= userLogLevelIndex;
  };

  /**
   * Formats log output to include timestamp pluginId, pluginVersion
   * @author @codedungeon
   * @param {any} pluginInfo
   * @param {any} message
   * @param {string} type
   * @returns {string}
   */
  function log$1(pluginInfo, message = '', type = 'INFO') {
    const thisMessageLevel = LOG_LEVELS.indexOf(type);
    const thisIndicator = LOG_LEVEL_STRINGS[thisMessageLevel];
    let msg = '';
    let pluginId = '';
    let pluginVersion = '';
    // let msgType = ''
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
    if (shouldOutputForLogLevel(type)) {
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
  function logError$1(pluginInfo, error) {
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
   * @returns {void}
   */
  function logInfo(pluginInfo, message = '') {
    return log$1(pluginInfo, message, 'INFO');
  }

  /**
   * Formats log output as WARN to include timestamp pluginId, pluginVersion
   * @author @dwertheimer
   * @param {any} pluginInfo
   * @param {any} message
   * @returns {void}
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
   *
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
        logType === 'DEBUG' ? logDebug$1(arg1, arg2, ...args) : logType === 'ERROR' ? logError$1(arg1, arg2, ...args) : logInfo(arg1, arg2, ...args);
      } else {
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

  /**
   * Logs an error message to the console.
   * Similar to logDebug.
   * @param {string} componentName - The name of the component.
   * @param {string} detail - Additional detail about the log.
   * @param {...any} args - Additional arguments to log.
   * @returns {void}
   */
  const logError = (componentName, detail, ...args) => {
    log('ERROR', componentName, detail, ...args);
  };

  /**
   * Error objects in React are not JSON stringifiable. This function makes them JSON stringifiable.
   * It also removes the redundant file path from the stack trace.
   * @param {Error} error
   * @param {string} cs - (optional) component stack
   * @returns {any} - a simple JS Object with the errror details: name, message, inComponent, line, column, componentStack
   */

  const formatReactError = (error, cs = '') => {
    return {
      name: error.name,
      message: error.message,
      inComponent: cs.split('@file', 1)[0]?.replace('\n', ''),
      line: error.line || '',
      column: error.column,
      componentStack: cs.split('\n').map(s => s.replace(/\@file.*$/, '')).filter(s => s.trim() !== 'div' && s.trim() !== '' && s.trim() !== 'Root' && s.trim() !== 'ErrorBoundary').join(' < ')
    };
  };

  const ErrorBoundaryContext = React$1.createContext(null);

  const initialState = {
    didCatch: false,
    error: null
  };
  class ErrorBoundary extends React$1.Component {
    constructor(props) {
      super(props);
      this.resetErrorBoundary = this.resetErrorBoundary.bind(this);
      this.state = initialState;
    }
    static getDerivedStateFromError(error) {
      return {
        didCatch: true,
        error
      };
    }
    resetErrorBoundary() {
      const {
        error
      } = this.state;
      if (error !== null) {
        var _this$props$onReset, _this$props;
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        (_this$props$onReset = (_this$props = this.props).onReset) === null || _this$props$onReset === void 0 ? void 0 : _this$props$onReset.call(_this$props, {
          args,
          reason: "imperative-api"
        });
        this.setState(initialState);
      }
    }
    componentDidCatch(error, info) {
      var _this$props$onError, _this$props2;
      (_this$props$onError = (_this$props2 = this.props).onError) === null || _this$props$onError === void 0 ? void 0 : _this$props$onError.call(_this$props2, error, info);
    }
    componentDidUpdate(prevProps, prevState) {
      const {
        didCatch
      } = this.state;
      const {
        resetKeys
      } = this.props;

      // There's an edge case where if the thing that triggered the error happens to *also* be in the resetKeys array,
      // we'd end up resetting the error boundary immediately.
      // This would likely trigger a second error to be thrown.
      // So we make sure that we don't check the resetKeys on the first call of cDU after the error is set.

      if (didCatch && prevState.error !== null && hasArrayChanged(prevProps.resetKeys, resetKeys)) {
        var _this$props$onReset2, _this$props3;
        (_this$props$onReset2 = (_this$props3 = this.props).onReset) === null || _this$props$onReset2 === void 0 ? void 0 : _this$props$onReset2.call(_this$props3, {
          next: resetKeys,
          prev: prevProps.resetKeys,
          reason: "keys"
        });
        this.setState(initialState);
      }
    }
    render() {
      const {
        children,
        fallbackRender,
        FallbackComponent,
        fallback
      } = this.props;
      const {
        didCatch,
        error
      } = this.state;
      let childToRender = children;
      if (didCatch) {
        const props = {
          error,
          resetErrorBoundary: this.resetErrorBoundary
        };
        if (typeof fallbackRender === "function") {
          childToRender = fallbackRender(props);
        } else if (FallbackComponent) {
          childToRender = React$1.createElement(FallbackComponent, props);
        } else if (fallback === null || React$1.isValidElement(fallback)) {
          childToRender = fallback;
        } else {
          throw error;
        }
      }
      return React$1.createElement(ErrorBoundaryContext.Provider, {
        value: {
          didCatch,
          error,
          resetErrorBoundary: this.resetErrorBoundary
        }
      }, childToRender);
    }
  }
  function hasArrayChanged() {
    let a = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    let b = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    return a.length !== b.length || a.some((item, index) => !Object.is(item, b[index]));
  }

  /**
   * Warning/message banner at top of page
   * Send a SHOW_BANNER message from the plugin with the following payload:
   * @param { warn, msg, color, border, hide } props
   * @returns
   */
  function MessageBanner(props) {
    if (!props.warn) {
      return null;
    }
    // onclick="this.parentElement.style.display='none'" class="w3-button w3-display-topright"
    console.log(`Root: MessageBanner: props=${JSON.stringify(props)}`);
    const className = `w3-panel w3-display-container ${props.border ? 'w3-leftbar' : ''} ${props.border ?? 'w3-border-red'} ${props.color ?? 'w3-pale-red'}`;
    window.scrollTo(0, 0);
    return /*#__PURE__*/React.createElement("div", {
      className: className
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => props.hide(),
      className: "w3-button w3-display-right"
    }, "X"), /*#__PURE__*/React.createElement("p", null, props.msg));
  }

  const ErrorFallback = props => {
    clo(props);
    const {
      error
    } = props;
    const formatted = formatReactError(error);
    return /*#__PURE__*/React.createElement("div", {
      role: "alert"
    }, /*#__PURE__*/React.createElement("h1", null, "Something went wrong in React:"), /*#__PURE__*/React.createElement("pre", null, formatted.name, ": ", formatted.message), /*#__PURE__*/React.createElement("p", null), /*#__PURE__*/React.createElement("p", null, "See more detail in the console"));
  };

  /****************************************************************************************************************************
   *                             ROOT COMPONENT
   ****************************************************************************************************************************/

  // used by the ErrorBoundary component to write out the error to the log
  const myErrorLogger = (e, i) => {
    const error = formatReactError(e, i.componentStack);
    console.log(`${window.webkit ? '' : '%c'}React error trapped by Root::ErrorBoundary; error=${JSP(error, 2)}`, 'background: #ff0000; color: #ffffff');
  };

  /****************************************************************************************************************************
   *                             globalSharedData
   ****************************************************************************************************************************/
  // this is the global data object that is passed from the plugin in JS
  // the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
  // globalSharedData = { data: {}, returnPluginCommand: {command: "", id: ""}
  const {
    lastUpdated = null,
    /* returnPluginCommand = {},*/debug = false,
    /*ENV_MODE,*/logProfilingMessage = false
  } = globalSharedData;
  if (typeof globalSharedData === 'undefined' || !globalSharedData) logDebug('Root: Root: globalSharedData is undefined', globalSharedData);
  if (typeof globalSharedData === 'undefined') throw globalSharedData;
  if (typeof globalSharedData.lastUpdated === 'undefined') throw `Root: globalSharedData.lastUpdated is undefined`;
  function Root( /* props: Props */
  ) {
    /****************************************************************************************************************************
     *                             HOOKS
     ****************************************************************************************************************************/

    const [npData, setNPData] = React$1.useState(globalSharedData); // set it from initial data
    const [reactSettings, setReactSettings] = React$1.useState({});
    const [warning, setWarning] = React$1.useState({
      warn: false,
      msg: '',
      color: 'w3-pale-red',
      border: 'w3-border-red'
    });
    // const [setMessageFromPlugin] = useState({})
    const [history, setHistory] = React$1.useState([lastUpdated]);
    // $FlowFixMe
    const tempSavedClicksRef = React$1.useRef([]); // temporarily store the clicks in the webview

    // NP does not destroy windows on close. So if we have an autorefresh sending requests to NP, it will run forever
    // So we do a check in sendToHTMLWindow to see if the window is still open
    if (npData?.NPWindowID === false) {
      throw new Error('Root: npData.NPWindowID is false; The window must have been closed. Stopping the React app. This is not a problem you need to worry about.');
    }

    /****************************************************************************************************************************
     *                             VARIABLES
     ****************************************************************************************************************************/
    const MemoizedWebView = WebView; // React.memo(WebView)
    // const Profiler = React.Profiler
    debug && logDebug(`Root`, ` Running in Debug mode. Note: <React.StrictMode> is enabled which will run effects twice each time they are rendered. This is to help find bugs in your code.`);

    /****************************************************************************************************************************
     *                             HANDLERS
     ****************************************************************************************************************************/

    /**
     * For debugging purposes only, when debug:true is passed in the initial data, this will log all clicks
     * So you can see in the log what was clicked before other log output shows up
     * Saves to the history state so you can see it in the UI
     * @param {Event} e
     */
    const onClickCapture = e => {
      if (!debug) return;
      logDebug(`Root`, ` User ${e.type}-ed on "${e.target.outerText}" (${e.target.tagName}.${e.target.className})`);
      // Note: cannot setHistory because the page will refresh and any open dropdown will close, so let's just temp store it until we can write it
      tempSavedClicksRef.current.push({
        date: new Date().toLocaleDateString(),
        msg: `UI_CLICK ${e.type} ${e.target.outerText}`
      });
    };

    /**
     * Dispatcher for child components to update the master data object or show a banner message.
     * @param {'SET_TITLE'|'[SET|UPDATE]_DATA'|'SHOW_BANNER'} action - The action type to dispatch.
     * @param {any} data - The data associated with the action.
     * @param {string} [actionDescriptionForLog] - Optional description of the action for logging purposes.
     */
    // eslint-disable-next-line no-unused-vars
    const dispatch = (action, data, actionDescriptionForLog) => {
      // const desc = `${action}${actionDescriptionForLog ? `: ${actionDescriptionForLog}` : ''}`
      // logDebug(`Root`,`Received dispatch request: "${desc}", data=${JSON.stringify(data, null, 2)}`)
      // data.lastUpdated = { msg: desc, date: new Date().toLocaleString() }
      const event = new MessageEvent('message', {
        data: {
          type: action,
          payload: data
        }
      });
      onMessageReceived(event);
      // onMessageReceived({ data: { type: action, payload: data } }) // dispatch the message to the reducer
    };

    /**
     * Ignore messages that have nothing to do with the plugin
     * @param {Event} event
     * @returns {boolean}
     */
    const shouldIgnoreMessage = event => {
      const {
        /* origin, source, */data
      } = event;
      // logDebug(
      //   `Root: shouldIgnoreMessage origin=${origin} source=${source} data=${JSON.stringify(data)} data.source=${
      //     data?.source
      //   } /react-devtools/.test(data?.source=${/react-devtools/.test(data?.source)}}`,
      // )
      return typeof data === 'string' && data?.startsWith('setImmediate$') || typeof data === 'object' && data?.hasOwnProperty('iframeSrc') || typeof data === 'object' && typeof data?.source === 'string' && /react-devtools/.test(data?.source);
    };

    /**
     * Replaces a stylesheet's content with a new stylesheet string.
     * @param {string} oldName - The name or href of the stylesheet to be replaced.
     * @param {string} newStyles - The new stylesheet string.
     */
    function replaceStylesheetContent(oldName, newStyles) {
      // Convert the styleSheets collection to an array
      const styleSheetsArray = Array.from(document.styleSheets);

      // TODO: trying to replace a stylesheet that was loaded as part of the HTML page
      // yields error: "This CSSStyleSheet object was not constructed by JavaScript"
      // So unless we change the way this works to install the initial stylesheet in the HTML page,
      // this approach won't work, so for now, we are going to add it as another stylesheet
      // Find the stylesheet with the specified name or href
      const oldSheet = styleSheetsArray.find(sheet => sheet && sheet.title === oldName);
      let wasSaved = false;
      // $FlowIgnore
      if (oldSheet && typeof oldSheet.replaceSync === 'function') {
        // Use replaceSync to replace the stylesheet's content
        logDebug(`Root`, `replaceStylesheetContent: found existing stylesheet "${oldName}" Will try to replace it.`);
        try {
          // $FlowIgnore
          oldSheet.replaceSync(newStyles);
          wasSaved = true;
        } catch (error) {
          logError(`Root`, `Swapping "${oldName}" CSS Failed. replaceStylesheetContent: Error ${JSP(formatReactError(error))}`);
        }
      }
      if (!wasSaved) {
        // If the old stylesheet is not found, create a new one
        const newStyle = document.createElement('style');
        newStyle.title = oldName;
        newStyle.textContent = newStyles;
        document?.head?.appendChild(newStyle);
        // Check to make sure it's there
        testOutputStylesheets();
        const styleElement = document.querySelector(`style[title="${oldName}"]`);
        if (styleElement) {
          logDebug('CHANGE_THEME replaceStylesheetContent: VERIFIED: CSS has been successfully added to the document');
        } else {
          logDebug("CHANGE_THEME replaceStylesheetContent: CSS has apparently NOT been added. Can't find it in the document");
        }
      }
    }

    // Function to get the first 55 characters of each stylesheet's content
    function testOutputStylesheets() {
      const styleSheets = document.styleSheets;
      for (let i = 0; i < styleSheets.length; i++) {
        const styleSheet = styleSheets[i];
        try {
          // $FlowIgnore
          const rules = styleSheet.cssRules || styleSheet.rules;
          let cssText = '';
          // $FlowIgnore
          for (let j = 0; j < rules.length; j++) {
            // $FlowIgnore
            cssText += rules[j].cssText;
            if (cssText.length >= 55) break;
          }
          logDebug(`CHANGE_THEME StyleSheet ${i}: "${styleSheet.title ?? ''}": ${cssText.substring(0, 55).replace(/\n/g, '')}`);
        } catch (e) {
          console.warn(`Unable to access stylesheet: ${styleSheet.href}`, e);
        }
      }
    }

    /**
     * This is effectively a reducer we will use to process messages from the plugin
     * And also from components down the tree, using the dispatch command
     */
    const onMessageReceived = event => {
      const {
        data
      } = event;
      // console.log(`Root: onMessageReceived ${event.type} data: ${JSON.stringify(data, null, 2)}`)
      if (!shouldIgnoreMessage(event) && data) {
        // const str = JSON.stringify(event, null, 4)
        try {
          // $FlowFixMe
          const {
            type,
            payload
          } = event.data; // remember: event is on prototype and not JSON.stringify-able
          if (!type) throw `onMessageReceived: event.data.type is undefined`, event.data;
          if (!payload) throw `onMessageReceived: event.data.payload is undefined`, event.data;
          if (type && payload) {
            // logDebug(`Root`, ` onMessageReceived: ${type}`)
            // logDebug(`Root`, ` onMessageReceived: payload:${JSON.stringify(payload, null, 2)}`)
            if (!payload.lastUpdated) payload.lastUpdated = {
              msg: '(no msg)'
            };
            // Spread existing state into new object to keep it immutable
            // TODO: ideally, you would use a reducer here
            if (type === 'SHOW_BANNER') {
              if (payload.lastUpdated?.msg) {
                payload.lastUpdated.msg += `: ${payload.msg}`;
              } else {
                logDebug(`Root`, ` onMessageReceived: payload.lastUpdated.msg is undefined: payload.lastUpdated:${payload.lastUpdated} payload.lastUpdated.msg:${payload.lastUpdated.msg}`);
              }
            }
            setHistory(prevData => [...prevData, ...tempSavedClicksRef.current, payload.lastUpdated]);
            tempSavedClicksRef.current = [];
            switch (type) {
              case 'SET_TITLE':
                // Note this works because we are using payload.title in npData
                document.title = payload.title;
                break;
              case 'SET_DATA':
              case 'UPDATE_DATA':
                setNPData(prevData => ({
                  ...prevData,
                  ...payload
                }));
                globalSharedData = {
                  ...globalSharedData,
                  ...payload
                };
                break;
              case 'CHANGE_THEME':
                {
                  const {
                    themeCSS
                  } = payload;
                  logDebug(`Root`, `CHANGE_THEME changing theme to "${themeCSS.substring(0, 55)}"...`);
                  replaceStylesheetContent('Updated Theme Styles', themeCSS);
                  break;
                }
              case 'SHOW_BANNER':
                if (npData.passThroughVars.lastWindowScrollTop) {
                  logDebug(`Root`, ` onMessageReceived: Showing banner, so we need to scroll the page up to the top so user sees it.`);
                  setNPData(prevData => {
                    prevData.passThroughVars.lastWindowScrollTop = 0;
                    return {
                      ...prevData,
                      ...payload
                    };
                  });
                }
                showBanner(payload.msg, payload.color, payload.border);
                break;
              case 'SEND_TO_PLUGIN':
                sendToPlugin(payload);
                break;
              case 'RETURN_VALUE' /* function called returned a value */:
                // $FlowIgnore
                // setMessageFromPlugin(payload)
                break;
              default:
                break;
            }
          } else {
            logDebug(`Root`, ` onMessageReceived: called but event.data.type and/or event.data.payload is undefined`, event);
          }
        } catch (error) {
          logDebug(`Root`, ` onMessageReceived: error=${JSP(formatReactError(error))}`);
        }
      }
    };

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
    const sendToPlugin = React__default["default"].useCallback(([action, data, additionalDetails = '']) => {
      const returnPluginCommand = globalSharedData.returnPluginCommand || 'undefined';
      if (returnPluginCommand === 'undefined' || !returnPluginCommand?.command || !returnPluginCommand?.id) {
        throw 'returnPluginCommand variable is not passed correctly to set up comms bridge. Check your data object which you are sending to invoke React';
      }
      if (!returnPluginCommand?.command) throw 'returnPluginCommand.cmd is not defined in the intial data passed to the plugin';
      if (!returnPluginCommand?.id) throw 'returnPluginCommand.id is not defined in the intial data passed to the plugin';
      if (!action) throw new Error('sendToPlugin: command/action must be called with a string');
      // logDebug(`Root`, ` sendToPlugin: ${JSON.stringify(action)} ${additionalDetails}`, action, data, additionalDetails)
      if (!data) throw new Error('sendToPlugin: data must be called with an object');
      // logDebug(`Root`, ` sendToPlugin: command:${action} data=${JSON.stringify(data)} `)
      const {
        command,
        id
      } = returnPluginCommand; // this comes from the initial data passed to the plugin
      runPluginCommand(command, id, [action, data, additionalDetails]);
    }, [globalSharedData]);

    /**
     * Callback passed to child components that allows them to put a message in the banner
     * This function should not be called directly by child components, but rather via the dispatch function dispatch('SHOW_BANNER', payload)
     */
    const showBanner = (msg, color = 'w3-pale-red', border = 'w3-border-red') => {
      const warnObj = {
        warn: true,
        msg,
        color,
        border
      };
      setWarning(warnObj);
    };

    /**
     * handle click on X on banner to hide it
     */
    const hideBanner = () => {
      setWarning({
        warn: false,
        msg: '',
        color: 'w3-pale-red',
        border: 'w3-border-red'
      });
    };

    /**
     * For debugging purposes, send a message to the plugin to test the comms bridge
     */
    const testCommsBridge = () => {
      logDebug(`Root`, ` _Root: testCommsBridge`);
      // send some info to the plugin
      // first param is the action type and the rest are data (can be any form you want)
      // data.foo = 'bar'
      sendMessageToPlugin(['commsBridgeTest', 'some sample', 'data passed']);
    };

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
      logDebug(`Root`, `\n===================\nPROFILING:${id} phase=${phase} actualDuration=${actualDuration} baseDuration=${baseDuration} startTime=${startTime} commitTime=${commitTime} ${String(interactions)}\n===================\n`);
    }

    /****************************************************************************************************************************
     *                             EFFECTS
     ****************************************************************************************************************************/

    /**
     * window listener for messages from the plugin
     */
    React$1.useEffect(() => {
      // the name of this function is important. it corresponds with the Bridge call in the HTMLView
      // I don't recommend changing this function name here or in the bridge
      window.addEventListener('message', onMessageReceived);
      return () => window.removeEventListener('message', onMessageReceived);
    }, []);

    /**
     * Save scrollbar position
     * When the data changes, console.log it so we know and scroll the window
     * Fires after components draw
     */
    React$1.useEffect(() => {
      if (npData?.passThroughVars?.lastWindowScrollTop !== undefined && npData.passThroughVars.lastWindowScrollTop !== window.scrollY) {
        // debug && logDebug(`Root`, ` FYI, underlying data has changed, picked up by useEffect. Scrolling to ${String(npData.lastWindowScrollTop)}`)
        window.scrollTo(0, npData.passThroughVars.lastWindowScrollTop);
      }
    }, [npData]);

    // useEffect(() => {
    //   logDebug('Root', `Noticed a change in reactSettings: ${JSON.stringify(reactSettings)}`)
    // }, [reactSettings])

    /****************************************************************************************************************************
     *                             RENDER
     ****************************************************************************************************************************/

    return /*#__PURE__*/React__default["default"].createElement(ErrorBoundary, {
      FallbackComponent: ErrorFallback,
      onReset: () => {},
      onError: myErrorLogger
    }, /*#__PURE__*/React__default["default"].createElement("div", {
      className: "Root",
      onClickCapture: onClickCapture
    }, /*#__PURE__*/React__default["default"].createElement(MessageBanner, {
      warn: warning.warn,
      msg: warning.msg,
      color: warning.color,
      border: warning.border,
      hide: hideBanner
    }), logProfilingMessage ? /*#__PURE__*/React__default["default"].createElement(React$1.Profiler, {
      id: "MemoizedWebView",
      onRender: onRender
    }, /*#__PURE__*/React__default["default"].createElement(MemoizedWebView, {
      dispatch: dispatch,
      data: npData,
      reactSettings: reactSettings,
      setReactSettings: setReactSettings
    })) : /*#__PURE__*/React__default["default"].createElement(MemoizedWebView, {
      data: npData,
      dispatch: dispatch,
      reactSettings: reactSettings,
      setReactSettings: setReactSettings
    }), (debug) && /*#__PURE__*/React__default["default"].createElement(React__default["default"].StrictMode, null, /*#__PURE__*/React__default["default"].createElement("div", {
      className: "w3-container w3-red w3-margin-top"
    }, "Debugging Data (Plugin passed debug:true at window open)"), /*#__PURE__*/React__default["default"].createElement("div", null, /*#__PURE__*/React__default["default"].createElement("span", {
      id: "debugHistory"
    }, "History (most recent first):"), /*#__PURE__*/React__default["default"].createElement("ul", null, history.slice().reverse().map((h, i) => /*#__PURE__*/React__default["default"].createElement("li", {
      style: {
        fontSize: '12px'
      },
      key: i
    }, "[", h?.date || '', "]: ", h?.msg || ''))), /*#__PURE__*/React__default["default"].createElement("div", {
      className: "monospaceData"
    }, "globalSharedData: ", JSON.stringify(globalSharedData, null, 2))), /*#__PURE__*/React__default["default"].createElement("div", {
      className: "w3-button w3-black",
      onClick: () => dispatch('SHOW_BANNER', {
        msg: 'Banner test succeeded'
      })
    }, "Local Banner Display Test"), /*#__PURE__*/React__default["default"].createElement("div", {
      className: "w3-button w3-black",
      onClick: testCommsBridge
    }, "Test Communication Bridge"))));
  }

  exports.Root = Root;
  exports.logDebug = logDebug;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, react);
Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, RootBundle)
