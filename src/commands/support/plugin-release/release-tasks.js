'use strict'

const path = require('path')
const pluginUtils = require('../plugin-utils')
const github = require('../github')

module.exports = async (pluginId, pluginVersion, flags) => {
  const configData = pluginUtils.getPluginConfig(path.resolve(pluginId))
  const releaseFileList = pluginUtils.getFileList(pluginId)
  const releaseStatus = configData['plugin.releaseStatus']

  const isDraft = flags?.draft || false

  const cmd = await github.getReleaseCommand(pluginVersion, pluginId, configData['plugin.name'], releaseFileList, !isDraft, releaseStatus)

  return cmd
}
