const path = require('path')
const fs = require('fs')
const notifier = require('node-notifier')
const colors = require('chalk')
const messenger = require('@codedungeon/messenger')
const replace = require('rollup-plugin-replace')
const visualizer = require('rollup-plugin-visualizer').visualizer
const { babel } = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const json = require('@rollup/plugin-json')
const rollup = require('rollup')
const { program } = require('commander')
const alias = require('@rollup/plugin-alias')
const postcss = require('rollup-plugin-postcss')
const debounce = require('lodash.debounce')
const postcssPrefixSelector = require('postcss-prefix-selector')
const { caseSensitiveImports } = require('./shared')

const NOTIFY = true

const message = (type, msg, leftwords, useIcon = false) => {
  if (!messenger[type]) {
    messenger.error(`Invalid message type in your code: "${type}" (should be one of: success, warn, critical, note, log)`, 'Coding Error', true)
    type = 'log'
  }
  messenger[type](msg, leftwords.padEnd(7), useIcon)
}

const dt = () => {
  const d = new Date()
  const pad = (value) => (value < 10 ? `0${value}` : value.toString())
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString('en-GB')}`
}

const rollupDefaults = {
  externalModules: ['React', 'react'],
  buildMode: 'development',
  format: 'iife',
  createBundleGraph: false,
}

async function rollupReactFiles(config, createWatcher = false, buildMode = '') {
  if (config) {
    try {
      const bundle = await rollup.rollup({
        ...config,
      })
      const outputOptions = Array.isArray(config.output) ? config.output : [config.output]
      outputOptions.forEach(async (output) => {
        const result = await bundle.write(output)
        const files = result.output.map((o) => path.basename(o.fileName)).join(', ')
        const msg = `${dt()} Rollup: wrote bundle: ${files}`
        if (!createWatcher) message('success', msg, 'SUCCESS', true)
      })

      if (createWatcher) {
        watch(config, buildMode)
      }

      await bundle.close()
    } catch (error) {
      message('critical', `Rollup: Error building bundle: ${error}`, 'ERROR', true)
      console.error(error)
    }
  }
}

/**
 * Watches for changes and triggers rebuilds with debouncing to prevent multiple builds in rapid succession.
 *
 * @param {Object} watchOptions - The Rollup watch options.
 * @param {string} [buildMode=''] - The build mode, e.g., 'development' or 'production'.
 */
function watch(watchOptions, buildMode = '') {
  const filename = path.basename(watchOptions.input)
  message('note', `${dt()} Rollup: Watcher Starting - watching for changes starting with: "${filename}" buildMode="${buildMode}"...`, 'WATCH  ', true)

  const watcher = rollup.watch(watchOptions)

  // Debounce the rebuild process to prevent multiple builds in quick succession
  const debouncedRebuild = debounce(() => {
    message('info', `${dt()} Rollup: Rebuilding due to changes...`, 'REBUILD', true)
  }, 300)

  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') {
      const outputFiles = event.output.map((o) => path.basename(o)).join(', .../')
      const msg = `${dt()} Rollup: wrote bundle${event.output.length > 1 ? 's' : ''}: ".../${outputFiles}"`
      if (NOTIFY) {
        notifier.notify({
          title: 'React Component Build',
          message: msg,
        })
      }
      message('success', msg, 'SUCCESS', true)
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

  watcher.on('change', (id) => {
    const filename = path.basename(id)
    message('info', `${dt()} Rollup: file: "${filename}" changed`, 'CHANGE', true)
    debouncedRebuild()
  })

  watcher.on('restart', () => {
    // console.log(`rollup: restarting`)
  })

  watcher.on('close', () => {
    console.log(`rollup: closing`)
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

function getRollupConfig(options) {
  const opts = { ...rollupDefaults, ...options }
  const rootFolderPath = path.join(__dirname, '..')

  const { buildMode, externalModules, createBundleGraph, cssNameSpace } = opts

  if (!opts.entryPointPath?.length || !opts.outputFilePath?.length) {
    throw 'rollupReactFiles: entryPointPath and outputFilePath must be specified'
  }
  const entryPointPath = path.join(rootFolderPath, opts.entryPointPath)
  const outputFilePath = path.join(rootFolderPath, opts.outputFilePath.replace('REPLACEME', buildMode === 'production' ? 'min' : 'dev'))

  const exportedFileVarName = options.bundleName || 'reactBundle'

  // Validate entry file exports before building
  const isRootBundle = exportedFileVarName.includes('Root') || exportedFileVarName.includes('RootBundle')
  try {
    const entryFileContent = fs.readFileSync(entryPointPath, 'utf8')
    
    if (isRootBundle) {
      // Root bundles should export React and ReactDOM
      const hasReact = /export\s+.*\bReact\b/.test(entryFileContent) || /export\s*\{[^}]*\bReact\b/.test(entryFileContent)
      const hasReactDOM = /export\s+.*\bReactDOM\b/.test(entryFileContent) || /export\s*\{[^}]*\bReactDOM\b/.test(entryFileContent)
      
      if (!hasReact || !hasReactDOM) {
        throw new Error(
          `\n❌ ROLLUP VALIDATION ERROR: Root bundle entry file "${opts.entryPointPath}" is missing required exports.\n\n` +
          `Root bundles must export React and ReactDOM for other bundles to use.\n\n` +
          `Expected exports in your entry file:\n` +
          `  - React (from 'react')\n` +
          `  - ReactDOM (from 'react-dom')\n\n` +
          `Example entry file:\n` +
          `  export { default as React } from 'react'\n` +
          `  export { default as ReactDOM } from 'react-dom'\n` +
          `  export { createRoot } from 'react-dom/client'\n` +
          `  // ... other exports\n\n` +
          `Entry file: ${entryPointPath}\n`
        )
      }
    } else {
      // Non-Root bundles should export WebView
      const hasWebView = /export\s+.*\bWebView\b/.test(entryFileContent) || 
                         /export\s*\{[^}]*\bWebView\b/.test(entryFileContent) ||
                         /export\s*\{[^}]*as\s+WebView/.test(entryFileContent)
      
      if (!hasWebView) {
        throw new Error(
          `\n❌ ROLLUP VALIDATION ERROR: Entry file "${opts.entryPointPath}" is missing required WebView export.\n\n` +
          `All React component bundles (except Root) must export a component named "WebView".\n` +
          `This is what the Root component expects to load dynamically.\n\n` +
          `To fix this, update your entry file to export your component as WebView:\n\n` +
          `Option 1: Export your component as WebView directly:\n` +
          `  export { YourComponent as WebView } from './YourComponent.jsx'\n\n` +
          `Option 2: If your component is already named WebView:\n` +
          `  export { WebView } from './YourComponent.jsx'\n\n` +
          `Example entry file (rollup.YourComponent.entry.js):\n` +
          `  // Root expects a component called WebView\n` +
          `  export { YourComponent as WebView } from '../components/YourComponent.jsx'\n\n` +
          `Entry file: ${entryPointPath}\n` +
          `Bundle name: ${exportedFileVarName}\n`
        )
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Entry file not found: ${entryPointPath}`)
    }
    // Re-throw validation errors
    throw error
  }

  // Map external module names to their global variable names
  // React and ReactDOM are loaded by np.Shared's Root component
  const externalGlobals = (externalModules || []).reduce((acc, cur) => {
    // Map various React import names to the global React variable
    if (cur === 'react' || cur === 'React') {
      acc[cur] = 'React'
    } else if (cur === 'react-dom' || cur === 'reactDOM' || cur === 'ReactDOM' || cur === 'dom') {
      acc[cur] = 'ReactDOM'
    } else {
      // For other externals, use the module name as the global name
      acc[cur] = cur
    }
    return acc
  }, {})
  
  // Also add 'react-dom' explicitly (common import name that might not be in externalModules list)
  if (!externalGlobals['react-dom']) {
    externalGlobals['react-dom'] = 'ReactDOM'
  }

  const postcssOptions = {
    minimize: true,
    sourceMap: true,
    plugins: [],
  }

  // If we have a css namespace, add the prefix plugin
  if (cssNameSpace) {
    postcssOptions.plugins.push(
      postcssPrefixSelector({
        prefix: cssNameSpace.startsWith('.') ? cssNameSpace : `.${cssNameSpace}`,
        /**
         * Transform function to avoid double prefixing and skip certain global selectors
         * @param {string} prefix
         * @param {string} selector
         * @returns {string}
         */
        transform(prefix, selector) {
          const trimmedSelector = selector.trim()
          console.log(`prefix: ${prefix} selector: ${trimmedSelector}`)

          // If the selector already starts with the prefix or a CSS variable, return it as-is
          if (trimmedSelector.startsWith(prefix) || trimmedSelector.startsWith('--')) {
            return trimmedSelector
          }

          // Skip prefixing global selectors that are often used for resets or root-level styling
          const skipPrefixSelectors = [':root', 'html', 'body', 'dialog', 'dialog::backdrop', '.macOS', '.iPadOS', '.iOS']

          // If the selector matches one of these global selectors, return it as-is
          if (skipPrefixSelectors.some((s) => trimmedSelector.startsWith(s))) {
            return trimmedSelector
          }

          // If the selector starts with '&', it likely represents a nested selector or pseudo-class
          // from a pre-processor. Avoid prefixing these directly as it can cause breakage.
          if (trimmedSelector.startsWith('&')) {
            return trimmedSelector
          }

          // Otherwise, add the prefix
          return `${prefix} ${trimmedSelector}`
        },
      }),
    )
  }

  const outputPlugins = []
  const plugins = [
    caseSensitiveImports(),
    alias({
      entries: [{ find: '@helpers', replacement: path.resolve(__dirname, '..', 'helpers') }],
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(buildMode),
    }),
    nodeResolve({
      browser: true,
      jsnext: true,
      extensions: ['.js', '.jsx', '.css'], // Trigger rebuild when any of these extensions are changed
    }),
    commonjs({ include: /node_modules/ }),
    babel({
      presets: ['@babel/preset-flow', '@babel/preset-react'],
      babelHelpers: 'bundled',
      babelrc: false,
      exclude: ['node_modules/**', '*.json'],
      compact: false,
      extensions: ['.jsx', '.js'], // Ensure Babel processes .jsx files as well
    }),
    json(),
    postcss(postcssOptions),
  ]

  if (createBundleGraph) {
    const directoryPath = path.dirname(entryPointPath)
    const filename = path.join(directoryPath, `${exportedFileVarName}.visualized.html`)
    plugins.push(
      visualizer({
        open: true,
        template: 'treemap',
        filename: filename,
      }),
    )
  }

  const watchOptions = {
    exclude: [
      'node_modules/**',
      '**/requiredFiles/**', // Exclude the output directory
    ],
  }

  // Function to determine if a module should be treated as external
  // Only treat React/ReactDOM as external if they're in the explicit externalModules list
  // (Root bundle includes React/ReactDOM, so they shouldn't be external for Root)
  const isExternal = (id) => {
    // Check explicit external modules list
    if (externalModules.includes(id)) {
      return true
    }
    // Only treat 'react' and 'react-dom' as external if they're explicitly in the externalModules list
    // This allows Root to bundle React while Forms bundles treat it as external
    return false
  }

  // Create footer that assigns bundle to global and extracts key exports
  let footer = null
  if (opts.format === 'iife') {
    // Assign bundle to global
    footer = `Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, ${exportedFileVarName});`
    
    // Extract WebView to global scope if it exists (Root component expects it as a global)
    // This is generic - any bundle that exports WebView will have it extracted to global scope
    footer += `\nif (typeof ${exportedFileVarName} !== 'undefined' && ${exportedFileVarName}.WebView) { typeof(globalThis) == "undefined" ? (this.WebView = ${exportedFileVarName}.WebView) : (globalThis.WebView = ${exportedFileVarName}.WebView); }`
    
    // Extract React and ReactDOM to global scope from Root bundle
    // Root bundle now includes React and ReactDOM, and other bundles (like Forms) need them as globals
    if (exportedFileVarName.includes('Root') || exportedFileVarName.includes('RootBundle')) {
      footer += `\nif (typeof ${exportedFileVarName} !== 'undefined') {`
      footer += `\n  if (${exportedFileVarName}.React) { typeof(globalThis) == "undefined" ? (this.React = ${exportedFileVarName}.React) : (globalThis.React = ${exportedFileVarName}.React); }`
      footer += `\n  if (${exportedFileVarName}.ReactDOM) { typeof(globalThis) == "undefined" ? (this.ReactDOM = ${exportedFileVarName}.ReactDOM) : (globalThis.ReactDOM = ${exportedFileVarName}.ReactDOM); }`
      footer += `\n  if (${exportedFileVarName}.createRoot) { typeof(globalThis) == "undefined" ? (this.createRoot = ${exportedFileVarName}.createRoot) : (globalThis.createRoot = ${exportedFileVarName}.createRoot); }`
      footer += `\n}`
    }
  }

  return {
    external: isExternal,
    input: entryPointPath,
    output: {
      plugins: outputPlugins,
      file: outputFilePath,
      format: opts.format,
      inlineDynamicImports: opts.format === 'iife' ? false : true,
      name: exportedFileVarName,
      globals: externalGlobals,
      footer: footer,
    },
    plugins,
    watch: watchOptions,
    /**
     * Suppress specific Rollup warnings.
     * @param {object} warning - Rollup warning object.
     * @param {function} warn - Rollup warn function.
     */
    onwarn: (warning, warn) => {
      // Suppress warnings about module directives like "use client" being ignored
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      warn(warning)
    },
  }
}

function getCommandLineOptions() {
  program.option('-w, --watch', 'Rollup: watch for changes and rebuild').option('-r, --react', 'Rollup: build React also').parse(process.argv)

  return {
    buildMode: process.argv.includes('--production') ? 'production' : 'development',
    watch: process.argv.includes('--watch'),
    graph: process.argv.includes('--graph'),
  }
}

module.exports = { rollupReactFiles, getRollupConfig, getCommandLineOptions }
