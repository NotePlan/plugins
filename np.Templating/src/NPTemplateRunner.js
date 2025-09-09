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
import { chooseNote } from '@helpers/userInput'
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
 * Handle empty template case
 * @param {string} renderedTemplate - rendered template content
 * @returns {boolean} true if template is empty
 */
export function isTemplateEmpty(renderedTemplate: string): boolean {
  return renderedTemplate.trim().length === 0
}

/**
 * Replace entire note contents
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} renderedTemplate - rendered template content
 * @returns {Promise<void>}
 */
export async function replaceNoteContents(note: CoreNoteFields, renderedTemplate: string, replaceHeading: boolean = false): Promise<void> {
  logDebug(pluginJson, `NPTemplateRunner::replaceNoteContents replacing note contents (options.replaceNoteContents === true) ${replaceHeading ? 'and replacing title also' : ''}`)
  if (replaceHeading) {
    note.content = renderedTemplate
  } else {
    const startIndex = findStartOfActivePartOfNote(note)
    logDebug(pluginJson, `NPTemplateRunner::writeNoteContents deleting everything after line #${startIndex}`)
    const parasToKeep = note.paragraphs.filter((p) => p.lineIndex < startIndex)
    const strToKeep = parasToKeep.map((p) => p.rawContent).join('\n')
    logDebug(pluginJson, `NPTemplateRunner::adding in renderedTemplate (${renderedTemplate.split('\n').length} lines)`)
    note.content = `${strToKeep}\n${renderedTemplate}`
  }
}

/**
 * Handle heading selection for interactive templates
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} writeUnderHeading - the heading to write under
 * @returns {Promise<string>} the selected heading
 */
export async function handleHeadingSelection(note: CoreNoteFields, writeUnderHeading: string): Promise<string> {
  if (/<choose>/i.test(writeUnderHeading) || /<select>/i.test(writeUnderHeading)) {
    // $FlowIgnore -- note does not exist on CoreNoteFields (only on Editor)
    return await chooseHeading(note, true)
  }
  return writeUnderHeading
}

/**
 * Replace heading and all content under it
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} writeUnderHeading - the heading to replace
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} headingParagraph - the heading paragraph object
 * @returns {Promise<void>}
 */
