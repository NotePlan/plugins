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
import { logError, logDebug, JSP, clo, overrideSettingsWithStringArgs, timer, logTimer } from '@helpers/dev'
import { getISOWeekAndYear, getISOWeekString, isValidCalendarNoteTitleStr } from '@helpers/dateTime'
import { getNPWeekData } from '@helpers/NPdateTime'
import { getNote } from '@helpers/note'
import { chooseNote, chooseNoteV2 } from '@helpers/userInput'
import { getNoteTitleFromTemplate } from '@helpers/NPFrontMatter'

import NPTemplating from '../lib/NPTemplating'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import pluginJson from '../plugin.json'
import { hyphenatedDate } from '@helpers/dateTime'
import { selectFirstNonTitleLineInEditor, getNoteFromIdentifier, getOrMakeRegularNoteInFolder, getOrMakeCalendarNote } from '@helpers/NPnote'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { chooseHeading, showMessage } from '@helpers/userInput'
import { render } from '../lib/rendering'
import { getNoteByFilename } from '../../helpers/note'
import { findHeading } from '../../helpers/NPParagraph'

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
  _note: CoreNoteFields,
  renderedTemplate: string,
  headingName: string,
  location: string,
  options?: any = { shouldOpenInEditor: false, createMissingHeading: false, replaceNoteContents: false, headingLevel: 2, addHeadingLocation: 'append', headingLevel: 2 },
): Promise<void> {
  let note: CoreNoteFields | null | void = _note
  // $FlowIgnore
  const isEditor = note.note
  logDebug(
    pluginJson,
    `NPTemplateRunner::writeNoteContents note:${note?.title || ''} headingName:${headingName} location:${location} note=${note?.title || ''}${
      isEditor ? ' (Editor)' : ''
    } options:${JSP(options)} renderedTemplate:\n---\n${renderedTemplate}\n---`,
  )
  let writeUnderHeading = headingName
  const { headingLevel = 2, addHeadingLocation = 'append' } = options

  if (note) {
    logDebug(
      pluginJson,
      `writeNoteContents title:"${note.title || ''}" writeUnderHeading:${writeUnderHeading} location:${location} options:${JSP(options)} renderedTemplate:"${renderedTemplate}"`,
    )
    if (renderedTemplate.trim().length === 0) {
      logDebug(pluginJson, `NPTemplateRunner::writeNoteContents renderedTemplate is empty, skipping`)
      return
    }
    if (options.replaceNoteContents) {
      logDebug(pluginJson, `NPTemplateRunner::writeNoteContents replacing note contents (options.replaceNoteContents === true)`)
      const startIndex = findStartOfActivePartOfNote(note)
      logDebug(pluginJson, `NPTemplateRunner::writeNoteContents deleting everything after line #${startIndex}`)
      const parasToKeep = note.paragraphs.filter((p) => p.lineIndex < startIndex)
      const parasToRemove = note.paragraphs.filter((p) => p.lineIndex >= startIndex)
      const strToKeep = parasToKeep.map((p) => p.rawContent).join('\n')
      logDebug(pluginJson, `NPTemplateRunner::adding in renderedTemplate (${renderedTemplate.split('\n').length} lines)`)
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
        const headingParagraph = findHeading(note, writeUnderHeading)
        if (headingParagraph || options.createMissingHeading) {
          if (location === 'replace') {
            await replaceContentUnderHeading(note, writeUnderHeading, renderedTemplate)
          } else {
            const { addHeadingLocation, headingLevel } = options
            // default in NP is to append, so if we are not appending, we need to prepend the title with content
            if (!headingParagraph && addHeadingLocation !== 'append') {
              logDebug(
                `writeNoteContents writeUnderHeading="${writeUnderHeading}" Did not exist. Prepending (b/c TR location is prepend) title with content. This is a workaround for a race condition in NP. headingLevel:${headingLevel} addHeadingLocation:${addHeadingLocation}`,
              )
              note.prependParagraph(`${'#'.repeat(headingLevel || 2)} ${writeUnderHeading}\n${renderedTemplate}`, 'text')
              return
            }
            if (note) {
              note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', writeUnderHeading, location === 'append', true)
              if (options.shouldOpenInEditor) {
                await Editor.openNoteByFilename(note.filename)
                selectFirstNonTitleLineInEditor()
              }
            }
          }
        } else {
          await CommandBar.prompt(`"${writeUnderHeading}" heading does not exist in note.`, '')
        }
      } else {
        const startIndex = findStartOfActivePartOfNote(note)
        if (location === 'append') {
          logDebug(pluginJson, `writeNoteContents appending "${renderedTemplate}"`)
          note.appendParagraph(renderedTemplate, 'text')
        } else if (location === 'cursor' && isEditor) {
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
    logDebug(pluginJson, `NPTemplateRunner::writeNoteContents -- there was no note to write to`)
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
 * xcallback note: arg1 is template name, arg2 is whether to open in editor, arg3 is a list of vars to pass to template equals sign is %3d
 * @param {string} selectedTemplate - the name of the template to run
 * @param {boolean} openInEditor - if true, will open the note in the editor, otherwise will write silently to the note
 * @param {string | Object} args - the arguments to pass to the template (either a string of key=value pairs or an object)
 * @author @dwertheimer
 */
export async function templateRunnerExecute(selectedTemplate?: string = '', openInEditor?: boolean = false, args?: string | Object | null = ''): Promise<void> {
  try {
    const start = new Date()
    logDebug(
      pluginJson,
      `templateRunnerExecute Starting Self-Running Template Execution: selectedTemplate:"${selectedTemplate}" openInEditor:${String(openInEditor)} args (${typeof args}): "${
        typeof args === 'object' ? JSP(args) : args || ''
      }"`,
    )
    // STEP 1: Process Arguments Passed through Callback or Code
    const isRunFromCode = selectedTemplate.length === 0 && args && typeof args === 'object' && (args.getNoteTitled || args.templateBody)
    const passedTemplateBody = isRunFromCode && args && typeof args === 'object' && args.templateBody
    if (selectedTemplate.length !== 0 || isRunFromCode || passedTemplateBody) {
      // args could be an object if templateRunner was run from code (e.g. another templateRunner)

      logDebug(
        `templateRunnerExecute selectedTemplate:${selectedTemplate} openInEditor:${String(openInEditor)} args (${typeof args}): "${
          typeof args === 'object' ? JSP(args) : args?.toString() || ''
        }" isRunFromCode:${String(isRunFromCode)} passedTemplateBody:${String(passedTemplateBody)}`,
      )

      const argObj =
        args && typeof args === 'object'
          ? args
          : args && typeof args === 'string' && args.includes('__isJSON__')
          ? JSON.parse(args)
          : overrideSettingsWithStringArgs({}, args || '')
      clo(argObj, `templateRunnerExecute argObj`)

      // args && args.split(',').forEach((arg) => (arg.split('=').length === 2 ? (argObj[arg.split('=')[0]] = arg.split('=')[1]) : null))
      if (!isRunFromCode && (!selectedTemplate || selectedTemplate.length === 0)) {
        await CommandBar.prompt('You must supply a template title as the first argument', helpInfo('Self-Running Templates'))
      }

      logTimer('templateRunnerExecute', start, `TR Total Running Time -  after Step 1`)

      // STEP 2: Get the TemplateRunner Template with our Instructions to Execute

      let failed = false

      const trTemplateNote = selectedTemplate ? await getNoteFromIdentifier(selectedTemplate) : null

      let templateData = ''

      if (selectedTemplate && !trTemplateNote) {
        failed = true
      } else {
        templateData = selectedTemplate ? trTemplateNote?.content || '' : ''
      }

      const isFrontmatter = isRunFromCode ? true : failed ? false : new FrontmatterModule().isFrontmatterTemplate(templateData)
      logDebug(pluginJson, `templateRunnerExecute: "${trTemplateNote?.title || ''}": isFrontmatter:${String(isFrontmatter)}`)

      logDebug(pluginJson, `TR Total Running Time -  after Step 2.0: ${timer(start)}`)

      if (!failed && isFrontmatter) {
        // STEP 2.1 Render Frontmatter Variables

        const { frontmatterBody, frontmatterAttributes } = isRunFromCode
          ? { frontmatterBody: passedTemplateBody || '', frontmatterAttributes: argObj }
          : await NPTemplating.renderFrontmatter(templateData, argObj)
        logDebug(pluginJson, `TR Total Running Time -  after Step 2.1: ${timer(start)}`)

        // STEP 2.2 Add back any variables that fm() library erroneously changed
        if (trTemplateNote) {
          Object.keys(trTemplateNote.frontmatterAttributes).forEach((key) => {
            if (typeof frontmatterAttributes[key] !== typeof trTemplateNote.frontmatterAttributes[key]) {
              logDebug(
                `TemplateRunnerEx fm() library changed key ${key} from ${typeof trTemplateNote.frontmatterAttributes[key]} to ${typeof frontmatterAttributes[
                  key
                ]} Restoring original value: ${trTemplateNote.frontmatterAttributes[key]}`,
              )
              frontmatterAttributes[key] = trTemplateNote.frontmatterAttributes[key]
            }
          })
        }
        logDebug(pluginJson, `TR Total Running Time -  after Step 2.2: ${timer(start)}`)

        let data = {
          ...frontmatterAttributes,
          ...argObj,
          frontmatter: { ...(trTemplateNote ? trTemplateNote.frontmatterAttributes : {}), ...frontmatterAttributes, ...argObj },
        }

        // STEP 3: Create a new note if needed

        // Check for newNoteTitle in the data or template
        // For template runner, we only want to create new notes when there's an explicit newNoteTitle
        // Don't use inline titles for template runner - they should only be used for templateNew
        const templateNoteTitleToUse = data['newNoteTitle'] || null
        if (templateNoteTitleToUse) {
          // if form or template has a newNoteTitle field then we need to call templateNew
          const argsArray = [selectedTemplate, data['folder'] || null, templateNoteTitleToUse, argObj]
          await DataStore.invokePluginCommandByName('templateNew', 'np.Templating', argsArray)
          return
        }
        logDebug(pluginJson, `TR Total Running Time -  after Step 3: ${timer(start)}`)

        // STEP 4: Render the Template Body (with any passed arguments)

        let renderedTemplate = await NPTemplating.render(frontmatterBody, data)
        const isError = /Template Rendering Error/.test(renderedTemplate)
        logDebug(pluginJson, `templateRunnerExecute Template Render Complete renderedTemplate= "${renderedTemplate}"`)
        if (isError) {
          await showMessage('Template Render Error Encountered. Stopping. Please fix the template and try again.')
          throw 'templateRunnerExecute Encountered Render Error; Stopping'
        }

        // Whether it's run silently or opened in Editor is sent in the URL

        const { openNoteTitle, writeNoteTitle, location, writeUnderHeading, replaceNoteContents, getNoteTitled, headingLevel, addHeadingLocation } = frontmatterAttributes
        clo(frontmatterAttributes, `templateRunnerExecute after destructure - replaceNoteContents:${replaceNoteContents} the rest:`)
        let noteTitle = (openNoteTitle && openNoteTitle.trim()) || (writeNoteTitle && writeNoteTitle?.trim()) || '' || (getNoteTitled && getNoteTitled.trim())
        let shouldOpenInEditor = (openNoteTitle && openNoteTitle.length > 0) || openInEditor

        const createMissingHeading = true
        if (/<choose>/i.test(noteTitle) || /<select>/i.test(noteTitle)) {
          logDebug(pluginJson, `templateRunnerExecute Inside choose code`)
          const chosenNote = await chooseNoteV2()
          noteTitle = chosenNote?.title || ''
          if (!noteTitle?.length) {
            await showMessage("Selected note has no title and can't be used")
            return
          }
          logDebug(pluginJson, `templateRunnerExecute: noteTitle: ${noteTitle}`)
        }

        logDebug(pluginJson, `TR Total Running Time -  after Step 4.0: ${timer(start)}`)

        // STEP 4.5: Figure out what note we are writing to

        const isTodayNote = /<today>/i.test(noteTitle)
        const isThisWeek = /<thisweek>/i.test(noteTitle)
        const isNextWeek = /<nextweek>/i.test(noteTitle)

        // STEP 4.6: Write to the target Note

        logDebug(pluginJson, `templateRunnerExecute isTodayNote:${String(isTodayNote)} isThisWeek:${String(isThisWeek)} isNextWeek:${String(isNextWeek)}`)
        let note
        let options = {
          shouldOpenInEditor: shouldOpenInEditor || false,
          createMissingHeading: Boolean(createMissingHeading),
          replaceNoteContents: Boolean(replaceNoteContents),
          headingLevel,
          addHeadingLocation,
        } // these Boolean casts seem like they shouldn't be necessary, but shorthand wasn't working for undefined values
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
            logDebug(pluginJson, `templateRunnerExecute looking for a regular note named: "${noteTitle}"`)
            const parts = noteTitle.split('/') || []
            const title = parts[parts.length - 1] || ''
            const folder = parts.slice(0, -1).join('/') || argObj.folder || ''

            let theTargetNote = null
            const isCalendarNoteTitle = isValidCalendarNoteTitleStr(selectedTemplate)

            // STEP 5: Open the Target Note (if there is one)

            if (isCalendarNoteTitle) {
              theTargetNote = await getOrMakeCalendarNote(selectedTemplate)
            } else {
              theTargetNote = selectedTemplate ? await getOrMakeRegularNoteInFolder(title, folder) : null
            }

            let notes: $ReadOnlyArray<TNote> | null | void
            if (theTargetNote) {
              notes = [theTargetNote]
            } else {
              notes = await DataStore.projectNoteByTitle(title)
            }

            // If all else has failed, explicitly create the note
            // This should not be necessary if the newly added getOrMake commands are working properly
            // So for now commenting this out
            // if (!notes || notes.length === 0) {
            //   logDebug(pluginJson, `templateRunnerExecute no notes found for "${title}" Will try to create it`)
            //   const filenm = await DataStore.newNote(title, folder)
            //   logDebug(pluginJson, `templateRunnerExecute created note filename: "${filenm || '<did not create>'}" title: "${title}" folder: "${folder}"`)
            //   if (!filenm) {
            //     await CommandBar.prompt(`Unable to create note "${noteTitle}"`, 'Could not create note')
            //     return
            //   } else {
            //     logDebug(pluginJson, `templateRunnerExecute created note filename: "${filenm}" title: "${title}" folder: "${folder}"`)
            //     notes = [await getNoteByFilename(filenm)]
            //   }
            // } else {
            //   logDebug(pluginJson, `templateRunnerExecute found ${notes.length} notes for "${title}"`)
            // }

            logDebug(pluginJson, `TR Total Running Time -  after Step 5: ${timer(start)}`)

            // STEP 6: Open note in Editor if user requested it (now that we know the note was created)

            if (shouldOpenInEditor) {
              const edNote = await Editor.openNoteByTitle(title)
              if (edNote) {
                notes = [edNote]
              }
            }

            // notes = notes && notes.length ? notes : await DataStore.projectNoteByTitle(noteTitle)
            // if (notes && notes.length > 1) {
            //   logDebug(pluginJson, `templateRunnerExecute found ${notes.length} notes for "${title}"; filtering to notes starting with "${folder}"`)
            //   notes = notes.filter((n) => n?.filename?.startsWith(folder))
            // }

            const length = notes ? notes.length : 0
            if (!notes || length == 0 || (notes && notes.length > 1)) {
              let msg = length > 1 ? `There are too many notes matching "${noteTitle}". You should remove duplicate titled notes.` : `Unable to locate note matching "${noteTitle}"`
              if (length > 1) {
                clo(notes, `templateRunnerExecute notes found for "${noteTitle}"`)
                msg = `${length} notes found matching "${noteTitle}"\n\nThe title must be unique to ensure correct note is updated.`
              }

              await CommandBar.prompt(`${msg}`, `TemplateRunner Problem`)
              return
            } else {
              note = notes[0] || null
              if (!note) {
                await CommandBar.prompt(`Unable to locate note matching "${noteTitle}"`, 'Could not find note')
                return
              } else {
                const output = isError ? '==Template Rendering Error==' : renderedTemplate
                logDebug(pluginJson, `templateRunnerExecute: About to call writeNoteContents in note: "${note?.title || ''}"`)
                await writeNoteContents(note, output, writeUnderHeading, location, {
                  ...options,
                  ...{ shouldOpenInEditor, createMissingHeading },
                })
              }
            }
          } else if (passedTemplateBody && (isRunFromCode || selectedTemplate)) {
            // If we have a passedTemplateBody and we're running from code or have a selected template,
            // we can still process the template even without a getNoteTitled setting
            // This allows for cases where the template is meant to be processed without writing to a specific note
            logDebug(pluginJson, `templateRunnerExecute: No note title specified but template body provided. Processing template without writing to note.`)
            // The template has been rendered, so we can consider it processed
            // If the user wants to write it somewhere, they should specify a note title or use templateNew
            logDebug(pluginJson, `TR Total Running Time -  after Step 6 (Returning): ${timer(start)}`)
            return
          } else {
            await CommandBar.prompt(`Frontmatter field: "getNoteTitled" must be set in order to open the desired note.`, "Couldn't find getNoteTitled")
            return
          }
        }
      } else {
        await CommandBar.prompt(`Unable to locate template "${selectedTemplate}"`, helpInfo('Self-Running Templates'))
      }
    }
    logDebug(pluginJson, `TemplateRunnerExecute took ${timer(start)}`)
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
