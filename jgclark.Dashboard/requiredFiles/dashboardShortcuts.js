/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-template */

/**
 * Define shortcut keys for Dashboard
 * Last updated 1.4.2024 by @jgclark for v1.1.1
 */

const shortcutKeys = [
  {
    key: 'a',
    description: 'Turn on all sections',
    commandName: 'turnOnAllSections',
  },
  {
    key: 'o',
    description: 'Toggle overdue section',
    commandName: 'toggleOverdueSection',
  },
  {
    key: 'm',
    description: 'Toggle month section',
    commandName: 'toggleMonthSection',
  },
  {
    key: 'q',
    description: 'Toggle quarter section',
    commandName: 'toggleQuarterSection',
  },
  {
    key: 'w',
    description: 'Toggle week section',
    commandName: 'toggleWeekSection',
  },
  {
    key: 't',
    description: 'Toggle tomorrow section',
    commandName: 'toggleTomorrowSection',
  },
  {
    key: 'p',
    description: 'Toggle priority filter',
    commandName: 'togglePriorityFilter',
  },
]

function enableDashboardShortcuts() {
  console.log("enableDashboardShortcuts() starting ...")

  for (const key of shortcutKeys) {
    shortcut.add(key.key, function () {
      sendMessageToPlugin('runPluginCommand', { commandName: key.commandName, pluginID: 'jgclark.Dashboard', commandArgs: [] })
    })
    // console.log("Added Shortcut key '" + key.key + "' to call '" + key.commandName + "' command")
  }
}

function disableDashboardShortcuts() {
  console.log("Removing Shortcut keys")
  for (const key of shortcutKeys) {
    shortcut.remove(key.key)
  }
}

// Call the shortcut script for the first time
enableDashboardShortcuts()
