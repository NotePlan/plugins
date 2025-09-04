// @flow
/**
 * @fileoverview Class that handles the processing of standard/display prompts (not selection prompts which are in their own class)
 */

import pluginJson from '../../../../plugin.json'
import { registerPromptType, getRegisteredPromptNames } from './PromptRegistry'
import BasePromptHandler from './BasePromptHandler'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * Handler for standard prompt functionality.
 */
export default class StandardPromptHandler {
  /**
   * Process a prompt type tag and parse its parameters.
   * @param {string} tag - The raw prompt tag.
   * @param {Object} sessionData - The current session data for variable resolution.
   * @returns {Object} An object with extracted parameters.
   */
  static parseParameters(tag: string, sessionData?: any): { varName: string, promptMessage: string, options: any } {
    // First try the standard parameter extraction
    const params = BasePromptHandler.getPromptParameters(tag)

    // Process quoted strings to handle escape sequences
    if (typeof params.promptMessage === 'string') {
      params.promptMessage = params.promptMessage.replace(/\\"/g, '"').replace(/\\'/g, "'")
    }

    // Check for array literals directly in the tag
    const arrayMatch = tag.match(/\[(.*?)\]/)
    logDebug(`StandardPRompthandler, arrayMatch=${String(arrayMatch)} typeof options = ${typeof params.options}`)

    // Handle options parameter - resolve variable references if needed
    if (typeof params.options === 'string') {
      logDebug(
        `StandardPromptHandler.parseParameters: Checking options="${params.options}" with sessionData keys: ${sessionData ? Object.keys(sessionData).join(', ') : 'undefined'}`,
      )
      // First, try to resolve variable references in session data
      let resolvedValue = null
      if (sessionData && sessionData[params.options] !== undefined) {
        resolvedValue = sessionData[params.options]
        logDebug(`StandardPromptHandler.parseParameters: Resolved variable "${params.options}" to: ${JSON.stringify(resolvedValue)}`)
      } else if (sessionData && sessionData.data && sessionData.data[params.options] !== undefined) {
        // Check if the variable is nested under a 'data' property
        resolvedValue = sessionData.data[params.options]
        logDebug(`StandardPromptHandler.parseParameters: Resolved nested variable "${params.options}" to: ${JSON.stringify(resolvedValue)}`)
      }

      if (resolvedValue !== null) {
        if (typeof resolvedValue === 'string') {
          // If the resolved value is a JSON string representing an array, parse it
          if (resolvedValue.startsWith('[') && resolvedValue.endsWith(']')) {
            try {
              params.options = JSON.parse(resolvedValue)
              logDebug(`StandardPromptHandler.parseParameters: Parsed JSON string to array: ${JSON.stringify(params.options)}`)
            } catch (error) {
              logError(pluginJson, `Error parsing JSON array from variable ${params.options}: ${error.message}`)
              // Fall back to treating it as a regular string
              params.options = resolvedValue
            }
          } else {
            // Regular string value - check if it's a comma-separated list
            if (resolvedValue.includes(',') && !resolvedValue.includes('[') && !resolvedValue.includes('{')) {
              // This looks like a comma-separated list, convert to array
              params.options = resolvedValue.split(',').map((item) => item.trim())
              logDebug(`StandardPromptHandler.parseParameters: Converted comma-separated string to array: ${JSON.stringify(params.options)}`)
            } else {
              // Regular string value
              params.options = resolvedValue
            }
          }
        } else if (Array.isArray(resolvedValue)) {
          // Already an array
          params.options = resolvedValue
        } else {
          // Other types - convert to string
          params.options = String(resolvedValue)
        }
      } else if (arrayMatch) {
        // If we found an array syntax but it wasn't picked up as options,
        // manually extract the array content
        const arrayContent = arrayMatch[1].split(',').map((item) => item.trim())
        if (arrayContent.length > 0) {
          params.options = arrayContent.map((item) => BasePromptHandler.removeQuotes(item))
        }
      } else {
        // Process string options to handle escape sequences
        params.options = params.options.replace(/\\"/g, '"').replace(/\\'/g, "'")

        // Fix options if they're in array string format
        if (params.options.startsWith('[') && params.options.endsWith(']')) {
          try {
            params.options = BasePromptHandler.convertToArrayIfNeeded(params.options)
          } catch (error) {
            logError(pluginJson, `Error parsing array options: ${error.message}`)
          }
        }
      }

      // Final check: if options is still a string and looks like a comma-separated list, convert it
      // Only convert if it looks like a simple list of values (no quotes, brackets, or complex syntax)
      // AND if it appears to be a list rather than a text string
      if (
        typeof params.options === 'string' &&
        params.options.includes(',') &&
        !params.options.includes('[') &&
        !params.options.includes('{') &&
        !params.options.includes('"') &&
        !params.options.includes("'") &&
        !params.options.includes('`') &&
        params.options.trim().length > 0
      ) {
        // This looks like a simple comma-separated list, convert to array
        const items = params.options
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
        if (items.length > 1) {
          // Additional check: only convert if it looks like a list of simple values
          // (not a text string that happens to contain commas)
          // Only convert if all items are simple identifiers (no spaces, no common text words)
          const allItemsAreSimple = items.every((item) => {
            if (item.length === 0 || item.includes(' ') || item.includes('\n') || item.includes('\t')) {
              return false
            }
            // Check if it looks like a simple identifier (alphanumeric, dash, underscore, dot)
            // But exclude common English words that might appear in text
            if (/^[a-zA-Z0-9\-_.]+$/.test(item)) {
              // Additional check: don't convert if it contains common English words
              const commonWords = [
                'with',
                'and',
                'or',
                'the',
                'a',
                'an',
                'in',
                'on',
                'at',
                'to',
                'for',
                'of',
                'by',
                'from',
                'up',
                'down',
                'out',
                'off',
                'over',
                'under',
                'between',
                'among',
                'through',
                'during',
                'before',
                'after',
                'since',
                'until',
                'while',
                'when',
                'where',
                'why',
                'how',
                'what',
                'which',
                'who',
                'whom',
                'whose',
                'this',
                'that',
                'these',
                'those',
                'is',
                'are',
                'was',
                'were',
                'be',
                'been',
                'being',
                'have',
                'has',
                'had',
                'do',
                'does',
                'did',
                'will',
                'would',
                'could',
                'should',
                'may',
                'might',
                'can',
                'must',
                'shall',
              ]
              return !commonWords.includes(item.toLowerCase())
            }
            return false
          })
          if (allItemsAreSimple) {
            params.options = items
            logDebug(`StandardPromptHandler.parseParameters: Final conversion of comma-separated string to array: ${JSON.stringify(params.options)}`)
          }
        }
      }
    }

    return params
  }

