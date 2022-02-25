const { colors, helpers, print, system } = require('@codedungeon/gunner')
const pluginPullRequest = require('./support/plugin-pull-request')
const github = require('./support/github')

module.exports = {
  name: 'plugin:pr',
  description: 'Create Plugin Pull Request',
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

    const remoteUrl = await github.getRemoteUrl()
    if (remoteUrl === 'https://github.com/NotePlan/plugins.git') {
      toolbox.print.error('You must submit pull requests from a fork of NotePlan Plugin Repositor', 'ERROR')
      toolbox.print.log(`        Current Remote URL: ${colors.cyan(remoteUrl)}`)
      process.exit()
    }

    const gitStatus = await github.check('')
    if (gitStatus?.dirty) {
      const countMessage = gitStatus.dirty === 1 ? 'change' : 'changes'
      toolbox.print.error(`Pull Request Aborted`, 'ABORT')
      toolbox.print.warn(`        You have ${gitStatus.dirty} uncomitted ${countMessage}. Please commit and try again`)
      process.exit()
    }

    if (!github.ghInstalled()) {
      toolbox.print.error('"plugin:pr" requires github to be installed.', 'ERROR')
      toolbox.print.warn('        Installation Instructions: https://github.com/cli/cli')
      process.exit()
    }

    const plugin = args.plugin || toolbox.plugin || ''
    const title = args.title || null
    const body = args.body || ''

    const currentBranch = await github.currentBranch()
    if (currentBranch === 'main') {
      toolbox.print.error('You must be on a feature branch in order to create pull request', 'ERROR')
      toolbox.print.warn(`        You can use ${colors.cyan('git checkout -b <branch>')} to create a new branch which can then be used to create pull request`)
      process.exit()
    }

    dd('here')
    // all systems go, proceed with create PR (will call gh pr craete)
    const prResult = await system.exec('gh', ['pr', 'create', '--title', `"${title}"`, '--body', `"${body}"`], {
      quiet: false,
    })
  },
}
