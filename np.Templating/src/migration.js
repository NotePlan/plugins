// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { logError } from '@helpers/dev'

import { getTemplateFolder } from 'NPTemplating'
import { getConfiguration, initConfiguration, migrateConfiguration, updateSettingData } from '@helpers/NPConfiguration'
import { getOrMakeNote } from '@helpers/note'

import pluginJson from '../plugin.json'

export async function migrateTemplates(silent: boolean = false): Promise<any> {
  try {
    const templateFolder = '📋 Templates'
    const newTemplateFolder: string = await getTemplateFolder()

    const templateNotes = DataStore.projectNotes.filter((n) => n.filename?.startsWith(templateFolder)).filter((n) => !n.title?.startsWith('_configuration'))
    const newTemplates = DataStore.projectNotes.filter((n) => n.filename?.startsWith(newTemplateFolder)).filter((n) => !n.title?.startsWith('_configuration'))

    if (newTemplates.length > 0) {
      let result = await CommandBar.prompt(
        'Templates Already Migrated',
        'Your templates have already been migrated.\n\nAll existing templates will be moved to NotePlan Trash.\n\nAre you sure you wish to continue?',
        ['Continue', 'Stop'],
      )
      if (result === 1) {
        return 0
      }
      newTemplates.forEach((note) => {
        DataStore.moveNote(note.filename, '@Trash')
      })
    }

    // proceed with migration
    const newTemplateNotes = templateNotes.filter(async (note) => {
      const noteFilename = note.filename || ''
      let content = ''
      if (noteFilename.indexOf(templateFolder) !== -1) {
        const parts = note.filename.split('/')
        const item = parts.shift()
        const noteTitle = parts.pop().replace('.md', '')
        const folderName = parts.join('/')
        if (noteTitle.length > 0 && noteTitle !== '_configuration') {
          const originalNoteTitle: string = note?.title || ''
          if (originalNoteTitle.length > 0) {
            let content = note.content || ''
            content = content.replace(/{{/gi, '<%- ').replace(/}}/gi, ' %>')
            content = content.replace(' date(', ' legacyDate(')

            // handle some comment `pickDate` conversions
            content = content.replace(/pickDate/gi, 'promptDate')
            content = content.replace(/\{question:'Please enter a date:'\}/gi, "'dateVar','Pleasee enter a date:'")
            content = content.replace(/---/gi, '*****')

            // handle some comment `pickDate` conversions
            content = content.replace(/pickInterval/gi, 'promptInterval')
            content = content.replace(/\{question:'Date interval to use:'\}/gi, "'dateInterval','Date interval to use:'")

            let templateFilename = `${newTemplateFolder}/${folderName}/${noteTitle}`
            const fullPath = `${newTemplateFolder}/${folderName}/${noteTitle}.md`.replace('//', '/') // .replace('(', '').replace(')', '')
            const testNote = DataStore.projectNoteByFilename(note.filename)
            let filename = fullPath
            if (testNote) {
              let templateContent = `---\ntitle: ${originalNoteTitle}\ntype: empty-note\ntags: migrated-template\n---\n${content}`
              filename = DataStore.newNote(originalNoteTitle, `${newTemplateFolder}/${folderName}`)
              if (filename && content.length > 0) {
                const newNote = DataStore.projectNoteByFilename(filename)
                if (newNote) {
                  newNote.content = templateContent
                }
              }
              return { filename }
            }
          }
        }
      }
    })

    await CommandBar.prompt(`${newTemplateNotes.length} Templates Migrated Successfully`, 'Your template cache will be rebuilt now.')

    // this will throw error in console until it is available
    await NotePlan.resetCaches()

    return 1
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function migrateQuickNotes(): Promise<any> {
  try {
    let result = 0

    const configData = await getConfiguration('quickNotes')
    if (typeof configData === 'object') {
      configData.forEach(async (quickNote) => {
        const templateFilename = `🗒 Quick Notes/${quickNote.label}`
        const templateData: ?TNote = await getOrMakeNote(quickNote.template, '📋 Templates')
        let templateContent = templateData?.content || ''

        let title = quickNote.title
        title = title.replace('{{meetingName}}', '<%- meetingName %>')
        title = title.replace('{{MeetingName}}', '<%- meetingName %>')
        title = title.replace('{{date8601()}}', '<%- date8601() %>')
        title = title.replace("{{weekDates({format:'yyyy-MM-dd'})}}", "<%- date.startOfWeek('ddd YYYY-MM-DD',null,1) %>  - <%- date.endOfWeek('ddd YYYY-MM-DD',null,1) %>")
        title = title.replace('{{', '<%-').replace('}}', '%>')

        templateContent = templateContent.replace('{{', '<%- ').replace('}}', ' %>')

        const enquote = (str: string = '') => {
          const matches = str.match(/^[a-zA-Z]/gi) || []
          return matches?.length === 0 ? `"${str}"` : str
        }

        const metaData = {
          newNoteTitle: enquote(title),
          folder: enquote(quickNote.folder),
          type: 'quick-note',
        }

        // $FlowIgnore
        const createResult = await NPTemplating.createTemplate(templateFilename, metaData, templateContent)

        return createResult ? 1 : 0
      })
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

export async function _checkTemplatesMigrated(): Promise<boolean> {
  const templateFolder = '📋 Templates'

  const migratedTemplates = await NPTemplating.getTemplateListByTags('migrated-template')
  const legacyTemplates = DataStore.projectNotes.filter((n) => n.filename?.startsWith(templateFolder)).filter((n) => !n.title?.startsWith('_configuration'))

  // const result = legacyTemplates.length > 0 && migratedTemplates.length > 0
  // 2022-05-03 5:37:04 PM, checking if this has a positive impact as per @dwertheimer comment
  // https://discord.com/channels/763107030223290449/971096330044862514/971171560746549339
  const result = migratedTemplates.length > 0 || !(legacyTemplates.length > 0 && migratedTemplates.length === 0)

  return result
}
