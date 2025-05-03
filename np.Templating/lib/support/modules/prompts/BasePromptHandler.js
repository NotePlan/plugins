// @flow
/**
 * @fileoverview Base class for prompt handlers that implements common functionality
 *               for parsing template tags, extracting parameters, and managing prompt-related utilities.
 */

import pluginJson from '../../../../plugin.json'
import { getRegisteredPromptNames, cleanVarName } from './PromptRegistry'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * Base class providing static utility methods for handling template prompts.
 * Includes functions for parsing tags, cleaning variable names, handling dates,
 * and validating session data related to prompts.
 */
export default class BasePromptHandler {
  /**
   * Cleans a variable name to ensure it's valid for use in contexts like JavaScript.
   * Removes disallowed characters (like '?'), replaces spaces with underscores,
   * ensures the name starts with a valid character (letter, _, $ or Unicode letter),
   * prefixes JavaScript reserved keywords, and defaults to 'unnamed' if empty or null.
   *
   * @param {string} varName - The variable name to clean.
   * @returns {string} The cleaned variable name.
   * @example
   * BasePromptHandler.cleanVarName("My Variable?") // "My_Variable"
   * BasePromptHandler.cleanVarName("123 Name")     // "var_123_Name"
   * BasePromptHandler.cleanVarName("class")        // "var_class"
   * BasePromptHandler.cleanVarName("")             // "unnamed"
   * BasePromptHandler.cleanVarName(null)           // "unnamed"
   * BasePromptHandler.cleanVarName("variable_1")   // "variable_1"
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
      // Add prefix for invalid starting characters
      cleaned = `var_${cleaned}`
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
   * Removes matching single, double, or backtick quotes from the beginning and end of a string.
   * Handles nested quotes recursively, removing outer layers until no matching outer quotes are found.
   * If the string doesn't start and end with the same quote type, it's returned unchanged.
   *
   * @param {string} content - The string potentially enclosed in quotes.
   * @returns {string} The content without the surrounding quotes.
   * @example
   * BasePromptHandler.removeQuotes('"Hello"')                // "Hello"
   * BasePromptHandler.removeQuotes("'World'")                // "World"
   * BasePromptHandler.removeQuotes(\`Backticks\`)            // "Backticks"
   * BasePromptHandler.removeQuotes('"\'Nested\'"')          // "'Nested'" (Removes outer double quotes)
   * BasePromptHandler.removeQuotes('"`Deeply nested`"')      // "`Deeply nested`" (Removes outer single quotes)
   * BasePromptHandler.removeQuotes('No quotes')              // "No quotes"
   * BasePromptHandler.removeQuotes('"Mismatched\'')         // "\"Mismatched\'"
   * BasePromptHandler.removeQuotes('')                     // ""
   */
  static removeQuotes(content: string): string {
    if (!content) return ''

    // Handle various quote types by checking first and last character
    if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'")) || (content.startsWith('`') && content.endsWith('`'))) {
      // Only remove one layer of quotes from the start and end.
      return content.substring(1, content.length - 1)
    }

