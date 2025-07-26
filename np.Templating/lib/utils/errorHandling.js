// @flow
/**
 * @fileoverview Utility functions for handling and formatting errors in templates.
 */

import pluginJson from '../../plugin.json'
import { logDebug, logError } from '@helpers/dev'

/**
 * Formats frontmatter-related error messages to be more user-friendly.
 * Specifically handles common YAML parsing errors in templates.
 * @param {any} error - The error object from the YAML parser
 * @returns {string} Formatted error message string
 */
export function frontmatterError(error: any): string {
  if (error.reason === 'missed comma between flow collection entries') {
    return `**Frontmatter Template Parsing Error**\n\nWhen using template tags in frontmatter attributes, the entire block must be wrapped in quotes\n${error.mark}`
  }
  return error
}

/**
 * Provides context around errors by showing the surrounding lines of code.
 * Helps debug template errors by showing the line with the error and a few lines before and after.
 * @param {string} templateData - The template content
 * @param {string} matchStr - The string to match in the template
 * @param {number} originalLineNumber - The line number of the error (if known)
 * @returns {string} Formatted error context with line numbers
 */
export function getErrorContextString(templateData: string, matchStr: string, originalLineNumber: number): string {
  // Look for the position of the error in the template data
  const pos = templateData.indexOf(matchStr)
  if (pos === -1) {
    return 'Error context not found'
  }

  // Count line breaks before the error to determine the line number
  const textUpToError = templateData.substring(0, pos)
  const lines = textUpToError.split('\n')
  const lineNumber = originalLineNumber > 0 ? originalLineNumber : lines.length

  // Get a few lines before and after the error for context
  const startLine = Math.max(0, lineNumber - 3)
  const endLine = Math.min(templateData.split('\n').length, lineNumber + 3)

  // Format the context with line numbers
  let context = ''
  templateData
    .split('\n')
    .slice(startLine, endLine)
    .forEach((line, i) => {
      const currentLineNumber = startLine + i + 1
      const isErrorLine = currentLineNumber === lineNumber
      context += `${currentLineNumber}${isErrorLine ? ' *' : '  '}: ${line}\n`
    })

  return context
}

/**
 * Formats a template error message with consistent styling.
 * @param {string} errorType - The type of error (e.g. "unclosed tag")
 * @param {number} lineNumber - The line number where the error occurred
 * @param {string} context - The context lines around the error
 * @param {string} [description] - Optional description of the error
 * @returns {string} Formatted error message
 */
export function formatTemplateError(errorType: string, lineNumber: number, context: string, description?: string): string {
  return `**Template ${errorType} Error${lineNumber > 0 ? ` at line ${lineNumber}` : ''}**\n\n${description ? `${description}\n\n` : ''}${context}`
}

/**
 * Returns a formatted error message for template errors.
 * @param {string} location - The source location of the error
 * @param {Error|string} error - The error object or message
 * @returns {string} A formatted error message
 */
export function templateErrorMessage(location: string, error: Error | string): string {
  return `**Template Error in ${location}**\n\n${error instanceof Error ? error.message : error}`
}
