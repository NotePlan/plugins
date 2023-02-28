'use strict'

/* eslint-disable */
import { colors, filesystem, path, print, strings } from '@codedungeon/gunner'
import Listr from 'listr'
import tildify from 'tildify'
import pluginUtils from '../plugin-utils'

/* eslint-disable */
module.exports = (pluginName, options) => {
  const tasks = [
    {
      title: 'Verifying Plugin',
      task: () => {
        const pluginPath = path.resolve(pluginName)
        if (!filesystem.existsSync(pluginPath)) {
          print.error('Plugin Not Found', 'ERROR')
          print.warn(`        ${tildify(pluginPath)}`)
          process.exit()
        }
      },
    },

    {
      title: 'Verifying Plugin Configuration',
      task: () => {
        const pluginPath = path.resolve(pluginName)
        const pluginJsonFilename = path.join(pluginPath, 'plugin.json')
        if (!filesystem.existsSync(pluginJsonFilename)) {
          print.error('Missing Project "plugin.json"', 'ERROR')
          print.warn(`        ${tildify(pluginJsonFilename)}`)
          process.exit()
        }
      },
    },

    {
      title: 'Verifying Plugin Configuration',
      task: async () => {
        const pluginPath = path.resolve(pluginName)

        const configData = pluginUtils.getPluginConfig(pluginPath)

        const missingItems = await pluginUtils.verifyPluginData(pluginName)
        if (missingItems.length > 0) {
          print.error('Missing configuration items', 'ERROR')
          print.warn(`        ${missingItems.join(', ')}`)
          process.exit()
        }
      },
    },
  ]

  return new Listr(tasks)
}
