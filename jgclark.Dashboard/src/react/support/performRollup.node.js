#!/usr/bin/node

/**
 * Run this from the shell
 * (builds development mode by default)
        node 'jgclark.Dashboard/src/react/support/performRollup.node.js'
 --graph to create the visialization graph
 --watch to watch for changes
 */
const rollupReactScript = require('../../../../scripts/rollup.generic.js')
const { rollupReactFiles, getRollupConfig } = rollupReactScript

;(async function () {
  const buildMode = process.argv.includes('--production') ? 'production' : 'development'
  const watch = process.argv.includes('--watch')
  const graph = process.argv.includes('--graph')

  const rollupConfigs = [
    /** WebView app - build both dev and production each time */
    getRollupConfig({
      entryPointPath: 'jgclark.Dashboard/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'jgclark.Dashboard/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'WebViewBundle',
      cssNameSpace: '' /* will prefix all css selectors with this so that these styles always win even if Root has same styles */,
    }),
    getRollupConfig({
      entryPointPath: 'jgclark.Dashboard/src/react/support/rollup.WebView.entry.js',
      outputFilePath: 'jgclark.Dashboard/requiredFiles/react.c.WebView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'WebViewBundle',
      cssNameSpace: '' /* will prefix all css selectors with this so that these styles always win even if Root has same styles */,
    }),
  ]
  // create one single base config with two output options
  // const config = { ...rollupConfigs[0], ...{ output: [rollupConfigs[0].output, rollupConfigs[1].output] } }
  const config = { ...rollupConfigs[0], ...{ output: buildMode === 'production' ? [rollupConfigs[0].output, rollupConfigs[1].output] : [rollupConfigs[0].output] } }
  // console.log(JSON.stringify(config, null, 2))
  await rollupReactFiles(config, watch, `jgclark.Dashboard: development ${buildMode === 'production' ? `&& production` : ''}`)
  // const rollupsProms = rollups.map((obj) => rollupReactFiles({ ...obj, buildMode }, watch, buildMode))
})().catch((error) => {
  console.error('A rollup error occurred:', error)
})
