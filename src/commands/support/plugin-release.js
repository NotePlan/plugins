const { filesystem } = require('@codedungeon/gunner')

module.exports = {
  githubInstalled: function () {
    return filesystem.existsSync(`/usr/local/bin/gh`)
  },
}
