'use strict'

import { print } from '@codedungeon/gunner'
import Listr from 'listr'
import github from '../github'

/* eslint-disable */
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
