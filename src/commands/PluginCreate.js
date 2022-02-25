const { colors, helpers, print, path } = require('@codedungeon/gunner')
const gitUserLocal = require('git-user-local')
const githubUsername = require('github-username')
const createPlugin = require('./support/plugin-create')

module.exports = {
  name: 'plugin:create',
  description: 'Create New NotePlan Plugin Project',
  disabled: false,
  hidden: false,
  usage: `plugin:create ${colors.magenta('<resource>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  autoPrompt: true,
  arguments: {
    name: {},
  },
  flags: {
    id: {
      type: 'string',
      aliases: ['i'],
      description: `Unique Plugin ID ${colors.gray('(recommended format "<githubUserName.PluginName>" e.g., "codedungeon.Toolbox")')}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
    name: {
      type: 'string',
      aliases: ['n'],
      description: `Plugin Name ${colors.gray('(this will appear in NotePlan Plugins menu)')}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
    description: {
      type: 'string',
      aliases: ['d'],
      description: `Plugin Description ${colors.gray('(as it will appear in NotePlan Plugins Preferences)')}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
    author: {
      type: 'string',
      aliases: ['a'],
      description: `Plugin Author ${colors.gray('(Can be an individual or organization)')}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
  },

  async execute(toolbox) {
    const ghUserLocal = await gitUserLocal()
    const ghUserName = await githubUsername(ghUserLocal.user.email)

    const cliArgs = helpers.getArguments(toolbox.arguments, this)

    let flags = null

    const hasCommandLineItems = cliArgs.id && cliArgs.name && cliArgs.description && cliArgs.author && false

    if (!hasCommandLineItems) {
      // print.note('', 'INSTRUCTIONS')
      // console.log('')
      // print.note('The following items will be used to generate your new NotePlan plugin:')
      // print.note(` • Supply values for each field in ${colors.cyan('blue')}`)
      // print.note(' • Press <tab> to move between fields')
      // print.note(' • Press <cmd-c> to abort')
      // print.note(' • When complete, press <enter or return>')
      console.log('')
      const promptResult = await createPlugin.run(toolbox)

      if (promptResult) {
        flags = { ...promptResult }
      } else {
        print.warning('Plugin Creation Aborted', 'ABORT')
        process.exit()
      }
    } else {
      const promptArgs = helpers.getArguments(toolbox.arguments, this)

      const answers = await toolbox.prompts.run(toolbox, this)

      flags = {
        ...{
          pluginId: promptArgs.id || answers?.id,
          pluginName: promptArgs.name || answers?.name,
          pluginDescription: promptArgs.description || answers?.description,
          pluginAuthor: promptArgs.author || answers?.author,
        },
      }
    }

    flags.pluginName = flags.pluginName?.split('.').pop()

    // all good, createPlugin
    const pluginPath = path.join(process.cwd(), flags.pluginId)
    console.log()
    flags.ghUserName = ghUserName

    const createResult = createPlugin.createPlugin(pluginPath, flags)

    console.log(colors.green.bold(`✔ ✨ Project Initialized in ${colors.yellow.bold(pluginPath)}`))
    console.log(colors.green.bold('✔ 📦 Project Files Created'))
    console.log(colors.green.bold('✔ 🧩 Project Creation Complete'))

    print.info('\n👉 Next Steps:\n')
    print.info(`   ${toolbox.colors.gray('$')} cd ${flags.pluginId}`)
    print.info(`   ${toolbox.colors.gray('$')} noteplan-cli plugin:dev ${flags.pluginId} --watch`)
    console.log('')
    print.info(`   - If NotePlan is running, quit and relaunch`)
    print.info(`   - run your new plugin command ${colors.yellow('/helloWorld')} from NotePlan Command Bar or in inline`)
    console.log('')
    print.warn(`Use ${colors.cyan('noteplan-cli plugin:info --check <your_command>')} to check if desired command is available`, 'TIP')
  },
}
