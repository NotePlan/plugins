const { colors, helpers, print } = require('@codedungeon/gunner')
const pluginPullRequest = require('./support/plugin-pull-request')

module.exports = {
  name: 'plugin:pr',
  description: 'Create Pull Request',
  disabled: true,
  hidden: true,
  usage: `plugin:pr ${colors.magenta('<resource>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  arguments: {
    plugin: {
      description: 'Plugin Name',
      required: true,
      prompt: {
        type: 'input',
        hint: '(e.g., codedungeon.Toolbox)',
      },
    },
  },
  flags: {
    // example flag, adjust accordingly
    subject: {
      description: 'Pull Request Subject',
      required: true,
      prompt: { type: 'input' },
    },
  },

  async execute(toolbox) {
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const plugin = args.plugin || toolbox.plugin || ''
    const subject = args.subject || null

    console.log({ plugin, subject })
  },
}
