// @flow

import fm from 'front-matter'
import { showMessage } from './userInput'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getAttributes } from '@templating/support/modules/FrontmatterModule'
const pluginJson = 'helpers/NPFrontMatter.js'

/**
 * Test whether a string contains front matter
 * @param {string} text - the text to test (typically the content of a note -- note.content)
 * @returns {boolean} true if it has front matter
 */
export const hasFrontMatter = (text: string): boolean => fm.test(text)

/**
 * get the front matter attributes from a note
 * @param {TNote} note
 * @returns object of attributes or false if the note has no front matter
 */
export const getFrontMatterAttributes = (note: TNote): { [string]: string } | false => (hasFrontMatter(note?.content || '') ? getAttributes(note.content) : false)

//TODO: write this function
export function setFrontMatterVars(varObj: { [string]: string }): boolean {
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
 */
export async function ensureFrontmatter(note: TNote, title?: string): Promise<boolean> {
  let retVal = false
  if (note == null) {
    // no note - return false
    logError(pluginJson, `ensureFrontmatter:No note found. Stopping conversion.`)
    await showMessage(`No note found to convert to frontmatter.`)
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
        await showMessage(`Cannot convert '${note.filename}' note as it is empty & has no title.`)
      } else {
        newTitle = title
      }
    } else {
      // Get title
      const firstLine = note.paragraphs.length ? note.paragraphs[0] : {}
      const titleText = firstLine.type === 'title' && firstLine.headingLevel === 1 && firstLine.content
      newTitle = title || titleText
      if (!newTitle) {
        logError(pluginJson, `ensureFrontmatter:'${note.filename}' has no title line. Stopping conversion.`)
      }
    }
    if (newTitle) {
      const front = `---\ntitle: ${newTitle}\n---\n`
      note.prependParagraph(front, 'text')
      retVal = true
      logDebug(pluginJson, `ensureFrontmatter:Note '${displayTitle(note)}' converted to use frontmatter.`)
    }
  }
  return retVal
}
