// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from 'NPTemplating'
import { getTemplateFolder, getTemplateList, log } from 'NPTemplating'

import { chooseOption } from '@helpers/userInput'
import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getWeather } from '../lib/support/modules/weather'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'
import { initConfiguration, migrateConfiguration } from '../../helpers/configuration'

import pluginJson from '../plugin.json'

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    log('onUpdateOrInstall')

    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration('templates', pluginJson, config?.silent)

    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateSettings = await NPTemplating.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    // set application settings with any adjustments after template specific updates
    DataStore.settings = { ...templateSettings }
  } catch (error) {
    log(error)
  }
}

export async function templateInit(): Promise<void> {
  const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
  if (typeof pluginSettingsData === 'object') {
    const result = await CommandBar.prompt(
      'np.Templating',
      'np.Templating settings have already been created. \n\nWould you like to reset to default settings?',
      ['Yes', 'No'],
    )

    if (result === 0) {
      DataStore.settings = { ...(await initConfiguration(pluginJson)) }
    }
  } else {
    onUpdateOrInstall({ silent: true })
  }
}

export async function templateInsert(): Promise<void> {
  if (!Editor.content) {
    await CommandBar.prompt(
      'Template Error',
      'You must have a Project Note or Calendar Note opened where you wish to insert template.',
    )
    return
  }

  const options = await getTemplateList()

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const templateTitle = selectedTemplate?.title

  const result = await NPTemplating.renderTemplate(templateTitle)

  Editor.insertTextAtCursor(result)
}

export async function templateAppend(): Promise<void> {
  if (!Editor.content) {
    await CommandBar.prompt(
      'Template Notice',
      'You must have a Project Note or Calendar Note opened where you wish to append template.',
    )
    return
  }

  const content: string = Editor.content || ''

  const options = await getTemplateList()

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const templateTitle = selectedTemplate?.title

  const renderedTemplate = await NPTemplating.renderTemplate(templateTitle)
  const processed = await NPTemplating.postProcess(renderedTemplate)

  Editor.insertTextAtCharacterIndex(renderedTemplate, content.length)
}

export async function templateNew(): Promise<void> {
  const title = await CommandBar.textPrompt('Template', 'Enter New Note Title', '')
  if (typeof title === 'boolean' || title.length === 0) {
    return // user did not provide note title (Cancel) abort
  }

  const folderList = await DataStore.folders.slice().sort()

  const folder = await chooseOption(
    'Where would you like to create new note?',
    folderList.map((folder) => ({
      label: folder,
      value: folder,
    })),
    '/',
  )

  const templateName = await selectTemplate()

  const noteTitle = title.toString()
  const filename = DataStore.newNote(noteTitle, folder) || ''
  if (filename) {
    const templateResult = await NPTemplating.renderTemplate(templateName)
    await Editor.openNoteByFilename(filename)
    Editor.content = `# ${noteTitle}\n${templateResult}`
  }
}

export async function selectTemplate(): Promise<string> {
  const options = await getTemplateList()

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const templateTitle = selectedTemplate?.title || ''

  return templateTitle
}

// $FlowIgnore
export async function templateWeather(): Promise<string> {
  try {
    // $FlowIgnore
    const weather: string = getWeather()

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
