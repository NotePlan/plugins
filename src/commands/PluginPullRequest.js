const { colors, helpers, print, system } = require('@codedungeon/gunner')
const pluginPullRequest = require('./support/plugin-pull-request')
const github = require('./support/github')

module.exports = {
  name: 'plugin:pr',
  description: 'Create Pull Request',
  disabled: false,
  hidden: false,
  usage: `plugin:pr ${colors.magenta('<plugin>')} ${colors.blue('[options]')}`,
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
    title: {
      description: 'Pull Request Title',
      required: true,
      prompt: { type: 'input' },
    },
    body: {
      description: 'Pull Request Body',
      required: true,
      prompt: { type: 'input' },
    },
  },

  async execute(toolbox) {
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    if (!github.ghInstalled()) {
      toolbox.print.error('"plugin:pr" requires github to be installed.', 'ERROR')
      toolbox.print.warn('        Please install github and try again')
      toolbox.print.warn('        Installation Instructions: https://github.com/cli/cli')
      process.exit()
    }
    const plugin = args.plugin || toolbox.plugin || ''
    const title = args.title || null
    const body = args.body || ''

    const currentBranch = await github.currentBranch()
    if (currentBranch === 'main') {
      toolbox.print.error('You must be on a feature branch in order to create pull request', 'ERROR')
      toolbox.print.warn(
        `        You can use ${colors.cyan(
          'git checkout -b <branch>',
        )} to create a new branch which can then be used to create pull request`,
      )
      process.exit()
    }

    // all systems go, proceed with create PR (will call gh pr craete)
    const prResult = await system.exec('gh', ['pr', 'create', '--title', `"${title}"`, '--body', `"${body}"`], {
      quiet: true,
    })
  },
}
