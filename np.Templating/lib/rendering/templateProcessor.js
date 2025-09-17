// @flow
/**
 * @fileoverview Contains functions for processing templates.
 * This module handles all template processing operations previously in NPTemplating.js.
 */

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../../plugin.json'
import FrontmatterModule from '../support/modules/FrontmatterModule'
import { processPrompts } from '../support/modules/prompts'
import TemplatingEngine from '../TemplatingEngine'
import {
  getTags,
  isCommentTag,
  isCode,
  getCodeBlocks,
  getIgnoredCodeBlocks,
  convertTemplateJSBlocksToControlTags,
  getTemplate,
  getNote,
  codeBlockHasComment,
  blockIsJavaScript,
} from '../core'
import {
  getProperyValue,
  mergeMultiLineStatements,
  protectTemplateLiterals,
  restoreTemplateLiterals,
  formatTemplateError,
  extractTitleFromMarkdown,
  replaceSmartQuotes,
} from '../utils'
import globals, { asyncFunctions as globalAsyncFunctions } from '../globals'
import { convertToDoubleDashesIfNecessary } from '../engine/templateRenderer'
import { log, logError, logDebug, logWarn, clo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

/**
 * Logs the progress of template rendering at each step.
 * Provides detailed debugging information about template data and session state.
 * @param {string} stepDescription - Description of the current step
 * @param {string} templateData - Current template data
 * @param {Object} [sessionData] - Current session data (optional)
 * @param {Object} [userOptions] - User options (optional)
 * @param {boolean} [verbose=false] - Whether to log full details (default: false for less verbosity)
 */
export function logProgress(stepDescription: string, templateData: string, sessionData?: Object, userOptions?: Object): void {
  const verbose = Boolean(sessionData && sessionData.verboseLog)
  logDebug(`🔄 TEMPLATE PROCESSOR: ${stepDescription}${verbose ? ' (verboseLog)' : ''}`)

  // Ensure templateData is a string and handle edge cases
  let safeTemplateData = templateData
  if (templateData === null || templateData === undefined) {
    logDebug(`🔄 TEMPLATE PROCESSOR PROBLEM FYI: logProgress called with null/undefined templateData`)
    safeTemplateData = ''
  } else if (typeof templateData !== 'string') {
    logDebug(`🔄 TEMPLATE PROCESSOR PROBLEM FYI: logProgress called with non-string templateData: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    safeTemplateData = String(templateData)
  }

  if (!safeTemplateData) {
    logDebug(`🔄 TEMPLATE PROCESSOR PROBLEM FYI: logProgress called with empty templateData`)
    return
  }

  // Only log template data if verbose mode is on or if it's a key step
  const isStart = stepDescription.includes('START')
  const isCompletion = stepDescription.includes('COMPLETE')
  const isError = stepDescription.includes('ERROR')
  const isKeyStep = isStart || isCompletion || isError
  const msg = isCompletion ? 'COMPLETE ' : isStart ? 'START ' : isError ? 'ERROR ' : ''
  if (verbose || isKeyStep) {
    logDebug(
      `📄 ${msg}Template Text (${safeTemplateData.length} chars): ${safeTemplateData ? safeTemplateData.substring(0, 200) : ''}${
        safeTemplateData ? (safeTemplateData.length > 200 ? '...' : '') : ''
      }`,
    )
  }

  if (sessionData && (verbose || isKeyStep)) {
    const sessionKeys = Object.keys(sessionData)
    logDebug(`📊 ${msg}Session Data Keys: [${sessionKeys.join(', ')}]`)

    // Only log full session data details in verbose mode
    if (verbose && sessionKeys.length > 0) {
      logDebug(`📊 ${msg}Session Data Details: ${JSON.stringify(sessionData)}`)
    }
  }

  if (userOptions && verbose) {
    clo(userOptions, `⚙️ User Options`)
  }
}

/**
 * Analyzes a JavaScript statement and adds 'await' prefix to async function calls when needed.
 * Handles various code structures like control statements, variable declarations, and function calls.
 * @param {string} statement - The JavaScript statement to process
 * @param {Array<string>} asyncFunctions - List of function names that are known to be async
 * @returns {string} The processed statement with 'await' added where needed
 */
export function processStatementForAwait(statement: string, asyncFunctions: Array<string>): string {
  if (statement.includes('await ')) {
    return statement
  }
  const controlStructures = ['if', 'else if', 'for', 'while', 'switch', 'catch', 'return']
  const trimmedStatement = statement.trim()

  for (const structure of controlStructures) {
    if (trimmedStatement.startsWith(`${structure} `) || trimmedStatement.startsWith(`${structure}{`) || trimmedStatement === structure) {
      return statement
    }
    if (trimmedStatement.includes(`} ${structure} `) || trimmedStatement.startsWith(`} ${structure} `)) {
      return statement
    }
  }
  if (trimmedStatement.startsWith('else ') || trimmedStatement.includes('} else ') || trimmedStatement === 'else' || trimmedStatement.startsWith('} else{')) {
    return statement
  }
  if (trimmedStatement.startsWith('do ') || trimmedStatement === 'do' || trimmedStatement.startsWith('do{')) {
    return statement
  }
  if (trimmedStatement.startsWith('try ') || trimmedStatement === 'try' || trimmedStatement.startsWith('try{')) {
    return statement
  }
  if (trimmedStatement.startsWith('(') && !trimmedStatement.match(/^\([^)]*\)\s*\(/)) {
    return statement
  }
  if (trimmedStatement.includes('?') && trimmedStatement.includes(':')) {
    return statement
  }

  const varTypes = ['const ', 'let ', 'var ']
  for (const varType of varTypes) {
    if (trimmedStatement.startsWith(varType)) {
      const pos = statement.indexOf('=')
      if (pos > 0) {
        const varDecl = statement.substring(0, pos + 1)
        const value = statement.substring(pos + 1).trim()
        if (value.startsWith('`') && value.endsWith('`')) {
          return statement
        }
        if (value.includes('?') && value.includes(':')) {
          return statement
        }
        if (value.includes('(') && value.includes(')') && !value.startsWith('(')) {
          const funcOrMethodMatch = value.match(/^([\w.]+)\(/)
          if (funcOrMethodMatch && asyncFunctions.includes(funcOrMethodMatch[1])) {
            return `${varDecl} await ${value}`
          }
        }
        return statement
      }
      return statement
    }
  }

  if (statement.includes('(') && statement.includes(')') && !statement.trim().startsWith('prompt(')) {
    const funcOrMethodMatch = statement.match(/^([\w.]+)\(/)
    if (funcOrMethodMatch && asyncFunctions.includes(funcOrMethodMatch[1])) {
      return `await ${statement}`
    }
  }
  return statement
}

/**
 * Process comment tags by removing them from the template.
 * @param {string} tag - The comment tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {void}
 */
export function processCommentTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): void {
  const regex = new RegExp(`${tag}[\\s\\r\\n]*`, 'g')
  context.templateData = context.templateData.replace(regex, '')
}

/**
 * Process note tags by replacing them with the note content.
 * @async
 * @param {string} tag - The note tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {Promise<void>}
 */
export async function processNoteTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): Promise<void> {
  context.templateData = context.templateData.replace(tag, await preProcessNote(tag))
}

/**
 * Process calendar tags by replacing them with the calendar note content.
 * @async
 * @param {string} tag - The calendar tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {Promise<void>}
 */
export async function processCalendarTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): Promise<void> {
  context.templateData = context.templateData.replace(tag, await preProcessCalendar(tag))
}

/**
 * Process return/carriage return tags by removing them.
 * @param {string} tag - The return tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {void}
 */
export function processReturnTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): void {
  context.templateData = context.templateData.replace(tag, '')
}

/**
 * Parses a code tag into its component parts (start delimiter, content, end delimiter).
 * @param {string} tag - The code tag to parse
 * @returns {{startDelim: string, rawCodeContent: string, endDelim: string} | null} The parsed components or null if parsing fails
 */
export function parseCodeTag(tag: string): { startDelim: string, rawCodeContent: string, endDelim: string } | null {
  // Regular tag parsing
  const tagPartsRegex = /^(<%(?:-|~|=|#|_)?)([^]*?)((?:-|~|_)?%>|_%>)$/ // Capture 1: start, 2: content, 3: end
  const match = tag.match(tagPartsRegex)

  if (!match) {
    logError(pluginJson, `parseCodeTag: Could not parse tag: ${tag}`)
    return null
  }

  return {
    startDelim: match[1],
    rawCodeContent: match[2],
    endDelim: match[3],
  }
}

/**
 * Normalizes the spacing in tag delimiters.
 * @param {string} startDelim - The opening delimiter
 * @param {string} endDelim - The closing delimiter
 * @returns {{normalizedStart: string, normalizedEnd: string}} The normalized delimiters
 */
export function normalizeTagDelimiters(startDelim: string, endDelim: string): { normalizedStart: string, normalizedEnd: string } {
  // Don't normalize whitespace control tags - they should be left exactly as they are
  if (startDelim.includes('_') || endDelim.includes('_')) {
    return { normalizedStart: startDelim, normalizedEnd: endDelim }
  }

  // Normalize opening tag spacing - ensure there's a space after <%, <%-, <%=
  // BUT NOT for comment tags (<%#) because that would break the comment functionality
  let normalizedStart = startDelim
  if (!startDelim.endsWith(' ') && !startDelim.includes('#')) {
    normalizedStart += ' '
  }

  // Normalize closing tag spacing - ensure there's a space before %>, -%>
  let normalizedEnd = endDelim
  if (!endDelim.startsWith(' ')) {
    normalizedEnd = ` ${endDelim}`
  }

  return { normalizedStart, normalizedEnd }
}

/**
 * Cleans up code content by removing unwanted returns and normalizing whitespace.
 * @param {string} rawCodeContent - The raw code content from the tag
 * @returns {string} The cleaned code content
 */
export function cleanCodeContent(rawCodeContent: string): string {
  // Find leading whitespace
  const leadingWhitespaceMatch = rawCodeContent.match(/^(\s*)/)
  const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : ''

  // Remove the leading whitespace temporarily
  const contentWithoutLeadingWhitespace = rawCodeContent.substring(leadingWhitespace.length)

  // Remove any newlines/returns at the start of the actual content
  const contentWithoutReturns = contentWithoutLeadingWhitespace.replace(/^[\r\n]+/, '')

  // Find trailing whitespace in the content after removing returns
  const contentBody = contentWithoutReturns.replace(/\s+$/, '') // Remove all trailing whitespace
  const trailingWhitespaceMatch = rawCodeContent.match(/(\s*)$/)
  const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[1] : ''

  // Reconstruct with normalized spacing: preserve one space at start and end if there was whitespace
  const leadingSpace = leadingWhitespace.includes(' ') || leadingWhitespace.includes('\t') ? ' ' : ''
  const trailingSpace = trailingWhitespace.includes(' ') || trailingWhitespace.includes('\t') ? ' ' : ''

  return leadingSpace + contentBody + trailingSpace
}

/**
 * Processes code lines by adding await prefixes where needed.
 * @param {string} codeContent - The code content to process
 * @param {Array<string>} asyncFunctions - List of function names that are known to be async
 * @returns {string} The processed code content
 */
export function processCodeLines(codeContent: string, asyncFunctions: Array<string>): string {
  const codeToProcess = codeContent.trim()
  const { protectedCode, literalMap } = protectTemplateLiterals(codeToProcess)
  const mergedProtectedCode = mergeMultiLineStatements(protectedCode)
  const lines = mergedProtectedCode.split('\n')
  const processedLines: Array<string> = []

  for (let line of lines) {
    line = line.trim()
    if (line.length === 0 && lines.length > 1) {
      processedLines.push('')
      continue
    }
    if (line.length === 0) {
      continue
    }

    if (line.includes(';')) {
      const processedLine = processSemicolonSeparatedStatements(line, asyncFunctions)
      processedLines.push(processedLine)
    } else {
      processedLines.push(processStatementForAwait(line, asyncFunctions))
    }
  }

  const finalProtectedCodeContent = processedLines.join('\n')
  return restoreTemplateLiterals(finalProtectedCodeContent, literalMap)
}

/**
 * Processes a line containing semicolon-separated statements.
 * @param {string} line - The line to process
 * @param {Array<string>} asyncFunctions - List of function names that are known to be async
 * @returns {string} The processed line
 */
export function processSemicolonSeparatedStatements(line: string, asyncFunctions: Array<string>): string {
  // Special case: if original line was just semicolons, return as-is
  if (line.replace(/;/g, '').trim() === '') {
    return line
  }

  const statements = line.split(';')
  const processedStatements: Array<string> = []

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim()
    // Process non-empty statements
    if (statement.length > 0) {
      processedStatements.push(processStatementForAwait(statement, asyncFunctions))
    } else {
      // Keep empty statements for proper semicolon reconstruction
      processedStatements.push('')
    }
  }

  // Join with semicolons, preserving the original structure
  let result = processedStatements.join(';')

  // Handle spacing: add space after semicolons except for consecutive semicolons
  result = result.replace(/;(?=[^;])/g, '; ')

  return result
}

/**
 * Reconstructs a code tag from its processed components.
 * @param {string} startDelim - The start delimiter
 * @param {string} codeContent - The processed code content
 * @param {string} endDelim - The end delimiter
 * @returns {string} The reconstructed tag
 */
export function reconstructCodeTag(startDelim: string, codeContent: string, endDelim: string): string {
  return `${startDelim}${codeContent}${endDelim}`
}

/**
 * Process code tags by adding await prefix to function calls that need it.
 * Also normalizes tag spacing and removes unwanted returns.
 * @param {string} tag - The code tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @param {Array<string>} asyncFunctions - List of function names that are known to be async
 * @returns {void}
 */
export function processCodeTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }, asyncFunctions: Array<string>): void {
  // Step 1: Parse the tag into its components
  const parsedTag = parseCodeTag(tag)
  if (!parsedTag) {
    return
  }

  const { startDelim, rawCodeContent, endDelim } = parsedTag

  // Step 2: Normalize tag delimiters
  const { normalizedStart, normalizedEnd } = normalizeTagDelimiters(startDelim, endDelim)

  // Step 3: Clean up the code content
  const cleanedCodeContent = cleanCodeContent(rawCodeContent)

  // Step 4: Process the code lines for await statements
  const processedCodeContent = processCodeLines(cleanedCodeContent, asyncFunctions)

  // Step 5: Reconstruct the final tag
  const newTag = reconstructCodeTag(normalizedStart, processedCodeContent, normalizedEnd)

  // Step 6: Replace the original tag if it changed
  if (tag !== newTag) {
    context.templateData = context.templateData.replace(tag, newTag)
  }
}

/**
 * Extracts the content between the outer parentheses of a tag,
 * preserving template strings and other content within quotes.
 * @param {string} tag - The tag to parse
 * @returns {string|null} The extracted content or null if parsing fails
 */
function extractTagContent(tag: string): string | null {
  // Find the outer parentheses first
  const openParenIndex = tag.indexOf('(')
  const closeParenIndex = tag.lastIndexOf(')')

  if (openParenIndex === -1 || closeParenIndex === -1 || openParenIndex >= closeParenIndex) {
    return null
  }

  // Extract content between parentheses, preserving template strings and other content
  const content = tag.substring(openParenIndex + 1, closeParenIndex).trim()
  return content || null
}

/**
 * Extracts the content between the outer parentheses of an include/template tag,
 * preserving template strings and other content within quotes.
 * @param {string} tag - The include tag to parse
 * @returns {string|null} The extracted content or null if parsing fails
 */
function extractIncludeContent(tag: string): string | null {
  return extractTagContent(tag)
}

/**
 * Evaluates template strings in a string by replacing ${var} with values from session data.
 * Supports nested object properties like user.name.
 * @param {string} templateString - The string containing template expressions
 * @param {Object} sessionData - The session data containing variables
 * @returns {string} The string with template expressions evaluated
 */
function evaluateTemplateStrings(templateString: string, sessionData: Object): string {
  if (!templateString.includes('${') || !sessionData) {
    return templateString
  }

  try {
    // Simple template string evaluation - replace ${var} with values from session data
    return templateString.replace(/\${([^}]+)}/g, (match, expression) => {
      // Handle nested object properties like user.name
      const parts = expression.split('.')
      let value = sessionData

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part]
        } else {
          // If any part is missing, return the original expression
          return match
        }
      }

      return value !== undefined ? String(value) : match
    })
  } catch (error) {
    logDebug(`Error evaluating template string: ${error}`)
    // If evaluation fails, keep the original string
    return templateString
  }
}

/**
 * Process include/template tags by replacing them with the included template content.
 * Handles variable assignment and frontmatter rendering.
 * @async
 * @param {string} tag - The include tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {Promise<void>}
 */
export async function processIncludeTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): Promise<void> {
  if (isCommentTag(tag)) return

  // Extract the content between the outer parentheses, preserving template strings and other content
  const includeInfo = extractIncludeContent(tag)

  if (!includeInfo) {
    context.templateData = context.templateData.replace(tag, '**Unable to parse include**')
    return
  }

  const parts = includeInfo.split(',')

  let templateName = parts[0].trim()

  // Remove outer quotes only (single quotes, double quotes, or backticks)
  // but preserve quotes inside template expressions
  if (
    (templateName.startsWith("'") && templateName.endsWith("'")) ||
    (templateName.startsWith('"') && templateName.endsWith('"')) ||
    (templateName.startsWith('`') && templateName.endsWith('`'))
  ) {
    templateName = templateName.slice(1, -1)
  }
  const templateData = parts.length >= 1 ? parts[1] : {}

  // Evaluate template strings in the template name if they exist
  templateName = evaluateTemplateStrings(templateName, context.sessionData)

  logDebug(`processIncludeTag templateName: ${templateName}`)
  const templateContent = await getTemplate(templateName, { silent: true })
  const hasFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateContent)
  const isCalendarNote = /^\d{8}|\d{4}-\d{2}-\d{2}$/.test(templateName)

  if (hasFrontmatter && !isCalendarNote) {
    // if the included file has frontmatter, we need to renderFrontmatter it because it could be a template
    const { frontmatterAttributes, frontmatterBody } = await processFrontmatterTags(templateContent, context.sessionData)
    context.sessionData = { ...frontmatterAttributes }
    logDebug(pluginJson, `processIncludeTag: ${tag} frontmatterAttributes: ${JSON.stringify(frontmatterAttributes, null, 2)}`)
    const renderedTemplate = await render(frontmatterBody, context.sessionData)

    // Handle variable assignment
    if (tag.includes('const') || tag.includes('let')) {
      const pos = tag.indexOf('=')
      if (pos > 0) {
        const temp = tag
          .substring(0, pos - 1)
          .replace('<%', '')
          .trim()
        const varParts = temp.split(' ')
        context.override[varParts[1]] = renderedTemplate
        context.templateData = context.templateData.replace(tag, '')
      }
    } else {
      context.templateData = context.templateData.replace(tag, renderedTemplate)
    }
  } else {
    // this is a regular, non-frontmatter note (regular note or calendar note)
    // Handle special case for calendar data
    if (isCalendarNote) {
      const calendarData = await preProcessCalendar(templateName)
      context.templateData = context.templateData.replace(tag, calendarData)
    } else {
      context.templateData = context.templateData.replace(tag, await preProcessNote(templateName))
    }
  }
}

/**
 * Process variable declaration tags by extracting variable assignments to session data.
 * @param {string} tag - The variable tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @returns {void}
 */
export function processVariableTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }): void {
  if (!context.sessionData) {
    return
  }

  const tempTag = tag.replace('const', '').replace('let', '').trimLeft().replace('<%', '').replace('-%>', '').replace('%>', '')

  const pos = tempTag.indexOf('=')
  if (pos <= 0) {
    return
  }

  const varName = tempTag.substring(0, pos - 1).trim()
  let value = tempTag.substring(pos + 1).trim()

  // Determine value type and process accordingly
  if (getValueType(value) === 'string') {
    value = replaceSmartQuotes(value.replace(/^["'](.*)["']$/, '$1').trim()) // Remove outer quotes and handle smart quotes
  } else if (getValueType(value) === 'array' || getValueType(value) === 'object') {
    // For objects and arrays, preserve the exact structure including quotes
    // Just clean up any extra quotes that might be around the entire object/array
    value = replaceSmartQuotes(value.replace(/^["'](.*)["']$/, '$1').trim())
  }

  context.sessionData[varName] = value
}

/**
 * Helper method to determine the type of a value from its string representation.
 * @param {string} value - The string value to analyze
 * @returns {string} The determined type ('array', 'object', or 'string')
 */
export function getValueType(value: string): string {
  if (value.includes('[')) {
    return 'array'
  }

  if (value.includes('{')) {
    return 'object'
  }

  return 'string'
}

/**
 * Preprocesses a 'note' tag in a template.
 * Replaces the tag with the content of the referenced note.
 * @async
 * @param {string} [tag=''] - The note tag to process
 * @returns {Promise<string>} A promise that resolves to the preprocessed content
 */
export async function preProcessNote(tag: string = ''): Promise<string> {
  if (!isCommentTag(tag)) {
    const includeInfo = tag.replace('<%-', '').replace('%>', '').replace('note', '').replace('(', '').replace(')', '')
    const parts = includeInfo.split(',')
    if (parts.length > 0) {
      const noteNamePath = replaceSmartQuotes(parts[0].replace(/'/gi, '').trim())
      const content = await getNote(noteNamePath)
      if (content.length > 0) {
        // Apply smart quote replacement to note content
        return replaceSmartQuotes(content)
      } else {
        return `**An error occurred loading note "${noteNamePath}"**`
      }
    } else {
      return `**An error occurred process note**`
    }
  }

  return ''
}

/**
 * Preprocesses a 'calendar' tag in a template.
 * Replaces the tag with the content of the referenced calendar note.
 * @async
 * @param {string} [tag=''] - The calendar tag to process
 * @returns {Promise<string>} A promise that resolves to the preprocessed content
 */
export async function preProcessCalendar(tag: string = ''): Promise<string> {
  if (!isCommentTag(tag)) {
    const includeInfo = tag.replace('<%-', '').replace('%>', '').replace('calendar', '').replace('(', '').replace(')', '')
    const parts = includeInfo.split(',')
    if (parts.length > 0) {
      const noteNameWithPossibleDashes = replaceSmartQuotes(parts[0].replace(/['`]/gi, '').trim())
      // Remove dashes for DataStore lookup
      const noteName = noteNameWithPossibleDashes.replace(/-/g, '')
      logDebug(pluginJson, `preProcessCalendar: Looking up calendar note for: ${noteName} (original: ${noteNameWithPossibleDashes})`)
      const calendarNote = await DataStore.calendarNoteByDateString(noteName)
      if (typeof calendarNote !== 'undefined') {
        // $FlowIgnore
        return calendarNote.content
      } else {
        return `**An error occurred loading note "${noteName}"**`
      }
    } else {
      return `**An error occurred process note**`
    }
  }
  return ''
}

