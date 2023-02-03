// @flow

//TODO:
//TODO: I am here: https://www.freecodecamp.org/news/state-manage ment-with-react-hooks/
//TODO: Babel complaining about 500KB can be suppressed, but doesn't matter: https://stackoverflow.com/questions/35192796/babel-note-the-code-generator-has-deoptimised-the-styling-of-app-js-as-it-exc
//    ... or https://babeljs.io/docs/en/babel-standalone configuration

// useReducer in app and at window level

import { getSharedOptions } from '../../dwertheimer.TaskAutomations/src/NPTaskScanAndProcess'
import pluginJson from '../plugin.json'
import { showHTMLWindow, getCallbackCodeString, getThemeJS } from '@helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

const USE_MINIFIED_REACT = false
const LOAD_REACT_DEVTOOLS = true // for debugging in local browser using react devtools
const USE_PREACT_INSTEAD = false

const ReactDevToolsImport = `<script src="http://localhost:8097"></script>`

/**
 * Open DataTable Plugin
 * Plugin entrypoint for "/testOpenDataTable"
 * @author @dwertheimer
 */
export async function testOpenDataTable(incoming: string) {
  try {
    /**
     * NOTE: w/r/t column list, you can't pass functions to the HTML window, so we'll need to pass selectorName and map it to a function (selector)
     */

    const startData = {
      title: `Overdue Task Review`,
      overdueParas: [
        { filename: 'foo.md', title: 'Foo Doc', content: 'This is an overdue task', priority: 1, type: 'open', lineIndex: 4 },
        { filename: 'foo.md', title: 'Foo Doc', content: 'And This is some other overdue', priority: 2, type: 'checklist', lineIndex: 7 },
        {
          filename: 'long.md',
          title: 'Long content',
          content: `Some long text: Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`,
          priority: 2,
          type: 'checklist',
          lineIndex: 22,
        },
      ],

      dropdownOptionsAll: getSharedOptions(),
      dropdownOptionsLine: getSharedOptions(),
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
    }
    clo(startData, `reactLocal.testOpenDataTable() startData`)
    await openParagraphTableView('testOpenDataTable', startData)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * reactTest
 * Plugin entrypoint for "/React openParagraphTableView"
 * Note: Paragraph data should be sent in after making static copies -- see dev.js : createStaticArray()
 * @author @dwertheimer
 */
export function openParagraphTableView(type: string = '', data: any = null): void {
  try {
    console.log(`reactLocal.openParagraphTableView() type: "${type}"`)
    //TODO: launch something different depending on type
    // 'overdueTasksReview' comes from Task Automations
    /*************************************************************************
     * COPY THIS WHOLE FILE BUT YOU SHOULD ONLY NEED TO EDIT THIS TOP SECTION
     *************************************************************************/

    // this is some initial data we will send to the HTML window
    // react will use this to populate the page
    // but this object becomes our global shared data store
    // that the plugin can write to and the HTML App can access
    // we will try not to update this object directly, but instead
    // use message passing
    // should always have a lastUpdated field so we can see when the data was last updated on the HTML side
    const globalSharedData = {
      data: data ?? {
        title: `Test of React/Data Table in NP Plugin`,
        overdueParas: [{ filename: 'foo.md', content: 'This is come content', priority: 1, type: 'open' }],
        dropdownOptionsAll: getSharedOptions(),
        dropdownOptionsLine: getSharedOptions(),
        /* the following commands really need to be sent by the plugin calling */
        returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
      },
      lastUpdated: { msg: 'Initial data load', date: new Date().toLocaleString() },
    }

    /*************************************************************************
     * YOU SHOULD NOT NEED TO EDIT ANYTHING BELOW THIS LINE
     *************************************************************************/

    // Load all components in the plugin.json file that end in '.jsx
    const components = pluginJson['plugin.requiredFiles']?.filter((f) => f.endsWith('.jsx'))
    // Load all CSS files in the plugin.json file that end in '.css
    const css = pluginJson['plugin.requiredFiles']?.filter((f) => f.endsWith('.css'))

    // put underscore in front of all requiredFiles filenames so they visually stay together in the plugin folder
    // the files live in the 'requiredFiles' folder in the plugin dev directory but are copied to the plugin root
    // because NotePlan does not allow for subfolders in the plugin root
    // FIXME: THIS ROLLUP DOES NOT WORK YET. THE CONFIG SEEMS TO NEED
    const reactJSmin = `
      <script src="./_${USE_PREACT_INSTEAD ? 'p' : ''}reactBundle.min.js"></script>
      <script src="./_babel.min.js"></script>
    `
    // used browserify to create these files from the react and react-dom npm packages
    // see notes inside the file ./requiredFiles/browserify.createReactBundle.js
    const reactJSDev = `
     <!-- Load React ReactDOM Babel -->
        <script src="./_${USE_PREACT_INSTEAD ? 'p' : ''}reactBundle.js"></script>
        <script src="./_babel.min.js"></script>
        <script> console.log("after react bundle")</script>
        `

    const componentsStr = components.reduce((acc, cur) => {
      return `${acc}\t\t<script type="text/babel" src="./${cur}"></script>\n`
    }, '\n')

    const reactComponents = `     
        <!-- Load React Functions Used by Components -->
        <script type="text/babel"> const { useState, useEffect, useReducer, createContext, useContext, useRef, useMemo } = React; </script>
        <!-- Load React Components -->
          ${componentsStr}
        <script> console.log("after components")</script>
        `

    const cssTags = css.reduce((acc, cur) => {
      return `${acc}\t\t<link rel="stylesheet" href="./${cur}">\n`
    }, '\n')

    const themeJS = getThemeJS()
    // clo(themeJS, `themeJS`)
    const bodyHTML = `
    <div id="root">
      <div id="spinner" class="container" style="background-color: ${themeJS?.values?.editor?.backgroundColor ?? '#ffffff'}">
        <div class="loading" style="background-color: ${themeJS?.values?.editor?.tintColor ?? '#000000'}"></div>
        <p class="loading-text">Searching & Preparing Your Data...</p>
      </div>
    </div>
  `
    const exports = ` const exports = {}; 
    const module = {exports}; ` //babel will look for these and complain if they are not there

    const globalVars = USE_PREACT_INSTEAD
      ? ''
      : `
        <!-- Global Variables -->
        <script type="text/javascript" >
          // set up global variables for React and ReactDOM
          const React = require('react'); // require works because of browserify
          const react = React;
          const ReactDOM = require('react-dom');
          console.log("end of globalVars")
        </script>`

    // don't edit this next block, it's just a way to send the plugin data object to the HTML window
    // at the time of the HTML window creation
    // globalSharedData is a global variable in the HTML window
    const globalSharedDataScriptStr = `
      <script type="text/javascript" >
        console.log('Setting globalSharedData:' + JSON.stringify(globalSharedData));
        globalSharedData = ${JSON.stringify(globalSharedData)};
      </script>
    `
    const mountApp = `
      <script type="text/babel" >
        ${
          USE_PREACT_INSTEAD
            ? `
            const dom = document.getElementById('root');
            Preact.render(<Root tab="home" />, dom); `
            : `
          const container = document.getElementById('root');
          const root = ReactDOM.createRoot(container); 
          root.render(<Root tab="home" />); `
        }
      </script>
`
    // set up bridge to NP
    const returnPathName = 'NPToHTMLReturnPath'
    const runPluginCommandFunction = getCallbackCodeString('runPluginCommand') // generic function to run any plugin command
    const sendMessageToPluginFunction = `
      const sendMessageToPlugin = (args) => runPluginCommand('onMessageFromHTMLView', '${pluginJson['plugin.id']}', args);
    `
    // note: the function name below needs to match the last param in the onMessageFromHTMLView function
    // note: at this time, the API does not send back any arguments, just fires the function (pretty useless)
    // so we can use this as an ack but not for data
    // so we are getting data back through runJavascript (sendToHTMLView function)
    const ackFromNoteplan = `
      <script type="text/babel" >
        async function ${returnPathName}(args) {
          console.log('Function ${returnPathName} received from NP:' + JSON.stringify(args))
          // maybe do something with the data received from the plugin
        }
      </script>
    `

    // `<p>Test</p><button id="foo" onclick="onMessageFromHTMLView(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`
    showHTMLWindow('Overdue Tasks', bodyHTML, {
      includeCSSAsJS: true,
      savedFilename: 'reactLocal.html',
      headerTags: [cssTags].join('\n') /* needs to be a string */,
      preBodyScript: [
        LOAD_REACT_DEVTOOLS ? ReactDevToolsImport : '',
        exports,
        USE_MINIFIED_REACT ? reactJSmin : reactJSDev,
        globalVars,
        globalSharedDataScriptStr,
        reactComponents,
      ],
      postBodyScript: [sendMessageToPluginFunction, runPluginCommandFunction, ackFromNoteplan, mountApp],
      /* specificCSS: additionalCSS, */
    })
    logDebug(`openParagraphTableView: ----------------------------------------`)
  } catch (error) {
    console.log(error)
  }
}