export async function replaceHeading(note: CoreNoteFields, writeUnderHeading: string, renderedTemplate: string, headingParagraph: any): Promise<void> {
  logDebug(pluginJson, `NPTemplateRunner::writeNoteContents replacing heading and contents (replaceHeading === true)`)
  // Find the heading paragraph and replace it and all content below until next heading of same or higher level
  const headingIndex = headingParagraph ? headingParagraph.lineIndex : -1
  if (headingIndex >= 0) {
    const headingMatch = writeUnderHeading.match(/^#+/)
    const headingLevel = headingMatch ? headingMatch[0].length : 2
    let endIndex = note.paragraphs.length

    // Find the next heading of same or higher level
    for (let i = headingIndex + 1; i < note.paragraphs.length; i++) {
      const para = note.paragraphs[i]
      if (para.type === 'title') {
        const paraMatch = para.content.match(/^#+/)
        if (paraMatch && paraMatch[0].length <= headingLevel) {
          endIndex = i
          break
        }
      }
    }

    // Replace the heading and content by deleting old content and inserting new
    const newContent = `${'#'.repeat(headingLevel)} ${writeUnderHeading}\n${renderedTemplate}`
    // Delete paragraphs from heading to end of section
    for (let i = endIndex - 1; i >= headingIndex; i--) {
      if (note.paragraphs[i]) {
        note.removeParagraph(note.paragraphs[i])
      }
    }
    // Insert new content at heading position
    note.insertParagraph(newContent, headingIndex, 'text')
  }
}

/**
 * Creates a block of text with the heading and content
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} writeUnderHeading - the heading to add
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} options - write options
 * @returns {Promise<void>}
 */
export function composeHeadingWithContent(note: CoreNoteFields, writeUnderHeading: string, renderedTemplate: string, options: any): string {
  const { headingLevel = 2 } = options
  const output = `${'#'.repeat(headingLevel || 2)} ${writeUnderHeading}\n${renderedTemplate}`
  return output
}

/**
 * Handle prepending/appending heading with content
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} writeUnderHeading - the heading to add
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} options - write options
 * @returns {Promise<void>}
 */
export async function prependOrAppendHeadingWithContent(note: CoreNoteFields, writeUnderHeading: string, renderedTemplate: string, location: string, options: any): Promise<void> {
  const output = composeHeadingWithContent(note, writeUnderHeading, renderedTemplate, options)
  logDebug(
    `prependOrAppendHeadingWithContent writeUnderHeading="${writeUnderHeading}" Did not exist. ${
      location === 'prepend' ? 'Prepending' : 'Appending'
    } title with content to note. This is a workaround for a race condition in NP. output: "${output}"`,
  )
  if (location === 'prepend') {
    note.prependParagraph(output, 'text')
  } else {
    note.appendParagraph(output, 'text')
  }
}

/**
 * DBW NOTE: This function may not be used anywhere
 * Handle writing content under existing heading
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} writeUnderHeading - the heading to write under
 * @param {string} renderedTemplate - rendered template content
 * @param {string} location - write location
 * @param {Object} options - write options
 * @returns {Promise<void>}
 */
export async function writeUnderExistingHeading(note: CoreNoteFields, writeUnderHeading: string, renderedTemplate: string, location: string, options: any): Promise<void> {
  note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', writeUnderHeading, location === 'append', true)
  if (options.shouldOpenInEditor) {
    await Editor.openNoteByFilename(note.filename)
    selectFirstNonTitleLineInEditor()
  }
}

/**
 * Handle writing content without heading
 * @param {CoreNoteFields} note - the note to modify
 * @param {string} renderedTemplate - rendered template content
 * @param {string} location - write location
 * @param {boolean} isEditor - whether we're in the editor
 * @returns {Promise<void>}
 */
export async function writeWithoutHeading(note: CoreNoteFields, renderedTemplate: string, location: string, isEditor: boolean): Promise<void> {
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
    logDebug(pluginJson, `writeNoteContents prepending "${renderedTemplate}" at start of noteindex ${startIndex}`)
    note.insertParagraph(renderedTemplate, startIndex, 'text')
  }
}

/**
 * Write rendered template content to a note
 * @param {CoreNoteFields} _note - the note to write to
 * @param {string} renderedTemplate - rendered template content
 * @param {string} headingName - the heading to write under
 * @param {string} location - where to write the content
 * @param {Object} options - write options
 * @returns {Promise<void>}
 */
export async function writeNoteContents(
  _note: CoreNoteFields,
  renderedTemplate: string,
  headingName: string,
  location: string,
  options?: any = {
    shouldOpenInEditor: false,
    createMissingHeading: true,
    replaceNoteContents: false,
    replaceHeading: false,
    headingLevel: 2,
    addHeadingLocation: 'append',
  },
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
  const { headingLevel = 2, addHeadingLocation = 'append', replaceHeading = false } = options

  if (note) {
    logDebug(
      pluginJson,
      `writeNoteContents title:"${note.title || ''}" writeUnderHeading:${writeUnderHeading} location:${location} options:${JSP(options)} renderedTemplate:"${renderedTemplate}"`,
    )

    // Handle empty template case
    if (isTemplateEmpty(renderedTemplate)) {
      logDebug(pluginJson, `NPTemplateRunner::writeNoteContents renderedTemplate is empty, skipping`)
      return
    }

    // Handle replace note contents case
    if (options.replaceNoteContents) {
      await replaceNoteContents(note, renderedTemplate, options.replaceHeading)
      return
    }

    // Handle heading selection for interactive templates
    writeUnderHeading = await handleHeadingSelection(note, writeUnderHeading)
    const { addHeadingLocation = 'append', replaceHeading = false } = options

    if (writeUnderHeading) {
      const replaceHeadingAlso = location === 'replace' && replaceHeading && (replaceHeading === true || /true/i.test(replaceHeading))
      const headingParagraph = findHeading(note, writeUnderHeading, true)
      if (headingParagraph) {
        // paragraph with heading exists
        if (location === 'replace') {
          await replaceContentUnderHeading(note, writeUnderHeading, renderedTemplate, false, options.headingLevel || 2)
          if (replaceHeadingAlso) {
            logDebug(pluginJson, `writeNoteContents replacing heading and contents -- removing heading paragraph: ${writeUnderHeading}`)
            const note = headingParagraph.note
            if (note) {
              note.removeParagraph(headingParagraph)
              DataStore.updateCache(note, true)
              const headingExists = findHeading(note, writeUnderHeading, true)
              if (headingExists) {
                logError(pluginJson, `writeNoteContents replaceHeading: heading paragraph still exists according to findHeading: ${writeUnderHeading}`)
                logError(
                  pluginJson,
                  `writeNoteContents replaceHeading: note.content.includes(headingParagraph.content): ${String(note.content?.includes(`# ${headingParagraph.content}`))}`,
                )
              } else {
                logDebug(pluginJson, `writeNoteContents replaceHeading: heading paragraph seems to have been removed: ${writeUnderHeading}`)
              }
            }
          }
        } else if (!location || location === 'prepend' || location === 'append') {
          note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', writeUnderHeading, location === 'append' || !location, false)
        }
      } else {
        // paragraph with heading does not exist, so we need to create the whole block

        // Handle both boolean and string representations of createMissingHeading
        let shouldCreateHeading = false
        if (options.createMissingHeading === true) {
          shouldCreateHeading = true
        } else if (typeof options.createMissingHeading === 'string') {
          shouldCreateHeading = /true/i.test(options.createMissingHeading)
        }

        if (shouldCreateHeading) {
          await prependOrAppendHeadingWithContent(note, writeUnderHeading, renderedTemplate, addHeadingLocation, options)
        } else {
          logDebug(
            pluginJson,
            `writeNoteContents -- heading "${writeUnderHeading}" does not exist in note and createMissingHeading is false so skipping; content was: "${renderedTemplate}"`,
          )
        }
      }
    } else {
      // Handle writing without heading
      await writeWithoutHeading(note, renderedTemplate, location, isEditor)
    }
  } else {
    logDebug(pluginJson, `NPTemplateRunner::writeNoteContents -- there was no note to write to`)
  }
}

async function prependOrAppendContentUnderExistingHeading(note: CoreNoteFields, headingString: string, renderedTemplate: string, location: string): Promise<void> {
  if (headingString) {
    note.addParagraphBelowHeadingTitle(renderedTemplate, 'text', headingString, location === 'append', false)
  }
}

/**
 * Process and validate arguments passed to templateRunnerExecute
 * @param {string} selectedTemplate - the name of the template to run
 * @param {string | Object | null} args - the arguments to pass to the template
 * @returns {Object} processed arguments object and validation info
 */
export function processTemplateArguments(selectedTemplate: string, args: string | Object | null): { argObj: Object, isRunFromCode: boolean, passedTemplateBody: string | null } {
  const isRunFromCode: boolean = Boolean(selectedTemplate.length === 0 && args && typeof args === 'object' && (args.getNoteTitled || args.templateBody))
  const passedTemplateBody: string | null = isRunFromCode && args && typeof args === 'object' && args.templateBody ? String(args.templateBody) : null

  const argObj =
    args && typeof args === 'object'
      ? args
      : args && typeof args === 'string' && args.includes('__isJSON__')
      ? JSON.parse(args.replace('__isJSON__', ''))
      : overrideSettingsWithStringArgs({}, args || '')

  return { argObj, isRunFromCode, passedTemplateBody }
}

/**
 * Get template data and validate template exists
 * @param {string} selectedTemplate - the name of the template to run
 * @param {boolean} isRunFromCode - whether running from code
 * @returns {Object} template data and validation info
 */
export async function getTemplateData(selectedTemplate: string, isRunFromCode: boolean): Promise<{ templateData: string, trTemplateNote: any, failed: boolean }> {
  let failed = false
  const trTemplateNote = selectedTemplate ? await getNoteFromIdentifier(selectedTemplate) : null
  let templateData = ''

  if (selectedTemplate && !trTemplateNote) {
    failed = true
  } else {
    templateData = selectedTemplate ? trTemplateNote?.content || '' : ''
  }

  return { templateData, trTemplateNote, failed }
}

/**
 * Process frontmatter and render template variables
 * @param {string} templateData - the template content
 * @param {Object} argObj - processed arguments
 * @param {boolean} isRunFromCode - whether running from code
 * @param {string | null} passedTemplateBody - template body if passed from code
 * @param {Object} trTemplateNote - the template note object
 * @returns {Object} processed frontmatter data
 */
export async function processFrontmatter(
  templateData: string,
  argObj: Object,
  isRunFromCode: boolean,
  passedTemplateBody: string | null,
  trTemplateNote: any,
): Promise<{ frontmatterBody: string, frontmatterAttributes: Object, data: Object }> {
  const { frontmatterBody, frontmatterAttributes } = isRunFromCode
    ? { frontmatterBody: passedTemplateBody || '', frontmatterAttributes: argObj }
    : await NPTemplating.renderFrontmatter(templateData, argObj)

  // Add back any variables that fm() library erroneously changed
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

  const data = {
    ...frontmatterAttributes,
    ...argObj,
    frontmatter: { ...(trTemplateNote ? trTemplateNote.frontmatterAttributes : {}), ...frontmatterAttributes, ...argObj },
  }

  return { frontmatterBody, frontmatterAttributes, data }
}

/**
 * Handle new note creation if newNoteTitle is specified
 * @param {string} selectedTemplate - the name of the template to run
 * @param {Object} data - processed template data
 * @param {Object} argObj - processed arguments
 * @param {string} content - content to write to new note
 * @returns {boolean} true if new note was created and function should return
 */
export async function handleNewNoteCreation(selectedTemplate: string, data: Object, argObj: Object, content: string = ''): Promise<boolean | string> {
  const newNoteTitle = data['newNoteTitle'] || null
  if (newNoteTitle) {
    if (selectedTemplate) {
      // if form or template has a newNoteTitle field then we need to call templateNew
      const argsArray = [selectedTemplate, data['folder'] || null, newNoteTitle, argObj]
      logDebug(pluginJson, `NPTemplateRunner::handleNewNoteCreation calling templateNew with args:${JSP(argsArray)} and template:${selectedTemplate}`)
      await DataStore.invokePluginCommandByName('templateNew', 'np.Templating', argsArray)
      return true
    } else {
      // this could have been TR calling itself programmatically with newNoteTitle but no template
      logDebug(pluginJson, `NPTemplateRunner::handleNewNoteCreation calling DataStore.newNote with newNoteTitle:${newNoteTitle} and folder:${data['folder'] || null}`)
      const filename = DataStore.newNote(newNoteTitle, data['folder'] || null)
      if (filename) {
        logDebug(pluginJson, `NPTemplateRunner::handleNewNoteCreation created note with title:"${newNoteTitle}"  in folder:"${data['folder'] || null}" filename:"${filename}"`)
        const note = await DataStore.projectNoteByFilename(filename)
        note && DataStore.updateCache(note, true) // try to update the note cache so functions called after this will see the new note
        if (note && content) {
          logDebug(pluginJson, `NPTemplateRunner::handleNewNoteCreation adding content to new note:${filename}`)
          note.appendParagraph(content, 'text')
          // trying anything to force the cache to recognize this note by title soon after creation
          note && DataStore.updateCache(note, true) // try to update the note cache so functions called after this will see the new note
        }
        return filename
      }
      return false
    }
  }
  return false
}

/**
 * Render the template body with processed data
 * @param {string} frontmatterBody - the template body content
 * @param {Object} data - processed template data
 * @returns {string} rendered template
 */
export async function renderTemplate(frontmatterBody: string, data: Object): Promise<string> {
  const renderedTemplate = await NPTemplating.render(frontmatterBody, data)
  const isError = /Template Rendering Error/.test(renderedTemplate)

  if (isError) {
    await showMessage('Template Render Error Encountered. Stopping. Please fix the template and try again.')
    throw 'templateRunnerExecute Encountered Render Error; Stopping'
  }

  return renderedTemplate
}

/**
 * Extract and process note title and editor preferences from frontmatter
 * @param {Object} frontmatterAttributes - processed frontmatter attributes
 * @param {boolean} openInEditor - whether to open in editor
 * @returns {Object} note title and editor preferences
 */
export function extractTitleAndShouldOpenSettings(frontmatterAttributes: Object, openInEditor: boolean): { noteTitle: string, shouldOpenInEditor: boolean } {
  const { openNoteTitle, writeNoteTitle, getNoteTitled } = frontmatterAttributes
  let noteTitle = (openNoteTitle && openNoteTitle.trim()) || (writeNoteTitle && writeNoteTitle?.trim()) || '' || (getNoteTitled && getNoteTitled.trim())
  let shouldOpenInEditor = (openNoteTitle && openNoteTitle.length > 0) || openInEditor

  return { noteTitle, shouldOpenInEditor }
}

/**
 * Handle note selection if noteTitle contains choose/select placeholders
 * @param {string} noteTitle - the note title to process
 * @returns {string} selected note title
 */
export async function handleNoteSelection(noteTitle: string): Promise<string> {
  if (/<choose>/i.test(noteTitle) || /<select>/i.test(noteTitle)) {
    logDebug(pluginJson, `templateRunnerExecute Inside choose code`)
    const chosenNote = await chooseNote()
    const selectedTitle = chosenNote?.title || ''
    if (!selectedTitle?.length) {
      await showMessage("Selected note has no title and can't be used")
      throw new Error("Selected note has no title and can't be used")
    }
    logDebug(pluginJson, `templateRunnerExecute: noteTitle: ${selectedTitle}`)
    return selectedTitle
  }
  return noteTitle
}

/**
 * Create template write options from frontmatter attributes
 * @param {Object} frontmatterAttributes - frontmatter attributes
 * @param {boolean} shouldOpenInEditor - whether to open in editor
 * @returns {Object} template write options
 */
export function createTemplateWriteOptions(frontmatterAttributes: Object, shouldOpenInEditor: boolean): Object {
  clo(frontmatterAttributes, `createTemplateWriteOptions frontmatterAttributes before destructuring`)
  const { location, writeUnderHeading, replaceNoteContents, headingLevel, addHeadingLocation, replaceHeading, createMissingHeading } = frontmatterAttributes
  logDebug(`createTemplateWriteOptions frontmatterAttributes after destructuring replaceHeading=${replaceHeading} (typeof replaceHeading=${typeof replaceHeading}  )`)
  return {
    shouldOpenInEditor: shouldOpenInEditor || false,
    createMissingHeading: createMissingHeading !== undefined ? createMissingHeading : true,
    replaceNoteContents: Boolean(replaceNoteContents),
    headingLevel,
    addHeadingLocation,
    location,
    writeUnderHeading,
    replaceHeading,
  }
}

/**
 * Determine note type from note title
 * @param {string} noteTitle - the note title
 * @returns {Object} note type info
 */
export function determineNoteType(noteTitle: string): { isTodayNote: boolean, isThisWeek: boolean, isNextWeek: boolean } {
  const isTodayNote = /<today>/i.test(noteTitle)
  const isThisWeek = /<thisweek>/i.test(noteTitle)
  const isNextWeek = /<nextweek>/i.test(noteTitle)

  return { isTodayNote, isThisWeek, isNextWeek }
}

/**
 * Handle writing to today's note
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} writeOptions - write options containing all necessary parameters
 * @returns {Promise<void>}
 */
export async function handleTodayNote(renderedTemplate: string, writeOptions: Object): Promise<void> {
  const { shouldOpenInEditor, writeUnderHeading, location, ...options } = writeOptions

  if (shouldOpenInEditor) {
    if (Editor?.note?.title !== hyphenatedDate(new Date())) {
      logDebug(pluginJson, `templateRunnerExecute About to openNoteByDate; Editor was opened to: ${Editor?.note?.title || ''}, and we want ${hyphenatedDate(new Date())}`)
      await Editor.openNoteByDate(new Date())
      logDebug(pluginJson, `templateRunnerExecute Editor.note.filename is:${String(Editor.note?.filename || '')}`)
    }
    if (Editor.note) {
      await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
    }
  } else {
    logDebug(pluginJson, `templateRunnerExecute About to open calendarNoteByDate`)
    const note = DataStore.calendarNoteByDate(new Date())
    logDebug(pluginJson, `templateRunnerExecute got note:${note?.title || ''}`)
    if (note) {
      logDebug(pluginJson, `templateRunnerExecute note found. filename=${note.filename} calling writeNoteContents`)
      await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, options)
    } else {
      logError(pluginJson, `templateRunnerExecute note NOT found.`)
      clo(note, `templateRunnerExecute note variable is`)
    }
  }
}