    // If no matching outer quotes, return the original string.
    return content
  }

  /**
   * Get the current date formatted as YYYY-MM-DD.
   *
   * @returns {string} Current date string.
   * @example
   * // Assuming today is 2023-10-27
   * BasePromptHandler.getToday() // "2023-10-27"
   */
  static getToday(): string {
    return new Date().toISOString().substring(0, 10)
  }

  /**
   * Get yesterday's date formatted as YYYY-MM-DD.
   *
   * @returns {string} Yesterday's date string.
   * @example
   * // Assuming today is 2023-10-27
   * BasePromptHandler.getYesterday() // "2023-10-26"
   */
  static getYesterday(): string {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().substring(0, 10)
  }

  /**
   * Get tomorrow's date formatted as YYYY-MM-DD.
   *
   * @returns {string} Tomorrow's date string.
   * @example
   * // Assuming today is 2023-10-27
   * BasePromptHandler.getTomorrow() // "2023-10-28"
   */
  static getTomorrow(): string {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().substring(0, 10)
  }

  /**
   * Creates a regular expression pattern to identify and remove common template syntax
   * and registered prompt function calls from a string. This includes:
   * - `await` keyword followed by whitespace.
   * - Registered prompt function names (e.g., `ask`, `select`, etc.) followed by `(`.
   * - The generic `ask(` pattern.
   * - Parentheses `(` and `)`.
   * - Template tags like `<%`, `<%=`, `<%-`, `-%>`, `%>`.
   * Useful for isolating the parameters within a template tag.
   *
   * @returns {RegExp} A regex pattern for cleaning prompt tags.
   * @example
   * const pattern = BasePromptHandler.getPromptCleanupPattern();
   * // Assuming 'ask', 'select' are registered prompts:
   * // pattern might look like: /await\\s+|\\b(?:ask|select|promptKey|ask)\\s*\\(|[()]|<%[-=]?|-%>|%>/gi
   * "await ask('Question?')".replace(pattern, '') // " 'Question?'" (Note: leading space might remain depending on original spacing)
   * "<% select(opts) %>".replace(pattern, '')     // " opts "
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
   * Extracts variable assignment information from a template tag string.
   * Looks for patterns like `const myVar = await prompt(...)` or `let result = select(...)`
   * or simply `await prompt(...)`.
   *
   * @param {string} tag - The template tag content (cleaned of `<% %>`).
   * @returns {?{varName: string, cleanedTag: string}} An object containing the extracted
   *          `varName` (or empty string if only `await` is used) and the `cleanedTag`
   *          (the part after `=`, potentially with `await` removed), or `null` if no
   *          assignment pattern is matched.
   * @example
   * BasePromptHandler.extractVariableAssignment('const myVar = await ask("Question?")')
   * // Returns: { varName: "myVar", cleanedTag: "ask(\\"Question?\\")" }
   *
   * BasePromptHandler.extractVariableAssignment('let result = select(options)')
   * // Returns: { varName: "result", cleanedTag: "select(options)" }
   *
   * BasePromptHandler.extractVariableAssignment('await promptKey()')
   * // Returns: { varName: "", cleanedTag: "promptKey()" }
   *
   * BasePromptHandler.extractVariableAssignment('ask("No assignment")')
   * // Returns: null
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
   * Attempts a *direct* and *simple* extraction of parameters from the basic `promptType("message")` syntax.
   * It specifically looks for a prompt tag ending in `(...)` where the content inside the parentheses
   * is a single quoted string (using '', "", or ``). It does not handle multiple parameters,
   * unquoted parameters, or complex expressions. Use `parseParameters` for more robust parsing.
   *
   * @param {string} promptTag - The prompt tag string (e.g., `ask("Your name?")`).
   * @returns {?{ message: string }} An object with the extracted `message` (quotes removed)
   *         if the simple pattern is matched, otherwise `null`.
   * @example
   * BasePromptHandler.extractDirectParameters('ask("What is your name?")')
   * // Returns: { message: "What is your name?" }
   *
   * BasePromptHandler.extractDirectParameters("select('Option')")
   * // Returns: { message: "Option" }
   *
   * BasePromptHandler.extractDirectParameters('prompt(`Enter value`)')
   * // Returns: { message: "Enter value" }
   *
   * BasePromptHandler.extractDirectParameters('ask("Question", opts)') // Multiple params
   * // Returns: null
   *
   * BasePromptHandler.extractDirectParameters('ask(variable)') // Unquoted param
   * // Returns: null
   *
   * BasePromptHandler.extractDirectParameters('invalidSyntax(')
   * // Returns: null
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
   * Parses the 'options' parameter from a prompt tag's parameter string.
   * This function is designed to be called by `parseParameters` after placeholders
   * for quoted strings and array literals have been substituted back in.
   * It handles:
   * - Array literals like `['Opt 1', 'Opt 2']`, parsing them into a string array.
   * - Comma-separated strings, potentially with quotes, like `'Val 1', 'Val 2'`, combining them.
   * - Single string values (removing outer quotes if present).
   * - Complex object-like strings (passed through mostly as-is after quote removal).
   *
   * @param {string} optionsText - The text representing the options parameter (potentially with restored quotes/arrays).
   * @param {Array<string>} quotedTexts - The original quoted strings (used for logging/debugging, restored before calling this).
   * @param {Array<{placeholder: string, value: string}>} arrayPlaceholders - Original array literals (restored before calling this).
   * @returns {string | string[]} The parsed options, either as a single string or an array of strings.
   * @example
   * // Example assuming called from parseParameters context where placeholders exist
   * BasePromptHandler.parseOptions("__ARRAY_0__", ["'Opt A'", "'Opt B'"], [{ placeholder: '__ARRAY_0__', value: "['Opt A', 'Opt B']" }])
   * // Returns: ["Opt A", "Opt B"]
   *
   * BasePromptHandler.parseOptions("__QUOTED_TEXT_0__", ["'Default Value'"], [])
   * // Returns: "'Default Value'" (Note: returns string *with* quotes if it was a single quoted item)
   *
   * BasePromptHandler.parseOptions("__QUOTED_TEXT_0__, __QUOTED_TEXT_1__", ["'Choice 1'", "'Choice 2'"], [])
   * // Returns: "'Choice 1', 'Choice 2'" (Note: returns string with quotes, further parsing needed if individual values desired)
   *
   * BasePromptHandler.parseOptions("'Option, with comma'", [], []) // Assumes called directly, not from parseParameters
   * // Returns: "'Option, with comma'"
   */
  static parseOptions(optionsText: string, quotedTexts: Array<string>, arrayPlaceholders: Array<{ placeholder: string, value: string }>): string | string[] {
    // Restore placeholders first
    const processedText = BasePromptHandler._restorePlaceholders(optionsText, quotedTexts, arrayPlaceholders)

    // Check if it looks like an array literal *after* restoration
    if (processedText.startsWith('[') && processedText.endsWith(']')) {
      try {
        // Extract content and parse using the dedicated helper
        const arrayContent = processedText.substring(1, processedText.length - 1)
        return BasePromptHandler._parseArrayLiteralString(arrayContent, quotedTexts)
      } catch (e) {
        logError(pluginJson, `Error parsing array options: ${e.message}`)
        return [] // Return empty array on error
      }
    } else {
      // Handle non-array literal strings
      // Note: The specific logic for complex objects, single quoted strings with commas,
      // and general comma-separated strings might need adjustment depending on desired output.
      // The previous complex logic is simplified here. If comma separation is needed,
      // it implies the *original* template intended separate parameters, not a single string option.

      // For now, return the processed text. If it contained commas,
      // it might represent a single string intended to have commas, or multiple parameters
      // that parseParameters should have split differently.
      // Let removeQuotes handle the simple case of a single value that might be quoted.
      return BasePromptHandler.removeQuotes(processedText)
    }
  }

  /**
   * Parses the parameters string found inside the parentheses of a prompt function call.
   * It handles quoted strings and array literals by temporarily replacing them with placeholders,
   * splitting parameters by commas, and then restoring the original values.
   * Assigns parameters based on the `noVar` flag:
   * - If `noVar` is `true`, assumes parameters are `promptMessage, options, ...rest`.
   * - If `noVar` is `false` (default), assumes parameters are `varName, promptMessage, options, ...rest`.
   * Returns an object containing the parsed parameters.
   *
   * @param {string} tagValue - The cleaned tag value, including the prompt function name and parentheses (e.g., `ask('name', 'Enter name:')`).
   * @param {boolean} [noVar=false] - If true, assumes the first parameter is the prompt message, not the variable name.
   * @returns {Object} An object containing parsed parameters like `varName`, `promptMessage`, `options`.
   *                   If `noVar` is true, `varName` will be empty. Additional parameters beyond the first few
   *                   may be included as `param2`, `param3`, etc. when `noVar` is true.
   * @example
   * // Standard case (noVar = false)
   * BasePromptHandler.parseParameters("ask('userName', 'Enter your name:', 'Default')")
   * // Returns: { varName: "userName", promptMessage: "Enter your name:", options: "Default" }
   *
   * BasePromptHandler.parseParameters("select('choice', 'Pick one:', ['A', 'B'])")
   * // Returns: { varName: "choice", promptMessage: "Pick one:", options: ["A", "B"] }
   *
   * // No variable name case (noVar = true)
   * BasePromptHandler.parseParameters("prompt('Enter value:', ['Yes', 'No'], 'Extra')", true)
   * // Returns: { promptMessage: "Enter value:", options: ["Yes", "No"], varName: "", param2: "Extra" }
   *
   * BasePromptHandler.parseParameters("simplePrompt('Just a message')", true)
   * // Returns: { promptMessage: "Just a message", options: "", varName: "" }
   *
   * BasePromptHandler.parseParameters("ask('questionVar')") // Only varName provided
   * // Returns: { varName: "questionVar", promptMessage: "", options: "" }
   *
   * BasePromptHandler.parseParameters("ask()") // No parameters
   * // Returns: { varName: "unnamed", promptMessage: "", options: "" }
   */
  static parseParameters(tagValue: string, noVar: boolean = false): any {
    if (!tagValue || tagValue.trim() === '') {
      return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
    }

    logDebug(pluginJson, `BasePromptHandler parseParameters with tagValue: "${tagValue}", noVar: ${String(noVar)}`)

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
      let processedContent = paramsContent.replace(/(['"])(.*?)\1/g, (match, quote, content) => {
        quotedTexts.push(match)
        return `__QUOTED_TEXT_${quotedTexts.length - 1}__`
      })

      // Handle array placeholders by replacing them with special tokens
      const arrayPlaceholders: Array<{ placeholder: string, value: string }> = []
      const arrayRegex = /\[[^\]]*\]/g
      let arrayMatch
      let index = 0

      while ((arrayMatch = arrayRegex.exec(processedContent)) !== null) {
        if (arrayMatch && arrayMatch[0]) {
          const arrayValue = arrayMatch[0]
          const placeholder = `__ARRAY_${index}__`
          arrayPlaceholders.push({ placeholder, value: arrayValue })
          processedContent = processedContent.replace(arrayValue, placeholder)
          index++
        }
      }

      // Split the parameters by comma, ignoring commas in placeholders
      const params = processedContent.split(/\s*,\s*/)
      logDebug(pluginJson, `BasePromptHandler params split: ${JSON.stringify(params)}`)

      // Validate and assign parameters based on noVar flag
      if (noVar) {
        const promptMessage = params[0] ? BasePromptHandler.parseOptions(params[0], quotedTexts, arrayPlaceholders) : ''
        let options: string | Array<string> = ''

        if (params.length > 1) {
          // Check if the second parameter represents an array literal
          let firstOptionParam = params[1]
          // Restore placeholders specifically for the second parameter to check its structure
          quotedTexts.forEach((text, index) => {
            firstOptionParam = firstOptionParam.replace(`__QUOTED_TEXT_${index}__`, text)
          })
          arrayPlaceholders.forEach(({ placeholder, value }) => {
            firstOptionParam = firstOptionParam.replace(placeholder, value)
          })

          // Remove outer quotes *before* checking if it's an array literal
          const potentiallyUnquotedFirstOption = BasePromptHandler.removeQuotes(firstOptionParam)

          if (potentiallyUnquotedFirstOption.startsWith('[') && potentiallyUnquotedFirstOption.endsWith(']')) {
            // If the second param is an array string (after quote removal), parse it directly
            options = BasePromptHandler.parseOptions(params[1], quotedTexts, arrayPlaceholders)
            // Ensure it's converted to an array if parsing resulted in a string representation
            if (typeof options === 'string') {
              options = BasePromptHandler.convertToArrayIfNeeded(options)
            }
          } else {
            // If the second param is not an array, treat all subsequent params as individual options
            const collectedOptions = []
            for (let i = 1; i < params.length; i++) {
              const opt = BasePromptHandler.parseOptions(params[i], quotedTexts, arrayPlaceholders)
              // Ensure opt is a string before pushing; parseOptions can return array
              if (typeof opt === 'string') {
                collectedOptions.push(opt)
              } else if (Array.isArray(opt)) {
                // If parseOptions somehow returned an array here (shouldn't happen based on logic), flatten it
                collectedOptions.push(...opt)
              }
            }
            options = collectedOptions
          }
        }

        // Prepare the final result object without paramX fields
        const result: {
          promptMessage: any,
          options: any,
          varName: string,
        } = {
          promptMessage,
          options,
          varName: '',
        }

        return result
      } else {
        // First parameter is the variable name
        const varName = BasePromptHandler.cleanVarName(params[0] ? String(BasePromptHandler.parseOptions(params[0], quotedTexts, arrayPlaceholders)) : 'unnamed')
        const promptMessage = params.length > 1 ? BasePromptHandler.parseOptions(params[1], quotedTexts, arrayPlaceholders) : ''
        let options: string | Array<string> = params.length > 2 ? BasePromptHandler.parseOptions(params[2], quotedTexts, arrayPlaceholders) : ''

        // Convert string array representations to actual arrays
        if (typeof options === 'string' && options.startsWith('[') && options.endsWith(']')) {
          try {
            options = BasePromptHandler.convertToArrayIfNeeded(options)
          } catch (e) {
            logDebug(pluginJson, `Error parsing array options: ${e.message}, keeping as string`)
          }
        }

        return {
          varName,
          promptMessage,
          options,
        }
      }
    } catch (error) {
      logError(pluginJson, `Error in parseParameters: ${error.message}`)
      return { varName: noVar ? '' : 'unnamed', promptMessage: '', options: '' }
    }
  }

  /**
   * High-level function to parse a full template tag (potentially including `<% ... %>` and variable assignment)
   * and extract the relevant prompt parameters (`varName`, `promptMessage`, `options`).
   * It first cleans the tag, then checks for variable assignment (`const x = ...`).
   * Finally, it calls `parseParameters` or uses specific logic to determine the parameters
   * based on the structure (assignment vs. direct call) and the `noVar` flag.
   *
   * @param {string} tag - The raw template tag string (e.g., `<% const name = ask("Enter Name:") %>`).
   * @param {boolean} [noVar=false] - If true, signifies that the prompt call within the tag
   *                                does not inherently include a variable name as its first parameter
   *                                (e.g., used for prompts where the variable name is derived differently).
   * @returns {Object} An object containing the parsed parameters: `varName`, `promptMessage`, `options`.
   *                   `varName` might be cleaned using `cleanVarName`.
   *                   `options` can be a string or string array.
   * @example
   * BasePromptHandler.getPromptParameters('<% const name = ask("Enter Name:", "Default") %>')
   * // Returns: { varName: "name", promptMessage: "Enter Name:", options: "Default" }
   *
   * BasePromptHandler.getPromptParameters('<% await select("Choose:", ["A", "B"]) %>', true)
   * // Returns: { varName: "", promptMessage: "Choose:", options: ["A", "B"] }
   *
   * BasePromptHandler.getPromptParameters('<% simplePrompt() %>')
   * // Returns: { varName: "unnamed", promptMessage: "", options: "" }
   *
   * BasePromptHandler.getPromptParameters('<% let choice = customPrompt("msg", ["opt1"]) %>')
   * // Returns: { varName: "choice", promptMessage: "msg", options: ["opt1"] } // Assuming customPrompt structure matches
   *
   * BasePromptHandler.getPromptParameters('<% prompt("Just message") %>', true)
   * // Returns: { varName: "", promptMessage: "Just message", options: "" }
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
   * Extracts the prompt type (function name) from a template tag string.
   * It cleans the tag (removing `<% %>` etc.) and then checks if the beginning of
   * the cleaned tag matches any of the registered prompt names.
   *
   * @param {string} tag - The template tag string.
   * @returns {string} The identified prompt type name (e.g., "ask", "select") or an empty string if no match is found.
   * @example
   * // Assuming 'ask', 'select' are registered prompt types
   * BasePromptHandler.getPromptTypeFromTag('<% ask("Question?") %>') // "ask"
   * BasePromptHandler.getPromptTypeFromTag('const x = select(opts)') // "select"
   * BasePromptHandler.getPromptTypeFromTag('await customPrompt()') // "customPrompt" (if registered)
   * BasePromptHandler.getPromptTypeFromTag('<% unrelated code %>') // ""
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
   * Cleans a prompt tag by removing template syntax (`<% ... %>`) and the prompt
   * function call itself (e.g., `await ask(`), leaving the inner parameter string.
   * Uses `getPromptCleanupPattern` for the removal logic.
   *
   * @param {string} tag - The template tag to clean.
   * @returns {string} The cleaned tag content, typically the parameter list including parentheses,
   *                   or just the parameters if parentheses are also matched by the cleanup pattern.
   *                   The exact output depends on `getPromptCleanupPattern`. See its example.
   * @example
   * // Using the example pattern from getPromptCleanupPattern: /await\\s+|\\b(?:ask|select)\\s*\\(|[()]|<%[-=]?|-%>|%>/gi
   * BasePromptHandler.cleanPromptTag('<% await ask("Question?", opts) %>')
   * // Result: " \"Question?\", opts " (Note: leading/trailing spaces depend on original and pattern)
   * // The pattern removes: '<% ', 'await ', 'ask(', ')', ' %>'
   *
   * BasePromptHandler.cleanPromptTag(' select(options)')
   * // Result: " options"
   * // The pattern removes: ' select(', ')'
   */
  static cleanPromptTag(tag: string): string {
    // Clean up template syntax if present
    const cleanedTag = tag.replace(/<%[-=]?\s*|\s*-?\s*%>/g, '').trim()

    // Use the dynamic pattern to remove prompt function names and other syntax
    return cleanedTag.replace(BasePromptHandler.getPromptCleanupPattern(), '').trim()
  }

  /**
   * Extracts all top-level quoted strings (single or double) from a given text.
   * It respects escaped quotes (`\'` or `\"`) within the strings.
   * Returns an array containing the *content* of the quoted strings (quotes removed).
   * If no quoted strings are found but the text is non-empty, the entire trimmed text
   * is returned as a single-element array.
   *
   * @param {string} text - The text to extract quoted strings from.
   * @returns {Array<string>} An array of the extracted string contents (without surrounding quotes).
   * @example
   * BasePromptHandler.extractQuotedStrings("'Param 1', \"Param 2\", Unquoted Text")
   * // Returns: ["Param 1", "Param 2"]
   *
   * BasePromptHandler.extractQuotedStrings("'String with \\'escaped\\' quote'")
   * // Returns: ["String with 'escaped' quote"]
   *
   * BasePromptHandler.extractQuotedStrings("No quotes here")
   * // Returns: ["No quotes here"]
   *
   * BasePromptHandler.extractQuotedStrings(" 'First' then 'Second' ")
   * // Returns: ["First", "Second"]
   *
   * BasePromptHandler.extractQuotedStrings("")
   * // Returns: []
   *
   * BasePromptHandler.extractQuotedStrings("`Backticks not handled`") // Only handles ' and "
   * // Returns: ["`Backticks not handled`"]
   */
  static extractQuotedStrings(text: string): Array<string> {
    const parameters = []
    const regex = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g // Matches '...' or "..."

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
   * Converts a string that looks like an array literal (e.g., "['a', 'b', 'c']")
   * into an actual JavaScript array of strings.
   * It handles single or double quotes around elements within the array string
   * and removes them. If the input string does not start and end with square brackets `[]`,
   * or if it's not a string, it's returned unchanged. Handles empty array "[]".
   *
   * @param {string | any} arrayString - The potential string representation of an array.
   * @returns {Array<string> | string | any} An array of strings if conversion is successful,
   *          otherwise the original input value.
   * @example
   * BasePromptHandler.convertToArrayIfNeeded("['a', 'b', \"c\"]") // ["a", "b", "c"]
   * BasePromptHandler.convertToArrayIfNeeded("[]")                 // []
   * BasePromptHandler.convertToArrayIfNeeded("['Single Item']")   // ["Single Item"]
   * BasePromptHandler.convertToArrayIfNeeded("  [ ' Spaced ' ]  ") // [" Spaced "]
   * BasePromptHandler.convertToArrayIfNeeded("Not an array")       // "Not an array"
   * BasePromptHandler.convertToArrayIfNeeded(123)                // 123
   * BasePromptHandler.convertToArrayIfNeeded(["Already", "Array"])// ["Already", "Array"]
   * BasePromptHandler.convertToArrayIfNeeded("['Item 1', 'Item 2',]") // ["Item 1", "Item 2"] (Handles trailing comma)
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
   * Checks if a value retrieved (typically from session data) represents a valid *result*
   * of a prompt, rather than the prompt call itself (which indicates the prompt was skipped or not run).
   * It returns `false` if the value looks like a function call (e.g., "ask()", "await select('msg')",
   * "prompt(varName)"). It checks against registered prompt types and common patterns.
   * Non-string values (like arrays from multi-select) are considered valid. Empty strings are valid.
   *
   * @param {any} value - The value to check (string, array, etc.).
   * @param {string} promptType - The expected type of prompt (e.g., "ask", "select") associated with this value.
   * @param {string} variableName - The variable name associated with the prompt value.
   * @returns {boolean} `true` if the value is considered a valid result, `false` if it looks like a prompt function call text.
   * @example
   * // Assume 'ask', 'select' are registered prompts
   * BasePromptHandler.isValidSessionValue("User's answer", "ask", "userName")    // true
   * BasePromptHandler.isValidSessionValue(["Option A", "Option C"], "select", "choices") // true
   * BasePromptHandler.isValidSessionValue("", "ask", "optionalInput")           // true (Empty string is valid)
   *
   * BasePromptHandler.isValidSessionValue("ask()", "ask", "userName")             // false
   * BasePromptHandler.isValidSessionValue("await select()", "select", "choices")  // false
   * BasePromptHandler.isValidSessionValue("select('Choose:')", "select", "choices") // false
   * BasePromptHandler.isValidSessionValue("ask(userName)", "ask", "userName")     // false
   * BasePromptHandler.isValidSessionValue("  await ask ('Question')  ", "ask", "qVar") // false
   * BasePromptHandler.isValidSessionValue("otherFunc()", "ask", "userName")      // true (Doesn't match registered prompt patterns)
   * BasePromptHandler.isValidSessionValue("prompt('Message')", "prompt", "data") // false (Assuming 'prompt' is registered)
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

  // --- Private Helper Functions for Parsing ---

  /**
   * (Internal) Restores placeholders for quoted text and array literals.
   * @param {string} text - The text containing placeholders.
   * @param {Array<string>} quotedTexts - Array of original quoted strings.
   * @param {Array<{placeholder: string, value: string}>} arrayPlaceholders - Array of original array literals.
   * @returns {string} Text with placeholders restored.
   * @private
   */
  static _restorePlaceholders(text: string, quotedTexts: Array<string>, arrayPlaceholders: Array<{ placeholder: string, value: string }>): string {
    let restoredText = text
    // Restore arrays first to avoid conflicts if quoted text looks like an array placeholder
    arrayPlaceholders.forEach(({ placeholder, value }) => {
      restoredText = restoredText.replace(placeholder, value)
    })
    // Then restore quoted texts
    quotedTexts.forEach((qText, index) => {
      restoredText = restoredText.replace(`__QUOTED_TEXT_${index}__`, qText)
    })
    return restoredText
  }

  /**
   * (Internal) Parses the content string of an array literal.
   * Assumes input is the string *inside* the brackets (e.g., "'a', 'b', 'c'").
   * Handles nested placeholders within items.
   * @param {string} arrayContentString - The string content of the array.
   * @param {Array<string>} quotedTexts - Original quotedTexts array (needed for nested restoration).
   * @returns {Array<string>} Parsed array of strings.
   * @private
   */
  static _parseArrayLiteralString(arrayContentString: string, quotedTexts: Array<string>): Array<string> {
    if (arrayContentString.trim() === '') {
      return []
    }
    return arrayContentString
      .split(',') // Split by comma
      .map((item) => {
        // Trim, restore nested quoted text placeholders, then remove outer quotes
        let processedItem = item.trim()
        quotedTexts.forEach((qText, index) => {
          processedItem = processedItem.replace(`__QUOTED_TEXT_${index}__`, qText)
        })
        return BasePromptHandler.removeQuotes(processedItem)
      })
      .filter(Boolean) // Remove any empty items resulting from trailing commas etc.
  }

  /**
   * (Internal) Parses a comma-separated string, respecting quotes.
   * Splits the string by commas, removes outer quotes from each part, and joins back.
   * @param {string} optionsString - The comma-separated string.
   * @returns {string} The processed string.
   * @private
   */
  static _parseCommaSeparatedString(optionsString: string): string {
    return optionsString
      .split(/,(?=(?:[^"']*(?:"[^"]*"|'[^']*'))*[^"']*$)/) // Updated regex to handle both " and '
      .map((part) => BasePromptHandler.removeQuotes(part.trim()))
      .join(', ')
  }
}
