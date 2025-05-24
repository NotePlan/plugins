// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import WebModule from '@templatingModules/WebModule'
import DateModule from '@templatingModules/DateModule'
import TimeModule from '@templatingModules/TimeModule'
import NoteModule from '@templatingModules/NoteModule'
import UtilityModule from '@templatingModules/UtilityModule'
import SystemModule from '@templatingModules/SystemModule'
import FrontmatterModule from '@templatingModules/FrontmatterModule'
import TasksModule from '@templatingModules/TasksModule'

import pluginJson from '../plugin.json'
import { clo, log, logDebug, logError } from '@helpers/dev'

// Import utility functions from the new structure
import { getProperyValue, dt } from './utils'
import { templateErrorMessage } from './modules'

// Import prompt registry to get all registered prompt names
import { getRegisteredPromptNames } from './support/modules/prompts/PromptRegistry'

// this is a customized version of `ejs` adding support for async actions (use await in template)
// review `Test (Async)` template for example`
import ejs from './support/ejs'

/**
 * The main templating engine class that handles rendering templates with EJS.
 * Supports template modules, plugins, and provides error handling.
 */
export default class TemplatingEngine {
  /**
   * Template configuration object
   * @type {any}
   */
  templateConfig: any

  /**
   * Array of registered template plugins
   * @type {any}
   */
  templatePlugins: any

  /**
   * Array of registered template modules
   * @type {any}
   */
  templateModules: any

  /**
   * Original user script for error reporting
   * @type {string}
   */
  originalScript: string

  /**
   * Errors from previous rendering phases (e.g., frontmatter processing)
   * @type {Array<{phase: string, error: string, context: string}>}
   */
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>

  /**
   * Creates a new instance of the TemplatingEngine
   * @param {any} config - Configuration settings for the templating engine
   * @param {string} originalScript - Original user script for error reporting
   * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Errors from previous rendering phases
   */
  constructor(config: any, originalScript: string = '', previousPhaseErrors: Array<{ phase: string, error: string, context: string }> = []) {
    this.templateConfig = config || {}
    this.templatePlugins = []
    this.templateModules = []
    this.originalScript = originalScript
    this.previousPhaseErrors = previousPhaseErrors

    // override the locale based on plugin settings
    if (this.templateConfig.templateLocale === '<system>') {
      this.templateConfig.templateLocale = NotePlan.environment.languageCode
    }
  }

  /**
   * Replaces double dashes at the beginning and end of a frontmatter block with triple dashes.
   * This allows for a template to render a new note with a frontmatter block.
   * @param {string} templateData - The template string potentially containing frontmatter
   * @returns {string} The template with double dashes converted to triple dashes if needed
   */
  _replaceDoubleDashes(templateData: string): string {
    let returnedData = templateData
    // replace double dashes at top with triple dashes
    const lines = templateData.split('\n')
    const startBlock = lines.indexOf('--')
    const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1
    if (startBlock >= 0 && endBlock > 0) {
      lines[startBlock] = '---'
      lines[endBlock] = '---'
      returnedData = lines.join('\n')
    }
    return returnedData
  }

  /**
   * Returns a string representation of the current template configuration.
   * Useful for debugging and status checks.
   * @async
   * @returns {Promise<string>} A formatted string containing the current configuration
   */
  async heartbeat(): Promise<string> {
    return '```\n' + JSON.stringify(this.templateConfig, null, 2) + '\n```\n'
  }

  /**
   * Formats and logs template error messages.
   * Creates a consistent error format for display to users.
   * @async
   * @param {string} [method=''] - The method name where the error occurred
   * @param {string} [message=''] - The error message
   * @returns {Promise<string>} A formatted error message
   */
  async templateErrorMessage(method: string = '', message: string = ''): Promise<string> {
    return templateErrorMessage(method, message)
  }