  /**
   * Display a user prompt using the CommandBar
   * @param {string} tag - The tag to process
   * @param {string} message - The message to display to the user
   * @param {any} options - The options to show in a dropdown or default value in a text prompt
   * @returns {Promise<string>} - The user's response
   */
  static async prompt(tag: string, message: string, options: any = ''): Promise<string | false> {
    try {
      logDebug(`StandardPromptHandler::prompt tag=${tag} message=${message} options=${String(options)} (${typeof options})`)
      // Process message to handle escaped quotes properly
      let processedMessage = message
      if (typeof processedMessage === 'string') {
        // Attempt to replace any escaped quotes with actual quotes
        processedMessage = processedMessage.replace(/\\"/g, '"').replace(/\\'/g, "'")
      }

      // Process options/default value if it's a string
      let processedOptions = options
      if (typeof processedOptions === 'string') {
        processedOptions = processedOptions.replace(/\\"/g, '"').replace(/\\'/g, "'")
      }

      // Check if options is an array to decide whether to use showOptions or textPrompt
      if (Array.isArray(options)) {
        logDebug(pluginJson, `Showing options: ${options.join(', ')}`)
        // showOptions method expects (options, message) in NotePlan's API
        const optionsResponse = await CommandBar.showOptions(options, processedMessage)
        return optionsResponse && optionsResponse.value ? optionsResponse.value : options[0] || ''
      } else if (options && typeof options === 'object' && !Array.isArray(options)) {
        // Handle object options (could be for future extensions)
        logDebug(pluginJson, `Showing text prompt with object options: ${JSON.stringify(options)}`)
        const textResponse = await CommandBar.textPrompt('', processedMessage, '')
        return textResponse
      } else {
        // String options are treated as default values
        const defaultValue: string = typeof processedOptions === 'string' ? processedOptions : ''

        logDebug(pluginJson, `Showing text prompt with default: ${defaultValue}`)
        const textResponse = await CommandBar.textPrompt('', processedMessage, defaultValue)
        return textResponse || ''
      }
    } catch (error) {
      logError(pluginJson, `Error in prompt: ${error.message}`)
      return ''
    }
  }

