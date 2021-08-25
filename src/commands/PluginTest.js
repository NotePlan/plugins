const { colors, helpers, print, system } = require('@codedungeon/gunner')

module.exports = {
  name: 'plugin:test',
  description: 'NotePlan Plugin Testing',
  disabled: false,
  hidden: false,
  usage: `plugin:test ${colors.magenta('<resource>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  arguments: {
    plugin: {
      type: 'string',
      aliases: ['p'],
      description: 'Plugin Name (use all if not supplied)',
      required: false,
    },
  },
  flags: {
    // example flag, adjust accordingly
    watch: {
      aliases: ['w'],
      description: 'Run Command in Watch Mode',
    },
  },

  async execute(toolbox) {
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })
    dd('here')
    const plugin = args.plugin
    const watch = args.watch
    dd({ args, plugin, watch })

    const directory = plugin.length > 0 ? `./${plugin}` : './'
    const cmd = `./node_modules/.bin/jest ${directory} ${watch ? '--watch' : ''}`

    system.run(cmd, true)
  },
}
