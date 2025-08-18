// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { logDebug, logError, timer } from '@helpers/dev'
import pluginJson from '../../plugin.json'
import { appendPreviousPhaseErrorsToError } from './errorProcessor'
import { notePlanTopLevelObjects } from '../globals'

/**
 * Uses NotePlan.AI to analyze and rewrite template errors with helpful suggestions.
 * @param {string} originalError - The original error message from EJS
 * @param {string} templateData - The processed template data that caused the error
 * @param {Object} renderData - The render context data that was available
 * @param {string} originalScript - The original user script
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Previous phase errors
 * @returns {Promise<string>} A rewritten error message with AI suggestions
 */
export async function analyzeErrorWithAI(
  originalError: string,
  templateData: string,
  renderData: Object,
  originalScript: string,
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>,
): Promise<string> {
  try {
    // Check if AI error analysis is disabled via frontmatter
    if (renderData.frontmatter && renderData.frontmatter.disableAIErrorAnalysis) {
      logDebug(pluginJson, `AI error analysis disabled via frontmatter setting: disableAIErrorAnalysis`)

      // Return basic error message without AI analysis
      let basicErrorMessage = '==**Templating Error Found**: Basic Error Information==\n\n'
      basicErrorMessage += `### Error Description:\n- ${originalError}\n\n`
      basicErrorMessage += `### What to do to fix the error(s):\n- Review the error message above and check your template syntax\n- Ensure all variables are defined before use\n- Check for proper opening and closing of template tags\n\n`
      basicErrorMessage += `**Note:** AI error analysis has been disabled for this template via frontmatter setting.\n`
      basicErrorMessage += `For detailed AI-powered error analysis, remove the \`disableAIErrorAnalysis: true\` setting from your template's frontmatter.\n\n`

      // Include problematic lines if we have them
      const problematicLines = extractProblematicLines(originalError, templateData, originalScript)
      if (problematicLines && problematicLines.trim() && problematicLines !== 'No original script available') {
        basicErrorMessage += `**Problematic Lines from Original Script:**\n\`\`\`\n${problematicLines}\n\`\`\`\n\n`
      }

      basicErrorMessage += '---\n'
      basicErrorMessage += '**Error Details (for debugging):**\n'
      basicErrorMessage += `Original Error: ${originalError}\n`
      basicErrorMessage += `Template Data: ${templateData ? templateData.substring(0, 200) : ''}${templateData ? (templateData.length > 200 ? '...' : '') : ''}\n`

      return basicErrorMessage
    }

    const startTime = new Date()

    // Prepare context information, filtering out polluted error variables
    const contextInfo = prepareContextInfo(renderData)

    // Prepare previous phase errors section
    const previousPhaseErrorsSection = preparePreviousPhaseErrorsSection(previousPhaseErrors)

    // Template for AI analysis
    const aiErrorTemplate = buildAIErrorTemplate(originalError, contextInfo, previousPhaseErrorsSection, originalScript, templateData)

    logDebug(`Sending error to NotePlan.AI for analysis: `, aiErrorTemplate)

    // Call NotePlan.AI
    const aiAnalysis = await NotePlan.ai(aiErrorTemplate, [], false, 'gpt-4')

    logDebug(pluginJson, `TemplatingEngine::render AI analysis took ${timer(startTime)}`)

    if (!aiAnalysis) {
      logError(pluginJson, `AI analysis failed: No response received`)
      return originalError
    }

    logDebug(pluginJson, `Received AI analysis: ${aiAnalysis.substring(0, 200)}...`)

    // Format the AI response as a proper error message
    return formatAIAnalysisResult(aiAnalysis, originalError, templateData, originalScript)
  } catch (aiError) {
    logError(pluginJson, `AI error analysis failed: ${aiError.message}`)
    // Fall back to original error if AI analysis fails
    return originalError
  }
}

/**
 * Prepares context information for AI analysis, filtering out error-polluted variables.
 * @param {Object} renderData - The render context data
 * @returns {string} Formatted context information
 */
