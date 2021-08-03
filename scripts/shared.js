'use strict'

const fs = require('fs/promises')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const json5 = require('json5')

const pluginPathFile = path.join(__dirname, '..', '.pluginpath')

/**
 * @returns {boolean} whether file exists
 */
async function fileExists(fullPath) {
  try {
    await fs.stat(fullPath)
    return true
  } catch (e) {
    return false
  }
}

async function getFolderFromCommandLine(rootFolderPath) {
  const args = process.argv.slice(2)
  const limitToFolders = []
  if (args.length) {
    console.log(`[Shared] Script will be limited to: ${JSON.stringify(args)}`)

    for (const arg of args) {
      if (await fileExists(path.join(rootFolderPath, arg))) {
        limitToFolders.push(arg)
        //   console.log(`stat returned: ${JSON.stringify(stat)}`)
      } else {
        console.log(
          `\nERROR: Invalid Argument: "${arg}"\n  Path: "${path.join(
            rootFolderPath,
            arg,
          )}" does not exist.\n  Make sure you are invoking with just the top-level folder name, e.g. \n  jgclark.DailyJournal\nStopping script. Try again!\n`,
        )
        process.exit(0)
      }
    }
  }
  return limitToFolders
}

async function runShellCommand(command) {
  try {
    const { error, stdout, stderr } = await exec(command)
    if (error) console.log('runShellCommand error:', error)
    //   if (stdout.length) console.log('runShellCommand stdout:\n', stdout)
    if (stderr.length) console.log('runShellCommand stderr:', stderr)
    return String(stdout)
  } catch (err) {
    console.log(`\n**\n**\**\n[shared.js] command "${command}" did not work.`)
    console.error(err)
    process.exit(0)
    return ''
  }
}

async function getPluginFileContents(pluginPath) {
  let pluginFile, pluginObj
  try {
    pluginFile = await fs.readFile(pluginPath, 'utf8')
    // pluginObj = await json5.parse(pluginFile)
    pluginObj = await JSON.parse(pluginFile)
  } catch (e) {
    console.log(
      `getPluginFileContents: Problem reading JSON file:\n  ${pluginPath}`,
    )
    console.log(
      `Often this is simply a non-standard trailing comma that the parser doesn't like.`,
    )
    console.log(e)
  }
  return pluginObj || {}
}

/**
 * @param {string} pluginPath
 * @returns {Promise<void>}
 * @description Copies plugin contents for distribution but minifies/removes comments first
 */
async function writeMinifiedPluginFileContents(pathToRead, pathToWrite) {
  try {
    const contents = await fs.readFile(pathToRead, 'utf8')
    const j5 = json5.parse(contents)
    await fs.writeFile(pathToWrite, JSON.stringify(j5, null, 2))
  } catch (e) {
    console.log(
      `writePluginFileContents: Problem writing JSON file: ${pathToWrite}`,
    )
    console.log(e)
  }
}

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
        default: `/Users/${username}/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins`,
        message: `Enter the absolute path to the noteplan Plugins folder below. (Should start with "/" end with "/Plugins" -- No trailing slash and no escapes (backslashes) in the path. On a Mac, it would be something like the suggestion below\n[type path or enter to accept this suggestion.]\n>>`,
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

module.exports = {
  fileExists,
  getPluginFileContents,
  runShellCommand,
  getFolderFromCommandLine,
  writeMinifiedPluginFileContents,
  getCopyTargetPath,
}
