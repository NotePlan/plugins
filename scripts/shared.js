'use strict'

const fs = require('fs/promises')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const json5 = require('json5')

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
    console.log(`[shared.js] command "${command}" did not work.`)
    //   console.error(err)
    return ''
  }
}

async function getPluginFileContents(pluginPath) {
  let pluginFile, pluginObj
  try {
    pluginFile = await fs.readFile(pluginPath, 'utf8')
    pluginObj = await json5.parse(pluginFile)
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
    await fs.writeFile(pathToWrite, json5.stringify(j5))
  } catch (e) {
    console.log(
      `writePluginFileContents: Problem writing JSON file: ${pathToWrite}`,
    )
    console.log(e)
  }
}

module.exports = {
  fileExists,
  getPluginFileContents,
  runShellCommand,
  getFolderFromCommandLine,
  writeMinifiedPluginFileContents,
}