/**
 * Formats a template error message with consistent styling.
 * @param {string} method - The method name where the error occurred
 * @param {any} message - The error message or object
 * @returns {string} Formatted error message
 */
export function templateErrorMessage(method: string = '', message: any = ''): string {
  if (message?.name?.indexOf('YAMLException') >= 0) {
    return _frontmatterError(message)
  }

  const line = '*'.repeat(message.length + 30)
  logDebug(line)
  logDebug(`   ERROR`)
  logDebug(`   Method: ${method}:`)
  logDebug(`   Message: ${message}`)
  logDebug(line)
  logDebug('\n')
  return `**Error: ${method}**\n- **${message}**`
}

/**
 * Formats frontmatter-related error messages to be more user-friendly.
 * Specifically handles common YAML parsing errors in templates.
 * @private
 * @param {any} error - The error object from the YAML parser
 * @returns {string} Formatted error message string
 */
function _frontmatterError(error: any): string {
  if (error.reason === 'missed comma between flow collection entries') {
    return `**Frontmatter Template Parsing Error**\n\nWhen using template tags in frontmatter attributes, the entire block must be wrapped in quotes\n${error.mark}`
  }
  return error
}

/**
 * Removes whitespace from fenced code blocks in a string.
 * This was originally used to clean up code blocks in template output,
 * but has been modified to preserve code blocks as users may want them in templates.
 * @private
 * @param {string} [str=''] - The string containing code blocks to process
 * @returns {string} The string with whitespace removed from code blocks
 */
