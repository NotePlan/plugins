// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import moment from 'moment'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { helpInfo } from '../lib/helpers'
import { logError, logDebug, JSP, clo, overrideSettingsWithStringArgs } from '@helpers/dev'
import { getISOWeekAndYear, getISOWeekString } from '@helpers/dateTime'
import { getNPWeekData } from '@helpers/NPdateTime'
import { chooseNote } from '@helpers/userInput'

import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import pluginJson from '../plugin.json'
import { chooseHeading } from '@helpers/userInput'
import { selectFirstNonTitleLineInEditor } from '@helpers/NPnote'
import { showMessage } from '../../helpers/userInput'
import { hyphenatedDate } from '../../helpers/dateTime'
import { findEndOfActivePartOfNote } from '../../helpers/paragraph'

/**
 * Write out the contents to either Today's Calendar note or the Note which was opened
 * @author @dwertheimer
 * @param {TNote} note - the note to work on
 * @param {string} renderedTemplate - the rendered template string (post-render)
 * @param {string} headingName - the heading to write under
 * @param {string} location - 'append','replace' else prepend
 * @param {*} options
 *    shouldOpenInEditor - if true, will open the note in the editor, otherwise will write silently to the note
 *    createMissingHeading - if true, will create heading when it does not exist in note
 *    replaceNoteContents - if yes (true doesn't work not sure why), will replace all the content in the note (other than the title)
 */
export async function writeNoteContents(
  note: TNote,
  renderedTemplate: string,
  headingName: string,
  location: string,
  options?: any = { shouldOpenInEditor: false, createMissingHeading: false, replaceNoteContents: false },
): Promise<void> {
  let writeUnderHeading = headingName
  if (note) {
    logDebug(
      pluginJson,
      `writeNoteContents title:"${note.title || ''}" writeUnderHeading:${writeUnderHeading} location:${location} options:${JSP(
        options,
      )} renderedTemplate:\n---\n${renderedTemplate}\n---`,
    )
    if (options.replaceNoteContents) {
      logDebug(pluginJson, `NPEditor::writeNoteContents replacing note contents (options.replaceNoteContents === true)`)
      const startIndex = findStartOfActivePartOfNote(note)
      logDebug(pluginJson, `NPEditor::writeNoteContents deleting everything after line #${startIndex}`)
      const parasToKeep = note.paragraphs.filter((p) => p.lineIndex < startIndex)
      const parasToRemove = note.paragraphs.filter((p) => p.lineIndex >= startIndex)
      const strToKeep = parasToKeep.map((p) => p.rawContent).join('\n')
      logDebug(pluginJson, `NPEditor::adding in renderedTemplate (${renderedTemplate.split('\n').length} lines)`)
      note.content = `${strToKeep}\n${renderedTemplate}`
      // note.insertParagraph(renderedTemplate, startIndex, 'text') // Note: not dealing with headings due to race conditions after delete
      // options.createMissingHeading = true
      return
    } else {
      if (/<choose>/i.test(writeUnderHeading) || /<select>/i.test(writeUnderHeading)) {
        writeUnderHeading = await chooseHeading(note, true)
      }
      if (writeUnderHeading) {
        if (note?.content?.indexOf(`${writeUnderHeading}\n`) !== -1 || options.createMissingHeading) {
          if (location === 'replace') {
            await replaceContentUnderHeading(note, writeUnderHeading, renderedTemplate)
          } else {
            note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', writeUnderHeading, location === 'append', true)
          }

          if (options.shouldOpenInEditor) {
            await Editor.openNoteByFilename(note.filename)
            selectFirstNonTitleLineInEditor()
          }
        } else {
          await CommandBar.prompt(`"${writeUnderHeading}" heading does not exist in note.`, '')
        }
      } else {
        const startIndex = findStartOfActivePartOfNote(note)
        if (location === 'append') {
          logDebug(pluginJson, `writeNoteContents appending "${renderedTemplate}"`)
          note.appendParagraph(renderedTemplate, 'text')
        } else {
          logDebug(pluginJson, `writeNoteContents prepending "${renderedTemplate}" at index ${startIndex}`)
          note.insertParagraph(renderedTemplate, startIndex, 'text')
        }
      }
    }
  } else {
    logDebug(pluginJson, `NPEditor::writeNoteContents -- there was no note to write to`)
  }
}

/**
 * Process a template that provides an existing filename or <today> for today's Calendar Note (aka "self-running templates")
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
 * @author @dwertheimer
 */
