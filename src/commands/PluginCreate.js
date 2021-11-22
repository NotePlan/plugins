const { colors, helpers, print, path } = require('@codedungeon/gunner')
const createPlugin = require('./support/plugin-create')

module.exports = {
  name: 'plugin:create',
  description: 'Creates NotePlan Plugin Project',
  disabled: false,
  hidden: false,
  usage: `plugin:create ${colors.magenta('<resource>')} ${colors.blue('[options]')}`,
  usePrompts: true,
  arguments: {
    name: {},
  },
  flags: {
    id: {
      type: 'string',
      aliases: ['i'],
      description: `Unique Plugin ID (recommend githubUserName.PluginName) ${colors.gray('e.g., codedungeon.Toolbox')}`,
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
      description: `Plugin Description (as it will appear in NotePlan Plugins Prefrences) ${colors.gray(
        'e.g., Workflow Helpers',
      )}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
    author: {
      type: 'string',
      aliases: ['a'],
      description: `Plugin Author ${colors.gray('Can be an individual or organization')}`,
      required: true,
      prompt: {
        type: 'input',
      },
    },
  },

  async execute(toolbox) {
    const cliArgs = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    let flags = null

    const hasCommandLineItems = cliArgs.id || cliArgs.name || cliArgs.description || cliArgs.author || false

    if (!hasCommandLineItems) {
      console.log('')
      print.note('', 'INSTRUCTIONS')
      console.log('')
      print.note('The following items will be used to generate your new NotePlan plugin:')
      print.note(` • Supply values for each field in ${colors.cyan('blue')}`)
      print.note(' • Press <tab> to move between fields')
      print.note(' • Press <cmd-c> to abort')
      print.note(' • When complete, presss <enter or return>')
      console.log('')
      const promptResult = await createPlugin.run()

      if (promptResult && promptResult?.values) {
        flags = { ...promptResult.values }
      } else {
        print.warning('Plugin Creation Aborted', 'ABORT')
        process.exit()
      }
    } else {
      const promptArgs = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

      const answers = this.usePrompts ? await toolbox.prompts.run(toolbox, this) : []

      flags = {
        ...{
          pluginId: promptArgs.id || answers.id,
          pluginName: promptArgs.name || answers.name,
          pluginDescription: promptArgs.description || answers.description,
          pluginAuthor: promptArgs.author || answers.author,
        },
      }
    }

    flags.pluginName = flags.pluginName.split('.').pop()

    // all good, createPlugin
    const pluginPath = path.join(process.cwd(), flags.pluginId)
    console.log()
    const createResult = createPlugin.createPlugin(pluginPath, flags)

    console.log('')
    console.log(colors.green.bold(`✔ ✨ Project Initialized in ${colors.yellow.bold(pluginPath)}`))
    console.log(colors.green.bold('✔ 📦 Project Files Created'))
    console.log(colors.green.bold('✔ 🧩 Project Creation Complete'))

    print.info('\n👉 Next Steps:\n')
    print.info(`   ${toolbox.colors.gray('$')} cd ${flags.pluginId}`)
    print.info(`   ${toolbox.colors.gray('$')} npm run autowatch`)
    print.info(`   - If NotePlan is running, quit and relaunch`)
    print.info(`   - run your new plugin command /helloWorld from NotePlan Command Bar or in inline`)
    console.log('')
    print.note(
      `Use ${colors.cyan('noteplan-cli plugin:info --check xxx')} to check if desired command is available`,
      'TIP',
    )
  },
}
