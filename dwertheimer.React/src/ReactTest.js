// @flow

import pluginJson from '../plugin.json'
import { showHTMLWindow, getCallbackCodeString } from '@helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
const USE_MINIFIED_REACT = true
/**
 * reactTest
 * Plugin entrypoint for "/React Test"
 * @author @dwertheimer
 */

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} key
 * @param {*} defaultValue
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function reactTest(): void {
  try {
    /* minified versions per: https://reactjs.org/docs/add-react-to-a-website.html
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    */
    const cb = getCallbackCodeString('htmlToNPBridge', pluginJson['plugin.id'])
    const reactJSmin = `
        <script src="https://unpkg.com/react/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    `
    const reactJSDev = `
        <script src="https://unpkg.com/react/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.js"></script>
    `
    const reactApp = `
        <script>var exports = {};</script>
        <!-- this line is required for babel to not die: https://bobbyhadz.com/blog/typescript-uncaught-referenceerror-exports-is-not-defined -->
        <!-- react must be type text/babel so babel knows to parse it -->
        <script type="text/babel" >
            window.onerror = (msg, url, line, column, error) => {
                const message = {
                message: msg,
                url: url,
                line: line,
                column: column,
                error: JSON.stringify(error)
                }
            
                if (window.webkit) {
                window.webkit.messageHandlers.error.postMessage(message);
                } else {
                console.log("Error:", message);
                }
            };
            const React = window.React;
            const ReactDOM = window.ReactDOM;
            const useState = React.useState;
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
    // `<p>Test</p><button id="foo" onclick="htmlToNPBridge(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('Test', bodyHTML, {
      savedFilename: 'test.ReactTest.html',
      preBodyScript: `${USE_MINIFIED_REACT ? reactJSmin : reactJSDev}`,
      postBodyScript: `<script type="text/javascript">${cb}</script>\n${reactApp}`,
    })
  } catch (error) {
    console.log(error)
  }
}

/**
 * htmlToNPBridge
 * Plugin entrypoint for "/htmlToNPBridge (callback from html)"
 * @author @dwertheimer
 */
export async function htmlToNPBridge(...incoming: string) {
  try {
    console.log('htmlToNPBridge')
    clo(incoming, `htmlToNPBridge::incoming`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
