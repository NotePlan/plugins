const { colors, helpers, print, system } = require('@codedungeon/gunner')
const Messenger = require('@codedungeon/messenger')
const appUtils = require('../utils/app')
const pluginRelease = require('./support/plugin-release')

module.exports = {
  name: 'plugin:release-old',
  description: 'Releases Plugin to Public Directory',
  disabled: true,
  hidden: true,
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
      description: `Force Plugin Publish ${colors.gray('(will ignore all non required validations)')}`,
      required: false,
    },
    noTests: {
      aliases: ['t'],
      type: 'boolean',
      description: `Skip Tests`,
      required: false,
    },
    preview: {
      aliases: ['p'],
      type: 'boolean',
      description: `Show tasks without actually executing them`,
    },
  },

  async execute(toolbox) {
    let result = {}

    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const pluginName = args.plugin || toolbox.arguments.plugin || null
    const preview = args.preview || false
    const force = args.force || false
    const noTests = args.noTests || false

    const configData = appUtils.getPluginConfig(pluginName)
    const pluginVersion = configData['plugin.version']

    if (preview) {
      Messenger.line('-')
      print.log(args, 'DEBUG')
      Messenger.line('-')
      console.log('')
    }

    if (!noTests) {
      result = await pluginRelease.runTests(pluginName)
      if (!result) {
        console.log('')
        print.error('Testing failed, release cancelled.', 'ERROR')
        process.exit()
      } else {
        console.log('')
      }
    }

    result = await pluginRelease.validate(pluginName, args)
    const nextVersion = result.args[0].nextVersion

    if (!result.status) {
      appUtils.errorMessage(result)
      process.exit(0)
    } else {
      const runner = pluginRelease.run(pluginName, nextVersion, args)
    }
  },
}
