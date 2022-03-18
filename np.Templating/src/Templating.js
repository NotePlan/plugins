// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import { getTemplateFolder, getTemplateList } from 'NPTemplating'

import { chooseOption } from '@helpers/userInput'
import { getOrMakeNote } from '@helpers/note'

import { getAffirmation } from '../lib/support/modules/affirmation'
import { getAdvice } from '../lib/support/modules/advice'
import { getWeather } from '../lib/support/modules/weather'
import { getDailyQuote } from '../lib/support/modules/quote'
import { getVerse, getVersePlain } from '../lib/support/modules/verse'
import { getConfiguration, initConfiguration, migrateConfiguration, updateSettingData } from '../../helpers/NPconfiguration'
import { log, logError } from '@helpers/dev'

import pluginJson from '../plugin.json'

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    if (typeof pluginSettingsData == 'undefined') {
      templateMigration()
    }

    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    let result: number = await migrateConfiguration('templates', pluginJson, config?.silent)
    if (result === 0) {
      result = updateSettingData(pluginJson)
    }

    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateSettings = await NPTemplating.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    // set application settings with any adjustments after template specific updates
    DataStore.settings = { ...templateSettings }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function migrateQuickNotes() {
  const configData = await getConfiguration('quickNotes')

  configData.forEach(async (quickNote) => {
    // console.log('label: ' + quickNote.label)
    // console.log('template: ' + quickNote.template)
    // console.log('title: ' + quickNote.title)
    // console.log('folder: ' + quickNote.folder)
    const templateFilename = `🗒 Quick Notes/${quickNote.label}`
    const templateData: ?TNote = await getOrMakeNote(quickNote.template, '📋 Templates')

    let title = quickNote.title
    title = title.replace('{{meetingName}}', '<%- meetingName %>')
    title = title.replace('{{MeetingName}}', '<%- meetingName %>')
    title = title.replace('{{date8601()}}', '<%- date8601() %>')
    title = title.replace("{{weekDates({format:'yyyy-MM-dd'})}}", "<%- date.startOfWeek('ddd YYYY-MM-DD',null,1) %>  - <%- date.endOfWeek('ddd YYYY-MM-DD',null,1) %>")
    const metaData = {
      newNoteTitle: title,
      folder: quickNote.folder,
    }

    // $FlowIgnore
    const result = await NPTemplating.createTemplate(templateFilename, metaData, templateData.content)
  })
}

export async function templateInit(): Promise<void> {
  const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
  if (typeof pluginSettingsData === 'object') {
    const result = await CommandBar.prompt('np.Templating', 'np.Templating settings have already been created. \n\nWould you like to reset to default settings?', ['Yes', 'No'])

    if (result === 0) {
      DataStore.settings = { ...(await initConfiguration(pluginJson)) }
    }
  } else {
    onUpdateOrInstall({ silent: true })
  }
}

export async function templateInsert(): Promise<void> {
  if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
    const options = await getTemplateList()

    const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

    // $FlowIgnore
    const renderedTemplate = await NPTemplating.renderTemplate(selectedTemplate, null, { usePrompts: true })

    Editor.insertTextAtCursor(renderedTemplate)
  } else {
    await CommandBar.prompt('Template', 'You must have a Project Note or Calendar Note opened where you wish to insert template.')
  }
}

export async function templateAppend(): Promise<void> {
  if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
    const content: string = Editor.content || ''

    const options = await getTemplateList()

    const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

    // $FlowIgnore
    let renderedTemplate = await NPTemplating.renderTemplate(selectedTemplate, {}, { usePrompts: true })

    Editor.insertTextAtCharacterIndex(renderedTemplate, content.length)
  } else {
    await CommandBar.prompt('Template', 'You must have a Project Note or Calendar Note opened where you wish to append template.')
  }
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

  const options = await getTemplateList()

  const selectedTemplate = await chooseOption<TNote, void>('Choose Template', options)

  const noteTitle = title.toString()
  const filename = DataStore.newNote(noteTitle, folder) || ''
  if (filename) {
    // $FlowIgnore
    const templateResult = await NPTemplating.renderTemplate(selectedTemplate, null, { usePrompts: true })
    await Editor.openNoteByFilename(filename)
    Editor.content = `# ${noteTitle}\n${templateResult}`
  }
}

