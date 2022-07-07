const { filesystem, path } = require('@codedungeon/gunner')
/* eslint-disable */
const appUtils = require('../../utils/app')

module.exports = {
  getTestFilenames: function () {
    const commands = filesystem.directoryList('./', { directoriesOnly: true })

    let result = [] // eslint-disable-line
    commands.forEach((directory) => {
      const dirname = path.join(directory, 'src')
      if (filesystem.existsSync(dirname)) {
        const files = filesystem.readdirSync(dirname).filter((fn) => fn.endsWith('.test.js'))
        if (files.length > 0) {
          files.forEach((filename) => {
            result.push(path.join(dirname, filename))
          })
        }
      }
    })

    return result.flat(2)
  },

  directoriesWithTestFiles: function () {
    const commands = filesystem.directoryList('./', { directoriesOnly: true })

    let result = [] // eslint-disable-line
    commands.forEach((directory) => {
      const dirname = path.join(directory, 'src')
      if (filesystem.existsSync(dirname)) {
        const files = filesystem.readdirSync(dirname).filter((fn) => fn.endsWith('.test.js'))
        if (files.length > 0) {
          result.push(dirname.replace(process.cwd(), '.'))
        }
      }
    })

    return result
  },
}
