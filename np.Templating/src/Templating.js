// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { log, clo, logDebug, logError, JSP, timer, logWarn, logInfo } from '@helpers/dev'
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'
import { parseObjectString, validateObjectString } from '@helpers/stringTransforms'
import { getNote } from '@helpers/note'
import { getTemplateFolder } from '../lib/config/configManager'
import { helpInfo } from '../lib/helpers'
import { getSetting } from '@helpers/NPConfiguration'
import { smartPrependPara, smartAppendPara } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

// helpers
import { getWeatherSummary } from '../lib/support/modules/weatherSummary'
import { getWeather } from '../lib/support/modules/weather'
import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'

import { initConfiguration, updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { selectFirstNonTitleLineInEditor } from '@helpers/NPnote'
import { hasFrontMatter, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { checkAndProcessFolderAndNewNoteTitle } from '@helpers/editor'
import { getNoteTitleFromTemplate, getNoteTitleFromRenderedContent, analyzeTemplateStructure } from '@helpers/NPFrontMatter'

import pluginJson from '../plugin.json'
import DateModule from '../lib/support/modules/DateModule'

// Editor
import { templateRunnerExecute } from './NPTemplateRunner'
import { getNoteByFilename } from '../../helpers/note'

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin, including triggers)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) => pluginUpdated(pluginJson, r))
    DataStore.installOrUpdatePluginsByID(['np.Templating'], false, false, false)
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

