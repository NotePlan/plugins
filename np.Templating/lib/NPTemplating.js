// @flow
/**
 * NPTemplating - A powerful templating system for NotePlan
 * This is the main facade class that provides the API for the templating system.
 */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import pluginJson from '../plugin.json'

// Import from modules
import { templateErrorMessage as templateErrorMessageHandler } from './utils'

// Import from core
import { chooseTemplate, getTemplateList, getTemplate, getTemplateAttributes, createTemplate, getFolder } from './core'

// Import from config
import { heartbeat, setup as configSetup } from './config'
import { getTemplateFolder as getTemplateFolderImpl } from './config/configManager'

// Import from rendering
import { processFrontmatterTags, render, renderTemplateByName } from './rendering/templateProcessor'

import { clo, logError } from '@helpers/dev'

/**
 * The main NPTemplating class that serves as the facade for the templating system.
 * @class
 */
class NPTemplating {
  templateConfig: any

  /**
   * Creates a new instance of NPTemplating.
   * @constructor
   */
  constructor() {
    this.templateConfig = null
  }

  /**
   * Initializes the templating system by loading settings and global functions.
   * This is a wrapper for the config module's setup function.
   * @static
   * @async
   * @returns {Promise<void>}
   */
  static async setup() {
    try {
      await configSetup(this)
    } catch (error) {
      await CommandBar.prompt('Template Error', error)
    }
  }

  /**
   * Provides a diagnostic health check for the templating system.
   * This is a wrapper for the config module's heartbeat function.
   * @static
   * @async
   * @returns {Promise<string>} A formatted string containing the current configuration
   */
  static async heartbeat(): Promise<string> {
    await this.setup()
    return heartbeat(this.templateConfig)
  }

  /**
   * Returns a formatted error message for template errors.
   * @static
   * @param {string} location - The source location of the error
   * @param {Error|string} error - The error object or message
   * @returns {string} A formatted error message
   */
  static templateErrorMessage(location: string, error: Error | string): string {
    return templateErrorMessageHandler(location, error)
  }

  /**
   * Displays a UI for the user to choose a template from the available templates.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {any} [tags='*'] - Tags to filter templates by, defaults to all templates
   * @param {string} [promptMessage='Choose Template'] - The message to display in the selection UI
   * @param {any} [userOptions=null] - Additional options to customize selection behavior
   * @returns {Promise<any>} A promise that resolves to the selected template's title
   */
  static async chooseTemplate(tags?: any = '*', promptMessage: string = 'Choose Template', userOptions: any = null): Promise<string> {
    try {
      await this.setup()
      return chooseTemplate(tags, promptMessage, userOptions)
    } catch (error) {
      logError(pluginJson, error)
      return null
    }
  }

  /**
   * Gets a list of available templates filtered by type.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {any} [types='*'] - The types to filter by, '*' for all types
   * @returns {Promise<Array<{label: string, value: string}>>} A promise that resolves to the filtered template list
   */
  static async getTemplateList(types: any = '*'): Promise<any> {
    try {
      await this.setup()
      return getTemplateList(types)
    } catch (error) {
      logError(pluginJson, error)
      return []
    }
  }

  /**
   * Gets the content of a template by its name.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {string} [templateName=''] - The name or filename of the template to get
   * @param {Object} [options={ showChoices: true, silent: false }] - Options for template retrieval
   * @returns {Promise<string>} A promise that resolves to the template content
   */
  static async getTemplate(templateName: string = '', options: any = { showChoices: true, silent: false }): Promise<string> {
    try {
      await this.setup()
      return getTemplate(templateName, options)
    } catch (error) {
      logError(pluginJson, `getTemplate error: ${error}`)
      return this.templateErrorMessage('NPTemplating.getTemplate', error)
    }
  }

  /**
   * Gets the folder where templates are stored.
   * This is a wrapper for the config function with the same name.
   * @static
   * @async
   * @returns {Promise<string>} A promise that resolves to the template folder path
   */
  static async getTemplateFolder(): Promise<string> {
    await this.setup()
    return getTemplateFolderImpl()
  }

  /**
   * Retrieves the frontmatter attributes from a template.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {string} [templateData=''] - The template content to extract attributes from
   * @returns {Promise<any>} A promise that resolves to the parsed frontmatter attributes
   */
  static async getTemplateAttributes(templateData: string = ''): Promise<any> {
    await this.setup()
    return getTemplateAttributes(templateData)
  }

  /**
   * Creates a new template with the specified title, metadata, and content.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {string} title - The title for the new template
   * @param {Object} metaData - Metadata to include in the template's frontmatter
   * @param {string} content - The template content
   * @returns {Promise<mixed>} True if template was created, false if it already exists
   */
  static async createTemplate(title: string = '', metaData: any, content: string = ''): Promise<mixed> {
    try {
      await this.setup()
      return createTemplate(title, metaData, content)
    } catch (error) {
      logError(pluginJson, `createTemplate :: ${error}`)
      return false
    }
  }

  /**
   * Pre-renders template frontmatter attributes, processing template tags within frontmatter.
   * Ensures proper frontmatter structure and handles templates without frontmatter.
   * @static
   * @async
   * @param {string} [_templateData=''] - The template data to prerender
   * @param {any} [userData={}] - User data to use in template rendering
   * @returns {Promise<{frontmatterBody: string, frontmatterAttributes: Object}>} Processed frontmatter body and attributes
   */
  static async renderFrontmatter(_templateData: string = '', userData: any = {}): Promise<any> {
    await this.setup()
    return processFrontmatterTags(_templateData, userData)
  }

  /**
   * Core template rendering function. Processes template data with provided variables.
   * Handles frontmatter, imports, and prompts in templates.
   * @static
   * @async
   * @param {string} inputTemplateData - The template content to render
   * @param {any} [userData={}] - User data to use in template rendering
   * @param {any} [userOptions={}] - Options for template rendering
   * @returns {Promise<string>} A promise that resolves to the rendered template content
   */
  static async render(inputTemplateData: string, userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()
      return render(inputTemplateData, userData, userOptions, this.templateConfig)
    } catch (error) {
      clo(error, `NPTemplating.render found error dbw2`)
      return this.templateErrorMessage('NPTemplating.render', error)
    }
  }

  /**
   * Renders a template by name, processing its content with provided data.
   * @static
   * @async
   * @param {string} [templateName=''] - The name of the template to render
   * @param {any} [userData={}] - User data to use in template rendering
   * @param {any} [userOptions={}] - Options for template rendering
   * @returns {Promise<string>} A promise that resolves to the rendered template content
   */
  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()
      return renderTemplateByName(templateName, userData, userOptions)
    } catch (error) {
      clo(error, `NPTemplating.renderTemplate found error dbw1`)
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  /**
   * Gets a folder path, either from a specified folder, the current note, or by prompting the user.
   * This is a wrapper for the template management function with the same name.
   * @static
   * @async
   * @param {string} [folder=''] - The folder to use, or special values like '<select>' or '<current>'
   * @param {string} [promptMessage='Select folder'] - The message to display when prompting for folder selection
   * @returns {Promise<string>} A promise that resolves to the selected folder path
   */
  static async getFolder(folder: string = '', promptMessage: string = 'Select folder'): Promise<string> {
    try {
      await this.setup()
      return getFolder(folder, promptMessage)
    } catch (error) {
      logError(pluginJson, `getFolder error: ${error}`)
      return ''
    }
  }
}

// Export the class as the default export
export default NPTemplating

// Method to directly access getTemplateFolder from external modules without creating circular dependencies
export function getTemplateFolder(): Promise<string> {
  return getTemplateFolderImpl()
}