function _removeWhitespaceFromCodeBlocks(str: string = ''): string {
  let result = str
  getCodeBlocks(str).forEach((codeBlock) => {
    let newCodeBlock = codeBlock
    newCodeBlock = newCodeBlock.replace('```javascript\n', '').replace(/```/gi, '').replace(/\n\n/gi, '').replace(/\n/gi, '')
    result = result.replace(codeBlock, newCodeBlock)
  })

  return result.replace(/\n\n\n/gi, '\n')
}

/**
 * Filters and cleans up template result content, specifically removing EJS-related error messages
 * that are not relevant to NotePlan templates because we have diverged from stock EJS
 * Performs various replacements to clean up template output, including:
 * - Removing EJS-related error messages
 * - Replacing certain URLs with more NotePlan-friendly references
 * - Adding helpful information for template syntax when errors are detected
 * @param {string} [templateResult=''] - The rendered template result to filter
 * @returns {string} The filtered template result
 */
export function removeEJSDocumentationNotes(templateResult: string = ''): string {
  let result = templateResult
  result = result.replace('If the above error is not helpful, you may want to try EJS-Lint:', '')
  result = result.replace('https://github.com/RyanZim/EJS-Lint', 'HTTP_REMOVED')
  if (result.includes('HTTP_REMOVED')) {
    result += '\nFor more information on proper template syntax, refer to:\n'
    result += 'https://noteplan.co/templates/docs\n'
    result = result.replace('HTTP_REMOVED', '')
  }
  return result
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
  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `getErrorContextString: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    return `**Error context error: templateData is not a string (${typeof templateData})**`
  }

  const lines = templateData.split('\n')

  // Ensure the line number is valid
  let lineNumber = originalLineNumber
  if (!lineNumber || lineNumber < 1 || lineNumber > lines.length) {
    // Try to find the line containing the match
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(matchStr)) {
        lineNumber = i + 1
        break
      }
    }
  }

  // If we still don't have a valid line number, default to line 1
  if (!lineNumber || lineNumber < 1 || lineNumber > lines.length) {
    lineNumber = 1
  }

  // Show 3 lines before and after for context
  const start = Math.max(lineNumber - 3, 0)
  const end = Math.min(lines.length, lineNumber + 3)

  // Build context with line numbers and a pointer to the error line
  const context = lines
    .slice(start, end)
    .map((line, i) => {
      const currLineNum = i + start + 1
      // Add a '>> ' indicator for the error line
      return `${(currLineNum === lineNumber ? ' >> ' : '    ') + currLineNum}| ${line}`
    })
    .join('\n')

  return context
}

