const { colors, helpers, print, system } = require('@codedungeon/gunner')
const Messenger = require('@codedungeon/messenger')
const appUtils = require('../utils/app')
const pluginRelease = require('./support/plugin-release')

module.exports = {
  name: 'plugin:release',
  description: 'Releases Plugin to Public Directory',
  disabled: false,
  hidden: false,
  usage: `plugin:release ${colors.magenta('<plugin>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  arguments: {
    plugin: {
      type: 'string',
      aliases: ['p'],
      description: 'Plugin Name',
      required: true,
      prompt: {
        type: 'input',
        description: 'Plugin Name',
        hint: 'e.g., codedungeon.Toolbox',
        required: true,
      },
    },
  },
  flags: {
    force: {
      aliases: ['f'],
      type: 'boolean',
      description: `Force Plugin Publish ${colors.gray('(will ignore all validation)')}`,
      required: false,
    },
    dryRun: {
      aliases: ['d'],
      type: 'boolean',
      description: `Execute Dry Run (plugin is not actually released)`,
    },
  },

  async execute(toolbox) {
    let result = {}

    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const pluginName = args.plugin || toolbox.arguments.plugin || null
    const dryRun = args.dryRun || false
    const force = args.force || false

    const configData = appUtils.getPluginConfig(pluginName)
    const pluginVersion = configData['plugin.version']

    if (dryRun) {
      Messenger.line('-')
      print.log(args, 'DEBUG')
      Messenger.line('-')
      console.log('')
    }

    result = await pluginRelease.validate(pluginName, args)
    const nextVersion = result.args[0].nextVersion

    if (!result.status) {
      appUtils.errorMessage(result)
      process.exit(0)
    } else {
      // all cood, continue
      result = await pluginRelease.release(pluginName, nextVersion, args)
      if (!result) {
        print.error(`An error occured publish ${pluginName}`, 'ERROR')
        process.exit()
      }
    }

    if (!dryRun) {
      appUtils.successMessage({ message: `${pluginName} v${nextVersion} Published Successfully` })
    } else {
      print.warn(`${pluginName} v${pluginVersion} will be published using command`, 'DRY RUN')
      console.log('')
      print.warn(result.message)
    }
  },
}
