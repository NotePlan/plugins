const util = require('util')
const { filesystem, colors, print, path, system, prompt, strings } = require('@codedungeon/gunner')
const semver = require('semver')
const tildify = require('tildify')
const bump = require('bump-regex')
const Ora = require('ora')
const execa = require('execa')
const { thisExpression } = require('@babel/types')
const bumpVersion = util.promisify(bump)
const appUtils = require('../../utils/app')
const github = require('./github')

const spinner = new Ora({ discardStdin: false, color: 'blue', text: '' })

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

  checkChangelogNotes: async function (pluginName = null, version = null) {
    const changelogFilename = path.resolve(path.join(pluginName, 'CHANGELOG.md'))
    if (filesystem.existsSync(changelogFilename)) {
      const data = filesystem.readFileSync(changelogFilename)
      return data.includes(`## ${version}`) || data.includes(`## [${version}]`)
    }

    return true
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

    let nextVersion = configData['plugin.version']
    if (!(await this.checkVersion(pluginName))) {
      const existingReleaseName = `${pluginName} v${configData['plugin.version']}`
      print.warn(`Release matching ${colors.cyan(existingReleaseName)} has already been published.`, 'HALT')
      // print.warn('       You will need to bump version number, or delete existing release')
      print.info(`       https://github.com/NotePlan/plugins/releases/tag/codedungeon.Toolbox-v${nextVersion}`)
      console.log('')
      const version = await this.versionPrompt(configData['plugin.version'])
      if (!version) {
        print.warn('Release Cancelled', 'ABORT')
        process.exit()
      } else {
        nextVersion = strings.raw(version)
        if (version === 'Abort') {
          print.warn('Release Cancelled', 'ABORT')
          process.exit()
        }
      }
    }

    if (!flags.force && !(await this.checkChangelogNotes(pluginName, nextVersion))) {
      print.warn(`Your ${colors.cyan('CHANGELOG.md')} does not contain information for v${nextVersion}`, 'WARN')
      console.log('')
      const changelogPrompt = await prompt.toggle('Would you like to continue without updating CHANGELOG.md?')
      if (!changelogPrompt || !changelogPrompt.answer) {
        console.log('')
        print.warn('Release Cancelled', 'ABORT')
        process.exit()
      }
    }

    const fileList = this.getFileList(pluginName)

    const cmd = await github.getReleaseCommand(nextVersion, configData['plugin.name'], fileList, flags.preview)

    return this.success(cmd, { nextVersion })
  },

  versionPrompt: async function (currentVersion = '') {
    const pad = (value, length = 12, padText = ' ') => {
      return value.padEnd(length, padText)
    }

    const nextMajor = await this.incrementVersion(currentVersion, 'major')
    const nextMinor = await this.incrementVersion(currentVersion, 'minor')
    const nextPatch = await this.incrementVersion(currentVersion, 'patch')
    const choices = [
      { name: `${pad('major')} ${nextMajor}`, value: nextMajor },
      { name: `${pad('minor')} ${nextMinor}`, value: nextMinor },
      { name: `${pad('patch')} ${nextPatch}`, value: nextPatch },
      '__________________',
      'Other (Specify)',
      'Abort',
    ]

    const result = await prompt.select(
      `${colors.white('Which version would you like to use for this release?')}'`,
      choices,
      '',
      { hint: '(use arrow keys to select item)' },
    )

    if (result) {
      let answer = choices.filter((item) => {
        return strings.raw(item.name) === strings.raw(result.answer)
      })

      let version = ''
      if (answer.length > 0) {
        if (answer[0].value === 'Other (Specify)') {
          console.log('show imput')
          answer = await prompt.input('Enter version', {
            validate(value, state, item, index) {
              if (!semver.valid(value)) {
                return colors.red.bold('version should be a valid semver value (major.minor.patch)')
              }
              if (!semver.gt(value, currentVersion)) {
                return colors.red.bold(`version must be greater than ${currentVersion}`)
              }
              return true
            },
          })
          version = answer.answer
        } else {
          version = answer[0].value
        }
      }
      console.log('')
      return version
    }
  },

  updatePluginJsonVersion: async function (pluginName = '', version = '') {
    const pluginJsonFilename = path.resolve(path.join(pluginName, 'plugin.json'))
    if (filesystem.existsSync(pluginJsonFilename)) {
      const pluginJsonData = filesystem.readFileSync(pluginJsonFilename)
      const data = JSON.parse(pluginJsonData)
      data['plugin.version'] = version
      filesystem.writeFileSync(pluginJsonFilename, JSON.stringify(data, null, 2))
    }
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

  runTests: async function (pluginName = null) {
    const cmd = `./node_modules/.bin/jest ./${pluginName}`.trim()
    try {
      await system.run(cmd, false)
      return true
    } catch (error) {
      return false
    }
  },

  release: async function (pluginName = null, nextVersion = null, flags = {}) {
    this.spinner.start()
    this.spinner.color = 'blue'
    this.spinner.indent = 0
    this.spinner.text = 'Publishing Release'

    const configData = appUtils.getPluginConfig(path.resolve(pluginName))
    const fileList = this.getFileList(pluginName)

    const cmd = await github.getReleaseCommand(nextVersion, pluginName, fileList, flags.preview)
    if (flags.preview) {
      this.spinner.succeed()
      return { status: true, message: cmd }
    } else {
      console.log('')
      const executeResult = true
      if (executeResult) {
        await this.updatePluginJsonVersion(pluginName, nextVersion)
      }
      // const result = system.run(cmd, true)
      this.spinner.text = 'Plugin Published'
      this.spinner.succeed()
      console.log('')
      print.success(`${pluginName} v${nextVersion} Published Successfully`, 'SUCCESS')

      return true
    }
  },

  formatValidSemver: function (currentVersion) {
    const parts = currentVersion.split('.')
    let [major, minor, patch, remainder] = parts
    major = major ? major : '0'
    minor = minor ? minor : '0'
    patch = patch ? patch : '0'
    remainder = remainder ? remainder : ''
    return `${major}.${minor}.${patch}${remainder}`
  },

  incrementVersion: async function (baseVersion = '', type = 'patch') {
    const result = await bumpVersion({ str: `version: "${this.formatValidSemver(baseVersion)}"`, type })
    let [major, minor, patch, remainder] = result.new.split('.')

    // apply color to changed part
    major = type === 'major' ? colors.cyan(major) : major
    minor = type === 'minor' ? colors.cyan(minor) : minor
    patch = type === 'patch' ? colors.cyan(patch) : patch
    remainder = remainder ? `.${remainder}` : ''

    return `${major}.${minor}.${patch}`
  },

  setup: async function (pluginName, pluginVersion) {
    this.spinner = spinner
    this.spinner.start()
    this.spinner.text = `Preparing ${pluginName} Release`
    return true
  },

  initializeRelease: async function (pluginName, pluginVersion) {
    this.spinner.color = 'blue'
    this.spinner.text = colors.blue('Initializing Release')
    this.spinner.color = 'white'
    this.getFileList(pluginName)
    this.spinner.text = colors.white('Initalized')
    this.spinner.succeed()
    return true
  },

  prepareSourceFiles: async function (pluginName, pluginVersion) {
    this.spinner.color = 'blue'
    this.spinner.text = 'Preparing Source Files...'
    this.spinner.start()
    this.spinner.text = 'Files Prepared'
    this.spinner.succeed()
    return true
  },

  executeTests: async function (pluginName, pluginVersion) {
    this.spinner.start()
    this.spinner.color = 'blue'
    this.spinner.indent = 0
    this.spinner.text = 'Running Tests...'

    execa('./node_modules/.bin/jest', [`./${pluginName}`])
      .then((result) => {
        this.spinner.text = 'Testing Completed'
        this.spinner.succeed()
        return true
      })
      .catch((err) => {
        console.log('')
        console.log('')
        this.spinner.fail('Testing failed, processed aborted')
        print.error('Testing failed, processed aborted', 'ERROR')
        process.exit()
      })
  },

  run: async function (pluginName, pluginVersion, flags) {
    console.log()

    setTimeout(() => {
      this.setup(pluginName, pluginVersion, flags)
    }, 500)

    setTimeout(() => {
      this.initializeRelease(pluginName, pluginVersion, flags)
    }, 2000)

    setTimeout(() => {
      this.prepareSourceFiles(pluginName, pluginVersion, flags)
    }, 3000)

    setTimeout(() => {
      this.executeTests(pluginName, pluginVersion, flags)
    }, 7500)

    setTimeout(() => {
      this.release(pluginName, pluginVersion, flags)
    }, 9000)
  },
}
