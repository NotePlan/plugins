// @flow
/**
 * @fileoverview Prompt handler for list selection.
 * This demonstrates how easy it is to add new prompt types with the registry pattern.
 */

import pluginJson from '../../../../plugin.json'
import { registerPromptType } from './PromptRegistry'
import BasePromptHandler from './BasePromptHandler'
import { logDebug, logError } from '@helpers/dev'

/**
 * Handler for list prompts that allow selecting one item from a list
 */
class PromptListHandler {
  /**
   * Displays a list selection prompt to the user.
   *
   * @param {string} message - The prompt message to display
   * @param {Array<{label: string, value: string}>} options - The list of options to display
   * @param {string} [defaultValue=''] - Optional default value to pre-select
   * @returns {Promise<string>} The selected value
   */
  static async promptList(message: string, options: Array<{ label: string, value: string }>, defaultValue: string = ''): Promise<string> {
    logDebug(pluginJson, `PromptListHandler.promptList: ${message}, options: ${JSON.stringify(options)}, default: ${defaultValue}`)

    try {
      // Use NotePlan's chooser API
      const result = await CommandBar.showOptions(options, message)
      if (!result || !result.value) {
        return defaultValue
      }
      return result.value
    } catch (error) {
      logError(pluginJson, `Error in promptList: ${error.message}`)
      return defaultValue
    }
  }

  /**
   * Parses parameters from a promptList tag
   *
   * @param {string} tag - The tag to parse
   * @returns {Object} The parsed parameters
   */
  static parseParameters(tag: string): any {
    // Get basic parameters using BasePromptHandler
    const params = BasePromptHandler.getPromptParameters(tag, true)

    // Extract options from the tag
    let options = []
    if (params.options) {
      try {
        if (typeof params.options === 'string') {
          // Try to parse as JSON if it's a string
          options = JSON.parse(params.options)
        } else if (Array.isArray(params.options)) {
          options = params.options
        }
      } catch (error) {
        logError(pluginJson, `Error parsing options in promptList: ${error.message}`)
      }
    }

    // Convert simple array of strings to label/value format if needed
    if (options.length > 0 && typeof options[0] === 'string') {
      options = options.map((item) => ({ label: item, value: item }))
    }

    return {
      ...params,
      options,
    }
  }

  /**
   * Processes a promptList tag
   *
   * @param {string} tag - The tag to process
   * @param {Object} sessionData - Current session data
   * @param {Object} params - Parameters extracted from the tag
   * @returns {Promise<string>} The result of the prompt
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    const { options = [], defaultValue = '', message = 'Select an option' } = params

    if (options.length === 0) {
      logError(pluginJson, 'No options provided for promptList')
      return defaultValue
    }

    return await this.promptList(message, options, defaultValue)
  }
}

// Register this prompt type with the registry
registerPromptType({
  name: 'promptList',
  parseParameters: PromptListHandler.parseParameters,
  process: PromptListHandler.process,
})

export default PromptListHandler
