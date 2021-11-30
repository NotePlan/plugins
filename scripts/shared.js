'use strict'

const fs = require('fs/promises')
const os = require('os')
const username = os.userInfo().username
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const inquirer = require('inquirer')
const JSON5 = require('json5')
const colors = require('colors')

const pluginPathFile = path.join(__dirname, '..', '.pluginpath')

/**
 *
 * @param {string} fullPath
 * @returns {Promise<boolean>} whether file exists
 */
async function fileExists(fullPath) {
  try {
    await fs.stat(fullPath)
    return true
  } catch (e) {
    return false
  }
}

async function getFolderFromCommandLine(
  rootFolderPath,
  args,
  minimalOutput = false,
) {
  // const args = process.argv.slice(2)
  const limitToFolders = []
  if (args.length) {
    if (!minimalOutput) {
      console.log(`[Shared] Script will be limited to: ${JSON.stringify(args)}`)
    }

    for (const arg of args) {
      if (await fileExists(path.join(rootFolderPath, arg))) {
        limitToFolders.push(arg)
        //   console.log(`stat returned: ${JSON.stringify(stat)}`)
      } else {
        console.log(
          colors.red(
            `\nERROR: Invalid Argument: "${arg}"\n \n Path: "${path.join(
              rootFolderPath,
              arg,
            )}" does not exist.\n\n Make sure you are invoking with just the top-level folder name, \n  e.g., jgclark.DailyJournal`,
          ),
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
    console.log(`\n**\n**\n**\n[shared.js] command "${command}" did not work.`)
    console.error(err)
    process.exit(0)
    return ''
  }
}

async function getPluginFileContents(pluginPath) {
  let pluginFile, pluginObj
  try {
    pluginFile = await fs.readFile(pluginPath, 'utf8')
    pluginObj = await JSON5.parse(pluginFile)
    // pluginObj = await JSON.parse(pluginFile)
  } catch (e) {
    console.log(`getPluginFileContents: Problem reading JSON file:\n  ${pluginPath}`)
    console.log(`Often this is simply a non-standard trailing comma that the parser doesn't like.`)
    console.log(e)
  }
  return pluginObj || {}
}

/**
 * @param {string} pathToRead
 * @param {string} pathToWrite
 * @returns {Promise<void>}
 * @description Copies plugin contents for distribution but minifies/removes comments first
 */
async function writeMinifiedPluginFileContents(pathToRead, pathToWrite) {
  try {
    const contents = await fs.readFile(pathToRead, 'utf8')
    const j5 = JSON5.parse(contents)
    await fs.writeFile(pathToWrite, JSON.stringify(j5, null, 2))
  } catch (e) {
    console.log(`writePluginFileContents: Problem writing JSON file: ${pathToWrite}`)
    console.log(e)
  }
}

async function getCopyTargetPath(dirents) {
  const hasPluginPathFile = dirents.some((dirent) => dirent.name === '.pluginpath')
  if (hasPluginPathFile) {
    const path = await fs.readFile(pluginPathFile, 'utf8')
    // Cleanup any newlines from the path value
    return path.replace(/\r?\n|\r/g, '')
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
        message: `Enter the absolute path to the noteplan Plugins folder below. (Should start with "/" end with "/Plugins" -- No trailing slash and no escapes (backslashes, e.g. avoid "\\ ") in the path. On a Mac, it would be something like the suggestion below\n[type path or enter to accept this suggestion.]\n>>`,
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

async function getPluginConfig(key = null, defaultValue = null) {
  try {
    const data = await fs.readFile('.pluginsrc')
    if (data && !key) {
      return data
    } else {
      if (data) {
        const configData = await JSON5.parse(data)
        return configData.hasOwnProperty(key) ? configData[key] : defaultValue || null
      }
      return defaultValue
    }
  } catch (error) {
    //
  }
}

module.exports = {
  fileExists,
  getPluginFileContents,
  runShellCommand,
  getFolderFromCommandLine,
  writeMinifiedPluginFileContents,
  getCopyTargetPath,
  getPluginConfig,
}
