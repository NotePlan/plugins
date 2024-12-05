#!/usr/bin/node

/**
 * NOTE: bundler complains of circular dependencies, but this seems to not be a problem (ignore it)
 * ...the warning could be silenced if it's ever worth the effort https://github.com/rollup/rollup/issues/1089
 * Run the following command from the shell, in the project root
 * (builds dev and min version by default but you will use only one of them)
        node 'np.Preview/src/bundling/performMermaidRollup.node.js' 
Optionally add flags:  
 --graph to create the visialization graph
 --watch to watch for changes
 This will roll up all dependencies into a single file, and place it in the requiredFiles folder
 The rolled up file should be released, but should not be committed to the repo (it's 3.5MB)
 */
const rollupReactScript = require('../../../scripts/rollup.generic.js')
const { rollupReactFiles, getRollupConfig } = rollupReactScript

;(async function () {
  const buildMode = process.argv.includes('--production') ? 'production' : 'development'
  const watch = process.argv.includes('--watch')
  const graph = process.argv.includes('--graph')

  const rollupConfigs = [
    /** TaskAutomations WebView app - build both dev and production each time */
    getRollupConfig({
      entryPointPath: 'np.Preview/src/bundling/mermaid.entry.js',
      outputFilePath: 'np.Preview/requiredFiles/mermaid.REPLACEME.mjs',
      externalModules: [],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'Mermaid',
      format: 'es',
    }),
    getRollupConfig({
      entryPointPath: 'np.Preview/src/bundling/mermaid.entry.js',
      outputFilePath: 'np.Preview/requiredFiles/mermaid.REPLACEME.mjs',
      externalModules: [],
      createBundleGraph: graph,
      buildMode: 'production',
      bundleName: 'Mermaid',
      format: 'es',
    }),
  ]
  // create one single base config with two output options
  const config = { ...rollupConfigs[0], ...{ output: [rollupConfigs[0].output, rollupConfigs[1].output] } }
  // console.log(JSON.stringify(config, null, 2))
  await rollupReactFiles(config, watch, 'Mermaid: development && production')
  // const rollupsProms = rollups.map((obj) => rollupReactFiles({ ...obj, buildMode }, watch, buildMode))
})()
