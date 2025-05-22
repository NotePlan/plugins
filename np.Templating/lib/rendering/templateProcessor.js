// @flow
/**
 * @fileoverview Contains functions for processing templates.
 * This module handles all template processing operations previously in NPTemplating.js.
 */

import pluginJson from '../../plugin.json'
import FrontmatterModule from '../support/modules/FrontmatterModule'
import { processPrompts } from '../support/modules/prompts'
import TemplatingEngine from '../TemplatingEngine'
import { getTags, isCommentTag, isCode, getCodeBlocks, getIgnoredCodeBlocks, convertTemplateJSBlocksToControlTags, getTemplate } from '../core'
import { getProperyValue, mergeMultiLineStatements, protectTemplateLiterals, restoreTemplateLiterals, formatTemplateError, extractTitleFromMarkdown } from '../utils'
import globals, { asyncFunctions as globalAsyncFunctions } from '../globals'
import { log, logError, logDebug, logWarn, clo } from '@helpers/dev'

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
      logDebug(pluginJson, `processStatementForAwait: adding await before async function: ${statement}`)
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
 * Process code tags by adding await prefix to function calls that need it.
 * @param {string} tag - The code tag to process
 * @param {Object} context - The processing context containing templateData, sessionData, and override
 * @param {Array<string>} asyncFunctions - List of function names that are known to be async
 * @returns {void}
 */
