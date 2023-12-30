# React Skeleton

See [CHANGELOG](changelog.md) for latest updates/changes to this plugin.

## About This Code

This is a basic skeleton of a React app that can be used in a NotePlan plugin. 
1. Copy this whole directory 
1. Do a global find/replace inside the new plugin directory you created and replace:
  `dwertheimer.ReactSkeleton` with whatever the ID you want your new plugin to have. 
> **NOTE:**
> After the find/replace, you are advised to continue reading this README inside of your new plugin folder, because the commands/paths will have been updated for your new path
1. Build and test the code as detailed below (confirm everything works)
1. Then edit `reactMain.js` (the plugin-side code) and `WebView.jsx` (the HTML/React-side code) as you wish (See "Editing the Code" below)


> **NOTE:** There are some peculiarities of writing an app that uses React, so make sure to read this whole document

## Building the Code

There are two parts to this code:
1. The React code, which contains React components in the `src/react` folder, starting with `WebView.jsx` which will be the root of your React application. This code must be rolled up in order for it to be viewable in a NotePlan HTML window. You will roll this code up from the command line by opening up a separate terminal and running the command:
  `node ./dwertheimer.ReactSkeleton/src/react/support/performRollup.node.js --watch ` 
1. The plugin code in reactMain.js which is built (like every other plugin) by running a command like:
  `npc plugin:dev dwertheimer.ReactSkeleton -w`
1. Once both sides are built, the `/Test React Window` should open a window with interactivity

> **NOTE** 
> In the supplied example, when you invoke the `/Test React Window` command, you will see in `reactMain.js` that we are setting/passing the variable "debug:true" to the React window. This variable tells our React wrapper to display at the very bottom a log of the changes to the window and the current value of the window's data/variables which are used to draw the page. This section starts with a garish red bar to separate this section from the rest of your React window. This data is very helpful for debugging (to ensure the window has the data you expect). Change `debug` to 'false' prior to plugin release or when you want to see the page clean.

> **WARNING:**
> If you find yourself wondering why your changes are not being updated in the React window when running the plugin, it may be because you forgot to build the React code (you were just building the plugin code as normal). Always remember that there are two concurrent build processes (plugin & React) which need to be going at all times during your development.

> **NOTE:**
> The build process will create two versions of the plugin code -- minified (min) and non-minified (dev) in the requiredFiles folder. These files will allow you to release the plugin with those files in the requiredFiles, but they **should not** be committed to the github repo.

## Editing the code

## Plugin Code
The main plugin code that will invoke the React Window is in the file `src/reactMain.js`. This is the entrypoint to your plugin. This is also where the callback function is that will receive the calls back from the React view. Of course, these functions could be moved/renamed in `index.js`.

---

> **NOTE**
> THE REST OF THIS DOCUMENTATION NEEDS UPDATING. YOU CAN STOP READING HERE FOR NOW

## Invoking React Window


openReactWindow
This is the plugin function (name/jsFunction) used to create a React window with your data and React components.

Basic schematic of how opening a React window from a plugin using openReactWindow works:

InvokePlugin with globalSharedData & windowOptions
globalSharedData available as global var
Open Window with windowOptions
Load React and Root Component
YourPlugin
Gathers Data
invokes React
React Components
(<WebView> etc)
openReactWindow
Composes requisite information and loads window
globalSharedData
+ title
+ returnPluginCommand
+ componentPath
+ debug
+ ENV_MODE
...other plugin data
lastUpdated:(automatically set)
ReactWindow
Root component
WebView Component from YourPlugin componentPath
calls back to your plugin via returnPluginCommand() : passed
Compiling and Including the Components
Compiling
TODO: add instructions about how to rollup
This should output your rolled-together components in a single file in your requiredFiles folder

Including the Components in the Plugin
Add two lines matching the output filename in the plugin.json, e.g.:

  "plugin.requiredFiles": [
    ...
    "react.c.WebView.bundle.min.js",
    "react.c.WebView.bundle.dev.js"
    ...
  ],
NOTE: Note how the only difference in the filenames is "min" vs. "dev"
Once the files are listed in plugin.requiredFiles, any time they change, they will be copied to your plugin folder and also released when the plugin is released.

Passing Data at Start-up
Your plugin which invokes the React window does so by passing two variables to the following plugin command:

await DataStore.invokePluginCommandByName('openReactWindow', 'dwertheimer.React', [ globalSharedData, windowOptions ])

