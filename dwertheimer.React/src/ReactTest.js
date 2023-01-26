// @flow

import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { showHTMLWindow, getCallbackCodeString } from '@helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
const USE_MINIFIED_REACT = false
/**
 * reactTest
 * Plugin entrypoint for "/React Test"
 * @author @dwertheimer
 */

/**
 * Entrypoint for /React Test: Pops up an HTML window
 */
export function reactTest(): void {
  try {
    // development versions of react (better error messaging)
    const reactJSDev = `
        let exports = module.exports = {} // babel will try to find exports and module.exports, so we need to set them to something
        <script src="https://unpkg.com/react/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.js"></script>
    `
    // production versions of react (smaller file size)
    const reactJSmin = `
        let exports = module.exports = {} // babel will try to find exports and module.exports, so we need to set them to something
        <script src="https://unpkg.com/react/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    `
    const globalVars = `
    <script type="text/babel" >
      // set up global variables for React and ReactDOM
      const React = window.React;
      const ReactDOM = window.ReactDOM;
      const useState = React.useState;
    </script>
`
    // this is some initial data we will send to the HTML window
    // react will use this to populate the page
    const dataFromPlugin = {
      title: `David's todo list`,
      todos: ['code', 'eat', 'sleep', 'code', 'send something to jonathan'],
    }
    // don't edit this next block, it's just a way to send the data object to the HTML window
    const strDataFromPlugin = `
      <script type="text/babel" >
        const dataFromPlugin = ${JSON.stringify(dataFromPlugin)};
      </script>
    `

    const bodyHTML = `
    <div id="root"></div>
  ` // the body starts totally empty, but we're going to use React to populate it

    const appRootComponent = `
    <script type="text/babel" >
        // react must be type text/babel so babel knows to parse it 

        function App() {
          console.log("App is loading...")
          const [todos, setTodos] = useState(dataFromPlugin.todos)
          const [newTodo, setNewTodo] = useState("") 
      
          const handleChange = (event) => {
            setNewTodo(event.target.value)
          }
          const SaveNewTodo = () => {
            // send some info to the plugin
            // first param is the action type and the rest are data (can be any form you want)
            setTodos([...todos, newTodo])
            setNewTodo("")
            htmlToNPBridge(['todoWasAdded', newTodo])
          }
          return (
          <div className="App">
              <h1>{dataFromPlugin.title}</h1>
              { todos.length === 0 ? 
              <p>There are no todos</p>
              : 
              <div>
                  <p>You have {todos.length} Todos</p>
                  <ul>
                  {todos.map((todo,i) => {
                      return <li key={i}> {todo}</li>
                  } )}
                  </ul>
              </div>
              }
              <input type="text" value={newTodo} onChange={handleChange} placeholder="New Todo" />
              <button onClick={SaveNewTodo}>Add Todo</button>
          </div>
          );
      }
      
      // export default App;

      </script>
`
    const mountApp = `
      <script type="text/babel" >
          const container = document.getElementById('root');
          const root = ReactDOM.createRoot(container); 
          root.render(<App tab="home" />);
      </script>
`
    const returnPathName = 'NPToHTMLReturnPath'
    const htmlToNPBridge = getCallbackCodeString('htmlToNPBridge', pluginJson['plugin.id'], returnPathName)
    // note: the function name below needs to match the last param in the htmlToNPBridge function
    const returnedFromNoteplan = `
      <script type="text/babel" >
        async function ${returnPathName}(...args) {
          console.log('Function ${returnPathName} received from NP: ', args)
          // maybe do something with the data received from the plugin
        }
      </script>
    `

    // `<p>Test</p><button id="foo" onclick="htmlToNPBridge(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('React Test', bodyHTML, {
      savedFilename: 'test.ReactTest.html',
      preBodyScript: [USE_MINIFIED_REACT ? reactJSmin : reactJSDev, globalVars],
      postBodyScript: [htmlToNPBridge, returnedFromNoteplan, strDataFromPlugin, appRootComponent, mountApp],
    })
  } catch (error) {
    console.log(error)
  }
}
