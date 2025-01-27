# React Skeleton

See [CHANGELOG](changelog.md) for latest updates/changes to this plugin.

## About This Code

This is a basic skeleton of a Dashboard React app . 

1. Build and test the code as detailed below (confirm everything works)
1. Then edit `reactMain.js` (the plugin-side code) and `Dashboard.jsx` and other components in the src/react/components directory (the HTML/React-side code) as you wish (See "Editing the Code" below)


> **NOTE:** There are some peculiarities of writing an app that uses React, so make sure to read this whole document

## Building the Code

There are four parts to this code that need to be watched/rebuilt as you develop.
I open these side-by-side in a terminal in VSCode.
1. The React code, which contains React components in the `src/react` folder, starting with `WebView.jsx` which will be the root of your React application. This code must be rolled up in order for it to be viewable in a NotePlan HTML window. You will roll this code up from the command line by opening up a separate terminal and running the command:
  `node ./jgclark.Dashboard/src/react/support/performRollup.node.js --watch`
1. The plugin code in reactMain.js which is built (like every other plugin) by running a command like:
  `npc plugin:dev jgclark.Dashboard -w`
1. Supporting React Root and other components in np.Shared plugin. To build this:
  `node ./np.Shared/src/react/support/performRollup.node.js --watch`
1. Supporting plugin-side code, imported into Dashboard through `plugin.requiredFiles` key in `plugin.json`:
  `npc plugin:dev np.Shared -w`
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

```mermaid
graph TD
    WebView --> AppProvider
    AppProvider --> Dashboard
    Dashboard --> Header
    Dashboard --> Section
    Section --> ItemGrid
    ItemGrid --> ItemRow
    Section --> AddButtons
    Header --> Button
    AddButtons --> Button
  ```