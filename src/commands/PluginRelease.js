const { colors, helpers, print, strings, system, prompt } = require('@codedungeon/gunner')
const Messenger = require('@codedungeon/messenger')
const appUtils = require('../utils/app')
const security = require('../utils/security.lib')
const pluginUtils = require('./support/plugin-utils')
const pluginRelease = require('./support/plugin-release')
const releasePrompts = require('./support/plugin-release/release-prompts')
const github = require('./support/github')

module.exports = {
  name: 'plugin:release',
  description: `Releases Plugin to Public Directory ${colors.red('** Access Required **')}`,
  disabled: false,
  hidden: false,
  usage: `plugin:release ${colors.magenta('<plugin>')} ${colors.blue('[options]')}`,
  usePrompts: false,
  arguments: {
    plugin: {
      type: 'string',
      aliases: ['p'],
      description: 'Plugin Name',
      required: false,
      prompt: {
        type: 'input',
        description: 'Plugin Name',
        hint: 'e.g., codedungeon.Toolbox',
        disabled: false,
      },
    },
  },
  flags: {
    draft: {
      aliases: ['d'],
      type: 'boolean',
      description: `Create Draft Github Release`,
    },
    force: {
      aliases: ['f'],
      type: 'boolean',
      description: `Force Plugin Publish ${colors.gray('(will ignore all non required validations)')}`,
      required: false,
    },
    noBuild: {
      aliases: ['b'],
      type: 'boolean',
      description: `Skip Build Process ${colors.gray('(will use current build)')}`,
      required: false,
    },
    noTests: {
      aliases: ['t'],
      type: 'boolean',
      description: `Skip Tests`,
      required: false,
    },
    preview: {
      aliases: ['p'],
      type: 'boolean',
      description: `Show tasks without actually executing them`,
    },
  },

  async execute(toolbox) {
    const answers = await prompt.password('Enter Password')
    if (typeof answers !== 'object') {
      console.log('')
      print.warn('Release Aborted', 'ABORT')
      process.exit()
    }

    if (!security.validate(answers.password)) {
      console.log('')
      print.error('Invalid Password', 'ABORT')
      process.exit()
    }

    if (toolbox.plugin.length === 0) {
      // no plugin supplied, use `plugin.prompt` interface
      this.arguments.plugin.prompt.disabled = false
      this.arguments.plugin.prompt.type = 'select'
      this.arguments.plugin.prompt.choices = pluginUtils.getPluginList()

      const answers = await toolbox.prompts.run(toolbox, this)
      toolbox.arguments.plugin = answers.commandName
    }

    console.log('')
    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const pluginName = args.plugin || toolbox.arguments.plugin || null
    const draft = args.draft || false
    const preview = args.preview || false
    const force = args.force || false
    const noTests = args.noTests || false
    const noBuild = args.noBuild || false

    const configData = pluginUtils.getPluginConfig(pluginName)

    const pluginVersion = configData['plugin.version']

    // const pluginJsonFilename = path.resolve(pluginName, 'plugin.json')
    let nextVersion = configData['plugin.version']
    if (!(await pluginUtils.checkVersion(pluginName, nextVersion))) {
      const existingReleaseName = `${pluginName} v${configData['plugin.version']}`
      print.warn(`Release matching ${colors.cyan(existingReleaseName)} has already been published.`, 'HALT')
      print.info(`       https://github.com/NotePlan/plugins/releases/tag/${pluginName}-v${nextVersion}`)
      console.log('')
      const version = await releasePrompts.versionPrompt(configData['plugin.version'])
      if (!version) {
        print.warn('Release Cancelled', 'ABORT')
        process.exit()
      } else {
        nextVersion = strings.raw(version)
        if (version === 'Abort') {
          print.warn('Release Cancelled', 'ABORT')
          process.exit()
        }
      }
    }

    if (!args.force && !(await pluginUtils.checkChangelogNotes(pluginName, nextVersion))) {
      print.warn(`Your ${colors.cyan('CHANGELOG.md')} does not contain information for v${nextVersion}`, 'WARN')
      console.log('')
      const changelogPrompt = await prompt.toggle('Would you like to continue without updating CHANGELOG.md?')
      if (!changelogPrompt || !changelogPrompt.answer) {
        console.log('')
        print.warn('Release Cancelled', 'ABORT')
        process.exit()
      }
    }

    // const currentBranch = await github.currentBranch()
    // if (!preview && currentBranch !== 'main') {
    //   print.warn('You must be on "main" branch to release plugins', 'ABORT')
    //   process.exit()
    // }

    const runner = pluginRelease.run(pluginName, nextVersion, args)
  },
}
