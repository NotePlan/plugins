// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from 'NPTemplating'
import { getTemplateFolder, getTemplateList } from 'NPTemplating'

import { chooseOption } from '@helpers/userInput'
import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getWeather } from '../lib/support/modules/weather'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'
import { migrateConfiguration } from '../../helpers/configuration'

import pluginJson from '../plugin.json'

export async function onUpdateOrInstall(): Promise<void> {
  try {
    // get current plugin settings
    const pluginSettingData = DataStore.loadJSON('../np.Templating/settings.json')
    if (!pluginSettingData) {
      const configurationData = await migrateConfiguration('templates', pluginJson)
      if (configurationData) {
        DataStore.settings = { ...configurationData }
      }
    }

    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateConfig = await NPTemplating.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    DataStore.settings = { ...templateConfig }

    // if settings don't exists, show settings configuration to allow users ability to customize
    if (!pluginSettingData) {
      // await NotePlan.showConfigurationView()
      CommandBar.prompt(
        'NotePlan',
        'NotePlan.showConfigurationView() here\n\nNote: as of Version 3.3.2 (727) dialog freezes when displayed',
      )
    }

    // clear _configuration template configuration block
  } catch (error) {
    console.log(error)
  }
}

export async function templateInit(): Promise<void> {
  CommandBar.prompt('Template Error', 'An error occurred executing `templateInit`.')
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
  const title = await CommandBar.textPrompt('Enter New Note Title', '', '').toString()
  if (!title) {
    return
  }

  const folderList = await DataStore.folders.slice().sort()

  const folder = await chooseOption(
    'Select folder to add note in:',
    folderList.map((folder) => ({
      label: folder,
      value: folder,
    })),
    '/',
  )

  const startWithTemplate = await chooseOption(
    'Do you want to get started with a template?',
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    false,
  )

  const templateName = startWithTemplate ? await selectTemplate() : ''

  let templateResult = ''
  if (templateName.length > 0) {
    templateResult = await NPTemplating.renderTemplate(templateName)
  }

  const filename = DataStore.newNote(title, folder) || ''
  if (filename) {
    await Editor.openNoteByFilename(filename)
    Editor.content = `# ${title}\n${templateResult}`
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
