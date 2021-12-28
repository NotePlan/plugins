// @flow
'use strict'
const pkgInfo = require('../package.json')

const colors = require('chalk')
const strftime = require('strftime')
const fs = require('fs/promises')
const path = require('path')
const rollup = require('rollup')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')
const { nodeResolve } = require('@rollup/plugin-node-resolve')

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
  getPluginConfig,
} = require('./shared')
const { DefaultDeserializer } = require('v8')
const FOLDERS_TO_IGNORE = ['scripts', 'flow-typed', 'node_modules', 'np.plugin-flow-skeleton']
const rootFolderPath = path.join(__dirname, '..')

console.log(colors.yellow.bold(`🧩 NotePlan Plugin Environment v${pkgInfo.version} (${pkgInfo.build})`))

// Command line options
program
  .option('-d, --debug', 'Rollup: allow for better JS debugging - no minification or transpiling')
  .option('-c, --compact', 'Rollup: use more compact output')
  .parse(process.argv)
const options = program.opts()
const DEBUGGING = options.debug || false
const COMPACT = options.compact || false

if (DEBUGGING && !COMPACT) {
  console.log(
    colors.yellow.bold(
      `Running in DEBUG mode for purposes of seeing the Javascript script.js code exactly as it appears in your editor. This means no cleaning and no transpiling. Good for debugging, but bad for deployment to older machines. Make sure you run the autowatch command without the --debug flag before you release!\n`,
    ),
  )
}
if (COMPACT) {
  console.log('')
  console.log(colors.green.bold(`==> Rollup autowatch running. Will use compact output when there are no errors\n`))
}
let watcher

/**
 * Rebuild the plugin commands list, checking for collisions. Runs every time a plugin is updated
 *
 * @param pluginPaths
 * @private
 */
async function checkPluginList(pluginPaths) {
  const pluginCommands = {}
  for (const pluginPath of pluginPaths) {
    // console.log(`About to read ${pluginPath}`)
    const pluginFile = await getPluginFileContents(path.join(pluginPath, 'plugin.json')) // console.log(`*** * READ\n${JSON.stringify(pluginFile)}`)

    if (pluginFile) {
      pluginFile['plugin.commands']?.forEach((command) => {
        if (pluginCommands[command.name]) {
          console.log(colors.red.bold(`\n!!!!\nCommand collison: "${command.name}" exists already!`))
          console.log(`\tTrying to add: "${command.name}" from ${path.basename(pluginPath)}`)
          console.log(
            colors.yellow(
              `\tConflicts with "${pluginCommands[command.name].name}" in ${
                pluginCommands[command.name].folder
              }\nCommand will be added & will work but should should be changed to be unique!!!\n`,
            ),
          )
        } else {
          pluginCommands[command.name] = command
          pluginCommands[command.name].folder = path.basename(pluginPath)
          pluginCommands[command.name].pluginName = pluginFile['plugin.name']
        }
      })
    } else {
      console.log(colors.red(`^^^ checkPluginList: For some reason could not parse file at: ${pluginPath}`))
    }
  }
  await createPluginListing(pluginCommands)
}

async function main() {
  // const args = getArgs()

  const limitToFolders = await getFolderFromCommandLine(rootFolderPath, program.args)
  if (limitToFolders.length && !COMPACT) {
    console.log(
      colors.yellow.bold(
        `\nWARNING: Keep in mind that if you are editing shared files used by other plugins that you could be affecting them by not rebuilding/testing them all here. You have been warned. :)\n`,
      ),
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
      const isBundled = pluginContents.some((dirent) => dirent.name === 'src' && dirent.isDirectory)
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
      const outputFolder = bundledPlugins.find((pluginFolder) => outputFile.includes(pluginFolder))

      if (outputFolder != null) {
        const targetFolder = path.join(copyTargetPath, outputFolder.replace(rootFolderPath, ''))
        await mkdirp(targetFolder)
        await fs.copyFile(path.join(outputFolder, 'script.js'), path.join(targetFolder, 'script.js'))
        const pluginJson = path.join(outputFolder, 'plugin.json')
        // FIXME: Wanted to use JSON5 here but it was adding commas that stopped NP from working
        await writeMinifiedPluginFileContents(pluginJson, path.join(targetFolder, 'plugin.json'))
        // await fs.copyFile(pluginJson, path.join(targetFolder, 'plugin.json')) //the non-minified version
        const pluginJsonData = JSON.parse(await fs.readFile(pluginJson))
        if (limitToFolders.length === 0) {
          await checkPluginList(bundledPlugins)
        }
        const pluginFolder = outputFolder.replace(rootFolderPath, '').substring(1)

        // default dateTime, uses .pluginsrc if exists
        // see https://www.strfti.me/ for formatting
        const dateTimeFormat = await getPluginConfig('dateTimeFormat')
        const dateTime = dateTimeFormat.length > 0 ? strftime(dateTimeFormat) : new Date().toISOString().slice(0, 16)

        let msg = COMPACT
          ? `${dateTime}  ${pluginFolder} (v${pluginJsonData['plugin.version']})`
          : `${colors.cyan(
              `${dateTime} -- ${pluginFolder} (v${pluginJsonData['plugin.version']})`,
            )}\n   Built and copied to the "Plugins" folder.`

        if (DEBUGGING) {
          msg += colors.yellow(`\n   Built in DEBUG mode. Not ready to deploy.\n`)
        } else {
          if (!COMPACT) {
            msg += `\n   To debug this plugin without transpiling use: ${`npm run autowatch "${pluginFolder}" -- --debug`}\n\
   To release this plugin, update changelog.md and run: ${`npm run release "${pluginFolder}"\n`}`
          }
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

  if (!COMPACT) {
    console.log('')
    console.log(colors.green('==> Building and Watching for changes\n'))
  }
}

function getConfig(pluginPath) {
  return {
    external: [],
    input: path.join(pluginPath, 'src/index.js'),
    output: {
      file: path.join(pluginPath, 'script.js'),
      format: 'iife',
      name: 'exports',
      footer: 'Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, exports)',
    },
    plugins: DEBUGGING
      ? [
          babel({
            presets: ['@babel/flow'],
            babelHelpers: 'bundled',
            babelrc: false,
          }),
          commonjs(),
          resolve({
            browser: false,
          }),
        ]
      : [
          babel({ babelHelpers: 'bundled' }),
          commonjs(),
          json(),
          nodeResolve({ browser: true }),
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
