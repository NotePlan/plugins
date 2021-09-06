// @flow

//------------------------------------------------------------------------------

import { showMessage, chooseOption, getInput } from '../../helpers/userInput'
import { getOrMakeConfigurationSection, getStructuredConfiguration, openConfigFileInEditor } from './configuration'
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

  const selectedTemplate = DataStore.projectNoteByTitle(templateTitle, true, false)?.[0]

  let templateContent = selectedTemplate?.content
  if (templateContent == null || templateContent.length === 0) {
    console.log(`\twarning: template '${templateTitle}' is null or empty`)
    return '<template was empty>'
  }

  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  // Read all _configuration settings
  const config = (await getStructuredConfiguration()) ?? {}
  // Go through template running any function tags
  const processedTemplateContent = await processTemplate(templateContent, config)
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

  Editor.content = [Editor.content, processedTemplateContent].filter(Boolean).join('\n')
}

/**
 * Apply (append) a Template, chosen by the user from a list, creating a new note if wanted
 * @author @nmn
 * @param {[string, string]} newNote [title, folder] - optional object that contains title then folder of note to create before applying the template
 */
export async function applyTemplate(newNote?: [string, string, string]) {
  const templateName = newNote && newNote[2]
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    console.log(`applyTemplate: warning: templateFolder is null`)
    await showMessage('Template Folder Not Found')
    // TODO: activate the 'makeTemplateFolder()' again?
    return
  }
  console.log(`applyTemplate: templateFolder = '${templateFolder}'`)

  const templateNotes = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))

  const options = templateNotes
    .filter((n) => (templateName ? n.title === templateName : true))
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

  console.log(`applyTemplate: found ${options.length} defined templates`)
  if (templateName && !templateNotes.filter((n) => n.title === templateName).length) {
    console.log(`applyTemplate: Warning: template '${templateName}' not found`)
    await showMessage(`Template "'${templateName}'" Not Found. Check _config`)
    return
  }

  // asking user which template to apply
  const selectedTemplate =
    options.length === 1 ? options[0].value : await chooseOption<TNote, void>('Choose Template', options)
  //$FlowIgnore
  console.log(`selectedTemplate=${JSON.stringify(selectedTemplate)}`)
  let templateContent = selectedTemplate?.content
  if (templateContent == null) {
    return
  }
  templateContent = templateContent.split('\n---\n').slice(1).join('\n---\n')

  const config = (await getStructuredConfiguration()) ?? {}

  const processedTemplateContent = await processTemplate(templateContent, config)
  console.log(`applyTemplate: processed template content: ${processedTemplateContent.length} chars`)

  // if we specified a new note's details, make it first
  if (newNote != null) {
    const [title, folder] = newNote
    const filename = DataStore.newNote(title, folder)
    console.log(`applyTemplate: new note created: ${String(filename)}`)
    if (!filename) {
      console.log(`applyTemplate: There was an error creating new note '${title}' in '${folder}'`)
      await showMessage('There was an error creating your note :(')
      return
    }
    await Editor.openNoteByFilename(filename)
    Editor.content = `# ${title}\n${processedTemplateContent}`
  } else {
    Editor.content = [Editor.content, processedTemplateContent].filter(Boolean).join('\n')
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
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

  console.log(`insertTemplate: found ${options.length} defined templates`)

  // asking user which template to apply
  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

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
export async function insertNamedTemplate(templateTitle: string): Promise<void> {
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

const processTemplateTags = async (templateContent: string): Promise<string> => {
  const config = (await getStructuredConfiguration()) ?? {}
  // Go through template running any function tags
  return await processTemplate(templateContent, config)
}

/**
 * Create a new note from a template, asking user title of note, where to put it, and which template to use
 * @author @nmn
 */
export async function newNoteWithTemplate(
  template: string = '',
  fileName: string = '',
  targetFolder: string = '',
): Promise<void> {
  const title = fileName
    ? await processTemplateTags(fileName)
    : await getInput('Enter title of the new note', "Create a new note with title '%@'")

  let folder = targetFolder
  console.log(`newNoteWithTemplate() template="${template}" fileName="${fileName}" targetFolder=${targetFolder}`)
  const folderList = await DataStore.folders.slice().sort()
  let folderFail = false
  if (targetFolder !== '' && !folderList.includes(targetFolder)) {
    console.log(
      `newNoteWithTemplate() template="${template}" Folder "${folder}" doesn't exist. Check config. For now. Will ask:`,
    )
    await showMessage(`Can't find folder '${targetFolder}' Pls check _config.`)
    await openConfigFileInEditor()
    folderFail = true
  }
  if (folderList.length > 0) {
    folder =
      folder !== ''
        ? folder
        : await chooseOption(
            'Select folder to add note in:',
            folderList.map((folder) => ({
              label: folder,
              value: folder,
            })),
            '/',
          )
  }
  if (folderFail) {
    await showMessage(`That folder is: "${folder}"`)
    await openConfigFileInEditor()
    return
  }
  if (!title) {
    console.log('newNoteWithTemplate: Error: undefined or empty title')
    await showMessage('Cannot create a note with an empty title')
    return
  }

  const templateFolder = await getOrMakeTemplateFolder()
  let shouldApplyTemplate = false

  if (templateFolder != null || templateFolder !== '') {
    shouldApplyTemplate =
      template !== ''
        ? template
        : await chooseOption(
            'Do you want to get started with a template?',
            [
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ],
            false,
          )
  }
  if (shouldApplyTemplate) {
    await applyTemplate([title, folder, template])
    return //TODO: FIXME: why is this here?
  }

  const filename = DataStore.newNote(title, folder)

  if (!filename) {
    console.log(`applyTemplate: There was an error creating new note '${title}' in '${folder}'`)
    await showMessage('There was an error creating your note :(')
    return
  }
  await Editor.openNoteByFilename(filename)
  console.log(`newNoteWithTemplate: new note created: ${String(filename)}`)
  Editor.content = `# ${title}\n`
  return
}

export async function quickTemplateNote() {
  const quickNotesArray = await getOrMakeConfigurationSection(
    'quickNotes',
    `  quickNotes: [
    { template: "Title of a template here", label: "Short descriptive name for this quickNote combination", title: "Title for the created note, can include template tags to be dynamic, e.g. Meeting with {{askForName}} on {{date8601()}}", folder: "MyRootFolder/MySubFolder",    editThis: true  /* delete this comment and the editThis after you have edited this */   },
  ],`,
  )
  console.log(`\nquickTemplateNote: quickNotesArray=${String(JSON.stringify(quickNotesArray))}`)
  let chosenItem
  if (quickNotesArray && quickNotesArray.length) {
    //$FlowIgnore
    if (quickNotesArray.length === 1 && quickNotesArray[0].editThis) {
      console.log(`quickTemplateNote: editThis=true, so user should edit config`)
      await showMessage(`Please edit the configuration file to add your quick notes.`)
      await openConfigFileInEditor()
      return
    }
    //$FlowFixMe
    const options = quickNotesArray.map((q) => ({ label: q.label, value: q }))
    // console.log(`quickTemplateNote options=${JSON.stringify(options)}`)
    //$FlowFixMe
    chosenItem = await chooseOption('Select a Quick Template:', options, quickNotesArray[0])
  } else {
    //$FlowIgnore
    console.log(`quickTemplateNote did not work. quickNotesArray=${JSON.stringify(quickNotesArray)}`)
    await showMessage('Requires Configuration. Read Templates Plugin Instructions')
    return
  }
  if (chosenItem) {
    //$FlowFixMe
    const { template, title, folder } = chosenItem
    if (template !== '' && title !== '' && folder !== '') {
      await newNoteWithTemplate(template, title, folder)
    } else {
      console.log(`Chosen template data invalid. chosenItem=${String(JSON.stringify(chosenItem))}`)
      // await showMessage('Check your _configuration for that setting')
    }
  }
}
