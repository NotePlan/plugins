// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { log, logError, logDebug, logWarn } from '@helpers/dev'
import { chooseOption, chooseFolder } from '@helpers/userInput'
import pluginJson from '../../plugin.json'
import FrontmatterModule from '../support/modules/FrontmatterModule'
import { normalizeToNotePlanFilename } from '../utils'
import { getTemplateFolder } from '../config'
import { clo } from '@helpers/dev'

/**
 * Displays a UI for the user to choose a template from the available templates.
 * Filters templates based on specified tags, and optionally groups them by folder.
 * @async
 * @param {any} [tags='*'] - Tags to filter templates by, defaults to all templates
 * @param {string} [promptMessage='Choose Template'] - The message to display in the selection UI
 * @param {any} [userOptions=null] - Additional options to customize selection behavior
 * @returns {Promise<any>} A promise that resolves to the selected template
 */
export async function chooseTemplate(tags?: any = '*', promptMessage: string = 'Choose Template', userOptions: any = null): Promise<any> {
  try {
    // We need access to templateConfig which is in the constructor context in NPTemplating
    // We'll set up a more modular approach here
    const templateConfig = await getConfig()

    let templateGroupTemplatesByFolder = templateConfig?.templateGroupTemplatesByFolder || false
    if (userOptions && userOptions.hasOwnProperty('templateGroupTemplatesByFolder')) {
      templateGroupTemplatesByFolder = userOptions.templateGroupTemplatesByFolder
    }

    const templateList = await getTemplateList(tags) // an array of {label: the title, value: the filename}

    let options = []
    for (const template of templateList) {
      const parts = template.value.split('/')
      const filename = parts.pop()
      let label = template.value.replace(`${NotePlan.environment.templateFolder}/`, '').replace(filename, template.label.replace('/', '-'))
      if (!templateGroupTemplatesByFolder) {
        const parts = label.split('/')
        label = parts[parts.length - 1]
      }
      options.push({ label, value: template.value })
    }

    // $FlowIgnore
    return await chooseOption<TNote, void>(promptMessage, options)
  } catch (error) {
    logError(pluginJson, error)
    return null
  }
}

/**
 * Gets the filename for a template from its title.
 * Handles nested templates and ensures the correct template is found in the template folder.
 * @async
 * @param {string} [note=''] - The title or path of the template note
 * @returns {Promise<string>} A promise that resolves to the filename of the template
 */
export async function getFilenameFromTemplate(note: string = ''): Promise<string> {
  // if nested note, we don't like it
  const parts = note.split('/')
  if (parts.length === 0) {
  }

  const notes = await DataStore.projectNoteByTitle(note, true, false)
  // You have to check that `notes` is NOT null before using it
  // to fix type errors.
  if (notes == null) {
    return 'INCOMPLETE'
  }
  const finalNotes = notes.filter((note) => note.filename.startsWith(NotePlan.environment.templateFolder))
  if (finalNotes.length > 1) {
    return 'MULTIPLE NOTES FOUND'
  } else {
    return notes[0].filename
  }
}

/**
 * Gets a list of available templates filtered by type.
 * Templates can define their types in frontmatter, and this method filters by those types.
 * @async
 * @param {any} [types='*'] - The types to filter by, '*' for all types
 * @returns {Promise<Array<{label: string, value: string}>>} A promise that resolves to the filtered template list {label: the title, value: the filename}
 */
