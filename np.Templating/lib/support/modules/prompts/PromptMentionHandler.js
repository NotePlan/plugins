// @flow
/**
 * @fileoverview Handler for promptMention functionality.
 * Allows users to select a mention from the DataStore.
 */

import pluginJson from '../../../../plugin.json'
import { registerPromptType } from './PromptRegistry'
import { parsePromptParameters, filterItems, promptForItem } from './sharedPromptFunctions'
import BasePromptHandler from './BasePromptHandler'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * Handler for promptMention functionality.
 */
export default class PromptMentionHandler {
  /**
   * Parse parameters from a promptMention tag.
   * @param {string} tag - The template tag containing the promptMention call.
   * @returns {Object} The parsed parameters for promptMention.
   */
  static parsePromptMentionParameters(tag: string = ''): {
    promptMessage: string,
    varName: string,
    includePattern: string,
    excludePattern: string,
    allowCreate: boolean,
  } {
    return parsePromptParameters(tag, 'PromptMentionHandler')
  }

  /**
   * Filter mentions based on include and exclude patterns
   * @param {Array<string>} mentions - Array of mentions to filter
   * @param {string} includePattern - Regex pattern to include (if empty, include all)
   * @param {string} excludePattern - Regex pattern to exclude (if empty, exclude none)
   * @returns {Array<string>} Filtered mentions
   */
  static filterMentions(mentions: Array<string>, includePattern: string = '', excludePattern: string = ''): Array<string> {
    return filterItems(mentions, includePattern, excludePattern, 'mention')
  }

  /**
   * Prompt the user to select a mention.
   * @param {string} promptMessage - The prompt message to display.
   * @param {string} includePattern - Regex pattern to include mentions.
   * @param {string} excludePattern - Regex pattern to exclude mentions.
   * @param {boolean} allowCreate - Whether to allow creating a new mention.
   * @returns {Promise<string>} The selected mention (without the @ symbol).
   */
  static async promptMention(promptMessage: string = 'Select a mention', includePattern: string = '', excludePattern: string = '', allowCreate: boolean = false): Promise<string> {
    try {
      // Get all mentions from DataStore
      const mentions = DataStore.mentions || []

      // Remove the @ symbol from the beginning of each mention
      const cleanMentions = mentions.map((mention) => (mention.startsWith('@') ? mention.substring(1) : mention))

      // Use the shared prompt function
      return await promptForItem(promptMessage, cleanMentions, includePattern, excludePattern, allowCreate, 'mention', '@')
    } catch (error) {
      logError(pluginJson, `Error in promptMention: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptMention tag.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} params - The parameters from parseParameters.
   * @returns {Promise<string>} The processed prompt result.
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    const { promptMessage, varName, includePattern, excludePattern, allowCreate } = params

    // Check if variable already exists in session data and is valid
    if (varName && sessionData[varName] && BasePromptHandler.isValidSessionValue(sessionData[varName], 'promptMention', varName)) {
      // Value already exists in session data and is not a function call representation
      logDebug(pluginJson, `PromptMentionHandler.process: Using existing value from session data: ${sessionData[varName]}`)
      return sessionData[varName]
    }

    try {
      const response = await PromptMentionHandler.promptMention(promptMessage || 'Choose @mention', includePattern, excludePattern, allowCreate)

      // Store the result in session data if a variable name is provided
      if (varName) {
        sessionData[varName] = response && !response.startsWith('@') ? `@${response}` : response
      }

      // Add @ prefix if not already present
      return response && !response.startsWith('@') ? `@${response}` : response
    } catch (error) {
      logError(pluginJson, `Error processing promptMention: ${error.message}`)
      return ''
    }
  }
}

// Register the promptMention type
registerPromptType({
  name: 'promptMention',
  parseParameters: (tag: string) => PromptMentionHandler.parsePromptMentionParameters(tag),
  process: PromptMentionHandler.process.bind(PromptMentionHandler),
})
