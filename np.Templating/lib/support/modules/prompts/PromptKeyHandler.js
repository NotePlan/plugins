// @flow
/**
 * @fileoverview Handler for promptKey functionality.
 */

import pluginJson from '../../../../plugin.json'
import BasePromptHandler from './BasePromptHandler'
import { registerPromptType } from './PromptRegistry'
import { parseStringOrRegex } from './sharedPromptFunctions'
import { log, logError, logDebug } from '@helpers/dev'
import { getValuesForFrontmatterTag } from '@helpers/NPFrontMatter'
import { chooseOptionWithModifiers } from '@helpers/userInput'

/**
 * Handler for promptKey functionality.
 */
export default class PromptKeyHandler {
  /**
   * Safely handle the result of CommandBar.textPrompt
   * @param {any} result - The result from CommandBar.textPrompt
   * @returns {string} A safe string value
   */
  static safeTextPromptResult(result: any): string {
    if (result === false || result == null) return ''
    if (typeof result === 'string') return result
    if (typeof result === 'number') return result.toString()
    if (typeof result === 'boolean') return result ? 'true' : 'false'
    return ''
  }

  /**
   * Splits a parameter string into an array, handling quoted strings and commas inside quotes.
   * @param {string} paramString
   * @returns {string[]}
   */
  static splitParams(paramString: string): string[] {
    const result = []
    let current = ''
    let inSingle = false
    let inDouble = false
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i]
      if (char === "'" && !inDouble) {
        inSingle = !inSingle
        current += char
      } else if (char === '"' && !inSingle) {
        inDouble = !inDouble
        current += char
      } else if (char === ',' && !inSingle && !inDouble) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    if (current) result.push(current.trim())
    return result
  }

  /**
   * Parse parameters from a promptKey tag.
   * @param {string} tag - The template tag containing the promptKey call.
   * @returns {Object} The parsed parameters for promptKey.
   */
  static parsePromptKeyParameters(tag: string = ''): {
    varName: string,
    tagKey: string,
    promptMessage: string,
    noteType: 'Notes' | 'Calendar' | 'All',
    caseSensitive: boolean,
    folderString: string,
    fullPathMatch: boolean,
  } {
    logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters starting with tag: "${tag}"`)

    // First extract the raw params string, handling regex patterns specially
    let paramsString = ''
    if (tag.includes('/') && tag.indexOf('/') < tag.indexOf(')')) {
      // If we have a regex pattern, extract everything between promptKey( and the last )
      const startIndex = tag.indexOf('promptKey(') + 'promptKey('.length
      const endIndex = tag.lastIndexOf(')')
      if (startIndex !== -1 && endIndex !== -1) {
        paramsString = tag.slice(startIndex, endIndex)
      }
    } else {
      // For non-regex patterns, use the original regex
      const paramsMatch = tag.match(/promptKey\(([^)]+)\)/)
      paramsString = paramsMatch ? paramsMatch[1] : ''
    }
    logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: tag="${tag}" paramsString=${paramsString}`)

    // Check if there are recursive promptKey patterns like "promptKey(promptKey(...))"
    const recursiveMatch = paramsString.match(/promptKey\(([^)]+)\)/)
    if (recursiveMatch) {
      logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: Detected recursive promptKey pattern. This needs to be fixed.`)
      // Try to extract the innermost parameter
      const innerParam = recursiveMatch[1]
      logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: Extracted inner parameter: "${innerParam}"`)
      // Force quotes around it to treat it as a string literal
      const fixedParam = innerParam.startsWith('"') || innerParam.startsWith("'") ? innerParam : `"${innerParam}"`
      logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: Using fixed parameter: "${fixedParam}"`)
      return PromptKeyHandler.parsePromptKeyParameters(`promptKey(${fixedParam})`)
    }

    // Helper to remove quotes
    function stripQuotes(s: string): string {
      if (!s) return ''
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1)
      }
      return s
    }

    // Parse all parameters first
    const params = PromptKeyHandler.splitParams(paramsString).map(stripQuotes)
    logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: params=${JSON.stringify(params)}`)

    // Special handling for regex patterns
    let tagKey = params[0] || ''
    if (tagKey.startsWith('/') && tagKey.includes('/')) {
      // If it's a regex pattern, keep it as is without any additional processing
      logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: Detected regex pattern, keeping as is: ${tagKey}`)
    } else {
      // For non-regex patterns, use parseStringOrRegex
      tagKey = parseStringOrRegex(tagKey)
    }
    logDebug(pluginJson, `PromptKeyHandler.parsePromptKeyParameters: tagKey after processing: ${JSON.stringify(tagKey)}`)

    // Set varName
    const varName = ''

    // Adjust remaining parameters to their correct positions
    const promptMessage = params[1] || ''
    const rawNoteType = params[2] || 'All'
    // Make sure noteType is one of the allowed values
    const noteType: 'Notes' | 'Calendar' | 'All' = rawNoteType === 'Notes' ? 'Notes' : rawNoteType === 'Calendar' ? 'Calendar' : 'All'
    const caseSensitive = params[3] === 'true' || false
    const folderString = params[4] || ''
    const fullPathMatch = params[5] === 'true' || false

    logDebug(
      pluginJson,
      `PromptKeyHandler.parsePromptKeyParameters: extracted varName="${varName}" tagKey="${tagKey}" promptMessage="${promptMessage}" noteType="${noteType}" caseSensitive=${String(
        caseSensitive,
      )} folderString="${folderString}" fullPathMatch=${String(fullPathMatch)}`,
    )

    return {
      varName,
      tagKey,
      promptMessage,
      noteType,
      caseSensitive,
      folderString,
      fullPathMatch,
    }
  }

  /**
   * Prompt the user to select a key value.
   * @param {string} tag - The key to search for.
   * @param {string} message - The prompt message to display.
   * @param {'Notes' | 'Calendar' | 'All'} noteType - The type of notes to search.
   * @param {boolean} caseSensitive - Whether to perform case sensitive search.
   * @param {string} folderString - Folder to limit search to.
   * @param {boolean} fullPathMatch - Whether to match full path.
   * @returns {Promise<string>} The selected key value.
   */
  static async promptKey(
    tag: string,
    message: string,
    noteType: 'Notes' | 'Calendar' | 'All' = 'All',
    caseSensitive: boolean = false,
    folderString?: string,
    fullPathMatch: boolean = false,
  ): Promise<string | false> {
    logDebug(
      pluginJson,
      `PromptKeyHandler.promptKey: starting tag="${tag}" message="${message}" noteType="${noteType}" caseSensitive="${String(caseSensitive)}" folderString="${String(
        folderString,
      )}" fullPathMatch="${String(fullPathMatch)}"`,
    )

    try {
      // If no tag provided, first prompt for a key
      const tagToUse = tag // Use a mutable variable
      let valuesList: Array<string> | null = null
      if (!tagToUse) {
        logDebug(pluginJson, 'PromptKeyHandler.promptKey: No tag provided, will prompt user to select one')

        // Get the key from user by prompting them to select from available frontmatter keys
        valuesList = await getValuesForFrontmatterTag('', noteType, caseSensitive, folderString, fullPathMatch)
        logDebug(pluginJson, `PromptKeyHandler.promptKey: valuesForChosenTag=${JSON.stringify(valuesList)}`)

        if (!valuesList || valuesList.length === 0) {
          logDebug(pluginJson, 'PromptKeyHandler.promptKey: No key was selected')
          const result = await CommandBar.textPrompt('No existing values found. Enter a value:', message || 'Enter a value:', '')
          return result === false ? false : this.safeTextPromptResult(result)
        }
      }

      // Now get all values for the tag/key
      const tags = valuesList || (await getValuesForFrontmatterTag(tagToUse, noteType, caseSensitive, folderString, fullPathMatch))
      logDebug(pluginJson, `PromptKeyHandler.promptKey after getValuesForFrontmatterTag for tag="${tagToUse}": found ${tags.length} values`)

      // If tagToUse looks like a regex pattern (starts with / and contains another /), use it to filter the results
      let filteredTags = tags
      if (tagToUse.startsWith('/')) {
        try {
          // Find the last / in the string to handle flags
          const lastSlashIndex = tagToUse.lastIndexOf('/')
          if (lastSlashIndex > 0) {
            const regexPattern = tagToUse.slice(1, lastSlashIndex)
            const flags = tagToUse.slice(lastSlashIndex + 1)
            const regex = new RegExp(regexPattern, flags)
            filteredTags = tags.filter((tag) => regex.test(tag))
            logDebug(pluginJson, `PromptKeyHandler.promptKey: Applied regex pattern "${regexPattern}" with flags "${flags}", filtered to ${filteredTags.length} values`)
          }
        } catch (error) {
          logError(pluginJson, `Invalid regex pattern in tagKey: ${error.message}`)
          // If regex is invalid, use all tags
          filteredTags = tags
        }
      }

      if (filteredTags.length > 0) {
        logDebug(pluginJson, `PromptKeyHandler.promptKey: ${filteredTags.length} values found for key "${tagToUse}"; Will ask user to select one`)
        const promptMessage = message || `Choose a value for "${tagToUse}"`

        try {
          // Prepare options for selection
          const optionsArray = filteredTags.map((item) => ({ label: item, value: item }))

          // $FlowFixMe: Flow doesn't understand chooseOptionWithModifiers return type
          const response = await chooseOptionWithModifiers(promptMessage, optionsArray, true)

          // Handle cancelled prompt
          if (!response) {
            logDebug(pluginJson, `PromptKeyHandler.promptKey: Prompt cancelled, returning empty string`)
            return false
          }

          // $FlowFixMe: Flow doesn't understand the response object structure
          if (typeof response === 'object' && response.value) {
            // $FlowFixMe: We know response.value exists
            const chosenTag = String(response.value)
            logDebug(pluginJson, `PromptKeyHandler.promptKey: Returning selected tag="${chosenTag}"`)
            return chosenTag
          }

          logDebug(pluginJson, `PromptKeyHandler.promptKey: No valid response, returning empty string`)
          return ''
        } catch (error) {
          logError(pluginJson, `Error in chooseOptionWithModifiers: ${error.message}`)
          return ''
        }
      } else {
        logDebug(
          pluginJson,
          `PromptKeyHandler.promptKey: No values found for tag="${tagToUse}" message="${message}" noteType="${noteType}" caseSensitive="${String(
            caseSensitive,
          )}" folderString="${String(folderString)}" fullPathMatch="${String(fullPathMatch)} `,
        )
        const result = await CommandBar.textPrompt('', message || `No values found for "${tagToUse}". Enter a value:`, '')
        logDebug(pluginJson, `PromptKeyHandler.promptKey: Returning prompt hand-entered result="${String(result)}"`)
        return result === false ? false : this.safeTextPromptResult(result)
      }
    } catch (error) {
      logError(pluginJson, `Error in promptKey: ${error.message}`)
      return ''
    }
  }

  /**
   * Process the promptKey prompt.
   * @param {string} tag - The template tag.
   * @param {any} sessionData - The current session data.
   * @param {Object} params - The parameters from parseParameters.
   * @returns {Promise<string|false>} The processed prompt result, or false if cancelled.
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string | false> {
    const { varName, tagKey, promptMessage, noteType, caseSensitive, folderString, fullPathMatch } = params

    logDebug(pluginJson, `PromptKeyHandler.process: Starting with tagKey="${tagKey}", promptMessage="${promptMessage}"`)

    // For promptKey, use tagKey as the variable name for storing in session data
    const sessionVarName = tagKey.replace(/ /gi, '_').replace(/\?/gi, '')

    // Use the common method to check if the value in session data is valid
    if (sessionData[sessionVarName] && BasePromptHandler.isValidSessionValue(sessionData[sessionVarName], 'promptKey', sessionVarName)) {
      // Value already exists in session data and is not a function call representation
      logDebug(pluginJson, `PromptKeyHandler.process: Using existing value from session data: ${sessionData[sessionVarName]}`)
      return sessionData[sessionVarName]
    }

    try {
      logDebug(pluginJson, `PromptKeyHandler.process: Executing promptKey with tag="${tagKey}"`)
      const response = await PromptKeyHandler.promptKey(tagKey, promptMessage, noteType, caseSensitive, folderString, fullPathMatch)

      logDebug(pluginJson, `PromptKeyHandler.process: Got response: ${String(response)}`)

      // Store response with appropriate variable name
      sessionData[sessionVarName] = response
      return response
    } catch (error) {
      logError(pluginJson, `Error processing promptKey: ${error.message}`)
      return ''
    }
  }
}
// Register the promptKey type
registerPromptType({
  name: 'promptKey',
  parseParameters: (tag: string) => PromptKeyHandler.parsePromptKeyParameters(tag),
  process: PromptKeyHandler.process.bind(PromptKeyHandler),
})
