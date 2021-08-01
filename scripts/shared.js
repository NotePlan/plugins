const fs = require('fs/promises')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

module.exports = {
  async getFolderFromCommandLine(rootFolderPath) {
    const args = process.argv.slice(2)
    const limitToFolders = []
    if (args.length) {
      console.log(`[Shared] Script will be limited to: ${JSON.stringify(args)}`)

      for (const arg of args) {
        try {
          await fs.stat(path.join(rootFolderPath, arg))
          limitToFolders.push(arg)
          //   console.log(`stat returned: ${JSON.stringify(stat)}`)
        } catch (e) {
          console.log(
            `\nERROR: Invalid Argument: "${arg}"\n  Path: "${e.path}" does not exist.\n  Make sure you are invoking with just the top-level folder name, e.g. \n  jgclark.DailyJournal\nStopping script. Try again!\n`,
          )
          process.exit(0)
        }
      }
    }
    return limitToFolders
  },

  async runShellCommand(command) {
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
  },

  async getPluginFileContents(pluginPath) {
    const jsonFile = path.join(pluginPath, 'plugin.json')
    let pluginFile
    try {
      pluginFile = await JSON.parse(await fs.readFile(jsonFile, 'utf8'))
      // console.log(`Read file ${pluginPath}`)
    } catch (e) {
      console.log(e)
    }
    return pluginFile || {}
  },
}