/**
 * Handle writing to weekly notes
 * @param {boolean} isThisWeek - whether this is current week
 * @param {boolean} isNextWeek - whether this is next week
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} writeOptions - write options containing all necessary parameters
 * @returns {Promise<void>}
 */
export async function handleWeeklyNote(isThisWeek: boolean, isNextWeek: boolean, renderedTemplate: string, writeOptions: Object): Promise<void> {
  const { shouldOpenInEditor, writeUnderHeading, location, ...options } = writeOptions

  logDebug(pluginJson, `templateRunnerExecute isThisWeek || isNextWeek`)
  const dateInfo = getNPWeekData(moment().toDate(), isThisWeek ? 0 : 1, 'week')
  if (dateInfo) {
    if (shouldOpenInEditor) {
      await Editor.openWeeklyNote(dateInfo.weekYear, dateInfo.weekNumber)
      if (Editor?.note) {
        await writeNoteContents(Editor.note, renderedTemplate, writeUnderHeading, location, options)
      }
    } else {
      const note = DataStore.calendarNoteByDateString(dateInfo.weekString)
      if (note) {
        await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, options)
      }
    }
  } else {
    logError(pluginJson, `templateRunnerExecute: Could not get proper week info for weekly note`)
  }
}

/**
 * Handle writing to current note
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} writeOptions - write options containing all necessary parameters
 * @returns {Promise<void>}
 */