/**
 * Processes various tags in the template data that will add variables/values to the session data
 * to be used later in the template processing.
 * @async
 * @param {string} templateData - The template string to process
 * @param {Object} [sessionData={}] - Data available during processing
 * @returns {Promise<{newTemplateData: string, newSettingData: Object}>} Processed template data, updated session data
 */
export async function preProcessTags(_templateData: string, sessionData?: {} = {}): Promise<{ newTemplateData: string, newSettingData: Object }> {
  // Ensure templateData is a string
  let templateData = _templateData
  if (typeof _templateData !== 'string') {
    logDebug(pluginJson, `preProcessTags: templateData is not a string: ${typeof _templateData} - ${String(_templateData).substring(0, 100)}`)
    templateData = typeof _templateData === 'undefined' || _templateData === null ? '' : String(_templateData)
  }

  // Initialize the processing context
  const context = {
    templateData: templateData || '',
    sessionData: { ...sessionData },
    override: {},
  }

  // Handle null/undefined gracefully
  if (context.templateData === null || context.templateData === undefined) {
    return {
      newTemplateData: '',
      newSettingData: context.sessionData,
    }
  }

  // Get all template tags
  const tags = (await getTags(context.templateData)) || []

  // First pass: Process all comment tags
  for (const tag of tags) {
    if (isCommentTag(tag)) {
      processCommentTag(tag, context)
    }
  }

  // Second pass: Process remaining tags
  const remainingTags = (await getTags(context.templateData)) || []
  for (const tag of remainingTags) {
    if (tag.includes('note(')) {
      await processNoteTag(tag, context)
      continue
    }

    if (tag.includes('calendar(')) {
      await processCalendarTag(tag, context)
      continue
    }

    if (tag.includes('include(') || tag.includes('template(')) {
      await processIncludeTag(tag, context)
      continue
    }

    if (tag.includes(':return:') || tag.toLowerCase().includes(':cr:')) {
      processReturnTag(tag, context)
      continue
    }

    // Process code tags that need await prefixing and other cleaning up
    if (isCode(tag) && tag.includes('(')) {
      processCodeTag(tag, context, globalAsyncFunctions)
      continue
    }

    // Extract variables - but only for simple value assignments, not function calls
    if (tag.includes('const') || tag.includes('let') || tag.includes('var')) {
      // Check if this is a function call assignment by looking for parentheses in the value
      const tempTag = tag
        .replace(/<%(-|=|~)?/, '')
        .replace(/%>/, '')
        .trim()

      const assignmentMatch = tempTag.match(/^\s*(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/i)

      if (assignmentMatch) {
        const varType = assignmentMatch[1]
        const varName = assignmentMatch[2]
        const value = assignmentMatch[3].trim()

        // If the value contains function calls (parentheses), skip processing and leave in template
        if (value.includes('(') && value.includes(')')) {
          continue
        }
      }

      // Only process simple value assignments
      processVariableTag(tag, context)
      continue
    }
  }

  // Merge override variables into session data
  context.sessionData = { ...context.sessionData, ...context.override }

  // Return the processed data
  return {
    newTemplateData: context.templateData,
    newSettingData: context.sessionData,
  }
}

/**
 * Pre-renders template frontmatter attributes, processing template tags within frontmatter.
 * Ensures proper frontmatter structure and handles templates without frontmatter.
 * @async
 * @param {string} [_templateData=''] - The template data to renderFrontmatter
 * @param {any} [userData={}] - User data to use in template rendering
 * @returns {Promise<{frontmatterBody: string, frontmatterAttributes: Object}>} Processed frontmatter body and attributes
 */
export async function processFrontmatterTags(_templateData: string = '', userData: any = {}): Promise<any> {
  // Ensure _templateData is a string
  if (typeof _templateData !== 'string') {
    logDebug(pluginJson, `processFrontmatterTags: _templateData is not a string: ${typeof _templateData} - ${String(_templateData).substring(0, 100)}`)
    _templateData = String(_templateData)
  }

  // Log the initial state
  logProgress('FRONTMATTER PROCESSING START', _templateData, userData)

  let templateData = _templateData
  const sectionData = { ...userData }

  // Step 1: Check if template has frontmatter and add if missing
  if (!new FrontmatterModule().isFrontmatterTemplate(templateData)) {
    const extractedData = extractTitleFromMarkdown(templateData)
    if (!extractedData.title) extractedData.title = 'Untitled (no title found in template)'
    templateData = `---\ntitle: ${extractedData.title}\n---\n${extractedData.updatedMarkdown}`
  }
  logProgress('Frontmatter Step 1 complete: Structure validation/creation', templateData, sectionData)

  // Step 2: Parse frontmatter and extract attributes
  const frontmatterData = new FrontmatterModule().parse(templateData)
  const frontmatterAttributes = frontmatterData?.attributes || {}
  const data = { frontmatter: frontmatterAttributes }
  const frontmatterBody = frontmatterData.body
  const attributeKeys = Object.keys(frontmatterAttributes)
  logProgress('Frontmatter Step 2 complete: Parsing and attribute extraction', frontmatterBody, { frontmatterAttributes, sectionData })

  // Step 3: Process each frontmatter attribute for template tags
  for (const item of attributeKeys) {
    const value = frontmatterAttributes[item]
    const attributeValue = typeof value === 'string' && value.includes('<%') ? await render(value, sectionData) : value
    sectionData[item] = attributeValue
    frontmatterAttributes[item] = attributeValue
  }
  logProgress('Frontmatter Step 3 complete: Attribute processing complete', frontmatterBody, { frontmatterAttributes: { ...userData, ...frontmatterAttributes } })

  // Ensure frontmatterBody is a string
  let safeFrontmatterBody = frontmatterBody
  if (typeof frontmatterBody !== 'string') {
    logDebug(pluginJson, `processFrontmatterTags: frontmatterBody is not a string: ${typeof frontmatterBody} - ${String(frontmatterBody).substring(0, 100)}`)
    safeFrontmatterBody = String(frontmatterBody)
  }

  const result = { frontmatterBody: safeFrontmatterBody, frontmatterAttributes: { ...userData, ...frontmatterAttributes } }
  logProgress(`FRONTMATTER PROCESSING COMPLETE; keys: [${Object.keys(result.frontmatterAttributes).toString()}]`, safeFrontmatterBody, result.frontmatterAttributes)

  // Add detailed logging for debugging
  logDebug(pluginJson, `processFrontmatterTags: Returning frontmatterBody with ${safeFrontmatterBody.length} chars: "${safeFrontmatterBody.substring(0, 200)}..."`)
  logDebug(pluginJson, `processFrontmatterTags: Returning frontmatterAttributes: ${JSON.stringify(result.frontmatterAttributes)}`)

  return result
}

/**
 * Processes import tags in a template, replacing them with the content of referenced templates.
 * @async
 * @param {string} [templateData=''] - The template data containing import tags
 * @param {Object} [sessionData={}] - Session data for template string evaluation
 * @returns {Promise<string>} A promise that resolves to the processed template with imports resolved
 */
export async function importTemplates(templateData: string = '', sessionData: Object = {}): Promise<string> {
  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `importTemplates: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    templateData = String(templateData)
  }

  let newTemplateData = templateData
  const tags = (await getTags(templateData)) || []
  for (const tag of tags) {
    if (!isCommentTag(tag) && tag.includes('import(')) {
      // Extract the content between parentheses, preserving template strings
      const importInfo = extractTagContent(tag)

      if (!importInfo) {
        newTemplateData = newTemplateData.replace(tag, '**Unable to parse import**')
        continue
      }

      const parts = importInfo.split(',')
      if (parts.length > 0) {
        let noteNamePath = parts[0].trim()

        // Remove outer quotes only (single quotes, double quotes, or backticks)
        // but preserve quotes inside template expressions
        if (
          (noteNamePath.startsWith("'") && noteNamePath.endsWith("'")) ||
          (noteNamePath.startsWith('"') && noteNamePath.endsWith('"')) ||
          (noteNamePath.startsWith('`') && noteNamePath.endsWith('`'))
        ) {
          noteNamePath = noteNamePath.slice(1, -1)
        }

        // Evaluate template strings in the template name if they exist
        noteNamePath = evaluateTemplateStrings(noteNamePath, sessionData)

        const content = await getTemplate(noteNamePath)
        // Ensure content is a string
        if (typeof content !== 'string') {
          logDebug(pluginJson, `importTemplates: getTemplate returned non-string content: ${typeof content} - ${String(content).substring(0, 100)}`)
          newTemplateData = newTemplateData.replace(tag, `**Error importing "${noteNamePath}": Invalid content type**`)
          continue
        }

        const body = new FrontmatterModule().body(content)
        if (body.length > 0) {
          // Apply smart quote replacement to imported content
          const normalizedBody = replaceSmartQuotes(body)
          newTemplateData = newTemplateData.replace(`\`${tag}\``, normalizedBody) // adjust fenced formats
          newTemplateData = newTemplateData.replace(tag, normalizedBody)
        } else {
          newTemplateData = newTemplateData.replace(tag, `**An error occurred importing "${noteNamePath}"**`)
        }
      }
    }
  }

  // Ensure we always return a string
  if (typeof newTemplateData !== 'string') {
    logDebug(pluginJson, `importTemplates: newTemplateData is not a string: ${typeof newTemplateData} - ${String(newTemplateData).substring(0, 100)}`)
    return String(newTemplateData)
  }

  return newTemplateData
}