function prepareContextInfo(renderData: Object): string {
  const contextKeys = Object.keys(renderData)
  const contextEntries = contextKeys.map((key) => {
    const value = renderData[key]
    if (typeof value === 'function') {
      return { key, description: `${key}()` }
    } else if (typeof value === 'object' && value !== null) {
      // For objects, show all keys and indicate which ones are functions
      // Get own properties (enumerable and non-enumerable)
      const ownPropertyNames = Object.getOwnPropertyNames(value)

      // Also check for prototype methods (for class instances like DateModule)
      // But filter out built-in Object prototype methods
      const prototypeMethods: Array<string> = []
      if (value.constructor && value.constructor.prototype) {
        const prototypeKeys = Object.getOwnPropertyNames(value.constructor.prototype)
        const builtInObjectMethods = [
          '__defineGetter__',
          '__defineSetter__',
          '__lookupGetter__',
          '__lookupSetter__',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'toString',
          'valueOf',
          'toLocaleString',
          'constructor',
        ]

        prototypeMethods.push(...prototypeKeys.filter((prop) => !builtInObjectMethods.includes(prop) && typeof value[prop] === 'function'))
      }

      // Combine own properties and prototype methods, avoiding duplicates
      const allKeys = [...new Set([...ownPropertyNames, ...prototypeMethods])]

      const keyDescriptions = allKeys.map((objKey) => {
        const objValue = value[objKey]
        // Check if it's a function, including inherited ones
        const isFunction = typeof objValue === 'function' || (value.constructor && value.constructor.prototype && typeof value.constructor.prototype[objKey] === 'function')
        return isFunction ? `${objKey}()` : objKey
      })

      return { key, description: `${key}: [object with keys: ${keyDescriptions.join(', ')}]` }
    } else {
      const valueStr = String(value)
      // Filter out context variables that contain error messages from previous phases
      if (
        valueStr.includes('==**Templating Error Found**') ||
        valueStr.includes('Template Rendering Error') ||
        valueStr.includes('Error:') ||
        valueStr.includes('SyntaxError:') ||
        valueStr.includes('ReferenceError:')
      ) {
        return { key, description: `${key}: [ERROR - filtered out polluted error message]` }
      }
      return { key, description: `${key}: ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}` }
    }
  })

  // Add NotePlan top-level objects to the context entries
  const notePlanEntries = notePlanTopLevelObjects.map((objectName) => ({
    key: objectName,
    description: `${objectName}: [NotePlan top-level object] (includes various props/methods)`,
  }))

  // Combine all entries and sort alphabetically (case-insensitive)
  const allEntries = [...contextEntries, ...notePlanEntries]
  allEntries.sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()))

  return allEntries.map((entry) => entry.description).join('\n')
}

/**
 * Prepares the previous phase errors section for AI analysis.
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Previous phase errors
 * @returns {string} Formatted previous phase errors section
 */
function preparePreviousPhaseErrorsSection(previousPhaseErrors: Array<{ phase: string, error: string, context: string }>): string {
  if (!previousPhaseErrors || previousPhaseErrors.length === 0) {
    return ''
  }

  return `\n*****
## Errors from previous rendering phases:
${previousPhaseErrors
  .map(
    (err) => `### ${err.phase}:
Error: ${err.error}
Context: ${err.context}`,
  )
  .join('\n\n')}`
}

/**
 * Builds the AI error analysis template.
 * @param {string} originalError - The original error message
 * @param {string} contextInfo - Context information
 * @param {string} previousPhaseErrorsSection - Previous phase errors section
 * @param {string} originalScript - The original user script
 * @param {string} templateData - The processed template data
 * @returns {string} The AI error template
 */