  /**
   * Get a response from the user based on the options
   * @param {string} message - The prompt message
   * @param {string|string[]} options - Options for the prompt
   * @returns {Promise<string>} The user's response
   */
  static async getResponse(message: string, options: string | string[]): Promise<string | false> {
    logDebug(pluginJson, `StandardPromptHandler.getResponse: Getting response for message="${message}", options=${JSON.stringify(options)}`)

    try {
      // If options is an array, use showOptions
      if (Array.isArray(options) && options.length > 0) {
        logDebug(pluginJson, `StandardPromptHandler.getResponse: Using CommandBar.showOptions with array options: ${JSON.stringify(options)}`)

        // Pass the array directly to showOptions without conversion
        const result = await CommandBar.showOptions(options, message || 'Choose an option:')

        // Add logging about result to help diagnose escape key issues
        if (result === null) {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: Result is null - likely cancelled with Escape`)
          return ''
        } else if (result === undefined) {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: Result is undefined - likely cancelled with Escape`)
          return ''
        } else {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: Result type: ${typeof result}`)
        }

        // Handle the result - it may be an object with a value property or a direct value
        if (result) {
          if (typeof result === 'object' && result.value !== undefined) {
            return String(result.value)
          } else if (typeof result === 'string') {
            return result
          }
          return String(result)
        }

        logDebug(pluginJson, `StandardPromptHandler.getResponse: Empty result - user likely cancelled with Escape`)
        return false
      } else {
        // For string options or no options, use textPrompt
        const defaultText = typeof options === 'string' ? options : ''
        logDebug(pluginJson, `StandardPromptHandler.getResponse: Using CommandBar.textPrompt with default="${defaultText}"`)

        const promptResult = await CommandBar.textPrompt('', message || 'Enter a value:', defaultText)

        // Add logging about result to help diagnose escape key issues
        if (promptResult === null) {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: TextPrompt result is null - likely cancelled with Escape`)
          return false
        } else if (promptResult === undefined) {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: TextPrompt result is undefined - likely cancelled with Escape`)
          return false
        } else if (promptResult === false) {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: TextPrompt result is false - likely cancelled with Escape`)
          return false
        } else {
          logDebug(pluginJson, `StandardPromptHandler.getResponse: TextPrompt result type: ${typeof promptResult}`)
        }

