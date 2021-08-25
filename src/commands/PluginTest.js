const { colors, helpers, print, system } = require('@codedungeon/gunner')
const pluginTest = require('./support/plugin-test')

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

    const plugin = args.plugin || toolbox.plugin || ''
    const watch = args.watch

    const testDirectories = pluginTest.directoriesWithTestFiles()

    let directory = ''
    if (plugin.length > 0) {
      directory = `./${plugin}`
    } else {
      directory = testDirectories.join(' ')
    }

    const cmd = `./node_modules/.bin/jest ${directory} ${watch ? '--watch' : ''}`.trim()

    system.run(cmd, true)
  },
}
