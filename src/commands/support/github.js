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

  releaseList: async function (pluginName = '') {
    const result = await system.exec('gh', ['release', 'list'], { quiet: true })

    const releaseLines = result.split('\n')
    const releases = []

    releaseLines.forEach((release) => {
      const parts = release.split('\t')
      const name = parts[0]
      const tag = parts[2]
      if (tag.includes(pluginName)) {
        const dt = parts.length >= 4 ? parts[3].replace('T', ' ').replace('Z', '') : ''
        releases.push({ name, tag, released: dt })
      }
    })

    return releases
  },

  getReleaseCommand: async function (version = null, pluginTitle = null, fileList = null, sendToGithub = false) {
    const changeLog = fileList?.changelog ? `-F "${fileList.changelog}"` : ''
    const cmd = `gh release create "${version}" -t "${pluginTitle}" ${changeLog} ${
      !sendToGithub ? `--draft` : ''
    } ${fileList.files.map((m) => `"${m}"`).join(' ')}`

    return cmd
  },
}
