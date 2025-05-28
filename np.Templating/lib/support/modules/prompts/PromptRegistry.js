// @flow
/**
 * @fileoverview Provides a registry for prompt types so that new prompt types
 * can be added without modifying the core NPTemplating code.
 */

import pluginJson from '../../../../plugin.json'
import { getTags } from '../../../core/tagUtils'
import { log, logError, logDebug } from '@helpers/dev'
import { escapeRegExp } from '@helpers/regex'

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
export function findMatchingPromptType(tagContent: string): ?{ promptType: Object, name: string } {
  for (const [name, promptType] of Object.entries(promptRegistry)) {
    const pattern = promptType.pattern || generatePromptPattern(promptType.name)

    if (pattern.test(tagContent)) {
      return { promptType, name }
    }
  }

  return null
}

/**
 * Extract content from a template tag based on its type
 * @param {string} tag - The full tag string
 * @returns {{content: string, isOutputTag: boolean, isExecutionTag: boolean}} Parsed tag info
 */
function parseTagContent(tag: string): { content: string, isOutputTag: boolean, isExecutionTag: boolean } {
  let content = ''
  let isOutputTag = false
  let isExecutionTag = false

  if (tag.startsWith('<%- ')) {
    // Extract the content between <%- and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(3, tag.length - endOffset).trim()
    isOutputTag = true
  } else if (tag.startsWith('<%=')) {
    // Extract the content between <%= and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(3, tag.length - endOffset).trim()
    isOutputTag = true
  } else if (tag.startsWith('<%')) {
    // Extract the content between <% and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(2, tag.length - endOffset).trim()
    isExecutionTag = true
  }

  return { content, isOutputTag, isExecutionTag }
}

/**
 * Handle session value replacement for unquoted parameters in prompt calls
 * @param {string} promptCall - The prompt call string
 * @param {any} sessionData - The session data
 * @returns {?string} The fixed prompt call or null if no replacement needed
 */
