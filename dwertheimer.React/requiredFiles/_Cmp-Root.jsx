// This is the root component of the React app
// YOU CAN WRITE THIS CODE LIKE IT'S A NORMAL JAVASCRIPT / REACT FILE
// Do not change the name of this Component
// It is the parent of all other components on the page
// TODO: https://blog.openreplay.com/lightweight-alternatives-to-redux/

// let NPData = { latest: 'startup' }

// globalSharedData is passed to window load time from the plugin, so you can use it for initial state
const ROOT_DEBUG = true

function Root() {
  // the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
  // globalSharedData = { data: {}, lastUpdated:{ msg: "", date: date}  }
  console.log('_Root init: globalSharedData', globalSharedData)
  const { data, lastUpdated } = globalSharedData // this is the global data
  if (!data) throw 'Root: globalSharedData.data is undefined'
  const [npData, setNPData] = useState(data) // set it from initial data
  const [lastUpdatedState, setLastUpdatedState] = useState(lastUpdated) // set it from initial data
  const [warning, setWarning] = useState({ warn: false, msg: '', color: 'w3-pale-red' })

  // delete dataFromPlugin.startupData // remove the startupData from the object so we don't get confused. state is handled by React

  useEffect(() => {
    // This is effectively a reducer we will use to process messages from the plugin
    // do not change this function name
    function onMessageFromPlugin(event) {
      if (event.data) {
        try {
          const { type, payload } = event.data // remember: event is on prototype and not JSON.stringify-able
          console.log(`onMessageFromPlugin: ${JSON.stringify(event.data)}`)
          // Spread existing state into new object to keep it immutable
          // TODO: ideally, you would use a reducer here
          setLastUpdatedState((prevData) => ({ ...prevData, ...payload.lastUpdated }))
          console.log(`onMessageFromPlugin Action type: ${type}`)
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

  return (
    <ErrorBoundary>
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
 * React Component to catch errors in the React tree and display a message
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    // logErrorToMyService(error, errorInfo)
    this.setState({ error, errorInfo, hasError: true })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      console.log('ErrorBoundary: received error. fallback UI: error=' + JSON.stringify(this.state))
      return (
        <React.StrictMode>
          <h1>Oops! Something went wrong during React render.</h1>
          Better check the console.log
          <div className="monospaceData">Error: {JSON.stringify(this.state.error, null, 2)}</div>
          <hr></hr>
          <div className="monospaceData">ErrorInfo: {JSON.stringify(this.state.errorInfo)}</div>
        </React.StrictMode>
      )
    }

    return this.props.children
  }
}

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
