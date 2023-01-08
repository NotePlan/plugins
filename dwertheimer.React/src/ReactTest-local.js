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
export function reactTestLocal(): void {
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
        <script type="text/babel" src="./App.jsx"></script>
    `
    // const reactJSDev = `
    //     <script src="https://unpkg.com/react/umd/react.development.js"></script>
    //     <script src="https://unpkg.com/react-dom/umd/react-dom.development.js"></script>
    //     <script src="https://unpkg.com/@babel/standalone/babel.js"></script>
    // `

    const bodyHTML = `
    <div id="root"></div>
  `

    const reactApp = `
        <script>var exports = {};</script>
        <!-- this above line is required for babel to not die: https://bobbyhadz.com/blog/typescript-uncaught-referenceerror-exports-is-not-defined -->
        <!-- react must be type text/babel so babel knows to parse it -->
        <script type="text/babel" >
            const React = window.React;
            const ReactDOM = window.ReactDOM;
            const useState = React.useState;

            // new mounting method for React18+
            const container = document.getElementById('root');
            const root = ReactDOM.createRoot(container); 
            root.render(<App tab="home" />);

        </script>
    `
    // `<p>Test</p><button id="foo" onclick="callbackTest(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('Test', bodyHTML, {
      savedFilename: 'test.ReactTest-local.html',
      preBodyScript: `${USE_MINIFIED_REACT ? reactJSmin : reactJSmin}`,
      postBodyScript: [cb, reactApp],
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