export function processCodeTag(tag: string, context: { templateData: string, sessionData: Object, override: Object }, asyncFunctions: Array<string>): void {
  const tagPartsRegex = /^(<%(?:-|~|=)?)([^]*?)((?:-|~)?%>)$/ // Capture 1: start, 2: content, 3: end
  const match = tag.match(tagPartsRegex)

  if (!match) {
    logError(pluginJson, `processCodeTag: Could not parse tag: ${tag}`)
    return
  }

  const startDelim = match[1]
  const rawCodeContent = match[2] // Content as it was in the tag, including surrounding internal whitespace
  const endDelim = match[3]

  const leadingSpace = rawCodeContent.startsWith(' ') ? ' ' : ''
  const trailingSpace = rawCodeContent.endsWith(' ') ? ' ' : ''
  const codeToProcess = rawCodeContent.trim()

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
      const statements = line.split(';').map((s) => s.trim())
      // .filter((s) => s.length > 0) // Keep empty strings to preserve multiple semicolons if necessary
      const processedStatements: Array<string> = []
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        // Avoid processing empty strings that resulted from multiple semicolons, e.g. foo();;bar()
        if (statement.length > 0) {
          processedStatements.push(processStatementForAwait(statement, asyncFunctions)) // Use imported asyncFunctions
        } else if (i < statements.length - 1) {
          // if it's an empty string but not the last one (e.g. foo();;) keep it so join works
          processedStatements.push('')
        }
      }
      let joinedStatements = processedStatements.join('; ').trimRight() // trimRight to remove trailing space from join if last was empty
      // If original line ended with semicolon and processed one doesn't (and it wasn't just empty strings from ;;) add it back
      if (line.endsWith(';') && !joinedStatements.endsWith(';') && processedStatements.some((ps) => ps.length > 0)) {
        joinedStatements += ';'
      }
      // Special case: if original line was just ';' or ';;', etc. and processing made it empty, restore original line
      if (line.replace(/;/g, '').trim() === '' && joinedStatements === '') {
        processedLines.push(line) // push the original line of semicolons
      } else {
        processedLines.push(joinedStatements)
      }
    } else {
      processedLines.push(processStatementForAwait(line, asyncFunctions)) // Use imported asyncFunctions
    }
  }

  const finalProtectedCodeContent = processedLines.join('\\n')
  const finalCodeContent = restoreTemplateLiterals(finalProtectedCodeContent, literalMap)

  const newTag = `${startDelim}${leadingSpace}${finalCodeContent}${trailingSpace}${endDelim}`

  if (tag !== newTag) {
    context.templateData = context.templateData.replace(tag, newTag)
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

  let includeInfo = tag
  const keywords = ['<%=', '<%-', '<%', '_%>', '-%>', '%>', 'include', 'template']
  keywords.forEach((x) => (includeInfo = includeInfo.replace(/[{()}]/g, '').replace(new RegExp(x, 'g'), '')))

  includeInfo = includeInfo.trim()
  if (!includeInfo) {
    context.templateData = context.templateData.replace(tag, '**Unable to parse include**')
    return
  }
  const parts = includeInfo.split(',')

  const templateName = parts[0].replace(/['"`]/gi, '').trim()
  const templateData = parts.length >= 1 ? parts[1] : {}

  const templateContent = await getTemplate(templateName, { silent: true })
  const hasFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateContent)
  const isCalendarNote = /^\d{8}|\d{4}-\d{2}-\d{2}$/.test(templateName)

  if (hasFrontmatter && !isCalendarNote) {
    // if the included file has frontmatter, we need to preRender it because it could be a template
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
  if (!context.sessionData) return

  const tempTag = tag.replace('const', '').replace('let', '').trimLeft().replace('<%', '').replace('-%>', '').replace('%>', '')
  const pos = tempTag.indexOf('=')
  if (pos <= 0) return

  const varName = tempTag.substring(0, pos - 1).trim()
  let value = tempTag.substring(pos + 1).trim()

  // Determine value type and process accordingly
  if (getValueType(value) === 'string') {
    value = value.replace(/^["'](.*)["']$/, '$1').trim() // Remove outer quotes only
  } else if (getValueType(value) === 'array' || getValueType(value) === 'object') {
    // For objects and arrays, preserve the exact structure including quotes
    // Just clean up any extra quotes that might be around the entire object/array
    value = value.replace(/^["'](.*)["']$/, '$1').trim()
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
      const noteNamePath = parts[0].replace(/'/gi, '').trim()
      const content = await getNote(noteNamePath)
      if (content.length > 0) {
        // $FlowIgnore
        return content
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
      const noteNameWithPossibleDashes = parts[0].replace(/['`]/gi, '').trim()
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

// Import this from core
async function getNote(notePath: string = ''): Promise<string> {
  return await import('../core').then((module) => module.getNote(notePath))
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
  console.log(line)
  console.log(`   ERROR`)
  console.log(`   Method: ${method}:`)
  console.log(`   Message: ${message}`)
  console.log(line)
  console.log('\n')
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
    logDebug(pluginJson, `_removeWhitespaceFromCodeBlocks codeBlock before: "${newCodeBlock}"`)
    newCodeBlock = newCodeBlock.replace('```javascript\n', '').replace(/```/gi, '').replace(/\n\n/gi, '').replace(/\n/gi, '')
    logDebug(pluginJson, `_removeWhitespaceFromCodeBlocks codeBlock after: "${newCodeBlock}"`)
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
export async function preProcessTags(templateData: string, sessionData?: {} = {}): Promise<mixed> {
  // Initialize the processing context
  const context = {
    templateData: templateData || '',
    sessionData: { ...sessionData },
    override: {},
  }

  // Handle null/undefined gracefully
  if (context.templateData === null || context.templateData === undefined) {
    return {
      newTemplateData: context.templateData,
      newSettingData: context.sessionData,
    }
  }

  // Get all template tags
  const tags = (await getTags(context.templateData)) || []

  // First pass: Process all comment tags
  for (const tag of tags) {
    if (isCommentTag(tag)) {
      logDebug(pluginJson, `preProcessTags: found comment in tag: ${tag}`)
      processCommentTag(tag, context)
    }
  }

  // Second pass: Process remaining tags
  const remainingTags = (await getTags(context.templateData)) || []
  for (const tag of remainingTags) {
    logDebug(pluginJson, `preProcessing tag: ${tag}`)

    if (tag.includes('note(')) {
      logDebug(pluginJson, `preProcessTags: found note() in tag: ${tag}`)
      await processNoteTag(tag, context)
      continue
    }

    if (tag.includes('calendar(')) {
      logDebug(pluginJson, `preProcessTags: found calendar() in tag: ${tag}`)
      await processCalendarTag(tag, context)
      continue
    }

    if (tag.includes('include(') || tag.includes('template(')) {
      logDebug(pluginJson, `preProcessTags: found include() or template() in tag: ${tag}`)
      await processIncludeTag(tag, context)
      continue
    }

    if (tag.includes(':return:') || tag.toLowerCase().includes(':cr:')) {
      logDebug(pluginJson, `preProcessTags: found return() or cr() in tag: ${tag}`)
      processReturnTag(tag, context)
      continue
    }

    // Process code tags that need await prefixing
    if (isCode(tag) && tag.includes('(')) {
      logDebug(pluginJson, `preProcessTags: found code() in tag: ${tag}`)
      processCodeTag(tag, context, globalAsyncFunctions)
      continue
    }

    // Extract variables
    if (tag.includes('const') || tag.includes('let') || tag.includes('var')) {
      logDebug(pluginJson, `preProcessTags: found const, let, or var in tag: ${tag}`)
      processVariableTag(tag, context)
      continue
    }
  }

  logDebug(pluginJson, `preProcessTags after checking ${tags.length} tags`)
  clo(context.sessionData, `preProcessed sessionData`)
  clo(context.override, `preProcessed override`)
  logDebug(pluginJson, `preProcessTags templateData:\n${context.templateData}`)

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
 * @param {string} [_templateData=''] - The template data to prerender
 * @param {any} [userData={}] - User data to use in template rendering
 * @returns {Promise<{frontmatterBody: string, frontmatterAttributes: Object}>} Processed frontmatter body and attributes
 */
export async function processFrontmatterTags(_templateData: string = '', userData: any = {}): Promise<any> {
  // In the original code, this function would call `await this.setup()`
  // which is now handled by the NPTemplating class before it delegates to this function

  let templateData = _templateData
  const sectionData = { ...userData }
  if (!new FrontmatterModule().isFrontmatterTemplate(templateData)) {
    const extractedData = extractTitleFromMarkdown(templateData)
    if (!extractedData.title) extractedData.title = 'Untitled (no title found in template)'
    templateData = `---\ntitle: ${extractedData.title}\n---\n${extractedData.updatedMarkdown}`
    logDebug(pluginJson, `Template is not frontmatter, adding extracted title:"${extractedData.title}" to content:${extractedData.updatedMarkdown}`)
  }

  const frontmatterData = new FrontmatterModule().parse(templateData)
  const frontmatterAttributes = frontmatterData?.attributes || {}
  const data = { frontmatter: frontmatterAttributes }
  const frontmatterBody = frontmatterData.body
  const attributeKeys = Object.keys(frontmatterAttributes)

  for (const item of attributeKeys) {
    const value = frontmatterAttributes[item]
    const attributeValue = typeof value === 'string' && value.includes('<%') ? await render(value, sectionData) : value
    sectionData[item] = attributeValue
    frontmatterAttributes[item] = attributeValue
  }
  return { frontmatterBody, frontmatterAttributes: { ...userData, ...frontmatterAttributes } }
}

/**
 * Processes import tags in a template, replacing them with the content of referenced templates.
 * @async
 * @param {string} [templateData=''] - The template data containing import tags
 * @returns {Promise<string>} A promise that resolves to the processed template with imports resolved
 */
export async function importTemplates(templateData: string = ''): Promise<string> {
  let newTemplateData = templateData
  const tags = (await getTags(templateData)) || []
  for (const tag of tags) {
    if (!isCommentTag(tag) && tag.includes('import(')) {
      logDebug(pluginJson, `importTemplates :: ${tag}`)
      const importInfo = tag.replace('<%-', '').replace('<%', '').replace('-%>', '').replace('%>', '').replace('import', '').replace('(', '').replace(')', '')
      const parts = importInfo.split(',')
      if (parts.length > 0) {
        const noteNamePath = parts[0].replace(/['"`]/gi, '').trim()
        logDebug(pluginJson, `importTemplates :: Importing: noteNamePath :: "${noteNamePath}"`)
        const content = await getTemplate(noteNamePath)
        const body = new FrontmatterModule().body(content)
        logDebug(pluginJson, `importTemplates :: Content length: ${content.length} | Body length: ${body.length}`)
        if (body.length > 0) {
          newTemplateData = newTemplateData.replace(`\`${tag}\``, body) // adjust fenced formats
          newTemplateData = newTemplateData.replace(tag, body)
        } else {
          newTemplateData = newTemplateData.replace(tag, `**An error occurred importing "${noteNamePath}"**`)
        }
      }
    }
  }

  return newTemplateData
}

/**
 * Validates EJS tags in the template data for proper opening and closing.
 * @param {string} templateData - The template data to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
export function validateTemplateTags(templateData: string): string | null {
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

  let normalizedData = templateData

  // Handle smart quotes from iOS
  if (normalizedData.replace) {
    normalizedData = normalizedData.replace(/'/g, `'`).replace(/'/g, `'`).replace(/"/g, `"`).replace(/"/g, `"`)
  }

  // Ensure we're working with a string
  if (typeof normalizedData !== 'string') {
    normalizedData = normalizedData.toString()
  }

  // Convert legacy shorthand template prompt tag to `prompt` command
  normalizedData = normalizedData.replace(/<%@/gi, '<%- prompt')

  return normalizedData
}

/**
 * Loads global helper functions into session data.
 * @param {Object} sessionData - The session data to enhance
 * @returns {Object} Enhanced session data with global helpers
 */
function loadGlobalHelpers(sessionData: Object): Object {
  const enhancedData = { ...sessionData }

  // Load template globals
  const globalData: { [key: string]: any } = {}
  Object.getOwnPropertyNames(globals).forEach((key) => {
    globalData[key] = getProperyValue(globals, key)
  })

  enhancedData.methods = { ...enhancedData.methods, ...globalData }

  return enhancedData
}

/**
 * Handles frontmatter processing for templates with frontmatter.
 * @async
 * @param {string} templateData - The template data with frontmatter
 * @param {Object} sessionData - Current session data
 * @param {Object} userOptions - User options for rendering
 * @returns {Promise<{templateData: string, sessionData: Object}>} Updated template and session data
 */
async function processFrontmatter(templateData: string, sessionData: Object, userOptions: Object): Promise<{ templateData: string, sessionData: Object }> {
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
    const promptData = await processPrompts(value, updatedSessionData, '<%', '%>')

    if (promptData === false) {
      return { templateData: '', sessionData: updatedSessionData }
    }

    frontMatterValue = promptData.sessionTemplateData

    logDebug(pluginJson, `processFrontmatter: ${key}: ${frontMatterValue}`)
    const { newTemplateData, newSettingData } = await preProcessTags(frontMatterValue, updatedSessionData)

    const mergedSessionData = { ...updatedSessionData, ...newSettingData }
    const renderedData = await new TemplatingEngine().render(newTemplateData, promptData.sessionData, userOptions)
    updatedTemplateData = updatedTemplateData.replace(`${key}: ${value}`, `${key}: ${renderedData}`)
    newSessionData = mergedSessionData
  }

  return { templateData: updatedTemplateData, sessionData: newSessionData }
}

/**
 * Processes prompts in the template body.
 * @async
 * @param {string} templateData - The template data to process
 * @param {Object} sessionData - Current session data
 * @returns {Promise<{templateData: string, sessionData: Object}|false>} Updated template and session data, or false if canceled
 */
async function processTemplatePrompts(templateData: string, sessionData: Object): Promise<{ templateData: string, sessionData: Object } | false> {
  const promptData = await processPrompts(templateData, sessionData, '<%', '%>', getTags)

  if (promptData === false) {
    return false
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
 * Core template rendering function. Processes template data with provided variables.
 * Handles frontmatter, imports, and prompts in templates.
 * @async
 * @param {string} inputTemplateData - The template content to render
 * @param {any} [userData={}] - User data to use in template rendering
 * @param {any} [userOptions={}] - Options for template rendering
 * @returns {Promise<string>} A promise that resolves to the rendered template content
 */
export async function render(inputTemplateData: string, userData: any = {}, userOptions: any = {}): Promise<string> {
  try {
    // Step 1: Validate template structure (e.g. matching opening and closing tags)
    const tagError = validateTemplateStructure(inputTemplateData)
    if (tagError) {
      return tagError
    }

    // Step 2: Normalize template data (fix quotes, ensure string type)
    let templateData = normalizeTemplateData(inputTemplateData)

    // Step 3: Setup session data with global helpers
    let sessionData = loadGlobalHelpers({ ...userData })

    // Step 4: Process frontmatter tags first because they can contain prompts that should be set to variables
    const frontmatterResult = await processFrontmatter(templateData, sessionData, userOptions)
    templateData = frontmatterResult.templateData
    sessionData = frontmatterResult.sessionData

    // Check for quick template note shortcut
    if (isQuickTemplateNote(userOptions)) {
      return templateData
    }

    // Step 5: Import any referenced templates
    templateData = await importTemplates(templateData)

    // Step 6: Convert JavaScript blocks to template tags
    templateData = convertTemplateJSBlocksToControlTags(templateData)

    // Step 7: Pre-process the template to handle includes, variables, etc.
    const { newTemplateData, newSettingData } = await preProcessTags(templateData, sessionData)
    templateData = newTemplateData
    sessionData = { ...newSettingData }

    // Step 8: Process prompts in the template body
    const afterPromptData = await processTemplatePrompts(templateData, sessionData)
    if (afterPromptData === false) {
      return '' // User canceled a prompt, so we should stop processing
    }
    templateData = afterPromptData.templateData
    sessionData = {
      ...afterPromptData.sessionData,
      data: { ...afterPromptData.sessionData.data, ...userData?.data },
      methods: { ...afterPromptData.sessionData.methods, ...userData?.methods },
    }

    // Step 9: Protect JS ignored code blocks during rendering -- don't let EJS process them
    // Note: this was more relevant in Mike's original implementation where code blocks were ```javscript
    // But now that we're using ```templatejs, this is probably not ever used
    const { templateData: protectedTemplate, codeBlocks: savedIgnoredCodeBlocks } = tempSaveIgnoredCodeBlocks(templateData)

    // Step 10: Perform the actual template rendering
    logDebug(pluginJson, `render: STARTING incrementalRender`)
    const renderedData = await new TemplatingEngine().incrementalRender(protectedTemplate, sessionData, userOptions)
    logDebug(pluginJson, `render: FINISHED incrementalRender`)

    // Step 11: Post-process the rendered template
    let finalResult = removeEJSDocumentationNotes(renderedData)

    // Step 12: Restore code blocks in the final result
    finalResult = restoreCodeBlocks(finalResult, savedIgnoredCodeBlocks)

    logDebug(pluginJson, `>> renderedData after rendering:\n\t[PRE-RENDER]:${templateData}\n\t[RENDERED]: ${finalResult}`)

    return finalResult
  } catch (error) {
    clo(error, `render found error`)
    return templateErrorMessage('render', error)
  }
}

/**
 * Renders a template by name, processing its content with provided data.
 * @async
 * @param {string} [templateName=''] - The name of the template to render
 * @param {any} [userData={}] - User data to use in template rendering
 * @param {any} [userOptions={}] - Options for template rendering
 * @returns {Promise<string>} A promise that resolves to the rendered template content
 */
export async function renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  try {
    const templateData = await getTemplate(templateName)
    const { frontmatterBody, frontmatterAttributes } = await processFrontmatterTags(templateData)
    const data = { ...frontmatterAttributes, frontmatter: { ...frontmatterAttributes }, ...userData }
    logDebug(pluginJson, `renderTemplate calling render`)
    const renderedData = await render(templateData, data, userOptions)

    return removeEJSDocumentationNotes(renderedData)
  } catch (error) {
    clo(error, `renderTemplate found error`)
    return templateErrorMessage('renderTemplate', error)
  }
}

/**
 * Finds cursor placement markers in the rendered template data.
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
 * This function can process both standard EJS template code and code blocks marked with ```templatejs.
 * @async
 * @param {string} [templateData=''] - The template data containing code blocks
 * @param {any} sessionData - Session data available to the executed code
 * @returns {Promise<{processedTemplateData: string, processedSessionData: any}>} The results after execution
 */
export async function execute(templateData: string = '', sessionData: any): Promise<any> {
  let processedTemplateData = templateData
  let processedSessionData = sessionData

  // Import the needed functions from core
  const { codeBlockHasComment, blockIsJavaScript } = await import('../core')

  const blocks = getCodeBlocks(templateData)
  for (const codeBlock of blocks) {
    if (!codeBlockHasComment(codeBlock) && blockIsJavaScript(codeBlock)) {
      const executeCodeBlock = codeBlock.replace('```templatejs\n', '').replace('```\n', '')
      try {
        // $FlowIgnore
        let result = ''

        if (executeCodeBlock.includes('<%')) {
          logDebug(pluginJson, `executeCodeBlock using EJS renderer: ${executeCodeBlock}`)
          result = await new TemplatingEngine().render(executeCodeBlock, processedSessionData)
          processedTemplateData = processedTemplateData.replace(codeBlock, result)
        } else {
          logDebug(pluginJson, `executeCodeBlock using Function.apply (does not include <%): ${executeCodeBlock}`)
          // $FlowIgnore
          const fn = Function.apply(null, ['params', executeCodeBlock])
          result = fn(processedSessionData)

          if (typeof result === 'object') {
            processedTemplateData = processedTemplateData.replace(codeBlock, 'OBJECT').replace('OBJECT\n', '')
            processedSessionData = { ...processedSessionData, ...result }
            logDebug(pluginJson, `templatejs executeCodeBlock using Function.apply (result was an object):${executeCodeBlock}`)
          } else {
            logDebug(pluginJson, `templatejs executeCodeBlock using Function.apply (result was a string):\n${result}`)
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
