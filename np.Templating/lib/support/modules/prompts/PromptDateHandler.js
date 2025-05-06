// @flow
/**
 * @fileoverview Handler for promptDate functionality.
 */

import pluginJson from '../../../../plugin.json'
import BasePromptHandler from './BasePromptHandler'
import { registerPromptType } from './PromptRegistry'
import { log, logError, logDebug } from '@helpers/dev'
import { datePicker } from '@helpers/userInput'

/**
 * Handler for promptDate functionality.
 */
export default class PromptDateHandler {
  /**
   * Prompt the user for a date
   * @param {string} tag - The tag to process
   * @param {string} message - The message to display to the user
   * @param {Object|string} options - Optional parameters for the date picker
   * @returns {Promise<string>} - The selected date
   */
  static async promptDate(tag: string, message: string, options: Object | string = {}): Promise<string> {
    try {
      // Process the message to handle escape sequences
      const processedMessage = typeof message === 'string' ? message.replace(/\\"/g, '"').replace(/\\'/g, "'") : message

      let dateOptions = {}
      // If options is a real object, use it
      if (typeof options === 'object' && options !== null) {
        dateOptions = options
      } else if (typeof options === 'string' && options.trim() !== '') {
        // If options is a non-empty string, try to parse it as JSON
        try {
          logDebug(`PromptDateHandler::promptDate: about to parse options: ${options}`)
          dateOptions = JSON.parse(options)
        } catch (e) {
          logError(pluginJson, `Invalid JSON in promptDate options: ${e.message}`)
          dateOptions = {}
        }
      }

      // Call the datePicker with the processed message and options
      // export async function datePicker(dateParams: string, config?: { [string]: ?mixed } = {}): Promise<string> {
      // dateParams is a JSON string with question and defaultValue parameters
      // config is an object with date properties

      const options = typeof options === 'string' ? JSON.parse(options) : options || {}
      if (options && typeof options === 'object') {
        dateOptions.question = processedMessage
      }
      const dateParams = `{question:"${processedMessage}"}`
      const response = await datePicker(dateParams, dateOptions)

      // Ensure we have a valid response
      if (response) {
        return response
      } else {
        logDebug(pluginJson, `PromptDateHandler::promptDate: datePicker returned response: ${response} (typeof: ${typeof response})`)
        if (response === false) {
          logError(pluginJson, `PromptDateHandler::promptDate: datePicker returned false`)
          return false
        }
      }

      // Fallback if datePicker fails
      return ''
    } catch (error) {
      logError(pluginJson, `Error in promptDate: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptDate tag.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} params - The parameters from parseParameters.
   * @returns {Promise<string>} The processed prompt result.
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    const { varName, promptMessage, options } = params

    if (varName && sessionData[varName] && BasePromptHandler.isValidSessionValue(sessionData[varName], 'promptDate', varName)) {
      // Value already exists in session data and is not a function call representation
      logDebug(pluginJson, `PromptDateHandler.process: Using existing value from session data: ${sessionData[varName]}`)
      return sessionData[varName]
    }

    try {
      const response = await PromptDateHandler.promptDate(tag, promptMessage, options)

      // Store the result in session data
      if (varName) sessionData[varName] = response

      return response
    } catch (error) {
      logError(pluginJson, `Error processing promptDate: ${error.message}`)
      return ''
    }
  }
}

// Register the promptDate type
registerPromptType({
  name: 'promptDate',
  parseParameters: (tag: string) => BasePromptHandler.getPromptParameters(tag),
  process: PromptDateHandler.process.bind(PromptDateHandler),
})