/**
 * Validates EJS tags in the template data for proper opening and closing.
 * @param {string} templateData - The template data to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export function validateTemplateTags(templateData: string): string | null {
  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `validateTemplateTags: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    return `**Template validation error: templateData is not a string (${typeof templateData})**`
  }

  const lines = templateData.split('\n')
  let openTags = 0
  let closeTags = 0
  let lastUnclosedLine = 0
  let lastUnclosedContent = ''

  // Count opening and closing tags
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const openCount = (line.match(/<%/g) || []).length
    const closeCount = (line.match(/%>/g) || []).length

    openTags += openCount
    closeTags += closeCount

    // Track the last unclosed tag
    if (openCount > closeCount) {
      lastUnclosedLine = i + 1
      lastUnclosedContent = line
    }

    // Check for unmatched closing tags
    if (closeTags > openTags) {
      // Get context around the error
      const start = Math.max(i - 4, 0)
      const end = Math.min(lines.length, i + 3)
      const context = lines
        .slice(start, end)
        .map((line, idx) => {
          const curr = idx + start + 1
          return `${(curr === i + 1 ? '>> ' : '   ') + curr}| ${line}`
        })
        .join('\n')

      return formatTemplateError('unmatched closing tag', i + 1, context, '(showing the line where a closing tag was found without a matching opening tag)')
    }
  }

  // Check for unclosed tags at the end
  if (openTags > closeTags) {
    // Get context around the error
    const start = Math.max(lastUnclosedLine - 4, 0)
    const end = Math.min(lines.length, lastUnclosedLine + 3)
    const context = lines
      .slice(start, end)
      .map((line, idx) => {
        const curr = idx + start + 1
        return `${(curr === lastUnclosedLine ? '>> ' : '   ') + curr}| ${line}`
      })
      .join('\n')

    return formatTemplateError('unclosed tag', lastUnclosedLine, context, '(showing the line where a tag was opened but not closed)')
  }

  // Check for any remaining unmatched closing tags at the end
  if (closeTags > openTags) {
    const lastLine = lines.length
    const context = lines
      .slice(Math.max(0, lastLine - 4), lastLine)
      .map((line, idx) => {
        const curr = lastLine - 4 + idx + 1
        return `${(curr === lastLine ? '>> ' : '   ') + curr}| ${line}`
      })
      .join('\n')

    return formatTemplateError('unmatched closing tag', lastLine, context, '(showing the line where a closing tag was found without a matching opening tag)')
  }

  return null
}

/**
 * Validates template syntax and ensures all tags are properly matched.
 * @param {string} templateData - The template to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
function validateTemplateStructure(templateData: string): string | null {
  return validateTemplateTags(templateData)
}

/**
 * Normalizes template data by fixing smart quotes and ensuring string format.
 * @param {string} templateData - The template data to normalize
 * @returns {string} Normalized template data
 */
