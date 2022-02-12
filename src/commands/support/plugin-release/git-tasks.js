'use strict'

const { print } = require('@codedungeon/gunner')
const Listr = require('listr')
const github = require('../github')

module.exports = (pluginName, options) => {
  const tasks = [
    {
      title: 'Verifying Github',
      task: () => {
        if (!github.ghInstalled()) {
          print.error('"plugin:release" requires github to be installed.', 'ERROR')
          process.exit()
        }
      },
    },
  ]

  return new Listr(tasks)
}
