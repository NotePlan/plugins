// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import moment from 'moment/min/moment-with-locales'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { helpInfo } from '../lib/helpers'
import { logError, logDebug, JSP, clo, overrideSettingsWithStringArgs } from '@helpers/dev'
import { getISOWeekAndYear, getISOWeekString } from '@helpers/dateTime'
import { getNPWeekData } from '@helpers/NPdateTime'
import { getNote } from '@helpers/note'
import { chooseNote } from '@helpers/userInput'

import NPTemplating from 'NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import pluginJson from '../plugin.json'
import { hyphenatedDate } from '@helpers/dateTime'
import { selectFirstNonTitleLineInEditor, getNoteFromIdentifier } from '@helpers/NPnote'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { chooseHeading, showMessage } from '@helpers/userInput'
import { render } from './Templating'

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
  note: CoreNoteFields,
  renderedTemplate: string,
  headingName: string,
  location: string,
  options?: any = { shouldOpenInEditor: false, createMissingHeading: false, replaceNoteContents: false },
): Promise<void> {
  logDebug(
    pluginJson,
    `NPEditor::writeNoteContents note:${note?.title || ''} headingName:${headingName} location:${location} options:${JSP(
      options,
    )} renderedTemplate:\n---\n${renderedTemplate}\n---`,
  )
  let writeUnderHeading = headingName
  if (note) {
    logDebug(
      pluginJson,
      `writeNoteContents title:"${note.title || ''}" writeUnderHeading:${writeUnderHeading} location:${location} options:${JSP(options)} renderedTemplate:"${renderedTemplate}"`,
    )
    if (renderedTemplate.trim().length === 0) {
      logDebug(pluginJson, `NPEditor::writeNoteContents renderedTemplate is empty, skipping`)
      return
    }
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
        // $FlowIgnore -- note does not exist on CoreNoteFields (only on Editor)
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
          // $FlowIgnore -- note does not exist on CoreNoteFields (only on Editor)
        } else if (location === 'cursor' && note.note) {
          // we are in the Editor
          const selection = Editor.selectedParagraphs
          const indents = selection?.length > 0 ? selection[0].indents : 0
          logDebug(pluginJson, `writeNoteContents inserting "${renderedTemplate}" at cursor with indents ${indents}`)
          clo(selection, `writeNoteContents selection`)
          Editor.insertParagraphAtCursor(renderedTemplate, 'text', indents)
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
 * Template Runner - aka Template File By Title Execute (or Ex for short)
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
export async function templateRunnerExecute(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string | null = ''): Promise<void> {
  try {
    logDebug(
      pluginJson,
      `templateRunnerExecute Starting Self-Running Template Execution: selectedTemplate:"${selectedTemplate}" openInEditor:${String(openInEditor)} args:"${
        args?.toString() || ''
      }"`,
    )
    if (selectedTemplate.length !== 0) {
      logDebug(`templateRunnerExecute selectedTemplate:${selectedTemplate} openInEditor:${String(openInEditor)} args:"${args || ''}"`)
      //TODO: call overrideSettingsWithTypedArgs() for JSON inputs from form
      const argObj = args && typeof args === 'string' && args.includes('__isJSON__') ? JSON.parse(args) : overrideSettingsWithStringArgs({}, args || '')
      clo(argObj, `templateRunnerExecute argObj`)

      // args && args.split(',').forEach((arg) => (arg.split('=').length === 2 ? (argObj[arg.split('=')[0]] = arg.split('=')[1]) : null))
      if (!selectedTemplate || selectedTemplate.length === 0) {
        await CommandBar.prompt('You must supply a template title as the first argument', helpInfo('Self-Running Templates'))
      }
      let failed = false

      // const templateData = await NPTemplating.getTemplate(selectedTemplate) -- seems to load every template in the DataStore -- I don't think it's needed
      const theNote = await getNoteFromIdentifier(selectedTemplate)
      let templateData = ''

      if (!theNote) {
        failed = true
      } else {
        templateData = theNote.content || ''
      }

      const isFrontmatter = failed ? false : new FrontmatterModule().isFrontmatterTemplate(templateData)
      logDebug(pluginJson, `templateRunnerExecute: "${theNote?.title || ''}": isFrontmatter:${String(isFrontmatter)}`)
      if (!failed && isFrontmatter) {
        const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateData, argObj)
        clo(frontmatterAttributes, `templateRunnerExecute frontMatterAttributes after preRender`)
        let data = { ...frontmatterAttributes, ...argObj, frontmatter: { ...frontmatterAttributes, ...argObj } }
        if (data['newNoteTitle']) {
          // if form or template has a newNoteTitle field then we need to call templateNew
          const argsArray = [selectedTemplate, data['folder'] || null, data['newNoteTitle'], argObj]
          await DataStore.invokePluginCommandByName('templateNew', 'np.Templating', argsArray)
          return
        }
        let renderedTemplate = await NPTemplating.render(frontmatterBody, data)
        logDebug(pluginJson, `templateRunnerExecute Template Render Complete renderedTemplate= "${renderedTemplate}"`)
        clo(frontmatterAttributes, `templateRunnerExecute frontMatterAttributes before set`)
        // Note:getNoteTitled is going to replace openNoteTitle and writeNoteTitle
        // Whether it's run silently or opened in Editor is sent in the URL

        const { openNoteTitle, writeNoteTitle, location, writeUnderHeading, replaceNoteContents, getNoteTitled } = frontmatterAttributes
        clo(frontmatterAttributes, `templateRunnerExecute after destructure - replaceNoteContents:${replaceNoteContents} the rest:`)
        let noteTitle = (openNoteTitle && openNoteTitle.trim()) || (writeNoteTitle && writeNoteTitle?.trim()) || '' || (getNoteTitled && getNoteTitled.trim())
        let shouldOpenInEditor = (openNoteTitle && openNoteTitle.length > 0) || openInEditor

        const createMissingHeading = true
        if (/<choose>/i.test(noteTitle) || /<select>/i.test(noteTitle)) {
          logDebug(pluginJson, `templateRunnerExecute Inside choose code`)
          const chosenNote = await chooseNote()
          noteTitle = chosenNote?.title || ''
          if (!noteTitle?.length) {
            await showMessage("Selected note has no title and can't be used")
            return
          }
          logDebug(pluginJson, `templateRunnerExecute: noteTitle: ${noteTitle}`)
        }
        const isTodayNote = /<today>/i.test(noteTitle)
        const isThisWeek = /<thisweek>/i.test(noteTitle)
        const isNextWeek = /<nextweek>/i.test(noteTitle)
        logDebug(pluginJson, `templateRunnerExecute isTodayNote:${String(isTodayNote)} isThisWeek:${String(isThisWeek)} isNextWeek:${String(isNextWeek)}`)
        let note
        let options = { shouldOpenInEditor: shouldOpenInEditor || false, createMissingHeading: Boolean(createMissingHeading), replaceNoteContents: Boolean(replaceNoteContents) } // these Boolean casts seem like they shouldn't be necessary, but shorthand wasn't working for undefined values
        clo(options, `templateRunnerExecute options`)
        if (isTodayNote) {
          if (shouldOpenInEditor) {
            if (Editor?.note?.title !== hyphenatedDate(new Date())) {
              logDebug(pluginJson, `templateRunnerExecute About to openNoteByDate; Editor was opened to: ${Editor?.note?.title || ''}, and we want ${hyphenatedDate(new Date())}`)
              note = await Editor.openNoteByDate(new Date())
              logDebug(pluginJson, `templateRunnerExecute Editor.note.filename is:${String(Editor.note?.filename || '')}`)
            }
            if (Editor.note) {
              await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
            }
          } else {
            logDebug(pluginJson, `templateRunnerExecute About to open calendarNoteByDate`)
            note = DataStore.calendarNoteByDate(new Date())
            logDebug(pluginJson, `templateRunnerExecute got note:${note?.title || ''}`)
            if (note) {
              logDebug(pluginJson, `templateRunnerExecute note found. filename=${note.filename} calling writeNoteContents`)
              await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, options)
            } else {
              logError(pluginJson, `templateRunnerExecute note NOT found.`)
              clo(note, `templateRunnerExecute note variable is`)
            }
          }
        } else if (isThisWeek || isNextWeek) {
          logDebug(pluginJson, `templateRunnerExecute isThisWeek || isNextWeek`)
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
            logError(pluginJson, `templateRunnerExecute: Could not get proper week info for ${noteTitle}`)
          }
        } else if (noteTitle === '<current>') {
          logDebug(pluginJson, `templateRunnerExecute is <current>`)
          if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
            if (Editor.note) {
              await writeNoteContents(Editor, renderedTemplate, writeUnderHeading, location, options)
            }
          } else {
            await CommandBar.prompt('You must have either Project Note or Calendar Note open when using "<current>".', '')
          }
          // using current note, no further processing required
          return
        } else {
          if (noteTitle?.length) {
            logDebug(pluginJson, `templateRunnerExecute is other type noteTitle:${noteTitle}`)

            // must be a regular note we're looking for
            let notes: Array<TNote> | null | void = []
            if (shouldOpenInEditor) {
              const edNote = await Editor.openNoteByTitle(noteTitle)
              if (edNote) {
                notes = [edNote]
              }
            }
            if (!notes || !notes.length) {
              await CommandBar.prompt(`Unable to locate note matching "${noteTitle}"`, 'Could not find note')
              return
            }
            notes = await DataStore.projectNoteByTitle(noteTitle)
            const length = notes ? notes.length : 0
            if (!notes || length == 0 || (notes && notes.length > 1)) {
              let msg = `Unable to locate any notes matching "${noteTitle}"`
              if (length > 1) {
                msg = `${length} notes found matching "${noteTitle}"`
              }

              await CommandBar.prompt(`${msg}.\n\nThe title must be unique to ensure correct note is updated.`, `Title must be unique`)
              return
            } else {
              note = notes[0] || null
              if (!note) {
                await CommandBar.prompt(`Unable to locate note matching "${noteTitle}"`, 'Could not find note')
                return
              } else {
                logDebug(pluginJson, `templateRunnerExecute: About to call writeNoteContents in note: "${note?.title || ''}"`)
                await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, { ...options, ...{ shouldOpenInEditor, createMissingHeading } })
                if (shouldOpenInEditor) {
                  //TODO: Figure out how to put the cursor in the proper spot given that the write may be delayed
                  const lines = renderedTemplate.split('\n').filter((l) => l !== '')
                  const lastLine = lines[lines.length - 1]
                  if (location === 'prepend') {
                    selectFirstNonTitleLineInEditor()
                  }
                }
              }
            }
          } else {
            await CommandBar.prompt(`Frontmatter field: "getNoteTitled" must be set in order to open the desired note.`, "Couldn't find getNoteTitled")
            return
          }
        }
      } else {
        await CommandBar.prompt(`Unable to locate template "${selectedTemplate}"`, helpInfo('Self-Running Templates'))
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Add frontmatter/properties to a template
 * @param {string} _templateToGet - the name of the template (optional) -- Editor.note will be used if not provided
 * @param {boolean} _openInEditor - if true, will open the note in the editor, otherwise will write silently to the note
 */
export async function addFrontmatterToTemplate(_templateToGet?: string = '', openInEditor?: boolean = false): Promise<void> {
  try {
    logDebug(pluginJson, `addFrontmatterToTemplate Starting selectedTemplate:"${_templateToGet}" openInEditor:${String(openInEditor)} `)
    const templateToGet = _templateToGet || Editor.filename || ''
    let theNote = null
    if (templateToGet) {
      theNote = await getNote(templateToGet, null, NotePlan.environment.templateFolder || '@Templates')
    } else {
      theNote = Editor.note || null
    }
    if (!theNote) {
      await CommandBar.prompt(`Unable to locate template "${templateToGet}"`, helpInfo('Self-Running Templates'))
      logError(pluginJson, `Unable to locate template "${_templateToGet}"`)
      return
    }
    const startIndex = findStartOfActivePartOfNote(theNote)
    const startParagraph = theNote.paragraphs.length > startIndex + 1 ? theNote.paragraphs[startIndex] : null
    if (startParagraph) {
      if (startParagraph.content === '--') {
        logDebug(pluginJson, `addFrontmatterToTemplate: Found existing frontmatter section at line ${startIndex + 1}`)
        await showMessage(`This note already has a note properties section`)
        return
      }
    }
    const noteFrontmatter = '--\nNOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note\n--'
    theNote.insertParagraph(noteFrontmatter, startIndex, 'text')
    if (openInEditor) {
      await Editor.openNoteByFilename(theNote.filename)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