function buildAIErrorTemplate(originalError: string, contextInfo: string, previousPhaseErrorsSection: string, originalScript: string, templateData: string): string {
  // Convert literal \n strings back to actual newlines for better readability
  const readableTemplateData = templateData.replace(/\\n/g, '\n')

  return `You are now an expert in EJS Templates. I want you to help find the error in an EJS template I ran that failed.
Find the error(s) and describe in layman's terms what I should do to fix the error(s). Note that if you see  
- Do not mention EJS in your answer -- Use the word "Templating" instead. 
- Do not mention semicolons in your answer unless the semicolon was in the user's original template/script 
- Rewrite the entire error message using the following format:
### Error Description:
  - Overview of error(s) as a list, including parentheticals with the problematic code in single \`
      backticks\`
### What to do to fix the error(s):
  - What specific changes they should make to fix the error(s)

**IMPORTANT COMMON ISSUES TO CHECK FOR:**

1. **Undefined Variables**: Make sure all variables are defined before use.

2. **Function Call Syntax**: Check for missing parentheses, brackets, or quotes.

3. **Template Tag Syntax**: Ensure all template tags are properly opened and closed.

4. **Control Structure Syntax**: Ensure all control structures are properly opened and closed.

*****
## Error message I received from EJS. (The line number may or may not be accurate, and therefore the specific code it is showing as context may or may not be accurate either):
${originalError}
*****
## The context variables/values that were available to the script were as follows:
${contextInfo}${previousPhaseErrorsSection}
*****
## This was the user's original template before it went to the pre-processor:
${originalScript || 'No original script available'}
*****
## This was the template after it had been pre-processed (any EJS errors would refer to this pre-processed file):
${readableTemplateData}
*****
Javascript Error Message:
${originalError
  .split('\n')
  .filter((line) => line.includes('Error'))
  .join('\n')}
`
}

/**
 * Formats the AI analysis result into a proper error message.
 * @param {string} aiAnalysis - The AI analysis result
 * @param {string} originalError - The original error message
 * @param {string} templateData - The processed template data
 * @param {string} originalScript - The original user script
 * @returns {string} Formatted AI analysis result
 */
function formatAIAnalysisResult(aiAnalysis: string, originalError: string, templateData: string, originalScript: string): string {
  let formattedResult = '==**Templating Error Found**: AI Analysis and Recommendations==\n\n'
  formattedResult += aiAnalysis

  // Include problematic lines if we have them
  const problematicLines = extractProblematicLines(originalError, templateData, originalScript)
  if (problematicLines && problematicLines.trim() && problematicLines !== 'No original script available') {
    formattedResult += `\n\n**Problematic Lines from Original Script:**\n\`\`\`\n${problematicLines}\n\`\`\`\n`
  }

  formattedResult += '\n---\n'
  return formattedResult
}

/**
 * Extracts problematic lines from the original script with context around them.
 * @param {string} originalError - The error message to analyze
 * @param {string} templateData - The processed template data
 * @param {string} originalScript - The original user script
 * @returns {string} Formatted problematic lines with context
 */
function extractProblematicLines(originalError: string, templateData: string, originalScript: string): string {
  if (!originalScript || !originalScript.trim()) {
    return 'No original script available'
  }

  const originalLines = originalScript.split('\n')
  const contextRadius = 2 // Lines of context to show around problematic areas
  const problematicSections = []

  // Try to extract line number from error message
  const lineMatch = originalError.match(/line (\d+)/i)
  let errorLineNumber = null
  if (lineMatch) {
    errorLineNumber = parseInt(lineMatch[1], 10) - 7 // Adjust for EJS boilerplate offset
  }

  // Find problematic patterns in the original script
  const problematicPatterns = findProblematicPatterns(originalError, originalLines)

  // If we have a specific line number, add that section with its line number for sorting
  if (errorLineNumber && errorLineNumber > 0 && errorLineNumber <= originalLines.length) {
    const section = extractSection(originalLines, errorLineNumber - 1, contextRadius, `Line ${errorLineNumber}`)
    if (section) {
      problematicSections.push({
        lineNumber: errorLineNumber,
        section: section,
      })
    }
  }

  // Add sections for any other problematic patterns we found
  problematicPatterns.forEach(({ lineIndex, reason }) => {
    // Avoid duplicating the error line section
    if (!errorLineNumber || Math.abs(lineIndex - (errorLineNumber - 1)) > contextRadius) {
      const section = extractSection(originalLines, lineIndex, contextRadius, reason)
      if (section) {
        problematicSections.push({
          lineNumber: lineIndex + 1, // Convert 0-based index to 1-based line number
          section: section,
        })
      }
    }
  })

  // If we didn't find specific problematic sections, show the first few lines
  if (problematicSections.length === 0) {
    const section = extractSection(originalLines, 0, Math.min(5, originalLines.length - 1), 'Beginning of template')
    if (section) {
      problematicSections.push({
        lineNumber: 1,
        section: section,
      })
    }
  }

  // Sort sections by line number to display them in order
  problematicSections.sort((a, b) => a.lineNumber - b.lineNumber)

  // Extract just the sections and join them
  return problematicSections.map((item) => item.section).join('\n\n...\n\n')
}

