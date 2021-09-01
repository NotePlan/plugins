// github utilties
const { filesystem, colors, print, path, system, shell, execa } = require('@codedungeon/gunner')

module.exports = {
  ghInstalled: function () {
    return filesystem.existsSync(`/usr/local/bin/gh`)
  },

  ghVersion: async function () {
    if (!this.ghInstalled()) {
      return 'GITHUB_NOT_INSTALLED'
    }

    const version = await system.exec('gh', ['--version'], { quiet: true })
    return version.split('\n')[0]
  },

  currentBranch: async function () {
    const result = await system.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { quiet: true })
    return result
  },
}