The two variables are:

a global data object which contains data to be passed to the components.
a window options variable which contains settings for the top-most HTML window -- allows you to set window size and pass additional CSS and any variables you would normally pass to launch an HTMLView window on your own.
The variable globalSharedData will be set globally when the window is opened. This is how you pass initial data to the React Tree. You pass your initial data like so:

const windowOptions = { width: 850, height: 950, specificCSS: ".foo { color: '#ddd' }" }
const globalSharedData =  { 
    /* required attributes */
    title: string, /* window title */
    returnPluginCommand: {command: "", id: ""} /* return actions sent to this plugin command */
    componentPath: string, /* path to your components */
    /* optional attributes */
    debug: boolean, /* whether to output globalData to HTML window for debugging */
    ENV_MODE: 'production' | 'development', /* 'development' mode connects to react devtools for debugging/profiling */  
    /* ... +any other data you want to be available to your react components */
}

await DataStore.invokePluginCommandByName('openReactWindow', 'dwertheimer.React', [globalSharedData,windowOptions])



<p data-line="96" class="sync-line" style="margin:0;"></p>

Window Options
In the windowOptions object, all fields are optional, but you can pass any variables included in HtmlWindowOptions below.

export type HtmlWindowOptions = {
  width?: number,
  height?: number,
  headerTags?: string,
  generalCSSIn?: string,
  specificCSS?: string,
  makeModal?: boolean,
  preBodyScript?: string | ScriptObj | Array<string | ScriptObj>,
  postBodyScript?: string | ScriptObj | Array<string | ScriptObj>,
  savedFilename?: string,
}


<p data-line="114" class="sync-line" style="margin:0;"></p>

globalSharedData: Required Fields
title: The title of the HTML window
returnPluginCommand: {id:string, command:string}: This is the NAME of the command and the ID of the plugin which the HTMLView will call with data. In theory, you could invoke multiple plugin commands, but it is much more clear if you have a single reducer function that gets called by the HTML window and then you can call the appropriate function from there. The convention will be to send a data payload to this function like [actionType:string,payload:{}], so you can switch based on the actionType
componentPath: string: This is the path to your rolled-up components, starting from the data/dwertheimer.React directory. So it will most likely be something like:
../../<your_plugin_name>/_jsxComponents-Bundle.min.js
NOTE
Included in your components bundle must be one component called WebView (exactly that), which is the outer wrapper for your React application.

globalSharedData: Optional Fields
debug: When debug is set to true, your global shared data values will output into the browser window.
ENV_MODE: 'development' mode connects to react devtools for debugging/profiling
windowOptions can be any of the options for HTML window opening. For instance, you can use this to set the height and width of the window or pass specific CSS to the window.

globalSharedData: Additional Fields
You can add any additional fields you want for data you want your WebView React Component to receive in the data object. You can name them anything you want except for the following fields which are populated automatically:

globalSharedData: Reseved Field Names
lastUpdated is automatically populated when the master data is updated
Your React Application
Your React application tree can look like whatever you want, but it needs to start (essentially your root component) with a component called WebView.

WebView
Your top-most app component must be an exported component called WebView.

Four props will be sent to your WebView component:

data - the global shared data
dispatch - the dispatcher to communicate data changes, communicate back with plugin, show banner message, etc.

With respect to the data from NotePlan, WebView is a "controlled" component, meaning the data that populates it is managed by the parent of WebView
So if you want to change the data object, you send a command:

dispatch('UPDATE_DATA', {...data,changesToData})


<p data-line="159" class="sync-line" style="margin:0;"></p>

This will change the data upstream and flow the new data down to your component tree.

If you want to show a warning message in blue at the top of the screen, you can send:

dispatch('SHOW_BANNER', {msg: 'hey there', color: blue, border: blue})


<p data-line="167" class="sync-line" style="margin:0;"></p>

NOTE: David probably removing these
sendToPlugin - a function which will call your specified plugin command (using the name/ID details which you passed in globalSharedData)
messageFromPlugin - this is a message that was received from the Plugin (after the window was opened, generally in response to a sendToPlugin call you made)
ackMessageFromPlugin - this is a callback you need to call to tell the parent that you have received the messageFromPlugin and it can be cleared
showBanner - a function you can use to display a message at the top of the screen (to show a banner, send the arguments: message, color, border to the showBanner function)

So a starter component would be be:

