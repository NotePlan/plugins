// @flow

/**
 * Key FrontMatter functions:
 * getFrontMatterAttributes() - get the front matter attributes from a note
 * setFrontMatterVars() - set/update the front matter attributes for a note (will create frontmatter if necessary)
 * noteHasFrontMatter() - test whether a Test whether a Note contains front matter
 * ensureFrontMatter() - ensure that a note has front matter (will create frontmatter if necessary)
 * addTrigger() - add a trigger to the front matter (will create frontmatter if necessary)
 */

import fm from 'front-matter'
// import { showMessage } from './userInput'
import { clo, JSP, logDebug, logError, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getAttributes } from '@templating/support/modules/FrontmatterModule'
const pluginJson = 'helpers/NPFrontMatter.js'

// Note: update these for each new trigger that gets added
export type TriggerTypes = 'onEditorWillSave' | 'onOpen'
export const TRIGGER_LIST = ['onEditorWillSave', 'onOpen']

/**
 * Frontmatter cannot have colons in the content (specifically ": "), so we need to wrap that in quotes
 * @param {string} text
 * @returns {string} quotedText (if required)
 */
export function quoteText(text: string): string {
  const needsQuoting = text.includes(': ') || /:$/.test(text) || /^#/.test(text) || /^@/.test(text) || text === ''
  const isWrappedInQuotes = /^".*"$/.test(text) // pass it through if already wrapped in quotes
  return needsQuoting && !isWrappedInQuotes ? `"${text}"` : text
}

/**
 * Test whether a string contains front matter using the front-matter library which has a bug/limitation
 * Note: underlying library doesn't actually check whether the YAML comes at the start of the string. @jgclark has raised an issue to fix that.
 * @param {string} text - the text to test (typically the content of a note -- note.content)
 * @returns {boolean} true if it has front matter
 */
// export const hasFrontMatter = (text: string): boolean => fm.test(text)
export const hasFrontMatter = (text: string): boolean => fm.test(text) && text.split('\n', 1)[0] === '---'

/**
 * Test whether a Note contains front matter
 * Note: the underlying library doesn't actually check whether the YAML comes at the start of the string.
 * So @jgclark has added an (imperfect, simple) test to see if it comes at the start, until such a time as the library is updated.
 * @param {CoreNoteFields} note - the note to test
 * @returns {boolean} true if the note has front matter
 */
export const noteHasFrontMatter = (note: CoreNoteFields): boolean =>
  note && hasFrontMatter(note.content || '') && note.paragraphs?.length >= 2 && (note.paragraphs[0].type === 'separator' || note.paragraphs[0].content === '---')

/**
 * get the front matter attributes from a note
 * @param {TNote} note
 * @returns object of attributes or false if the note has no front matter
 */
export const getFrontMatterAttributes = (note: CoreNoteFields): { [string]: string } | false => (hasFrontMatter(note?.content || '') ? getAttributes(note.content) : false)

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
        // logDebug('rFMF', `- for thisKey ${thisKey}, looking for <${fieldToRemove}:${value ?? "<undefined>"}> to remove. thisValue=${thisValue}`)
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
                const res = removeFrontMatter(note, removeSeparators)
                // logDebug('rFMF', `removeFrontMatter -> ${String(res)}`)
              } else {
                // logDebug('rFMF', `- now ${fmParas.length} FM paras remain`)
                const res1 = removeFrontMatter(note, false)
                // logDebug('rFMF', `removeFrontMatter -> ${String(res1)}`)
                const res2 = writeFrontMatter(note, fmFields, false) // don't mind if there isn't a title; that's not relevant to this operation
                // logDebug('rFMF', `writeFrontMatter -> ${String(res2)}`)
              }
            }
          }
        }
      }
    })
    if (!removed) {
      logDebug('rFMF', `didn't find '${fieldToRemove}' to remove in note '${displayTitle(note)}'`)
    }
    return removed
  } catch (err) {
    logError('NPFrontMatter/removeFrontMatterField()', JSP(err))
    return false
  }
}

/**
 * Write the frontmatter vars to a note which already has frontmatter
 * Note: this is a helper function called by setFrontMatterVars and probably won't need to be called directly
 * You should use setFrontMatterVars instead
 * will add fields for whatever attributes you send in the second argument (could be duplicates)
 * so delete the frontmatter first (using removeFrontMatter()) if you want to add/remove/change fields
 * @param {CoreNoteFields} note
 * @param {*} attributes
 * @param {boolean?} alsoEnsureTitle?
 * @returns {boolean} was frontmatter written OK?
 * @author @dwertheimer
 */
