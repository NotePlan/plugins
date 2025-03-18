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
   * @param {boolean} noVar - If true, will set varName to empty string in return object and will assume the first parameter is not the variable name -- e.g. may be the promptMessage.
   * @returns {Object} An object with varName, promptMessage, and options.
   */
  static getPromptParameters(promptTag: string = '', noVar: boolean = false): { varName: string, promptMessage: string, options: string | string[] } {
    // Log the input for debugging
    logDebug(pluginJson, `BasePromptHandler.getPromptParameters input: "${promptTag}", noVar: ${noVar ? 'true' : 'false'}`)

    // Try a direct extraction first as a reliable fallback
    let directExtractedMessage = ''
    try {
      const openParenIndex = promptTag.indexOf('(')
      const closeParenIndex = promptTag.lastIndexOf(')')

      if (openParenIndex > 0 && closeParenIndex > openParenIndex) {
        const paramsText = promptTag.substring(openParenIndex + 1, closeParenIndex).trim()
        logDebug(pluginJson, `BasePromptHandler direct extraction: "${paramsText}"`)

        // If we found content with direct extraction, check if it's a single quoted parameter
        if (paramsText && paramsText.length > 0) {
          const singleQuoteMatch = paramsText.match(/^(['"])(.*?)\1$/)
          if (singleQuoteMatch && !paramsText.includes(',')) {
            directExtractedMessage = BasePromptHandler.removeQuotes(paramsText)
            logDebug(pluginJson, `BasePromptHandler found single parameter: "${directExtractedMessage}"`)

            if (noVar) {
              // If noVar is true, return immediately with this as the promptMessage
              return {
                varName: '',
                promptMessage: directExtractedMessage,
                options: '',
              }
            }
          }
        }
      }
    } catch (error) {
      logError(pluginJson, `Error in direct parameter extraction: ${error.message}`)
    }

    // Use the dynamic pattern to clean the tag
    const tagValue = promptTag.replace(BasePromptHandler.getPromptCleanupPattern(), '').trim()
    logDebug(pluginJson, `BasePromptHandler cleaned tag value: "${tagValue}"`)

    let varName = ''
    let promptMessage = ''
    let options: string | string[] = ''

    try {
      // Add safety check - if the tag is empty or invalid, return early with defaults
      if (!tagValue) {
        logDebug(pluginJson, `Empty or invalid prompt tag: "${promptTag}"`)

        // Use direct extraction result if available
        if (directExtractedMessage && noVar) {
          return { varName: '', promptMessage: directExtractedMessage, options: '' }
        }

        return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
      }

      // Check if there are any parameters at all (handle empty parentheses)
      if (tagValue === '') {
        logDebug(pluginJson, `No parameters in tag: "${promptTag}"`)

        // Use direct extraction result if available
        if (directExtractedMessage && noVar) {
          return { varName: '', promptMessage: directExtractedMessage, options: '' }
        }

        return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
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
        let originalVarName = ''
        let firstParam = ''

        // Extract and clean variable name from the first part (or use as promptMessage if noVar is true)
        let rawVarName = parts[0]

        // Restore any quoted text in the first parameter
        quotedTexts.forEach((text, index) => {
          rawVarName = rawVarName.replace(`__QUOTED_TEXT_${index}__`, text)
        })

        // Process the first parameter
        firstParam = BasePromptHandler.removeQuotes(rawVarName)

        if (noVar) {
          // If noVar is true, first parameter is promptMessage
          promptMessage = firstParam
          originalVarName = ''
        } else {
          // Normal case: first parameter is varName
          originalVarName = firstParam
        }

        // Clean the variable name
        varName = noVar ? '' : BasePromptHandler.cleanVarName(originalVarName)

        if (parts.length > 1) {
          // If noVar is true, the second parameter becomes the first option
          // If noVar is false, process normally (second param is promptMessage)
          if (noVar) {
            // The second parameter becomes the first option in options array
            if (parts.length > 1) {
              // Process all parameters after the first as options
              let optionsText = parts.slice(1).join(',')

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
          } else {
            // Normal case: Extract prompt message from the second part
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
      }
    } catch (error) {
      logError(pluginJson, `Error parsing prompt parameters: ${error.message}`)
      // Use direct extraction result as fallback if available
      if (directExtractedMessage && noVar) {
        return { varName: '', promptMessage: directExtractedMessage, options: '' }
      }
      return { varName: noVar ? '' : 'unnamed', promptMessage: 'Error parsing prompt', options: '' }
    }

    // Use direct extraction as a fallback if we didn't get a promptMessage but have a single parameter
    if (promptMessage === '' && directExtractedMessage !== '' && noVar) {
      promptMessage = directExtractedMessage
    }

    logDebug(
      pluginJson,
      `Parsed parameters with noVar=${noVar ? 'true' : 'false'}: varName="${varName}", promptMessage="${promptMessage}", options=${
        typeof options === 'string' ? `"${options}"` : JSON.stringify(options)
      }`,
    )
    return { varName, promptMessage, options }
  }
}