export async function handleCurrentNote(renderedTemplate: string, writeOptions: Object): Promise<void> {
  const { writeUnderHeading, location, ...options } = writeOptions

  logDebug(pluginJson, `templateRunnerExecute is <current>`)
  if (Editor.type === 'Notes' || Editor.type === 'Calendar') {
    if (Editor.note) {
      await writeNoteContents(Editor, renderedTemplate, writeUnderHeading, location, options)
    }
  } else {
    await CommandBar.prompt('You must have either Project Note or Calendar Note open when using "<current>".', '')
  }
}

/**
 * Handle writing to regular notes by title
 * @param {string} noteTitle - the note title
 * @param {string} selectedTemplate - the selected template
 * @param {Object} argObj - processed arguments
 * @param {string} renderedTemplate - rendered template content
 * @param {Object} writeOptions - write options containing all necessary parameters
 * @returns {Promise<void>}
 */
export async function handleRegularNote(noteTitle: string, selectedTemplate: string, argObj: Object, renderedTemplate: string, writeOptions: Object): Promise<void> {
  const { shouldOpenInEditor, writeUnderHeading, location, ...options } = writeOptions

  logDebug(pluginJson, `templateRunnerExecute looking for a regular note named: "${noteTitle}"`)
  const parts = noteTitle.split('/') || []
  const title = parts[parts.length - 1] || ''
  const folder = parts.slice(0, -1).join('/') || argObj.folder || ''

  let theTargetNote = null
  const isCalendarNoteTitle = isValidCalendarNoteTitleStr(selectedTemplate)

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

  if (shouldOpenInEditor) {
    const edNote = await Editor.openNoteByTitle(title)
    if (edNote) {
      notes = [edNote]
    }
  }

  const length = notes ? notes.length : 0
  if (!notes || length == 0 || (notes && notes.length > 1)) {
    let msg = length > 1 ? `There are too many notes matching "${noteTitle}". You should remove duplicate titled notes.` : `Unable to locate note matching "${noteTitle}"`
    if (length > 1) {
      clo(notes, `templateRunnerExecute notes found for "${noteTitle}"`)
      msg = `${length} notes found matching "${noteTitle}"\n\nThe title must be unique to ensure correct note is updated.`
    }

    await showMessage(`${msg}`, 'OK', `TemplateRunner Problem`)
    return
  } else {
    const note = notes[0] || null
    if (!note) {
      await CommandBar.prompt(`Unable to locate note matching "${noteTitle}"`, 'Could not find note')
      return
    } else {
      logDebug(pluginJson, `templateRunnerExecute: About to call writeNoteContents in note: "${note?.title || ''}"`)
      await writeNoteContents(note, renderedTemplate, writeUnderHeading, location, {
        ...options,
        ...{ shouldOpenInEditor },
      })
    }
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
      `templateRunnerExecute Starting STARTING Self-Running Template Execution: selectedTemplate:"${selectedTemplate}" openInEditor:${String(
        openInEditor,
      )} args (${typeof args}): "${typeof args === 'object' ? JSP(args) : args || ''}"`,
    )

    // STEP 1: Process Arguments Passed through Callback or Code
    const { argObj, isRunFromCode, passedTemplateBody } = processTemplateArguments(selectedTemplate, args)

    if (selectedTemplate.length !== 0 || isRunFromCode || passedTemplateBody) {
      clo(argObj, `templateRunnerExecute argObj`)

      if (!isRunFromCode && (!selectedTemplate || selectedTemplate.length === 0)) {
        await CommandBar.prompt('You must supply a template title as the first argument', helpInfo('Self-Running Templates'))
      }

      logTimer('templateRunnerExecute', start, `TR Total Running Time -  after Step 1`)

      // STEP 2: Get the TemplateRunner Template with our Instructions to Execute
      const { templateData, trTemplateNote, failed } = await getTemplateData(selectedTemplate, isRunFromCode)
      const isFrontmatter = isRunFromCode ? true : failed ? false : new FrontmatterModule().isFrontmatterTemplate(templateData)
      logDebug(pluginJson, `templateRunnerExecute: "${trTemplateNote?.title || ''}": isFrontmatter:${String(isFrontmatter)}`)
      logDebug(pluginJson, `TR Total Running Time -  after Step 2.0: ${timer(start)}`)

      if (!failed && isFrontmatter) {
        // STEP 2.1 & 2.2: Process Frontmatter Variables
        const { frontmatterBody, frontmatterAttributes, data } = await processFrontmatter(templateData, argObj, isRunFromCode, passedTemplateBody, trTemplateNote)
        logDebug(pluginJson, `TR Total Running Time -  after Step 2.2: ${timer(start)}`)

        // STEP 3: Create a new note if needed
        const newNoteCreated = await handleNewNoteCreation(selectedTemplate, data, argObj, passedTemplateBody || '')
        if (newNoteCreated) return
        logDebug(pluginJson, `TR Total Running Time -  after Step 3: ${timer(start)}`)

        // STEP 4: Render the Template Body (with any passed arguments)
        const renderedTemplate = await renderTemplate(frontmatterBody, data)
        logDebug(pluginJson, `templateRunnerExecute Template Render Complete renderedTemplate= "${renderedTemplate}"`)

        // Extract note preferences
        const { noteTitle, shouldOpenInEditor } = extractTitleAndShouldOpenSettings(frontmatterAttributes, openInEditor)

        // Handle note selection if needed
        let finalNoteTitle
        try {
          finalNoteTitle = await handleNoteSelection(noteTitle)
        } catch (error) {
          return // Error already handled in handleNoteSelection
        }

        logDebug(pluginJson, `TR Total Running Time -  after Step 4.0: ${timer(start)}`)

        // STEP 4.5: Figure out what note we are writing to
        const { isTodayNote, isThisWeek, isNextWeek } = determineNoteType(finalNoteTitle)

        clo(data, `templateRunnerExecute before createTemplateWriteOptions, data=`)
        clo(frontmatterAttributes, `templateRunnerExecute before createTemplateWriteOptions, frontmatterAttributes=`)
        const writeOptions = createTemplateWriteOptions(frontmatterAttributes, shouldOpenInEditor)

        logDebug(pluginJson, `templateRunnerExecute isTodayNote:${String(isTodayNote)} isThisWeek:${String(isThisWeek)} isNextWeek:${String(isNextWeek)}`)
        clo(writeOptions, `templateRunnerExecute writeOptions`)

        // STEP 4.6: Write to the target Note
        if (isTodayNote) {
          await handleTodayNote(renderedTemplate, writeOptions)
        } else if (isThisWeek || isNextWeek) {
          await handleWeeklyNote(isThisWeek, isNextWeek, renderedTemplate, writeOptions)
        } else if (finalNoteTitle === '<current>') {
          await handleCurrentNote(renderedTemplate, writeOptions)
          return // using current note, no further processing required
        } else if (finalNoteTitle?.length) {
          await handleRegularNote(finalNoteTitle, selectedTemplate, argObj, renderedTemplate, writeOptions)
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
