const appUtils = require('../../utils/app')

module.exports = {
  // returns true if every passed
  // returns false something failed verification
  sanityCheck: async function () {
    const uniqueCommands = []
    const commands = appUtils.getPluginCommands('./')
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
