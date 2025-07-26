// @flow
/**
 * @fileoverview Utilities for validating and filtering template output.
 */

import pluginJson from '../../plugin.json'
import { getErrorContextString as errorContextUtil, formatTemplateError } from '../utils/errorHandling'
import { logDebug, logError } from '@helpers/dev'

/**
 * Validates EJS tags in the template data for proper opening and closing.
 * @param {string} templateData - The template data to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export function validateTemplateTags(templateData: string): string | null {
  const openTags = (templateData.match(/<%/g) || []).length
  const closeTags = (templateData.match(/%>/g) || []).length

  if (openTags !== closeTags) {
    const unclosedTagPos = templateData.lastIndexOf('<%')
    const unclosedTag = `${templateData.substring(unclosedTagPos, unclosedTagPos + 50)}...`
    const lineNumber = templateData.substring(0, unclosedTagPos).split('\n').length
    const context = getErrorContextString(templateData, unclosedTag.substring(0, 20), lineNumber)

    return formatTemplateError('Unclosed Tag', lineNumber, context, `Template has ${openTags} opening tags (<%) but ${closeTags} closing tags (%>)`)
  }

  return null
}

/**
 * Gets context around errors by showing the surrounding lines of code.
 * @param {string} templateData - The template content
 * @param {string} matchStr - The string to match in the template
 * @param {number} originalLineNumber - The line number of the error (if known)
 * @returns {string} Formatted error context with line numbers
 */
export function getErrorContextString(templateData: string, matchStr: string, originalLineNumber: number): string {
  return errorContextUtil(templateData, matchStr, originalLineNumber)
}

/**
 * Filters and cleans up template result content.
 * Performs various replacements to clean up template output, including:
 * - Removing EJS-related error messages
 * - Replacing certain URLs with more NotePlan-friendly references
 * - Adding helpful information for template syntax when errors are detected
 * @param {string} [templateResult=''] - The rendered template result to filter
 * @returns {string} The filtered template result
 */
export function removeEJSDocumentationNotes(templateResult: string = ''): string {
  if (!templateResult) return ''

  let result = templateResult

  // Remove EJS-related error patterns
  result = result.replace('Error: Problem while rendering', '')
  result = result.replace(/\n\n\n/g, '\n\n')

  // Handle common rendering issues
  if (result.includes('Could not find matching close tag for')) {
    result += '\n\n**Template Syntax Error**\nMake sure all your template tags are properly closed with %>.'
  }

  // Replace certain URL patterns
  result = result.replace(/https:\/\/calendar\.google\.com/g, 'calendar://')

  return result
}