export function writeFrontMatter(note: CoreNoteFields, attributes: { [string]: string }, alsoEnsureTitle: boolean = true): boolean {
  if (!noteHasFrontMatter(note)) {
    logError(pluginJson, `writeFrontMatter: no frontmatter already found in note, so stopping.`)
    return false
  }
  if (ensureFrontmatter(note, alsoEnsureTitle)) {
    const outputArr = []
    Object.keys(attributes).forEach((key) => {
      const value = attributes[key]
      if (value !== null) {
        outputArr.push(`${key}: ${quoteText(value)}`)
      }
    })
    const output = outputArr.join('\n')
    note.insertParagraph(output, 1, 'text')
    return true
  } else {
    logError(pluginJson, `writeFrontMatter: Could not write frontmatter for note "${note.filename || ''}" for some reason.`)
  }
  return false
}

/**
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
    const title = varObj.title || null
    logDebug(`setFrontMatterVars`, `Note "${title || ''}" BEFORE: hasFrontmatter:${String(noteHasFrontMatter(note) || '')} note has ${note.paragraphs.length} lines`)
    const hasFM = ensureFrontmatter(note, true, title)
    // clo(note.paragraphs, `setFrontMatterVars: after ensureFrontMatter with ${note.paragraphs.length} lines`)
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
      logDebug('setFrontMatterVars', `- ending with ${note.paragraphs.length} lines`)
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
  try {
    let retVal = false
    if (note == null) {
      // no note - return false
      logError('ensureFrontmatter', `No note found. Stopping conversion.`)
      // await showMessage(`No note found to convert to frontmatter.`)
    } else if (hasFrontMatter(note.content || '')) {
      // already has frontmatter
      const attr = getAttributes(note.content)
      clo(attr, `ensureFrontmatter: Note '${displayTitle(note)}' has frontmatter already: attr =`)
      if (!attr.title && title) {
        logDebug('ensureFrontmatter', `Note '${displayTitle(note)}' already has frontmatter but no title. Adding title.`)
        if (note.content) note.content = note.content.replace('---', `---\ntitle: ${title}\n`)
      } else if (title && attr.title !== title) {
        logDebug('ensureFrontmatter', `Note '${displayTitle(note)}' already has frontmatter but title is wrong. Updating title.`)
        if (note.content) note.content = note.content.replace(`title: ${attr.title}`, `title: ${title}`)
      }
      retVal = true
    } else {
      // need to add frontmatter
      let newTitle
      let front = ''
      if (note.type === 'Notes' && alsoEnsureTitle) {
        // if (!note.title) {
        //   logError('ensureFrontmatter', `'${note.filename}' had no frontmatter or title line, but request requires a title. Stopping conversion.`)
        logDebug('ensureFrontmatter', `'${note.filename}' had no frontmatter or title line, so will now make one:`)
        //   return false
        // }

        const firstLine = note.paragraphs.length ? note.paragraphs[0] : {}
        const titleFromFirstLine = firstLine.type === 'title' && firstLine.headingLevel === 1 ? firstLine.content : ''

        // Make title from parameter or note's existing H1 title or note.title respectively
        newTitle = (title || titleFromFirstLine || note.title || '').replace(/`/g, '') // cover Calendar notes where title is not in the note
        logDebug('ensureFrontmatter', `- newTitle='${newTitle ?? ''}'`)
        if (newTitle === '') {
          logError('ensureFrontmatter', `Cannot find title for '${note.filename}'. Stopping conversion.`)
        }

        if (titleFromFirstLine) note.removeParagraph(note.paragraphs[0]) // remove the heading line now that we set it to fm title
        front = `---\ntitle: ${quoteText(newTitle)}\n---\n`
      } else {
        front = `---\n---\n`
      }
      const newContent = `${front}${note?.content || ''}`
      note.content = '' // in reality, we can just set this to newContent, but for the mocks to work, we need to do it the long way
      note.insertParagraph(newContent, 0, 'text')
      retVal = true
      logDebug('ensureFrontmatter', `-> Note '${displayTitle(note)}' converted to use frontmatter.`)
    }
    // logDebug('ensureFrontmatter', `Returning ${String(retVal)}`)
    return retVal
  } catch (error) {
    logError('NPFrontMatter/ensureFrontmattter()', JSP(error))
    return false
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
    logDebug(pluginJson, `addTrigger() will add ${trigger} / ${pluginID} /  ${commandName} to FM:`)
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
    return setFrontMatterVars(note, triggerFrontMatter)
  } catch (error) {
    logError('NPFrontMatter/addTrigger()', JSP(error))
    return false
  }
}
