// to bundle:
/*
 npx rollup -c dwertheimer.React/requiredFiles/bundling/rollup.react.cfg.js
*/

// const INCLUDE_REACT = true

import replace from 'rollup-plugin-replace'
import { visualizer } from 'rollup-plugin-visualizer'
const path = require('path')
const { babel } = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const { terser } = require('rollup-plugin-terser')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const json = require('@rollup/plugin-json')

/**
 * *************************************************************
 * You should only have to change these top variables
 */

const entryPointFilename = 'dwertheimer.React/requiredFiles/bundling/rollup.react.entry.js'
// IMPORTANT: end the file in JSX if you want it auto-loaded by the plugin as a component
const outputFilename = 'dwertheimer.React/requiredFiles/_reactBundle.min.js'
const exportedFileVarName = 'reactRollupBundle' // needs to be unique for each bundle (but is never used)
const BUILD_MODE = 'production' // 'production'|'develoment' (will minify everything)
const externalModules = [] // modules used by the bundle that you don't want rolled up into the bundle (and potentially duplicated by other bundles)

/**
 * *************************************************************
 */

const externalGlobals = externalModules.reduce((acc, cur) => ({ ...acc, [cur]: cur }), {})

const plugins = [
  replace({
    /* tell React to build in prod mode. https://reactjs.org/docs/optimizing-performance.html#use-the-production-build */
    'process.env.NODE_ENV': JSON.stringify(BUILD_MODE),
  }),
  babel({
    presets: ['@babel/flow'],
    babelHelpers: 'bundled',
    babelrc: false,
    exclude: ['node_modules/**', '*.json'],
    compact: false,
  }),
  commonjs(),
  json(),
  nodeResolve({ browser: true, jsnext: true }),
]

if (BUILD_MODE === 'production') {
  plugins.push(
    terser({
      compress: true,
      mangle: true,
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