function normalizeTemplateData(templateData: string): string {
  if (!templateData) {
    return ''
  }

  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `normalizeTemplateData: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    templateData = String(templateData)
  }

  let normalizedData = templateData

  // Handle smart quotes from iOS and other platforms
  normalizedData = replaceSmartQuotes(normalizedData)

  // Ensure we're working with a string
  if (typeof normalizedData !== 'string') {
    normalizedData = normalizedData.toString()
  }

  // Convert legacy shorthand template prompt tag to `prompt` command
  normalizedData = normalizedData.replace(/<%@/gi, '<%- prompt')

  return normalizedData
}

/**
 * Checks if a template appears to be a meeting note template by looking for meeting-specific variables.
 * @param {string} templateData - The template content to analyze
 * @returns {boolean} True if the template contains meeting note variables
 */
function isMeetingNoteTemplate(templateData: string): boolean {
  const meetingNoteVariables = [
    'eventTitle',
    'eventNotes',
    'eventLink',
    'calendarItemLink',
    'eventAttendees',
    'eventAttendeeNames',
    'eventLocation',
    'eventCalendar',
    'eventDateValue',
    'eventEndDateValue',
  ]

  // Check if any meeting note variables are referenced in the template
  return meetingNoteVariables.some((varName) => {
    // Match the variable name as a standalone variable or as a function call
    const pattern = new RegExp(`<%[-=~]?\\s*${varName}(?:\\s*\\([^)]*\\))?\\s*[-~]?%>`, 'g')
    return pattern.test(templateData)
  })
}

/**
 * Validates that meeting note templates have the required event data.
 * @param {string} templateData - The template content to validate
 * @param {Object} sessionData - The session data containing available variables
 * @returns {string|null} Error message if validation fails, null if validation passes
 */
function validateMeetingNoteTemplate(templateData: string, sessionData: Object): string | null {
  // Only check if this appears to be a meeting note template
  if (!isMeetingNoteTemplate(templateData)) {
    return null
  }

  const meetingNoteVariables = [
    'eventTitle',
    'eventNotes',
    'eventLink',
    'calendarItemLink',
    'eventAttendees',
    'eventAttendeeNames',
    'eventLocation',
    'eventCalendar',
    'eventDateValue',
    'eventEndDateValue',
  ]

  const sessionDataKeys = Object.keys(sessionData)
  const missingVariables = meetingNoteVariables.filter((varName) => {
    // Check if the variable is referenced in the template (as standalone or function call)
    const pattern = new RegExp(`<%[-=~]?\\s*${varName}(?:\\s*\\([^)]*\\))?\\s*[-~]?%>`, 'g')
    const isReferenced = pattern.test(templateData)

    // If referenced but not available in session data, it's missing
    return isReferenced && !sessionDataKeys.includes(varName)
  })

  if (missingVariables.length > 0) {
    const missingVarsList = missingVariables.join(', ')
    const availableVarsList = sessionDataKeys.length > 0 ? sessionDataKeys.join(', ') : 'none'
    logDebug(pluginJson, `validateMeetingNoteTemplate failed: missingVariables=[${missingVarsList}] availableVars=[${availableVarsList}]`)
    clo(sessionData.methods, 'validateMeetingNoteTemplate: sessionData.methods')
    clo(sessionData.data, 'validateMeetingNoteTemplate: sessionData.data')

    return `**Template validation failed**: The template you ran is designed to run on calendar events, but was run outside of that context. The following variables are referenced in the template but not available: **${missingVarsList}**\nThis typically happens when running meeting note templates without proper event data. **Please ensure you have selected an event or provided the necessary data.**`
  }

  return null
}

/**
 * Loads global helper functions into session data.
 * @param {Object} sessionData - The session data to enhance
 * @returns {Object} Enhanced session data with global helpers
 */
function loadGlobalHelpers(sessionData: Object): Object {
  let enhancedData = { ...sessionData }

  // Load template globals
  const globalData: { [key: string]: any } = {}
  Object.getOwnPropertyNames(globals).forEach((key) => {
    globalData[key] = getProperyValue(globals, key)
  })

  enhancedData.methods = { ...enhancedData.methods, ...globalData }

  // Restore event date methods that may have been dropped during serialization
  enhancedData = restoreEventDateMethods(enhancedData)

  return enhancedData
}

/**
 * Detects if frontmatter processing resulted in errors by checking session data for error messages
 * @param {Object} sessionData - The session data after frontmatter processing
 * @param {string} originalTemplateData - The original template data before processing
 * @returns {Array<{phase: string, error: string, context: string}>} Array of detected errors
 */
function detectFrontmatterErrors(sessionData: any, originalTemplateData: string): Array<{ phase: string, error: string, context: string }> {
  const errors = []

  // Check session data for error messages
  for (const [key, value] of Object.entries(sessionData)) {
    if (typeof value === 'string') {
      const valueStr = String(value)
      if (
        valueStr.includes('==**Templating Error Found**') ||
        valueStr.includes('Template Rendering Error') ||
        valueStr.includes('Error:') ||
        valueStr.includes('SyntaxError:') ||
        valueStr.includes('ReferenceError:')
      ) {
        errors.push({
          phase: 'Frontmatter Processing',
          error: `Variable "${key}" contains error:\n${valueStr.substring(0, 200)}${valueStr.length > 200 ? '...' : ''}`,
          context: `This error occurred while processing frontmatter in the original template.`,
        })
      }
    }
  }

  return errors
}

/**
 * Handles frontmatter processing for templates with frontmatter.
 * @async
 * @param {string} templateData - The template data with frontmatter
 * @param {Object} sessionData - Current session data
 * @param {Object} userOptions - User options for rendering
 * @param {TemplatingEngine} templatingEngine - The templating engine instance to use
 * @returns {Promise<{templateData: string, sessionData: Object}>} Updated template and session data
 */
async function processFrontmatter(
  templateData: string,
  sessionData: Object,
  userOptions: Object,
  templatingEngine: TemplatingEngine,
): Promise<{ templateData: string, sessionData: Object }> {
  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `processFrontmatter: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    templateData = String(templateData)
  }

  const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
  if (!isFrontmatterTemplate) {
    return { templateData, sessionData }
  }

  // Pre-render frontmatter attributes
  const { frontmatterAttributes, frontmatterBody } = await processFrontmatterTags(templateData, sessionData)
  const updatedSessionData = {
    ...sessionData,
    data: { ...sessionData.data, ...frontmatterAttributes },
  }

  // Process frontmatter attribute prompts
  let updatedTemplateData = templateData
  const attributes = new FrontmatterModule().parse(templateData)?.attributes || {}

  let newSessionData = updatedSessionData

  for (const [key, value] of Object.entries(attributes)) {
    let frontMatterValue = value
    const promptData = await processPrompts(value, updatedSessionData)

    if (promptData === false) {
      return { templateData: '', sessionData: updatedSessionData }
    }

    frontMatterValue = promptData.sessionTemplateData

    const { newTemplateData, newSettingData } = await preProcessTags(frontMatterValue, updatedSessionData)

    const mergedSessionData = { ...updatedSessionData, ...newSettingData }
    const renderedData = await templatingEngine.render(newTemplateData, promptData.sessionData, userOptions)
    updatedTemplateData = updatedTemplateData.replace(`${key}: ${value}`, `${key}: ${renderedData}`)
    newSessionData = mergedSessionData
  }

  // Ensure frontmatterBody is a string
  let safeFrontmatterBody = frontmatterBody
  if (typeof frontmatterBody !== 'string') {
    logDebug(pluginJson, `processFrontmatter: frontmatterBody is not a string: ${typeof frontmatterBody} - ${String(frontmatterBody).substring(0, 100)}`)
    safeFrontmatterBody = String(frontmatterBody)
  }

  return { templateData: safeFrontmatterBody, sessionData: newSessionData }
}

/**
 * Processes prompts in the template body.
 * @async
 * @param {string} templateData - The template data to process
 * @param {Object} sessionData - Current session data
 * @returns {Promise<{templateData: string, sessionData: Object}|false>} Updated template and session data, or false if canceled
 */
