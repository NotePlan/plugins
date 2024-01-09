var RootBundle = (function (exports, React$1) {
	'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var React__default = /*#__PURE__*/_interopDefaultLegacy(React$1);

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var reactErrorBoundary_umd = {exports: {}};

	(function (module, exports) {
	(function (global, factory) {
	  factory(exports, React__default["default"]) ;
	})(commonjsGlobal, (function (exports, React) {
	  function _interopNamespace(e) {
	    if (e && e.__esModule) return e;
	    var n = Object.create(null);
	    if (e) {
	      Object.keys(e).forEach(function (k) {
	        if (k !== 'default') {
	          var d = Object.getOwnPropertyDescriptor(e, k);
	          Object.defineProperty(n, k, d.get ? d : {
	            enumerable: true,
	            get: function () { return e[k]; }
	          });
	        }
	      });
	    }
	    n["default"] = e;
	    return Object.freeze(n);
	  }

	  var React__namespace = /*#__PURE__*/_interopNamespace(React);

	  function _setPrototypeOf(o, p) {
	    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
	      o.__proto__ = p;
	      return o;
	    };

	    return _setPrototypeOf(o, p);
	  }

	  function _inheritsLoose(subClass, superClass) {
	    subClass.prototype = Object.create(superClass.prototype);
	    subClass.prototype.constructor = subClass;
	    _setPrototypeOf(subClass, superClass);
	  }

	  var changedArray = function changedArray(a, b) {
	    if (a === void 0) {
	      a = [];
	    }

	    if (b === void 0) {
	      b = [];
	    }

	    return a.length !== b.length || a.some(function (item, index) {
	      return !Object.is(item, b[index]);
	    });
	  };

	  var initialState = {
	    error: null
	  };

	  var ErrorBoundary = /*#__PURE__*/function (_React$Component) {
	    _inheritsLoose(ErrorBoundary, _React$Component);

	    function ErrorBoundary() {
	      var _this;

	      for (var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++) {
	        _args[_key] = arguments[_key];
	      }

	      _this = _React$Component.call.apply(_React$Component, [this].concat(_args)) || this;
	      _this.state = initialState;

	      _this.resetErrorBoundary = function () {
	        var _this$props;

	        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
	          args[_key2] = arguments[_key2];
	        }

	        _this.props.onReset == null ? void 0 : (_this$props = _this.props).onReset.apply(_this$props, args);

	        _this.reset();
	      };

	      return _this;
	    }

	    ErrorBoundary.getDerivedStateFromError = function getDerivedStateFromError(error) {
	      return {
	        error: error
	      };
	    };

	    var _proto = ErrorBoundary.prototype;

	    _proto.reset = function reset() {
	      this.setState(initialState);
	    };

	    _proto.componentDidCatch = function componentDidCatch(error, info) {
	      var _this$props$onError, _this$props2;

	      (_this$props$onError = (_this$props2 = this.props).onError) == null ? void 0 : _this$props$onError.call(_this$props2, error, info);
	    };

	    _proto.componentDidUpdate = function componentDidUpdate(prevProps, prevState) {
	      var error = this.state.error;
	      var resetKeys = this.props.resetKeys; // There's an edge case where if the thing that triggered the error
	      // happens to *also* be in the resetKeys array, we'd end up resetting
	      // the error boundary immediately. This would likely trigger a second
	      // error to be thrown.
	      // So we make sure that we don't check the resetKeys on the first call
	      // of cDU after the error is set

	      if (error !== null && prevState.error !== null && changedArray(prevProps.resetKeys, resetKeys)) {
	        var _this$props$onResetKe, _this$props3;

	        (_this$props$onResetKe = (_this$props3 = this.props).onResetKeysChange) == null ? void 0 : _this$props$onResetKe.call(_this$props3, prevProps.resetKeys, resetKeys);
	        this.reset();
	      }
	    };

	    _proto.render = function render() {
	      var error = this.state.error;
	      var _this$props4 = this.props,
	          fallbackRender = _this$props4.fallbackRender,
	          FallbackComponent = _this$props4.FallbackComponent,
	          fallback = _this$props4.fallback;

	      if (error !== null) {
	        var _props = {
	          error: error,
	          resetErrorBoundary: this.resetErrorBoundary
	        };

	        if ( /*#__PURE__*/React__namespace.isValidElement(fallback)) {
	          return fallback;
	        } else if (typeof fallbackRender === 'function') {
	          return fallbackRender(_props);
	        } else if (FallbackComponent) {
	          return /*#__PURE__*/React__namespace.createElement(FallbackComponent, _props);
	        } else {
	          throw new Error('react-error-boundary requires either a fallback, fallbackRender, or FallbackComponent prop');
	        }
	      }

	      return this.props.children;
	    };

	    return ErrorBoundary;
	  }(React__namespace.Component);

	  function withErrorBoundary(Component, errorBoundaryProps) {
	    var Wrapped = function Wrapped(props) {
	      return /*#__PURE__*/React__namespace.createElement(ErrorBoundary, errorBoundaryProps, /*#__PURE__*/React__namespace.createElement(Component, props));
	    }; // Format for display in DevTools


	    var name = Component.displayName || Component.name || 'Unknown';
	    Wrapped.displayName = "withErrorBoundary(" + name + ")";
	    return Wrapped;
	  }

	  function useErrorHandler(givenError) {
	    var _React$useState = React__namespace.useState(null),
	        error = _React$useState[0],
	        setError = _React$useState[1];

	    if (givenError != null) throw givenError;
	    if (error != null) throw error;
	    return setError;
	  }
	  /*
	  eslint
	    @typescript-eslint/sort-type-union-intersection-members: "off",
	    @typescript-eslint/no-throw-literal: "off",
	    @typescript-eslint/prefer-nullish-coalescing: "off"
	  */

	  exports.ErrorBoundary = ErrorBoundary;
	  exports.useErrorHandler = useErrorHandler;
	  exports.withErrorBoundary = withErrorBoundary;

	  Object.defineProperty(exports, '__esModule', { value: true });

	}));

	}(reactErrorBoundary_umd, reactErrorBoundary_umd.exports));

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

	const ErrorFallback = ({
	  error,
	  resetErrorBoundary
	}) => {
	  return /*#__PURE__*/React.createElement("div", {
	    role: "alert"
	  }, /*#__PURE__*/React.createElement("h1", null, "Something went wrong in React:"), /*#__PURE__*/React.createElement("pre", null, error.message), /*#__PURE__*/React.createElement("button", {
	    onClick: resetErrorBoundary
	  }, "Try again"));
	};

	/****************************************************************************************************************************
	 *                             ROOT COMPONENT
	 ****************************************************************************************************************************/

	// color this component's output differently in the console
	const consoleStyle = 'background: #222; color: #62AFEC';
	const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args);
	const logSubtle = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args);

	// used by the ErrorBoundary component
	const myErrorLogger = (error, info) => {
	  console.log(`%cRoot: ErrorBoundary got error: error=\n${JSON.stringify(error)},\ninfo=${JSON.stringify(info)}`, 'background: #ff0000; color: #ffffff');
	};

	/****************************************************************************************************************************
	 *                             globalSharedData
	 ****************************************************************************************************************************/

	// this is the global data object that is passed from the plugin in JS
	// the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
	// globalSharedData = { data: {}, returnPluginCommand: {command: "", id: ""}
	const {
	  lastUpdated = null,
	  returnPluginCommand = {},
	  debug = false,
	  ENV_MODE
	} = globalSharedData;
	if (typeof globalSharedData === 'undefined' || !globalSharedData) logDebug('Root: Root: globalSharedData is undefined', globalSharedData);
	if (typeof globalSharedData === 'undefined') throw globalSharedData;
	if (typeof globalSharedData.lastUpdated === 'undefined') throw `Root: globalSharedData.lastUpdated is undefined`;
	function Root(props) {
	  /****************************************************************************************************************************
	   *                             HOOKS
	   ****************************************************************************************************************************/

	  const [npData, setNPData] = React__default["default"].useState(globalSharedData); // set it from initial data
	  const [warning, setWarning] = React__default["default"].useState({
	    warn: false,
	    msg: '',
	    color: 'w3-pale-red'
	  });
	  const [messageFromPlugin, setMessageFromPlugin] = React__default["default"].useState({});
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
	    logDebug(`Root: onClickCapture: ${e.target.tagName} ${e.target.className}`);
	    logDebug(`Root: onClickCapture ${e.type} ${e.target.outerText} e=`, e);
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
	    const desc = `${action}${actionDescriptionForLog ? `: ${actionDescriptionForLog}` : ''}`;
	    data.lastUpdated = {
	      msg: desc,
	      date: new Date().toLocaleString()
	    };
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
	      origin,
	      source,
	      data
	    } = event;
	    // logDebug(
	    //   `Root: shouldIgnoreMessage origin=${origin} source=${source} data=${JSON.stringify(data)} data.source=${
	    //     data?.source
	    //   } /react-devtools/.test(data?.source=${/react-devtools/.test(data?.source)}}`,
	    // )
	    return typeof data === 'string' && data?.startsWith('setImmediate$') || typeof data === 'object' && data?.hasOwnProperty('iframeSrc') || /react-devtools/.test(data?.source);
	  };

	  /**
	   * This is effectively a reducer we will use to process messages from the plugin
	   * And also from components down the tree, using the dispatch command
	   */
	  const onMessageReceived = event => {
	    const {
	      data
	    } = event;
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
	          logDebug(`Root: onMessageReceived: ${type} payload:${JSON.stringify(payload, null, 2)}`);
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
	              sendToPlugin(payload);
	              break;
	            case 'RETURN_VALUE' /* function called returned a value */:
	              //FIXME: changing this prop is forcing refresh of all children, resetting data
	              // same is true for message banner
	              logDebug(`Root: onMessageReceived: processing payload`);
	              setMessageFromPlugin(payload);
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
	    logSubtle(`\n===================\nPROFILING:${id} phase=${phase} actualDuration=${actualDuration} baseDuration=${baseDuration} startTime=${startTime} commitTime=${commitTime}\n===================\n`);
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

	  return /*#__PURE__*/React__default["default"].createElement(reactErrorBoundary_umd.exports.ErrorBoundary, {
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
	  }), debug ? /*#__PURE__*/React__default["default"].createElement(React$1.Profiler, {
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