export async function templateFileByTitleEx(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string | null = null): Promise<void> {
  try {
    logDebug(
      pluginJson,
      `templateFileByTitleEx Starting Self-Running Template Execution: selectedTemplate:"${selectedTemplate}" openInEditor:${String(openInEditor)} args:"${
        args?.toString() || ''
      }"`,
    )
    if (selectedTemplate.length !== 0) {
      const argObj = overrideSettingsWithStringArgs({}, args || '')
      clo(argObj, `templateFileByTitleEx after overrideSettingsWithStringArgs argObj`)
      // args && args.split(',').forEach((arg) => (arg.split('=').length === 2 ? (argObj[arg.split('=')[0]] = arg.split('=')[1]) : null))
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
        // clo(frontmatterAttributes, `templateFileByTitleEx frontMatterAttributes after preRender`)
        let data = { ...frontmatterAttributes, ...argObj, frontmatter: { ...frontmatterAttributes, ...argObj } }
        let renderedTemplate = await NPTemplating.render(frontmatterBody, data)
        // logDebug(pluginJson, `templateFileByTitleEx Template Render Complete renderedTemplate= "${renderedTemplate}"`)
        // clo(frontmatterAttributes, `templateFileByTitleEx frontMatterAttributes before set`)
        // Note:getNoteTitled is going to replace openNoteTitle and writeNoteTitle
        // Whether it's run silently or opened in Editor is sent in the URL

        const { openNoteTitle, writeNoteTitle, location, writeUnderHeading, replaceNoteContents, getNoteTitled } = frontmatterAttributes
        clo(frontmatterAttributes, `templateFileByTitleEx after destructure - replaceNoteContents:${replaceNoteContents} the rest:`)
        let noteTitle = (openNoteTitle && openNoteTitle.trim()) || (writeNoteTitle && writeNoteTitle?.trim()) || '' || (getNoteTitled && getNoteTitled.trim())
        let shouldOpenInEditor = (openNoteTitle && openNoteTitle.length > 0) || openInEditor

        const createMissingHeading = true
        if (/<choose>/i.test(noteTitle) || /<select>/i.test(noteTitle)) {
          logDebug(pluginJson, `templateFileByTitleEx Inside choose code`)
          const chosenNote = await chooseNote()
          noteTitle = chosenNote?.title || ''
          if (!noteTitle?.length) {
            await showMessage("Selected note has no title and can't be used")
            return
          }
          logDebug(pluginJson, `templateFileByTitleEx: noteTitle: ${noteTitle}`)
        }
        const isTodayNote = /<today>/i.test(noteTitle)
        const isThisWeek = /<thisweek>/i.test(noteTitle)
        const isNextWeek = /<nextweek>/i.test(noteTitle)
        logDebug(pluginJson, `templateFileByTitleEx isTodayNote:${String(isTodayNote)} isThisWeek:${String(isThisWeek)} isNextWeek:${String(isNextWeek)}`)
        let note
        let options = { shouldOpenInEditor: false, createMissingHeading: Boolean(createMissingHeading), replaceNoteContents: Boolean(replaceNoteContents) } // these Boolean casts seem like they shouldn't be necessary, but shorthand wasn't working for undefined values
        clo(options, `templateFileByTitleEx options`)
        if (isTodayNote) {
          if (shouldOpenInEditor) {
            if (Editor?.note?.title !== hyphenatedDate(new Date())) {
              logDebug(pluginJson, `templateFileByTitleEx About to openNoteByDate; Editor was opened to: ${Editor?.note?.title || ''}, and we want ${hyphenatedDate(new Date())}`)
              await Editor.openNoteByDate(new Date())
              logDebug(pluginJson, `templateFileByTitleEx Editor.note.filename is:${String(Editor.note?.filename || '')}`)
            }
            if (Editor.note) {
              await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
            }
          } else {
            logDebug(pluginJson, `templateFileByTitleEx About to open calendarNoteByDate`)
            note = DataStore.calendarNoteByDate(new Date())
            logDebug(pluginJson, `templateFileByTitleEx got note:${note?.title || ''}`)
            if (note) {
              logDebug(pluginJson, `templateFileByTitleEx note found. filename=${note.filename} calling writeNoteContents`)
              await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, options)
            } else {
              logError(pluginJson, `templateFileByTitleEx note NOT found.`)
              clo(note, `templateFileByTitleEx note variable is`)
            }
          }
        } else if (isThisWeek || isNextWeek) {
          logDebug(pluginJson, `templateFileByTitleEx isThisWeek || isNextWeek`)
          const dateInfo = getNPWeekData(moment().toDate(), isThisWeek ? 0 : 1, 'week')
          if (dateInfo) {
            if (shouldOpenInEditor) {
              await Editor.openWeeklyNote(dateInfo.weekYear, dateInfo.weekNumber)
              if (Editor?.note) {
                await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
              }
            } else {
              note = DataStore.calendarNoteByDateString(dateInfo.weekString)
              if (note) {
                await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, options)
              }
            }
          } else {
            logError(pluginJson, `templateFileByTitleEx: Could not get proper week info for ${noteTitle}`)
          }
        } else {
          // use current note
          logDebug(pluginJson, `templateFileByTitleEx is other type noteTitle:${noteTitle}`)
          if (noteTitle === '<current>') {
            if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
              if (Editor.note) {
                await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
              }
            } else {
              await CommandBar.prompt('You must have either Project Note or Calendar Note open when using "<current>".', '')
            }
            // using current note, no further processing required
            return
          }
          if (noteTitle?.length) {
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
                logDebug(pluginJson, `templateFileByTitleEx: About to call writeNoteContents in note: "${note?.title || ''}"`)
                await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, { ...options, ...{ shouldOpenInEditor, createMissingHeading } })
              }
            }
          } else {
            await CommandBar.prompt(`Frontmatter field: "getNoteTitled" must be set in order to open the desired note.`, helpInfo('Presets'))
          }
        }
      } else {
        await CommandBar.prompt(`Unable to locate template "${selectedTemplate}"`, helpInfo('Presets'))
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