  /**
   * Checks if a template string contains frontmatter.
   * @async
   * @param {string} templateData - The template string to check
   * @returns {Promise<boolean>} True if the template contains frontmatter, false otherwise
   */
  async isFrontmatter(templateData: string): Promise<boolean> {
    return templateData.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateData.substring(1)) : false
  }

  /**
   * Splits a template into chunks while preserving EJS tags across lines.
   * This is critical for proper error reporting and incremental rendering.
   * @static
   * @param {string} templateData - The template string to split
   * @returns {string[]} An array of template chunks, with EJS syntax and code blocks preserved
   */
  static splitTemplatePreservingTags(templateData: string): string[] {
    // If empty, return empty array
    if (!templateData) return []

    const lines = templateData.split('\n')
    const chunks = []
    let currentChunk = ''
    let openTags = 0
    let inConditional = false
    let bracketDepth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const hasOpeningTag = line.includes('<%')
      const hasClosingTag = line.includes('%>')

      // Count opening and closing brackets to track code blocks
      const openBrackets = (line.match(/\{/g) || []).length
      const closeBrackets = (line.match(/\}/g) || []).length

      // Update bracket depth tracking
      if (hasOpeningTag) {
        // Check for conditional statements
        if (line.match(/<%\s*(if|for|while|switch|else|else\s+if|try|catch|function)/)) {
          inConditional = true
        }

        // Count opening tags not immediately closed
        if (!hasClosingTag || line.indexOf('<%', line.indexOf('%>') + 2) !== -1) {
          openTags++
        }
      }

      // Update bracket counting
      bracketDepth += openBrackets - closeBrackets

      // Update closing tag count
      if (hasClosingTag) {
        // Count closing tags
        if (!hasOpeningTag || line.lastIndexOf('<%') < line.lastIndexOf('%>')) {
          openTags = Math.max(0, openTags - 1)
        }

        // Check for end of conditional statements
        if (inConditional && line.includes('%>') && line.match(/<%\s*(}|endif|endfor|endwhile|endswitch)/)) {
          if (bracketDepth <= 0) inConditional = false
        }
      }

      // Update the current chunk with the line
      currentChunk += line + '\n'

      // If we're at a safe stopping point (no open tags or blocks), finalize the chunk
      if (openTags === 0 && !inConditional && bracketDepth <= 0) {
        // Don't add empty chunks
        if (currentChunk.trim()) {
          chunks.push(currentChunk)
        }
        currentChunk = ''
      }
    }

    // Add any remaining content as the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  /**
   * Formats an error message for incremental template rendering.
   * Provides detailed context around the error location.
   * @private
   * @param {number} errorLine - The line number where the error occurred
   * @param {string[]} templateLines - The template split into lines
   * @param {string} errorDetails - The error message details
   * @param {string} successfulRender - Content that was successfully rendered before the error
   * @returns {string} A formatted error message with context
   */
  _formatIncrementalRenderError(errorLine: number, templateLines: string[], errorDetails: string, successfulRender: string): string {
    // Build up the error report
    let report = '---\n## Template Error\n'
    report += `==Error at Line ${errorLine}==\n\n`
    report += `### Error Details\n\`\`\`\n${errorDetails}\n\`\`\`\n\n`

    // Show context lines around the error
    report += '### Context\n```\n'
    const startLine = Math.max(1, errorLine - 5)
    const endLine = Math.min(templateLines.length, errorLine + 5)

    for (let i = startLine; i <= endLine; i++) {
      const marker = i === errorLine ? '>> ' : '   '
      report += `${marker}${i}: ${templateLines[i - 1] || ''}\n`
    }
    report += '```\n'

    // Show what was successfully rendered (if anything)
    if (successfulRender && successfulRender.trim()) {
      report += `### Successful Rendering (up to error)\n\`\`\`\n${successfulRender.substring(0, 500)}${successfulRender.length > 500 ? '...' : ''}\n\`\`\`\n`
    }

    report += '---\n'
    return report
  }

  /**
   * Renders a template with a fallback to incremental rendering if the template fails rendering.
   * @async
   * @param {string} templateData - The template string to render
   * @param {any} userData - User data to be available during template rendering
   * @param {any} ejsOptions - Options for the EJS renderer
   * @returns {Promise<string>} The rendered template or detailed error information
   */
  async renderWithFallback(templateData: string, userData: any = {}, ejsOptions: any = {}): Promise<string> {
    try {
      logDebug(pluginJson, `renderWithFallback START: template to render: "${templateData}"`)
      logDebug(pluginJson, `renderWithFallback First try to render the template in one shot`)
      const result = await this.render(templateData, userData, ejsOptions)
      if (result.includes('Error:')) {
        logError(pluginJson, `renderWithFallback ERROR: ${result}`)
        logDebug(pluginJson, `renderWithFallback Now will try to render the template incrementally to better isolate the error`)
        // TODO: Incremental rendering had a lot of edge cases, so backburning for now (dbw: 2025-05-23)
        // It's not far off. Just needs some more testing and refinement.
        // return await this.incrementalRender(templateData, userData, ejsOptions)
      }
      return result
    } catch (error) {
      logError(pluginJson, `renderWithFallback ERROR: ${error.message}`)
      logDebug(pluginJson, `renderWithFallback Now will try to render the template incrementally to better isolate the error`)
      return await this.incrementalRender(templateData, userData, ejsOptions)
    }
  }

  /**
   * Renders a template incrementally, chunk by chunk, to better isolate errors.
   * This approach helps identify which part of a complex template is causing problems.
   * @async
   * @param {string} templateData - The template string to render
   * @param {any} userData - User data to be available during template rendering
   * @param {any} ejsOptions - Options for the EJS renderer
   * @returns {Promise<string>} The rendered template or detailed error information
   */
  async incrementalRender(templateData: string, userData: any = {}, ejsOptions: any = {}): Promise<string> {
    logDebug(pluginJson, `incrementalRender START: templateData: ${templateData}`)
    // Split the template into manageable chunks
    const templateLines = templateData.split('\n')
    const chunks = TemplatingEngine.splitTemplatePreservingTags(templateData)

    // If there are no chunks, the template is likely empty
    if (chunks.length === 0) {
      return ''
    }

    let successfulRender = ''
    let errorLine = -1
    let errorDetails = ''

    // Process each chunk and collect the results
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      try {
        // Try to render this chunk
        logDebug(pluginJson, `incrementalRender chunk: "${chunk}"`)
        const chunkResult = await this.render(chunk, userData, ejsOptions)
        successfulRender += chunkResult
      } catch (error) {
        // If we encounter an error, try to determine which line it occurred on
        errorDetails = error?.message || 'Unknown error'
        logDebug(pluginJson, `incrementalRender errorDetails: ${errorDetails} line: ${chunks[i]}`)

        // Parse the error message to extract line number information
        const lineMatch = errorDetails.match(/line (\d+)/) || error?.line
        if (lineMatch) {
          // Line number reported in the error message
          const reportedLine = parseInt(lineMatch[1] || error.line)

          // Calculate the actual line in the template
          // We need to:
          // 1. Count the lines in already processed chunks
          // 2. Adjust for the reported line within the current chunk
          const previousChunksLineCount = i > 0 ? chunks.slice(0, i).join('').split('\n').length - 1 : 0
          errorLine = previousChunksLineCount + reportedLine

          // Adjust for known offsets from EJS processing
          errorLine = Math.max(1, errorLine - 7) // EJS often adds ~7 lines of boilerplate
        } else {
          // If we can't determine the exact line, make an educated guess
          // Start at the first line of the current chunk
          const previousChunksLineCount = i > 0 ? chunks.slice(0, i).join('').split('\n').length - 1 : 0
          errorLine = previousChunksLineCount + 1
        }

        // Stop processing chunks once we hit an error
        break
      }
    }

    // Format detailed error report
    let report = ''
    if (errorLine > 0) {
      // Call the new helper function to format the error report
      report = this._formatIncrementalRenderError(errorLine, templateLines, errorDetails, successfulRender)
    } else {
      // This might happen if the template is empty or there's a setup issue
      report = `==Error Rendering templateData.==\n\nUnable to identify error location. Check template structure and data context.`
    }

    return report
  }

  /**
   * Add
   * @param {*} userData
   * @returns
   */
  async getRenderDataWithMethods(templateData: string, userData: any = {}) {
    // if a previous render has already set all the methods, return the userData
    if (userData.hasOwnProperty('utility') && userData.hasOwnProperty('web')) return userData

    let useClipoard = templateData.includes('system.clipboard')
    if (templateData.indexOf('system.clipboard') > 0) {
      this.templateConfig.clipboard = Clipboard.string
    }

    const helpers = {
      date: new DateModule(this.templateConfig),
      time: new TimeModule(this.templateConfig),
      utility: new UtilityModule(this.templateConfig),
      system: new SystemModule(this.templateConfig),
      note: new NoteModule(this.templateConfig),
      tasks: new TasksModule(this.templateConfig),
      frontmatter: {},
      user: {
        first: this.templateConfig?.userFirstName || '',
        last: this.templateConfig?.userLastName || '',
        email: this.templateConfig?.userEmail || '',
        phone: this.templateConfig?.userPhone || '',
      },
      // expose web module as synchronous methods (each method converted )
      web: {
        advice: async () => {
          return await new WebModule().advice()
        },
        affirmation: async () => {
          return await new WebModule().affirmation()
        },
        quote: async () => {
          return await new WebModule().quote()
        },
        verse: async () => {
          return await new WebModule().verse()
        },
        weather: async (params: string = '') => {
          return await new WebModule().weather(this.templateConfig, params)
        },
        wotd: async (params: string = '') => {
          return await new WebModule().wotd(this.templateConfig, params)
        },
        services: async (url: string = '', key: string = '') => {
          return await new WebModule().service(this.templateConfig, url, key)
        },
        journalingQuestion: async (params: string = '') => {
          return await new WebModule().journalingQuestion(this.templateConfig, params)
        },
      },
    }

    let renderData = { ...helpers, ...userData }

    // Dynamically add error handlers for all registered prompt types
    // This prevents nested prompt calls and provides helpful error messages
    const registeredPromptNames = getRegisteredPromptNames()
    registeredPromptNames.forEach((promptType) => {
      renderData[promptType] = (...args) => {
        const message = args[0] || 'unknown'
        throw new Error(
          `Nested ${promptType}() calls are not allowed. Found ${promptType}("${message}"). This usually happens when a user's prompt answer contains template syntax like "<%- ${promptType}(...) %>". Prompts should only be used at the top level of templates, not as responses to other prompts.`,
        )
      }
    })

    renderData = userData.data ? { ...userData.data, ...renderData } : { ...renderData }
    renderData = userData.methods ? { ...userData.methods, ...renderData } : renderData
    if (userData?.data) {
      renderData.data = { ...userData.data }
    }
    if (userData?.methods) {
      renderData.methods = { ...renderData.methods, ...userData.methods }
    }

    // apply custom plugin modules
    this.templateModules.forEach((moduleItem) => {
      clo(moduleItem, `moduleItem`)
      if (this.isClass(moduleItem.module)) {
        clo(moduleItem.module, `is class`)
        const methods = Object.getOwnPropertyNames(moduleItem.module.prototype)
        log(pluginJson, `np.Templating Error: ES6 Classes are not supported [${moduleItem.moduleNamespace}]`)
      } else {
        for (const [key, method] of Object.entries(moduleItem.module)) {
          logDebug(`key: ${key} method:${typeof method}`)

          renderData[moduleItem.moduleNamespace] = {}
          for (const [moduleKey, moduleMethod] of Object.entries(moduleItem.module)) {
            logDebug(`moduleKey: ${moduleKey} moduleMethod:${typeof moduleMethod}`)
            renderData[moduleItem.moduleNamespace][moduleKey] = moduleMethod
          }
        }
      }
    })

    renderData.np = { ...renderData }
    logDebug(pluginJson, `getRenderDataWithMethods returning renderData keys: ${Object.keys(renderData)}`)
    return renderData
  }

  /**
   * The core template rendering method.
   * Processes the template with EJS, handling frontmatter, modules, plugins, and error reporting.
   * This is the primary method used to convert template strings into final output.
   * @async
   * @param {any} [templateData=''] - The template string to render
   * @param {any} [userData={}] - User data to be available during template rendering
   * @param {any} [ejsOptions={}] - Options for the EJS renderer
   * @returns {Promise<string>} The rendered template or error message
   */
  async render(templateData: any = '', userData: any = {}, ejsOptions: any = {}): Promise<string> {
    const options = { ...{ async: true, rmWhitespace: false }, ...ejsOptions }

    const renderData = await this.getRenderDataWithMethods(templateData, userData)

    let processedTemplateData = templateData

    // check if templateData is frontmatter
    let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)

    if (frontmatterBlock.length > 0) {
      // process template first to see if frontmatter block has template variables
      processedTemplateData = await ejs.render(processedTemplateData, renderData, {
        async: true,
        openDelimiter: '{',
        closeDelimiter: '}',
      })

      frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)

      const frontmatterData = new FrontmatterModule().parse(frontmatterBlock)

      if (frontmatterData.hasOwnProperty('attributes') && frontmatterData.hasOwnProperty('body')) {
        if (Object.keys(frontmatterData.attributes).length > 0) {
          renderData.frontmatter = { ...frontmatterData.attributes }
        }
        if (frontmatterData.body.length > 0) {
          processedTemplateData = frontmatterData.body
        }
      }
    }

    // include any custom plugins
    this.templatePlugins.forEach((item) => {
      renderData[item.name] = item.method
    })

    /**
     * Helper function to output debug information about the render context data.
     * @param {string} message - A message to include with the debug output
     */
    const ouputData = (message: string, renderData: any = {}) => {
      /**
       * Gets only the top-level primitive properties from an object for cleaner logging.
       * @param {Object} obj - The object to extract properties from
       * @returns {Object} A new object containing only the top-level primitive properties
       */
      const getTopLevelProps = (obj) =>
        Object.entries(obj).reduce((acc, [key, value]) => (typeof value !== 'object' || value === null || typeof value === 'function' ? { ...acc, [key]: value } : acc), {})
      clo(getTopLevelProps(renderData), `198 Templating context object (top level values only) ${message}`)
    }

    try {
      logDebug(pluginJson, `render: BEFORE render`)
      ouputData('TemplatingEngine.render before render top level renderData', renderData)
      logDebug(pluginJson, `render: just before ejs.render renderData keys: ${Object.keys(renderData)}`)
      let result = await ejs.render(processedTemplateData, renderData, options)
      logDebug(`\n\nrender: AFTER render`)
      ouputData('TemplatingEngine.render after render')
      result = (result && result?.replace(/undefined/g, '')) || ''
      result = result.replace(
        /\[object Promise\]/g,
        `[object Promise] (**Templating was not able to get the result of this tag. Try adding an 'await' before the function call. See documentation for more information.**)`,
      )
      return this._replaceDoubleDashes(result)
    } catch (error) {
      logDebug(`render CAUGHT np.Templating error: ${typeof error === 'object' ? JSON.stringify(error, null, 2) : error}`)
      logDebug(`render catch: DETAILED ERROR INFO: line=${error.line}, column=${error.column}, message=${error.message}`)
      ouputData('after catching render error')

      // Improved error message formatting
      let errorMessage = error.message || 'Unknown error'

      // Clean up the error message
      // 1. Remove duplicate error types and messages
      errorMessage = errorMessage.replace(/SyntaxError: (.*?)SyntaxError: /g, 'SyntaxError: ')
      errorMessage = errorMessage.replace(/(Unexpected.*?\.)(\s+Unexpected)/g, '$1')

      // 2. Remove noisy parts that don't help users
      errorMessage = errorMessage
        .replace(/ejs:\d+/gi, '')
        .replace('list.', 'list')
        .replace('while compiling ejs', '')
        .replace(/Error: "(.+)"/g, '$1') // Remove extra Error: "..." wrapper

      // 3. Extract the relevant context lines and error location
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

      // Build the final error message using the detailed structure
      let result = '---\n## Template Rendering Error\n'

      if (adjustedLine > 0) {
        result += `==Rendering failed at ${lineInfo}==\n`
      } else {
        result += `==Rendering failed==\n`
      }

      result += `### Template Processor Result:\n\`\`\`\n${errorMessage.trim()}\n\`\`\`\n`

      if (contextLines) {
        result += `### Template Context:\n\`\`\`\n${contextLines.trim()}\n\`\`\`\n`
      }

      // Add the special handling for critical errors (like JSON parsing)
      // Note: This might duplicate some info but ensures test compatibility
      if (errorMessage.includes('JSON') || errorMessage.toLowerCase().includes('unexpected identifier')) {
        result += `**Template contains critical errors.**\n` // Append this specific message
      }

      // Include original script in error message if available
      if (this.originalScript && this.originalScript.trim()) {
        result += `\n**Original Template Body:**\n\`\`\`\n${this.originalScript}\n\`\`\`\n`
      }

      // Try to get AI analysis of the error
      try {
        logDebug(pluginJson, `Attempting AI analysis of template error`)
        const aiAnalysis = await this.analyzeErrorWithAI(errorMessage, processedTemplateData, renderData)

        // If AI analysis was successful and returned something useful, use it as the primary message
        if (aiAnalysis && aiAnalysis.trim() && aiAnalysis !== errorMessage) {
          result = aiAnalysis
        } else {
          // AI analysis failed or returned original error - include previous phase errors
          if (this.previousPhaseErrors && this.previousPhaseErrors.length > 0) {
            result += `\n**Errors from previous rendering phases:**\n`
            this.previousPhaseErrors.forEach((err) => {
              result += `### ${err.phase}:\n`
              result += `Error: ${err.error}\n`
              result += `Context: ${err.context}\n\n`
            })
          }
          result += '---\n'
        }
      } catch (aiError) {
        logError(pluginJson, `AI error analysis failed: ${aiError.message}`)

        // Include previous phase errors in the final message when AI analysis fails
        if (this.previousPhaseErrors && this.previousPhaseErrors.length > 0) {
          result += `\n**Errors from previous rendering phases:**\n`
          this.previousPhaseErrors.forEach((err) => {
            result += `### ${err.phase}:\n`
            result += `Error: ${err.error}\n`
            result += `Context: ${err.context}\n\n`
          })
        }

        result += '---\n'
      }

      return result.replace(/\n\n/g, '\n')
    }
  }

  /**
   * Uses NotePlan.AI to analyze and rewrite template errors with helpful suggestions.
   * @async
   * @param {string} originalError - The original error message from EJS
   * @param {string} templateData - The processed template data that caused the error
   * @param {Object} renderData - The render context data that was available
   * @returns {Promise<string>} A rewritten error message with AI suggestions
   */
  async analyzeErrorWithAI(originalError: string, templateData: string, renderData: Object): Promise<string> {
    try {
      // Prepare context information, filtering out polluted error variables
      const contextKeys = Object.keys(renderData)
      const contextInfo = contextKeys
        .map((key) => {
          const value = renderData[key]
          if (typeof value === 'function') {
            return `${key}: [function]`
          } else if (typeof value === 'object' && value !== null) {
            return `${key}: [object with keys: ${Object.keys(value).join(', ')}]`
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
              return `${key}: [ERROR - filtered out polluted error message]`
            }
            return `${key}: ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`
          }
        })
        .join('\n')

      // Prepare previous phase errors section
      let previousPhaseErrorsSection = ''
      if (this.previousPhaseErrors && this.previousPhaseErrors.length > 0) {
        previousPhaseErrorsSection = `\n*****
## Errors from previous rendering phases:
${this.previousPhaseErrors
  .map(
    (err) => `### ${err.phase}:
Error: ${err.error}
Context: ${err.context}`,
  )
  .join('\n\n')}`
      }

      // Template for AI analysis
      const aiErrorTemplate = `You are now an expert in EJS Templates. I want you to help find the error in an EJS template I ran that failed.
Find the error(s) and describe in layman's terms what I should do to fix the error(s). Note that if you see  
- Do not mention EJS in your answer -- Use the word "Templating" instead. 
- Do not mention semicolons in your answer unless the semicolon was in the user's original template/script 
- Rewrite the entire error message using the following format:
### Error Description:
  - Overview of error(s) as a list, including parentheticals with the problematic code in single \`
      backticks\`
### What to do to fix the error(s):
  - What specific changes they should make to fix the error(s)

*****
## Error message I received from EJS. (The line number may or may not be accurate, and therefore the specific code it is showing as context may or may not be accurate either):
${originalError}
*****
## The context variables/values that were available to the script were as follows:
${contextInfo}${previousPhaseErrorsSection}
*****
## This was the user's original template before it went to the pre-processor:
${this.originalScript || 'No original script available'}
*****
## This was the template after it had been pre-processed (any EJS errors would refer to this pre-processed file):
${templateData}
`

      logDebug(`Sending error to NotePlan.AI for analysis: `, aiErrorTemplate)

      // Call NotePlan.AI
      const aiAnalysis = await NotePlan.ai(aiErrorTemplate, [], false, 'gpt-4')

      if (!aiAnalysis) {
        logError(pluginJson, `AI analysis failed: ${aiAnalysis.message}`)
        return originalError
      }

      logDebug(pluginJson, `Received AI analysis: ${aiAnalysis.substring(0, 200)}...`)

      // Format the AI response as a proper error message
      let formattedResult = '==**Templating Error Found**: AI Analysis and Recommendations==\n\n'
      formattedResult += aiAnalysis

      // Include problematic lines if we have them
      if (
        this.extractProblematicLines(originalError, templateData) &&
        this.extractProblematicLines(originalError, templateData).trim() &&
        this.extractProblematicLines(originalError, templateData) !== 'No original script available'
      ) {
        formattedResult += `\n\n**Problematic Lines from Original Script:**\n\`\`\`\n${this.extractProblematicLines(originalError, templateData)}\n\`\`\`\n`
      }

      formattedResult += '\n---\n'

      return formattedResult
    } catch (aiError) {
      logError(pluginJson, `AI error analysis failed: ${aiError.message}`)
      // Fall back to original error if AI analysis fails
      return originalError
    }
  }

  /**
   * Extracts problematic lines from the original script with context around them.
   * @param {string} originalError - The error message to analyze
   * @param {string} templateData - The processed template data
   * @returns {string} Formatted problematic lines with context
   */
  extractProblematicLines(originalError: string, templateData: string): string {
    if (!this.originalScript || !this.originalScript.trim()) {
      return 'No original script available'
    }

    const originalLines = this.originalScript.split('\n')
    const contextRadius = 2 // Lines of context to show around problematic areas
    const problematicSections = []

    // Try to extract line number from error message
    const lineMatch = originalError.match(/line (\d+)/i)
    let errorLineNumber = null
    if (lineMatch) {
      errorLineNumber = parseInt(lineMatch[1], 10) - 7 // Adjust for EJS boilerplate offset
    }

    // Find problematic patterns in the original script
    const problematicPatterns = this.findProblematicPatterns(originalError, originalLines)

    // If we have a specific line number, add that section with its line number for sorting
    if (errorLineNumber && errorLineNumber > 0 && errorLineNumber <= originalLines.length) {
      const section = this.extractSection(originalLines, errorLineNumber - 1, contextRadius, `Line ${errorLineNumber}`)
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
        const section = this.extractSection(originalLines, lineIndex, contextRadius, reason)
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
      const section = this.extractSection(originalLines, 0, Math.min(5, originalLines.length - 1), 'Beginning of template')
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
  findProblematicPatterns(originalError: string, originalLines: Array<string>): Array<{ lineIndex: number, reason: string }> {
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
  extractSection(lines: Array<string>, centerIndex: number, radius: number, reason: string): string {
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
   * Gets the default format string for a specific format type.
   * Currently marked as FIXME and should not be called directly.
   * @async
   * @param {string} [formatType='date'] - The type of format to get ('date' or 'time')
   * @returns {Promise<string>} A promise that resolves to the default format string
   */
  async getDefaultFormat(formatType: string = 'date'): Promise<string> {
    //FIXME
    log(pluginJson, 'FIXME: TemplatingEngine.getDefaultFormat')
    log(pluginJson, 'This method should never be called, all references have been removed but leaving for backwards compatability')
    try {
      // $FlowFixMe
      const templateConfig = await this.getTemplateConfig()
      let format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      if (templateConfig?.templates?.defaultFormats?.[formatType]) {
        format = templateConfig?.templates?.defaultFormats?.[formatType]
      }

      format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      logDebug(pluginJson, `230 np.Templating format: ${format}`)

      return format
    } catch (error) {
      logError(`231 np.Templating Error: ${error}`)
      return this.templateErrorMessage('TemplatingEngine.getDefaultFormat', error)
    }
  }

  /**
   * Registers a plugin or module with the templating engine.
   * Supports functions and objects, but not ES6 classes.
   * @async
   * @param {string} [name=''] - The name to register the plugin or module under
   * @param {any} methodOrModule - The function, object, or module to register
   * @returns {Promise<void>}
   */
  async register(name: string = '', methodOrModule: any): Promise<void> {
    let methodOrModuleType = typeof methodOrModule
    if (this.isClass(methodOrModule)) {
      methodOrModuleType = 'class'
    }

    switch (methodOrModuleType) {
      case 'function':
        const result = this.templatePlugins.find((item) => {
          return item.name === name
        })
        if (!result) {
          this.templatePlugins.push({ name, method: methodOrModule })
        }
        break
      case 'class':
        log(pluginJson, `np.Templating Error: ES6 Classes are not supported [${name}]`)
        log(pluginJson, `Please refer to np.Templating Documentation [Templating Plugins]`)
        break
      case 'object':
        const moduleName = this.templateModules.find((item) => {
          return item.moduleNamespace === name
        })
        if (!moduleName) {
          this.templateModules.push({ moduleNamespace: name, module: methodOrModule })
        }
        break
      default:
        // what happens if we get here
        break
    }
  }

  /**
   * Checks if an object is an ES6 class.
   * Used by the register method to reject class registrations.
   * @param {any} obj - The object to check
   * @returns {boolean} True if the object is an ES6 class, false otherwise
   */
  // $FlowFixMe
  isClass(obj: any): boolean {
    const isCtorClass = obj.constructor && obj.constructor.toString().substring(0, 5) === 'class'
    if (obj.prototype === undefined) {
      return isCtorClass
    }
    const isPrototypeCtorClass = obj.prototype.constructor && obj.prototype.constructor.toString && obj.prototype.constructor.toString().substring(0, 5) === 'class'
    return isCtorClass || isPrototypeCtorClass
  }
}
