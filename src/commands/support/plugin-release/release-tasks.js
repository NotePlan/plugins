'use strict'

const path = require('path')
const pluginUtils = require('../plugin-utils')
const github = require('../github')

module.exports = async (pluginName, pluginVersion, flags) => {
  const configData = pluginUtils.getPluginConfig(path.resolve(pluginName))
  const releaseFileList = pluginUtils.getFileList(pluginName)

  const publishRelease = !flags.preview

  const cmd = await github.getReleaseCommand(pluginVersion, pluginName, releaseFileList, publishRelease)

  return cmd
}
