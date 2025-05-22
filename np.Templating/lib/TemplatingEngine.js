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
import { clo, log } from '@helpers/dev'

// this is a customized version of `ejs` adding support for async actions (use await in template)
// review `Test (Async)` template for example`
import ejs from './support/ejs'
import { logDebug, logError } from '../../helpers/dev'

/**
 * Gets a nested property value from an object using a dot-separated key string.
 * For example, given object `obj` and key `"a.b.c"`, it returns `obj.a.b.c`.
 * @param {any} object - The object to traverse
 * @param {string} key - The dot-separated path to the desired property
 * @returns {any} The value of the property if found, otherwise undefined
 */
const getProperyValue = (object: any, key: string): any => {
  key.split('.').forEach((token) => {
    // $FlowIgnorew
    if (object) object = object[token]
  })

  return object
}

/**
 * Returns a formatted string of the current date and time.
 * Used for logging and timestamps.
 * @returns {string} The formatted date and time string in "YYYY-MM-DD HH:MM:SS" format
 */
const dt = () => {
  const d = new Date()

  /**
   * Pads a single-digit number with a leading zero.
   * @param {number} value - The number to pad
   * @returns {string|number} The padded number as a string, or the original number if >= 10
   */
  const pad = (value: number) => {
    return value < 10 ? '0' + value : value
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString()
}

/**
 * The main templating engine class that handles rendering templates with EJS.
 * Supports template modules, plugins, and provides error handling.
 */
export default class TemplatingEngine {
  /**
   * Configuration for the templating engine
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
   * Creates a new instance of the TemplatingEngine
   * @param {any} config - Configuration settings for the templating engine
   */
  constructor(config: any) {
    this.templateConfig = config || {}
    this.templatePlugins = []
    this.templateModules = []

    // override the locale based on plugin settings
    if (this.templateConfig.templateLocale === '<system>') {
      this.templateConfig.templateLocale = NotePlan.environment.languageCode
    }
  }

  /**
   * Replaces double dashes at the beginning and end of a frontmatter block with triple dashes.
   * This ensures proper YAML frontmatter format.
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

      // Add the line to current chunk
      currentChunk += (currentChunk ? '\n' : '') + line

      // Check if we can complete this chunk
      const tagsClosed = hasClosingTag && (line.match(/%>/g) || []).length >= openTags
      const conditionalClosed = !inConditional || (inConditional && bracketDepth <= 0)

      // Check if we have a complete standalone line with no open tags
      if ((!hasOpeningTag && !hasClosingTag && openTags === 0 && bracketDepth === 0) || (tagsClosed && conditionalClosed && bracketDepth === 0)) {
        // Reset tag tracking if we closed all tags
        if (tagsClosed) {
          openTags = 0
          if (bracketDepth <= 0) {
            inConditional = false
          }
        }

        // Add chunk and reset
        chunks.push(currentChunk)
        currentChunk = ''
      }
    }

    // Add any remaining content as the final chunk
    if (currentChunk) {
      chunks.push(currentChunk)
    }

    // Special case handling - scan all chunks for related conditional blocks
    const finalChunks = []
    let conditionalBlock = ''
    let inIfBlock = false

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Check for conditional starts (if, etc.)
      if (chunk.match(/<%\s*(if|for|while|switch|try|function)/)) {
        inIfBlock = true
        conditionalBlock = chunk
      }
      // Check for conditional continuations (else, else if, catch)
      else if (inIfBlock && chunk.match(/<%\s*(else|else\s+if|catch)/)) {
        conditionalBlock += '\n' + chunk
      }
      // Check for conditional ends
      else if (inIfBlock && chunk.includes('<%') && chunk.includes('}') && chunk.includes('%>')) {
        conditionalBlock += '\n' + chunk
        finalChunks.push(conditionalBlock)
        conditionalBlock = ''
        inIfBlock = false
      }
      // Add to conditional block if we're in one
      else if (inIfBlock) {
        conditionalBlock += '\n' + chunk
      }
      // Otherwise just add the chunk
      else {
        finalChunks.push(chunk)
      }
    }

    // Add any remaining conditional block
    if (conditionalBlock) {
      finalChunks.push(conditionalBlock)
    }

    return finalChunks
  }

  /**
   * Formats the error report for incremental rendering failures.
   * Creates a detailed error report showing context around the problematic code.
   * @private
   * @param {number} errorLine - The line number where the error occurred (1-based index).
   * @param {string[]} templateLines - The template content split into chunks/lines.
   * @param {string} errorDetails - The detailed error message from the rendering engine.
   * @param {string} successfulRender - The content successfully rendered before the error.
   * @returns {string} The formatted error report string.
   */
  _formatIncrementalRenderError(errorLine: number, templateLines: string[], errorDetails: string, successfulRender: string): string {
    let report = ''

    if (errorLine > 0) {
      report = `---\n## Template Rendering Error\n`
      report += `==Rendering failed at line ${errorLine} of ${templateLines.length}==\n`
      report += errorDetails ? `### Template Processor Result:\n${errorDetails}\n` : ''

      // Show context (previous and next chunks)
      if (errorLine > 1) {
        report += `### Line Before Error (Line ${errorLine - 1}):\n\`\`\`\n${templateLines[errorLine - 2]}\n\`\`\`\n`
      }

      // Show the problematic chunk
      report += `### Problematic Code (Line ${errorLine}):\n\`\`\`\n${templateLines[errorLine - 1]}\n\`\`\`\n`

      // Show next line only if it exists and is not empty/whitespace
      if (errorLine < templateLines.length && templateLines[errorLine]?.trim()) {
        report += `### Next Line (Line ${errorLine + 1}):\n\`\`\`\n${templateLines[errorLine]}\n\`\`\`\n`
      }

      // Show what rendered successfully
      logDebug(`successfulRender (before error): ${successfulRender.length}chars "${successfulRender}"`)
      if (successfulRender && successfulRender.trim().length > 0) {
        report += `### Last Successful Rendered Content:\n${
          successfulRender.length < 500
            ? successfulRender
            : successfulRender.substring(0, 250) + '\n... (truncated) ...\n' + successfulRender.substring(successfulRender.length - 250)
        }\n`
      }
      report += '---\n'
    } else {
      // This might happen if the template is empty or there's a setup issue
      report = `Unable to identify error location. Check template structure and data context.`
    }

    return report.replace(/\n\n/g, '\n')
  }

  /**
   * Try to render the full template normally and if it fails, try to render it line by line to find the error.
   * Provides detailed error reporting with context when a template fails to render.
   * @async
   * @param {string} templateData - The template to render
   * @param {Object} userData - The user data to pass to the template
   * @param {Object} userOptions - The user options to pass to the template
   * @returns {Promise<string>} The rendered template or detailed error report
   */
  async incrementalRender(templateData: string, userData: any = {}, userOptions: any = {}): Promise<string> {
    // Split template by lines but preserve EJS tags
    const templateLines = TemplatingEngine.splitTemplatePreservingTags(templateData)

    let successfulRender = ''
    let linesBuildingUp = ''
    let lastRender = ''
    let errorLine = 0
    let errorDetails = ''

    try {
      // First try rendering the entire template to see if it works
      logDebug(`incrementalRender Trying to render entire template first`)
      lastRender = await this.render(templateData, userData, userOptions)
      const failed = lastRender.includes('An error occurred rendering template')
      if (!failed) {
        logDebug(`incrementalRender fullRender: succeeded`, lastRender)
        return lastRender
      } else {
        logDebug(`incrementalRender fullRender: failed; Will try incremental rendering; lastRender=`, lastRender)
      }
    } catch (error) {
      // If it fails, proceed with incremental rendering
      logDebug(pluginJson, `IncrementalRender Caught error. Full template rendering failed. Starting incremental rendering to find the error.`)
    }
    if (DataStore.settings.hasOwnProperty('incrementalRender') && !DataStore.settings.incrementalRender) {
      logDebug(pluginJson, `incrementalRender: DISABLED by user setting`)
      return lastRender
    }
    let isErroneousLine1 = false
    // Attempt to render the template piece by piece
    for (let i = 0; i < templateLines.length; i++) {
      try {
        // Try rendering just this chunk to isolate issues
        await this.render(templateLines[i], userData, userOptions)

        // If that succeeded, add to our building template
        linesBuildingUp += (linesBuildingUp ? '\n' : '') + templateLines[i]
        logDebug(`incrementalRender adding line: [${i}]`, templateLines[i])

        try {
          // Then try rendering everything up to this point
          logDebug(`incrementalRender about to render template through line: ${i}`)
          lastRender = await this.render(linesBuildingUp, userData, userOptions)
          logDebug(`incrementalRender through line: ${i} result: ${lastRender.length}chars`, lastRender)
          if (lastRender.includes('ejs error encountered') || lastRender.includes('An error occurred rendering template')) {
            throw new Error(lastRender)
          }
        } catch (error) {
          // If combining fails, we have context issue between chunks
          errorLine = i + 1
          errorDetails = `${error.message || 'Unknown error'}`
          if (error.line) errorDetails += ` at line ${error.line}, column ${error.column}`
          logError(`!!! Failed line: [${i}]"`, templateLines[i])
          logDebug(pluginJson, `Error combining chunks at chunk ${i + 1}: ${errorDetails}`)
          isErroneousLine1 = errorDetails.includes('>> 1|') && i > 0
          break
        }
      } catch (error) {
        // This specific chunk has a problem
        errorLine = i + 1
        errorDetails = `Error in line ${i + 1}: ${error.message || 'Unknown error'}`
        if (error.line) errorDetails += ` at line ${error.line}, column ${error.column}`
        isErroneousLine1 = errorDetails.includes('>> 1|') && i > 0
        logDebug(pluginJson, `Error in chunk ${errorLine}: ${errorDetails}`)
        break
      }
    }

    if (isErroneousLine1) errorDetails = '' // override EJS which is wrong about where the error is

    // Format detailed error report
    let report = ''
    if (errorLine > 0) {
      // Call the new helper function to format the error report
      report = this._formatIncrementalRenderError(errorLine, templateLines, errorDetails, successfulRender)
    } else {
      // This might happen if the template is empty or there's a setup issue
      report = `Unable to identify error location. Check template structure and data context.`
    }

    return report
  }

  /**
   * The core template rendering method.
   * Processes the template with EJS, handling frontmatter, modules, plugins, and error reporting.
   * This is the primary method used to convert template strings into final output.
   * @async
   * @param {any} [templateData=''] - The template string to render
   * @param {any} [userData={}] - User data to be available during template rendering
   * @param {any} [userOptions={}] - Options for the EJS renderer
   * @returns {Promise<string>} The rendered template or error message
   */
  async render(templateData: any = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const options = { ...{ async: true, rmWhitespace: false }, ...userOptions }

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
    const ouputData = (message: string) => {
      /**
       * Gets only the top-level primitive properties from an object for cleaner logging.
       * @param {Object} obj - The object to extract properties from
       * @returns {Object} A new object containing only the top-level primitive properties
       */
      const getTopLevelProps = (obj) => Object.entries(obj).reduce((acc, [key, value]) => (typeof value !== 'object' || value === null ? { ...acc, [key]: value } : acc), {})
      clo(getTopLevelProps(renderData), `198 Templating context object (top level values only) ${message}`)
    }

    try {
      logDebug(pluginJson, `render: BEFORE render`)
      ouputData('before render top level renderData')

      let result = await ejs.render(processedTemplateData, renderData, options)
      logDebug(`\n\nrender: AFTER render`)
      ouputData('after render')
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

      result += '---\n'

      return result.replace(/\n\n/g, '\n')
    }
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
