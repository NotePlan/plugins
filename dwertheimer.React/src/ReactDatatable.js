// @flow

import pluginJson from '../plugin.json'
import { showHTMLWindow, getCallbackCodeString } from '@helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
const USE_MINIFIED_REACT = false
/**
 * reactTest
 * Plugin entrypoint for "/React Test"
 * @author @dwertheimer
 */

// FIXME: THIS DOES NOT WORK. THE REACT PART LOADS FINE, BUT I CAN'T GET THE DATA TABLE TO LOAD

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} key
 * @param {*} defaultValue
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function reactDataTest(): void {
  try {
    /* minified versions per: https://reactjs.org/docs/add-react-to-a-website.html
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    */
    const cb = getCallbackCodeString('callbackTest', pluginJson['plugin.id'])
    const reactJSmin = `
        <script src="./react.production.min.js"></script>
        <script src="./react-dom.production.min.js"></script>
        <script src="./babel.min.js"></script>
        <script type="text/babel" src="./styled-components.min.js"></script>
        <script type="text/babel" src="./react-data-table-component.umd.js"></script>
    `
    const reactJSOnline = `
      <script type="text/javascript" src="https://unpkg.com/react/umd/react.development.js" crossorigin></script>
      <script type="text/javascript" src="https://unpkg.com/react-dom/umd/react-dom.development.js" crossorigin></script>
      <script type="text/javascript" src="https://unpkg.com/@babel/standalone/babel.js" crossorigin></script>
      <script type="text/javascript" src="https://unpkg.com/react-is@18.2.0/umd/react-is.production.min.js" crossorigin></script>
      <script type="text/babel">
        // set global vars that components expect
        const React = window.React;
        const ReactDOM = window.ReactDOM;
      </script>
      <script type="text/babel" src="https://unpkg.com/styled-components@4.3.2/dist/styled-components.js" crossorigin></script>
      <script type="text/babel" src="https://unpkg.com/react-data-table-component@1.6.0/dist/react-data-table-component.umd.js" crossorigin></script>
    `

    // const reactJSDev = `
    //     <script src="https://unpkg.com/react/umd/react.development.js"></script>
    //     <script src="https://unpkg.com/react-dom/umd/react-dom.development.js"></script>
    //     <script src="https://unpkg.com/@babel/standalone/babel.js"></script>
    // `
    const reactApp = `
        <script>var exports = {};</script>
        <!-- this line is required for babel to not die: https://bobbyhadz.com/blog/typescript-uncaught-referenceerror-exports-is-not-defined -->
        <!-- react must be type text/babel so babel knows to parse it -->
        <script type="text/babel" >
            const styled = window.styled;

            const useState = React.useState;
            const DataTable = window.DataTable;

            const columns = [
              {
                  name: 'Title',
                  selector: row => row.title,
              },
              {
                  name: 'Year',
                  selector: row => row.year,
              },
          ];
          
          const data = [
              {
                  id: 1,
                  title: 'Beetlejuice',
                  year: '1988',
              },
              {
                  id: 2,
                  title: 'Ghostbusters',
                  year: '1984',
              },
          ]

            function App() {
                const [todos, setTodos] = useState([])
                const [newTodo, setNewTodo] = useState("") 
            
                const handleChange = (event) => {
                setNewTodo(event.target.value)
                }
                const SaveNewTodo = () => {
                setTodos([...todos, newTodo])
                setNewTodo("")
                }
                return (
                <div className="App">
                <DataTable
                    columns={columns}
                    data={data}
                />
                    <h1>Todo List</h1>
                    { todos.length === 0 ? 
                    <p>There are no todos</p>
                    : 
                    <div>
                        <p>You have {todos.length} Todos</p>
                        <ul>
                        {todos.map((todo) => {
                            return <li key={todo}>- {todo}</li>
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

            // new mounting method for React18+
            const container = document.getElementById('root');
            const root = ReactDOM.createRoot(container); 
            root.render(<App tab="home" />);

        </script>
    `
    const bodyHTML = `
     <div id="root"></div>
   `
    // `<p>Test</p><button id="foo" onclick="callbackTest(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('Test', bodyHTML, {
      savedFilename: 'test.ReactTest-DataTable.html',
      preBodyScript: `${USE_MINIFIED_REACT ? reactJSmin : reactJSOnline}`,
      postBodyScript: `<script type="text/javascript">${cb}</script>\n${reactApp}`,
    })
  } catch (error) {
    console.log(error)
  }
}

/**
 * callbackTest
 * Plugin entrypoint for "/callbackTest (callback from html)"
 * @author @dwertheimer
 */
export async function callbackTest(...incoming: string) {
  try {
    console.log('callbackTest')
    clo(incoming, `callbackTest::incoming`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
