const fs = require('fs/promises')
const path = require('path')
const pluginListingFile = '../Plugin-Listing.md'

const getSortedKeys = (objIn) => {
  return Object.keys(objIn).sort()
}

module.exports = async function createPluginListing(commandList) {
  if (Object.keys(commandList)) {
    // console.log(JSON.stringify(commandList, null, 2))
    const sortedKeys = getSortedKeys(commandList)
    let tableStr = `| Command Name | Description | Plugin |\n`
    tableStr += `| --- | --- | --- |\n`
    for (const key of sortedKeys) {
      const command = commandList[key]
      tableStr += `| \`${command.name}\` | ${command.description} | ${command.pluginName} |\n`
    }
    const outputString = `# Plugin Command List\n\n${tableStr}`
    console.log(`${outputString}`)
    try {
      await fs.writeFile(
        path.resolve(__dirname, pluginListingFile),
        outputString,
      )
    } catch (error) {
      console.log(error)
    }
  } else {
    console.log(`createPluginListing: Could not create Listing`)
  }
}
