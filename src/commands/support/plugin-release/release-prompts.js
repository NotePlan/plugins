'use strict'
const util = require('util')
const bump = require('bump-regex')
const { colors, prompt, strings } = require('@codedungeon/gunner')
const bumpVersion = util.promisify(bump)
const semver = require('semver')

module.exports = {
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

  versionPrompt: async function (currentVersion) {
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

  changelogPrompt: async function (pluginName, pluginVersion) {},
}
