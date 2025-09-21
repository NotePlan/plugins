// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import WebModule from './support/modules/WebModule'
import DateModule from './support/modules/DateModule'
import TimeModule from './support/modules/TimeModule'
import NoteModule from './support/modules/NoteModule'
import UtilityModule from './support/modules/UtilityModule'
import SystemModule from './support/modules/SystemModule'
import FrontmatterModule from './support/modules/FrontmatterModule'
import TasksModule from './support/modules/TasksModule'
import helpersModule from './support/modules/helpersModule'

import pluginJson from '../plugin.json'
import { clo, log, logDebug, logError, timer } from '@helpers/dev'

// Import utility functions from the new structure
import { getProperyValue, dt } from './utils'
import { templateErrorMessage } from './utils'

// Import prompt registry to get all registered prompt names
import { getRegisteredPromptNames } from './support/modules/prompts/PromptRegistry'

// Import the render orchestrator
import { orchestrateRender } from './engine/renderOrchestrator'

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
    return templateData.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateData) : false
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
      logDebug(pluginJson, `renderWithFallback: attempting single-pass render`)
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
   * @returns {Promise<Object>}
   */
  async getRenderDataWithMethods(templateData: string, userData: any = {}): Promise<Object> {
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
      frontmatter: new FrontmatterModule(this.templateConfig),
      helpers: helpersModule,
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
        stoicQuote: async () => {
          return await new WebModule().stoicQuote()
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
          return await new WebModule().journalingQuestion()
        },
        getRandomLine: async (noteTitle: string) => {
          return await new WebModule().getRandomLine(noteTitle)
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
    logDebug(pluginJson, `Loaded ${Object.keys(renderData).length} render data keys`)
    return renderData
  }

  /**
   * Main template rendering method. Delegates to the modular render orchestrator.
   * @async
   * @param {string} templateData - The template string to render
   * @param {any} userData - User data to be available during template rendering
   * @param {any} ejsOptions - Options for the EJS renderer
   * @returns {Promise<string>} The rendered template or error message
   */
  async render(templateData: string, userData: any = {}, ejsOptions: any = {}): Promise<string> {
    // Prepare rendering options
    const options = { ...{ async: true, rmWhitespace: false }, ...ejsOptions }

    // Get render data with all methods and modules
    const renderData = await this.getRenderDataWithMethods(templateData, userData)

    // Delegate to the modular render orchestrator
    return await orchestrateRender(templateData, renderData, options, this.templatePlugins, this.originalScript, this.previousPhaseErrors)
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
