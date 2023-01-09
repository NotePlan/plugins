// This is the root component of the React app
// Do not change the name of this Component
// It is the parent of all other components on the page
function App() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')

  const handleChange = (event) => {
    setNewTodo(event.target.value)
    console.log('foo2')
  }
  const SaveNewTodo = () => {
    setTodos([...todos, newTodo])
    setNewTodo('')
  }
  return (
    <div className="App">
      <h1>Todos List</h1>
      {todos.length === 0 ? (
        <p>There are no todos</p>
      ) : (
        <div>
          <p>You have {todos.length} Todos</p>
          <ul>
            {todos.map((todo) => {
              return <li key={todo}>- {todo}</li>
            })}
          </ul>
        </div>
      )}
      <input type="text" value={newTodo} onChange={handleChange} placeholder="New Todo" />
      <button onClick={SaveNewTodo}>Add Todo</button>
    </div>
  )
}

export default App
