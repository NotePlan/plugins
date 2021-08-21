const { filesystem, colors, print, path } = require('@codedungeon/gunner')

module.exports = {
  githubInstalled: function () {
    return filesystem.existsSync(`/usr/local/bin/gh`)
  },
}
