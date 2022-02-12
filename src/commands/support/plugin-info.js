'use strict'

const pluginUtils = require('./plugin-utils')

module.exports = {
  // returns true if every passed
  // returns false something failed verification
  sanityCheck: async function () {
    const uniqueCommands = []
    const commands = pluginUtils.getPluginCommands('./')
    commands.forEach((command) => {
      if (!uniqueCommands.includes(command.name)) {
        uniqueCommands.push(command.name)
      } else {
        return false
      }
    })
    return true
  },
}
