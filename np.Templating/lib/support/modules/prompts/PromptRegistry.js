// @flow
/**
 * @fileoverview Provides a registry for prompt types so that new prompt types
 * can be added without modifying the core NPTemplating code.
 */

import pluginJson from '../../../../plugin.json'
import { log, logError, logDebug } from '@helpers/dev'

/**
 * @typedef {Object} PromptType
 * @property {string} name - The unique name of the prompt type.
 * @property {?RegExp} pattern - Optional regex to match tags for this prompt type. If not provided, will be generated from name.
 * @property {(tag: string) => any} parseParameters - A function that extracts parameters from the tag.
 * @property {(tag: string, sessionData: any, params: any) => Promise<string>} process - A function that processes the prompt and returns its response.
 */
export type PromptType = {|
  name: string,
  pattern?: RegExp,
  parseParameters: (tag: string) => any,
  process: (tag: string, sessionData: any, params: any) => Promise<string>,
|}

/** The registry mapping prompt type names to their handlers. */
const promptRegistry: { [string]: PromptType } = {}

/**
 * Cleans a variable name by replacing spaces with underscores and removing invalid characters.
 * This is a local copy of the function to avoid circular dependencies.
 * @param {string} varName - The variable name to clean.
 * @returns {string} The cleaned variable name.
 */
