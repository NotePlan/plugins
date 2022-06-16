/* 
 * PluginCommandObjectMock mock class
 *
 * Usage: const myPluginCommandObject = new PluginCommandObject({ param changes here })
 *
 */

export class PluginCommandObject {

  // Properties
  desc = 'PLACEHOLDER' // TODO: add value
    name = 'PLACEHOLDER' // TODO: add value
    pluginID = 'PLACEHOLDER' // TODO: add value
    pluginName = 'PLACEHOLDER' // TODO: add value 

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
