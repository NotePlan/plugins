// @flow
/**
 * @fileoverview Handler for promptTag functionality.
 * Allows users to select a hashtag from the DataStore.
 */

import pluginJson from '../../../../plugin.json'
import { registerPromptType } from './PromptRegistry'
import { parsePromptParameters, filterItems, promptForItem } from './sharedPromptFunctions'
import BasePromptHandler from './BasePromptHandler'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * Handler for promptTag functionality.
 */
export default class PromptTagHandler {
  /**
   * Parse parameters from a promptTag tag.
   * @param {string} tag - The template tag containing the promptTag call.
   * @returns {Object} The parsed parameters for promptTag.
   */
  static parsePromptTagParameters(tag: string = ''): {
    promptMessage: string,
    includePattern: string,
    excludePattern: string,
    allowCreate: boolean,
  } {
    return parsePromptParameters(tag, 'PromptTagHandler')
  }

  /**
   * Filter hashtags based on include and exclude patterns
   * @param {Array<string>} hashtags - Array of hashtags to filter
   * @param {string} includePattern - Regex pattern to include (if empty, include all)
   * @param {string} excludePattern - Regex pattern to exclude (if empty, exclude none)
   * @returns {Array<string>} Filtered hashtags
   */
  static filterHashtags(hashtags: Array<string>, includePattern: string = '', excludePattern: string = ''): Array<string> {
    return filterItems(hashtags, includePattern, excludePattern, 'hashtag')
  }

  /**
   * Prompt the user to select a hashtag.
   * @param {string} promptMessage - The prompt message to display.
   * @param {string} includePattern - Regex pattern to include hashtags.
   * @param {string} excludePattern - Regex pattern to exclude hashtags.
   * @param {boolean} allowCreate - Whether to allow creating a new hashtag.
   * @returns {Promise<string>} The selected hashtag (with the # symbol).
   */
  static async promptTag(promptMessage: string = 'Select a hashtag', includePattern: string = '', excludePattern: string = '', allowCreate: boolean = false): Promise<string> {
    try {
      // Get all hashtags from DataStore
      const hashtags = DataStore.hashtags || []

      // Remove the # symbol from the beginning of each tag
      const cleanHashtags = hashtags.map((tag) => (tag.startsWith('#') ? tag.substring(1) : tag))

      // Use the shared prompt function
      const result = await promptForItem(promptMessage, cleanHashtags, includePattern, excludePattern, allowCreate, 'hashtag', '#')

      return result ? `#${result}` : ''
    } catch (error) {
      logError(pluginJson, `Error in promptTag: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptTag tag.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} params - The parameters from parseParameters.
   * @returns {Promise<string>} The processed prompt result.
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string> {
    const { promptMessage, includePattern, excludePattern, allowCreate } = params

    try {
      const response = await PromptTagHandler.promptTag(promptMessage || 'Choose #tag', includePattern, excludePattern, allowCreate)

      // Add # prefix if not already present
      return response && !response.startsWith('#') ? `#${response}` : response
    } catch (error) {
      logError(pluginJson, `Error in PromptTagHandler.process: ${error.message}`)
      return ''
    }
  }
}

// Register the promptTag type
registerPromptType({
  name: 'promptTag',
  parseParameters: (tag: string) => PromptTagHandler.parsePromptTagParameters(tag),
  process: PromptTagHandler.process.bind(PromptTagHandler),
})