export async function getTemplateList(types: any = '*'): Promise<any> {
  try {
    const settings = await getSettings()

    const templateFolder = await getTemplateFolder()
    if (templateFolder == null) {
      await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
      return []
    }

    const filterTypes = Array.isArray(types) ? types : types.split(',').map((type: string) => type.trim())

    const allTemplates = DataStore.projectNotes
      .filter((n) => n.filename?.startsWith(templateFolder))
      .filter((n) => !n.frontmatterTypes.includes('ignore'))
      .filter((n) => !n.frontmatterTypes.includes('template-helper'))
      .filter((n) => !n.title?.startsWith('_configuration'))
      .filter((n) => !n.filename?.startsWith('Delete After Release'))
      .sort((a, b) => {
        return a.filename.localeCompare(b.filename)
      })
      .map((note) => {
        return note.title == null ? null : { label: note.title, value: note.filename }
      })
      .filter(Boolean)

    let resultTemplates: Array<TNote> = []
    let matches: Array<string> = []
    let exclude: Array<string> = []
    let allTypes: Array<string> = []

    // get master list of types
    for (const template of allTemplates) {
      if (template.value.length > 0) {
        const templateData = await getTemplate(template.value)
        if (templateData.length > 0) {
          const attrs = await new FrontmatterModule().attributes(templateData)
          let type = attrs?.type || ''
          if (typeof type === 'string') {
            if (type.length > 0) {
              allTypes = allTypes.concat(type.split(',')).map((type) => type?.trim())
            }
          } else if (Array.isArray(type)) {
            allTypes = allTypes.concat(...type)
          }
        }
      }
    }
    // remove duplicates
    allTypes = allTypes.filter((v, i, a) => a.indexOf(v) === i)

    // iterate filter types
    filterTypes.forEach((type) => {
      // include all types
      matches = type === '*' ? matches.concat(allTypes) : matches
      // find matching typews
      if (type[0] !== '!' && allTypes.indexOf(type) > -1) {
        matches.push(allTypes[allTypes.indexOf(type)])
      }

      // remove excluded types
      if (type[0] === '!' && allTypes.indexOf(type.substring(1)) > -1) {
        exclude.push(allTypes[allTypes.indexOf(type.substring(1))])
      }
    })

    // always ignore templates which include a `ignore` type
    exclude.push('ignore') // np.Templating specific

    // merge the arrays together using differece
    let finalMatches = matches.filter((x) => !exclude.includes(x))

    let templateList = []
    for (const template of allTemplates) {
      if (template.value.length > 0) {
        const templateData = await getTemplate(template.value)
        if (templateData.length > 0) {
          const attrs = await new FrontmatterModule().attributes(templateData)

          const type = attrs?.type || ''
          let types = (type.length > 0 && typeof type === 'string' ? type?.split(',') : type) || ['*']
          types.forEach((element, index) => {
            types[index] = element.trim() // trim element whitespace
          })

          finalMatches.every((match) => {
            if (types.includes(match) || (types.includes('*') && filterTypes.includes('*'))) {
              // check if types includes any excluded items
              if (types.filter((x) => exclude.includes(x)).length === 0) {
                templateList.push(template)
                return false
              }
            }
            return true
          })
        }
      }
    }

    return templateList
  } catch (error) {
    logError(pluginJson, error)
    return []
  }
}

/**
 * Gets a list of templates filtered by tags in their frontmatter.
 * Similar to getTemplateList but uses tags instead of types for filtering.
 * @async
 * @param {any} [tags='*'] - The tags to filter by, '*' for all tags
 * @returns {Promise<Array<{label: string, value: string}>>} A promise that resolves to the filtered template list
 */
export async function getTemplateListByTags(tags: any = '*'): Promise<any> {
  try {
    const templateFolder = await getTemplateFolder()
    if (templateFolder == null) {
      await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
      return []
    }

    const filterTags = Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim())

    const allTemplates = DataStore.projectNotes
      .filter((n) => n.filename?.startsWith(templateFolder))
      .filter((n) => !n.title?.startsWith('_configuration'))
      .filter((n) => !n.filename?.startsWith('Delete After Release'))
      .sort((a, b) => {
        return a.filename.localeCompare(b.filename)
      })
      .map((note) => {
        return note.title == null ? null : { label: note.title, value: note.filename }
      })
      .filter(Boolean)

    let matches = []
    let exclude = []
    let allTags: Array<string> = []

    // get master list of tags
    for (const template of allTemplates) {
      if (template.value.length > 0) {
        const templateData = await getTemplate(template.value)
        if (templateData.length > 0) {
          const attrs = await new FrontmatterModule().attributes(templateData)

          const tag = attrs?.tags || ''

          if (tag.length > 0) {
            allTags = allTags.concat(tag.split(',')).map((tag) => tag?.trim())
          }
        }
      }
    }
    // remove duplicates
    allTags = allTags.filter((v, i, a) => a.indexOf(v) === i)

    // iterate filter tags
    filterTags.forEach((tag) => {
      // include all tags
      matches = tag === '*' ? matches.concat(allTags) : matches
      // find matching tags
      if (tag[0] !== '!' && allTags.indexOf(tag) > -1) {
        matches.push(allTags[allTags.indexOf(tag)])
      }

      // remove excluded tags
      if (tag[0] === '!' && allTags.indexOf(tag.substring(1)) > -1) {
        exclude.push(allTags[allTags.indexOf(tag.substring(1))])
      }
    })

    // always ignore templates which include a `ignore` tags
    exclude.push('ignore') // np.Templating specific

    // merge the arrays together using differece
    let finalMatches = matches.filter((x) => !exclude.includes(x))

    let templateList = []
    for (const template of allTemplates) {
      if (template.value.length > 0) {
        const templateData = await getTemplate(template.value)
        if (templateData.length > 0) {
          const attrs = await new FrontmatterModule().attributes(templateData)

          const tag = attrs?.tags || ''
          let tags = (tag.length > 0 && tag?.split(',')) || ['*']
          tags.forEach((element, index) => {
            tags[index] = element.trim() // trim element whitespace
          })

          finalMatches.every((match) => {
            if (tags.includes(match) || (tags.includes('*') && filterTags.includes('*'))) {
              // check if tags includes any excluded items
              if (tags.filter((x) => exclude.includes(x)).length === 0) {
                templateList.push(template)
                return false
              }
            }
            return true
          })
        }
      }
    }

    return templateList
  } catch (error) {
    logError(pluginJson, error)
    return []
  }
}

