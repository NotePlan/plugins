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
  // dbw: note to self: at some point, we can delete the production version of the Root component
  // because it's not used anywhere -- dev seems to work fine
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

  // dbw commenting out minified version for now. not worth the extra build step
  // const rootConfig = {
  //   ...rootRollupConfigs[0],
  //   output: [rootRollupConfigs[0].output, rootRollupConfigs[1].output],
  // }
  const rootConfig = rootRollupConfigs[0] // use only dev version for now

  rollupProms.push(rollupReactFiles(rootConfig, watch, 'np.Shared Root Component development version'))

  // FormView bundle configs
  const formViewRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.FormView.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.FormView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'FormViewBundle',
    }),
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.FormView.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.FormView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'FormViewBundle',
    }),
  ]

  // dbw commenting out minified version for now. not worth the extra build step
  // const formViewConfig = {
  //   ...formViewRollupConfigs[0],
  //   output: [formViewRollupConfigs[0].output, formViewRollupConfigs[1].output],
  // }
  const formViewConfig = formViewRollupConfigs[0] // use only dev version for now

  rollupProms.push(rollupReactFiles(formViewConfig, watch, 'np.Shared FormView Component development version'))

  // dbw note to self: I don't think we need this anymore. It's not ever called with --react I don't think.
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
  } catch (error) {
    console.error('Error during rollup:', error)
  }
})()
