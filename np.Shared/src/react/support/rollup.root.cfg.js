/* to bundle:
with defaults:
   npx rollup -c np.Shared/src/react/support/rollup.root.cfg.js --watch
with env vars:
   ENV_MODE=development ENTRY_FILE="np.Shared/src/react/support/rollup.root.entry.js" OUTPUT_FILE="np.Shared/requiredFiles/react.c.Root.REPLACEME.js" npx rollup -c np.Shared/src/react/support/rollup.root.cfg.js --watch
   ENV_MODE=production ENTRY_FILE="np.Shared/src/react/support/rollup.root.entry.js" OUTPUT_FILE="np.Shared/requiredFiles/react.c.Root.REPLACEME.js" npx rollup -c np.Shared/src/react/support/rollup.root.cfg.js --watch

env vars:
const { ENV_MODE, ENTRY_FILE, OUTPUT_FILE } = process.env
include 'REPLACEME' in the OUTPUT_FILE env var to be replaced with 'min' or 'dev'

*/

// const INCLUDE_REACT = true
import replace from 'rollup-plugin-replace'
import { visualizer } from 'rollup-plugin-visualizer'
const fs = require('fs/promises')
const { existsSync } = require('fs')
const path = require('path')
const fg = require('fast-glob') //dbw adding for requiredFiles glob wildcard watch (**/)

// import pluginJson from '../plugin.json'

const { babel } = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const { terser } = require('rollup-plugin-terser')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const json = require('@rollup/plugin-json')

console.log('rollup.root.cfg.js: Starting ...', process.env.ENV_MODE)
if (process.argv.length === 2) {
  console.error('Expected at least one argument!')
  process.exit(1)
}

/**
 * *************************************************************
 * You should only have to change these top variables
 */
const { ENV_MODE, ENTRY_FILE, OUTPUT_FILE } = process.env
const BUILD_MODE = ENV_MODE ?? 'development'
const minStr = BUILD_MODE === 'production' ? 'min' : 'dev'
const entryPointFilename = ENTRY_FILE ?? 'np.Shared/src/react/support/rollup.root.entry.js'
const outputFilename = OUTPUT_FILE ? OUTPUT_FILE.replace('REPLACEME', minStr) : `np.Shared/requiredFiles/react.c.Root.${minStr}.js`
const exportedFileVarName = `reactBundle${Math.floor(new Date().getTime() / 1000)}` // needs to be unique for each bundle (but is never used externally)
const externalModules = ['React', 'react', 'WebView', 'react-dom', 'react-dom/client', 'createRoot', 'createElement'] // modules used by the bundle that you don't want rolled up into the bundle (and potentially duplicated by other bundles)

/**
 * *************************************************************
 */

const externalGlobals = externalModules.reduce((acc, cur) => ({ ...acc, [cur]: cur }), {})

const plugins = [
  replace({
    /* tell React to build in prod mode. https://reactjs.org/docs/optimizing-performance.html#use-the-production-build */
    'process.env.NODE_ENV': JSON.stringify(BUILD_MODE),
  }),
  nodeResolve({ browser: true, jsnext: true }),
  commonjs({ include: /node_modules/ }),
  babel({
    presets: ['@babel/flow', '@babel/preset-react'],
    babelHelpers: 'bundled',
    babelrc: false,
    exclude: ['node_modules/**', '*.json'],
    compact: false,
    extensions: ['.jsx'],
  }),
  json(),
]

if (BUILD_MODE === 'production') {
  plugins.push(
    terser({
      compress: false,
      mangle: false,
      output: {
        comments: false,
        beautify: false,
        indent_level: 0,
      },
    }),
  )
} else {
  plugins.push(
    visualizer({
      /* https://www.npmjs.com/package/rollup-plugin-visualizer */ open: true,
      emitFile: true,
      template: 'treemap',
      filename: `bundling/${exportedFileVarName}.visualized.html`,
    }),
  )
}

export default {
  external: externalModules,
  input: entryPointFilename,
  output: {
    file: outputFilename,
    /* exports: 'named', */
    format: 'iife' /* 'iife' */,
    name: exportedFileVarName,
    globals: externalGlobals,
    /* hoist the exports from the entry point to the global scope */
    footer: `Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, ${exportedFileVarName})`,
  },
  plugins,
}
