// @flow
/**
 * @fileoverview Provides a registry for prompt types so that new prompt types
 * can be added without modifying the core NPTemplating code.
 */

import pluginJson from '../../../../plugin.json'
import { getTags } from '../../../shared/templateUtils'
import {
  handlePromptResponse,
  notePlanSupportsCommandBarForms,
  replacePromptResultInTemplate,
  runCommandBarFormBatch,
  tryCollectFormBatch,
} from './promptFormBatch'
import { parseTagContent } from './promptTagParse'
import { findMatchingPromptType, isPromptTag } from './promptTypesRegistry'
import { logDebug, logError } from '@helpers/dev'

export type { PromptType } from './promptTypesRegistry'
export { cleanVarName, findMatchingPromptType, getRegisteredPromptNames, isPromptTag, registerPromptType } from './promptTypesRegistry'
export { applyPromptResponseToTemplate } from './promptFormBatch'

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
    const fixedParams = promptType.parseParameters(fixedTag, sessionData)
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
 * @param {string} _tag - The original template tag (reserved for callers / future use)
 * @param {string} varType - The variable declaration type (const, let, var)
 * @param {string} varName - The variable name
 * @param {string} promptCall - The prompt function call
 * @param {any} sessionData - The session data
 * @returns {Promise<string|false>} Empty string for successful assignment, false if cancelled
 */
async function processVariableAssignment(_tag: string, varType: string, varName: string, promptCall: string, sessionData: any): Promise<string | false> {
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

    const params = promptType.parseParameters(tempTag, sessionData)
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
    const params = promptType.parseParameters(processContent, sessionData)
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

    for (let tagIdx = 0; tagIdx < tagsArray.length; tagIdx++) {
      const tag = tagsArray[tagIdx]
      if (!isPromptTag(tag)) continue

      if (notePlanSupportsCommandBarForms()) {
        try {
          const batchInfo = tryCollectFormBatch(tagsArray, tagIdx, sessionData)
          if (batchInfo && batchInfo.tags.length >= 2) {
            logDebug(pluginJson, `processPrompts: CommandBar.showForm batch (${String(batchInfo.tags.length)} prompts)`)
            const batchResult = await runCommandBarFormBatch(batchInfo, sessionData, sessionTemplateData)
            if (batchResult === false) {
              logDebug(pluginJson, 'Prompt form batch was cancelled, returning false')
              return false
            }
            if (batchResult == null) {
              logDebug(pluginJson, 'processPrompts: showForm unavailable or invalid result; processing prompts one at a time')
            } else {
              sessionTemplateData = batchResult.sessionTemplateData
              tagIdx += batchInfo.tags.length - 1
              continue
            }
          }
        } catch (batchError) {
          logError(pluginJson, `processPrompts: form batch error (falling back to single prompts): ${batchError.message}`)
        }
      }

      try {
        logDebug(pluginJson, `processPrompts Processing tag: ${tag.substring(0, 100)}${tag.length > 100 ? '...' : ''}`)
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
          sessionTemplateData = replacePromptResultInTemplate(sessionTemplateData, tag, promptResponseText)
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
