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
    // put underscore in front of all requiredFiles filenames so they visually stay together in the plugin folder
    // the files live in the 'requiredFiles' folder in the plugin dev directory but are copied to the plugin root
    // because NotePlan does not allow for subfolders in the plugin root
    const reactJSmin = `
        <script src="./_react.production.min.js"></script>
        <script src="./_react-dom.production.min.js"></script>
        <script src="./_babel.min.js"></script>
        <script type="text/babel" src="./_App.jsx"></script>
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
    // set up bridge to NP
    const cb = getCallbackCodeString('htmlToNPBridge', pluginJson['plugin.id'])

    // `<p>Test</p><button id="foo" onclick="htmlToNPBridge(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('Test', bodyHTML, {
      savedFilename: 'ReactTest-local.html',
      preBodyScript: [`${USE_MINIFIED_REACT ? reactJSmin : reactJSmin}`],
      postBodyScript: [cb, reactApp],
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