/**
 * Retrieves the content of a template by name or filename.
 * Handles various template location strategies and formats.
 * @async
 * @param {string} [templateName=''] - The name or filename of the template to get
 * @param {Object} [options={ showChoices: true, silent: false }] - Options for template retrieval
 * @param {boolean} [options.showChoices] - Whether to show UI for choosing between multiple matches
 * @param {boolean} [options.silent] - Whether to suppress error messages
 * @returns {Promise<string>} A promise that resolves to the template content
 */
export async function getTemplate(templateName: string = '', options: any = { showChoices: true, silent: false }): Promise<string> {
  const startTime = new Date()
  const isFilename = templateName.endsWith('.md') || templateName.endsWith('.txt')

  if (templateName.length === 0) {
    return ''
  }

  const parts = templateName.split('/')
  const filename = parts.pop()

  let templateFolderName = await getTemplateFolder()
  let originalFilename = templateName
  let templateFilename = templateName
  if (!templateName.includes(templateFolderName)) {
    templateFilename = `${templateFolderName}/${templateName}`
  }
  let selectedTemplate: TNote | null = null

  try {
    if (isFilename) {
      const fullFilename = templateFilename
      selectedTemplate = (await DataStore.projectNoteByFilename(fullFilename)) || null

      // if the template can't be found using actual filename (as it is on disk)
      // this will occur due to an issue in NotePlan where name on disk does not match note (or template) name
      if (!selectedTemplate) {
        const parts = templateName.split('/')
        if (parts.length > 0) {
          templateFilename = parts.pop() || ''
        }
      }
    }

    if (!selectedTemplate) {
      // we don't have a template yet, so we need to find one using title
      let templates: Array<TNote> = []
      if (isFilename) {
        logDebug(pluginJson, `getTemplate: Searching for template by title without path "${originalFilename}" isFilename=${String(isFilename)}`)
        const foundTemplates = await DataStore.projectNoteByTitle(originalFilename, true, false)
        templates = foundTemplates ? Array.from(foundTemplates) : []
      } else {
        // if it was a path+title, we need to look for just the name part without the path
        logDebug(pluginJson, `getTemplate: Searching for template by title without path "${filename || ''}" isFilename=${String(isFilename)}`)
        const foundTemplates = filename ? await DataStore.projectNoteByTitle(filename, true, false) : null
        templates = foundTemplates ? Array.from(foundTemplates) : []
        logDebug(pluginJson, `getTemplate ${filename || ''}: Found ${templates.length} templates`)
        if (parts.length > 0 && templates && templates.length > 0) {
          // ensure the path part matched
          let path = parts.join('/')
          if (!path.startsWith(templateFolderName)) {
            path = templateFolderName + (path.startsWith('/') ? path : `/${path}`)
          }
          templates = templates.filter((template) => template.filename.startsWith(path)) || []
        }
      }
      if (templates && templates.length > 1) {
        logWarn(pluginJson, `getTemplate: Multiple templates found for "${templateFilename || ''}"`)
        let templatesSecondary = []
        for (const template of templates) {
          if (template && template.filename.startsWith(templateFolderName)) {
            const parts = template.filename.split('/')
            parts.pop()
            // $FlowIgnore
            templatesSecondary.push({ value: template.filename, label: `${parts.join('/')}/${template.title}`, title: template.title })
          }
        }

        if (templatesSecondary.length > 1) {
          // $FlowIgnore
          let selectedItem = (await chooseOption<TNote, void>('Choose Template', templatesSecondary)) || null
          if (selectedItem) {
            // $FlowIgnore
            selectedTemplate = await DataStore.projectNoteByFilename(selectedItem)
          }
        } else if (templatesSecondary.length === 1) {
          // $FlowIgnore
          selectedTemplate = await DataStore.projectNoteByFilename(templatesSecondary[0].value)
        } else {
          logError(pluginJson, `getTemplate: No templates found for ${templateFilename}`)
        }
      } else {
        selectedTemplate = Array.isArray(templates) && templates.length > 0 ? templates[0] : null
      }
    }

    // template not found
    if (!selectedTemplate && !options.silent) {
      const errMsg = `Unable to locate "${originalFilename}"`
      await CommandBar.prompt('Template Error', errMsg)
      logDebug(pluginJson, `getTemplate: Unable to locate ${originalFilename}`)
      return `***Template Error: ${errMsg}***`
    }

    let templateContent = selectedTemplate?.content || ''

    let isFrontmatterTemplate = templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent) : false

    if (isFrontmatterTemplate) {
      return templateContent || ''
    }

    if (templateContent == null || (templateContent.length === 0 && !options.silent)) {
      const message = `Template "${templateName}" Not Found or Empty`
      return templateErrorMessage('getTemplate', message)
    }

    const lines = templateContent.split('\n')

    const dividerIndex = lines.findIndex((element) => element === '---' || element === '*****')
    if (dividerIndex > 0) {
      templateContent = lines.splice(dividerIndex + 1).join('\n')
    } else {
      templateContent = lines.splice(1).join('\n')
    }

    return templateContent
  } catch (error) {
    logError(pluginJson, `getTemplate: Error="${error.message}"`)
    return templateErrorMessage('getTemplate', error)
  }
}