function replaceSessionVariables(promptCall: string, sessionData: any): ?string {
  // Check if the parameter might be referencing a variable
  const paramMatch = promptCall.match(/\w+\((\w+)(?!\s*["'])\)/)
  if (!paramMatch) return null

  const unquotedParam = paramMatch[1]
  logDebug(pluginJson, `Found unquoted parameter: "${unquotedParam}". Session data keys: ${Object.keys(sessionData).join(', ')}`)

  // Check if this parameter exists in session data
  if (!sessionData[unquotedParam]) return null

  logDebug(pluginJson, `Unquoted parameter "${unquotedParam}" found in session data with value: ${sessionData[unquotedParam]}`)

  // Replace the unquoted parameter with the value from session data, properly quoted
  const sessionValue = sessionData[unquotedParam]
  const quotedValue = typeof sessionValue === 'string' ? `"${sessionValue.replace(/"/g, '\\"')}"` : String(sessionValue)

  // Replace the unquoted parameter with the quoted session value
  const fixedPromptCall = promptCall.replace(new RegExp(`(\\w+\\()${unquotedParam}(\\))`, 'g'), `$1${quotedValue}$2`)
  logDebug(pluginJson, `Replaced unquoted parameter with session value: "${fixedPromptCall}"`)

  return fixedPromptCall
}

/**
 * Attempt to fix a prompt response that appears to be a string representation of a function call
 * @param {string} response - The response to fix
 * @param {string} promptTypeName - The name of the prompt type
 * @param {Object} promptType - The prompt type handler
 * @param {string} varName - The variable name for assignment
 * @param {any} sessionData - The session data
 * @returns {Promise<string|false>} The fixed response or false if cancelled
 */
async function fixStringifiedResponse(response: string, promptTypeName: string, promptType: Object, varName: string, sessionData: any): Promise<string | false> {
  logDebug(pluginJson, `Response appears to be a string representation of the function call: "${response}". Attempting to fix...`)

  try {
    // Extract the parameter from the response
    const paramMatch = response.match(/^\w+\(([^)]+)\)$/)
    const param = paramMatch ? paramMatch[1] : ''
    logDebug(pluginJson, `Extracted parameter: "${param}"`)

    // Create a fixed prompt call that includes quotes around the parameter
    const cleanedParam = param.replace(/"/g, '\\"')
    const fixedPromptCall = `${promptTypeName}("${cleanedParam}")`
    logDebug(pluginJson, `Fixed prompt call: ${fixedPromptCall}`)

    const fixedTag = `<%- ${fixedPromptCall} %>`
    const fixedParams = promptType.parseParameters(fixedTag)
    fixedParams.varName = varName

    const fixedResponse = await promptType.process(fixedTag, sessionData, fixedParams)
    logDebug(pluginJson, `Fixed response: "${fixedResponse}"`)
    return fixedResponse
  } catch (fixError) {
    logError(pluginJson, `Error fixing prompt: ${fixError.message}`)
    return response // Return original response if fix fails
  }
}

/**
 * Processes a variable assignment with a prompt (e.g., const myVar = promptKey("category"))
 * @param {string} varType - The variable declaration type (const, let, var)
 * @param {string} varName - The variable name
 * @param {string} promptCall - The prompt function call
 * @param {any} sessionData - The session data
 * @returns {Promise<string|false>} Empty string for successful assignment, false if cancelled
 */
async function processVariableAssignment(tag: string, varType: string, varName: string, promptCall: string, sessionData: any): Promise<string | false> {
  logDebug(pluginJson, `Found variable assignment: type=${varType}, varName=${varName}, promptCall=${promptCall}`)

  // Find the matching prompt type for the prompt call
  const promptTypeInfo = findMatchingPromptType(promptCall)
  if (!promptTypeInfo || !promptTypeInfo.promptType) {
    return `<!-- Error: No matching prompt type found for ${promptCall} -->`
  }

  const { promptType, name } = promptTypeInfo
  logDebug(pluginJson, `Found matching prompt type within variable assignment: ${varType} ${name}`)

  try {
    // Handle session variable replacement if needed
    const fixedPromptCall = replaceSessionVariables(promptCall, sessionData)
    const finalPromptCall = fixedPromptCall || promptCall

    // Parse the parameters for this prompt call
    const tempTag = `<%- ${finalPromptCall} %>`
    logDebug(pluginJson, `Created temporary tag for parsing: "${tempTag}"`)

    const params = promptType.parseParameters(tempTag)
    logDebug(pluginJson, `Parsed parameters: ${JSON.stringify(params)}`)

    // Override the varName with the one from the assignment
    params.varName = varName
    logDebug(pluginJson, `Processing variable assignment: ${varType} ${varName} = ${finalPromptCall}`)

    // Process the prompt to get the response
    const response = await promptType.process(tempTag, sessionData, params)
    logDebug(pluginJson, `Prompt response: "${response}"`)
    if (response === false) return false // Immediately return false if prompt was cancelled

    // Check if response looks like it's a string representation of the prompt call
    if (typeof response === 'string' && response.startsWith(`${name}(`) && response.endsWith(')')) {
      const fixedResponse = await fixStringifiedResponse(response, name, promptType, varName, sessionData)
      if (fixedResponse === false) return false

      // Store the fixed response
      sessionData[varName] = fixedResponse
      logDebug(pluginJson, `Variable assignment completed with fixed response - returning empty string`)
      return ''
    }

    // Store the response in the sessionData with the assigned variable name
    sessionData[varName] = response
    logDebug(pluginJson, `Stored response in sessionData[${varName}] = "${response}"`)

    // For variable assignments, always return empty string (no output)
    logDebug(pluginJson, `Variable assignment completed - returning empty string`)
    return ''
  } catch (error) {
    logError(pluginJson, `Error processing prompt type ${name} in variable assignment: ${error.message}`)
    return `<!-- Error processing prompt in variable assignment: ${error.message} -->`
  }
}

/**
 * Processes a standard prompt tag (non-assignment)
 * @param {string} tag - The original tag
 * @param {string} content - The tag content
 * @param {any} sessionData - The session data
 * @returns {Promise<string|false>} The processed result or false if cancelled
 */
async function processNonAssignmentPrompt(tag: string, content: string, sessionData: any): Promise<string | false> {
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
  if (!promptTypeInfo || !promptTypeInfo.promptType) {
    return tag // No matching prompt type found, return original tag
  }

  const { promptType, name } = promptTypeInfo
  logDebug(pluginJson, `Found matching prompt type for tag "${tag.substring(0, 30)}...}": "${name}"`)

  try {
    // Parse the parameters
    const params = promptType.parseParameters(processContent)
    logDebug(pluginJson, `PromptRegistry::processPromptTag Parsed prompt parameters: ${JSON.stringify(params)}`)

    // Log the tag being processed
    logDebug(pluginJson, `Processing tag: ${tag.substring(0, 100)}...`)

    // Process the prompt
    const response = await promptType.process(tag, sessionData, params)
    if (response === false) return false // Immediately return false if prompt was cancelled

    // Store the response in sessionData if a variable name is provided
    if (params.varName) {
      return handlePromptResponse(tag, params.varName, response, sessionData)
    }

    // If no variable name, return the response directly
    return response
  } catch (error) {
    logError(pluginJson, `Error processing prompt type ${name}: ${error.message}`)
    // Replace the problematic tag with an error comment
    return `<!-- Error processing prompt: ${error.message} -->`
  }
}

/**
 * Handles the response from a prompt, storing it in session data and returning appropriate output
 * @param {string} tag - The original tag
 * @param {string} varName - The variable name to store the response
 * @param {string} response - The prompt response
 * @param {any} sessionData - The session data
 * @returns {string} The output for the template
 */
function handlePromptResponse(tag: string, varName: string, response: string, sessionData: any): string {
  // Store both the original and cleaned variable names
  const cleanedVarName = cleanVarName(varName)
  sessionData[varName] = response
  sessionData[cleanedVarName] = response

  // Check if this is an output tag (<%- ... %>) or execution tag (<% ... %>)
  const isOutputTag = tag.startsWith('<%- ')
  if (isOutputTag) {
    // For output tags, return the variable reference to output the value
    logDebug(pluginJson, `PromptRegistry::processPromptTag Creating variable reference for output: ${cleanedVarName} -- "<%- ${cleanedVarName} %>"`)
    return `<%- ${cleanedVarName} ${tag.endsWith('-%>') ? '-%>' : '%>'}`
  } else {
    // For execution tags, return empty string (no output)
    logDebug(pluginJson, `PromptRegistry::processPromptTag Execution tag completed - returning empty string`)
    return ''
  }
}

/**
 * Processes a single prompt tag using the registered prompt types
 * Sets the sessionData[varName] to the response and returns an EJS tag with the variable name to be placed in the template
 * @param {string} tag The template tag to process.
 * @param {any} sessionData The current session data.
 * @returns {Promise<string|false>} The prompt response and associated info, or false if cancelled.
 */
export async function processPromptTag(tag: string, sessionData: any): Promise<string | false> {
  ;/prompt/i.test(tag) && logDebug(pluginJson, `processPromptTag starting with tag: ${tag}...`)

  // Check for comment tags first - if it's a comment tag, return it unchanged
  if (tag.startsWith('<%#')) {
    return tag
  }

  const { content, isOutputTag, isExecutionTag } = parseTagContent(tag)

  if (!isOutputTag && !isExecutionTag) {
    // Return the original tag if no processing necessary (not sure what this would be but here for completeness)
    return tag
  }

  // Check for variable assignment pattern (const/let/var varName = promptType(...))
  const assignmentMatch = content.match(/^\s*(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:await\s+)?(.+)$/i)
  if (assignmentMatch) {
    const varType = assignmentMatch[1] // const, let, or var
    const varName = assignmentMatch[2].trim() // The variable name
    const promptCall = assignmentMatch[3].trim() // The prompt call (e.g., promptKey("category"))

    // Only process if the right-hand side is actually a prompt call
    const promptTypeInfo = findMatchingPromptType(promptCall)
    if (promptTypeInfo && promptTypeInfo.promptType) {
      return await processVariableAssignment(tag, varType, varName, promptCall, sessionData)
    } else {
      // This is a regular variable assignment (not a prompt), return the original tag unchanged
      return tag
    }
  } else {
    // Standard prompt tag processing (non-assignment)
    const valueToReturn = await processNonAssignmentPrompt(tag, content, sessionData)
    return valueToReturn
  }
}

/**
 * Processes all prompt tags in the given template.
 * @param {string} templateData The template content.
 * @param {any} initialSessionData The initial session data object.
 * @returns {Promise<{sessionTemplateData: string, sessionData: any}>} The updated template and session data.
 */
export async function processPrompts(templateData: string, initialSessionData: any = {}): Promise<{ sessionTemplateData: string, sessionData: any } | false> {
  let sessionTemplateData = templateData
  const sessionData = initialSessionData && typeof initialSessionData === 'object' ? initialSessionData : {}

  try {
    const tags = await getTags(templateData)

    // Ensure tags is an array
    const tagsArray = Array.isArray(tags) ? tags : tags && typeof tags.then === 'function' ? await tags : []

    for (const tag of tagsArray) {
      try {
        logDebug(pluginJson, `processPrompts Processing tag: ${tag}`)
        const promptResponseText = await processPromptTag(tag, sessionData)
        if (promptResponseText === false) {
          logDebug(pluginJson, 'Prompt was cancelled, returning false')
          return false // Immediately return false if any prompt is cancelled
        }

        // Only replace the tag if processPromptTag actually processed it (returned something different)
        if (promptResponseText !== tag) {
          // prompts with variable setting but no output and a slurping tag at the end will be processed here
          // in all other scenarios we can let EJS deal with the slurping
          // the edge case here is that it will greedy chomp multiple newlines which the user may not want
          const doChomp = tag.endsWith('-%>')
          const replaceWhat = doChomp ? new RegExp(`${escapeRegExp(tag)}\\s*\\n*`) : tag
          const replaceWithWhat = tag.startsWith('<% ') ? '' : promptResponseText // do not output if it was a control tag
          sessionTemplateData = sessionTemplateData.replace(replaceWhat, replaceWithWhat)
        }
        // If promptResponseText === tag, don't replace anything (tag was not processed)
      } catch (error) {
        logError(pluginJson, `Error processing prompt tag: ${error.message}`)
        // Replace the problematic tag with an error comment
        const errorComment = `<!-- Error processing prompt: ${error.message} -->`
        sessionTemplateData = sessionTemplateData.replace(tag, errorComment)
      }
    }
  } catch (error) {
    logError(pluginJson, `Error processing prompts: ${error.message}`)
    return false // Return false on any error to ensure consistent behavior
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

/**
 * Checks if a tag is a prompt*() tag
 * @param {string} tag - The tag to check
 * @returns {boolean} True if the tag is a prompt tag, false otherwise
 */
export function isPromptTag(tag: string): boolean {
  // Build regex pattern from registered prompt names
  const promptNames = getRegisteredPromptNames()
  // Escape special regex characters in prompt names
  const escapedNames = promptNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Join names with | for alternation in regex
  const promptPattern = escapedNames.join('|')
  // Add word boundary checks to ensure we only match standalone prompt type names
  const promptRegex = new RegExp(`(?:^|\\s|\\()(?:${promptPattern})\\s*\\(`, 'i')
  return promptRegex.test(tag)
}
