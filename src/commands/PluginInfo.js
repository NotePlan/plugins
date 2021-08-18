const _findIndex = require('lodash.findindex')
const colors = require('chalk')
const Table = require('cli-table3')
const { print, helpers } = require('@codedungeon/gunner')
const appUtils = require('../utils/app')
const createPluginListing = require('../../scripts/createPluginListing')

module.exports = {
  name: 'plugin-info',
  description: 'Show Current NotePlan Plugin Commands',
  disabled: false,
  hidden: false,
  usage: `noteplan-cli plugin-info\n  noteplan-cli plugin-info --check formatted ${colors.gray(
    '(check if "formatted" command is available)',
  )}`,
  usePrompts: true,
  arguments: {},
  flags: {
    check: {
      type: 'string',
      aliases: ['c'],
      description: `Check if desired plugin command is available ${colors.gray(
        '(supply desired command e.g. dp)',
      )}`,
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

    const args = helpers.getArguments(toolbox.arguments, this.flags)
    const answers = this.usePrompts
      ? await toolbox.prompts.run(toolbox, this)
      : []

    const check = toolbox.getOptionValue(toolbox.arguments, ['check', 'c'])
    const savePluginListing = toolbox.getOptionValue(toolbox.arguments, [
      'save',
      's',
    ])

    const commands = appUtils.getPluginCommands('./')
    const tableItems = []

    if (check && check.length > 0) {
      const result = _findIndex(commands, { name: check })
      if (result >= 0) {
        toolbox.print.warn(
          `command '${check}' exists in ${commands[result].pluginName}.`,
        )
      } else {
        toolbox.print.success(
          `command '${check}' is currently not used by any NotePlan plugin and can be used.`,
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
      if (ids.includes(pluginId)) {
        pluginId = ''
        pluginName = ''
      } else {
        ids.push(pluginId)
      }
      if (item.pluginId !== 'yourGitID.yourPluginCollectionName') {
        table.push([
          pluginId,
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
