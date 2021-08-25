const { colors, helpers, print, system } = require('@codedungeon/gunner')

module.exports = {
  name: 'plugin:dev',
  description: 'Plugin Build / Testing Commands',
  disabled: false,
  hidden: false,
  usage: `plugin:dev ${colors.magenta('<resource>')} ${colors.blue('[options]')}`,
  examples: [
    `plugin:dev ${colors.magenta('codedungeon.Toolbox')} ${colors.gray('(build plugin)')}`,
    `plugin:dev ${colors.magenta('codedungeon.Toolbox')} ${colors.cyan('--watch')} ${colors.gray(
      '(builds plugin in watch mode)',
    )}`,
    `plugin:dev ${colors.magenta('codedungeon.Toolbox')} ${colors.cyan('--test')} ${colors.gray(
      '(runs plugin test suite)',
    )}`,
    `plugin:dev ${colors.magenta('codedungeon.Toolbox')} ${colors.cyan('--test --watch')}`,
  ],
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
    compact: {
      type: 'boolean',
      aliases: ['c'],
      description: `Use Compact Display ${colors.gray('(available in watch mode)')}`,
    },
    test: {
      type: 'boolean',
      aliases: ['t'],
      description: 'Plugin Testing Mode (running Jest)',
    },
    watch: {
      type: 'boolean',
      aliases: ['w'],
      description: `Run Command in Watch Mode ${colors.gray('(continuous develpoment)')}`,
    },
  },

  async execute(toolbox) {
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })
    const plugin = args.plugin || toolbox.plugin || null
    const watch = args.watch
    const compact = args.compact
    const test = args.test

    let cmd = ''
    if (!test) {
      cmd = watch
        ? `node scripts/rollup.js ${compact ? '--compact' : ''} ${plugin}`
        : `node scripts/rollup.js ${plugin} --build`
    } else {
      const directory = plugin.length > 0 ? `./${plugin}` : './'
      cmd = `./node_modules/.bin/jest ${directory} ${watch ? '--watch' : ''}`
    }

    system.run(cmd, true)
  },
}
