// @flow

//------------------------------------------------------------------------------

import {
  showMessage,
  chooseOption,
  getInput,
} from '../../helperFunctions' // TODO: '../../helperFunctions/inputFunctions'

import { getStructuredConfiguration } from './configuration'
import { processTemplate } from './templateController'
import { getOrMakeTemplateFolder } from './template-folder'

//------------------------------------------------------------------------------

/**
 * Process the named template ready for inclusion somewhere
 * @author @nmn, split out into this helper function by @jgclark
 * @param {string} templateTitle - name of an existing template to process
 */
async function getProcessedTemplate(templateTitle: string): Promise<string> {
  // const templateFolder = await getOrMakeTemplateFolder()
  // if (templateFolder == null) {
  //   console.log(`\twarning: templateFolder is null`)
  //   await getOrMakeTemplateFolder()
  //   await showMessage('Try using this command again to use a template')
  //   return
  // }

  const selectedTemplate = DataStore.projectNoteByTitle(
    templateTitle,
    true,
    false,
  )?.[0]

  let templateContent = selectedTemplate?.content
  if (templateContent == null || templateContent.length === 0) {
    console.log(`\twarning: template '${templateTitle}' is null or empty`)
    return '<template was empty>'
  }

  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  // Read all _configuration settings
  const config = (await getStructuredConfiguration()) ?? {}
  // Go through template running any function tags
  const processedTemplateContent = await processTemplate(
    templateContent,
    config,
  )
  return processedTemplateContent
}

/**
 * Apply (append) a Template, selected by its title
 * @author @nmn, split into two funcs by @jgclark
 * @param {string} templateTitle - name of an existing template to append to the current note
 */
export async function applyNamedTemplate(templateTitle: string) {
  if (Editor == null) {
    await showMessage('Please run again with a note open in the editor')
    return
  }
  console.log(`applyNamedTemplate: for template '${templateTitle}'`)

  const processedTemplateContent = await getProcessedTemplate(templateTitle)

  Editor.content = [Editor.content, processedTemplateContent]
    .filter(Boolean)
    .join('\n')
}

/** 
 * Apply (append) a Template, chosen by the user from a list, creating a new note if wanted
 * @author @nmn
 * @param {[string, string]} newNote [title, folder] - optional object that contains title then folder of note to create before applying the template
 */
export async function applyTemplate(newNote?: [string, string]) {
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    console.log(`applyTemplate: warning: templateFolder is null`)
    await showMessage('Template Folder Not Found')
    // TODO: activate the 'makeTemplateFolder()' again?
    return
  }
  console.log(`applyTemplate: templateFolder = '${templateFolder}'`)

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) =>
      note.title == null ? null : { label: note.title, value: note },
    )
    .filter(Boolean)

  console.log(`applyTemplate: found ${options.length} defined templates`)

  // asking user which template to apply
  const selectedTemplate = await chooseOption<TNote, void>(
    'Choose Template',
    options,
  )
  let templateContent = selectedTemplate?.content
  if (templateContent == null) {
    return
  }
  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  const config = (await getStructuredConfiguration()) ?? {}

  const processedTemplateContent = await processTemplate(
    templateContent,
    config,
  )

  // if we specified a new note's details, make it first
  if (newNote != null) {
    const [title, folder] = newNote
    const filename = DataStore.newNote(title, folder)
    if (!filename) {
      console.log(`applyTemplate: There was an error creating new note '${title}' in '${folder}'`)
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

/** 
 * Insert a Template (chosen by user from list) at the cursor position
 * @author @jgclark, based on @nmn original
 * @param {string} templateTitle - name of an existing template to append to the current note
 */
export async function insertTemplate() {
  if (Editor == null) {
    await showMessage('Please run again with a note open in the editor')
    return
  }
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    console.log(`applyTemplate: warning: templateFolder is null`)
    await showMessage('Oops: Template Folder Not Found')
    return
  }
  console.log(`insertTemplate: templateFolder = '${templateFolder}'`)

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) =>
      note.title == null ? null : { label: note.title, value: note },
    )
    .filter(Boolean)

  console.log(`insertTemplate: found ${options.length} defined templates`)

  // asking user which template to apply
  const selectedTemplate = await chooseOption<TNote, void>(
    'Choose Template',
    options,
  )
  
  const templateTitle = selectedTemplate?.title
  if (templateTitle == null) {
    console.log(`insertTemplate: error: can't get template title`)
    await showMessage(`Oops: can't get template title`)
    return
  }

  const processedTemplateContent = await getProcessedTemplate(templateTitle)
  Editor.insertTextAtCursor(processedTemplateContent)
}

/** 
 * Insert a Template (chosen by user from list) at the cursor position
 * @author @jgclark, based on @nmn original
 * @param {string} templateTitle - name of an existing template to append to the current note
 */
export async function insertNamedTemplate(templateTitle: string):
  Promise<void> {
  if (Editor == null) {
    await showMessage('Please run again with a note open in the editor')
    return
  }
  console.log(`insertNamedTemplateTitle: for template '${templateTitle}'`)

  const processedTemplateContent = await getProcessedTemplate(templateTitle)

  if (templateTitle == null) {
    console.log(`insertTemplate: error: can't get template title`)
    await showMessage(`Oops: can't get template title`)
    return
  }

  Editor.insertTextAtCursor(processedTemplateContent)
}

/** 
 * Create a new note from a template, asking user title of note, where to put it, and which template to use
 * @author @nmn
 */
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
    console.log('newNoteWithTemplate: Error: undefined or empty title')
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
    console.log(`applyTemplate: There was an error creating new note '${title}' in '${folder}'`)
    await showMessage('There was an error creating your note :(')
    return
  }

  await Editor.openNoteByFilename(filename)
  Editor.content = `# ${title}\n`
}