export function WebView({data, dispatch }) {
    
    function handleOnClick {
        dispatch('SHOW_BANNER',{msg:'hey somebody clicked',color:'blue'})
    }
    return <div onClick={handleOnClick}>Click Me!</div>
}


<p data-line="186" class="sync-line" style="margin:0;"></p>

Most likely, the WebView component should be where you do all the interaction with NotePlan and calling sendToPlugin commands. So if you have child components that need to interact with NotePlan, you should pass functions down from WebView in properties so they can bubble up requests for WebView to make.
v

Components Available to You
StatusButton
import StatusButton from './_Cmp-StatusButton.jsx'

<StatusButton rowID={row.id} initialState={row.type} 
onStatusChange={handleTaskStatusChange} 
style={{ color: `${NP_THEME.base.textColor} !important` }} />



<p data-line="200" class="sync-line" style="margin:0;"></p>

import debounce from 'lodash/debounce'
import React, { Component } from 'react'

Theme Colors
In your React Components, if you want to access the theme colors, they will be available to you in the global NP_THEME object which looks like the following. For example, to get the textColor in your current NotePlan theme, you would use NP_THEME.base.textColor.

/* Basic Theme as JS for CSS-in-JS use in scripts 
  Created from theme: "Toothpaste DARK Condensed dbw" */
  const NP_THEME={
    "editor": {
        "textColor": "#DAE3E8",
        "tintColor": "#E9C0A2",
        "timeBlockColor": "#E9C062",
        "menuItemColor": "#c5c5c0",
        "toolbarIconColor": "#c5c5c0",
        "tintColor2": "#73B3C0",
        "altColor": "#2E2F30",
        "backgroundColor": "#1D1E1F",
        "toolbarBackgroundColor": "#2E2F30"
    },
    "name": "Toothpaste DARK Condensed dbw",
    "style": "Dark",
    "base": {
        "backgroundColor": "#1D1E1F",
        "textColor": "#DAE3E8",
        "h1": "#CC6666",
        "h2": "#E9C062",
        "h3": "#E9C062",
        "h4": "#E9C062",
        "tintColor": "#E9C0A2",
        "altColor": "#2E2F30"
    }
}


<p data-line="237" class="sync-line" style="margin:0;"></p>

Your Receiving Function
You specified a function to be called back by the React Window in the original invoke command, e.g.

const globalSharedData =  { 
    ...
    returnPluginCommand: {command: "receiveDataFromReact", id: "my.plugin.id"} /* return actions sent to this plugin command */


<p data-line="247" class="sync-line" style="margin:0;"></p>

That function should receive the command and, like a reducer, switch based on the value of the first argument, e.g.

export async function onUserModifiedParagraphs(actionType: string, data: any) {
  try {
    logDebug(pluginJson, `NP Plugin return path (onUserModifiedParagraphs) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `onUserModifiedParagraphs data=`)
    let returnValue = {}
    switch (actionType) {
      case 'actionDropdown':
        returnValue = await dropdownChangeReceived(data) 
        break
      case 'paragraphUpdate':
        returnValue = await paragraphUpdateReceived(data) 
        break
      default:
        break
    }
    // at the end of your function, send an ack back to the webview that the info was received and processed
    // and of course you can send data back using the returnValue property
    sendToHTMLWindow('RETURN_VALUE', { type: actionType, payload: { dataSent: data, returnValue:returnValue } })
    return {} /* always return something on an invoke, but the return is not received by the html window */
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}


<p data-line="274" class="sync-line" style="margin:0;"></p>

Sending a Banner Message
From your plugin, you can send a banner message to be shown at the top of the HTML window:

TODO:Insert picture here

    import { sendBannerMessage } from '@helpers/HTMLView'

    await sendBannerMessage(
      `this will display at the top of the screen`,
      color: string = 'w3-pale-red', /* background color */
      border: string = 'w3-border-red'
    )


<p data-line="290" class="sync-line" style="margin:0;"></p>

Notes
symbolic link to output file in requiredFiles (or open up file server in the plugins dir)
sendToHTMLWindow in HTMLView to send a message to the open window (see message types)
updateGlobalSharedData in HTMLView to set global data after window is already up (generally discouraged...better to do this by - sending a message using sendToHTMLWindow('SET_DATA',newData) )
Mermaid cheatsheet: https://jojozhuang.github.io/tutorial/mermaid-cheat-sheet/
