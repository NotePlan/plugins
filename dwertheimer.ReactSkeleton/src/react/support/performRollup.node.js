#!/usr/bin/node

/**
 * Run this from the shell
 * (builds development mode by default)
        node 'dwertheimer.ReactSkeleton/src/react/support/performRollup.node.js'
 --graph to create the visialization graph
 --watch to watch for changes
 */
const rollupReactScript = require('../../../../scripts/rollup.generic.js')
const { rollupReactFiles, getRollupConfig } = rollupReactScript

;(async function () {
  // const buildMode = process.argv.includes('--production') ? 'production' : 'development'
  const watch = process.argv.includes('--watch')
  const graph = process.argv.includes('--graph')

  const rollupConfigs = [
    /** WebView app - build both dev and production each time */
    getRollupConfig({
      entryPointPath: 'dwertheimer.ReactSkeleton/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'dwertheimer.ReactSkeleton/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'WebViewBundle',
      cssNameSpace: '' /* add a class namespace that will be in the top level of your component if you want to avoid conflicts with Root styles */,
    }),
    getRollupConfig({
      entryPointPath: 'dwertheimer.ReactSkeleton/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'dwertheimer.ReactSkeleton/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'WebViewBundle',
      cssNameSpace: '' /* add a namespace if you want to avoid conflicts with Root styles */,
    }),
  ]
  // create one single base config with two output options
  const config = { ...rollupConfigs[0], ...{ output: [rollupConfigs[0].output, rollupConfigs[1].output] } }

  await rollupReactFiles(config, watch, 'dwertheimer.ReactSkeleton: development && production')
  // const rollupsProms = rollups.map((obj) => rollupReactFiles({ ...obj, buildMode }, watch, buildMode))
})().catch((error) => {
  console.error('A rollup error occurred:', error)
})
