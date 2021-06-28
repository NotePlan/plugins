'use strict'

const fs = require('fs/promises')
const path = require('path')
const inquirer = require('inquirer')
const rollup = require('rollup')
const commonjs = require('@rollup/plugin-commonjs')
const { babel } = require('@rollup/plugin-babel')
const resolve = require('@rollup/plugin-node-resolve').default
const mkdirp = require('mkdirp')
const { terser } = require('rollup-plugin-terser')

const FOLDERS_TO_IGNORE = ['scripts', 'flow-typed', 'node_modules']
const rootFolderPath = path.join(__dirname, '..')

let watcher

async function main() {
  console.log
  const rootFolder = await fs.readdir(rootFolderPath, {
    withFileTypes: true,
  })
  const copyTargetPath = await getCopyTargetPath(rootFolder)

  const rootLevelFolders = rootFolder
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        !dirent.name.startsWith('.') &&
        !FOLDERS_TO_IGNORE.includes(dirent.name),
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
        await fs.copyFile(
          path.join(outputFolder, 'plugin.json'),
          path.join(targetFolder, 'plugin.json'),
        )
        console.log(
          `Generated "${outputFile.replace(
            rootFolder,
            '',
          )}"\nand copied to the "Plugins" folder\nat ${new Date()
            .toISOString()
            .slice(0, 16)}\n`,
        )
      } else {
        console.log(`Generated "${outputFile.replace(rootFolder, '')}"`)
      }
    } else if (event.code === 'BUNDLE_END') {
      console.log('no copyTargetPath', copyTargetPath)
    }
  })

  console.log('Building and Watching for changes...\n')
}

const pluginPathFile = path.join(__dirname, '..', '.pluginpath')
async function getCopyTargetPath(dirents) {
  const hasPluginPathFile = dirents.some(
    (dirent) => dirent.name === '.pluginpath',
  )
  if (hasPluginPathFile) {
    const path = await fs.readFile(pluginPathFile, 'utf8')
    return path
  }

  const { shouldCopy } = await inquirer.prompt([
    {
      type: 'list',
      name: 'shouldCopy',
      message:
        'Could not a find a file called ".pluginpath". Do you want to auto-copy compiled plugins to the Noteplan plugin directory?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
    },
  ])
  if (!shouldCopy) {
    return null
  }
  let pluginPath
  do {
    const { inputPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputPath',
        message:
          'What is the absolute path to the noteplan Plugins folder. (should start with "/" end with "/Plugins")',
      },
    ])
    pluginPath = inputPath
  } while (!pluginPath.endsWith('/Plugins') || !pluginPath.startsWith('/'))

  const { shouldCreateFile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'shouldCreateFile',
      message: 'Do you want to save this file for later?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
    },
  ])
  if (shouldCreateFile) {
    await fs.writeFile(pluginPathFile, pluginPath)
  }
  return pluginPath
}

function getConfig(pluginPath) {
  return {
    external: [],
    input: path.join(pluginPath, 'src/index.js'),
    output: {
      file: path.join(pluginPath, 'script.js'),
      format: 'iife',
      name: 'exports',
      footer: 'Object.assign(globalThis, exports)',
    },
    plugins: [
      babel({ babelHelpers: 'bundled' }),
      commonjs(),
      resolve({
        browser: false,
      }),
      terser(),
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