// $FlowIgnore
export async function templateWeather(): Promise<string> {
  try {
    // $FlowIgnore
    const weather: string = await getWeather()

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

export async function migrateTemplates(silent: boolean = false): Promise<void> {
  try {
    const templateFolder = '📋 Templates'
    const newTemplateFolder: string = '@Templates' // NotePlan.environment.templateFolder

    const templateNotes = DataStore.projectNotes.filter((n) => n.filename?.startsWith(templateFolder)).filter((n) => !n.title?.startsWith('_configuration'))
    const newTemplates = DataStore.projectNotes.filter((n) => n.filename?.startsWith(newTemplateFolder)).filter((n) => !n.title?.startsWith('_configuration'))

    if (newTemplates.length > 0) {
      let result = await CommandBar.prompt('Template Migration', 'Templates have already been migrated.\n\nWould you like to overwrite existing templates', ['Yes', 'No'])
      if (result === 1) {
        return
      }
    }

    // proceed with migration
    let newNoteCounter = 0
    templateNotes.forEach((note) => {
      const noteFilename = note.filename || ''
      let content = ''
      if (noteFilename.indexOf(templateFolder) !== -1) {
        const parts = note.filename.split('/')
        const item = parts.shift()
        const noteTitle = parts.pop().replace('.md', '')
        const folderName = parts.join('/')
        if (noteTitle.length > 0 && noteTitle !== '_configuration') {
          content = note.content || ''
          content = content.replace(/{{/gi, '<%- ').replace(/}}/gi, ' %>')

          const fullPath = `${newTemplateFolder}/${folderName}/${noteTitle}.md`.replace('//', '/').replace('(', '').replace(')', '')
          const testNote = DataStore.projectNoteByFilename(fullPath)

          let filename = fullPath
          if (!testNote) {
            filename = DataStore.newNote(noteTitle, `${newTemplateFolder}/${folderName}`)
            if (filename && content.length > 0) {
              const newNote = DataStore.projectNoteByFilename(filename)
              if (newNote) {
                newNote.content = content
              }
            }
          } else {
            testNote.content = content
          }

          newNoteCounter++
        }
      }
    })

    // after migration complete, migrate "_configuration;:quickNotes"
    migrateQuickNotes()

    await CommandBar.prompt('Template Migration', `${newNoteCounter} Templates Converted Successfully`)
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function templateQuickNote(noteName: string = ''): Promise<void> {
  try {
    const content: string = Editor.content || ''
    let quickNoteTemplatesFolder: string = DataStore.settings?.quickNotesFolder || 'Quick Notes'

    const options = await getTemplateList(quickNoteTemplatesFolder)
    if (options.length === 0) {
      await CommandBar.prompt(
        'Templating',
        `Unable to locate any Quick Notes templates in "@Templates/${quickNoteTemplatesFolder}" folder.\n\nIf you wish to store Quick Notes in a different folder, you can customize location in np.Templating Settings.`,
      )
      return
    }
    const selectedTemplate = await chooseOption<TNote, void>('Choose Quick Note', options)
    if (selectedTemplate) {
      // $FlowIgnore
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      const isFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateData)
      // $FlowIgnore
      const renderedData = await NPTemplating.renderTemplate(selectedTemplate, null, { usePrompts: true, qtn: true })

      if (isFrontmatter) {
        const frontmatterData = new FrontmatterModule().render(renderedData)
        const frontmatterAttributes = frontmatterData?.attributes || {}
        const data = { frontmatter: frontmatterAttributes }
        const frontmatterBody = await NPTemplating.render(frontmatterData?.body, data, { usePrompts: true })

        const newNoteTitle = frontmatterAttributes.newNoteTitle
        const folder = frontmatterAttributes.folder

        const filename = DataStore.newNote(newNoteTitle, folder) || ''
        if (filename) {
          await Editor.openNoteByFilename(filename)
          Editor.content = `# ${newNoteTitle}\n${frontmatterBody}`
        }
      }
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}
