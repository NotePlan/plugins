// @flow
/**
 * @fileoverview Exports all module functionality for the templating system
 */

import * as pluginIntegration from './pluginIntegration'

export { templateErrorMessage, isCommandAvailable, invokePluginCommandByName } from './pluginIntegration'

export default {
  ...pluginIntegration,
}
