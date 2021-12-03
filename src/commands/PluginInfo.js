/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

const colors = require('chalk')
const Table = require('cli-table3')
const { print, helpers } = require('@codedungeon/gunner')
const createPluginListing = require('../../scripts/createPluginListing')
const pluginUtils = require('./support/plugin-utils')
const pluginInfo = require('./support/plugin-info')

module.exports = {
  name: 'plugin:info',
  description: 'Show Current NotePlan Plugin Commands',
  disabled: false,
  hidden: false,
  usage: `plugin:info ${colors.magenta('<plugin name>')} ${colors.blue('[options]')}`,
  examples: [
    `plugin:info ${colors.magenta('codedungeon.Toolbox')} ${colors.cyan('--check helloWorld')}`,
    `plugin:info ${colors.magenta('codedungeon.Toolbox')} ${colors.cyan('--sanity')}`,
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
    check: {
      type: 'string',
      aliases: ['c'],
      description: `Check if desired plugin command is available ${colors.gray('(supply desired command e.g. dp)')}`,
    },
    docs: {
      type: 'boolean',
      aliases: ['d'],
      description: `Generates and Displays Plugin Documetation`,
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
    console.log('')

    const args = helpers.setDefaultFlags(toolbox.arguments, this.flags)

    const plugin = args.plugin || toolbox.plugin || ''

    const check = toolbox.getOptionValue(toolbox.arguments, ['check', 'c'])
    const docs = toolbox.getOptionValue(toolbox.arguments, ['docs', 'd'])
    const savePluginListing = toolbox.getOptionValue(toolbox.arguments, ['save', 's'])

    if (docs) {
      if (plugin.length > 0) {
        print.warn(`Generate and Display ${colors.blue(plugin)} Plugin Documentation`, 'INFO')
      } else {
        print.warn(`Generate and Display Documentation for all Plugins`, 'INFO')
      }
      process.exit()
    }
    const performSanityCheck = toolbox.getOptionValue(toolbox.arguments, ['sanity', 'a'])
    if (performSanityCheck) {
      const result = await pluginInfo.sanityCheck()
      result ? print.success('Sanity Check Passed', 'SUCCESS') : print.error('Sanit Check Failed', 'ERROR')
      process.exit()
    }

    const commands = pluginUtils.getPluginCommands('./')
    const tableItems = []

    if (check && check.length > 0) {
      const pluginNames = ''
      const plugin = pluginUtils.findPluginByName(check)
      if (plugin) {
        toolbox.print.error(` 🚫 '${check}' exists in ${plugin.pluginName} [${plugin.pluginId}].`)
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
