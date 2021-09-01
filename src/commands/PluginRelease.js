const { colors, helpers, print, system } = require('@codedungeon/gunner')

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
    const pluginName = toolbox.arguments.plugin
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const dryRun = args.dryRun || false
    const force = args.force || false

    const result = await system.exec('node', ['scripts/releases.js', pluginName])
  },
}
