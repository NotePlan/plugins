// @flow

import {
  showMessage,
  chooseOption,
  getInput,
} from '../../nmn.sweep/src/userInput'
import { getDefaultConfiguration } from './configuration'
import { processTemplate } from './interpolation'

import { getTemplateFolder, makeTemplateFolder } from './template-folder'

export async function addTemplate(newNote?: [string, string]) {
  const templateFolder = await getTemplateFolder()

  if (templateFolder == null) {
    console.log(`addTemplate: templateFolder is null`)
    await makeTemplateFolder()
    await showMessage('Try using this command again to use a template')
    return
  }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) =>
      note.title == null ? null : { label: note.title, value: note },
    )
    .filter(Boolean)

  console.log(`addTemplate: found ${options.length} options`)

  console.log(`addTemplate: asking user which template:`)
  const selectedTemplate = await chooseOption<TNote, void>(
    'Choose Template',
    options,
  )
  let templateContent = selectedTemplate?.content
  if (templateContent == null) {
    return
  }
  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  const config = (await getDefaultConfiguration()) ?? {}

  const processedTemplateContent = await processTemplate(
    templateContent,
    config,
  )

  if (newNote != null) {
    const [title, folder] = newNote
    const filename = DataStore.newNote(title, folder)
    if (!filename) {
      await showMessage('There was an error creating your note :(')
      return
    }
    await Editor.openNoteByFilename(filename)
    Editor.content = `# ${title}\n${processedTemplateContent}`
  } else {
    Editor.content = [Editor.content, processedTemplateContent]
      .filter(Boolean)
      .join('\n')
  }
}

export async function newNoteWithTemplate() {
  const title = await getInput(
    'Enter title of the new note',
    "Create a new note with title '%@'",
  )

  let folder = '/'
  if (DataStore.folders.length > 0) {
    folder = await chooseOption(
      'Select folder to add note in:',
      DataStore.folders.map((folder) => ({
        label: folder,
        value: folder,
      })),
      '/',
    )
  }

  if (!title) {
    console.log('\tError: undefined or empty title')
    await showMessage('Cannot create a not with an empty title')
    return
  }

  const templateFolder = await getTemplateFolder()
  let shouldAddTemplate = false

  if (templateFolder != null || templateFolder !== '') {
    shouldAddTemplate = await chooseOption(
      'Do you want to get started with a template?',
      [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
      false,
    )
  }
  if (shouldAddTemplate) {
    await addTemplate([title, folder])
    return
  }

  const filename = DataStore.newNote(title, folder)

  if (!filename) {
    await showMessage('There was an error creating your note :(')
    return
  }

  await Editor.openNoteByFilename(filename)
  Editor.content = `# ${title}\n`
}
