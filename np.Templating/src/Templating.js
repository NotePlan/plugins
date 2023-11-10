// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { log, clo, logDebug, logError } from '@helpers/dev'
import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'
import { timestamp } from '@templatingModules/DateModule'

import { getTemplateFolder } from 'NPTemplating'
import { helpInfo } from '../lib/helpers'
import { getSetting } from '@helpers/NPConfiguration'
import { smartPrependPara, smartAppendPara } from '@helpers/paragraph'

// helpers
import { getWeatherSummary } from '../lib/support/modules/weatherSummary'
import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getWeather } from '../lib/support/modules/weather'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'

import { initConfiguration, updateSettingData } from '@helpers/NPConfiguration'
import { selectFirstNonTitleLineInEditor } from '@helpers/NPnote'
import { hasFrontMatter, setFrontMatterVars } from '@helpers/NPFrontMatter'

import pluginJson from '../plugin.json'
import DateModule from '../lib/support/modules/DateModule'

// Editor
import { templateFileByTitleEx } from './NPEditor'
import { getNoteByFilename } from '../../helpers/note'

export async function init(): Promise<void> {
  try {
    // executes before any np.Templating command
  } catch (error) {
    logError(pluginJson, error)
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
    let result: number = 0
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    // if we don't have settings, this will be a first time install so we will perform migrations
    if (typeof pluginSettingsData == 'undefined') {
      result = updateSettingData(pluginJson)
    }

    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateSettings = await NPTemplating.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    // set application settings with any adjustments after template specific updates
    DataStore.settings = { ...templateSettings }

    const pluginList = DataStore.installedPlugins()
    // clo(pluginList)

    const version = await DataStore.invokePluginCommandByName('np:about', 'np.Templating', [{}])
    console.log(version)
  } catch (error) {
    logError(pluginJson, error)
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

export async function templateInsert(templateName: string = ''): Promise<void> {
  try {
    if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
      const selectedTemplate = templateName.length > 0 ? templateName : await NPTemplating.chooseTemplate()
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)

      // $FlowIgnore
      const renderedTemplate = await NPTemplating.render(frontmatterBody, frontmatterAttributes)

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
    if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
      const content: string = Editor.content || ''

      // $FlowIgnore
      const selectedTemplate = templateName.length > 0 ? templateName : await NPTemplating.chooseTemplate()
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      let { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)
      let data = { ...frontmatterAttributes, frontmatter: { ...frontmatterAttributes } }

      let renderedTemplate = await NPTemplating.render(frontmatterBody, data)

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
        const notes = await DataStore.projectNoteByTitle(templateName, true, true)
        if (notes?.length) {
          selectedTemplateFilename = notes[0].filename
        } else {
          logError(pluginJson, `Unable to locate template: ${templateName} which was passed to templateExecute`)
        }
      }
      // $FlowIgnore
      const selectedTemplate = selectedTemplateFilename ?? (await NPTemplating.chooseTemplate())
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      let { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)
      let data = { ...frontmatterAttributes, frontmatter: { ...frontmatterAttributes } }

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

export async function templateNew(templateTitle: string = '', _folder?: string): Promise<void> {
  try {
    let selectedTemplate // will be a filename
    if (templateTitle?.trim().length) {
      const options = await NPTemplating.getTemplateList()
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        // variable passed is a note title, but we need the filename
        selectedTemplate = chosenOpt.value
      }
    } else {
      // ask the user for the template
      selectedTemplate = await NPTemplating.chooseTemplate()
    }
    const templateData = await NPTemplating.getTemplate(selectedTemplate)
    const templateAttributes = await NPTemplating.getTemplateAttributes(templateData)

    let folder = _folder ?? ''
    let noteTitle = ''

    const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)

    if (!folder && frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0) {
      folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
    }

    if (frontmatterAttributes.hasOwnProperty('newNoteTitle')) {
      noteTitle = frontmatterAttributes.newNoteTitle
    } else {
      const title = await CommandBar.textPrompt('Template', 'Enter New Note Title', '')
      if (typeof title === 'boolean' || title.length === 0) {
        return // user did not provide note title (Cancel) abort
      }
      noteTitle = title
    }

    if (noteTitle.length === 0) {
      return
    }

    const filename = DataStore.newNote(noteTitle, folder) || ''

    if (filename) {
      const data = {
        data: {
          ...frontmatterAttributes,
          ...{
            noteTitle,
          },
        },
      }

      const templateResult = await NPTemplating.render(frontmatterBody, data)

      await Editor.openNoteByFilename(filename)

      const hasFM = hasFrontMatter(templateResult)
      if (hasFM) {
        Editor.content = templateResult
        setFrontMatterVars(Editor, { title: noteTitle })
      } else {
        Editor.content = `# ${noteTitle}\n${templateResult}`
      }
      selectFirstNonTitleLineInEditor()
    } else {
      await CommandBar.prompt('New Template', `An error occured creating ${noteTitle} note`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateQuickNote(templateTitle: string = ''): Promise<void> {
  try {
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
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)

        let folder = frontmatterAttributes?.folder?.trim() ?? ''
        if (frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0) {
          folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
        }

        let newNoteTitle = ''
        if (frontmatterAttributes?.newNoteTitle) {
          newNoteTitle = frontmatterAttributes.newNoteTitle
        } else {
          newNoteTitle = (await CommandBar.textPrompt('Quick Note', 'Enter Note Title', '')) || ''
          if (typeof newNoteTitle === 'boolean' || newNoteTitle.length === 0) {
            return // user did not provide note title (Cancel) abort
          }
        }

        const filename = DataStore.newNote(newNoteTitle, folder) || ''
        if (filename) {
          const data = {
            data: {
              ...frontmatterAttributes,
              ...{
                noteTitle: newNoteTitle,
              },
            },
          }

          // $FlowIgnore
          let finalRenderedData = await NPTemplating.render(frontmatterBody, data)

          await Editor.openNoteByFilename(filename)

          const lines = finalRenderedData.split('\n')
          const startBlock = lines.indexOf('--')
          const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1

          if (startBlock >= 0 && endBlock >= 0) {
            lines[startBlock] = '---'
            lines[endBlock] = '---'
            Editor.content = lines.join('\n')
          } else {
            Editor.content = `# ${newNoteTitle}\n${finalRenderedData}`
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
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)

        let folder = frontmatterAttributes?.folder.trim() ?? ''
        if (frontmatterAttributes?.folder && frontmatterAttributes.folder.length > 0) {
          folder = await NPTemplating.getFolder(frontmatterAttributes.folder, 'Select Destination Folder')
        }

        let newNoteTitle = ''
        if (frontmatterAttributes?.newNoteTitle) {
          newNoteTitle = frontmatterAttributes.newNoteTitle
        } else {
          const format = getSetting('np.Templating', 'timestampFormat')
          const info = await CommandBar.textPrompt('Meeting Note', 'What is date/time of meeeting?', timestamp(format))
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
          const data = {
            data: {
              ...frontmatterAttributes,
              ...{
                noteTitle: newNoteTitle,
              },
            },
          }

          let finalRenderedData = await NPTemplating.render(frontmatterBody, data)

          await Editor.openNoteByFilename(filename)

          const lines = finalRenderedData.split('\n')
          const startBlock = lines.indexOf('--')
          const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1

          if (startBlock >= 0 && endBlock >= 0) {
            lines[startBlock] = '---'
            lines[endBlock] = '---'
            Editor.content = lines.join('\n')
          } else {
            Editor.content = `# ${newNoteTitle}\n${finalRenderedData}`
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
 * @param {Array<string>} args - the first argument is the template name (required), the optional second param is whether to display the template in the editor. By default no (false/runs silently), after that, any additional arguments are key=value pairs passed to the template
 * @example
 * @returns {Promise<void>}
 *
 */
export async function templateRunner(...args: Array<string>) {
  try {
    if (args.length > 0) {
      templateFileByTitle(args[0], args[1] === 'true', args.length > 2 ? args[2] : '')
    } else {
      await CommandBar.prompt(`No arguments (with template name) were given to the templateRunner."`, helpInfo('Presets'))
    }
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
    console.log('Create Samples')
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

export async function templateExecute(templateName?: string): Promise<void> {
  try {
    let selectedTemplateFilename
    if (templateName) {
      const notes = await DataStore.projectNoteByTitle(templateName, true, true)
      if (notes?.length) {
        selectedTemplateFilename = notes[0].filename
      } else {
        logError(pluginJson, `Unable to locate template: ${templateName} which was passed to templateExecute`)
      }
    }
    selectedTemplateFilename =
      selectedTemplateFilename ?? (await NPTemplating.chooseTemplate('template-fragment', 'Choose Template Fragment', { templateGroupTemplatesByFolder: false }))
    await NPTemplating.renderTemplate(selectedTemplateFilename)
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

export async function getTemplate(templateName: string = '', options: any = { showChoices: true }): Promise<string> {
  return await NPTemplating.getTemplate(templateName, options)
}

export async function preRender(templateData: string = '', userData: any = {}): Promise<any> {
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData, userData)

  return { frontmatterBody, frontmatterAttributes }
}

export async function render(inTemplateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  return await NPTemplating.render(inTemplateData, userData, userOptions)
}

export async function renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
  return await NPTemplating.renderTemplate(templateName, userData, userOptions)
}

export async function templateFileByTitle(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string = '') {
  await templateFileByTitleEx(selectedTemplate, openInEditor, args)
}
