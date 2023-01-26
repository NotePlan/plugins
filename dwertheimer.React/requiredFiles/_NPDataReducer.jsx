const NPDataContext = createContext()

const reducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_DATA':
      console.log('Reducer: NPData updated: ', action.payload)
      return {
        ...state,
        NPData: action.payload,
      }
    default:
      return {
        state,
      }
  }
}

const NPDataContextProvider = (props) => {
  const [state, dispatch] = useReducer(reducer, NPData) // in _App.jsx, NPData is defined as { latest: 'startup' }

  return <NPDataContext.Provider value={[state, dispatch]}>{props.children}</NPDataContext.Provider>
}
