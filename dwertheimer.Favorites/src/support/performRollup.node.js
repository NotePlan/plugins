#!/usr/bin/node

/**
 * FavoritesView Rollup Script
 *
 * Builds development and production modes for:
 * - FavoritesView bundle
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

  // FavoritesView bundle configs
  const favoritesViewRollupConfigs = [
    getRollupConfig({
      entryPointPath: 'dwertheimer.Favorites/src/support/rollup.FavoritesView.entry.js',
      outputFilePath: 'dwertheimer.Favorites/requiredFiles/react.c.FavoritesView.bundle.REPLACEME.js',
      externalModules: ['React', 'react', 'reactDOM', 'dom', 'ReactDOM'],
      createBundleGraph: graph,
      buildMode: 'development',
      bundleName: 'FavoritesViewBundle',
    }),
  ]

  const favoritesViewConfig = favoritesViewRollupConfigs[0] // use only dev version for now
  rollupProms.push(rollupReactFiles(favoritesViewConfig, watch, 'dwertheimer.Favorites FavoritesView Component development version'))

  try {
    await Promise.all(rollupProms)
  } catch (error) {
    console.error('Error during rollup:', error)
  }
})()

