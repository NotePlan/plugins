// @flow

/**
 * Key FrontMatter functions:
 * getFrontMatterAttributes() - get the front matter attributes from a note
 * updateFrontMatterVars() - update the front matter attributes for a note
 * (deprecated) setFrontMatterVars() - set/update the front matter attributes for a note (will create frontmatter if necessary)
 * noteHasFrontMatter() - test whether a Test whether a Note contains front matter
 * ensureFrontMatter() - ensure that a note has front matter (will create frontmatter if necessary)
 * addTrigger() - add a trigger to the front matter (will create frontmatter if necessary)
 */

import fm from 'front-matter'
// import { showMessage } from './userInput'
import { clo, clof, JSP, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { RE_MARKDOWN_LINKS_CAPTURE_G } from '@helpers/regex'
const pluginJson = 'helpers/NPFrontMatter.js'

// Note: update these for each new trigger that gets added
export type TriggerTypes = 'onEditorWillSave' | 'onOpen'
export const TRIGGER_LIST = ['onEditorWillSave', 'onOpen']

/**
 * Frontmatter cannot have colons in the content (specifically ": " or ending in colon or values starting in @ or #), so we need to wrap that in quotes
 * If a string is wrapped in double quotes and contains additional double quotes, convert the internal quotes to single quotes.
 * This often happens when people include double quotes in template tags in their frontmatter
 * TODO: for now I am casting any boolean or number values to strings, but this may not be the best approach. Let's see what happens.
 * @param {string} text
 * @param {boolean} quoteSpecialCharacters - whether to quote hashtags (default: false) NOTE: YAML treats everything behind a # as a comment and so technically it should be quoted
 * @returns {string} quotedText (if required)
 */
export function quoteText(_text: string | number | boolean, quoteSpecialCharacters: boolean = false): string {
  let text = _text
  if (text === null || text === undefined || typeof text === 'object') {
    logWarn('quoteText', `text (${typeof text}) is empty/not a string. Returning ''`)
    return ''
  }
  if (typeof text === 'number' || typeof text === 'boolean') {
    logDebug('quoteText', `text (${typeof text}) is a number or boolean. Returning stringified version: ${String(text)}`)
    return String(text)
  }
  text = text.trim()
  const needsQuoting =
    text.includes(': ') ||
    /:$/.test(text) ||
    (quoteSpecialCharacters && /^#\S/.test(text)) ||
    (quoteSpecialCharacters && /^@/.test(text)) ||
    text === '' ||
    RE_MARKDOWN_LINKS_CAPTURE_G.test(text) ||
    text.includes('>')
  const isWrappedInQuotes = /^".*"$/.test(text) // Check if already wrapped in quotes

  // Handle the case where text is wrapped in double quotes but contains additional double quotes inside
  if (isWrappedInQuotes) {
    // Replace internal double quotes with escaped double quotes
    return text
      .replace(/(^")|("$)/g, '') // Remove outer quotes temporarily
      .replace(/"/g, '\\"') // Escape internal double quotes
      .replace(/^/, '"') // Re-add starting double quote
      .replace(/$/, '"') // Re-add ending double quote
  }

  // Always escape internal double quotes and wrap in quotes if needed
  if (needsQuoting || text.includes('"')) {
    return `"${text.replace(/"/g, '\\"')}"` // Escape internal double quotes and wrap in quotes
  }

  // No need to quote
  return text
}

/**
 * Test whether a string contains front matter using the front-matter library which has a bug/limitation
 * (this uses the full fm library and *not* the NP API frontmatterAttributes)
 * Note: underlying fm library doesn't actually check whether the YAML comes at the start of the string. @jgclark has raised an issue to fix that.
 * Will allow nonstandard YAML (e.g. contain colons, value starts with @) by sanitizing it first
 * @param {string} text - the text to test (typically the content of a note -- note.content)
 * @returns {boolean} true if it has front matter
 */
export const hasFrontMatter = (text: string): boolean => text.split('\n', 1)[0] === '---' && fm.test(_sanitizeFrontmatterText(text, true))

/**
 * Test whether a Note contains the requirements for frontmatter (uses NP API note.frontmatterAttributes)
 * Will pass for notes with any fields or empty frontmatter (---\n---) so that variables can be added to it
 * Regular notes will generally have a title, but not always because the title may be in the first line of the note under the fm
 * @param {CoreNoteFields} note - the note to test
 * @returns {boolean} true if the note has front matter
 */
export function noteHasFrontMatter(note: CoreNoteFields): boolean {
  try {
    // logDebug('NPFrontMatter/noteHasFrontMatter', `Checking note "${note.title || note.filename}" for frontmatter`)
    if (!note) {
      logError('NPFrontMatter/noteHasFrontMatter()', `note is null or undefined`)
      return false
    }
    if (!note.frontmatterAttributes || typeof note.frontmatterAttributes !== 'object') {
      logError(
        'NPFrontMatter/noteHasFrontMatter()',
        `note.frontmatterAttributes is ${typeof note.frontmatterAttributes === 'object' ? '' : 'not'} an object; note.frontmatterAttributes=${JSP(
          note.frontmatterAttributes || 'null',
        )}`,
      )
      return false
    }
    // logDebug('noteHasFrontMatter', `note.frontmatterAttributes: ${Object.keys(note.frontmatterAttributes).length}`)
    if (note?.frontmatterAttributes && Object.keys(note.frontmatterAttributes).length > 0) return true // has frontmatter attributes
    // logDebug('noteHasFrontMatter', `note.paragraphs: ${note.paragraphs.length}`)
    if (!note || !note.paragraphs || note.paragraphs?.length < 2) return false // could not possibly have frontmatter
    // logDebug('noteHasFrontMatter', `note.paragraphs: ${note.paragraphs.length}`)
    const paras = note.paragraphs
    // logDebug('noteHasFrontMatter', `paras: ${paras.length}`)
    if (paras[0].type === 'separator' && paras.filter((p) => p.type === 'separator').length >= 2) return true // has the separators
    // logDebug('noteHasFrontMatter', `noteHasFrontMatter: false`)
    return false
  } catch (err) {
    logError('NPFrontMatter/noteHasFrontMatter()', JSP(err))
    return false
  }
}

/**
 * Get all frontmatter attributes from a note (uses NP API note.frontmatterAttributes) or an empty object if the note has no front matter
 * NOTE: previously this returned false if the note had no front matter, but now it returns an empty object to correspond with the behavior of the NP API
 * @param {TNote} note
 * @returns object of attributes or empty object if the note has no front matter
 */
export const getFrontMatterAttributes = (note: CoreNoteFields): { [string]: string } => note.frontmatterAttributes || {}

/**
 * Gets the value of a given field ('attribute') from frontmatter if it exists
 * @param {TNote} note - The note to check
 * @param {string} attribute - The attribute/field to get the value of
 * @returns {string|null} The value of the attribute/field or null if not found
 */
export function getFrontMatterAttribute(note: TNote, attribute: string): string | null {
  const fmAttributes = getFrontMatterAttributes(note)
  // Note: fmAttributes returns an empty object {} if there are not frontmatter fields
  return Object.keys(fmAttributes).length > 0 && fmAttributes[attribute]
    ? fmAttributes[attribute]
    : null
}

/**
 * Get the paragraphs that include the front matter (optionally with the separators)
 * This is a helper function for removeFrontMatter and probably won't need to be called directly
 * @author @dwertheimer
 * @param {CoreNoteFields} note - the note
 * @param {boolean} includeSeparators - whether to include the separator lines (---) in the returned array
 * @returns {Array<TParagraph>} just the paragraphs in the front matter (or false if no frontmatter)
 */
export const getFrontMatterParagraphs = (note: CoreNoteFields, includeSeparators: boolean = false): Array<TParagraph> | false => {
  try {
    const paras = note?.paragraphs || []
    if (!paras.length || paras[0].content !== '---') return false
    const startAt = includeSeparators ? 0 : 1
    for (let i = 1; i < paras.length; i++) {
      const para = paras[i]
      if (para.content === '---') return paras.slice(startAt, includeSeparators ? i + 1 : i)
    }
    return false
  } catch (err) {
    logError('NPFrontMatter/getFrontMatterParagraphs()', JSP(err))
    return false
  }
}

/**
 * Get all notes that have frontmatter attributes, optionally including template notes
 * @param {boolean} includeTemplateFolders - whether to include template notes (default: false). By default, excludes all Template folder notes.
 * @param {boolean} onlyTemplateNotes - whether to include only template notes (default: false). By default, includes all notes that have frontmatter keys.
 * @returns {Array<CoreNoteFields>} - an array of notes that have front matter (template notes are included only if includeTemplateFolders is true and the note has frontmatter keys)
 */
export function getFrontMatterNotes(includeTemplateFolders: boolean = false, onlyTemplateNotes: boolean = false): Array<CoreNoteFields> {
  const start = new Date()
  const templateFolder = NotePlan.environment.templateFolder || '@Templates'
  const returnedNotes = DataStore.projectNotes.filter((note) => {
    const hasKeys = Object.keys(note?.frontmatterAttributes || {}).length > 0
    const isTemplate = note.filename.startsWith(templateFolder)
    if (onlyTemplateNotes) return isTemplate && hasKeys
    return !isTemplate ? hasKeys : includeTemplateFolders && hasKeys
  })
  logDebug('getFrontMatterNotes', `Found ${returnedNotes.length} (${includeTemplateFolders ? 'including' : 'excluding'} template notes) notes with frontmatter in ${timer(start)}`)
  return returnedNotes
}

/**
 * Remove the front matter from a note (optionally including the separators)
 * Note: this is a helper function called by setFrontMatterVars and probably won't need to be called directly
 * @author @dwertheimer
 * @param {CoreNoteFields} note - the note
 * @param {boolean} removeSeparators? - whether to include the separator lines (---) in the deletion. Default: false.
 * @returns {boolean} - whether the front matter was removed or not
 */
export function removeFrontMatter(note: CoreNoteFields, removeSeparators: boolean = false): boolean {
  try {
    const fmParas = getFrontMatterParagraphs(note, removeSeparators)
    // clo(fmParas, 'fmParas')
    // clo(note.paragraphs, 'note.paragraphs')
    if (!fmParas) return false
    const fm = getFrontMatterAttributes(note || '')
    note.removeParagraphs(fmParas)
    if (removeSeparators && fm && fm.title) note.prependParagraph(`# ${fm.title}`, 'text')
    return true
  } catch (err) {
    logError('NPFrontMatter/removeFrontMatter()', JSP(err))
    return false
  }
}

/**
 * Remove a particular frontmatter field, or if value provided as well, delete only if both match.
 * @author @jgclark
 * @param {CoreNoteFields} note - the note
 * @param {string} fieldToRemove - field name (without colon)
 * @param {string?} value - value to match on (default no matching)
 * @param {boolean?} removeSeparators - if no fields remain, whether to remove the separator lines (---) as well. Defaults to true.
 * @returns {boolean} - whether the field was removed or not
 */
export function removeFrontMatterField(note: CoreNoteFields, fieldToRemove: string, value: string = '', removeSeparators: boolean = true): boolean {
  try {
    const fmFields = getFrontMatterAttributes(note)
    const fmParas = getFrontMatterParagraphs(note, true)
    if (!fmFields || !fmParas) {
      logWarn('rFMF', `no front matter in note '${displayTitle(note)}'`)
      return false
    }
    let removed = false
    Object.keys(fmFields).forEach((thisKey) => {
      if (thisKey === fieldToRemove) {
        const thisValue = fmFields[thisKey]
        // logDebug('rFMF', `- for thisKey ${thisKey}, looking for <${fieldToRemove}:${value ?? "<undefined}"}> to remove. thisValue=${thisValue}`)
        if (!value || thisValue === value) {
          // logDebug('rFMF', `  - value:${value ?? "<undefined>"} / thisValue:${value ?? "<undefined>"}`)
          // remove this attribute fully
          delete fmFields[thisKey]
          // clo(fmFields, 'fmFields after deletion:')
          // and then find the line to remove from the frontmatter, removing separators if wanted, if no frontmatter left
          for (let i = 1; i < fmParas.length; i++) {
            // ignore first and last paras which are separators
            const para = fmParas[i]
            if ((!value && para.content.startsWith(fieldToRemove)) || (value && para.content === `${fieldToRemove}: ${quoteText(value)}`)) {
              // logDebug('rFMF', `- will delete fmPara ${String(i)}`)
              fmParas.splice(i, 1) // delete this item
              removed = true
              if (fmParas.length <= 2) {
                // logDebug('rFMF', `- this was the only field in the FM`)
                removeFrontMatter(note, removeSeparators)
                // logDebug('rFMF', `removeFrontMatter -> ${String(res)}`)
              } else {
                // logDebug('rFMF', `- now ${fmParas.length} FM paras remain`)
                removeFrontMatter(note, false)
                // logDebug('rFMF', `removeFrontMatter -> ${String(res1)}`)
                writeFrontMatter(note, fmFields, false) // don't mind if there isn't a title; that's not relevant to this operation
                // logDebug('rFMF', `writeFrontMatter -> ${String(res2)}`)
              }
            }
          }
        }
      }
    })
    if (!removed) {
      logDebug('rFMF', `Note had frontmatter, but didn't find key:'${fieldToRemove}' to remove in note '${displayTitle(note)}'`)
    }
    return removed
  } catch (err) {
    logError('NPFrontMatter/removeFrontMatterField()', JSP(err))
    return false
  }
}

/**
 * Recursive helper function used to write multi-line-indented frontmatter keys/values
 * @param {any} obj
 * @param {string} indent - level for recursive indent
 * @returns
 */
function _objectToYaml(obj: any, indent: string = ' '): string {
  let output = ''
  for (const prop in obj) {
    output += `\n${indent}${prop}:`
    if (Array.isArray(obj[prop])) {
      obj[prop].forEach((el) => {
        output += `\n${indent} - ${el}`
      })
    } else if (typeof obj[prop] === 'object' && obj[prop] !== null && Object.keys(obj[prop]).length) {
      output += _objectToYaml(obj[prop], `${indent} `)
    } else {
      output += ` ${obj[prop]}`
    }
  }
  return output
}

/**
 * Write the frontmatter vars to a note which already has frontmatter
 * Note: this is a helper function called by setFrontMatterVars and probably won't need to be called directly
 * You should use setFrontMatterVars instead
 * will add fields for whatever attributes you send in the second argument (could be duplicates)
 * so delete the frontmatter first (using removeFrontMatter()) if you want to add/remove/change fields
 * @param {CoreNoteFields} note
 * @param {Object} attributes - key/value pairs for frontmatter values
 * @param {boolean?} alsoEnsureTitle - ensure that the frontmatter has a title (and set it to the note title if not). Default: true.
 * @param {boolean?} quoteNonStandardYaml - quote any values that are not standard YAML (e.g. contain colons, value starts with @). Default: false.
 * @returns {boolean} was frontmatter written OK?
 * @author @dwertheimer
 */
export function writeFrontMatter(note: CoreNoteFields, attributes: { [string]: string }, alsoEnsureTitle: boolean = true, quoteNonStandardYaml: boolean = false): boolean {
  if (!noteHasFrontMatter(note)) {
    logError(pluginJson, `writeFrontMatter: no frontmatter already found in note, so stopping.`)
    return false
  }
  if (ensureFrontmatter(note, alsoEnsureTitle)) {
    const outputArr = createFrontmatterTextArray(attributes, quoteNonStandardYaml)

    const output = outputArr.join('\n')
    logDebug(pluginJson, `writeFrontMatter: writing frontmatter to note '${displayTitle(note)}':\n"${output}"`)
    note.insertParagraph(output, 1, 'text')
    return true
  } else {
    logError(pluginJson, `writeFrontMatter: Could not write frontmatter for note "${note.filename || ''}" for some reason.`)
  }
  return false
}

export const hasTemplateTagsInFM = (fmText: string): boolean => fmText.includes('<%')

/**
 * NOTE: This function is deprecated. Use the more efficient updateFrontMatterVars() instead.
 * Set/update the front matter attributes for a note.
 * Whatever key:value pairs you pass in will be set in the front matter.
 * If the key already exists, it will be set to the new value you passed;
 * If the key does not exist, it will be added.
 * All existing fields you do not explicitly mention in varObj will keep their previous values (including note title).
 * If the value of a key is set to null, the key will be removed from the front matter.
 * @param {CoreNoteFields} note
 * @param {{[string]:string}} varObj - an object with the key:value pairs to set in the front matter (all strings). If the value of a key is set to null, the key will be removed from the front matter.
 * @returns {boolean} - whether the front matter was set or not
 * @author @dwertheimer
 */
export function setFrontMatterVars(note: CoreNoteFields, varObj: { [string]: string }): boolean {
  try {
    logDebug(pluginJson, `setFrontMatterVars: this function is deprecated. Use updateFrontMatterVars() instead.`)
    const title = varObj.title || null
    clo(varObj, `Starting for note ${note.filename} with varObj:`)
    logDebug(`setFrontMatterVars`, `- BEFORE ensureFM: hasFrontmatter:${String(noteHasFrontMatter(note) || '')} note has ${note.paragraphs.length} lines`)
    const hasFM = ensureFrontmatter(note, true, title)
    logDebug('note.paragraphs', `- AFTER ensureFM has ${note.paragraphs.length} lines, that starts:`)

    if (!hasFM) {
      throw new Error(`setFrontMatterVars: Could not add front matter to note which has no title. Note should have a title, or you should pass in a title in the varObj.`)
    }

    if (hasFrontMatter(note.content || '')) {
      const existingAttributes = getAttributes(note.content)
      const changedAttributes = { ...existingAttributes }
      Object.keys(varObj).forEach((key) => {
        if (varObj[key] === null && existingAttributes.hasOwnProperty(key)) {
          delete changedAttributes[key]
        } else {
          changedAttributes[key] = String(varObj[key])
        }
      })
      removeFrontMatter(note)
      writeFrontMatter(note, changedAttributes)
      logDebug('setFrontMatterVars', `- ENDING with ${note.paragraphs.length} lines, that starts:`)
    } else {
      logError('setFrontMatterVars', `- could not change frontmatter for note "${note.filename || ''}" because it has no frontmatter.`)
    }

    return true
  } catch (error) {
    logError('NPFrontMatter/setFrontMatterVars()', JSP(error))
    return false
  }
}

// /**
//  * TODO: Decide whether to keep this or the earlier rFMF one
//  * @param {CoreNoteFields} note
//  * @param {{[string]:string}} varObj - an object with the key:value pairs to unset (i.e. remove) in the front matter (all strings).
//  * @returns {boolean} - whether the front matter was unset or not
//  */
// export function unsetFrontMatterFields(note: CoreNoteFields, fields: Array<string>): boolean {
//   const attributes: { [string]: string | null } = {}
//   // make object with a key for each field to unset
//   for (let field of fields) {
//     attributes[field] = null
//   }
//   const result = setFrontMatterVars(note, attributes)
//   return result
// }

/**
 * Ensure that a note has front matter (and optionally has a title you specify).
 * WARNING: Failing for @jgclark on calendar notes without existing FM.
 * If the note already has front matter, returns true.
 * If the note does not have front matter, adds it and returns true.
 * If optional title is given, it overrides any existing title in the note for the frontmatter title.
 * @author @dwertheimer based on @jgclark's convertNoteToFrontmatter code
 * @param {TNote} note
 * @param {boolean?} alsoEnsureTitle - if true then fail if a title can't be set. Default: true. For calendar notes this wants to be false.
 * @param {string?} title - optional override text that will be added to the frontmatter as the note title (regardless of whether it already had for a title)
 * @returns {boolean} true if front matter existed or was added, false if failed for some reason
 * @author @dwertheimer
 */
export function ensureFrontmatter(note: CoreNoteFields, alsoEnsureTitle: boolean = true, title?: string | null): boolean {
  const outputNoteContents = (message: string) =>
    note.content &&
    logDebug(
      'ensureFrontmatter',
      `${message} note.content:\n\t${String(
        note.content
          .split('\n')
          .map((line) => `\t${line}`)
          .join('\n'),
      )}`,
    )

  try {
    let retVal = false
    let fm = ''
    if (note == null) {
      // no note - return false
      throw new Error(`No note found. Stopping conversion.`)
    } else if (noteHasFrontMatter(note) && !(alsoEnsureTitle || title)) {
      return true
    } else if (hasFrontMatter(note.content || '')) {
      // already has frontmatter
      const attr = getAttributes(note.content)
      if (!attr.title && title) {
        logDebug('ensureFrontmatter', `Note '${displayTitle(note)}' already has frontmatter but no title. Adding title.`)
        if (note.content) note.content = note.content.replace('---', `---\ntitle: ${title}`)
      } else if (title && attr.title !== title) {
        logDebug('ensureFrontmatter', `Note '${displayTitle(note)}' already has frontmatter but title is wrong. Updating title.`)
        if (note.content) note.content = note.content.replace(`title: ${attr.title}`, `title: ${title}`)
      }
      retVal = true
    } else {
      // need to add frontmatter
      outputNoteContents('before adding frontmatter')
      let newTitle
      if (note.type === 'Notes' && alsoEnsureTitle) {
        logDebug('ensureFrontmatter', `'${note.filename}' had no frontmatter or title line, so will now make one:`)

        const firstLine = note.paragraphs.length ? note.paragraphs[0] : {}
        const firstLineIsTitle = firstLine.type === 'title' && firstLine.headingLevel === 1
        const titleFromFirstLine = firstLineIsTitle ? firstLine.content : ''

        // Make title from parameter or note's existing H1 title or note.title respectively
        newTitle = (title || titleFromFirstLine || note.title || '').replace(/`/g, '') // cover Calendar notes where title is not in the note
        logDebug('ensureFrontmatter', `- newTitle='${newTitle ?? ''}'`)
        if (newTitle === '') {
          logError('ensureFrontmatter', `Cannot find title for '${note.filename}'. Stopping conversion.`)
        }

        if (firstLineIsTitle) note.removeParagraph(note.paragraphs[0]) // remove the heading line now that we set it to fm title
        fm = `---\ntitle: ${quoteText(newTitle)}\n---`
      } else {
        logDebug('ensureFrontmatter', `- just adding empty frontmatter to this calendar note`)
        fm = `---\n---`
      }
      // const newContent = `${front}${note?.content || ''}`
      // logDebug('ensureFrontmatter', `newContent = ${newContent}`)
      // note.content = '' // in reality, we can just set this to newContent, but for the mocks to work, we need to do it the long way
      logDebug('ensureFrontmatter', `front to add: ${fm}`)
      note.insertParagraph(fm, 0, 'text')
      // $FlowIgnore
      if (note.note) {
        // we must be looking at the Editor (because it has a note property)
        logDebug(
          'ensureFrontmatter',
          `We just created frontmatter, but due to a bug/lag in NP, the properties panel/editor may not show it immediately. And the Editor.frontmatterAttributes may not be present immediately. In order to see the frontmatter, you can open the note again, e.g. Editor.openNoteByFilename(Editor.filename).`,
        )
      }
      retVal = true
      logDebug('ensureFrontmatter', `-> Note '${displayTitle(note)}' converted to use frontmatter.`)
      outputNoteContents('after adding frontmatter')
    }
    return retVal
  } catch (error) {
    logError('NPFrontMatter/ensureFrontmattter()', JSP(error))
    return false
  }
}

/**
 * Works out which is the last line of the frontmatter, returning the line index number of the closing separator, or 0 if no frontmatter found.
 * @author @jgclark
 * @param {TNote} note - the note to assess
 * @returns {number | false} - the line index number of the closing separator, or false if no frontmatter found
 */
export function endOfFrontmatterLineIndex(note: CoreNoteFields): number | false {
  try {
    const paras = note.paragraphs
    const lineCount = paras.length
    logDebug(`paragraph/endOfFrontmatterLineIndex`, `total paragraphs in note (lineCount) = ${lineCount}`)
    // Can't have frontmatter as less than 2 separators
    if (paras.filter((p) => p.type === 'separator').length < 2) {
      return false
    }
    // No frontmatter if first line isn't ---
    if (note.paragraphs[0].type !== 'separator') {
      return false
    }
    // No frontmatter if less than 3 lines
    if (note.paragraphs.length < 3) {
      return false
    }
    // Look for second --- line
    let lineIndex = 1
    while (lineIndex < lineCount) {
      const p = paras[lineIndex]
      if (p.type === 'separator') {
        logDebug(`paragraph/endOfFrontmatterLineIndex`, `-> line ${lineIndex} of ${lineCount}`)
        return lineIndex
      }
      lineIndex++
    }
    // Shouldn't get here ...
    return false
  } catch (err) {
    logError('paragraph/findEndOfActivePartOfNote', err.message)
    return NaN // for completeness
  }
}

// Triggers in frontmatter: https://help.noteplan.co/article/173-plugin-note-triggers
// triggers: onEditorWillSave => np.test.onEditorWillSave
// triggers: onEditorWillSave => plugin.id.commandName, onEditorWillSave => plugin.id2.commandName2

/**
 * (helper function) Get the triggers from the frontmatter of a note and separate them by trigger, id, and command name
 * @author @dwertheimer
 * @param {Array<string>} triggersArray - the array of triggers from the frontmatter (e.g. ['onEditorWillSave => np.test.onEditorWillSave', 'onEditorWillSave => plugin.id.commandName', 'onEditorWillSave => plugin.id2.commandName2'])
 * @returns {Object.<TriggerTypes, Array<{pluginID: string, commandName: string}>>}
 */
export function getTriggersByCommand(triggersArray: Array<string>): any {
  const triggers: any = {}
  TRIGGER_LIST.forEach((triggerName) => (triggers[triggerName] = []))
  triggersArray.forEach((trigger) => {
    const [triggerName, command] = trigger.split('=>').map((s) => s.trim())
    const commandSplit = command.split('.').map((s) => s.trim())
    const commandName = commandSplit[commandSplit.length - 1]
    const pluginID = commandSplit.slice(0, commandSplit.length - 1).join('.')
    if (triggerName && pluginID && commandName) {
      triggers[triggerName].push({ pluginID, commandName })
    }
  })
  Object.keys(triggers).forEach((triggerName) => {
    if (triggers[triggerName].length === 0) delete triggers[triggerName]
  })
  return triggers
}

/**
 * (helper function) Format list of trigger(s) command(s) as a single string to add to frontmatter
 * @author @dwertheimer
 * @param {*} triggerObj
 * @returns {string} - the formatted string
 */
export function formatTriggerString(triggerObj: { [TriggerTypes]: Array<{ pluginID: string, commandName: string }> }): string {
  try {
    clo(triggerObj, `formatTriggerString() starting with triggerObj =`)
    let trigArray: Array<string> = []
    TRIGGER_LIST.forEach((triggerName) => {
      // logDebug('formatTriggerString', triggerName)
      if (triggerObj[triggerName] && triggerObj[triggerName].length) {
        trigArray = trigArray.concat(
          triggerObj[triggerName].map((trigger) => {
            return `${triggerName} => ${trigger.pluginID}.${trigger.commandName}`
          }),
        )
      }
      logDebug('formatTriggerString', `  - ${trigArray.join(', ')}`)
    })
    logDebug('formatTriggerString', `-> ${trigArray.join(', ')}`)
    return trigArray.join(', ')
  } catch (error) {
    logError('NPFrontMatter/formatTriggerString()', JSP(error))
    return ''
  }
}

/**
 * Add a trigger to the frontmatter of a note (will create frontmatter if doesn't exist). Will append onto any existing list of trigger(s).
 * @author @dwertheimer
 * @param {CoreNoteFields} note
 * @param {string} trigger 1 from the TriggerTypes
 * @param {string} pluginID - the ID of the plugin
 * @param {string} commandName - the name (NOT THE jsFunction) of the command to run
 * @returns {boolean} - true if the trigger already existed or was added succesfully
 */
export function addTrigger(note: CoreNoteFields, trigger: string, pluginID: string, commandName: string): boolean {
  try {
    if (!TRIGGER_LIST.includes(trigger)) {
      throw new Error(`'${trigger}' is not in the TRIGGER_LIST. Stopping.`)
    }
    if (ensureFrontmatter(note) === false) {
      throw new Error(`Failed to convert note '${displayTitle(note)}' to have frontmatter. Stopping.`)
    }
    logDebug(pluginJson, `addTrigger() starting to add the ${trigger} / ${pluginID} /  ${commandName} to FM:`)
    const attributes = getFrontMatterAttributes(note)
    // clo(attributes, `addTrigger() attributes =`)
    const triggersArray = attributes ? attributes.triggers?.split(',') || [] : []
    const triggersObj = getTriggersByCommand(triggersArray)
    if (triggersObj[trigger]) {
      const commandExists = triggersObj[trigger].find((t) => t.pluginID === pluginID && t.commandName === commandName)
      if (commandExists) {
        logDebug(pluginJson, `addTrigger: Trigger already exists in frontmatter for ${trigger}=>${pluginID}.${commandName} in note '${displayTitle(note)}'. No need to add it.`)
        return true
      }
    } else {
      triggersObj[trigger] = []
    }
    triggersObj[trigger].push({ pluginID, commandName })
    // clo(triggersObj, `addTrigger() triggersObj =`)
    const triggerFrontMatter = { triggers: formatTriggerString(triggersObj) }
    clo(triggerFrontMatter, `addTrigger() triggerFrontMatter setting frontmatter for ${displayTitle(note)}`)
    return updateFrontMatterVars(note, triggerFrontMatter)
  } catch (error) {
    logError('NPFrontMatter/addTrigger()', JSP(error))
    return false
  }
}

/**
 * [Internal function used by frontmatter sanitization functions -- should not be used directly]
 * For pre-processing illegal characters in frontmatter, we must first get the frontmatter text the long way (instead of calling fm() which will error out)
 * Gets the text that represents frontmatter. The first line must be a "---" separator, and include everything until another "---" separator is reached. Include the separators in the output.
 * Returns empty string if no frontmatter found
 * @param {*} text
 */
export function _getFMText(text: string): string {
  const lines = text.split('\n')
  if (lines.length >= 2 && lines[0] === '---') {
    let fmText = ''
    let i = 0
    while (i < lines.length) {
      fmText += `${lines[i]}\n`
      i++
      if (lines[i] === '---') {
        return `${fmText}---\n`
      }
    }
  }
  return ''
}

/**
 * [Internal function used by frontmatter sanitization functions -- should not be used directly]
 * Fix the frontmatter text by quoting values that need it
 * Should always be run after _getFMText() because assumes there is frontmatter
 * @param {string} fmText - the text of the frontmatter (including the separators but not the note text)
 * @returns {string} - the fixed frontmatter text
 * @example fixFrontmatter('---\nfoo: bar:\nbaz: @qux\n---\n') => '---\nfoo: "bar:"\nbaz: "@qux"\n---\n'
 */
export function _fixFrontmatter(fmText: string): string {
  const varLines = fmText.trim().split('\n').slice(1, -1)
  let output = '',
    isMultiline = false
  varLines.forEach((line) => {
    if (line.trim() === '') {
      output += '\n'
      return
    }
    if (isMultiline && !line.trim().startsWith('-')) {
      isMultiline = false
    }
    if (!isMultiline && line.trim().endsWith(':') && line.split(':').length === 2) {
      isMultiline = true
      output += `${line}\n`
      return
    }
    if (isMultiline) {
      output += `${line.trimEnd()}\n`
      return
    }
    const [varName, ...varValue] = line.split(':')
    const value = varValue.join(':').trim()
    const fixedValue = quoteText(value)
    output += `${varName}: ${fixedValue}\n`
  })
  return `---\n${output}---\n`
}

/**
 * [Internal function used by frontmatter sanitization functions -- should not be used directly]
 * Typically is run after a parse error from the frontmatter library
 * Sanitizes the frontmatter text by quoting illegal values that need quoting (e.g. colons, strings that start with: @, #)
 * Returns sanitized text as a string
 * @param {string} originalText
 * @param {boolean} removeTemplateTagsInFM - if true, remove any lines from the template frontmatter that contain template tags themselves (default: false)
 * @returns
 */
export function _sanitizeFrontmatterText(originalText: string, removeTemplateTagsInFM?: boolean = false): string {
  const unfilteredFmText = _getFMText(originalText)
  const hasTags = hasTemplateTagsInFM(unfilteredFmText)
  if (hasTags && !removeTemplateTagsInFM) {
    // logDebug(
    //   `FYI: _sanitizeFrontmatterText: getAttributes was called for a template which has template tags in the frontmatter. This is generally only advisable if you send getAttributes with the second param set to true. Ignore this warning if you meant to do this and it's working fine for you. Template text was: "${originalText}"`,
    // )
  }
  // remove any lines in fmText which contain <%
  const fmTextWithoutTags =
    removeTemplateTagsInFM && hasTags
      ? unfilteredFmText
          .split('\n')
          .filter((line) => !line.includes('<%'))
          .join('\n')
      : unfilteredFmText
  if (fmTextWithoutTags === '') return originalText
  // needs to return full note after sanitizing frontmatter
  // get the text between the separators
  const fixedText = _fixFrontmatter(fmTextWithoutTags)
  return originalText.replace(unfilteredFmText, fixedText)
}

export type FrontMatterDocumentObject = { attributes: { [string]: string }, body: string, frontmatter: string }

/**
 * Get an object representing the document with or without frontmatter
 * Do pre-processing to ensure that the most obvious user-entered illegal character sequences in frontmatter are avoided
 * @param {string} noteText  - full text of note (perhaps starting with frontmatter)
 * @param {boolean} removeTemplateTagsInFM - if true, remove any lines from the template frontmatter that contain template tags themselves (default: false)
 * @returns {Object} - the frontmatter object (or empty object if none)
 */
export function getSanitizedFmParts(noteText: string, removeTemplateTagsInFM?: boolean = false): FrontMatterDocumentObject {
  let fmData = { attributes: {}, body: noteText, frontmatter: '' } //default
  // we need to pre-process the text to sanitize it instead of running fm because we need to
  // preserve #hashtags, @mentions etc. and fm will blank those lines  out as comments
  const sanitizedText = _sanitizeFrontmatterText(noteText || '', removeTemplateTagsInFM)
  try {
    fmData = fm(sanitizedText, { allowUnsafe: true })
  } catch (error) {
    // Expected to fail in certain circumstances due to limitations in fm library
    logWarn(
      `Frontmatter getAttributes error. fm module COULD NOT SANITIZE CONTENT: "${error.message}".\nSuggestion: Check for items in frontmatter that need to be quoted. If fm values are surrounded by double quotes, makes sure they do not contain template tags that also contain double quotes. Template tags in frontmatter will always be quoted. And so make sure your template tags in frontmatter use single quotes, not double quotes in this note:\n"${noteText}\n\nSanitizedText:\n${sanitizedText}"`,
    )
    // logError(`Frontmatter getAttributes error. COULD NOT SANITIZE CONTENT: "${error.message}". Returning empty values for this note: "${JSON.stringify(noteText)}"`)
  }
  return fmData
}

/**
 * Sanitize the frontmatter text by quoting illegal values that need quoting (e.g. colons, strings that start with: @, #)
 * Returns frontmatter object (or empty object if none)
 * Optionally writes the sanitized (quoted) text back to the note
 * @param {*} note
 * @param {*} writeBackToNote - whether to write the sanitized text back to the note
 * @returns {Object} - the frontmatter object (or empty null if none)
 */
export function getSanitizedFrontmatterInNote(note: CoreNoteFields, writeBackToNote: boolean = false): FrontMatterDocumentObject | null {
  const fmData = getSanitizedFmParts(note.content || '') || null
  if (writeBackToNote && fmData?.attributes) {
    if (_getFMText(note.content || '') !== `---\n${fmData.frontmatter}\n---\n`) {
      writeFrontMatter(note, fmData.attributes)
    }
  }
  return fmData
}

/**
 * Get the frontmatter attributes from a note, sanitizing the frontmatter text by quoting illegal values that need quoting (e.g. colons, strings that start with: @, #)
 * Note that templates may include templates (<%) in their frontmatter, which will stop the parser, so if you are trying to getAttributes of a note that could have templates in
 * the frontmatter, set the second param to true to strip those tags out
 * (moved from '@templating/support/modules/FrontmatterModule')
 * // import { getAttributes } from '@templating/support/modules/FrontmatterModule'
 * @param {string} templateData
 * @param {boolean} removeTemplateTagsInFM - if true, remove any lines from the template frontmatter that contain template tags themselves (default: false)
 * @returns {Object} - the frontmatter object (or empty object if none)
 */
export function getAttributes(templateData: string = '', removeTemplateTagsInFM?: boolean = false): Object {
  const fmData = getSanitizedFmParts(templateData, removeTemplateTagsInFM)
  Object.keys(fmData?.attributes).forEach((key) => {
    fmData.attributes[key] || typeof fmData.attributes[key] === 'boolean' ? fmData.attributes[key] : (fmData.attributes[key] = '')
  })
  return fmData && fmData?.attributes ? fmData.attributes : {}
}

/**
 *  Get the body of the note (without frontmatter)
 *  (moved from '@templating/support/modules/FrontmatterModule')
 * @param {string} templateData
 * @returns {string} - the body of the note (without frontmatter)
 */
export function getBody(templateData: string = ''): string {
  if (!templateData) return ''
  const fmData = getSanitizedFmParts(templateData)
  return fmData && fmData?.body ? fmData.body : ''
}

/**
 * Check to see if it has been less than a certain time since the last document write (to avoid infinite loops)
 * Put the example command below at the top of your trigger code which will stop execution
 * if the time since the last document write is less than the minimum time required (default: 2000ms)
 * @param {TNote} note - the note in question - must be a note (e.g. Editor.note) not Editor (Editor has no .versions property)
 * @param {number} minimumTimeRequired (in ms) - default: 2000ms
 * @returns {boolean} - true if the time since the last document write is less than the minimum time required
 * @usage if (Editor?.note && isTriggerLoop(Editor.note)) return // returns/stopping execution if the time since the last document write is less than than 2000ms
 * @author @dwertheimer extended by @jgclark
 */
export function isTriggerLoop(note: TNote, minimumTimeRequiredMS: number = 2000): boolean {
  try {
    if (!note.versions || !note.versions.length) return false // no note version, so no recent update

    const timeSinceLastEdit: number = Date.now() - note.versions[0].date
    if (timeSinceLastEdit <= minimumTimeRequiredMS) {
      logDebug(pluginJson, `isTriggerLoop: only ${String(timeSinceLastEdit)}ms after the last document write. Stopping execution to avoid infinite loop.`)
      return true
    }
    return false
  } catch (error) {
    logError(pluginJson, 'isTriggerLoop error: ${error.message}')
    return false
  }
}

/**
 * Determine which attributes need to be added, updated, or deleted.
 * @param {{ [string]: string }} existingAttributes - Current front matter attributes.
 * @param {{ [string]: string }} newAttributes - Desired front matter attributes.
 * @param {boolean} deleteMissingAttributes - Whether to delete attributes that are not present in newAttributes (default: false)
 * @returns {{
 *   keysToAdd: Array<string>,
 *   keysToUpdate: Array<string>,
 *   keysToDelete: Array<string>
 * }}
 */
export function determineAttributeChanges(
  existingAttributes: { [string]: string },
  newAttributes: { [string]: string },
  deleteMissingAttributes: boolean = false,
): {
  keysToAdd: Array<string>,
  keysToUpdate: Array<string>,
  keysToDelete: Array<string>,
} {
  const keysToAdd = Object.keys(newAttributes).filter((key) => !(key in existingAttributes))
  const keysToUpdate = Object.keys(newAttributes).filter((key) => key in existingAttributes && normalizeValue(existingAttributes[key]) !== normalizeValue(newAttributes[key]))
  const keysToDelete: Array<string> = []
  if (deleteMissingAttributes) {
    keysToDelete.push(...Object.keys(existingAttributes).filter((key) => key !== 'title' && !(key in newAttributes)))
  }
  return { keysToAdd, keysToUpdate, keysToDelete }
}

/**
 * Normalize attribute values by removing quotes for comparison.
 * @param {string} value - The attribute value to normalize.
 * @returns {string} - The normalized value.
 */
export function normalizeValue(value: string): string {
  return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
}

/**
 * Update existing front matter attributes based on the provided newAttributes.
 * Assumes that newAttributes is the complete desired set of attributes.
 * Adds new attributes, updates existing ones, and deletes any that are not present in newAttributes.
 * @param {CoreNoteFields} note - The note to update.
 * @param {{ [string]: string }} newAttributes - The complete set of desired front matter attributes.
 * @param {boolean} deleteMissingAttributes - Whether to delete attributes that are not present in newAttributes (default: false)
 * @returns {boolean} - Whether the front matter was updated successfully.
 */
export function updateFrontMatterVars(note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean {
  try {
    clo(newAttributes, `updateFrontMatterVars: newAttributes = ${JSON.stringify(newAttributes)}`)
    // Ensure the note has front matter
    if (!ensureFrontmatter(note)) {
      logError(pluginJson, `updateFrontMatterVars: Failed to ensure front matter for note "${note.filename || ''}".`)
      return false
    }

    const existingAttributes = { ...getFrontMatterAttributes(note) } || {}
    // Normalize newAttributes before comparison
    clo(existingAttributes, `updateFrontMatterVars: existingAttributes`)
    const normalizedNewAttributes = {}
    clo(Object.keys(newAttributes), `updateFrontMatterVars: Object.keys(newAttributes) = ${JSON.stringify(Object.keys(newAttributes))}`)
    Object.keys(newAttributes).forEach((key: string) => {
      const value = newAttributes[key]
      logDebug('updateFrontMatterVars newAttributes', `key: ${key}, value: ${value}`)
      // $FlowIgnore
      normalizedNewAttributes[key] = typeof value === 'object' ? JSON.stringify(value) : quoteText(value.trim())
    })

    const { keysToAdd, keysToUpdate, keysToDelete } = determineAttributeChanges(existingAttributes, normalizedNewAttributes, deleteMissingAttributes)

    keysToAdd.length > 0 && clo(keysToAdd, `updateFrontMatterVars: keysToAdd`)
    keysToUpdate.length > 0 && clo(keysToUpdate, `updateFrontMatterVars: keysToUpdate`)
    keysToDelete.length > 0 && clo(keysToDelete, `updateFrontMatterVars: keysToDelete`)

    // Update existing attributes -- just replace the text in the paragraph
    keysToUpdate.forEach((key: string) => {
      // $FlowIgnore
      const attributeLine = `${key}: ${normalizedNewAttributes[key]}`
      const paragraph = note.paragraphs.find((para) => para.content.startsWith(`${key}:`))
      if (paragraph) {
        logDebug(pluginJson, `updateFrontMatterVars: updating paragraph "${paragraph.content}" with "${attributeLine}"`)
        paragraph.content = attributeLine
        note.updateParagraph(paragraph)
        logDebug(pluginJson, `updateFrontMatterVars: updated paragraph ${paragraph.lineIndex} to: "${paragraph.content}"`)
      } else {
        logError(pluginJson, `updateFrontMatterVars: Failed to find frontmatter paragraph for key "${key}".`)
      }
    })

    // Add new attributes to the end of the frontmatter
    keysToAdd.forEach((key) => {
      // $FlowIgnore
      const newAttributeLine = `${key}: ${normalizedNewAttributes[key]}`
      // Insert before the closing '---'
      const closingIndex = note.paragraphs.findIndex((para) => para.content.trim() === '---' && para.lineIndex > 0)
      if (closingIndex !== -1) {
        note.insertParagraph(newAttributeLine, closingIndex, 'text')
      } else {
        logError(pluginJson, `updateFrontMatterVars: Failed to find closing '---' in note "${note.filename || ''}" could not add new attribute "${key}".`)
      }
    })

    // Delete attributes that are no longer present
    const paragraphsToDelete = []
    keysToDelete.forEach((key) => {
      const paragraph = note.paragraphs.find((para) => para.content.startsWith(`${key}:`))
      if (paragraph) {
        paragraphsToDelete.push(paragraph)
      } else {
        logError(pluginJson, `updateFrontMatterVars: Failed to find paragraph for key "${key}".`)
      }
    })
    if (paragraphsToDelete.length > 0) {
      note.removeParagraphs(paragraphsToDelete)
    }

    return true
  } catch (error) {
    logError('NPFrontMatter/updateFrontMatterVars()', JSP(error))
    return false
  }
}

/**
 * Create an array of frontmatter text from the provided attributes.
 * Deals with multi-level lists and values that need to be quoted (e.g. strings that contain colons, or @mentions).
 * @param {Object} attributes - The attributes to convert to frontmatter text.
 * @param {boolean} quoteNonStandardYaml - Whether to quote non-standard YAML values.
 * @returns {Array<string>} - An array of frontmatter text.
 */
export function createFrontmatterTextArray(attributes: { [string]: string }, quoteNonStandardYaml: boolean): Array<string> {
  const outputArr = []
  Object.keys(attributes).forEach((key) => {
    const value = attributes[key]
    if (value !== null) {
      if (typeof value === 'string') {
        outputArr.push(quoteNonStandardYaml ? `${key}: ${quoteText(value)}` : `${key}: ${value}`)
      } else if (Array.isArray(value)) {
        const arrayString = value.map((item: string) => `  - ${item}`).join('\n')
        outputArr.push(`${key}:\n${arrayString}`)
      } else if (typeof value === 'object') {
        const yamlString = _objectToYaml(value, '  ')
        outputArr.push(`${key}:${yamlString}`)
      } else {
        outputArr.push(`${key}: ${value}`)
      }
    }
  })
  return outputArr
}
