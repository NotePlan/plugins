// @flow
/**
 * @fileoverview Handler for promptDateInterval functionality.
 */

import pluginJson from '../../../../plugin.json'
import BasePromptHandler from './BasePromptHandler'
import { registerPromptType } from './PromptRegistry'
import { log, logError, logDebug } from '@helpers/dev'
import { askDateInterval } from '@helpers/userInput'

/**
 * Handler for promptDateInterval functionality.
 */
export default class PromptDateIntervalHandler {
  /**
   * Prompt the user to select a date interval.
   * @param {string} message - The prompt message to display.
   * @param {string} defaultValue - Default interval value.
   * @returns {Promise<string>} The selected date interval.
   */
  static async promptDateInterval(message: string, defaultValue: string = ''): Promise<string> {
    try {
      // Try to use the askDateInterval function
      return await askDateInterval(message)
    } catch (error) {
      logError(pluginJson, `Error in promptDateInterval: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptDateInterval tag.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} params - The parameters from parseParameters.
   * @returns {Promise<string>} The processed prompt result.
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    const { varName, promptMessage, options } = params

    logDebug(pluginJson, `PromptDateIntervalHandler.process: Processing tag="${tag}" with varName="${varName}"`)

    if (varName && sessionData[varName] && BasePromptHandler.isValidSessionValue(sessionData[varName], 'promptDateInterval', varName)) {
      // Value already exists in session data and is not a function call representation
      logDebug(pluginJson, `PromptDateIntervalHandler.process: Using existing value for ${varName}: ${sessionData[varName]}`)
      return sessionData[varName]
    }

    try {
      const response = await PromptDateIntervalHandler.promptDateInterval(promptMessage, options)
      logDebug(pluginJson, `PromptDateIntervalHandler.process: Got response="${response}" for varName="${varName}"`)

      // Store response in session data
      sessionData[varName] = response

      // Return the actual response
      return response
    } catch (error) {
      logError(pluginJson, `Error processing promptDateInterval: ${error.message}`)
      return ''
    }
  }
}

// Register the promptDateInterval type
registerPromptType({
  name: 'promptDateInterval',
  parseParameters: (tag: string) => BasePromptHandler.getPromptParameters(tag),
  process: PromptDateIntervalHandler.process.bind(PromptDateIntervalHandler),
})