export async function onSettingsUpdated() {
  try {
    const templateGroupTemplatesByFolder = DataStore.settings?.templateGroupTemplatesByFolder || false
    DataStore.setPreference('templateGroupTemplatesByFolder', templateGroupTemplatesByFolder)
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onUpdateOrInstall running`)
    await updateSettingData(pluginJson)
    await pluginUpdated(pluginJson, { code: 2, message: `Plugin Installed.` }, true)
  } catch (error) {
    logError(pluginJson, `onUpdateOrInstall: ${JSP(error)}`)
  }
}

export async function onStartup(): Promise<void> {
  logDebug(pluginJson, 'onStartup')
}

export async function templateInit(): Promise<void> {
  try {
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    if (typeof pluginSettingsData === 'object') {
      const result = await CommandBar.prompt('Templating Settings', 'np.Templating settings have already been created. \n\nWould you like to reset to default settings?', [
        'Yes',
        'No',
      ])

      if (result === 0) {
        DataStore.settings = { ...(await initConfiguration(pluginJson)) }
      }
    } else {
      onUpdateOrInstall({ silent: true })
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templatingHelp(): Promise<void> {
  try {
    await NotePlan.openURL('https://noteplan.co/templates/docs/getting-started/help-creating-templates')
    await showMessage(`Templating Help/Support page should be open in your default web browser`, 'OK', 'Help/Support')
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateInsert(templateName: string = ''): Promise<void> {
  try {
    if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
      const selectedTemplate = templateName.length > 0 ? templateName : await NPTemplating.chooseTemplate()
      let templateData, templateNote
      if (/<current>/i.test(selectedTemplate)) {
        if (!Editor.filename.startsWith(`@Templates`)) {
          logError(pluginJson, `You cannot use the <current> prompt in a template that is not located in the @Templates folder; Editor.filename=${Editor.filename}`)
          await showMessage(pluginJson, `OK`, `You cannot use the <current> prompt in a template that is not located in the @Templates folder`)
          return
        }
        templateNote = Editor.note
        templateData = Editor.content
      } else {
        templateNote = await getNote(selectedTemplate, true, `@Templates`)
        templateData = templateNote?.content || ''
      }
      const { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData)

      // Check if the template wants the note to be created in a folder (or with a new title) and if so, move the empty note to the trash and create a new note in the folder
      logDebug(pluginJson, `templateInsert: about to checkAndProcessFolderAndNewNoteTitle`)
      if (templateNote && (await checkAndProcessFolderAndNewNoteTitle(templateNote, frontmatterAttributes))) return

      // $FlowIgnore
      const renderedTemplate = await NPTemplating.render(frontmatterBody, frontmatterAttributes, { frontmatterProcessed: true })

      Editor.insertTextAtCursor(renderedTemplate)
    } else {
      await CommandBar.prompt('Template', 'You must have a Project Note or Calendar Note opened where you wish to insert template.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateAppend(templateName: string = ''): Promise<void> {
  try {
    logDebug('templateAppend', `Starting templateAppend with templateName=${templateName}`)
    if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
      const content: string = Editor.content || ''
      // $FlowIgnore
      const selectedTemplate = templateName.length > 0 ? templateName : await NPTemplating.chooseTemplate()
      let templateData, templateNote
      if (/<current>/i.test(selectedTemplate)) {
        if (!Editor.filename.startsWith(`@Templates`)) {
          logError(pluginJson, `You cannot use the <current> prompt in a template that is not located in the @Templates folder; Editor.filename=${Editor.filename}`)
          await showMessage(pluginJson, `OK`, `You cannot use the <current> prompt in a template that is not located in the @Templates folder`)
          return
        }
        templateNote = Editor.note
        templateData = Editor.content
      } else {
        templateNote = await getNote(selectedTemplate, true, `@Templates`)
        templateData = templateNote?.content || ''
      }

      let { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData)

      // Check if the template wants the note to be created in a folder (or with a new title) and if so, move the empty note to the trash and create a new note in the folder
      logDebug(pluginJson, `templateAppend: about to checkAndProcessFolderAndNewNoteTitle`)
      if (templateNote && (await checkAndProcessFolderAndNewNoteTitle(templateNote, frontmatterAttributes))) return

      // Create frontmatter object that includes BOTH the attributes AND the methods
      // This ensures frontmatter.* methods work in templates
      const frontmatterModule = new FrontmatterModule()
      const frontmatterWithMethods = Object.assign(frontmatterModule, frontmatterAttributes)

      let data = { ...frontmatterAttributes, frontmatter: frontmatterWithMethods }

      let renderedTemplate = await NPTemplating.render(frontmatterBody, data, { frontmatterProcessed: true })

      const location = frontmatterAttributes?.location || 'append'
      if (location === 'cursor') {
        Editor.insertTextAtCursor(renderedTemplate)
      } else {
        Editor.insertTextAtCharacterIndex(renderedTemplate, content.length)
      }
    } else {
      await CommandBar.prompt('Template', 'You must have a Project Note or Calendar Note opened where you wish to append template.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateInvoke(templateName?: string): Promise<void> {
  try {
    if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
      const content: string = Editor.content || ''

      let selectedTemplateFilename
      if (templateName) {
        const notes = await DataStore.projectNoteByTitle(templateName, true)
        if (notes?.length) {
          selectedTemplateFilename = notes[0].filename
        } else {
          logError(pluginJson, `Unable to locate template: ${templateName} which was passed to templateExecute`)
        }
      }
      // $FlowIgnore
      const selectedTemplate = selectedTemplateFilename ?? (await NPTemplating.chooseTemplate())
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      let { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData)

      // Create frontmatter object that includes BOTH the attributes AND the methods
      // This ensures frontmatter.* methods work in templates
      const frontmatterModule = new FrontmatterModule()
      const frontmatterWithMethods = Object.assign(frontmatterModule, frontmatterAttributes)

      let data = { ...frontmatterAttributes, frontmatter: frontmatterWithMethods }
      const templateResult = await NPTemplating.render(frontmatterBody, data, { frontmatterProcessed: true })

      const location = frontmatterAttributes?.location || 'append'

      // $FlowIgnore
      let renderedTemplate = await NPTemplating.render(frontmatterBody, data)

      switch (location) {
        case 'append':
          // Editor.insertTextAtCharacterIndex(`\n` + renderedTemplate, content.length)
          smartAppendPara(Editor, renderedTemplate, 'text')
          break
        case 'prepend':
          // Editor.insertTextAtCharacterIndex(renderedTemplate, 0)
          smartPrependPara(Editor, renderedTemplate, 'text')
          break
        case 'insert':
        case 'cursor':
          Editor.insertTextAtCursor(renderedTemplate)
          break
        default:
          // insert
          Editor.insertTextAtCursor(renderedTemplate)
          break
      }
    } else {
      await CommandBar.prompt('Template', 'You must have a Project Note or Calendar Note opened where you wish to append template.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Create a new note from a template
 * @param {string} templateTitle - The title of the template to use
 * @param {string} _folder - The folder to create the new note in
 * @param {string} newNoteTitle - The title of the new note to create
 * @param {Object|string} args - The arguments to pass to the template - can be an object or a stringified object (e.g. JSON.stringify({foo: 'bar'}))
 * @returns {Promise<void>}
 */
export async function templateNew(templateTitle: string = '', _folder?: string, newNoteTitle?: string, _args?: Object | string): Promise<void> {
  try {
    logDebug(pluginJson, `templateNew: STARTING - templateTitle:"${templateTitle}", folder:"${_folder}", newNoteTitle:"${newNoteTitle}" args:${JSON.stringify(_args)}`)
    let args = _args
    if (typeof _args === 'string') {
      args = JSON.parse(_args)
    } else if (!args) {
      args = {}
    }
    logDebug(pluginJson, `templateNew: templateTitle:"${templateTitle}" (typeof: ${typeof templateTitle})`)
    let selectedTemplate // will be a filename
    if (/<current>/i.test(templateTitle)) {
      selectedTemplate = Editor.filename
    } else if (templateTitle && templateTitle.trim().length) {
      logDebug(pluginJson, `templateNew: about to getTemplateList`)
      const options = await NPTemplating.getTemplateList()
      logDebug(pluginJson, `templateNew: found ${options.length} templates`)
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        // variable passed is a note title, but we need the filename
        selectedTemplate = chosenOpt.value
      }
    } else {
      // ask the user for the template
      logDebug(pluginJson, `templateNew: about to chooseTemplate`)
      selectedTemplate = await NPTemplating.chooseTemplate()
    }
    const templateData = await NPTemplating.getTemplate(selectedTemplate)
    const templateAttributes = await NPTemplating.getTemplateAttributes(templateData)

    let folder = _folder ?? ''
    let frontmatterBody, frontmatterAttributes
    logDebug(
      pluginJson,
      `templateNew: before renderFrontmatter:\n\targs:${JSON.stringify(Object.keys(typeof args === 'string' ? {} : args))}\n\ttemplateAttributes:${JSON.stringify(
        Object.keys(templateAttributes),
      )}`,
    )
    // In the case we have been passed rendered arguments (e.g. from the /insert button that rendered the frontmatter already)
    // if every property in templateAttributes is in args, then we can use args to render the template
    const argsKeys = typeof args === 'object' ? Object.keys(args) : []
    const templateAttributesKeys = Object.keys(templateAttributes)
    logDebug(pluginJson, `templateNew: argsKeys:${JSON.stringify(argsKeys)}\ntemplateAttributesKeys:${JSON.stringify(templateAttributesKeys)}`)
    const allArgsKeysAreInTemplateAttributes = templateAttributesKeys.length && argsKeys.length && templateAttributesKeys.every((key) => argsKeys.includes(key))
    if (allArgsKeysAreInTemplateAttributes) {
      frontmatterAttributes = typeof args === 'object' ? args : {}
      frontmatterBody = new FrontmatterModule().body(templateData)
      logDebug(pluginJson, `templateNew: after skipping renderFrontmatter:\nfrontmatterBody:"${frontmatterBody}"\nfrontmatterAttributes:${JSON.stringify(frontmatterAttributes)}`)
    } else {
      logDebug(pluginJson, `templateNew: about to renderFrontmatter`)
      const { frontmatterBody: fBody, frontmatterAttributes: fAttributes } = await NPTemplating.renderFrontmatter(templateData, args)
      frontmatterBody = fBody
      frontmatterAttributes = { ...fAttributes, ...(typeof args === 'object' ? args : {}) }
    }
    logDebug(pluginJson, `templateNew: after renderFrontmatter:\nfrontMatterBody:"${frontmatterBody}"\nfrontMatterAttributes:${JSON.stringify(frontmatterAttributes, null, 2)}`)

    // select/choose is by default not closed with > because it could contain a folder name to limit the list of folders
    if (/<select|<choose|<current>/i.test(folder) || (!folder && frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0)) {
      folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
    }

    // Use the rendered frontmatter attributes first, then fall back to inline title detection
    const renderedNewNoteTitle = frontmatterAttributes.newNoteTitle
    logDebug(pluginJson, `templateNew: rendered frontmatterAttributes.newNoteTitle: "${renderedNewNoteTitle}"`)
    logDebug(pluginJson, `templateNew: newNoteTitle parameter: "${newNoteTitle}"`)

    // Check if the template requires a noteTitle by looking for the variable in the template
    const templateRequiresNoteTitle = frontmatterBody.includes('<%- noteTitle %>') || frontmatterBody.includes('<%= noteTitle %>')
    logDebug(pluginJson, `templateNew: templateRequiresNoteTitle: ${templateRequiresNoteTitle}`)

    // Get the note title - either from parameters, frontmatter, or ask the user
    let noteTitle = newNoteTitle || renderedNewNoteTitle
    if (!noteTitle && templateRequiresNoteTitle) {
      noteTitle = await CommandBar.textPrompt('Template', 'Enter New Note Title', '')
      if (typeof noteTitle === 'boolean' || !noteTitle) {
        return // user cancelled or didn't provide title
      }
    }

    // Render the template with the note title
    const data = {
      data: {
        ...frontmatterAttributes,
        noteTitle: noteTitle && typeof noteTitle === 'string' ? noteTitle : '',
      },
    }

    const templateResult = await NPTemplating.render(frontmatterBody, data, { frontmatterProcessed: true })

    // For inline title detection, we need to use the RENDERED template content
    const renderedTemplateNoteTitle = getNoteTitleFromRenderedContent(templateResult)
    logDebug(pluginJson, `templateNew: renderedTemplateNoteTitle from getNoteTitleFromRenderedContent: "${renderedTemplateNoteTitle}"`)

    // Use the final title - prefer the rendered title if it's different from what we provided
    const finalNoteTitle = renderedTemplateNoteTitle || noteTitle || (await CommandBar.textPrompt('Template', 'Enter New Note Title', ''))
    logDebug(pluginJson, `templateNew: final noteTitle: "${finalNoteTitle}"`)

    if (typeof finalNoteTitle === 'boolean' || finalNoteTitle.length === 0) {
      return // user did not provide note title (Cancel) abort
    }

    const filename = DataStore.newNote(finalNoteTitle, folder) || ''
    logDebug(pluginJson, `templateNew: calling DataStore.newNote with noteTitle: "${finalNoteTitle}" and folder: "${folder}" -> filename: "${filename}"`)

    if (filename) {
      await Editor.openNoteByFilename(filename)

      const renderedTemplateHasFM = hasFrontMatter(templateResult)

      if (renderedTemplateHasFM) {
        Editor.content = templateResult

        // Always add title to frontmatter if we have a newNoteTitle from template frontmatter
        // Only skip adding title if the template has an inline title but NO newNoteTitle
        // OR if newNoteTitle and inline title are the same (no need to duplicate)
        // Use the rendered content for analysis since we already have it
        const analysis = analyzeTemplateStructure(templateResult)
        const hasInlineTitle = analysis.hasInlineTitle && analysis.inlineTitleText
        const hasNewNoteTitle = analysis.hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle
        const titlesAreSame = hasInlineTitle && hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle === analysis.inlineTitleText

        if ((hasNewNoteTitle && !titlesAreSame) || !hasInlineTitle) {
          updateFrontMatterVars(Editor, { title: finalNoteTitle })
        }
      } else {
        // Check if the template already contains an inline title to avoid duplication
        // Also check if we have newNoteTitle that should create frontmatter
        // Use the rendered content for analysis since we already have it
        const analysis = analyzeTemplateStructure(templateResult)
        const hasInlineTitle = analysis.hasInlineTitle && analysis.inlineTitleText
        const hasNewNoteTitle = analysis.hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle
        const titlesAreSame = hasInlineTitle && hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle === analysis.inlineTitleText

        if (hasNewNoteTitle && !titlesAreSame) {
          // We have newNoteTitle, so create frontmatter with title
          logDebug(`templateNew: note was created with newNoteTitle so we need to add title to frontmatter: "${finalNoteTitle}" while adding the content`)
          Editor.content = `---\ntitle: ${finalNoteTitle}\n---\n${templateResult}`
        } else if (hasInlineTitle) {
          // Template already has an inline title, don't add another one
          logDebug(`templateNew: note was created with inline title so just adding the template content (it will get the H1 title): "${finalNoteTitle}" while adding the content`)
          Editor.content = templateResult
        } else {
          // No inline title in template, add the title
          logDebug(`templateNew: note was created with no inline title or newNoteTitle so adding the title we received: "${finalNoteTitle}" while adding the content`)
          Editor.content = `# ${finalNoteTitle}\n${templateResult}`
        }
      }
      selectFirstNonTitleLineInEditor()
      logDebug(`templateNew: FINISHED - note was created with title: "${finalNoteTitle}" in folder: "${folder}" and filename: "${filename}"`)
    } else {
      await CommandBar.prompt('New Template', `An error occured creating ${finalNoteTitle} note`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateQuickNote(templateTitle: string = ''): Promise<void> {
  try {
    logDebug(pluginJson, `templateQuickNote: STARTING - templateTitle:"${templateTitle}"`)
    const content: string = Editor.content || ''
    const templateFolder = await getTemplateFolder()

    const options = await NPTemplating.getTemplateList('quick-note')
    if (options.length === 0) {
      await CommandBar.prompt(`Unable to locate any Quick Notes templates in "${templateFolder}" folder`, helpInfo('Quick Notes'))
      return
    }
    let selectedTemplate // will be a filename
    if (templateTitle?.length && options.find((option) => option.label === templateTitle)) {
      // variable passed is a note title, but we need the filename
      selectedTemplate = options.find((option) => option.label === templateTitle)?.value
    } else {
      // ask the user for the template
      selectedTemplate = options.length > 1 ? await NPTemplating.chooseTemplate('quick-note', 'Choose Quick Note') : options[0].value
    }

    if (selectedTemplate) {
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      const isFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateData)
      const templateAttributes = await NPTemplating.getTemplateAttributes(templateData)

      let folder = ''

      if (isFrontmatter) {
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData)

        let folder = frontmatterAttributes?.folder?.trim() ?? ''
        if (frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0) {
          folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
        }

        // Use the rendered frontmatter attributes first, then fall back to inline title detection
        const renderedNewNoteTitle = frontmatterAttributes?.newNoteTitle
        logDebug(pluginJson, `templateQuickNote: rendered frontmatterAttributes.newNoteTitle: "${renderedNewNoteTitle}"`)

        // Render the template first to get the final content for title extraction
        const data = {
          data: {
            ...frontmatterAttributes,
            ...{
              noteTitle: renderedNewNoteTitle || '',
            },
          },
        }

        // $FlowIgnore
        let finalRenderedData = await NPTemplating.render(frontmatterBody, data, { frontmatterProcessed: true })

        // For inline title detection, we need to use the RENDERED template content
        const renderedTemplateNoteTitle = getNoteTitleFromRenderedContent(finalRenderedData)
        logDebug(pluginJson, `templateQuickNote: renderedTemplateNoteTitle from getNoteTitleFromRenderedContent: "${renderedTemplateNoteTitle}"`)

        // Fall back to template analysis if no rendered title found
        const templateNoteTitle = renderedTemplateNoteTitle || getNoteTitleFromTemplate(templateData)
        logDebug(pluginJson, `templateQuickNote: templateNoteTitle from getNoteTitleFromTemplate: "${templateNoteTitle}"`)

        let newNoteTitle = ''
        if (renderedNewNoteTitle) {
          newNoteTitle = renderedNewNoteTitle
        } else if (templateNoteTitle) {
          newNoteTitle = templateNoteTitle
        } else {
          newNoteTitle = (await CommandBar.textPrompt('Quick Note', 'Enter Note Title', '')) || ''
          if (typeof newNoteTitle === 'boolean' || newNoteTitle.length === 0) {
            return // user did not provide note title (Cancel) abort
          }
        }

        const filename = DataStore.newNote(newNoteTitle, folder) || ''
        if (filename) {
          await Editor.openNoteByFilename(filename)

          const renderedTemplateHasFM = hasFrontMatter(finalRenderedData)

          if (renderedTemplateHasFM) {
            Editor.content = finalRenderedData
            // Always add title to frontmatter if we have a newNoteTitle from template frontmatter
            // Only skip adding title if the template has an inline title but NO newNoteTitle
            // OR if newNoteTitle and inline title are the same (no need to duplicate)
            // Use the rendered content for analysis since we already have it
            const analysis = analyzeTemplateStructure(finalRenderedData)
            const hasInlineTitle = analysis.hasInlineTitle && analysis.inlineTitleText
            const hasNewNoteTitle = analysis.hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle
            const titlesAreSame = hasInlineTitle && hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle === analysis.inlineTitleText

            if ((hasNewNoteTitle && !titlesAreSame) || !hasInlineTitle) {
              updateFrontMatterVars(Editor, { title: newNoteTitle })
            }
          } else {
            // Check if the template already contains an inline title to avoid duplication
            // Also check if we have newNoteTitle that should create frontmatter
            // Use the rendered content for analysis since we already have it
            const analysis = analyzeTemplateStructure(finalRenderedData)
            const hasInlineTitle = analysis.hasInlineTitle && analysis.inlineTitleText
            const hasNewNoteTitle = analysis.hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle
            const titlesAreSame = hasInlineTitle && hasNewNoteTitle && analysis.templateFrontmatter.newNoteTitle === analysis.inlineTitleText

            if (hasNewNoteTitle && !titlesAreSame) {
              // We have newNoteTitle, so create frontmatter with title
              Editor.content = `---\ntitle: ${newNoteTitle}\n---\n${finalRenderedData}`
            } else if (hasInlineTitle) {
              // Template already has an inline title, don't add another one
              Editor.content = finalRenderedData
            } else {
              // No inline title in template, add the title
              Editor.content = `# ${newNoteTitle}\n${finalRenderedData}`
            }
          }
          selectFirstNonTitleLineInEditor()
        } else {
          await CommandBar.prompt(
            'New Note Could Note Be Created',
            `Note: "${newNoteTitle}" (newNoteTitle) in folder: "${folder}" could not be created. Check to ensure folder path is valid. For more information please refer to ${helpInfo(
              'Template Anatomty: Frontmatter',
            )}`,
          )
        }
      } else {
        await CommandBar.prompt('New Note Could Note Be Created', helpInfo('Template Anatomty: Frontmatter'))
      }
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

export async function templateMeetingNote(templateName: string = '', templateData: any = {}): Promise<void> {
  try {
    const content: string = Editor.content || ''
    const templateFolder = await getTemplateFolder()

    const options = await NPTemplating.getTemplateList('meeting-note')
    if (options.length === 0) {
      await CommandBar.prompt('Templating', helpInfo('Meeting Notes'))
      return
    }

    let selectedTemplate = ''
    if (templateName?.length && options.find((option) => option.label === templateName)) {
      // variable passed is a note title, but we need the filename
      selectedTemplate = options.find((option) => option.label === templateName)?.value
    } else {
      // ask the user for the template
      selectedTemplate = options.length > 1 ? await NPTemplating.chooseTemplate('meeting-note', 'Choose Meeting Note') : options[0].value
    }

    if (selectedTemplate) {
      // $FlowIgnore
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      const isFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateData)
      const templateAttributes = await NPTemplating.getTemplateAttributes(templateData)

      let folder = ''

      if (isFrontmatter) {
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData)

        let folder = frontmatterAttributes?.folder.trim() ?? ''
        if (frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0) {
          folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
        }

        // Use the rendered frontmatter attributes first, then fall back to inline title detection
        const renderedNewNoteTitle = frontmatterAttributes?.newNoteTitle
        logDebug(pluginJson, `templateMeetingNote: rendered frontmatterAttributes.newNoteTitle: "${renderedNewNoteTitle}"`)

        // Render the template first to get the final content for title extraction
        const data = {
          data: {
            ...frontmatterAttributes,
            ...{
              noteTitle: renderedNewNoteTitle || '',
            },
          },
        }

        let finalRenderedData = await NPTemplating.render(frontmatterBody, data, { frontmatterProcessed: true })

        // For inline title detection, we need to use the RENDERED template content
        const renderedTemplateNoteTitle = getNoteTitleFromRenderedContent(finalRenderedData)
        logDebug(pluginJson, `templateMeetingNote: renderedTemplateNoteTitle from getNoteTitleFromRenderedContent: "${renderedTemplateNoteTitle}"`)

        // Fall back to template analysis if no rendered title found
        const templateNoteTitle = renderedTemplateNoteTitle || getNoteTitleFromTemplate(templateData)
        logDebug(pluginJson, `templateMeetingNote: templateNoteTitle from getNoteTitleFromTemplate: "${templateNoteTitle}"`)

        let newNoteTitle = ''
        if (renderedNewNoteTitle) {
          newNoteTitle = renderedNewNoteTitle
        } else if (templateNoteTitle) {
          newNoteTitle = templateNoteTitle
        } else {
          const format = await getSetting('np.Templating', 'timestampFormat')
          const info = await CommandBar.textPrompt('Meeting Note', 'What is date/time of meeeting?', new DateModule().timestamp(format))
          newNoteTitle = info ? info : ''
          if (typeof newNoteTitle === 'boolean' || newNoteTitle.length === 0) {
            return // user did not provide note title (Cancel) abort
          }
        }

        if (!newNoteTitle || newNoteTitle.length === 0) {
          const helpText = helpInfo('Templating Prompts')
          await CommandBar.prompt(
            'Invalid Note Title (newNoteTitle)',
            `QuickNotes are required to have a newNoteTitle field which specifies what the generated note's title will be. FYI, note title may only contain alphanumeric characters (a..z, A..Z, 0..9)\n\nIf you have used a templating prompt to obtain note title, make sure the prompt variable is valid.\n\n${helpText}`,
          )
          return
        }

        const filename = DataStore.newNote(newNoteTitle, folder) || ''
        if (filename) {
          await Editor.openNoteByFilename(filename)

          const lines = finalRenderedData.split('\n')
          const startBlock = lines.indexOf('--')
          const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1

          if (startBlock >= 0 && endBlock >= 0) {
            lines[startBlock] = '---'
            lines[endBlock] = '---'
            const newContent = lines.join('\n')
            Editor.content = newContent
            logDebug(
              pluginJson,
              `TemplateDELETME templateMeetingNote: ${filename} has note sub-frontmatter, so we replaced the existing content with the rendered frontmatter; note content is now: ${newContent}`,
            )
          } else {
            // Check if the template already contains an inline title to avoid duplication
            // Use the rendered content for analysis since we already have it
            const analysis = analyzeTemplateStructure(finalRenderedData)
            const hasInlineTitle = analysis.hasInlineTitle && analysis.inlineTitleText

            if (hasInlineTitle) {
              // Template already has an inline title, don't add another one
              Editor.content = finalRenderedData
            } else {
              // No inline title in template, add the title
              Editor.content = `# ${newNoteTitle}\n${finalRenderedData}`
            }
          }
          selectFirstNonTitleLineInEditor()
        }
      }
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

// $FlowIgnore
export async function templateWeather(): Promise<string> {
  try {
    let templateConfig = DataStore.settings
    let weatherFormat = (templateConfig && templateConfig.weatherFormat) || ''
    weatherFormat = weatherFormat.length === 0 && templateConfig?.weatherFormat?.length > 0 ? templateConfig?.weatherFormat : weatherFormat

    // $FlowIgnore
    const weather = weatherFormat.length === 0 ? await getWeather() : await getWeatherSummary(weatherFormat)

    Editor.insertTextAtCursor(weather)
  } catch (error) {
    Editor.insertTextAtCursor('**An error occurred accessing weather service**')
  }
}

// $FlowIgnore
export async function templateAdvice(): Promise<string> {
  try {
    // $FlowIgnore
    const advice: string = await getAdvice()

    Editor.insertTextAtCursor(advice)
  } catch (error) {
    Editor.insertTextAtCursor('**An error occurred accessing advice service**')
  }
}

// $FlowIgnore
export async function templateAffirmation(): Promise<string> {
  try {
    // $FlowIgnore
    const affirmation: string = await getAffirmation()

    Editor.insertTextAtCursor(affirmation)
  } catch (error) {
    Editor.insertTextAtCursor('**An error occurred accessing affirmation service**')
  }
}

// $FlowIgnore
export async function templateVerse(): Promise<string> {
  try {
    // $FlowIgnore
    const verse: string = await getVersePlain()

    Editor.insertTextAtCursor(verse)
  } catch (error) {
    Editor.insertTextAtCursor('**An error occurred accessing bible service**')
  }
}

// $FlowIgnore
export async function templateQuote(): Promise<string> {
  try {
    // $FlowIgnore
    const verse: string = await getDailyQuote()

    Editor.insertTextAtCursor(verse)
  } catch (error) {
    Editor.insertTextAtCursor('**An error occurred accessing quote service**')
  }
}

/**
 * Run a template by name/title (generally via x-callback-url)
 * @param {Array<string>} args (see below)
 *  - {string} args[0] - the template name (required, unless args[2] is an object and contains templateCode)
 *  - {string} args[1] - the openInEditor flag (optional)
 *  - {string} args[2] - the templaterunner arguments (optional) - key=value pairs passed to the template, separated by semicolons
 * @example
 * @returns {Promise<void>}
 *
 */
export async function templateRunner(...args: Array<string>) {
  try {
    const argsType = typeof args === 'object' && Array.isArray(args) ? 'array' : typeof args === 'object' ? 'object' : 'string'
    clo(args, `templateRunner starting with args (${argsType}), length: ${args.length}`)
    const startTime = new Date()
    if (args.length > 0) {
      logInfo(
        pluginJson,
        `\n+++++++\ntemplateRunner calling templateFileByTitle with args:\n\targs[0] (templateName): ${args[0]}\n\targs[1] (openInEditor): ${
          args[1]
        }\n\targs[2] (passed variables): ${JSON.stringify(args[2], null, 2)}\n+++++++`,
      )
      if (!args[0])
        logInfo(
          `templateRunner: No template name was provided to the templateRunner. Value was:"${args[0]}". This could be ok if you are calling from code, but check your x-callback-url or calling function to ensure you are passing the template name.`,
        )
      if (args[1] === undefined || args[1] === null || !['false', 'true', false, true].includes(args[1]))
        logInfo(
          `templateRunner: No openInEditor flag was provided to the templateRunner. Will default to false. Value was: ${args[1]}. Check your x-callback-url or calling function.`,
        )
      if (typeof args[2] !== 'object' && !args[2])
        logInfo(
          `templateRunner: No templaterunner variables were provided to the templateRunner. Value was: ${args[2]}. This may be ok if your template does not need variables, but is obviously a problem if it does. Check your x-callback-url or calling function.`,
        )
      await templateFileByTitle(args[0], args[1] === 'true' || args[1] === true, args.length > 2 ? args[2] : '')
    } else {
      await CommandBar.prompt(`No arguments (with template name) were given to the templateRunner."`, helpInfo('Presets'))
    }
    logDebug(`Total templateRunner time: ${timer(startTime)}`)
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateAbout(params: any = []): Promise<string> {
  try {
    const version = pluginJson['plugin.version']
    let aboutInfo = `Templating Plugin for NotePlan\nv${version}\n\n\nCopyright © 2022 Mike Erickson.\nAll Rights Reserved.`

    await CommandBar.prompt('About np.Templating', aboutInfo)
    log(pluginJson, `${version}`)
    return version
  } catch (error) {
    return logError(pluginJson, error)
  }
}

export async function templateSamples(): Promise<void> {
  const numSamples = 10
  const result = await CommandBar.prompt(`This will create ${numSamples} template samples in your Templates folder`, 'Are you sure you wish to continue?', ['Continue', 'Cancel'])
  if (result === 0) {
    logDebug('Create Samples')
  }
}

export async function templateTest(): Promise<void> {
  try {
    let plugins = DataStore.installedPlugins()
    plugins.forEach((plugin) => {
      clo(plugin)
    })
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateWOTD(): Promise<void> {
  try {
    const url = 'https://wordsapiv1.p.rapidapi.com/words/?random=true'

    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'Xwiq2Q2FCrmshVLkpU1ApDOasM3rp1OIm7vjsnlVvRfpkFBmeX',
        'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com',
      },
    }

    const result = await fetch(url, options)

    let data = JSON.parse(result)

    Editor.insertTextAtCursor(data.word)

    // Editor.insertTextAtCursor(response)
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateConvertNote(): Promise<void> {
  if (typeof Editor.type === 'undefined') {
    await CommandBar.prompt('Conversion Error', 'Please select the Project Note you would like to convert and try again.')
    return
  }

  if (Editor.type !== 'Notes') {
    await CommandBar.prompt('Conversion Error', 'You can only convert Project Notes')
    return
  }

  const note = Editor.content || ''

  const result = new FrontmatterModule().convertProjectNoteToFrontmatter(note)
  switch (result) {
    case -1:
      await CommandBar.prompt('Conversion Falied', 'Unable to convert Project Note.')
      break
    case -2:
      await CommandBar.prompt('Conversion Falied', 'Project Note must have Title (starts with # character)')
      break
    case -3:
      await CommandBar.prompt('Conversion Falied', 'Project Note already in Frontmatter Format')
      break
  }

  if (typeof result === 'string') {
    // select all the text, it will be overwritten by insert of new note
    Editor.selectAll()

    // replace selected text with converted template
    Editor.insertTextAtCursor(result.toString())

    // set cursor at the top of the note
    Editor.highlightByIndex(0, 0)
  }
}

export async function templateExecute(templateName?: string, userData?: any): Promise<void> {
  try {
    let selectedTemplateFilename
    if (templateName) {
      const notes = await DataStore.projectNoteByTitle(templateName, true)
      clo(notes, `templateExecute searching for templateName="${templateName}"`)
      if (notes?.length) {
        selectedTemplateFilename = notes[0].filename
      } else {
        logError(pluginJson, `Unable to locate template: ${templateName} which was passed to templateExecute`)
      }
    }
    selectedTemplateFilename =
      selectedTemplateFilename ?? (await NPTemplating.chooseTemplate('template-fragment', 'Choose Template Fragment', { templateGroupTemplatesByFolder: false }))
    clo(userData, `templateExecute selectedTemplateFilename="${selectedTemplateFilename}" userData=`)
    await NPTemplating.renderTemplate(selectedTemplateFilename, userData)
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

export async function getTemplate(templateName: string = '', options: any = { showChoices: true }): Promise<string> {
  return await NPTemplating.getTemplate(templateName, options)
}

export async function renderFrontmatter(templateData: string = '', userData: any = {}): Promise<any> {
  logDebug(pluginJson, `renderFrontmatter: calling renderFrontmatter() with templateData: "${templateData}" and userData: ${JSON.stringify(userData)}`)
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.renderFrontmatter(templateData, userData)

  return { frontmatterBody, frontmatterAttributes }
}

export async function render(inTemplateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  return await NPTemplating.render(inTemplateData, userData, userOptions)
}

export async function renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  return await NPTemplating.renderTemplate(templateName, userData, userOptions)
}

export async function templateFileByTitle(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string = '') {
  await templateRunnerExecute(selectedTemplate, openInEditor, args)
}
