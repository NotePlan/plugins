const { colors, helpers, system } = require('@codedungeon/gunner')
const pluginTest = require('./support/plugin-test')

module.exports = {
  name: 'plugin:test',
  description: 'Plugin Testing Commands',
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
    coverage: {
      aliases: ['o'],
      description: `Create Test Coverage Report ${colors.gray('(located in ./coverage directory)')}`,
    },
    silent: {
      aliases: ['s'],
      description: 'Run Command in Silent Mode (no console.logs)',
    },
    watch: {
      aliases: ['w'],
      description: 'Run Command in Watch Mode',
    },
  },

  execute(toolbox) {
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const plugin = args.plugin || toolbox.plugin || ''
    const watch = args.watch
    const silent = args.silent
    const coverage = args.coverage

    const testDirectories = pluginTest.directoriesWithTestFiles()

    let directory = ''
    if (plugin.length > 0) {
      directory = `./${plugin}`
    } else {
      directory = testDirectories.join(' ')
    }

    directory += '/__tests__/*.test.js'
    const cmd = `./node_modules/.bin/jest ${directory} ${silent ? '--silent' : ''} ${watch ? '--watch' : ''} ${
      coverage ? '--coverage' : ''
    }`.trim()

    system.run(cmd, true)
  },
}
