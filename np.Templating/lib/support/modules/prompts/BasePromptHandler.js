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
   * Cleans a variable name by removing invalid characters
   * @param {string} varName - The variable name to clean
   * @returns {string} The cleaned variable name
   */
  static cleanVarName(varName: string): string {
    // If varName is null, undefined, or empty string, return 'unnamed'
    if (!varName) return 'unnamed'

    // First remove question marks specifically
    const noQuestionMarks = varName.replace(/\?/g, '')

    // Replace spaces with underscores but preserve Unicode characters and alphanumeric chars
    let cleaned = noQuestionMarks.replace(/\s+/g, '_')

    // Ensure it starts with a letter, underscore, or Unicode letter
    if (!/^[\p{L}_$]/u.test(cleaned)) {
      if (/^\d/.test(cleaned)) {
        // If it starts with a number, prefix with 'var_'
        cleaned = `var_${cleaned}`
      } else {
        // For other invalid starting characters, just prepend underscore
        cleaned = `_${cleaned}`
      }
    }

    // Handle reserved keywords by prefixing with 'var_'
    const reservedKeywords = ['class', 'function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return']
    if (reservedKeywords.includes(cleaned)) {
      cleaned = `var_${cleaned}`
    }

    // If we ended up with an empty string after all the cleaning, use 'unnamed'
    return cleaned || 'unnamed'
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
      // Handle potential nested quotes - if content is something like "'quoted string'"
      // we need to remove both sets of quotes
      const inner = content.substring(1, content.length - 1)

      // Recursively remove nested quotes if present
      if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'")) || (inner.startsWith('`') && inner.endsWith('`'))) {
        return BasePromptHandler.removeQuotes(inner)
      }

      return inner
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
   * Extracts variable assignment information from a template tag
   * @param {string} tag - The template tag content
   * @returns {?{varName: string, cleanedTag: string}} The extracted variable name and cleaned tag, or null if no assignment
   */
  static extractVariableAssignment(tag: string): ?{ varName: string, cleanedTag: string } {
    // Check for variable assignment patterns: const/let/var varName = [await] promptType(...)
    const assignmentMatch = tag.match(/^\s*(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(await\s+.+|.+)$/i)

    if (assignmentMatch) {
      const varName = assignmentMatch[2].trim()
      let cleanedTag = assignmentMatch[3].trim()

      // Handle await in the prompt call itself
      if (cleanedTag.startsWith('await ')) {
        cleanedTag = cleanedTag.substring(6).trim()
      }

      return { varName, cleanedTag }
    }

    // Check for direct await assignment: await promptType(...)
    const awaitMatch = tag.match(/^\s*await\s+(.+)$/i)
    if (awaitMatch) {
      return { varName: '', cleanedTag: awaitMatch[1].trim() }
    }

    return null
  }

  /**
   * Attempts direct extraction of parameters from parentheses
   * @param {string} promptTag - The prompt tag to extract from
   * @returns {Object} Object with the directly extracted message or null if extraction failed
   */
  static extractDirectParameters(promptTag: string): ?{ message: string } {
    try {
      const openParenIndex = promptTag.indexOf('(')
      const closeParenIndex = promptTag.lastIndexOf(')')

      if (openParenIndex > 0 && closeParenIndex > openParenIndex) {
        const paramsText = promptTag.substring(openParenIndex + 1, closeParenIndex).trim()
        logDebug(pluginJson, `BasePromptHandler direct extraction: "${paramsText}"`)

        // Check if it's a single quoted parameter
        if (paramsText && paramsText.length > 0) {
          const singleQuoteMatch = paramsText.match(/^(['"])(.*?)\1$/)
          if (singleQuoteMatch && !paramsText.includes(',')) {
            const message = BasePromptHandler.removeQuotes(paramsText)
            logDebug(pluginJson, `BasePromptHandler found single parameter: "${message}"`)
            return { message }
          }
        }
      }
    } catch (error) {
      logError(pluginJson, `Error in direct parameter extraction: ${error.message}`)
    }

    return null
  }

  /**
   * Parses options from text, handling arrays and quoted strings
   * @param {string} optionsText - The text containing options
   * @param {Array<string>} quotedTexts - Array of quoted texts to restore
   * @param {Array<{placeholder: string, value: string}>} arrayPlaceholders - Array placeholders to restore
   * @returns {string|string[]} Parsed options as string or string array
   */
  static parseOptions(optionsText: string, quotedTexts: Array<string>, arrayPlaceholders: Array<{ placeholder: string, value: string }>): string | string[] {
    // Restore quoted texts
    let processedText = optionsText
    quotedTexts.forEach((text, index) => {
      processedText = processedText.replace(`__QUOTED_TEXT_${index}__`, text)
    })

    // Restore array placeholders
    arrayPlaceholders.forEach(({ placeholder, value }) => {
      processedText = processedText.replace(placeholder, value)
    })

    // Parse options
    if (processedText.startsWith('[') && processedText.endsWith(']')) {
      try {
        // Parse array options
        const arrayContent = processedText.substring(1, processedText.length - 1)
        return arrayContent
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
        return []
      }
    } else {
      // For string options, we need to properly process each item
      if (processedText.includes(',')) {
        // Check if this is likely a complex object string with commas (like JSON)
        const quotesMatch = processedText.match(/(['"])[^'"]*\1/g)
        const isComplexObject =
          (processedText.includes('{') && processedText.includes('}')) ||
          (processedText.includes(':') && processedText.includes('"')) ||
          (quotesMatch !== null && quotesMatch.length > 1)

        // Check for quoted comma-separated values pattern like "'Option 1', 'Option 2'"
        const quotedCommaSeparatedPattern = /^(['"])([^'"]*)\1\s*,\s*(['"])([^'"]*)\3$/
        const quotedMatch = processedText.match(quotedCommaSeparatedPattern)
        if (quotedMatch) {
          return `${quotedMatch[2]}, ${quotedMatch[4]}`
        }

        // Special case: single quoted string containing commas
        // like: "'Default, with comma'" or '"Default, with comma"'
        if ((processedText.startsWith("'") && processedText.endsWith("'")) || (processedText.startsWith('"') && processedText.endsWith('"'))) {
          // Check if this is a directly quoted string with commas inside
          const innerContent = processedText.substring(1, processedText.length - 1)
          if (innerContent.includes(',') && !innerContent.includes("'") && !innerContent.includes('"')) {
            return innerContent
          }
        }

        if (isComplexObject && (processedText.startsWith("'") || processedText.startsWith('"'))) {
          // If this looks like a complex object string with commas that's already quoted,
          // just remove the outer quotes once and return it as is
          return BasePromptHandler.removeQuotes(processedText)
        }

        // Handle normal comma-separated options by splitting and removing quotes from each item
        // When splitting by comma, make sure to handle each quoted part independently
        return processedText
          .split(/,(?=(?:[^']*'[^']*')*[^']*$)/) // Split by commas not inside quotes
          .map((part) => BasePromptHandler.removeQuotes(part.trim()))
          .join(', ')
      }

      // Single option, just remove quotes
      return BasePromptHandler.removeQuotes(processedText)
    }
  }

  /**
   * Parses parameters from a cleaned tag
   * @param {string} tagValue - The cleaned tag value to parse
   * @param {boolean} noVar - Whether the first parameter is variable name
   * @returns {Object} Parsed parameters object
   */
  static parseParameters(tagValue: string, noVar: boolean = false): any {
    if (!tagValue || tagValue.trim() === '') {
      return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
    }

    logDebug(pluginJson, `BasePromptHandler parseParameters with tagValue: "${tagValue}", noVar: ${String(noVar)}`)

    // Special case for test format with array literals in the string: "'myVar', 'Choose an option:', ['Option 1', 'Option 2']"
    if (tagValue.includes('[') && tagValue.includes(']')) {
      const arrayMatch = tagValue.match(/\[['"](.+?)['"](,\s*['"].+?['"])*\]/)
      if (arrayMatch) {
        // Test case with array options
        const parts = tagValue.split(',')

        // Extract everything up to the array start
        const beforeArray = parts
          .slice(
            0,
            parts.findIndex((p) => p.includes('[')),
          )
          .join(',')
        const beforeParams = BasePromptHandler.extractQuotedStrings(beforeArray)

        // Extract array portion
        const arrayStart = tagValue.indexOf('[')
        const arrayEnd = tagValue.lastIndexOf(']') + 1
        const arrayPortion = tagValue.substring(arrayStart, arrayEnd)

        // Convert the array string to actual array
        const arrayOptions = BasePromptHandler.convertToArrayIfNeeded(arrayPortion)

        if (noVar) {
          return {
            varName: '',
            promptMessage: beforeParams[0] || '',
            options: arrayOptions,
          }
        } else {
          return {
            varName: BasePromptHandler.cleanVarName(beforeParams[0] || 'unnamed'),
            promptMessage: beforeParams.length > 1 ? beforeParams[1] : '',
            options: arrayOptions,
          }
        }
      }
    }

    // For simple comma-separated parameters without parentheses (direct parameter string)
    if (!tagValue.includes('(') && (tagValue.includes(',') || tagValue.includes("'") || tagValue.includes('"'))) {
      // This format is used in test cases like "'myVar', 'Enter a value:'"
      const params = BasePromptHandler.extractQuotedStrings(tagValue)

      if (params.length > 0) {
        if (noVar) {
          // Handle array options for noVar case
          let options: string | Array<string> = params.length > 1 ? params.slice(1).join(', ') : ''

          // Check if options looks like an array
          if (typeof options === 'string' && options.includes('[') && options.includes(']')) {
            const arrayMatch = options.match(/\[(.*)\]/)
            if (arrayMatch && arrayMatch[1]) {
              options = BasePromptHandler.convertToArrayIfNeeded(`[${arrayMatch[1]}]`)
            }
          }

          const result = {
            varName: '',
            promptMessage: params[0] || '',
            options: options,
          }
          return result
        } else {
          // Handle array options for normal case
          let options: string | Array<string> = params.length > 2 ? params.slice(2).join(', ') : ''

          // Check if options looks like an array
          if (typeof options === 'string' && options.includes('[') && options.includes(']')) {
            const arrayMatch = options.match(/\[(.*)\]/)
            if (arrayMatch && arrayMatch[1]) {
              options = BasePromptHandler.convertToArrayIfNeeded(`[${arrayMatch[1]}]`)
            }
          }

          const result = {
            varName: BasePromptHandler.cleanVarName(params[0] || 'unnamed'),
            promptMessage: params.length > 1 ? params[1] : '',
            options: options,
          }
          return result
        }
      }
    }

    // Extract directly from parentheses
    const directParams = BasePromptHandler.extractDirectParameters(tagValue)
    if (directParams && directParams.message) {
      // Handle the case of promptType("message")
      return {
        varName: noVar ? '' : BasePromptHandler.cleanVarName(directParams.message),
        promptMessage: noVar ? directParams.message : '',
        options: '',
      }
    }

    // Handle more complex prompt parameters
    try {
      const openParenIndex = tagValue.indexOf('(')
      const closeParenIndex = tagValue.lastIndexOf(')')

      if (openParenIndex === -1 || closeParenIndex === -1 || closeParenIndex < openParenIndex) {
        logError(pluginJson, `No valid parameters found in tag: ${tagValue}`)
        return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
      }

      const paramsContent = tagValue.substring(openParenIndex + 1, closeParenIndex).trim()
      if (!paramsContent) {
        return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
      }

      logDebug(pluginJson, `BasePromptHandler parsing parameters content: "${paramsContent}"`)

      // Replace quoted strings with placeholders to avoid issues with commas in quotes
      const quotedTexts: Array<string> = []
      let processedContent = paramsContent.replace(/(['"`])(.*?)\1/g, (match, quote, content) => {
        quotedTexts.push(match)
        return `__QUOTED_TEXT_${quotedTexts.length - 1}__`
      })

      // Handle array placeholders by replacing them with special tokens
      const arrayPlaceholders: Array<{ placeholder: string, value: string }> = []
      const arrayRegex = /(\[[^\]]*\])/g
      let arrayMatch
      let index = 0

      while ((arrayMatch = arrayRegex.exec(processedContent)) !== null) {
        if (arrayMatch && arrayMatch[1]) {
          const arrayValue = arrayMatch[1]
          const placeholder = `__ARRAY_${index}__`
          arrayPlaceholders.push({ placeholder, value: arrayValue })
          processedContent = processedContent.replace(arrayValue, placeholder)
          index++
        }
      }

      // Split the parameters by comma, ignoring commas in placeholders
      const params = processedContent.split(/\s*,\s*/)
      logDebug(pluginJson, `BasePromptHandler params split: ${JSON.stringify(params)}`)

      // Process parameters based on whether noVar is true or false
      if (noVar) {
        const promptMessage = params[0] ? BasePromptHandler.parseOptions(params[0], quotedTexts, arrayPlaceholders) : ''
        let options: string | Array<string> = params.length > 1 ? BasePromptHandler.parseOptions(params[1], quotedTexts, arrayPlaceholders) : ''

        // Convert string array representations to actual arrays
        if (typeof options === 'string' && options.startsWith('[') && options.endsWith(']')) {
          try {
            // Handle array options with proper conversion
            options = BasePromptHandler.convertToArrayIfNeeded(options)
          } catch (e) {
            logDebug(pluginJson, `Error parsing array options: ${e.message}, keeping as string`)
          }
        }

        // Include the rest of the parameters
        const remainingParams: { [key: string]: string } = {}
        for (let i = 2; i < params.length; i++) {
          const paramValue = params[i] ? BasePromptHandler.parseOptions(params[i], quotedTexts, arrayPlaceholders) : ''
          if (typeof paramValue === 'string') {
            remainingParams[`param${i}`] = paramValue
          }
        }

        const result: {
          promptMessage: any,
          options: any,
          varName: string,
          [key: string]: any,
        } = {
          promptMessage,
          options,
          varName: '',
        }

        // Add remaining parameters individually
        Object.keys(remainingParams).forEach((key) => {
          result[key] = remainingParams[key]
        })

        return result
      } else {
        // First parameter is the variable name
        const varName = BasePromptHandler.cleanVarName(params[0] ? String(BasePromptHandler.parseOptions(params[0], quotedTexts, arrayPlaceholders)) : 'unnamed')
        const promptMessage = params.length > 1 ? BasePromptHandler.parseOptions(params[1], quotedTexts, arrayPlaceholders) : ''
        let options: string | Array<string> = params.length > 2 ? BasePromptHandler.parseOptions(params[2], quotedTexts, arrayPlaceholders) : ''

        // Convert string array representations to actual arrays
        if (typeof options === 'string' && options.startsWith('[') && options.endsWith(']')) {
          try {
            // Handle array options with proper conversion
            options = BasePromptHandler.convertToArrayIfNeeded(options)
          } catch (e) {
            logDebug(pluginJson, `Error parsing array options: ${e.message}, keeping as string`)
          }
        }

        // Include the rest of the parameters
        const remainingParams: { [key: string]: string } = {}
        for (let i = 3; i < params.length; i++) {
          const paramValue = params[i] ? BasePromptHandler.parseOptions(params[i], quotedTexts, arrayPlaceholders) : ''
          if (typeof paramValue === 'string') {
            remainingParams[`param${i - 2}`] = paramValue
          }
        }

        const result: {
          varName: string,
          promptMessage: any,
          options: any,
          [key: string]: any,
        } = {
          varName,
          promptMessage,
          options,
        }

        // Add remaining parameters individually
        Object.keys(remainingParams).forEach((key) => {
          result[key] = remainingParams[key]
        })

        return result
      }
    } catch (error) {
      logError(pluginJson, `Error in parseParameters: ${error.message}`)
      return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
    }
  }

  /**
   * Gets the parameters from a template tag.
   * This handles extracting the variable name, prompt message, and options.
   * @param {string} tag - The template tag.
   * @param {boolean} noVar - Whether to disable variable name extraction.
   * @returns {Object} The parsed parameters.
   */
  static getPromptParameters(tag: string, noVar: boolean = false): any {
    logDebug(pluginJson, `BasePromptHandler.getPromptParameters: starting with tag: "${tag.substring(0, 50)}..." noVar=${String(noVar)}`)

    // Process away template syntax first
    const cleanedTag = tag.replace(/<%[-=]?\s*|\s*-?\s*%>/g, '').trim()
    logDebug(pluginJson, `BasePromptHandler.getPromptParameters: cleanedTag="${cleanedTag}"`)

    // Check for variable assignment first
    const assignmentInfo = BasePromptHandler.extractVariableAssignment(cleanedTag)
    if (assignmentInfo) {
      logDebug(pluginJson, `BasePromptHandler.getPromptParameters: Found variable assignment: varName="${assignmentInfo.varName}", cleanedTag="${assignmentInfo.cleanedTag}"`)

      // For variable assignments like 'const result = promptKey("Choose an option:")'
      // we need to extract the prompt parameters from inside the function call
      const cleanedAssignmentTag = assignmentInfo.cleanedTag

      // Extract the function name from the cleaned tag
      const funcNameMatch = cleanedAssignmentTag.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/)
      const functionName = funcNameMatch ? funcNameMatch[1] : ''
      logDebug(pluginJson, `BasePromptHandler.getPromptParameters: functionName="${functionName}"`)

      // Extract parameters from the function call
      const openParenIndex = cleanedAssignmentTag.indexOf('(')
      const closeParenIndex = cleanedAssignmentTag.lastIndexOf(')')

      if (openParenIndex > 0 && closeParenIndex > openParenIndex) {
        const paramsText = cleanedAssignmentTag.substring(openParenIndex + 1, closeParenIndex).trim()
        logDebug(pluginJson, `BasePromptHandler.getPromptParameters: paramsText="${paramsText}"`)

        // Check if the parameter might be an unquoted variable reference
        const isUnquotedParam = /^\s*(\w+)\s*$/.test(paramsText)
        if (isUnquotedParam) {
          logDebug(pluginJson, `BasePromptHandler.getPromptParameters: Detected unquoted parameter "${paramsText}" - may be a variable reference`)
        }

        // Extract quoted strings for parameters
        const quotedParams = BasePromptHandler.extractQuotedStrings(paramsText)
        logDebug(pluginJson, `BasePromptHandler.getPromptParameters: quotedParams=${JSON.stringify(quotedParams)}`)

        if (quotedParams.length > 0) {
          const result: {
            varName: string,
            promptMessage: string,
            options: string | Array<string>,
          } = {
            varName: BasePromptHandler.cleanVarName(assignmentInfo.varName),
            promptMessage: quotedParams[0] || '',
            options: '',
          }
          logDebug(pluginJson, `BasePromptHandler.getPromptParameters: created initial result with varName="${result.varName}", promptMessage="${result.promptMessage}"`)

          // Preserve quotes in promptMessage if it begins with a quote
          if (result.promptMessage.startsWith('"') && !result.promptMessage.endsWith('"')) {
            result.promptMessage = `"${result.promptMessage}"`
          }

          // Handle additional options if present
          if (quotedParams.length > 1) {
            const options = quotedParams[1]

            // Check if it's a comma-separated list that should be combined
            if (quotedParams.length > 2 && !paramsText.includes('[')) {
              // For formats like "option1", "option2" - combine them properly
              result.options = quotedParams.slice(1).join(', ')
            } else {
              result.options = options

              // Check if options might be an array literal
              if (paramsText.includes('[') && paramsText.includes(']')) {
                const arrayMatch = paramsText.match(/\[(.*?)\]/)
                if (arrayMatch) {
                  // Convert string array to actual array
                  result.options = BasePromptHandler.convertToArrayIfNeeded(`[${arrayMatch[1]}]`)
                }
              }
            }
          }

          return result
        }
      }

      // If we can't extract parameters directly, use a fallback
      return {
        varName: BasePromptHandler.cleanVarName(assignmentInfo.varName),
        promptMessage: '',
        options: '',
      }
    }

    // For non-assignment case, use parseParameters which handles all standard cases
    if (noVar && tag.includes('prompt(')) {
      // Special case for noVar=true and direct prompt calls
      if (tag.includes(',')) {
        // This handles "prompt('message', 'option1', 'option2')" format
        const tagNoPrompt = tag.replace(/prompt\s*\(\s*/, '')
        const params = BasePromptHandler.extractQuotedStrings(tagNoPrompt)

        return {
          varName: '',
          promptMessage: params[0] || '',
          options: params.length > 1 ? params.slice(1).join(', ') : '',
        }
      }
    }

    return BasePromptHandler.parseParameters(tag, noVar)
  }

  /**
   * Gets the prompt type from a tag
   * @param {string} tag - Tag to extract prompt type from
   * @returns {string} The extracted prompt type or empty string
   */
  static getPromptTypeFromTag(tag: string): string {
    const cleanedTag = BasePromptHandler.cleanPromptTag(tag)
    const promptTypes = getRegisteredPromptNames()

    for (const promptType of promptTypes) {
      if (cleanedTag.startsWith(promptType)) {
        return promptType
      }
    }

    return ''
  }

  /**
   * Cleans a prompt tag by removing template syntax and prompt function names
   * @param {string} tag - The template tag to clean
   * @returns {string} The cleaned tag content
   */
  static cleanPromptTag(tag: string): string {
    // Clean up template syntax if present
    const cleanedTag = tag.replace(/<%[-=]?\s*|\s*-?\s*%>/g, '').trim()

    // Use the dynamic pattern to remove prompt function names and other syntax
    return cleanedTag.replace(BasePromptHandler.getPromptCleanupPattern(), '').trim()
  }

  /**
   * Extracts quoted strings from text, respecting escaped quotes
   * @param {string} text - The text to extract quoted strings from
   * @returns {Array<string>} Array of extracted parameters
   */
  static extractQuotedStrings(text: string): Array<string> {
    const parameters = []
    const regex = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g

    let match
    let lastIndex = 0

    // Extract all quoted strings
    while ((match = regex.exec(text)) !== null) {
      // Flow needs this check to be sure match isn't null (even though the while condition ensures this)
      if (match) {
        const quotedString = match[0]
        parameters.push(BasePromptHandler.removeQuotes(quotedString))
        lastIndex = regex.lastIndex
      }
    }

    // If no quoted strings were found and there's text, use it as is
    if (parameters.length === 0 && text.trim().length > 0) {
      parameters.push(text.trim())
    }

    return parameters
  }

  /**
   * Convert a string representation of an array to an actual array
   * @param {string} arrayString - String representation of array (e.g., "[1, 2, 3]")
   * @returns {Array<string>} - Actual array with string elements
   */
  static convertToArrayIfNeeded(arrayString: string): string[] | string {
    if (!arrayString || typeof arrayString !== 'string') {
      return arrayString
    }

    // If it's already an array, return it as is
    if (Array.isArray(arrayString)) {
      return arrayString
    }

    if (arrayString.startsWith('[') && arrayString.endsWith(']')) {
      try {
        // Remove outer brackets
        const content = arrayString.substring(1, arrayString.length - 1)

        // Handle the case of an empty array
        if (content.trim() === '') {
          return []
        }

        // Split by commas, handling quoted elements
        const items = content
          .split(/,(?=(?:[^']*'[^']*')*[^']*$)/)
          .map((item) => {
            // Clean up items and remove quotes
            const trimmed = item.trim()
            return BasePromptHandler.removeQuotes(trimmed)
          })
          .filter(Boolean)

        return items
      } catch (e) {
        logError(pluginJson, `Error converting array: ${e.message}`)
        // If parsing fails, return empty array instead of original string
        return []
      }
    }

    return arrayString
  }

  /**
   * Checks if a value in session data is valid (not a function call or other invalid representation).
   * @param {any} value - The value to check.
   * @param {string} promptType - The type of prompt being checked.
   * @param {string} variableName - The name of the variable being processed.
   * @returns {boolean} True if the value is valid (not a function call text), false otherwise.
   */
  static isValidSessionValue(value: any, promptType: string, variableName: string): boolean {
    // If value is not a string, it's valid (e.g., array of options)
    if (typeof value !== 'string') {
      return true
    }

    // Empty string is considered valid, even though it's not a useful value
    if (!value) {
      return true
    }

    // Get all registered prompt types for checking
    const promptTypes = getRegisteredPromptNames()

    // Simple exact cases - direct matches to promptType() or await promptType()
    if (value === `${promptType}()` || value === `await ${promptType}()`) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" is an exact match for empty ${promptType}(), not valid.`)
      return false
    }

    // Also check empty function call in any prompt type
    for (const type of promptTypes) {
      if (value === `${type}()` || value === `await ${type}()`) {
        logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" is an exact match for empty ${type}(), not valid.`)
        return false
      }
    }

    // Check for promptType(variableName) or await promptType(variableName)
    if (value === `${promptType}(${variableName})` || value === `await ${promptType}(${variableName})`) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" matches exact ${promptType}(${variableName}), not valid.`)
      return false
    }

    // Also for any other prompt type with this variable name
    for (const type of promptTypes) {
      if (value === `${type}(${variableName})` || value === `await ${type}(${variableName})`) {
        logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" matches exact ${type}(${variableName}), not valid.`)
        return false
      }
    }

    // Special cases for await prompt() with flexible whitespace handling
    if (/^\s*await\s+\w+\s*\(\s*\)\s*$/.test(value)) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" is a pattern match for "await prompt()", not valid.`)
      return false
    }

    // Match any prompt function call with flexible whitespace, with or without await
    if (/^\s*(await\s+)?\w+\s*\(\s*\)\s*$/.test(value)) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" matches empty function call pattern, not valid.`)
      return false
    }

    // Create a regex pattern that matches all possible function call text representations
    const promptTypePattern = promptTypes.map((type) => type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

    // More comprehensive pattern to match function calls with or without parameters, with or without await
    // This will catch variations like "await prompt('message')" or "promptKey(variable)"
    const functionCallPattern = new RegExp(`^\\s*(await\\s+)?(${promptTypePattern})\\s*\\([^)]*\\)\\s*$`, 'i')
    if (functionCallPattern.test(value)) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" matches function call pattern, not valid.`)
      return false
    }

    // Check for function calls with any variable name in parameters (quoted or not)
    const varInParamsPattern = new RegExp(`^\\s*(await\\s+)?\\w+\\s*\\(\\s*['"]?${variableName}['"]?\\s*[),]`, 'i')
    if (varInParamsPattern.test(value)) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" contains the variable name in parameters, not valid.`)
      return false
    }

    // Check for any function call-like pattern as a last resort
    if (/^\s*(await\s+)?\w+\s*\(/.test(value) && /\)\s*$/.test(value)) {
      logDebug(pluginJson, `BasePromptHandler.isValidSessionValue: Value "${value}" looks like a function call, not valid.`)
      return false
    }

    // If we get here, the value is valid
    return true
  }
}
