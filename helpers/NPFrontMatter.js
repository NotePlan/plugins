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
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getAttributes } from '@templating/support/modules/FrontmatterModule'
const pluginJson = 'helpers/NPFrontMatter.js'

export type TriggerTypes = 'onEditorWillSave' | 'onOpen'

//TODO: update this for each new trigger that gets added
const TRIGGER_LIST = ['onEditorWillSave', 'onOpen']

/**
 * Test whether a string contains front matter
 * @param {string} text - the text to test (typically the content of a note -- note.content)
 * @returns {boolean} true if it has front matter
 */
export const hasFrontMatter = (text: string): boolean => fm.test(text)

/**
 * Test whether a Note contains front matter
 * @param {CoreNoteFields} note - the note to test
 * @returns {boolean} true if the note has front matter
 */
export const noteHasFrontMatter = (note: CoreNoteFields): boolean => hasFrontMatter(note.content || '')

/**
 * get the front matter attributes from a note
 * @param {TNote} note
 * @returns object of attributes or false if the note has no front matter
 */
export const getFrontMatterAttributes = (note: CoreNoteFields): { [string]: string } | false => (hasFrontMatter(note?.content || '') ? getAttributes(note.content) : false)

/**
 * Get the paragraphs that include the front matter (optionally with the separators)
 * This is a helper function for removeFrontMatter and probably won't need to be called directly
 * @param {CoreNoteFields} note - the note
 * @param {boolean} includeSeparators - whether to include the separator lines (---) in the returned array
 * @returns {Array<TParagraph>} just the paragraphs in the front matter (or false if no frontmatter)
 * @author @dwertheimer
 */
export const getFrontMatterParagraphs = (note: CoreNoteFields, includeSeparators: boolean = false): Array<TParagraph> | false => {
  const paras = note?.paragraphs || []
  if (!paras.length || paras[0].content !== '---') return false
  const startAt = includeSeparators ? 0 : 1
  for (let i = 1; i < paras.length; i++) {
    const para = paras[i]
    if (para.content === '---') return paras.slice(startAt, includeSeparators ? i + 1 : i)
  }
  return false
}

/**
 * Remove the front matter from a note (optionally including the separators)
 * Note: this is a helper function called by setFrontMatterVars and probably won't need to be called directly
 * @param {CoreNoteFields} note - the note
 * @param {boolean} includeSeparators - whether to include the separator lines (---) in the deleted paragraphs
 * @returns {boolean} - whether the front matter was removed or not
 * @author @dwertheimer
 */
export function removeFrontMatter(note: CoreNoteFields, includeSeparators: boolean = false): boolean {
  const fmParas = getFrontMatterParagraphs(note, includeSeparators)
  if (!fmParas) return false
  note.removeParagraphs(fmParas)
  return true
}

/**
 * write the frontmatter vars to a note which already has frontmatter
 * Note: this is a helper function called by setFrontMatterVars and probably won't need to be called directly
 * You should use setFrontMatterVars instead
 * will add fields for whatever attributes you send in the second argument (could be duplicates)
 * so delete the frontmatter first (using removeFrontMatter()) if you want to add/remove/change fields
 * @param {*} note
 * @param {*} attributes
 * @returns
 * @author @dwertheimer
 */
export function writeFrontMatter(note: CoreNoteFields, attributes: { [string]: string }): boolean {
  if (ensureFrontmatter(note)) {
    const outputArr = []
    Object.keys(attributes).forEach((key) => {
      const value = attributes[key]
      if (value !== null) {
        outputArr.push(`${key}: ${value}`)
      }
    })
    const output = outputArr.join('\n')
    note.insertParagraph(output, 1, 'text')
    return true
  } else {
    logError(pluginJson, `writeFrontMatter: Could not change frontmatter for note "${note.filename || ''}" because it has no frontmatter.`)
  }
  return false
}

/**
 * Set/update the front matter attributes for a note
 * Whatever key:value pairs you pass in will be set in the front matter
 * If the key already exists, it will be set to the new value you passed
 * If the key does not exist, it will be added
 * All existing fields you do not explicitly mention in varObj will keep their previous values (including note title)
 * If the value of a key is set to null, the key will be removed from the front matter
 * @param {CoreNoteFields} note
 * @param {{[string]:string}} varObj - an object with the key:value pairs to set in the front matter (all strings). If the value of a key is set to null, the key will be removed from the front matter.
 * @returns {boolean} - whether the front matter was set or not
 * @author @dwertheimer
 */
export function setFrontMatterVars(note: CoreNoteFields, varObj: { [string]: string }): boolean {
  const title = varObj.title || null
  const hasFM = ensureFrontmatter(note, title)
  if (!hasFM) {
    logError(`setFrontMatterVars: Could not add front matter to note which has no title. Note should have a title, or you should pass in a title in the varObj.`)
    return false
  }
  if (hasFrontMatter(note?.content || '')) {
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
  } else {
    logError(pluginJson, `setFrontMatterVars: Could not change frontmatter for note "${note.filename || ''}" because it has no frontmatter.`)
  }
  return true
}

/**
 * Ensure that a note has front matter (and optionally has a title you specify)
 * If the note already has front matter, returns true
 * If the note does not have front matter, adds it and returns true
 * If optional title is given, it overrides any title in the note for the frontmatter title.
 * @author @dwertheimer based on @jgclark's convertNoteToFrontmatter code
 * @param {TNote} note
 * @param {string} title - optional override text that will be added to the frontmatter as the note title (regardless of whether it already had for a title)
 * @returns {boolean} true if front matter existed or was added, false if failed for some reason
 * @author @dwertheimer
 */
