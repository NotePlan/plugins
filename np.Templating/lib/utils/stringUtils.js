// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

/**
 * Helper function to get a formatted string of the current date and time.
 * Primarily used for logging or debugging purposes.
 * @returns {string} Formatted current date and time (e.g., "2023-10-27 10:30:00 AM").
 */
export const dt = (): string => {
  const d = new Date() // Get current date and time

  // Helper function to pad single-digit numbers with a leading zero
  const pad = (value: number): string => {
    return value < 10 ? '0' + value : String(value)
  }

  // Construct and return the formatted date and time string
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString()}`
}

/**
 * Normalizes a filename to be compatible with NotePlan's file system.
 * Removes special characters that are not allowed in NotePlan filenames.
 * @param {string} [filename=''] - The filename to normalize
 * @returns {Promise<string>} The normalized filename
 */
export const normalizeToNotePlanFilename = async (filename: string = ''): Promise<string> => {
  return filename.replace(/[#()?%*|"<>:]/gi, '')
}

/**
 * Extracts the title from a markdown string if it starts with a markdown title pattern.
 * Otherwise, sets the title to a default value.
 * @param {string} markdown - The markdown string to process.
 * @returns {{ updatedMarkdown: string, title: string }} An object containing the updated markdown without the title line (if applicable) and the extracted or default title.
 */
export const extractTitleFromMarkdown = (markdown: string): { updatedMarkdown: string, title: string } => {
  let title = 'foo' // Default title
  let updatedMarkdown = markdown
  const lines = markdown.split('\n')

  // Check if the first line is a title
  if (lines[0].startsWith('# ')) {
    title = lines[0].substring(2) // Extract title, removing "# "
    lines.shift() // Remove the title line
    updatedMarkdown = lines.join('\n')
  }

  return { updatedMarkdown, title }
}

/**
 * Retrieves a nested property value from an object using a dot-separated key string.
 * For example, given object `obj` and key `"a.b.c"`, it returns `obj.a.b.c`.
 * @param {any} object - The object to traverse.
 * @param {string} key - The dot-separated path to the desired property.
 * @returns {any} The value of the property if found, otherwise undefined.
 */
export const getProperyValue = (object: any, key: string): any => {
  // Split the key string into an array of property names
  const tokens = key.split('.')

  // Use a local variable to traverse the object structure
  let current = object

  // Use for...of loop instead of forEach to allow proper early return
  for (const token of tokens) {
    // Traverse the object, updating 'current' to be the next nested object/value
    // $FlowIgnorew - Flow might complain about dynamic property access, but it's intended.
    if (current && typeof current === 'object' && token in current) {
      // Added checks for safety
      current = current[token]
    } else {
      // Property not found or object is not traversable - return immediately
      return undefined
    }
  }
  return current
}

/**
 * Merges multi-line JavaScript statements into single statements when they span multiple lines.
 * Particularly important for method chaining patterns that might be split across lines.
 * @param {string} codeContent - The code content to process
 * @returns {string} The processed code with merged multi-line statements
 */
export const mergeMultiLineStatements = (codeContent: string): string => {
  if (!codeContent || typeof codeContent !== 'string') {
    return ''
  }

  const rawLines = codeContent.split('\n')
  if (rawLines.length <= 1) {
    return codeContent // No merging needed for single line or empty
  }

  const mergedLines: Array<string> = []
  mergedLines.push(rawLines[0]) // Start with the first line

  for (let i = 1; i < rawLines.length; i++) {
    const currentLine = rawLines[i]
    const trimmedLine = currentLine.trim()
    let previousLine = mergedLines[mergedLines.length - 1]

    if (trimmedLine.startsWith('.') || trimmedLine.startsWith('?') || trimmedLine.startsWith(':')) {
      // Remove the last pushed line, modify it, then push back
      mergedLines.pop()
      // Remove trailing semicolon from previous line before concatenation
      if (previousLine.trim().endsWith(';')) {
        previousLine = previousLine.trim().slice(0, -1).trimEnd()
      }
      // Ensure a single space separator if previous line doesn't end with one
      // and current line doesn't start with one (after trimming the operator)
      const separator = previousLine.endsWith(' ') ? '' : ' '
      mergedLines.push(previousLine + separator + trimmedLine)
    } else {
      mergedLines.push(currentLine) // This is a new statement, push as is
    }
  }
  return mergedLines.join('\n')
}

/**
 * Protects template literals in code by replacing them with placeholders.
 * This prevents the template literals from being processed as EJS tags.
 * @param {string} code - The code containing template literals to protect
 * @returns {{protectedCode: string, literalMap: Array<{placeholder: string, original: string}>}}
 *          The code with protected literals and a map to restore them
 */
export const protectTemplateLiterals = (code: string): { protectedCode: string, literalMap: Array<{ placeholder: string, original: string }> } => {
  const literalMap: Array<{ placeholder: string, original: string }> = []
  let i = 0
  // Regex to find template literals, handling escaped backticks
  const protectedCode = code.replace(/`([^`\\\\]|\\\\.)*`/g, (match) => {
    const placeholder = `__NP_TEMPLATE_LITERAL_${i}__`
    literalMap.push({ placeholder, original: match })
    i++
    return placeholder
  })
  return { protectedCode, literalMap }
}

/**
 * Restores template literals from their placeholders.
 * Used after processing code that contains template literals.
 * @param {string} protectedCode - The code with template literal placeholders
 * @param {Array<{placeholder: string, original: string}>} literalMap - The map of placeholders to original literals
 * @returns {string} The code with original template literals restored
 */
export const restoreTemplateLiterals = (protectedCode: string, literalMap: Array<{ placeholder: string, original: string }>): string => {
  let code = protectedCode
  for (const entry of literalMap) {
    // Escape placeholder string for use in RegExp, just in case it contains special characters
    const placeholderRegex = new RegExp(entry.placeholder.replace(/[.*+?^${}()|[\\\\]\\\\]/g, '\\\\$&'), 'g')
    code = code.replace(placeholderRegex, entry.original)
  }
  return code
}

/**
 * Formats a template error message with consistent styling.
 * @param {string} errorType - The type of error (e.g. "unclosed tag")
 * @param {number} lineNumber - The line number where the error occurred
 * @param {string} context - The context lines around the error
 * @param {string} [description] - Optional description of the error
 * @returns {string} Formatted error message
 */
export const formatTemplateError = (errorType: string, lineNumber: number, context: string, description?: string): string => {
  const desc = description ? `\n\`${description}\`` : ''
  return `==Template error: Found ${errorType} near line ${lineNumber}==${desc}\n\`\`\`\n${context}\n\`\`\`\n`
}

/**
 * Gets the raw text content of the currently selected paragraphs in the NotePlan editor.
 * Each paragraph's raw content is joined by a newline character.
 * @async
 * @returns {Promise<string>} A promise that resolves to the concatenated raw content of selected paragraphs.
 */
export const selection = async (): Promise<string> => {
  // Access NotePlan's Editor API to get selected paragraphs
  // Map each paragraph to its 'rawContent'
  // Join the raw content of all selected paragraphs with newline characters
  return Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
}
