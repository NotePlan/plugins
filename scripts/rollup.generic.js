/**
 * This is the generic rollup config for bundling React components for use in NotePlan.
 * We can also use this to bundle React itself
 * You call this from code (e.g. the rollup script eventually) or (as I am doing now) from a node script, e.g.:
 *     node '/Users/dwertheimer/Developer/Noteplan/np-plugins-freshstart-2022-08-21/dwertheimer.TaskAutomations/src/react/support/performRollup.node.js'
 *
 */
const notifier = require('node-notifier') // https://www.npmjs.com/package/node-notifier
const colors = require('chalk') // https://www.npmjs.com/package/chalk console.log(chalk.green('Hello %s'), name);
const messenger = require('@codedungeon/messenger')
const replace = require('rollup-plugin-replace')
const visualizer = require('rollup-plugin-visualizer').visualizer
const { existsSync } = require('fs')
const path = require('path')
const fg = require('fast-glob') //dbw adding for requiredFiles glob wildcard watch (**/)
const { babel } = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const { terser } = require('rollup-plugin-terser')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const json = require('@rollup/plugin-json')
const rollup = require('rollup')
const { program } = require('commander')

const NOTIFY = true

// type: success, warn, critical, note, log
const message = (type, msg, leftwords, useIcon = false) => {
  if (!messenger[type]) {
    messenger.error(`Invalid message type in your code: "${type}" (should be one of: success, warn, critical, note, log)`, 'Coding Error', true)
    type = 'log'
  }
  messenger[type](msg, leftwords.padEnd(7), useIcon)
}

/* SAMPLE USAGE:
    {entryPointPath:"path-relative-to-plugin-root.js", outputFilePath:"react.c.WebView.bundle.REPLACEME.js", buildMode:"production", externalModules:["React", "react"], createBundleGraph:true}
*/

// type RollupConfigInputs = {
//   entryPointPath: string,
//   outputFilePath: string,
//   buildMode?: 'production' | 'development' | 'both',
//   externalModules?: ?Array<string>,
//   createBundleGraph?: boolean,
// }

/**
 * Returns ISO formatted date time
 * @author @codedungeon
 * @return {string} formatted date time
 */

