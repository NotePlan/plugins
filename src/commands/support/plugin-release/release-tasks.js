'use strict'

import path from 'path'
import pluginUtils from '../plugin-utils'
import github from '../github'

module.exports = async (pluginId, pluginVersion, flags) => {
  const configData = pluginUtils.getPluginConfig(path.resolve(pluginId))
  const releaseFileList = pluginUtils.getFileList(pluginId)

  const isDraft = flags?.draft || false

  const cmd = await github.getReleaseCommand(pluginVersion, pluginId, configData['plugin.name'], releaseFileList, !isDraft)

  return cmd
}
