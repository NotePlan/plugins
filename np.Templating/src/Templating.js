// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { showMessage, chooseOption, getInput } from '../../helpers/userInput'
import { getOrMakeTemplateFolder } from '../../nmn.Templates/src/template-folder'
import NPTemplating from '../lib/NPTemplating'

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
