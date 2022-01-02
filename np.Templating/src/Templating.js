// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from 'NPTemplating'

import { showMessage, chooseOption, getInput } from '@helpers/userInput'
import { getOrMakeTemplateFolder } from '@templating/toolbox'
import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getWeather } from '../lib/support/modules/weather'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'

export async function templateInit(): Promise<void> {
  await getOrMakeTemplateFolder()
}

export async function templateInsert(): Promise<void> {
  if (Editor == null) {
    await showMessage('Open desired note you wish to insert template')
    return
  }

  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    await showMessage('An error occured locating 📋 Templates folder')
    return
  }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const templateTitle = selectedTemplate?.title

  const result = await NPTemplating.renderTemplate(templateTitle)
  console.log('result')

  Editor.insertTextAtCursor(result)
}

export async function templateAppend(): Promise<void> {
  if (Editor == null) {
    await showMessage('Open desired note you wish to insert template')
    return
  }

  const content: string = Editor.content || ''

  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    await showMessage('An error occured locating 📋 Templates folder')
    return
  }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const templateTitle = selectedTemplate?.title

  const result = await NPTemplating.renderTemplate(templateTitle)

  Editor.insertTextAtCharacterIndex(result, content.length)
}

export async function templateNew(): Promise<void> {
  const title = await getInput('Enter title of the new note', "Create a new note with title '%@'")

  const folderList = await DataStore.folders.slice().sort()

  const folder = await chooseOption(
    'Select folder to add note in:',
    folderList.map((folder) => ({
      label: folder,
      value: folder,
    })),
    '/',
  )

  if (!title) {
    await showMessage('Cannot create a note with an empty title')
    return
  }

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
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    await showMessage('An error occured locating 📋 Templates folder')
    return ''
  }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

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
