/* eslint-disable */
/*
 * PluginObject mock class
 *
 * Usage: const myPluginObject = new PluginObject({ param changes here })
 *
 */

export class PluginObject {
  // Properties
  author = 'PLACEHOLDER' // TODO: add value
  availableUpdate = 'PLACEHOLDER' // TODO: add value
  commands = [] /* sample:  [{
 "name": "atb - Create AutoTimeBlocks for >today's Tasks",
 "desc": "Read >today todos and insert them into today's calendar note as timeblocks",
 "pluginID": "dwertheimer.EventAutomations",
 "pluginName": "🗓 AutoTimeBlocking & Synced Today Todos"
} ] */
  desc = 'PLACEHOLDER' // TODO: add value
  id = 'PLACEHOLDER' // TODO: add value
  isOnline = 'PLACEHOLDER' // TODO: add value
  name = 'PLACEHOLDER' // TODO: add value
  releaseUrl = 'PLACEHOLDER' // TODO: add value
  repoUrl = 'PLACEHOLDER' // TODO: add value
  script = 'PLACEHOLDER' // TODO: add value
  version = 'PLACEHOLDER' // TODO: add value

  // Methods

  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
