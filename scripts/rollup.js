'use strict'

const fs = require('fs/promises')
const path = require('path')
const rollup = require('rollup')
const commonjs = require('@rollup/plugin-commonjs')
const { babel } = require('@rollup/plugin-babel')
const { terser } = require('rollup-plugin-terser')
const resolve = require('@rollup/plugin-node-resolve').default
const mkdirp = require('mkdirp')
const { program } = require('commander')
const createPluginListing = require('./createPluginListing')
const {
  getFolderFromCommandLine,
  getPluginFileContents,
  writeMinifiedPluginFileContents,
  getCopyTargetPath,
} = require('./shared')
const FOLDERS_TO_IGNORE = [
  'scripts',
  'flow-typed',
  'node_modules',
  'np.plugin-flow-skeleton',
]
const rootFolderPath = path.join(__dirname, '..')

// Command line options
program.option(
  '-d, --debug',
  'Rollup: allow for better JS debugging - no minification or transpiling',
)
program.parse(process.argv)
const options = program.opts()
const DEBUGGING = options.debug | false

if (DEBUGGING) {
  console.log(
    `Running in DEBUG mode for purposes of seeing the Javascript script.js code exactly as it appears in your editor. This means no cleaning and no transpiling. Good for debugging, but bad for deployment to older machines. Make sure you run the autowatch command without the -debug flag before you release!\n`,
  )
}
let watcher

/**
 * @description Rebuild the plugin commands list, checking for collisions. Runs every time a plugin is updated
 * @param {string} pluginPath
 * @returns {Promise<void>}
 * @private
 */
async function checkPluginList(pluginPaths) {
  const pluginCommands = {}
  for (const pluginPath of pluginPaths) {
    // console.log(`About to read ${pluginPath}`)
    const pluginFile = await getPluginFileContents(
      path.join(pluginPath, 'plugin.json'),
    ) // console.log(`*** * READ\n${JSON.stringify(pluginFile)}`)
    if (pluginFile) {
      pluginFile['plugin.commands']?.forEach((command) => {
        if (pluginCommands[command.name]) {
          console.log(
            `\n!!!!\nCommand collison: "${command.name}" exists already!`,
          )
          console.log(
            `\tTrying to add: "${command.name}" from ${path.basename(
              pluginPath,
            )}`,
          )
          console.log(
            `\tConflicts with "${pluginCommands[command.name].name}" in ${
              pluginCommands[command.name].folder
            }\nCommand will be added & will work but should should be changed to be unique!!!\n`,
          )
        } else {
          pluginCommands[command.name] = command
          pluginCommands[command.name].folder = path.basename(pluginPath)
          pluginCommands[command.name].pluginName = pluginFile['plugin.name']
        }
      })
    } else {
      console.log(
        `^^^ checkPluginList: For some reason could not parse file at: ${pluginPath}`,
      )
    }
  }
  await createPluginListing(pluginCommands)
}

async function main() {
  // const args = getArgs()

  const limitToFolders = await getFolderFromCommandLine(
    rootFolderPath,
    program.args,
  )
  if (limitToFolders.length) {
    console.log(
      `\nWARNING: Keep in mind that if you are editing shared files used by other plugins that you could be affecting them by not rebuilding/testing them all here. You have been warned. :)\n`,
    )
  }
  const rootFolder = await fs.readdir(rootFolderPath, {
    withFileTypes: true,
  })
  const copyTargetPath = await getCopyTargetPath(rootFolder)

  const rootLevelFolders = rootFolder
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        !dirent.name.startsWith('.') &&
        !FOLDERS_TO_IGNORE.includes(dirent.name) &&
        (limitToFolders.length === 0 || limitToFolders.includes(dirent.name)),
    )
    .map(async (dirent) => {
      const pluginFolder = path.join(__dirname, '..', dirent.name)
      const pluginContents = await fs.readdir(pluginFolder, {
        withFileTypes: true,
      })
      const isBundled = pluginContents.some(
        (dirent) => dirent.name === 'src' && dirent.isDirectory,
      )
      if (!isBundled) {
        return null
      }
      const srcFiles = await fs.readdir(path.join(pluginFolder, 'src'))
      const hasIndexFile = srcFiles.includes('index.js')
      if (!hasIndexFile) {
        return null
      }
      return pluginFolder
    })
  const bundledPlugins = (await Promise.all(rootLevelFolders)).filter(Boolean)

  const rollupConfigs = bundledPlugins.map(getConfig)

  watcher = rollup.watch(rollupConfigs)

  watcher.on('event', async (event) => {
    if (event.result) {
      event.result.close()
    }
    if (event.code === 'BUNDLE_END' && copyTargetPath != null) {
      const outputFile = event.output[0]
      const outputFolder = bundledPlugins.find((pluginFolder) =>
        outputFile.includes(pluginFolder),
      )

      if (outputFolder != null) {
        const targetFolder = path.join(
          copyTargetPath,
          outputFolder.replace(rootFolderPath, ''),
        )
        await mkdirp(targetFolder)
        await fs.copyFile(
          path.join(outputFolder, 'script.js'),
          path.join(targetFolder, 'script.js'),
        )
        const pluginJson = path.join(outputFolder, 'plugin.json')
        // FIXME: Wanted to use JSON5 here but it was adding commas that stopped NP from working
        await writeMinifiedPluginFileContents(
          pluginJson,
          path.join(targetFolder, 'plugin.json'),
        )
        // await fs.copyFile(pluginJson, path.join(targetFolder, 'plugin.json')) //the non-minified version
        if (limitToFolders.length === 0) {
          await checkPluginList(bundledPlugins)
        }
        const pluginFolder = outputFolder
          .replace(rootFolderPath, '')
          .substring(1)
        let msg = `${new Date()
          .toISOString()
          .slice(
            0,
            16,
          )} "${pluginFolder}"\n     Built and copied to the "Plugins" folder. \n`
        if (DEBUGGING) {
          msg += `     Built in DEBUG mode. Not ready to deploy.`
        } else {
          msg += `     To debug this plugin without transpiling use: ${`npm run autowatch "${pluginFolder}" -- -debug`}\n\
     To release this plugin, update the changelog.md and run:\
            \n${`        npm run release "${pluginFolder}"`}`
        }
        console.log(msg)
      } else {
        console.log(`Generated "${outputFile.replace(rootFolder, '')}"`)
      }
    } else if (event.code === 'BUNDLE_END') {
      console.log('no copyTargetPath', copyTargetPath)
    } else if (event.code === 'ERROR') {
      console.log(`!!!!!!!!!!!!!!!\nRollup ${event.error}\n!!!!!!!!!!!!!!!\n`)
    }
  })

  console.log('Building and Watching for changes...\n')
}

function getConfig(pluginPath) {
  return {
    external: [],
    input: path.join(pluginPath, 'src/index.js'),
    output: {
      file: path.join(pluginPath, 'script.js'),
      format: 'iife',
      name: 'exports',
      footer:
        'Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, exports)',
    },
    plugins: DEBUGGING
      ? [
          babel({
            presets: ['@babel/flow'],
            babelHelpers: 'bundled',
            babelrc: false,
          }),
        ]
      : [
          babel({ babelHelpers: 'bundled' }),
          commonjs(),
          resolve({
            browser: false,
          }),
          terser({
            compress: false,
            mangle: false,
            output: {
              comments: false,
              beautify: true,
              indent_level: 2,
            },
          }),
        ],
    context: 'this',
  }
}

process.on('SIGINT', function () {
  console.log('Quitting...\n')
  if (watcher) {
    watcher.close()
  }
})

main()
