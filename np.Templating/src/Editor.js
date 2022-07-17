// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { helpInfo } from '../lib/helpers'
import { logError } from '@helpers/dev'
import { getISOWeekAndYear, getISOWeekString } from '@helpers/dateTime'

import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import pluginJson from '../plugin.json'

/**
 * Write out the contents to either Today's Calendar note or the Note which was opened
 * @author @dwertheimer
 * @param {TNote} note - the note to work on
 * @param {string} renderedTemplate - the rendered template string (post-render)
 * @param {string} writeUnderHeading - the heading to write under
 * @param {string} location - 'append','replace' else prepend
 * @param {*} options
 *    shouldOpenInEditor - if true, will open the note in the editor, otherwise will write silently to the note
 *    createMissingHeading - if true, will create heading when it does not exist in note
 */
export async function writeNoteContents(
  note: TNote,
  renderedTemplate: string,
  writeUnderHeading: string,
  location: string,
  options?: any = { shouldOpenInEditor: false, createMissingHeading: false },
): Promise<void> {
  if (note) {
    if (note?.content?.indexOf(`${writeUnderHeading}\n`) !== -1 || options.createMissingHeading) {
      if (writeUnderHeading) {
        if (location === 'replace') {
          await replaceContentUnderHeading(note, writeUnderHeading, renderedTemplate)
        } else {
          note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', writeUnderHeading, location === 'append', true)
        }
      } else {
        location == 'append' ? note.appendParagraph(renderedTemplate, 'text') : note.prependParagraph(renderedTemplate, 'text')
      }
      if (options.shouldOpenInEditor) {
        await Editor.openNoteByFilename(note.filename)
      }
    } else {
      await CommandBar.prompt(`"${writeUnderHeading}" heading does not exist in note.`, '')
    }
  }
}

/**
 * Process a template that provides an existing filename or <today> for today's Calendar Note
 * The unique title of the template to run must be passed in as the first argument
 * TODO:
 * - enum('location',['append','cursor','insert', ... 'prepend'])
 * - add Presets to documentation Notes below then delete these notes
 * Note: use XCallbackCreator to create a link to invoke the currently open template
 * Note: location === 'prepend' prepends, otherwise appends
 * Note: location will be 'append' or 'prepend' | if writeUnderHeading is set, then appends/prepends there, otherwise the note's content
 * Note: if you are inserting title text as part of your template, then you should always prepend, because your title will confuse future appends
 * Note: ask CD what the reserved frontmatter fields should be and trap for them
 * xcallback note: arg1 is template name, arg2 is whether to open in editor, arg3 is a list of vars to pass to template equals sign is %3d
 */
export async function templateFileByTitleEx(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string = ''): Promise<void> {
  try {
    if (selectedTemplate.length !== 0) {
      let argObj = {}
      args.split(',').forEach((arg) => (arg.split('=').length === 2 ? (argObj[arg.split('=')[0]] = arg.split('=')[1]) : null))
      if (!selectedTemplate || selectedTemplate.length === 0) {
        await CommandBar.prompt('You must supply a template title as the first argument', helpInfo('Presets'))
      }
      let failed = false
      const templateData = await NPTemplating.getTemplate(selectedTemplate)
      if (!templateData) {
        failed = true
      }

      const isFrontmatter = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (!failed && isFrontmatter) {
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData)
        let data = { ...frontmatterAttributes, ...argObj, frontmatter: { ...frontmatterAttributes, ...argObj } }
        let renderedTemplate = await NPTemplating.render(frontmatterBody, data)

        const { openNoteTitle, writeNoteTitle, location, writeUnderHeading } = frontmatterAttributes
        let noteTitle = (openNoteTitle && openNoteTitle.trim()) || (writeNoteTitle && writeNoteTitle?.trim()) || ''
        let shouldOpenInEditor = (openNoteTitle && openNoteTitle.length > 0) || openInEditor
        const createMissingHeading = true
        const isTodayNote = /<today>/i.test(openNoteTitle) || /<today>/i.test(writeNoteTitle)
        const isThisWeek = /<thisweek>/i.test(openNoteTitle) || /<thisweek>/i.test(writeNoteTitle)
        const isNextWeek = /<nextweek>/i.test(openNoteTitle) || /<nextweek>/i.test(writeNoteTitle)

        let note
        if (isTodayNote) {
          if (shouldOpenInEditor) {
            await Editor.openNoteByDate(new Date())
            if (Editor?.note) {
              await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor: false, createMissingHeading })
            }
          } else {
            note = DataStore.calendarNoteByDate(new Date())
            if (note) {
              await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor: false, createMissingHeading })
            }
          }
        } else if (isThisWeek || isNextWeek) {
          const dateInfo = getISOWeekAndYear(new Date(), isThisWeek ? 0 : 1, 'week')
          if (shouldOpenInEditor) {
            await Editor.openWeeklyNote(dateInfo.year, dateInfo.week)
            if (Editor?.note) {
              await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor: false, createMissingHeading })
            }
          } else {
            const dateString = getISOWeekString(new Date(), isThisWeek ? 0 : 1, 'week')
            note = DataStore.calendarNoteByDateString(dateString)
            if (note) {
              await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor: false, createMissingHeading })
            }
          }
        } else {
          // use current note
          if (noteTitle === '<current>') {
            if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
              if (Editor.note) {
                await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor: false, createMissingHeading })
              }
            } else {
              await CommandBar.prompt('You must have either Project Note or Calendar Note open when using "<current>".', '')
            }
            // using current note, no further processing required
            return
          }
          if (noteTitle.length) {
            const notes = await DataStore.projectNoteByTitle(noteTitle)
            const length = notes ? notes.length : 0
            if (!notes || length == 0 || (notes && notes.length > 1)) {
              let msg = `Unable to locate any notes matching "${noteTitle}"`
              if (length > 1) {
                msg = `${length} notes found matching "${noteTitle}"`
              }

              await CommandBar.prompt(`${msg}.\n\nThe title must be unique to ensure correct note is updated.`, helpInfo('Presets'))
            } else {
              note = notes[0] || null
              if (!note) {
                await CommandBar.prompt(`Unable to locate note matching "${noteTitle}"`, helpInfo('Presets'))
              } else {
                await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, { shouldOpenInEditor, createMissingHeading })
              }
            }
          } else {
            await CommandBar.prompt(`openNoteTitle or writeNoteTitle is required`, helpInfo('Presets'))
          }
        }
      } else {
        await CommandBar.prompt(`Unable to locate template "${selectedTemplate}"`, helpInfo('Presets'))
      }
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}
