#!/usr/bin/node

/**
 * Combined Rollup Script
 *
 * Builds development and production modes for:
 * - Root component
 * - WebView bundle
 * - React core bundle (optional with --react)
 *
 * Usage:
 *   node '/path/to/performRollup.node.js'
 *
 * Options:
 *   --react   Include the React core bundle
 *   --graph   Create the visualization graph
 *   --watch   Watch for changes
 */

const rollupReactScript = require('../../../../scripts/rollup.generic.js')
const { rollupReactFiles, getCommandLineOptions, getRollupConfig } = rollupReactScript

//eslint-disable-next-line
;(async function () {
  const hasReact = process.argv.includes('--react')
  const { watch, graph } = getCommandLineOptions()

  const rollupProms = []

  // Root component configs
  const rootRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.root.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.Root.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'RootBundle',
    }),
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.root.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.Root.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'RootBundle',
    }),
  ]

  const rootConfig = {
    ...rootRollupConfigs[0],
    output: [rootRollupConfigs[0].output, rootRollupConfigs[1].output],
  }

  rollupProms.push(rollupReactFiles(rootConfig, watch, 'np.Shared Root Component development && production'))

  // FormView bundle configs
  const webViewRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.FormView.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.FormView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'WebViewBundle',
    }),
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.FormView.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.FormView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'WebViewBundle',
    }),
  ]

  const webViewConfig = {
    ...webViewRollupConfigs[0],
    output: [webViewRollupConfigs[0].output, webViewRollupConfigs[1].output],
  }

  rollupProms.push(rollupReactFiles(webViewConfig, watch, 'np.Shared WebView Component development && production'))

  if (hasReact) {
    const reactConfigs = [
      getRollupConfig({
        entryPointPath: 'np.Shared/src/react/reactForm/support/rollup.react.entry.js',
        outputFilePath: 'np.Shared/requiredFiles/react.core.REPLACEME.js',
        externalModules: [],
        createBundleGraph: graph,
        buildMode: 'development',
        bundleName: 'ReactCoreBundle',
      }),
      getRollupConfig({
        entryPointPath: 'np.Shared/src/react/support/rollup.react.entry.js',
        outputFilePath: 'np.Shared/requiredFiles/react.core.REPLACEME.js',
        externalModules: [],
        createBundleGraph: graph,
        buildMode: 'production',
        bundleName: 'ReactCoreBundle',
      }),
    ]

    rollupProms.push(rollupReactFiles(reactConfigs[0], watch, 'np.Shared REACT CORE development'))
    rollupProms.push(rollupReactFiles(reactConfigs[1], watch, 'np.Shared REACT CORE production'))
  }

  try {
    await Promise.all(rollupProms)
  } catch (error: any) {
    console.error('Error during rollup:', error)
  }
})()
