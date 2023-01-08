function App() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')

  const handleChange = (event) => {
    setNewTodo(event.target.value)
  }
  const SaveNewTodo = () => {
    setTodos([...todos, newTodo])
    setNewTodo('')
  }
  return (
    <div className="App">
      <h1>Todo List</h1>
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
