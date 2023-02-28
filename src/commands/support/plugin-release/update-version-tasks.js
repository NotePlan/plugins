'use strict'

import { filesystem, path } from '@codedungeon/gunner'

module.exports = (pluginName, pluginVersion) => {
  const pluginJsonFilename = path.resolve(path.join(pluginName, 'plugin.json'))
  if (filesystem.existsSync(pluginJsonFilename)) {
    const pluginJsonData = filesystem.readFileSync(pluginJsonFilename)
    const data = JSON.parse(pluginJsonData)
    data['plugin.version'] = pluginVersion
    filesystem.writeFileSync(pluginJsonFilename, JSON.stringify(data, null, 2))
  }
}
