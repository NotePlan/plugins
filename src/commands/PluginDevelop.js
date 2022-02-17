const { colors, helpers, print, prompt, system, filesystem, path } = require('@codedungeon/gunner')
const { defaultsDeep } = require('lodash')
const tildify = require('tildify')
const pluginUtils = require('./support/plugin-utils')

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
      description: `Plugin Name ${colors.gray('(processes all plugins if not supplied)')}`,
      required: false,
    },
  },
  flags: {
    compact: {
      type: 'boolean',
      aliases: ['c'],
      description: `Use Compact Display ${colors.gray('(available in watch mode)')}`,
    },
    fix: {
      type: 'boolean',
      aliases: ['f'],
      hidden: true,
      description: `Fix Linting Errors ${colors.gray('(used when --lint flag supplied)')}`,
      initial: false,
    },
    lint: {
      type: 'boolean',
      aliases: ['l'],
      description: `Lint Plugin ${colors.gray('(using eslint)')}\n                              ${colors.gray(
        '| use --fix,-f to attempt fixing linting errors',
      )}`,
      initial: false,
    },
    notify: {
      type: 'boolean',
      aliases: ['n'],
      hidden: false,
      description: `Show Notification ${colors.gray('(used when building)')}`,
      initial: false,
    },
    test: {
      type: 'boolean',
      aliases: ['t'],
      description: 'Plugin Testing Mode (running Jest)',
    },
    coverage: {
      type: 'boolean',
      aliases: ['o'],
      description: `Create Test Coverage Report ${colors.gray('(located in ./coverage directory)')}`,
    },
    silent: {
      type: 'boolean',
      aliases: ['s'],
      description: `Run Command in Silent Mode ${colors.gray('(no console.logs)')}`,
    },
    watch: {
      type: 'boolean',
      aliases: ['w'],
      description: `Run Command in Watch Mode ${colors.gray('(continuous develpoment)')}`,
    },
  },

  async execute(toolbox) {
    console.log('')

    const args = helpers.setDefaultFlags(toolbox.arguments, this.flags)

    const plugin = args.plugin || toolbox.plugin || ''
    const lint = args.lint || toolbox.lint || ''
    const fix = args.fix || toolbox.fix || ''
    const notify = args.notify || toolbox.notify || ''
    const watch = args.watch
    const silent = args.silent
    const compact = args.compact
    const test = args.test
    const coverage = args.coverage

    if (lint) {
      if (fix) {
        print.info('Linting fix enabled, will attempt to fix linting errors...')
      } else {
        print.info('Linting In Progress...')
      }

      let ignorePath = ''
      if (filesystem.existsSync(path.join(plugin, '.eslintignore'))) {
        ignorePath = ` --ignore-path "${plugin}/.eslintignore"`
      }

      try {
        const cmd = `./node_modules/.bin/eslint${ignorePath} ./${plugin}/**/*.js ${fix ? '--fix' : ''}`.trim()

        const result = await system.run(cmd, true)

        console.log('')
        print.success('No Linting Errors', 'SUCCESS')
        process.exit()
      } catch (error) {
        print.error('Linting Errors Found', 'FAIL')
      }
      process.exit()
    }

    if (plugin.length > 0) {
      if (!pluginUtils.isValidPlugin(plugin)) {
        console.log('')
        toolbox.print.error(`Unable to locate plugin "${plugin}" in current directory`, 'ERROR')
        toolbox.print.warn(`        Make sure plugin name is spelled correct (case sensitive matters)`)
        process.exit()
      }

      if (!pluginUtils.isPluginRootDirectory()) {
        console.log('')
        toolbox.print.error(`You must be in project root directory`, 'ERROR')
        toolbox.print.log(
          `        Check to make sure you are in ${colors.yellow(
            tildify(pluginUtils.getProjectRootDirectory()),
          )} directory`,
        )
        process.exit()
      }
    }

    let cmd = ''
    if (!test) {
      const pluginList = pluginUtils.getPluginList()
      if (plugin.length === 0 && !watch) {
        const response = await prompt.confirm(
          `You are about to build ${colors.cyan.bold(pluginList.length)} plugins.  Would you like to continue`,
        )
        if (!response.answer) {
          process.exit()
        }
      }
      cmd = watch
        ? `node scripts/rollup.js ${plugin} ${compact ? '--compact' : ''} ${notify ? '--notify' : ''}`
        : `node scripts/rollup.js ${plugin} --build ${notify ? '--notify' : ''}`
    } else {
      const directory = plugin.length > 0 ? `${plugin}` : ''
      cmd = `./node_modules/.bin/jest ${directory} ${silent ? '--silent' : ''} ${watch ? '--watch' : ''} ${
        coverage ? '--coverage' : ''
      } --verbose false`
      cmd = `noteplan-cli plugin:test ${directory} ${silent ? '--silent' : ''} ${watch ? '--watch' : ''} ${
        coverage ? '--coverage' : ''
      } --verbose false`
    }

    system.run(cmd, true)
  },
}