async function processTemplatePrompts(templateData: string, sessionData: Object): Promise<{ templateData: string, sessionData: Object } | false> {
  // Ensure templateData is a string
  if (typeof templateData !== 'string') {
    logDebug(pluginJson, `processTemplatePrompts: templateData is not a string: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
    templateData = String(templateData)
  }

  const promptData = await processPrompts(templateData, sessionData)

  if (promptData === false) {
    return false
  }

  // Ensure sessionTemplateData is a string
  if (typeof promptData.sessionTemplateData !== 'string') {
    logDebug(
      pluginJson,
      `processTemplatePrompts: promptData.sessionTemplateData is not a string: ${typeof promptData.sessionTemplateData} - ${String(promptData.sessionTemplateData).substring(
        0,
        100,
      )}`,
    )
    promptData.sessionTemplateData = String(promptData.sessionTemplateData)
  }

  return {
    templateData: promptData.sessionTemplateData,
    sessionData: promptData.sessionData,
  }
}

/**
 * Handles code blocks that should be ignored (not processed) in the template, temporarily protecting them during processing.
 * @param {string} templateData - The template data with code blocks
 * @returns {{templateData: string, codeBlocks: Array<string>}} Template with placeholders and original blocks
 */
function tempSaveIgnoredCodeBlocks(templateData: string): { templateData: string, codeBlocks: Array<string> } {
  const ignoredCodeBlocks = getIgnoredCodeBlocks(templateData)
  let processedTemplate = templateData

  for (let index = 0; index < ignoredCodeBlocks.length; index++) {
    processedTemplate = processedTemplate.replace(ignoredCodeBlocks[index], `__codeblock:${index}__`)
  }

  return {
    templateData: processedTemplate,
    codeBlocks: ignoredCodeBlocks,
  }
}

/**
 * Restores protected code blocks in the rendered template.
 * @param {string} templateData - The rendered template with code block placeholders
 * @param {Array<string>} codeBlocks - The original code blocks
 * @returns {string} Template with restored code blocks
 */
function restoreCodeBlocks(templateData: string, codeBlocks: Array<string>): string {
  let result = templateData

  for (let index = 0; index < codeBlocks.length; index++) {
    result = result.replace(`__codeblock:${index}__`, codeBlocks[index])
  }

  return result
}

const isQuickTemplateNote = (userOptions: any): boolean => Boolean(userOptions?.qtn)

/**
 * Internal template rendering function with configuration support.
 * This is the actual implementation that accepts templateConfig.
 * @async
 * @param {string} inputTemplateData - The template content to render
 * @param {any} [userData={}] - User data to use in template rendering
 * @param {any} [userOptions={}] - Options for template rendering
 * @param {any} [templateConfig={}] - Template configuration including helper modules
 * @returns {Promise<string>} A promise that resolves to the rendered template content
 */
async function _renderWithConfig(inputTemplateData: string, userData: any = {}, userOptions: any = {}, templateConfig: any = {}): Promise<string> {
  try {
    // Log the initial state
    logProgress('RENDER START', inputTemplateData, userData, userOptions)

    // Step 1: Validate template structure (e.g. matching opening and closing tags)
    const tagError = validateTemplateStructure(inputTemplateData)
    if (tagError) {
      logProgress('VALIDATION FAILED', tagError, userData, userOptions)
      return tagError
    }
    logProgress('Render Step 1 complete: Template structure validation', inputTemplateData, userData, userOptions)

    // Step 2: Normalize template data (fix quotes, ensure string type)
    let templateData = normalizeTemplateData(inputTemplateData)
    logProgress('Render Step 2 complete: Template data normalization', templateData, userData, userOptions)

    // Step 3: Setup session data with global helpers
    let sessionData = { ...loadGlobalHelpers({ ...userData }), ...templateConfig }
    logProgress('Render Step 3 complete: Global helpers loaded', templateData, sessionData, userOptions)

    // Step 3.5: Validate that meeting note templates have required event data
    const allVars = { ...sessionData.data, ...sessionData.methods, ...userData.methods, ...userData.data }
    const meetingNoteValidationError = validateMeetingNoteTemplate(templateData, allVars)
    if (meetingNoteValidationError) {
      logProgress('MEETING NOTE VALIDATION FAILED', meetingNoteValidationError, sessionData, userOptions)
      clo(allVars, 'validateMeetingNoteTemplate: allVars')
      await showMessage(meetingNoteValidationError, 'OK', 'Template Error')
      throw new Error(`STOPPING RENDER: Render Step 3.5 stopped execution with error: ${meetingNoteValidationError}`)
    }
    logProgress('Render Step 3.5 complete: Meeting note template validation', templateData, sessionData, userOptions)

    // Create a single TemplatingEngine instance with the templateConfig
    const templatingEngine = new TemplatingEngine(templateConfig, inputTemplateData)

    // Step 4: Process frontmatter tags first because they can contain prompts that should be set to variables
    // (but not if they have already been processed, which they are in all the direct Templating commands)
    if (!userOptions.frontmatterProcessed) {
      const frontmatterResult = await processFrontmatter(templateData, sessionData, userOptions, templatingEngine)
      templateData = frontmatterResult.templateData
      sessionData = frontmatterResult.sessionData
      logProgress('Render Step 4 complete: Frontmatter processing', templateData, sessionData, userOptions)
    } else {
      // Even when frontmatterProcessed is true, we still need to extract the body if the template contains frontmatter
      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      logDebug(pluginJson, `_renderWithConfig: frontmatterProcessed=true, isFrontmatterTemplate=${String(isFrontmatterTemplate)}`)
      if (isFrontmatterTemplate) {
        logDebug(pluginJson, `_renderWithConfig: Extracting frontmatter body from template with ${templateData.length} chars`)
        const { frontmatterBody, frontmatterAttributes } = await processFrontmatterTags(templateData, sessionData)
        logDebug(pluginJson, `_renderWithConfig: Extracted frontmatterBody with ${frontmatterBody.length} chars: "${frontmatterBody.substring(0, 100)}..."`)
        logDebug(pluginJson, `_renderWithConfig: Extracted frontmatterAttributes: ${JSON.stringify(frontmatterAttributes)}`)
        templateData = frontmatterBody
        logProgress('Render Step 4 (extracted body): Frontmatter body extraction', templateData, sessionData, userOptions)
      } else {
        logDebug(pluginJson, `_renderWithConfig: Template is not a frontmatter template, skipping body extraction`)
        logProgress('Render Step 4 (skipped): Frontmatter processing (already pre-processed)', templateData, sessionData, userOptions)
      }
    }

    // Detect any errors from frontmatter processing
    const frontmatterErrors = detectFrontmatterErrors(sessionData, inputTemplateData)

    // Check for quick template note shortcut
    if (isQuickTemplateNote(userOptions)) {
      logProgress('QUICK TEMPLATE NOTE SHORTCUT', templateData, sessionData, userOptions)
      return templateData
    }

    // Step 5: Import any referenced templates
    templateData = await importTemplates(templateData, sessionData)
    // Ensure templateData is a string before logging
    if (typeof templateData !== 'string') {
      logDebug(pluginJson, `_renderWithConfig: templateData is not a string after importTemplates: ${typeof templateData} - ${String(templateData).substring(0, 100)}`)
      templateData = String(templateData)
    }
    logProgress('Render Step 5 complete: Template imports', templateData, sessionData, userOptions)

    // Step 6: Convert JavaScript blocks to template tags
    templateData = convertTemplateJSBlocksToControlTags(templateData)
    // Ensure templateData is a string before logging
    if (typeof templateData !== 'string') {
      logDebug(
        pluginJson,
        `_renderWithConfig: templateData is not a string after convertTemplateJSBlocksToControlTags: ${typeof templateData} - ${String(templateData).substring(0, 100)}`,
      )
      templateData = String(templateData)
    }
    logProgress('Render Step 6 complete: JavaScript blocks conversion', templateData, sessionData, userOptions)

    // Step 7: Pre-process the template to handle includes, variables, etc.
    const { newTemplateData, newSettingData } = await preProcessTags(templateData, sessionData)
    templateData = newTemplateData
    sessionData = { ...newSettingData }
    logProgress('Render Step 7 complete: Template pre-processing', templateData, sessionData, userOptions)

    // Step 8: Process prompts in the template body
    const afterPromptData = await processTemplatePrompts(templateData, sessionData)
    if (afterPromptData === false) {
      logProgress('PROMPT CANCELED - USER ABORTED', '', sessionData, userOptions)
      return '' // User canceled a prompt, so we should stop processing
    }
    templateData = afterPromptData.templateData
    sessionData = {
      ...afterPromptData.sessionData,
      data: { ...afterPromptData.sessionData.data, ...userData?.data },
      methods: { ...afterPromptData.sessionData.methods, ...userData?.methods },
    }
    logProgress('Render Step 8 complete: Template prompts processing', templateData, sessionData, userOptions)

    // Step 9: Protect JS ignored code blocks during rendering -- don't let EJS process them
    // Note: this was more relevant in Mike's original implementation where code blocks were ```javscript
    // But now that we're using ```templatejs, this is probably not ever used
    const { templateData: templateDataWithoutIgnoredCodeBlocks, codeBlocks: savedIgnoredCodeBlocks } = tempSaveIgnoredCodeBlocks(templateData)
    let protectedTemplate = templateDataWithoutIgnoredCodeBlocks
    logProgress('Render Step 9 complete: Code blocks protection', protectedTemplate, sessionData, userOptions)

    // Step 10: Perform the actual template rendering
    let renderedData

    // Fast path: if template has no EJS tags, return as-is (no need for TemplatingEngine)
    // Exception: if template contains backtick-wrapped code like `<%- something %>`, still process it
    const hasEJSTags = protectedTemplate.includes('<%') || protectedTemplate.includes('```templatejs')
    const startsWithFrontmatter = protectedTemplate.startsWith('--')
    const hasBacktickWrappedEJS = /`[^`]*<%.*?%>.*?`/.test(protectedTemplate) // This is probably redundant

    if (!hasEJSTags && !hasBacktickWrappedEJS && frontmatterErrors.length === 0 && !startsWithFrontmatter) {
      renderedData = protectedTemplate
    } else {
      // If the body of the template starts with "---", we need to convert it to "--"
      // This is because EJS will skip the frontmatter in a template "---"
      // So we need to convert it to "--" and then will convert it back later
      protectedTemplate = startsWithFrontmatter ? convertToDoubleDashesIfNecessary(protectedTemplate) : protectedTemplate
      // Template has EJS tags, create a new TemplatingEngine instance with error context
      const enhancedTemplatingEngine = new TemplatingEngine(templateConfig, inputTemplateData, frontmatterErrors)

      try {
        renderedData = await enhancedTemplatingEngine.renderWithFallback(protectedTemplate, sessionData, userOptions)
      } catch (templateEngineError) {
        logError(pluginJson, `TemplatingEngine.renderWithFallback failed with error:`)
        clo(templateEngineError, `TemplatingEngine Error Details`)
        logError(pluginJson, `Template data that caused the error: ${protectedTemplate}`)
        logError(pluginJson, `Session data keys: ${Object.keys(sessionData).join(', ')}`)

        // Return more detailed error information
        const errorMessage = `Template rendering failed: ${
          templateEngineError.message || templateEngineError
        }\n\nTemplate content:\n${protectedTemplate}\n\nAvailable data: ${Object.keys(sessionData).join(', ')}`
        logProgress('TEMPLATE ENGINE ERROR', errorMessage, sessionData, userOptions)
        return templateErrorMessage('TemplatingEngine.renderWithFallback', errorMessage)
      }
    }

    logProgress('Render Step 10 complete: Template engine rendering', renderedData, sessionData, userOptions)

    // Step 11: Post-process the rendered template
    let finalResult = removeEJSDocumentationNotes(renderedData)
    logProgress('Render Step 11 complete: Post-processing (EJS cleanup)', finalResult, sessionData, userOptions)

    // Step 12: Restore code blocks in the final result
    finalResult = restoreCodeBlocks(finalResult, savedIgnoredCodeBlocks)
    logProgress('Render Step 12 complete: Code blocks restoration', finalResult, sessionData, userOptions)

    logProgress('RENDER COMPLETE', finalResult, sessionData, userOptions)

    // To make errors easier to find, console log the error at the end of execution
    const errorMentioned = finalResult
      .split('\n')
      .filter((line) => line.includes('Error'))
      .join('\n')

    if (errorMentioned) {
      logDebug(pluginJson, `_renderWithConfig: Error mentioned in final result:\n*****\n\t${errorMentioned}`)
    }

    return finalResult
  } catch (error) {
    clo(error, `render found error`)
    logProgress('RENDER ERROR', '', {}, userOptions)
    if (error.message.includes('STOPPING RENDER')) {
      throw error // stop execution
    } else {
      return templateErrorMessage('render', error)
    }
  }
}

/**
 * Core template rendering function. Processes template data with provided variables.
 * Handles frontmatter, imports, and prompts in templates.
 * @async
 * @param {string} inputTemplateData - The template content to render
 * @param {any} [userData={}] - User data to use in template rendering
 * @param {any} [userOptions={}] - Options for template rendering
 * @param {any} [templateConfig={}] - Template configuration including helper modules (internal use)
 * @returns {Promise<string>} A promise that resolves to the rendered template content
 */
export async function render(inputTemplateData: string, userData: any = {}, userOptions: any = {}, templateConfig: any = {}): Promise<string> {
  return await _renderWithConfig(inputTemplateData, userData, userOptions, templateConfig)
}

/**
 * Renders a template by name, processing its content with provided data.
 * @async
 * @param {string} [templateName=''] - The name of the template to render
 * @param {any} [userData={}] - User data to use in template rendering
 * @param {any} [userOptions={}] - Options for template rendering
 * @returns {Promise<string>} A promise that resolves to the rendered template content
 */
export async function renderTemplateByName(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  try {
    const templateData = await getTemplate(templateName)
    const { frontmatterBody, frontmatterAttributes } = await processFrontmatterTags(templateData)
    const data = { ...frontmatterAttributes, frontmatter: { ...frontmatterAttributes }, ...userData }
    const renderedData = await render(frontmatterBody, data, userOptions)

    return removeEJSDocumentationNotes(renderedData)
  } catch (error) {
    clo(error, `renderTemplateByName found error`)
    return templateErrorMessage('renderTemplateByName', error)
  }
}

/**
 * Finds cursor placement markers in the rendered template data.
 * Note: as of 2025-08-21, this is not implemented/used
 * TODO: Remove this function and do something better -- see notes
 * Currently focused on finding $NP_CURSOR markers.
 * @param {string} templateData - The rendered template data to scan
 * @returns {{cursors: Array<{start: number}>}} Information about cursor positions
 */
export function findCursors(templateData: string): mixed {
  //TODO: Finish implementation cursor support
  const newTemplateData = templateData
  let pos = 0
  let startPos = 0
  const cursors = []

  do {
    const findStr = '$NP_CURSOR'
    pos = newTemplateData.indexOf(findStr, startPos)
    if (pos >= 0) {
      cursors.push({ start: pos })
      startPos = pos + 1
    }
  } while (pos >= 0)

  return {
    cursors,
  }
}

/**
 * Executes JavaScript code blocks within a template.
 * Note: as of 2025-08-21, this is not used anywhere
 * TODO: Remove this function
 * This function can process both standard EJS template code and code blocks marked with ```templatejs.
 * @async
 * @param {string} [templateData=''] - The template data containing code blocks
 * @param {any} sessionData - Session data available to the executed code
 * @param {any} [templateConfig={}] - Template configuration for the TemplatingEngine
 * @returns {Promise<{processedTemplateData: string, processedSessionData: any}>} The results after execution
 */
export async function execute(templateData: string = '', sessionData: any, templateConfig: any = {}): Promise<any> {
  let processedTemplateData = templateData
  let processedSessionData = sessionData

  // Create a single TemplatingEngine instance for all code block processing
  const templatingEngine = new TemplatingEngine(templateConfig, templateData)

  const blocks = getCodeBlocks(templateData)
  for (const codeBlock of blocks) {
    if (!codeBlockHasComment(codeBlock) && blockIsJavaScript(codeBlock)) {
      const executeCodeBlock = codeBlock.replace('```templatejs\n', '').replace('```\n', '')
      try {
        // $FlowIgnore
        let result = ''

        if (executeCodeBlock.includes('<%')) {
          result = await templatingEngine.render(executeCodeBlock, processedSessionData)
          processedTemplateData = processedTemplateData.replace(codeBlock, result)
        } else {
          // $FlowIgnore
          const fn = Function.apply(null, ['params', executeCodeBlock])
          result = fn(processedSessionData)

          if (typeof result === 'object') {
            processedTemplateData = processedTemplateData.replace(codeBlock, 'OBJECT').replace('OBJECT\n', '')
            processedSessionData = { ...processedSessionData, ...result }
          } else {
            processedTemplateData = processedTemplateData.replace(codeBlock, typeof result === 'string' ? result : '')
          }
        }
      } catch (error) {
        logError(pluginJson, `execute error:${error}`)
      }
    }
  }

  return { processedTemplateData, processedSessionData }
}

// Export functions we want to make available via the rendering index
export { frontmatterError } from '../utils/errorHandling'
export { removeWhitespaceFromCodeBlocks } from '../utils/codeProcessing'

/**
 * Restores eventDate and eventEndDate methods that get dropped during DataStore.invokePluginCommandByName serialization.
 * These functions are lost because they can't be stringified, but we can recreate them from the
 * eventDateValue and eventEndDateValue that are provided.
 * @param {Object} sessionData - The session data that may contain eventDateValue and eventEndDateValue
 * @returns {Object} Enhanced session data with eventDate and eventEndDate functions restored
 */
function restoreEventDateMethods(sessionData: Object): Object {
  const enhancedData = { ...sessionData }

  // Check for event date values and restore corresponding methods
  const eventMethods = [
    { hasValue: sessionData.data?.eventDateValue, methodName: 'eventDate', valuePath: 'eventDateValue' },
    { hasValue: sessionData.data?.eventEndDateValue, methodName: 'eventEndDate', valuePath: 'eventEndDateValue' },
  ]

  const methodsToAdd = eventMethods.filter(({ hasValue }) => hasValue)

  if (methodsToAdd.length > 0) {
    logDebug(pluginJson, `restoreEventDateMethods: Restoring ${methodsToAdd.map((m) => m.methodName).join(', ')}`)

    if (!enhancedData.methods) enhancedData.methods = {}

    methodsToAdd.forEach(({ methodName, valuePath }) => {
      const method = (format: string = 'YYYY MM DD'): string => moment(sessionData.data[valuePath]).format(format)

      // Add to methods object - TemplatingEngine will automatically spread to top level before render
      // $FlowIgnore - We're dynamically adding this method
      enhancedData.methods[methodName] = method
    })
  }

  return enhancedData
}
