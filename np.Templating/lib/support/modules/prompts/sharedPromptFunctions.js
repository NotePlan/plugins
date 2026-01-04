// @flow
/**
 * @fileoverview Shared functions for prompt handlers
 * Contains common utility functions used by both PromptTagHandler and PromptMentionHandler
 */

import pluginJson from '../../../../plugin.json'
import BasePromptHandler from './BasePromptHandler'
import { log, logError, logDebug } from '@helpers/dev'
import { chooseOptionWithModifiers, getInput } from '@helpers/userInput'

/**
 * Converts a string value to a boolean, handling both quoted strings ('true'/'false')
 * and unquoted boolean literals (true/false).
 * @param {string} value - The string value to convert
 * @returns {boolean} The boolean value
 */
function parseBooleanString(value: string): boolean {
  if (typeof value !== 'string') return false
  const cleaned = BasePromptHandler.removeQuotes(value).trim().toLowerCase()
  return cleaned === 'true'
}

/**
 * Parse parameters from a prompt tag.
 * @param {string} tag - The template tag containing the prompt call.
 * @param {string} promptType - The type of prompt ('promptTag' or 'promptMention') for logging.
 * @returns {Object} The parsed parameters for the prompt.
 */
export function parsePromptParameters(
  tag: string = '',
  promptType: string,
): {
  promptMessage: string,
  includePattern: string,
  excludePattern: string,
  allowCreate: boolean,
} {
  // Initialize parameters
  let promptMessage = ''
  let includePattern = ''
  let excludePattern = ''
  let allowCreate = false

  try {
    // Log exact tag content for debugging
    logDebug(pluginJson, `${promptType} exact tag content: "${tag}"`)
    logDebug(pluginJson, `${promptType} tag content length: ${tag.length}`)
    logDebug(
      pluginJson,
      `${promptType} tag content codepoints: ${Array.from(tag)
        .map((c) => c.codePointAt(0))
        .join(',')}`,
    )

    // Extract the content inside the parentheses - handle empty parentheses case
    // Try regex with template syntax first, then fall back to cleaned tag pattern
    const paramMatch = tag.match(/<%[-=]?\s*\w+\s*\(\s*([^)]*)\s*\)/) || tag.match(/\w+\s*\(\s*([^)]*)\s*\)/)

    // Debug the regex match
    logDebug(pluginJson, `${promptType} paramMatch: ${paramMatch ? 'match found' : 'no match'}`)
    if (paramMatch) {
      logDebug(pluginJson, `${promptType} paramMatch groups: ${JSON.stringify(paramMatch)}`)
      logDebug(pluginJson, `${promptType} paramMatch[1]: "${paramMatch[1]}"`)
      logDebug(pluginJson, `${promptType} paramMatch[1].trim(): "${paramMatch[1].trim()}"`)
    }

    // Case 1: Zero parameters or empty parentheses
    if (!paramMatch || !paramMatch[1] || paramMatch[1].trim() === '') {
      logDebug(pluginJson, `${promptType} with no parameters detected`)

      // Try simpler direct string extraction as fallback
      const openParenIndex = tag.indexOf('(')
      const closeParenIndex = tag.lastIndexOf(')')

      if (openParenIndex > 0 && closeParenIndex > openParenIndex) {
        const paramsText = tag.substring(openParenIndex + 1, closeParenIndex).trim()
        logDebug(pluginJson, `${promptType} direct extraction fallback: "${paramsText}"`)

        // If we found content with direct extraction, use it
        if (paramsText && paramsText.length > 0) {
          // Check if it's a single parameter (no commas or only within quotes)
          const hasUnquotedComma = /,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/.test(paramsText)

          if (!hasUnquotedComma) {
            // It's a single parameter, use it as promptMessage
            const param = BasePromptHandler.removeQuotes(paramsText)
            logDebug(pluginJson, `${promptType} fallback extraction - single parameter: "${param}"`)

            // NEW: If the param looks like 'Prompt: pattern', split and treat pattern as includePattern
            const regexSplit = param.match(/^(.*?):\s*(\S.+)$/)
            if (regexSplit) {
              promptMessage = regexSplit[1].trim()
              includePattern = regexSplit[2].trim()
              logDebug(pluginJson, `${promptType} detected regex in promptMessage: promptMessage="${promptMessage}", includePattern="${includePattern}"`)
            } else {
              promptMessage = param
            }

            return {
              promptMessage,
              includePattern,
              excludePattern,
              allowCreate,
            }
          } else {
            // Multiple parameters detected - use BasePromptHandler.getPromptParameters
            logDebug(pluginJson, `${promptType} fallback: multiple parameters detected, using BasePromptHandler.getPromptParameters`)
            const basicParams = BasePromptHandler.getPromptParameters(tag, true)

            // Get the prompt message
            promptMessage = basicParams.promptMessage

            // Process additional parameters from options
            if (Array.isArray(basicParams.options)) {
              if (basicParams.options.length > 0) includePattern = BasePromptHandler.removeQuotes(basicParams.options[0]) || ''
              if (basicParams.options.length > 1) excludePattern = BasePromptHandler.removeQuotes(basicParams.options[1]) || ''
              if (basicParams.options.length > 2) allowCreate = parseBooleanString(String(basicParams.options[2]))
            } else if (typeof basicParams.options === 'string') {
              // Process string options
              const paramRegex = /,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/
              const optionParts = basicParams.options.split(paramRegex).map((part: string) => part.trim())

              logDebug(pluginJson, `${promptType} parsed options parts: ${JSON.stringify(optionParts)}`)

              // Special case for testing: split a single string with all parameters if the regex didn't work
              if (optionParts.length === 1 && optionParts[0].includes(',')) {
                const manualParts = optionParts[0].split(',').map((p: string) => p.trim())
                const filteredManualParts = manualParts.filter((s: string) => s !== '')
                // Use manually split parts if they make more logical sense
                if (filteredManualParts.length > 0) includePattern = BasePromptHandler.removeQuotes(filteredManualParts[0]) || ''
                if (filteredManualParts.length > 1) excludePattern = BasePromptHandler.removeQuotes(filteredManualParts[1]) || ''
                if (filteredManualParts.length > 2) allowCreate = parseBooleanString(filteredManualParts[2])
              } else {
                // Regular case processing
                const filteredParts = optionParts.filter((s: string) => s !== '')
                if (filteredParts.length > 0) includePattern = BasePromptHandler.removeQuotes(filteredParts[0]) || ''
                if (filteredParts.length > 1) excludePattern = BasePromptHandler.removeQuotes(filteredParts[1]) || ''
                if (filteredParts.length > 2) allowCreate = parseBooleanString(filteredParts[2])
              }
            }

            return {
              promptMessage,
              includePattern,
              excludePattern,
              allowCreate,
            }
          }
        }
      }

      return {
        promptMessage: '',
        includePattern,
        excludePattern,
        allowCreate,
      }
    }

    // Case 2: Has parameters
    const paramContent = paramMatch[1].trim()

    // For a single parameter with quotes, extract it directly
    const singleQuotedParam = paramContent.match(/^(['"])(.*?)\1$/)
    if (singleQuotedParam && !paramContent.includes(',')) {
      // It's a single parameter, use it as promptMessage
      promptMessage = BasePromptHandler.removeQuotes(paramContent)
      logDebug(pluginJson, `${promptType} single parameter detected: "${promptMessage}"`)
    } else {
      // Multiple parameters or complex case, use BasePromptHandler
      const basicParams = BasePromptHandler.getPromptParameters(tag, true)

      // Get the prompt message
      promptMessage = basicParams.promptMessage

      // Process additional parameters from options
      if (Array.isArray(basicParams.options)) {
        if (basicParams.options.length > 0) includePattern = BasePromptHandler.removeQuotes(basicParams.options[0]) || ''
        if (basicParams.options.length > 1) excludePattern = BasePromptHandler.removeQuotes(basicParams.options[1]) || ''
        if (basicParams.options.length > 2) allowCreate = parseBooleanString(String(basicParams.options[2]))
      } else if (typeof basicParams.options === 'string') {
        // Process string options
        const paramRegex = /,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/
        const optionParts = basicParams.options.split(paramRegex).map((part: string) => part.trim())

        logDebug(pluginJson, `${promptType} parsed options parts: ${JSON.stringify(optionParts)}`)

        // Special case for testing: split a single string with all parameters if the regex didn't work
        if (optionParts.length === 1 && optionParts[0].includes(',')) {
          const manualParts = optionParts[0].split(',').map((p: string) => p.trim())
          const filteredManualParts = manualParts.filter((s: string) => s !== '')
          // Use manually split parts if they make more logical sense
          if (filteredManualParts.length > 0) includePattern = BasePromptHandler.removeQuotes(filteredManualParts[0]) || ''
          if (filteredManualParts.length > 1) excludePattern = BasePromptHandler.removeQuotes(filteredManualParts[1]) || ''
          if (filteredManualParts.length > 2) allowCreate = parseBooleanString(filteredManualParts[2])
        } else {
          // Regular case processing
          const filteredParts = optionParts.filter((s: string) => s !== '')
          if (filteredParts.length > 0) includePattern = BasePromptHandler.removeQuotes(filteredParts[0]) || ''
          if (filteredParts.length > 1) excludePattern = BasePromptHandler.removeQuotes(filteredParts[1]) || ''
          if (filteredParts.length > 2) allowCreate = parseBooleanString(filteredParts[2])
        }
      }
    }
  } catch (error) {
    logError(pluginJson, `Error parsing ${promptType} parameters: ${error.message}`)
  }

  logDebug(
    pluginJson,
    `${promptType}.parseParameters: promptMessage="${promptMessage}" includePattern="${includePattern}" excludePattern="${excludePattern}" allowCreate=${String(allowCreate)}`,
  )

  return {
    promptMessage,
    includePattern,
    excludePattern,
    allowCreate,
  }
}

/**
 * Filter items based on include and exclude patterns
 * @param {Array<string>} items - Array of items to filter
 * @param {string} includePattern - Regex pattern to include (if empty, include all)
 * @param {string} excludePattern - Regex pattern to exclude (if empty, exclude none)
 * @param {string} itemType - Type of item being filtered ('hashtag' or 'mention') for logging
 * @returns {Array<string>} Filtered items
 */
export function filterItems(items: Array<string>, includePattern: string = '', excludePattern: string = '', itemType: string): Array<string> {
  let filtered = [...items]

  // Apply include pattern if provided
  if (includePattern) {
    try {
      const includeRegex = new RegExp(includePattern)
      filtered = filtered.filter((item) => includeRegex.test(item))
    } catch (error) {
      logError(pluginJson, `Invalid includePattern regex for ${itemType}: ${error.message}`)
    }
  }

  // Apply exclude pattern if provided
  if (excludePattern) {
    try {
      const excludeRegex = new RegExp(excludePattern)
      filtered = filtered.filter((item) => !excludeRegex.test(item))
    } catch (error) {
      logError(pluginJson, `Invalid excludePattern regex for ${itemType}: ${error.message}`)
    }
  }

  return filtered
}

/**
 * Generic prompt function for both hashtags and mentions
 * @param {string} promptMessage - The prompt message to display.
 * @param {Array<string>} items - The items to choose from.
 * @param {string} includePattern - Regex pattern to include items.
 * @param {string} excludePattern - Regex pattern to exclude items.
 * @param {boolean} allowCreate - Whether to allow creating a new item.
 * @param {string} itemType - Type of item ('hashtag' or 'mention') for UI and logging.
 * @param {string} prefix - Prefix to add to items in display ('# ' or '@ ').
 * @returns {Promise<string>} The selected item.
 */
export async function promptForItem(
  promptMessage: string,
  items: Array<string>,
  includePattern: string = '',
  excludePattern: string = '',
  allowCreate: boolean = false,
  itemType: string,
  prefix: string,
): Promise<string> {
  try {
    // Filter items based on include/exclude patterns
    const filteredItems = filterItems(items, includePattern, excludePattern, itemType)

    // If no items available, allow direct input
    if (filteredItems.length === 0) {
      logDebug(pluginJson, `No ${itemType}s found or all were filtered out`)
      const result = await getInput(promptMessage || `Enter a ${itemType} (without ${prefix.trim()}):`, 'OK', `Enter ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`)
      return typeof result === 'string' ? result : ''
    }

    // Prepare options for selection
    const options = filteredItems.map((item) => ({ label: `${prefix}${item}`, value: item }))

    // Show options to user
    // $FlowFixMe - We know this will return an object with value property
    const response: { value: string, label: string, index: number } = await chooseOptionWithModifiers(promptMessage || `Select a ${itemType}`, options, allowCreate)

    // Return the selected value (safely)
    return response.value || ''
  } catch (error) {
    logError(pluginJson, `Error in promptFor${itemType.charAt(0).toUpperCase() + itemType.slice(1)}: ${error.message}`)
    return ''
  }
}

/**
 * Parses a string that could be a regex pattern or a normal string
 * @param {string | null | void} input - The input string to parse
 * @returns {string} The parsed string, preserving regex patterns and their flags
 * @example
 * parseStringOrRegex('/Task(?!.*Done)/') // returns '/Task(?!.*Done)/'
 * parseStringOrRegex('"Task"') // returns 'Task'
 * parseStringOrRegex('/Task/i') // returns '/Task/i'
 */
export function parseStringOrRegex(input: ?string): string {
  if (input == null) return ''
  let trimmed = input.trim()

  // Remove surrounding quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1)
  }

  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  // Find the last unescaped slash
  let lastSlashIndex = -1
  let inEscape = false
  for (let i = 1; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && !inEscape) {
      inEscape = true
    } else if (trimmed[i] === '/' && !inEscape) {
      lastSlashIndex = i
    } else {
      inEscape = false
    }
  }

  if (lastSlashIndex > 0) {
    // Return the pattern including flags
    return trimmed.substring(0, lastSlashIndex + 1) + trimmed.substring(lastSlashIndex + 1)
  }

  // If no closing slash found, return as is
  return trimmed
}
