#!/usr/bin/node

/**
 * Run this from zsh
 * (builds development mode by default)
        node '/Users/dwertheimer/Developer/Noteplan/np-plugins-freshstart-2022-08-21/dwertheimer.TaskAutomations/src/react/support/performRollup.node.js'  
    add --production to build production mode
        node '/Users/dwertheimer/Developer/Noteplan/np-plugins-freshstart-2022-08-21/dwertheimer.TaskAutomations/src/react/support/performRollup.node.js' --production 
 --graph to create the visialization graph
 --watch to watch for changes
 */
const rollupReactScript = require('../../../../scripts/rollup.generic.js')
const { rollupReactFiles, getCommandLineOptions, getRollupConfig } = rollupReactScript

;(async function () {
  const rootPath = '../../../../'
  const buildMode = process.argv.includes('--production') ? 'production' : 'development'
  const watch = process.argv.includes('--watch')
  const graph = process.argv.includes('--graph')

  const rollupConfigs = [
    /** TaskAutomations WebView app - build both dev and production each time */
    getRollupConfig({
      entryPointPath: 'dwertheimer.TaskAutomations/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'dwertheimer.TaskAutomations/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'WebViewBundle',
    }),
    getRollupConfig({
      entryPointPath: 'dwertheimer.TaskAutomations/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'dwertheimer.TaskAutomations/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'WebViewBundle',
    }),
  ]
  // create one single base config with two output options
  const config = { ...rollupConfigs[0], ...{ output: [rollupConfigs[0].output, rollupConfigs[1].output] } }
  // console.log(JSON.stringify(config, null, 2))
  await rollupReactFiles(config, watch, 'TaskAutomations: development && production')
  // const rollupsProms = rollups.map((obj) => rollupReactFiles({ ...obj, buildMode }, watch, buildMode))
})()
