var RootBundle = (function (exports, React$1) {
  'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var React__default = /*#__PURE__*/_interopDefaultLegacy(React$1);

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
   * Formats log output to include timestamp pluginId, pluginVersion
   * @author @codedungeon
   * @param {any} pluginInfo
   * @param {any} message
   * @param {string} type
   * @returns {string}
   */
  function log(pluginInfo, message = '', type = 'INFO') {
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
    let userLogLevel = 1;
    const pluginSettings = typeof DataStore !== 'undefined' ? DataStore.settings : null;
    // this was the main offender.  Perform a null change against a value that is `undefined` will be true
    // sure wish NotePlan would not return `undefined` but instead null, then the previous implementataion would not have failed
    if (pluginSettings && pluginSettings.hasOwnProperty('_logLevel')) {
      // eslint-disable-next-line
      userLogLevel = pluginSettings['_logLevel'];
    }
    const userLogLevelIndex = LOG_LEVELS.indexOf(userLogLevel);
    if (thisMessageLevel >= userLogLevelIndex) {
      console.log(msg);
    }
    return msg;
  }

  /**
   * Formats log output as WARN to include timestamp pluginId, pluginVersion
   * @author @dwertheimer
   * @param {any} pluginInfo
   * @param {any} message
   * @returns {void}
   */
  function logDebug$1(pluginInfo, message = '') {
    return log(pluginInfo, message, 'DEBUG');
  }

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

  // color this component's output differently in the console
  const consoleStyle = 'background: #222; color: #62AFEC';
  const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args);

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

    const [npData, setNPData] = React__default["default"].useState(globalSharedData); // set it from initial data
    const [warning, setWarning] = React__default["default"].useState({
      warn: false,
      msg: '',
      color: 'w3-pale-red'
    });
    // const [setMessageFromPlugin] = React.useState({})
    const [history, setHistory] = React__default["default"].useState([lastUpdated]);
    const tempSavedClicksRef = React__default["default"].useRef([]); //temporarily store the clicks in the webview

    /****************************************************************************************************************************
     *                             VARIABLES
     ****************************************************************************************************************************/

    const MemoizedWebView = /*#__PURE__*/React__default["default"].memo(WebView);
    // const Profiler = React.Profiler
    debug && logDebug(`Root: Running in Debug mode. Note: <React.StrictMode> is enabled which will run effects twice each time they are rendered. This is to help find bugs in your code.`);

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
      logDebug(`Root: User ${e.type}-ed on "${e.target.outerText}" (${e.target.tagName}.${e.target.className})`);
      // Note: cannot setHistory because the page will refresh and any open dropdown will close, so let's just temp store it until we can write it
      tempSavedClicksRef.current.push({
        date: new Date().toLocaleDateString(),
        msg: `UI_CLICK ${e.type} ${e.target.outerText}`
      });
    };

    /**
     * handler/dispatcher for child components to update the master data object or show a banner message
     * @param {'SET_TITLE'|'[SET|UPDATE]_DATA'|'SHOW_BANNER'} action
     * @param {any} data
     * @param {string} - description of this action for logging
     */
    const dispatch = (action, data, actionDescriptionForLog = '') => {
      // console.log(`Root: Received dispatch request: "${desc}", data=${JSON.stringify(data, null, 2)}`)
      // data.lastUpdated = { msg: desc, date: new Date().toLocaleString() }
      new MessageEvent('message', {
        type: action,
        payload: data
      });
      onMessageReceived({
        data: {
          type: action,
          payload: data
        }
      }); // dispatch the message to the reducer
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
            logDebug(`Root: onMessageReceived: ${type}`);
            // logDebug(`Root: onMessageReceived: payload:${JSON.stringify(payload, null, 2)}`)
            // Spread existing state into new object to keep it immutable
            // TODO: ideally, you would use a reducer here
            if (type === 'SHOW_BANNER') payload.lastUpdated.msg += `: ${payload.msg}`;
            setHistory(prevData => [...prevData, ...tempSavedClicksRef.current, payload.lastUpdated]);
            tempSavedClicksRef.current = [];
            // logDebug(`Root: onMessageReceived reducer Action type: ${type || ''} payload: ${JSON.stringify(payload, null, 2)}`)
            switch (type) {
              case 'SET_TITLE':
                // Note this works because we are using payload.title in npData
                document.title = payload.title;
                break;
              case 'SET_DATA':
              case 'UPDATE_DATA':
                // logDebug('Root: SET_DATA before')
                setNPData(prevData => ({
                  ...prevData,
                  ...payload
                }));
                globalSharedData = {
                  ...globalSharedData,
                  ...payload
                };
                logDebug('Root: SET_DATA after setting globalSharedData=', globalSharedData);
                break;
              case 'SHOW_BANNER':
                showBanner(payload.msg, payload.color, payload.border);
                // const warnObj = { warn: true, msg: payload.msg, color: payload.color ?? 'w3-pale-red', border: payload.border ?? 'w3-border-red' }
                // logDebug(`Root: onMessageReceived: SHOW_BANNER: sending: ${JSON.stringify(warnObj)}`)
                // setWarning(warnObj)
                // logDebug(`Root: onMessageReceived: SHOW_BANNER: sent: ${JSON.stringify(warnObj)}`)
                break;
              case 'SEND_TO_PLUGIN':
                logDebug(`Root: onMessageReceived: SEND_TO_PLUGIN: payload ${JSON.stringify(payload, null, 2)}`);
                sendToPlugin(payload);
                break;
              case 'RETURN_VALUE' /* function called returned a value */:
                logDebug(`Root: onMessageReceived: processing payload`);
                // $FlowIgnore
                // setMessageFromPlugin(payload)
                break;
              default:
                break;
            }
          } else {
            logDebug(`Root: onMessageReceived: called but event.data.type and/or event.data.payload is undefined`, event);
          }
        } catch (error) {
          logDebug(`Root: onMessageReceived: error=${JSON.stringify(error)}error=${JSON.stringify(error)}`);
        }
      }
    };

    /**
     * send runplugin command (specified in globalData) to NotePlan to process data
     * This function should not be called directly by child components, but rather via the dispatch function dispatch('SEND_TO_PLUGIN', payload)
     * returnPluginCommand var with {command && id} should be sent in the initial data payload in HTML
     * @param {Array<any>} args to send to NotePlan (typically an array with two items: ["actionName",{an object payload, e.g. row, field, value}])
     * @example sendToPlugin({ choice: action, rows: selectedRows })
     *
     */
    const sendToPlugin = React__default["default"].useCallback(args => {
      const returnPluginCommand = globalSharedData.returnPluginCommand || 'undefined';
      if (returnPluginCommand === 'undefined' || !returnPluginCommand?.command || !returnPluginCommand?.id) {
        throw 'returnPluginCommand variable is not passed correctly to set up comms bridge. Check your data object which you are sending to invoke React';
      }
      if (!returnPluginCommand?.command) throw 'returnPluginCommand.cmd is not defined in the intial data passed to the plugin';
      if (!returnPluginCommand?.id) throw 'returnPluginCommand.id is not defined in the intial data passed to the plugin';
      const {
        command,
        id
      } = returnPluginCommand; // this comes from the initial data passed to the plugin
      runPluginCommand(command, id, args);
    }, []);

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
      logDebug(`Root: showBanner: sending: ${JSON.stringify(warnObj)}`);
      setWarning(warnObj);
    };

    /**
     * handle click on X on banner to hide it
     */
    const hideBanner = () => {
      setWarning({
        warn: false,
        msg: '',
        color: 'w3-pale-red'
      });
    };

    /**
     * For debugging purposes, send a message to the plugin to test the comms bridge
     */
    const testCommsBridge = () => {
      logDebug(`Root: _Root: testCommsBridge`);
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
      logDebug(`\n===================\nPROFILING:${id} phase=${phase} actualDuration=${actualDuration} baseDuration=${baseDuration} startTime=${startTime} commitTime=${commitTime} ${String(interactions)}\n===================\n`);
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
      data: npData
      /*
        sendToPlugin={sendToPlugin}
        messageFromPlugin={messageFromPlugin}
        ackMessageFromPlugin={ackMessageFromPlugin}
        showBanner={showBanner}
        */
    })) : /*#__PURE__*/React__default["default"].createElement(MemoizedWebView, {
      data: npData,
      dispatch: dispatch
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
      }, `banner test`)
    }, "Local Banner Display Test"), /*#__PURE__*/React__default["default"].createElement("div", {
      className: "w3-button w3-black",
      onClick: testCommsBridge
    }, "Test Communication Bridge"))));
  }

  exports.Root = Root;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, react);
Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, RootBundle)
