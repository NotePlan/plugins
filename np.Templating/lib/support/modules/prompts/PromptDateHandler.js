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
  static async promptDate(tag: string, message: string, options: Array<string | boolean> | string = []): Promise<string> {
    try {
      // Process the message to handle escape sequences
      const processedMessage = typeof message === 'string' ? message.replace(/\\"/g, '"').replace(/\\'/g, "'") : message

      // Handle options whether it's a string or array
      let defaultValue: string = ''
      let canBeEmpty: boolean = false

      if (Array.isArray(options)) {
        const [defaultVal, canBeEmptyVal] = options
        defaultValue = typeof defaultVal === 'string' ? defaultVal : ''
        canBeEmpty = typeof canBeEmptyVal === 'string' ? /true/i.test(canBeEmptyVal) : Boolean(canBeEmptyVal)
      } else if (typeof options === 'string') {
        defaultValue = options
      }

      const dateOptions = {
        question: processedMessage,
        defaultValue: defaultValue,
        canBeEmpty: canBeEmpty,
      }

      logDebug(pluginJson, `PromptDateHandler::promptDate: dateOptions=${JSON.stringify(dateOptions)}`)

      // Call the datePicker with the processed message and options
      const response = await datePicker(dateOptions)

      // Ensure we have a valid response
      if (typeof response !== 'string') {
        logDebug(pluginJson, `PromptDateHandler::promptDate: datePicker returned response: ${String(response)} (typeof: ${typeof response})`)
        return ''
      }
      return response

      // Fallback if datePicker fails
    } catch (error) {
      logError(pluginJson, `Caught Error in promptDate: ${error.message}`)
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
