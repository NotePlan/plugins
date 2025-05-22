// @flow
/**
 * @fileoverview Utility functions for processing code in templates.
 */

import pluginJson from '../../plugin.json'
import { getCodeBlocks } from '../core/tagUtils'
import { logDebug } from '@helpers/dev'

/**
 * Merges multi-line JavaScript statements into single statements when they span multiple lines.
 * @param {string} codeContent - The code content to process
 * @returns {string} The processed code with merged multi-line statements
 */
export function mergeMultiLineStatements(codeContent: string): string {
  // Join multi-line statements
  const result = codeContent

  // Find incomplete lines that likely continue on the next line
  const lines = result.split('\n')
  const processedLines = []

  let currentStatement = ''
  let inMultiLineStatement = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines
    if (trimmedLine.length === 0) {
      if (!inMultiLineStatement) {
        processedLines.push(line)
      }
      continue
    }

    // Check if this line is a continuation of a previous statement
    if (inMultiLineStatement) {
      currentStatement += ` ${trimmedLine}`

      // Check if the statement is now complete
      if (trimmedLine.endsWith(';') || trimmedLine.endsWith('{') || trimmedLine.endsWith('}') || (trimmedLine.endsWith(')') && !currentStatement.includes('function('))) {
        processedLines.push(currentStatement)
        currentStatement = ''
        inMultiLineStatement = false
      }
    } else {
      // Check if this line is the start of a multi-line statement
      if (!trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}') && !(trimmedLine.endsWith(')') && !trimmedLine.includes('function('))) {
        currentStatement = trimmedLine
        inMultiLineStatement = true
      } else {
        processedLines.push(line)
      }
    }
  }

  // Add any remaining multi-line statement
  if (inMultiLineStatement && currentStatement.length > 0) {
    processedLines.push(currentStatement)
  }

  return processedLines.join('\n')
}

/**
 * Protects template literals in code by replacing them with placeholders.
 * This prevents them from being interpreted during code processing.
 * @param {string} code - The code containing template literals to protect
 * @returns {{protectedCode: string, literalMap: Array<{placeholder: string, original: string}>}}
 *          The code with protected literals and a map to restore them
 */
export function protectTemplateLiterals(code: string): { protectedCode: string, literalMap: Array<{ placeholder: string, original: string }> } {
  const literalMap = []

  // Find all template literals (backtick-enclosed strings)
  const regex = /`[^`]*`/g
  let match
  let protectedCode = code

  let index = 0
  while ((match = regex.exec(code)) !== null) {
    const placeholder = `__TEMPLATE_LITERAL_${index}__`
    literalMap.push({
      placeholder,
      original: match[0],
    })

    // Replace the template literal with a placeholder
    protectedCode = protectedCode.replace(match[0], placeholder)
    index++
  }

  return { protectedCode, literalMap }
}

/**
 * Restores template literals from their placeholders.
 * @param {string} protectedCode - The code with template literal placeholders
 * @param {Array<{placeholder: string, original: string}>} literalMap - The map of placeholders to original literals
 * @returns {string} The code with original template literals restored
 */
export function restoreTemplateLiterals(protectedCode: string, literalMap: Array<{ placeholder: string, original: string }>): string {
  let restoredCode = protectedCode

  // Replace all placeholders with their original template literals
  for (const item of literalMap) {
    restoredCode = restoredCode.replace(item.placeholder, item.original)
  }

  return restoredCode
}

/**
 * Removes whitespace from fenced code blocks in a string.
 * This was originally used to clean up code blocks in template output,
 * but has been modified to preserve code blocks as users may want them in templates.
 * @param {string} [str=''] - The string containing code blocks to process
 * @returns {string} The string with whitespace removed from code blocks
 */
export function removeWhitespaceFromCodeBlocks(str: string = ''): string {
  let result = str
  getCodeBlocks(str).forEach((codeBlock) => {
    let newCodeBlock = codeBlock
    logDebug(pluginJson, `removeWhitespaceFromCodeBlocks codeBlock before: "${newCodeBlock}"`)
    newCodeBlock = newCodeBlock.replace('```javascript\n', '').replace(/```/gi, '').replace(/\n\n/gi, '').replace(/\n/gi, '')
    logDebug(pluginJson, `removeWhitespaceFromCodeBlocks codeBlock after: "${newCodeBlock}"`)
    result = result.replace(codeBlock, newCodeBlock)
  })

  return result.replace(/\n\n\n/gi, '\n')
}
