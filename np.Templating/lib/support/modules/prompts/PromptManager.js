// @flow
/**
 * @fileoverview Provides a centralized interface for managing prompts using the PromptRegistry.
 * This allows for a cleaner API and easier addition of new prompt types.
 */

import pluginJson from '../../../../plugin.json'
import { getRegisteredPromptNames, findMatchingPromptType } from './PromptRegistry'
import { logDebug, logError } from '@helpers/dev'

/**
 * Centralized interface for handling all prompt types
 */
class PromptManager {
  /**
   * Processes a prompt based on its type. This is the primary method for handling prompts
   * and should be used instead of individual prompt type methods.
   *
   * @param {string} promptType - The type of prompt to process (e.g., 'promptDate', 'promptKey')
   * @param {string} message - The message to display to the user
   * @param {any} options - Additional options for the prompt
   * @returns {Promise<any>} Result of the prompt
   */
  static async processPrompt(promptType: string, message: string, options: any = null): Promise<any> {
    logDebug(pluginJson, `PromptManager.processPrompt: Processing ${promptType} with message "${message}"`)

    // Format the tag in the way the prompt handlers expect
    const fakeTag = `<% ${promptType}("${message.replace(/"/g, '\\"')}"${options ? `, ${JSON.stringify(options)}` : ''}) %>`

    // Find the matching prompt handler
    const match = findMatchingPromptType(fakeTag)
    if (!match) {
      const error = `No registered prompt handler found for type: ${promptType}`
      logError(pluginJson, error)
      throw new Error(error)
    }

    const { promptType: handler, name } = match
    logDebug(pluginJson, `Found handler for ${promptType}: ${name}`)

    // Parse parameters and process the prompt
    const params = handler.parseParameters(fakeTag)
    return await handler.process(fakeTag, {}, params)
  }

  /**
   * Parses parameters from a prompt tag
   *
   * @param {string} tag - The tag to parse
   * @returns {any} The parsed parameters
   */
  static parseParameters(tag: string): any {
    const match = findMatchingPromptType(tag)
    if (!match) {
      const error = `No registered prompt handler found for tag: ${tag}`
      logError(pluginJson, error)
      throw new Error(error)
    }

    return match.promptType.parseParameters(tag)
  }

  /**
   * Gets a list of all registered prompt types
   *
   * @returns {string[]} Array of registered prompt type names
   */
  static getRegisteredPromptTypes(): string[] {
    return getRegisteredPromptNames()
  }

  /**
   * Determines if a tag is a prompt tag
   *
   * @param {string} tag - The tag to check
   * @returns {boolean} True if the tag is a prompt tag
   */
  static isPromptTag(tag: string): boolean {
    return findMatchingPromptType(tag) !== null
  }
}

export default PromptManager
