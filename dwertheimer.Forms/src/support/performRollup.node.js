#!/usr/bin/node

/**
 * FormView Rollup Script
 *
 * Builds development and production modes for:
 * - WebView bundle
 *
 * Usage:
 *   node '/path/to/performRollup.node.js'
 *
 * Options:
 *   --react   Include the React core bundle
 *   --graph   Create the visualization graph
 *   --watch   Watch for changes
 */

const rollupReactScript = require('../../../scripts/rollup.generic.js')
const { rollupReactFiles, getCommandLineOptions, getRollupConfig } = rollupReactScript

//eslint-disable-next-line
;(async function () {
  const { watch, graph } = getCommandLineOptions()

  const rollupProms = []

  // FormView bundle configs
  const formViewRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'dwertheimer.Forms/src/support/rollup.FormView.entry.js',
      outputFilePath: 'dwertheimer.Forms/requiredFiles/react.c.FormView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'FormViewBundle',
    }),
  ]

  const formViewConfig = formViewRollupConfigs[0] // use only dev version for now
  rollupProms.push(rollupReactFiles(formViewConfig, watch, 'dwertheimer.Forms FormView Component development version'))

  // FormBuilderView bundle configs
  const formBuilderViewRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'dwertheimer.Forms/src/support/rollup.FormBuilderView.entry.js',
      outputFilePath: 'dwertheimer.Forms/requiredFiles/react.c.FormBuilderView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'FormBuilderViewBundle',
    }),
  ]

  const formBuilderViewConfig = formBuilderViewRollupConfigs[0] // use only dev version for now
  rollupProms.push(rollupReactFiles(formBuilderViewConfig, watch, 'dwertheimer.Forms FormBuilderView Component development version'))

  try {
    await Promise.all(rollupProms)
  } catch (error) {
    console.error('Error during rollup:', error)
  }
})()