/**
 * Retrieves the frontmatter attributes from a template.
 * Uses the FrontmatterModule to parse and extract attributes.
 * @async
 * @param {string} [templateData=''] - The template content to extract attributes from
 * @returns {Promise<any>} A promise that resolves to the parsed frontmatter attributes
 */
export async function getTemplateAttributes(templateData: string = ''): Promise<any> {
  return await new FrontmatterModule().attributes(templateData)
}

/**
 * Creates a new template with the specified title, metadata, and content.
 * @async
 * @param {string} title - The title for the new template
 * @param {Object} metaData - Metadata to include in the template's frontmatter
 * @param {string} content - The template content
 * @returns {Promise<boolean>} True if template was created, false if it already exists
 */
export async function createTemplate(title: string = '', metaData: any, content: string = ''): Promise<boolean> {
  try {
    const parts = title.split('/')
    const noteName = parts.pop()
    const folder = (await getTemplateFolder()) + '/' + parts.join('/')
    const templateFilename = (await getTemplateFolder()) + '/' + title
    if (!(await templateExists(templateFilename))) {
      const filename: any = await DataStore.newNote(noteName || '', folder)
      const note = DataStore.projectNoteByFilename(filename)

      let metaTagData = []
      for (const [key, value] of Object.entries(metaData)) {
        // $FlowIgnore
        metaTagData.push(`${key}: ${value}`)
      }
      let templateContent = `---\ntitle: ${noteName || ''}\n${metaTagData.join('\n')}\n---\n`
      templateContent += content
      // $FlowIgnore
      note.content = templateContent
      return true
    } else {
      return false
    }
  } catch (error) {
    logError(pluginJson, `createTemplate :: ${error}`)
    return false
  }
}

/**
 * Checks if a template with the given title exists.
 * @async
 * @param {string} title - The title of the template to check
 * @returns {Promise<boolean>} True if the template exists, false otherwise
 */
