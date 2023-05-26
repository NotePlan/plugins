#!/usr/bin/node
// DBW: just copied this file here. needs to be edited
/**
 * Run this from zsh
 *
 *  * (builds development mode by default)
    add --production to build production mode

   By default, builds Root component only:
    node '/Users/dwertheimer/Developer/Noteplan/np-plugins-freshstart-2022-08-21/np.Shared/src/react/support/performRollup.node.js'  
  
    To bundle react core also, add --react
        node '/Users/dwertheimer/Developer/Noteplan/np-plugins-freshstart-2022-08-21/np.Shared/src/react/support/performRollup.node.js'  --react

 --graph to create the visialization graph
 --watch to watch for changes
 */
const rollupReactScript = require('../../../../scripts/rollup.generic.js')
const { rollupReactFiles, getCommandLineOptions, getRollupConfig } = rollupReactScript

let BUNDLE_REACT_ALSO = false

;(async function () {
  const rootPath = '../../../../'

  const hasReact = process.argv.includes('--react')
  const { buildMode, watch, graph } = getCommandLineOptions()

  if (hasReact) BUNDLE_REACT_ALSO = true

  const rollupConfigs = [
    /** np.Shared Root component dev */
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.root.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.Root.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'RootBundle',
    }),
    /** np.Shared Root component prod */
    getRollupConfig({
      entryPointPath: 'np.Shared/src/react/support/rollup.root.entry.js',
      outputFilePath: 'np.Shared/requiredFiles/react.c.Root.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'RootBundle',
    }),
  ]
  const config = { ...rollupConfigs[0], ...{ output: [rollupConfigs[0].output, rollupConfigs[1].output] } }

  let rollupProms = []

  rollupProms.push(rollupReactFiles(config, watch, 'np.Shared Root Component development && production'))

  if (BUNDLE_REACT_ALSO) {
    const reactConfigs = []
    reactConfigs.push(
      /** np.Shared React/REACT_DOM Core (development) */
      getRollupConfig({
        entryPointPath: 'np.Shared/src/react/support/rollup.react.entry.js',
        outputFilePath: 'np.Shared/requiredFiles/react.core.REPLACEME.js',
        externalModules: [],
        createBundleGraph: graph,
        buildMode: 'development',
        bundleName: 'ReactCoreBundle',
      }),
      /** np.Shared React/REACT_DOM Core (development) */
      getRollupConfig({
        entryPointPath: 'np.Shared/src/react/support/rollup.react.entry.js',
        outputFilePath: 'np.Shared/requiredFiles/react.core.REPLACEME.js',
        externalModules: [],
        createBundleGraph: graph,
        buildMode: 'production',
        bundleName: 'ReactCoreBundle',
      }),
    )
    // we have to roll these up separately because there is a plugin replacer that needs
    // to be run on each one to replace ENV.MODE with development or production
    rollupProms.push(rollupReactFiles(reactConfigs[0], watch, 'np.Shared REACT CORE development'))
    rollupProms.push(rollupReactFiles(reactConfigs[1], watch, 'np.Shared REACT CORE production'))
  }
  await Promise.all(rollupProms)
  // const rollupConfigs = rollups.map((obj) => getRollupConfig({ ...obj, buildMode }))
  // const rollupsProms = rollups.map((obj) => rollupReactFiles({ ...obj, buildMode }, watch, `${buildMode}${BUNDLE_REACT_ALSO ? ' + react' : ''}`))
  // await Promise.all(rollupsProms)
  // await rollupReactFiles(rollups, watch, 'development && production')
})()