/**
 * Finds patterns in the original script that might be causing errors.
 * @param {string} originalError - The error message
 * @param {Array<string>} originalLines - Lines from the original script
 * @returns {Array<{lineIndex: number, reason: string}>} Array of problematic line indices with reasons
 */
function findProblematicPatterns(originalError: string, originalLines: Array<string>): Array<{ lineIndex: number, reason: string }> {
  const patterns = []

  originalLines.forEach((line, index) => {
    // Look for undefined variables mentioned in error
    const undefinedVarMatch = originalError.match(/(\w+) is not defined/)
    if (undefinedVarMatch && line.includes(undefinedVarMatch[1])) {
      patterns.push({ lineIndex: index, reason: `Undefined variable: ${undefinedVarMatch[1]}` })
    }

    // Look for syntax errors
    if (line.includes('<%') && !line.includes('%>')) {
      patterns.push({ lineIndex: index, reason: 'Unclosed template tag' })
    }

    // Look for common syntax issues
    if (line.includes('someFunction(') && !line.includes(')')) {
      patterns.push({ lineIndex: index, reason: 'Missing closing parenthesis' })
    }

    // Look for assignment in conditions
    if (line.match(/if\s*\([^=]*=\s*[^=]/)) {
      patterns.push({ lineIndex: index, reason: 'Assignment in condition (should be comparison)' })
    }

    // Check for control structures using 'in' operator with arrays (common mistake)
    if (line.includes(' in [') && line.includes('if')) {
      patterns.push({ lineIndex: index, reason: 'Using "in" operator with array (should use .includes() method instead)' })
    }
  })

  return patterns
}

/**
 * Extracts a section of lines with context around a specific line.
 * @param {Array<string>} lines - All lines from the script
 * @param {number} centerIndex - The line index to center on
 * @param {number} radius - Number of context lines to include on each side
 * @param {string} reason - Reason this section is being extracted
 * @returns {string} Formatted section with line numbers
 */
function extractSection(lines: Array<string>, centerIndex: number, radius: number, reason: string): string {
  const startIndex = Math.max(0, centerIndex - radius)
  const endIndex = Math.min(lines.length - 1, centerIndex + radius)

  let section = `[${reason}]\n`

  for (let i = startIndex; i <= endIndex; i++) {
    const lineNumber = i + 1
    const marker = i === centerIndex ? '>> ' : '   '
    section += `${marker}${lineNumber}: ${lines[i]}\n`
  }

  return section.trim()
}

/**
 * Handles AI analysis results and integrates them with error messages.
 * @param {string} aiAnalysis - The AI analysis result
 * @param {string} basicErrorMessage - The basic error message
 * @param {string} originalError - The original error message
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Previous phase errors
 * @returns {string} The final error message with AI analysis and previous phase errors
 */
export function handleAIAnalysisResult(
  aiAnalysis: string,
  basicErrorMessage: string,
  originalError: string,
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>,
): string {
  let result = basicErrorMessage

  // If AI analysis was successful and returned something useful, use it as the primary message
  if (aiAnalysis && aiAnalysis.trim() && aiAnalysis !== originalError) {
    result = aiAnalysis
  } else {
    // AI analysis failed or returned original error - include previous phase errors
    result = appendPreviousPhaseErrorsToError(result, previousPhaseErrors)
  }

  // Always append previous phase errors in a clear section, even when AI analysis succeeds
  result = appendPreviousPhaseErrorsToError(result, previousPhaseErrors, 'Additional Issues from Previous Processing Phases:')

  return result
}
