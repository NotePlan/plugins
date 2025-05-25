// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { logDebug } from '@helpers/dev'
import pluginJson from '../../plugin.json'

/**
 * Cleans up error messages by removing duplicate text and noisy parts.
 * @param {string} errorMessage - The raw error message
 * @returns {string} The cleaned error message
 */
export function cleanErrorMessage(errorMessage: string): string {
  let cleanedMessage = errorMessage

  // 1. Remove duplicate error types and messages
  cleanedMessage = cleanedMessage.replace(/SyntaxError: (.*?)SyntaxError: /g, 'SyntaxError: ')
  cleanedMessage = cleanedMessage.replace(/(Unexpected.*?\.)(\s+Unexpected)/g, '$1')

  // 2. Remove noisy parts that don't help users
  cleanedMessage = cleanedMessage
    .replace(/ejs:\d+/gi, '')
    .replace('list.', 'list')
    .replace('while compiling ejs', '')
    .replace(/Error: "(.+)"/g, '$1') // Remove extra Error: "..." wrapper

  return cleanedMessage
}

/**
 * Extracts error context lines from the template data.
 * @param {Error} error - The error object
 * @param {string} processedTemplateData - The processed template data
 * @returns {{contextLines: string, lineInfo: string, adjustedLine: number}} Error context information
 */
export function extractErrorContext(error: Error, processedTemplateData: string): { contextLines: string, lineInfo: string, adjustedLine: number } {
  let contextLines = ''
  let lineInfo = ''
  let adjustedLine = -1

  // Extract line and column for better error context
  if (error?.line) {
    // Adjust the line number offset - EJS adds boilerplate code at the top
    adjustedLine = error.line - 7 // Assuming 7 lines of boilerplate
    lineInfo = `Line: ${adjustedLine}`

    if (error?.column) {
      lineInfo += `, Column: ${error.column}`
    }

    // If we can extract the error context from the template
    if (processedTemplateData) {
      try {
        const templateLines = processedTemplateData.split('\n')
        const startLine = Math.max(0, adjustedLine - 5)
        const endLine = Math.min(templateLines.length - 1, adjustedLine + 5)

        for (let i = startLine; i <= endLine; i++) {
          const marker = i === adjustedLine - 1 ? '>> ' : '   '
          contextLines += `${marker}${i + 1}| ${templateLines[i] || ''}\n`
        }

        if (error.column && adjustedLine - 1 < templateLines.length) {
          const errorLineText = templateLines[adjustedLine - 1] || ''
          const columnMarker = '   ' + ' '.repeat(String(adjustedLine).length + 2) + ' '.repeat(Math.min(error.column, errorLineText.length)) + '^'
          contextLines += `${columnMarker}\n`
        }
      } catch (e) {
        logDebug(pluginJson, `Failed to extract error context: ${e.message}`)
        contextLines = 'Could not extract template context.\n'
      }
    }
  }

  return { contextLines, lineInfo, adjustedLine }
}

/**
 * Builds the basic error message structure.
 * @param {string} errorMessage - The cleaned error message
 * @param {string} lineInfo - Line information string
 * @param {string} contextLines - Context lines around the error
 * @param {string} originalScript - The original script for reference
 * @returns {string} The formatted error message
 */
export function buildBasicErrorMessage(errorMessage: string, lineInfo: string, contextLines: string, originalScript: string): string {
  let result = '---\n## Template Rendering Error\n'

  if (lineInfo) {
    result += `==Rendering failed at ${lineInfo}==\n`
  } else {
    result += `==Rendering failed==\n`
  }

  result += `### Template Processor Result:\n\`\`\`\n${errorMessage.trim()}\n\`\`\`\n`

  if (contextLines) {
    result += `### Template Context:\n\`\`\`\n${contextLines.trim()}\n\`\`\`\n`
  }

  // Add the special handling for critical errors (like JSON parsing)
  if (errorMessage.includes('JSON') || errorMessage.toLowerCase().includes('unexpected identifier')) {
    result += `**Template contains critical errors.**\n`
  }

  // Include original script in error message if available
  if (originalScript && originalScript.trim()) {
    result += `\n**Template:**\n\`\`\`\n${originalScript}\n\`\`\`\n`
  }

  return result
}

/**
 * Appends previous phase errors to error messages.
 * @param {string} result - The current error message
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Previous phase errors
 * @param {string} sectionTitle - Title for the error section
 * @returns {string} Error message with previous phase errors appended
 */
export function appendPreviousPhaseErrorsToError(
  result: string,
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>,
  sectionTitle: string = 'Errors from previous rendering phases:',
): string {
  if (previousPhaseErrors && previousPhaseErrors.length > 0) {
    result += `\n**${sectionTitle}**\n`
    previousPhaseErrors.forEach((err) => {
      if (sectionTitle.includes('Additional Issues')) {
        result += `### ${err.phase}:\n`
        result += `**Error:** ${err.error}\n`
        result += `**Context:** ${err.context}\n\n`
      } else {
        result += `### ${err.phase}:\n`
        result += `Error: ${err.error}\n`
        result += `Context: ${err.context}\n\n`
      }
    })
    result += '---\n'
  }
  return result
}
