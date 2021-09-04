'use strict'

const path = require('path')
const appUtils = require('../../../utils/app')
const github = require('../github')
const pluginRelease = require('../plugin-release')

module.exports = async (pluginName, pluginVersion, flags) => {
  const configData = appUtils.getPluginConfig(path.resolve(pluginName))
  const releaseFileList = pluginRelease.getFileList(pluginName)

  const cmd = await github.getReleaseCommand(pluginVersion, pluginName, releaseFileList, flags.preview)

  return cmd
}