        return typeof promptResult === 'string' ? promptResult : String(promptResult)
      }
    } catch (error) {
      logError(pluginJson, `Error getting response: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the standardPrompt tag.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} paramsObj - The parameters from parseParameters.
   * @returns {Promise<string|false>} The processed prompt result or false if cancelled
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string | false> {
    const { varName, promptMessage, options, forcePrompt } = params

    logDebug(
      pluginJson,
      `StandardPromptHandler.process: Starting with varName="${varName}", promptMessage="${promptMessage}", options=${JSON.stringify(options)}, forcePrompt=${
        forcePrompt ? 'true' : 'false'
      }`,
    )

    // Extract the variable name from the first parameter if it exists
    // This handles the case where prompt("varName", "message") is used
    let firstParamVarName = null
    const promptParamMatch = tag.match(/(?:^|\s)prompt\(\s*['"]([^'"]+)['"]\s*,/)
    if (promptParamMatch && promptParamMatch[1]) {
      firstParamVarName = promptParamMatch[1]
      logDebug(pluginJson, `StandardPromptHandler.process: Detected variable name in first parameter: ${firstParamVarName}`)
    }

    // Check if this is a variable assignment with await
    const hasAwait = tag.includes('await prompt')

    // Check if forcePrompt is set
    const shouldForcePrompt = forcePrompt === true

    // Function to check if a value looks like a function call text
    const isFunctionCallText = (value: any): boolean => {
      if (typeof value !== 'string') return false

      // Test for any prompt function call patterns with or without await
      const promptTypes = getRegisteredPromptNames()
      // const promptTypes = getRegisteredPromptNames ? getRegisteredPromptNames() : ['prompt', 'promptKey', 'promptDate', 'promptTag', 'promptMention', 'promptDateInterval']
      const promptTypesPattern = promptTypes.join('|')
      const pattern = new RegExp(`^(await\\s+)?(${promptTypesPattern})\\s*\\(.*\\)$`)

      return pattern.test(value)
    }

    // For StandardPromptHandler (the "prompt" type), always execute when forcePrompt is true or has await
    let shouldExecutePrompt = shouldForcePrompt || hasAwait
    let existingValue = null

    // Check for function call text values in session data which need to be replaced
    if (varName && sessionData[varName] !== undefined) {
      if (isFunctionCallText(sessionData[varName]) || sessionData[varName] === `await prompt(${varName})` || sessionData[varName] === `prompt(${varName})`) {
        // Force prompt execution to replace function call text
        shouldExecutePrompt = true
        logDebug(pluginJson, `StandardPromptHandler.process: Found function call text in session data[${varName}]: "${sessionData[varName]}", will execute prompt`)
      } else if (BasePromptHandler.isValidSessionValue(sessionData[varName], 'prompt', varName) && !shouldExecutePrompt && sessionData[varName] !== '') {
        // Only use existing value if it's valid, non-empty, and we don't need to force execution
        existingValue = sessionData[varName]
        logDebug(pluginJson, `StandardPromptHandler.process: Using valid existing value from session data[${varName}]: "${existingValue}"`)
      } else if (sessionData[varName] === '') {
        // Treat empty strings as a reason to show the prompt
        shouldExecutePrompt = true
        logDebug(pluginJson, `StandardPromptHandler.process: Found empty string in session data[${varName}], will execute prompt`)
      }
    }

    // Check first parameter variable name as well
    if (!existingValue && !shouldExecutePrompt && firstParamVarName && sessionData[firstParamVarName] !== undefined) {
      if (
        isFunctionCallText(sessionData[firstParamVarName]) ||
        sessionData[firstParamVarName] === `await prompt(${firstParamVarName})` ||
        sessionData[firstParamVarName] === `prompt(${firstParamVarName})`
      ) {
        shouldExecutePrompt = true
        logDebug(
          pluginJson,
          `StandardPromptHandler.process: Found function call text in session data[${firstParamVarName}]: "${sessionData[firstParamVarName]}", will execute prompt`,
        )
      } else if (BasePromptHandler.isValidSessionValue(sessionData[firstParamVarName], 'prompt', firstParamVarName) && sessionData[firstParamVarName] !== '') {
        existingValue = sessionData[firstParamVarName]
        logDebug(pluginJson, `StandardPromptHandler.process: Using valid existing value from session data[${firstParamVarName}]: "${existingValue}"`)
      } else if (sessionData[firstParamVarName] === '') {
        // Treat empty strings as a reason to show the prompt
        shouldExecutePrompt = true
        logDebug(pluginJson, `StandardPromptHandler.process: Found empty string in session data[${firstParamVarName}], will execute prompt`)
      }
    }

    // Special case for "prompt" function: always execute if value matches exact function call pattern
    if (
      varName &&
      sessionData[varName] &&
      typeof sessionData[varName] === 'string' &&
      (sessionData[varName].includes('await prompt') || sessionData[varName].includes('prompt('))
    ) {
      shouldExecutePrompt = true
      logDebug(pluginJson, `StandardPromptHandler.process: Found prompt function call pattern in value: "${sessionData[varName]}", will execute prompt`)
    }

    // Also check for first param var name
    if (
      firstParamVarName &&
      sessionData[firstParamVarName] &&
      typeof sessionData[firstParamVarName] === 'string' &&
      (sessionData[firstParamVarName].includes('await prompt') || sessionData[firstParamVarName].includes('prompt('))
    ) {
      shouldExecutePrompt = true
      logDebug(pluginJson, `StandardPromptHandler.process: Found prompt function call pattern in value: "${sessionData[firstParamVarName]}", will execute prompt`)
    }

    // If we have a valid existing value that's not a function call, use it
    if (existingValue !== null && !shouldExecutePrompt) {
      // Store the value in both variable names to ensure consistency
      if (varName) sessionData[varName] = existingValue
      if (firstParamVarName && firstParamVarName !== varName) sessionData[firstParamVarName] = existingValue
      return existingValue
    }

    // At this point, we need to execute the prompt
    try {
      let response: string = ''

      // Standard case - use the getResponse method
      const standardResponse = await StandardPromptHandler.getResponse(promptMessage, options)
      if (standardResponse === false) {
        logDebug(pluginJson, `StandardPromptHandler.process: Prompt cancelled - returning false`)
        return false
      }
      response = typeof standardResponse === 'string' ? standardResponse : ''

      // Store the result in the appropriate places in sessionData
      // Always store in the variable assignment from the template if it exists
      if (varName) {
        sessionData[varName] = response
        logDebug(pluginJson, `StandardPromptHandler.process: Storing result in sessionData[${varName}]: ${response}`)
      }

      // Also store in the first parameter variable if it's different from varName
      if (firstParamVarName && firstParamVarName !== varName) {
        sessionData[firstParamVarName] = response
        logDebug(pluginJson, `StandardPromptHandler.process: Also storing result in sessionData[${firstParamVarName}]: ${response}`)
      }

      return response
    } catch (error) {
      logError(pluginJson, `Error in standard prompt: ${error.message}`)
      return ''
    }
  }
}

// Register the prompt type
registerPromptType({
  name: 'prompt',
  parseParameters: (tag: string, sessionData?: any) => StandardPromptHandler.parseParameters(tag, sessionData),
  process: StandardPromptHandler.process.bind(StandardPromptHandler),
})