export function cleanVarName(varName: string): string {
  if (!varName || typeof varName !== 'string') return 'unnamed'

  // Remove any quotes (single, double, backticks) that might have been included
  let cleaned = varName.replace(/["'`]/g, '')

  // Remove any prompt type prefixes
  const promptTypes = getRegisteredPromptNames()
  const promptTypePattern = new RegExp(`^(${promptTypes.join('|')})`, 'i')
  cleaned = cleaned.replace(promptTypePattern, '')

  // Replace spaces with underscores
  cleaned = cleaned.replace(/ /gi, '_')

  // Remove question marks
  cleaned = cleaned.replace(/\?/gi, '')

  // Remove any characters that aren't valid in JavaScript identifiers
  // Keep alphanumeric characters, underscores, dollar signs, and Unicode letters
  cleaned = cleaned.replace(/[^\p{L}\p{Nd}_$]/gu, '')

  // Ensure the variable name starts with a letter, underscore, or dollar sign
  if (!/^[\p{L}_$]/u.test(cleaned)) {
    cleaned = `var_${cleaned}`
  }

  // Handle the case where we might end up with an empty string
  if (!cleaned) return 'unnamed'

  // Ensure we don't accidentally use a JavaScript reserved word
  const reservedWords = [
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'export',
    'extends',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
  ]

  if (reservedWords.includes(cleaned)) {
    cleaned = `var_${cleaned}`
  }

  return cleaned
}

/**
 * Generates a RegExp pattern for a prompt type based on its name
 * @param {string} promptName - The name of the prompt type
 * @returns {RegExp} The pattern to match this prompt type
 */
function generatePromptPattern(promptName: string): RegExp {
  // Create a pattern that only matches the exact prompt name followed by parentheses
  // Using word boundary to ensure we don't match substrings of other prompt names
  return new RegExp(`\\b${promptName}\\s*\\(`, 'i')
}

/**
 * Registers a new prompt type.
 * @param {PromptType} promptType The prompt type to register.
 */
export function registerPromptType(promptType: PromptType): void {
  logDebug(pluginJson, `Registering prompt type: ${promptType.name}`)
  // If no pattern is provided, generate one from the name
  if (!promptType.pattern) {
    promptType.pattern = generatePromptPattern(promptType.name)
  }
  promptRegistry[promptType.name] = promptType
}

/**
 * Find a matching prompt type for a given tag content
 * @param {string} tagContent - The content of the tag to match
 * @returns {?{promptType: Object, name: string}} The matching prompt type and its name, or null if none found
 */
function findMatchingPromptType(tagContent: string): ?{ promptType: Object, name: string } {
  for (const [name, promptType] of Object.entries(promptRegistry)) {
    const pattern = promptType.pattern || generatePromptPattern(promptType.name)
    if (pattern.test(tagContent)) {
      return { promptType, name }
    }
  }
  return null
}

/**
 * Processes a single prompt tag using the registered prompt types.
 * @param {string} tag The template tag to process.
 * @param {any} sessionData The current session data.
 * @returns {Promise<?{response: string, promptType: string, params: any}>} The prompt response and associated info, or null if none matched.
 */
export async function processPromptTag(tag: string, sessionData: any, tagStart: string, tagEnd: string): Promise<string> {
  if (tag.startsWith(`${tagStart}-`) || tag.startsWith(`${tagStart}=`)) {
    // Extract the content between tagStart and tagEnd
    const content = tag.substring(tagStart.length + 1, tag.length - tagEnd.length).trim()

    // Check if this is an awaited operation
    const isAwaited = content.startsWith('await ')
    const processContent = isAwaited ? content.substring(6).trim() : content

    // Handle simple variable references like <%- varName %>
    const varRefMatch = /^\s*([a-zA-Z0-9_$]+)\s*$/.exec(processContent)
    if (varRefMatch && varRefMatch[1] && sessionData.hasOwnProperty(varRefMatch[1])) {
      // This is a reference to an existing variable, just return the original tag
      return tag
    }

    // Find the matching prompt type
    const promptTypeInfo = findMatchingPromptType(processContent)

    if (promptTypeInfo && promptTypeInfo.promptType) {
      const { promptType, name } = promptTypeInfo
      logDebug(pluginJson, `Found matching prompt type for tag: ${name}`)

      try {
        // Parse the parameters
        const params = promptType.parseParameters(processContent)
        logDebug(pluginJson, `Parsed prompt parameters: ${JSON.stringify(params)}`)

        // Log the tag being processed
        logDebug(pluginJson, `Processing tag: ${tag.substring(0, 30)}...`)

        // Process the prompt
        const response = await promptType.process(tag, sessionData, params)

        // Store the response in sessionData if a variable name is provided
        if (params.varName) {
          // Store both the original and cleaned variable names
          const cleanedVarName = cleanVarName(params.varName)
          sessionData[params.varName] = response
          sessionData[cleanedVarName] = response

          // Return the variable reference for the template using the cleaned name
          return `${tagStart}- ${cleanedVarName} ${tagEnd}`
        }

        // If no variable name, return the response directly
        return response
      } catch (error) {
        logError(pluginJson, `Error processing prompt type ${name}: ${error.message}`)
        // Replace the problematic tag with an error comment
        return `<!-- Error processing prompt: ${error.message} -->`
      }
    }
  }

  // Return the original tag if no processing occurred
  return tag
}

/**
 * Processes all prompt tags in the given template.
 * @param {string} templateData The template content.
 * @param {any} initialSessionData The initial session data object.
 * @param {string} tagStart The start tag marker (default: '<%')
 * @param {string} tagEnd The end tag marker (default: '%>')
 * @param {() => Promise<Array<string>>} getTagsFn Function to extract tags from the template.
 * @returns {Promise<{sessionTemplateData: string, sessionData: any}>} The updated template and session data.
 */
export async function processPrompts(
  templateData: string,
  initialSessionData: any = {},
  tagStart: string,
  tagEnd: string,
  getTags: Function,
): Promise<{ sessionTemplateData: string, sessionData: any }> {
  let sessionTemplateData = templateData
  const sessionData = initialSessionData && typeof initialSessionData === 'object' ? initialSessionData : {}

  try {
    const tags = await getTags(templateData, tagStart, tagEnd)

    // Ensure tags is an array
    const tagsArray = Array.isArray(tags) ? tags : tags && typeof tags.then === 'function' ? await tags : []

    for (const tag of tagsArray) {
      try {
        const processedTag = await processPromptTag(tag, sessionData, tagStart, tagEnd)
        sessionTemplateData = sessionTemplateData.replace(tag, processedTag)
      } catch (error) {
        logError(pluginJson, `Error processing prompt tag: ${error.message}`)
        // Replace the problematic tag with an error comment
        const errorComment = `<!-- Error processing prompt: ${error.message} -->`
        sessionTemplateData = sessionTemplateData.replace(tag, errorComment)
      }
    }
  } catch (error) {
    logError(pluginJson, `Error processing prompts: ${error.message}`)
  }

  return { sessionTemplateData, sessionData }
}

/**
 * Get all registered prompt type names
 * @returns {Array<string>} Array of registered prompt type names
 */
export function getRegisteredPromptNames(): Array<string> {
  // Make sure the normal prompt is replaced last since prompt is part of promptInterval etc.
  const promptNames = Object.keys(promptRegistry)
    .filter((name) => name !== 'prompt')
    .concat('prompt')
  return promptNames
}