const dt = () => {
  const d = new Date()

  const pad = (value) => {
    return value < 10 ? `0${value}` : value.toString()
  }

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString('en-GB')}`
}

const rollupDefaults = {
  externalModules: ['React', 'react'],
  buildMode: 'development',
  format: 'iife',
  createBundleGraph: false,
}

/**
 * Rollup a set of JSX/React files into a single bundle
 * @returns
 */
async function rollupReactFiles(config, createWatcher = false, buildMode = '') {
  // const opt = getRollupConfig(options)
  if (config) {
    try {
      // create a bundle

      const bundle = await rollup.rollup(config)
      const outputOptions = Array.isArray(config.output) ? config.output : [config.output]
      outputOptions.forEach(async (output) => {
        // await bundle.generate(output) // this is for generating the bundle in memory
        const result = await bundle.write(output)
        const files = result.output.map((o) => path.basename(o.fileName)).join(', ')
        const msg = `${dt()} Rollup: wrote bundle: ${files}`
        if (!createWatcher) message('success', msg, 'SUCCESS', true)
      })

      if (createWatcher) {
        watch(config, buildMode)
      } else {
      }

      await bundle.close()
    } catch (error) {
      //   buildFailed = true
      // do some error reporting
      message('critical', `Rollup: Error building bundle: ${error}`, 'ERROR', true)
      console.error(error)
    }
  }
}

function watch(watchOptions, buildMode = '') {
  const filename = path.basename(watchOptions.input)
  message('note', `${dt()} Rollup: Watcher Starting - watching for changes starting with: "${filename}" buildMode="${buildMode}"...`, 'WATCH  ', true)
  const watcher = rollup.watch(watchOptions)

  watcher.on('event', (event) => {
    // event.code can be one of:
    //   START        — the watcher is (re)starting
    //   BUNDLE_START — building an individual bundle
    //                  * event.input will be the input options object if present
    //                  * event.output contains an array of the "file" or
    //                    "dir" option values of the generated outputs
    //   BUNDLE_END   — finished building a bundle
    //                  * event.input will be the input options object if present
    //                  * event.output contains an array of the "file" or
    //                    "dir" option values of the generated outputs
    //                  * event.duration is the build duration in milliseconds
    //                  * event.result contains the bundle object that can be
    //                    used to generate additional outputs by calling
    //                    bundle.generate or bundle.write. This is especially
    //                    important when the watch.skipWrite option is used.
    //                  You should call "event.result.close()" once you are done
    //                  generating outputs, or if you do not generate outputs.
    //                  This will allow plugins to clean up resources via the
    //                  "closeBundle" hook.
    //   END          — finished building all bundles
    //   ERROR        — encountered an error while bundling
    //                  * event.error contains the error that was thrown
    //                  * event.result is null for build errors and contains the
    //                    bundle object for output generation errors. As with
    //                    "BUNDLE_END", you should call "event.result.close()" if
    //                    present once you are done.
    // If you return a Promise from your event handler, Rollup will wait until the
    // Promise is resolved before continuing.
    // console.log(`rollup: ${event.code}`)
    if (event.code === 'BUNDLE_END') {
      const outputFiles = event.output.map((o) => path.basename(o)).join(', .../')
      const msg = `${dt()} Rollup: wrote bundle${event.output.length > 1 ? 's' : ''}: ".../${outputFiles}"`
      if (NOTIFY) {
        notifier.notify({
          title: 'React Component Build',
          message: msg,
        })
      }
      // messenger: success, warn, critical, note, log
      message('success', msg, 'SUCCESS', true)
    } else if (event.code === 'BUNDLE_END') {
      console.log('no copyTargetPath', copyTargetPath)
    } else if (event.code === 'ERROR') {
      message('critical', `!!!!!!!!!!!!!!!\nRollup ${event.error}\n!!!!!!!!!!!!!!!\n`, 'ERROR', true)
      if (NOTIFY) {
        notifier.notify({
          title: 'NotePlan Plugins Build',
          message: `An error occurred during build process.\nSee console for more information`,
        })
      }
    }
  })

  // This will make sure that bundles are properly closed after each run
  watcher.on('event', ({ result }) => {
    if (result) {
      result.close()
    }
  })

  // Additionally, you can hook into the following. Again, return a Promise to
  // make Rollup wait at that stage:
  watcher.on('change', (id, { event }) => {
    const filename = path.basename(id)
    message('info', `${dt()} Rollup: file: "${filename}" changed`, 'CHANGE', true)
    /* a file was modified */
  })
  watcher.on('restart', () => {
    // console.log(`rollup: restarting`)
    /* a new run was triggered (usually a watched file change) */
  })
  watcher.on('close', () => {
    console.log(`rollup: closing`)
    /* the watcher was closed, see below */
  })
  process.on('SIGINT', async function () {
    console.log('\n\n')
    console.log(colors.yellow('Quitting...\n'))
    if (watcher) {
      await watcher.close()
    }
    process.exit()
  })
}

/**
 * Get rollup config for a set of JSX/React files
 * @param {{
    entryPointPath: string,
    outputFilePath: string,
    externalModules: [],
    createBundleGraph: boolean,
    buildMode: 'production'|'development',
    bundleName: string,
 * }} options
 * @returns
 */
function getRollupConfig(options) {
  const opts = { ...rollupDefaults, ...options }
  const rootFolderPath = path.join(__dirname, '..')

  const { buildMode, externalModules, createBundleGraph } = opts

  if (!opts.entryPointPath?.length || !opts.outputFilePath?.length) {
    throw 'rollupReactFiles: entryPointPath and outputFilePath must be specified'
    return false
  }
  const entryPointPath = path.join(rootFolderPath, opts.entryPointPath)
  let outputFilePath = path.join(rootFolderPath, opts.outputFilePath.replace('REPLACEME', buildMode === 'production' ? 'min' : 'dev'))

  // const exportedFileVarName = `reactBundle${Math.floor(new Date().getTime() / 1000)}` // needs to be unique for each bundle (but is never used externally)
  const exportedFileVarName = options.bundleName || 'reactBundle'

  // $FlowIgnore
  const externalGlobals = (externalModules || []).reduce((acc, cur) => ({ ...acc, [cur]: cur }), {})

  let outputPlugins = []
  const plugins = [
    replace({
      /* tell React to build in prod or development mode. https://reactjs.org/docs/optimizing-performance.html#use-the-production-build */
      'process.env.NODE_ENV': JSON.stringify(buildMode),
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

  // if production, minify everything
  if (buildMode === 'production') {
    outputPlugins.push(
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
  }

  if (createBundleGraph) {
    const directoryPath = path.dirname(entryPointPath)
    const filename = path.join(directoryPath, `${exportedFileVarName}.visualized.html`)
    plugins.push(
      visualizer({
        /* https://www.npmjs.com/package/rollup-plugin-visualizer */ open: true,
        /* emitFile: true, */
        template: 'treemap',
        filename: filename,
      }),
    )
  }
  return {
    external: externalModules,
    input: entryPointPath,
    output: {
      plugins: outputPlugins,
      file: outputFilePath,
      /* exports: 'named', */
      format: opts.format,
      inlineDynamicImports: opts.format === 'iife' ? false : true,
      name: exportedFileVarName,
      globals: externalGlobals,
      /* hoist the exports from the entry point to the global scope */
      footer: opts.format === 'iife' ? `Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, ${exportedFileVarName})` : null,
    },
    plugins,
  }
}

/**
 * Because for now we are calling from command line in multiple places, we need to be able to
 * get the command line options from the command line
 */
function getCommandLineOptions() {
  //TODO: using commander {program} is work in progress. need to spend more time with it
  // pasting code from rollup.js here for editing later
  // Command line options
  program
    .option('-w, --watch', 'Rollup: watch for changes and rebuild')
    .option('-r, --react', 'Rollup: build React also')
    /*
    .option('-d, --debug', 'Rollup: allow for better JS debugging - no minification or transpiling')
    .option('-m, --minify', 'Rollup: create minified output to reduce file size')
    .option('-c, --compact', 'Rollup: use compact output')
    .option('-n, --notify', 'Show Notification')
    .option('-b, --build', 'Rollup: build plugin only (no watcher)')
    */
    .parse(process.argv)

  const options = program.opts()
  const DEBUGGING = options.debug || false
  const MINIFY = options.minify || false
  const COMPACT = options.compact || false
  const BUILD = options.build || false
  const NOTIFY = options.notify || false

  // for now, let's do things the old school way
  return {
    buildMode: process.argv.includes('--production') ? 'production' : 'development',
    watch: process.argv.includes('--watch'),
    graph: process.argv.includes('--graph'),
  }
}

module.exports = { rollupReactFiles, getRollupConfig, getCommandLineOptions }