export function ensureFrontmatter(note: CoreNoteFields, title?: string | null): boolean {
  let retVal = false
  if (note == null) {
    // no note - return false
    logError(pluginJson, `ensureFrontmatter:No note found. Stopping conversion.`)
    // await showMessage(`No note found to convert to frontmatter.`)
  } else if (hasFrontMatter(note?.content || '')) {
    //already has frontmatter
    const attr = getAttributes(note.content)
    if (!attr.title && title) {
      logDebug(pluginJson, `ensureFrontmatter:Note '${displayTitle(note)}' already has frontmatter but no title. Adding title.`)
      if (note.content) note.content = note.content.replace('---', `---\ntitle: ${title}\n`)
    } else if (title && attr.title !== title) {
      logDebug(pluginJson, `ensureFrontmatter:Note '${displayTitle(note)}' already has frontmatter but title is wrong. Updating title.`)
      if (note.content) note.content = note.content.replace(`title: ${attr.title}`, `title: ${title}`)
    }
    retVal = true
  } else {
    let newTitle
    if (note.paragraphs.length < 1) {
      if (!title) {
        logError(pluginJson, `ensureFrontmatter:'${note.filename}' has no title line. Stopping conversion.`)
        // await showMessage(`Cannot convert '${note.filename}' note as it is empty & has no title.`)
        newTitle = note.title || null // cover Calendar notes where title is not in the note
      } else {
        newTitle = title || note.title // cover Calendar notes where title is not in the note
      }
    } else {
      // Get title
      if (note.type === 'Calendar') {
        newTitle = title || note.title // cover Calendar notes where title is not in the note
      } else {
        const firstLine = note.paragraphs.length ? note.paragraphs[0] : {}
        const titleText = firstLine.type === 'title' && firstLine.headingLevel === 1 && firstLine.content
        if (titleText) note.removeParagraph(note.paragraphs[0]) // remove the heading line now that we set it to fm title
        newTitle = title || titleText
        logDebug(pluginJson, `ensureFrontmatter newTitle=${String(newTitle)}`)
        if (!newTitle) {
          logError(pluginJson, `ensureFrontmatter:'${note.filename}' has no title line. Stopping conversion.`)
        }
      }
    }
    if (newTitle) {
      const front = note.type === 'Calendar' ? `---\n---\n` : `---\ntitle: ${newTitle}\n---\n`
      note.content = `${front}${note?.content || ''}`
      retVal = true
      logDebug(pluginJson, `ensureFrontmatter:Note '${displayTitle(note)}' converted to use frontmatter.`)
    }
  }
  logDebug(pluginJson, `ensureFrontmatter returning: ${String(retVal)}`)
  return retVal
}

// Triggers in frontmatter: https://help.noteplan.co/article/173-plugin-note-triggers
// triggers: onEditorWillSave => np.test.onEditorWillSave
// triggers: onEditorWillSave => plugin.id.commandName, onEditorWillSave => plugin.id2.commandName2

/**
 * (helper function) Get the triggers from the frontmatter of a note and separate them by trigger, id, and command name
 * @param {Array<string>} triggersArray - the array of triggers from the frontmatter (e.g. ['onEditorWillSave => np.test.onEditorWillSave', 'onEditorWillSave => plugin.id.commandName', 'onEditorWillSave => plugin.id2.commandName2'])
 * @returns {Object.<TriggerTypes, Array<{pluginID: string, commandName: string}>>
 * @author @dwertheimer
 */
export function getTriggersByCommand(triggersArray: Array<string>): any {
  const triggers = {}
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
 * (helper function) Format trigger frontmatter string for ouptput as a string
 * @param {*} triggerObj
 * @returns {string} - the formatted string
 */
export function formatTriggerString(triggerObj: { [TriggerTypes]: Array<{ pluginID: string, commandName: string }> }): string {
  let trigArray = []
  TRIGGER_LIST.forEach((triggerName) => {
    if (triggerObj[triggerName] && triggerObj[triggerName].length) {
      trigArray = trigArray.concat(
        triggerObj[triggerName].map((trigger) => {
          return `${triggerName} => ${trigger.pluginID}.${trigger.commandName}`
        }),
      )
    }
  })
  return trigArray.join(', ')
}

/**
 * Add a trigger to the frontmatter of a note (will create frontmatter if doesn't exist)
 * @param {CoreNoteFields} note
 * @param {TriggerTypes} trigger
 * @param {string} pluginID - the ID of the plugin
 * @param {string} commandName - the name (NOT THE jsFunction) of the command to run
 * @returns {boolean} - whether the trigger was added or not
 * @author @dwertheimer
 */
export function addTrigger(note: CoreNoteFields, trigger: string, pluginID: string, commandName: string): boolean {
  try {
    if (ensureFrontmatter(note) === false) return false
    logDebug(pluginJson, `addTrigger adding metadata`)
    const attributes = getFrontMatterAttributes(note)
    const triggersArray = attributes ? attributes.triggers?.split(',') || [] : []
    const triggersObj = getTriggersByCommand(triggersArray)
    clo(`addTrigger triggersObj${triggersObj}`)
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
    const triggerFrontMatter = { triggers: formatTriggerString(triggersObj) }
    clo(triggerFrontMatter, `addTrigger triggerFrontMatter setting frontmatter for ${displayTitle(note)}`)
    return setFrontMatterVars(note, triggerFrontMatter)
  } catch (error) {
    logError(pluginJson, JSP(error))
    return false
  }
}
