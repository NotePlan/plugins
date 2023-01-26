// This is the root component of the React app
// YOU CAN WRITE THIS CODE LIKE IT'S A NORMAL JAVASCRIPT / REACT FILE
// Do not change the name of this Component
// It is the parent of all other components on the page
// TODO: https://blog.openreplay.com/lightweight-alternatives-to-redux/

// let NPData = { latest: 'startup' }

// globalSharedData is passed to window load time from the plugin, so you can use it for initial state

function App() {
  // the globalSharedData object is passed at window load time from the plugin, so you can use it for initial state
  const dataFromPlugin = globalSharedData.data
  const [newTodo, setNewTodo] = useState('')
  const [npData, setNPData] = useState(dataFromPlugin) // set it from initial data
  const [todosOld, setTodos] = useState(dataFromPlugin.startupData.todos)
  const todos = globalSharedData.data.startupData.todos // this is the global data
  // delete dataFromPlugin.startupData // remove the startupData from the object so we don't get confused. state is handled by React

  useEffect(() => {
    function onMessageFromPlugin(event) {
      const { type, payload } = event.data
      console.log(`onMessageFromPlugin: ${JSON.stringify(event.data)}`)
      // Spread existing state into new object to keep it immutable
      // TODO: ideally, you would use a reducer here
      setNPData((prevData) => ({ ...prevData, ...payload }))
      switch (type) {
        case 'SET_TITLE':
          // Note this works because we are using payload.title in npData
          console.log(`SET_TITLE: ${payload.title}`)
          break

        default:
          break
      }
    }
    window.addEventListener('message', onMessageFromPlugin)
    return () => window.removeEventListener('message', onMessageFromPlugin)
  }, [])

  const handleChange = (event) => {
    setNewTodo(event.target.value)
    console.log('Todo changed to: ', event.target.value)
  }

  const SaveNewTodo = () => {
    console.log(`todos: ${todos?.length} newTodo: ${newTodo}`)
    setTodos([...todos, newTodo]) //TODO: remove this and have the plugin make the change to global data
    setNewTodo('')
    // send some info to the plugin
    // first param is the action type and the rest are data (can be any form you want)
    sendMessageToPlugin(['todoWasAdded', newTodo])
  }
  return (
    <div className="App">
      <h1>{npData.title}</h1>
      {todos.length === 0 ? (
        <p>There are no todos</p>
      ) : (
        <div>
          <p>You have {todos.length} Todos</p>
          <ul>
            {todos.map((todo, i) => {
              return <li key={i}> {todo}</li>
            })}
          </ul>
        </div>
      )}
      <input type="text" value={newTodo} onChange={handleChange} placeholder="New Todo" />
      <button onClick={SaveNewTodo}>Add Todo</button>
      <div>
        <i>
          Last Update: {npData.lastUpdated.msg} {npData.lastUpdated.date}
        </i>
        <h4>globalSharedData: {JSON.stringify(npData)}</h4>
      </div>
    </div>
  )
}

export default App
