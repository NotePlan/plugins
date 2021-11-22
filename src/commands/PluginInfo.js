const _findIndex = require('lodash.findindex')
const colors = require('chalk')
const Table = require('cli-table3')
const { print, helpers } = require('@codedungeon/gunner')
const appUtils = require('../utils/app')
const createPluginListing = require('../../scripts/createPluginListing')
const pluginInfo = require('./support/plugin-info')

module.exports = {
  name: 'plugin:info',
  description: 'Show Current NotePlan Plugin Commands',
  disabled: false,
  hidden: false,
  usage: [
    `noteplan-cli plugin:info ${colors.gray('(displays report of all plug-ins)')}`,
    `  noteplan-cli plugin:info --check ${colors.gray('(check if "formatted" command is available)')}`,
    `  noteplan-cli plugin:info --save ${colors.gray('(generates ./Plugin-Listing.md)')}`,
  ].join('\n'),
  usePrompts: true,
  arguments: {},
  flags: {
    check: {
      type: 'string',
      aliases: ['c'],
      description: `Check if desired plugin command is available ${colors.gray('(supply desired command e.g. dp)')}`,
    },
    sanity: {
      type: 'boolean',
      aliases: ['a'],
      description: `Perform Plugin Sanity Check`,
    },
    save: {
      type: 'boolean',
      aliases: ['s'],
      description: `Save Command List ${colors.gray('(Markdown Format)')}`,
    },
  },

  async execute(toolbox) {
    // example retrieving global option
    const quiet = toolbox.getOptionValue(toolbox.arguments, ['quiet', 'q'])

    const args = helpers.getArguments(toolbox.arguments, this, { initializeNullValues: true })

    const answers = this.usePrompts ? await toolbox.prompts.run(toolbox, this) : []

    const check = toolbox.getOptionValue(toolbox.arguments, ['check', 'c'])
    const savePluginListing = toolbox.getOptionValue(toolbox.arguments, ['save', 's'])

    const performSanityCheck = toolbox.getOptionValue(toolbox.arguments, ['sanity', 'a'])
    if (performSanityCheck) {
      const result = await pluginInfo.sanityCheck()
      result ? print.success('Sanity Check Passed', 'SUCCESS') : print.error('Sanit Check Failed', 'ERROR')
      process.exit()
    }

    const commands = appUtils.getPluginCommands('./')
    const tableItems = []

    if (check && check.length > 0) {
      const result = _findIndex(commands, { name: check })

      if (result >= 0) {
        toolbox.print.error(` 🚫 '${check}' exists in ${commands[result].pluginName}.`)
      } else {
        toolbox.print.success(
          ` ✅ '${check}' is currently not used by any NotePlan plugin and can be used in your plugin.`,
        )
      }
      process.exit()
    }

    if (savePluginListing) {
      await createPluginListing(commands)

      print.success('./Plugin-Listing.md Created Successfully', 'SUCCESS')

      process.exit()
    }

    const table = new Table({
      head: ['plugin.id', 'plugin.name', 'command', 'function', 'description'],
    })

    const ids = []
    commands.map((item) => {
      let pluginId = item.pluginId
      let pluginName = item.pluginName.substring(0, 35)
      let pluginAuthor = `Created By: ${item.author}`
      if (ids.includes(pluginId)) {
        pluginId = ''
        pluginName = ''
        pluginAuthor = ''
      } else {
        ids.push(pluginId)
      }
      if (item.pluginId !== 'yourGitID.yourPluginCollectionName') {
        table.push([
          `${pluginId}\n${pluginAuthor}`,
          pluginName,
          item.name,
          item.jsFunction,
          item.description.substring(0, 75),
        ])
      }
    })

    console.log(table.toString())
  },
}