export async function templateExists(title: string = ''): Promise<boolean> {
  const templateFolder = await getTemplateFolder()

  let templateFilename = (await getTemplateFolder()) + title.replace(/@Templates/gi, '').replace(/\/\//, '/')
  templateFilename = await normalizeToNotePlanFilename(templateFilename)
  try {
    let note: TNote | null | void = undefined
    note = await DataStore.projectNoteByFilename(`${templateFilename}.md`)

    if (typeof note === 'undefined') {
      note = await DataStore.projectNoteByFilename(`${templateFilename}.txt`)
    }

    return typeof note !== 'undefined'
  } catch (error) {
    logError(pluginJson, `templateExists :: ${error}`)
    return false
  }
}

/**
 * Gets a folder path, either from a specified folder, the current note, or by prompting the user.
 * @async
 * @param {string} folder - The folder to use, or special values like '<select>' or '<current>' or <select path/to/search>
 * @param {string} promptMessage - The message to display when prompting for folder selection
 * @returns {Promise<string>} The selected folder path
 */
export async function getFolder(folder: string = '', promptMessage: string = 'Select folder'): Promise<string> {
  let selectedFolder = folder
  const folders = DataStore.folders
  if (/select|choose/i.test(folder) || Editor?.type === 'Calendar' || selectedFolder.length === 0) {
    selectedFolder = await chooseFolder(promptMessage, false, true)
  } else if (folder == '<current>') {
    const currentFilename = Editor.note?.filename

    if (typeof currentFilename === 'undefined') {
      selectedFolder = await chooseFolder(promptMessage, false, true)
    } else {
      const parts = currentFilename.split('/')
      if (parts.length > 1) {
        parts.pop()
        selectedFolder = parts.join('/')
      }
    }
  } else if ((folder.startsWith('<select ') || folder.startsWith('<SELECT ') || folder.startsWith('<choose ') || folder.startsWith('<CHOOSE ')) && folder.endsWith('>')) {
    // find the value inside the <select> tag
    // get everything after <select and before > including spaces
    const f = folder.slice(7, -1).trim()
    if (folders.includes(f)) {
      selectedFolder = await chooseFolder(promptMessage, false, true, f)
    } else {
      selectedFolder = ''
      clo(folders, `ERROR:getFolder: Folder "${f}" not found in ${folders.length} folders. Will prompt for folder from all folders.`)
    }
  }
  if (selectedFolder.length === 0) {
    selectedFolder = await chooseFolder(promptMessage, false, true)
  }
  return selectedFolder
}

/**
 * Retrieves the content of a note by its path.
 * Supports both full path and relative path formats.
 * @async
 * @param {string} [notePath=''] - The path to the note
 * @returns {Promise<string>} A promise that resolves to the note content
 */
export async function getNote(notePath: string = ''): Promise<string> {
  let content: string = ''

  const noteParts = notePath.split('/')
  const noteName = noteParts.pop()
  const noteFolder = noteParts.join('/')

  if (noteName && noteName.length > 0) {
    const foundNotes = DataStore.projectNoteByTitle(noteName || '', true, noteFolder.length === 0)
    if (typeof foundNotes !== 'undefined' && Array.isArray(foundNotes)) {
      if (foundNotes.length === 1) {
        content = foundNotes[0].content || ''
      } else {
        for (const note of foundNotes) {
          const parts = note.filename.split('/')
          parts.pop()
          const folder = parts.join('/')
          if (folder === noteFolder) {
            content = note.content || ''
          }
        }
      }
    }
  }

  return content
}

/**
 * Helper function to get the template configuration.
 * This is used internally by functions that need access to template configuration.
 * @async
 * @returns {Promise<any>} The template configuration
 */
async function getConfig(): Promise<any> {
  // In the original code, this was coming from NPTemplating's constructor.templateConfig
  // For the modular version, we'll need to either:
  // 1. Load it from settings, or
  // 2. Have it passed in from the main NPTemplating class
  // For now, we'll use a simple approach to retrieve the settings
  const settings = await DataStore.loadJSON('../np.Templating/settings.json')
  return settings || {}
}

/**
 * Helper function to get settings.
 * This is needed by some functions in this module.
 * @async
 * @returns {Promise<any>} The settings object
 */
async function getSettings(): Promise<any> {
  // Use the imported function from config module
  const data = DataStore.loadJSON('../np.Templating/settings.json')
  return data || {}
}

/**
 * Formats a template error message with consistent styling.
 * @param {string} method - The method name where the error occurred
 * @param {any} message - The error message or object
 * @returns {string} Formatted error message
 */
function templateErrorMessage(method: string = '', message: any = ''): string {
  if (message?.name?.indexOf('YAMLException') >= 0) {
    return formatFrontMatterError(message)
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
 * @param {any} error - The error object from the YAML parser
 * @returns {string} Formatted error message string
 */
function formatFrontMatterError(error: any): string {
  if (error.reason === 'missed comma between flow collection entries') {
    return `**Frontmatter Template Parsing Error**\n\nWhen using template tags in frontmatter attributes, the entire block must be wrapped in quotes\n${error.mark}`
  }
  return error
}
