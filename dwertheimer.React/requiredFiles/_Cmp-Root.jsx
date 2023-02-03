// This is the root component of the React app
// YOU CAN WRITE THIS CODE LIKE IT'S A NORMAL JAVASCRIPT / REACT FILE
// Do not change the name of this Component
// It is the parent of all other components on the page
// TODO: https://blog.openreplay.com/lightweight-alternatives-to-redux/

// let NPData = { latest: 'startup' }

// globalSharedData is passed to window load time from the plugin, so you can use it for initial state
const ROOT_DEBUG = false

function Root() {
  if (!console['error']) console['error'] = console.log
  // the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
  // globalSharedData = { data: {}, lastUpdated:{ msg: "", date: date}  }
  console.log('_Root init: globalSharedData', globalSharedData)
  if (!globalSharedData) console.log('Root: globalSharedData is undefined', globalSharedData)
  const { data = null, lastUpdated = null } = globalSharedData // this is the global data
  if (!data) throw (`Root: globalSharedData.data is undefined`, globalSharedData)
  if (!lastUpdated) throw (`Root: globalSharedData.lastUpdated is undefined`, globalSharedData)

  if (!data.contextButtons?.length) {
    data.contextButtons = [
      { text: 'Mark Today', action: 'markToday' },
      { text: 'Mark Tomorrow', action: 'markTomorrow' },
    ]
  }

  const [npData, setNPData] = useState(data) // set it from initial data
  console.log(`Root1: lastUpdated=${JSON.stringify(lastUpdated)}`)
  const [lastUpdatedState, setLastUpdatedState] = useState(lastUpdated) // set it from initial data
  console.log(`Root1.5: lastUpdated=${JSON.stringify(lastUpdated)}`)
  const [warning, setWarning] = useState({ warn: false, msg: '', color: 'w3-pale-red' })

  // delete dataFromPlugin.startupData // remove the startupData from the object so we don't get confused. state is handled by React

  useEffect(() => {
    // This is effectively a reducer we will use to process messages from the plugin
    // do not change this function name
    function onMessageFromPlugin(event) {
      if (event?.data) {
        console.log(`onMessageFromPlugin: ${JSON.stringify(event)}`)
        try {
          const { type, payload } = event.data // remember: event is on prototype and not JSON.stringify-able
          if (!type) throw (`onMessageFromPlugin: event.data.type is undefined`, event.data)
          if (!payload) throw (`onMessageFromPlugin: event.data.payload is undefined`, event.data)
          if (type && payload) {
            console.log(`onMessageFromPlugin: ${JSON.stringify(event.data)}`)
            // Spread existing state into new object to keep it immutable
            // TODO: ideally, you would use a reducer here
            console.log(`Root2: lastUpdated=${JSON.stringify(lastUpdated)}`)
            console.log(`root payload.lastUpdated`, payload.lastUpdated)
            setLastUpdatedState((prevData) => ({ ...prevData, ...payload.lastUpdated }))
            console.log(`onMessageFromPlugin Action type: ${type || ''}`)
            switch (type) {
              case 'SET_TITLE':
                // Note this works because we are using payload.title in npData
                document.title = payload.title
                break
              case 'SET_DATA':
                console.log('before')
                setNPData((prevData) => ({ ...prevData, ...payload.data }))
                console.log('after')
                break
              case 'SHOW_BANNER':
                const warnObj = { warn: true, msg: payload.msg, color: payload.color ?? 'w3-pale-red', border: payload.border ?? 'w3-border-red' }
                console.log(`onMessageFromPlugin: SHOW_BANNER: sending: ${JSON.stringify(warnObj)}`)
                setWarning(warnObj)
                console.log(`onMessageFromPlugin: SHOW_BANNER: sent: ${JSON.stringify(warnObj)}`)
                break
              default:
                break
            }
          } else {
            console.log(`onMessageFromPlugin: called but event.data.type and/or event.data.payload is undefined`, event)
          }
        } catch (error) {
          console.log('onMessageFromPlugin: error=' + JSON.stringify(error))
        }
      } else {
        console.log(`onMessageFromPlugin: called but event.data is undefined: noop`)
      }
    }
    // the name of this function is important. it corresponds with the Bridge call in the HTMLView
    // I don't recommend changing this function name here or in the bridge
    window.addEventListener('message', onMessageFromPlugin)
    return () => window.removeEventListener('message', onMessageFromPlugin)
  }, [])

  const doSomething = () => {
    console.log(`_Root: doSomething`)
    // send some info to the plugin
    // first param is the action type and the rest are data (can be any form you want)
    data.foo = 'bar'
    sendMessageToPlugin(['commsBridgeTest', 'green', 'tea'])
  }
  const hideBanner = () => {
    setWarning({ warn: false, msg: '', color: 'w3-pale-red' })
  }

  /**
   * **************************************************
   */

  //  <h1>{npData.title}</h1>

  const myErrorLogger = (error: Error, info: { componentStack: string }) => {
    console.log(`ErrorBoundary got error: error=\n${JSON.stringify(error)},\ninfo=${JSON.stringify(info)}`)
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => {}} onError={myErrorLogger}>
      <div className="Root">
        <MessageBanner warn={warning.warn} msg={warning.msg} color={warning.color} border={warning.border} hide={hideBanner}></MessageBanner>
        <OverdueDataTable data={npData} />
        {ROOT_DEBUG && (
          <>
            <div onClick={doSomething}>Test Communication Bridge</div>
            <div onClick={() => runPluginCommand('onMessageFromHTMLView', 'dwertheimer.React', ['ranAPluginCommand', 'green', 'tea'])}>
              Test Generic RunPlugin Command (onMessageFromHTMLView,dwertheimer.React)
            </div>
            <div>
              <i style={{ fontSize: '12px' }}>
                Last Update: {lastUpdatedState.msg} ({lastUpdatedState.date})
              </i>
              <div className="monospaceData">globalSharedData: {JSON.stringify(data, null, 2)}</div>
              <div className="monospaceData">npData: {JSON.stringify(npData, null, 2)}</div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Root

/**
 * Basic button using w3.css
 * @param {*} props
 * @returns
 */
function Button(props) {
  const className = props.className ?? 'w3-btn w3-white w3-border w3-border-blue w3-round'
  return (
    <button className={className} {...props}>
      {props.children}
    </button>
  )
}

/**
 * Warning/message banner at top of page
 * Send a SHOW_BANNER message from the plugin with the following payload:
 * @param { warn, msg, color, border, hide } props
 * @returns
 */
function MessageBanner(props) {
  if (!props.warn) {
    return null
  }
  // onclick="this.parentElement.style.display='none'" class="w3-button w3-display-topright"
  console.log(`MessageBanner: props=${JSON.stringify(props)}`)
  const className = `w3-panel w3-display-container ${props.border ? 'w3-leftbar' : ''} ${props.border ?? 'w3-border-red'} ${props.color ?? 'w3-pale-red'}`
  window.scrollTo(0, 0)
  return (
    <React.StrictMode>
      <div className={className}>
        <span onClick={() => props.hide()} className="w3-button w3-display-right">
          X
        </span>
        <p>{props.msg}</p>
      </div>
    </React.StrictMode>
  )
}
