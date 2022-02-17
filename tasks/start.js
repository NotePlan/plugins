#!/usr/bin/env node

const { filesystem, print, system } = require('@codedungeon/gunner')

const pluginName = process.argv?.[2]

if (!pluginName) {
  print.warning('Please supply desired plugin (e.g., codedungeon.Toolbox)', 'ABORT')
  process.exit()
}

if (filesystem.existsSync(pluginName)) {
  print.info('==> Starting Plugin Development...')
  system.run(`noteplan-cli plugin:dev ${pluginName} -wcn`, true)
} else {
  print.error(`"./${pluginName}" (folder) not found, please try again`, 'ERROR')
}
