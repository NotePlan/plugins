// @flow
/**
 * @fileoverview Base class for prompt handlers that implements common functionality.
 */

import pluginJson from '../../../../plugin.json'
import { getRegisteredPromptNames, cleanVarName } from './PromptRegistry'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * Base class for prompt handlers.
 */
export default class BasePromptHandler {
  /**
   * Cleans a variable name by replacing spaces with underscores and removing question marks.
   * Enhanced to ensure variable names are valid JavaScript identifiers.
   * @param {string} varName - The variable name to clean.
   * @returns {string} The cleaned variable name.
   */
  static cleanVarName(varName: string): string {
    return cleanVarName(varName) // Use the function from PromptRegistry
  }

  /**
   * Extracts a quoted string from content, handling different quote types.
   * @param {string} content - The content to extract from.
   * @returns {string} The extracted content without quotes.
   */
  static removeQuotes(content: string): string {
    if (!content) return ''

    // Handle various quote types by checking first and last character
    if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'")) || (content.startsWith('`') && content.endsWith('`'))) {
      return content.substring(1, content.length - 1)
    }

    return content
  }

  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Current date in YYYY-MM-DD format
   */
  static getToday(): string {
    return new Date().toISOString().substring(0, 10)
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   * @returns {string} Yesterday's date in YYYY-MM-DD format
   */
  static getYesterday(): string {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().substring(0, 10)
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   * @returns {string} Tomorrow's date in YYYY-MM-DD format
   */
  static getTomorrow(): string {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().substring(0, 10)
  }

  /**
   * Creates a regex pattern to match and remove all registered prompt types and common template syntax
   * @returns {RegExp} A regex pattern that matches all prompt types and template syntax
   */
  static getPromptCleanupPattern(): RegExp {
    const promptTypes = getRegisteredPromptNames()
    // Escape special characters in prompt names and join with |
    const promptTypePattern = promptTypes.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    // Create pattern that matches prompt names followed by parentheses, with optional whitespace,
    // also handling the await keyword separately
    return new RegExp(`await\\s+|\\b(?:${promptTypePattern}|ask)\\s*\\(|[()]|<%[-=]?|-%>|%>`, 'gi')
  }

  /**
   * Process a template tag and extract parameters for a general prompt.
   * @param {string} promptTag - The prompt tag to process.
   * @returns {Object} An object with varName, promptMessage, and options.
   */
  static getPromptParameters(promptTag: string = ''): { varName: string, promptMessage: string, options: string | string[] } {
    // Use the dynamic pattern to clean the tag
    const tagValue = promptTag.replace(BasePromptHandler.getPromptCleanupPattern(), '').trim()

    let varName = ''
    let promptMessage = ''
    let options: string | string[] = ''

    try {
      // Add safety check - if the tag is empty or invalid, return early with defaults
      if (!tagValue) {
        logDebug(pluginJson, `Empty or invalid prompt tag: "${promptTag}"`)
        return { varName: 'unnamed', promptMessage: 'Empty prompt', options: '' }
      }

      // First, extract and safely store strings with quotes to avoid splitting them incorrectly
      const quotedTexts = []
      const storeQuotedText = (match: string): string => {
        const placeholder = `__QUOTED_TEXT_${quotedTexts.length}__`
        quotedTexts.push(match)
        return placeholder
      }

      // Use a regex that captures text within quotes (handling escaped quotes too)
      let safeTagValue = tagValue.replace(/(["'])((?:\\\1|(?:(?!\1)).)*?)\1/g, storeQuotedText)

      // Replace array literals with placeholders to avoid splitting them
      const hasArray = safeTagValue.includes('[')
      const arrayPlaceholders = []

      if (hasArray) {
        const arrayRegex = /\[[^\]]*\]/g
        let match = null
        let counter = 0

        while ((match = arrayRegex.exec(safeTagValue)) !== null) {
          if (match && match[0]) {
            const placeholder = `__ARRAY_${counter}__`
            arrayPlaceholders.push({ placeholder, value: match[0] })
            safeTagValue = safeTagValue.replace(match[0], placeholder)
            counter++
          }
        }
      }

      // Split by commas, but only those not within quotes or arrays
      const parts = safeTagValue.split(',').map((part) => part.trim())

      if (parts.length > 0) {
        // Extract and clean variable name from the first part
        let rawVarName = parts[0]

        // Restore any quoted text in the variable name
        quotedTexts.forEach((text, index) => {
          rawVarName = rawVarName.replace(`__QUOTED_TEXT_${index}__`, text)
        })

        // Clean the variable name and store both original and cleaned versions
        const originalVarName = BasePromptHandler.removeQuotes(rawVarName)
        varName = BasePromptHandler.cleanVarName(originalVarName)

        if (parts.length > 1) {
          // Extract prompt message from the second part
          let rawPromptMessage = parts[1]

          // Restore any quoted text in the prompt message
          quotedTexts.forEach((text, index) => {
            rawPromptMessage = rawPromptMessage.replace(`__QUOTED_TEXT_${index}__`, text)
          })

          promptMessage = BasePromptHandler.removeQuotes(rawPromptMessage)

          if (parts.length > 2) {
            // Join remaining parts and restore array placeholders
            let optionsText = parts.slice(2).join(',')

            // Restore quoted texts
            quotedTexts.forEach((text, index) => {
              optionsText = optionsText.replace(`__QUOTED_TEXT_${index}__`, text)
            })

            // Restore array placeholders
            if (hasArray) {
              arrayPlaceholders.forEach(({ placeholder, value }) => {
                optionsText = optionsText.replace(placeholder, value)
              })
            }

            // Parse options
            if (optionsText.startsWith('[') && optionsText.endsWith(']')) {
              try {
                // Parse array options
                const arrayContent = optionsText.substring(1, optionsText.length - 1)
                options = arrayContent
                  .split(',')
                  .map((item) => {
                    // Restore quoted texts in each array item
                    let processedItem = item.trim()
                    quotedTexts.forEach((text, index) => {
                      processedItem = processedItem.replace(`__QUOTED_TEXT_${index}__`, text)
                    })
                    return BasePromptHandler.removeQuotes(processedItem)
                  })
                  .filter(Boolean)
              } catch (e) {
                logError(pluginJson, `Error parsing array options: ${e.message}`)
                options = []
              }
            } else {
              options = BasePromptHandler.removeQuotes(optionsText)
            }
          }
        }
      }
    } catch (error) {
      logError(pluginJson, `Error parsing prompt parameters: ${error.message}`)
      return { varName: 'unnamed', promptMessage: 'Error parsing prompt', options: '' }
    }

    return { varName, promptMessage, options }
  }
}
