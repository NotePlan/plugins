const { colors, helpers, print } = require('@codedungeon/gunner')

module.exports = {
  name: 'plugin:release',
  description: 'Releases Plugin to Public Directory',
  disabled: false,
  hidden: false,
  usage: `plugin:release ${colors.magenta('<plugin>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  arguments: {
    name: {
      description: `Plugin Name ${colors.gray('(e.g., codedungeon.Toolbox')}`,
      required: true,
      prompt: {
        type: 'input',
        hint: '(as it will be saved on disk)',
      },
    },
  },
  flags: {
    // example flag, adjust accordingly
    force: {
      aliases: ['f'],
      type: 'boolean',
      description: `Force Plugin Publish ${colors.gray('(will ignore all validation)')}`,
      required: false,
    },
  },

  async execute(toolbox) {
    const pluginName = toolbox.arguments.name
    const cliArgs = helpers.getArguments(toolbox.arguments, this)

    const answers = { name: pluginName, ...cliArgs }
    toolbox.print.warn(`Release Plugin ${JSON.stringify(answers)}`, 'INFO')
  },
}
