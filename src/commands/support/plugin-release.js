const { filesystem, colors, print, path, system } = require('@codedungeon/gunner')
const tildify = require('tildify')
const appUtils = require('../../utils/app')
const github = require('./github')

module.exports = {
  fail: function (message, ...args) {
    return { status: false, message, args }
  },

  success: function (message, ...args) {
    return { status: true, message, args }
  },

  checkVersion: async function (pluginName) {
    const pluginPath = path.resolve(pluginName)
    const configData = appUtils.getPluginConfig(pluginPath)
    const pluginVersion = configData['plugin.version']

    const releaseList = await github.releaseList(pluginName, pluginVersion)

    const matching = releaseList.filter((release) => {
      return release.tag.includes(`${pluginName}-v${pluginVersion}`)
    })

    return matching.length === 0
  },

  verifyPluginData: async function (pluginName = '') {
    const requiredKeys = [
      'macOS.minVersion',
      'noteplan.minAppVersion',
      'plugin.id',
      'plugin.name',
      'plugin.description',
      'plugin.author',
      'plugin.version',
      'plugin.script',
      'plugin.url',
      'plugin.commands',
    ]
    const missingItems = []
    const configData = appUtils.getPluginConfig(pluginName)
    requiredKeys.forEach((key) => {
      !configData.hasOwnProperty(key) ? missingItems.push(key) : null
    })

    return missingItems
  },

  validate: async function (pluginName = '', flags = {}) {
    if (!github.ghInstalled()) {
      return this.fail(
        '"plugin:release" requires github to be installed.',
        'Installation Instructions: https://github.com/cli/cli',
      )
    }

    const pluginPath = path.resolve(pluginName)
    if (!filesystem.existsSync(pluginPath)) {
      return this.fail('Plugin Not Found', tildify(pluginPath))
    }

    const pluginJsonFilename = path.join(pluginPath, 'plugin.json')
    if (!filesystem.existsSync(pluginJsonFilename)) {
      return this.fail('Missing Project "plugin.json"', tildify(pluginJsonFilename))
    }

    // load plugin.json, data will be used below
    const configData = appUtils.getPluginConfig(pluginPath)

    const missingItems = await this.verifyPluginData(pluginName)
    if (missingItems.length > 0) {
      return this.fail('Missing plugin.json items', missingItems.join(', '))
    }

    if (!(await this.checkVersion(pluginName))) {
      const existingReleaseName = `${pluginName} v${configData['plugin.version']}`
      return this.fail(
        `Release matching ${colors.cyan(existingReleaseName)} has already been released.`,
        'You will need to bump version number, or delete existing release',
      )
    }

    const fileList = this.getFileList(pluginName)

    const cmd = await github.getReleaseCommand(
      configData['plugin.version'],
      configData['plugin.name'],
      fileList,
      flags.dryRun,
    )

    return this.success(cmd)
  },

  getFileList: function (pluginName = null) {
    if (!pluginName) {
      throw new Error('getFileList Missing pluginName')
    }
    const fileList = []
    const pluginPath = path.join(pluginName)

    const changeLogFilename = path.join(pluginPath, 'CHANGELOG.md')

    const pluginJsonFilename = path.join(pluginPath, 'plugin.json')
    filesystem.existsSync(pluginJsonFilename) ? fileList.push(pluginJsonFilename) : null

    const scriptFilename = path.join(pluginPath, 'script.js')
    filesystem.existsSync(scriptFilename) ? fileList.push(scriptFilename) : null

    const readmeFilename = path.join(pluginPath, 'README.md')
    filesystem.existsSync(readmeFilename) ? fileList.push(readmeFilename) : null

    const licenseFilename = path.join(pluginPath, 'LICENSE')
    filesystem.existsSync(licenseFilename) ? fileList.push(licenseFilename) : null

    const response = { files: fileList }
    if (filesystem.existsSync(changeLogFilename)) {
      response.changelog = changeLogFilename
    }

    return response
  },

  release: async function (pluginName = null, flags = {}) {
    const configData = appUtils.getPluginConfig(path.resolve(pluginName))
    const fileList = this.getFileList(pluginName)

    const cmd = await github.getReleaseCommand(
      configData['plugin.version'],
      configData['plugin.name'],
      fileList,
      flags.dryRun,
    )

    if (flags.dryRun) {
      return { status: true, message: cmd }
    } else {
      const executeResult = system.run(cmd, true)
      console.log(executeResult)
    }
  },
}
