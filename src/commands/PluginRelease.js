const { colors } = require('@codedungeon/gunner')

module.exports = {
  name: 'plugin:release',
  description: 'Generates command argument or flag',
  disabled: true,
  hidden: false,
  usage: `plugin:release ${colors.magenta('<plugin name>')} ${colors.gray('(e.g., codedungeon.Toolbox)')}`,
  usePrompts: true,
  arguments: {
    name: {
      description: 'Plugin Name',
      required: true,
    },
  },
  flags: {},

  async execute(toolbox) {
    console.log('')
    toolbox.print.debug(`==> Publish ${toolbox.name}`)
  },
}
