// @flow

//------------------------------------------------------------------------------

import {
  showMessage,
  chooseOption,
  getInput,
} from '../../nmn.sweep/src/userInput'

import { getDefaultConfiguration, getOrMakeConfigurationSection } from './configuration'
import { processTemplate } from './interpolation'
import { getTemplateFolder, getOrMakeTemplateFolder } from './template-folder'

//------------------------------------------------------------------------------

export async function applyNamedTemplate(templateName: string) {
  console.log(`applyNamedTemplate: for template '${templateName}'`)
  
  // const templateFolder = await getOrMakeTemplateFolder()
  // if (templateFolder == null) {
  //   console.log(`\twarning: templateFolder is null`)
  //   await getOrMakeTemplateFolder()
  //   await showMessage('Try using this command again to use a template')
  //   return
  // }

  const selectedTemplate = DataStore.projectNoteByTitle(templateName, true, false)[0]

  let templateContent = selectedTemplate?.content
  if (templateContent == null || templateContent.length === 0) {
    console.log(`\twarning: template '${templateName}' is null or empty`)
    return
  }
  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  const config = (await getDefaultConfiguration()) ?? {}

  const processedTemplateContent = await processTemplate(
    templateContent,
    config,
  )

  Editor.content = [Editor.content, processedTemplateContent]
    .filter(Boolean)
    .join('\n')
}

export async function applyTemplate(newNote?: [string, string]) {
  const templateFolder = await getOrMakeTemplateFolder()
  // if (templateFolder == null) {
  //   console.log(`applyTemplate: warning: templateFolder is null`)
  //   await makeTemplateFolder()
  //   await showMessage('Try using this command again to use a template')
  //   return
  // }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) =>
      note.title == null ? null : { label: note.title, value: note },
    )
    .filter(Boolean)

  console.log(`applyTemplate: found ${options.length} options`)

  // console.log(`applyTemplate: asking user which template:`)
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
    await showMessage('Cannot create a note with an empty title')
    return
  }

  const templateFolder = await getOrMakeTemplateFolder()
  let shouldApplyTemplate = false

  if (templateFolder != null || templateFolder !== '') {
    shouldApplyTemplate = await chooseOption(
      'Do you want to get started with a template?',
      [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
      false,
    )
  }
  if (shouldApplyTemplate) {
    await applyTemplate([title, folder])
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
