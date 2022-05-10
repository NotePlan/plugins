/*
TODO:
1. Create "copy task for each mention" and spin the order so that each mention is first in its own paragraph

*/
import { clo, JSP, log } from '../../helpers/dev'
import { showMessage } from '../../helpers/userInput'
import { getElementsFromTask } from './taskHelpers'
import pluginJson from '../plugin.json'

type TagsList = { hashtags: Array<string>, mentions: Array<string> } //include the @ and # characters

// These Regexes are different from the ones in taskHelpers because they include the # or @
export const HASHTAGS = /\B(#[a-zA-Z0-9\/]+\b)/g
export const MENTIONS = /\B(@[a-zA-Z0-9\/]+\b)/g

/**
 * Get a paragraph by its index (mostly unnecessary)
 * @param {TNote} note
 * @param {number} index - the index of the paragraph to look for
 * @returns
 */
const getParagraphByIndex = (note: TNote, index: number): TParagraph | null => {
  return note.paragraphs[index]
}

/**
 * Takes in a string and returns an object with arrays of #hashtags and @mentions (including the @ and # characters)
 * @param {string} content : ;
 * @returns {TagsList} {hashtags: [], mentions: []}
 */
function getTagsFromString(content: string): TagsList {
  const hashtags = getElementsFromTask(content, HASHTAGS)
  const mentions = getElementsFromTask(content, MENTIONS)
  return { hashtags, mentions }
}

/**
 * Search through the note for a paragraph containing a specific cursor position
 * @param {TNote} note - the note to look in
 * @param {number} position - the position to look for
 * @returns {TParagraph} the paragraph containing the position in question or null if not found
 */
function getParagraphContainingPosition(note: TNote, position: number): TParagraph | null {
  let foundParagraph = null
  note.paragraphs.forEach((p, i) => {
    const { start, end } = p.contentRange
    if (start <= position && end >= position) foundParagraph = p
  })
  return foundParagraph
}

/**
 * Add tags to a list without duplicates
 * Given an array of tags, and an array of newTags you want to merge in,
 * return an array of tags that are merged and not duplicated
 * @param {Array<string>} existingTags
 * @param {Array<string>} newTags
 * @returns
 */
function eliminateExistingTags(existingTags, newTags): Array<string> {
  let revisedTags = []
  if (newTags.length) {
    if (existingTags.length) {
      newTags.forEach((tag, i) => {
        console.log(`existingTags.indexOf(tag) ${existingTags.indexOf(tag)}`)
        if (existingTags.indexOf(tag) === -1) revisedTags.push(tag)
      })
    } else {
      console.log('existingTags.length === 0')
      revisedTags = newTags
    }
  }
  return revisedTags
}

/**
 * Append specific hashtags and mentions to a paragraph (if they don't already exist)
 * @param {TParagraph} thisParagraph
 * @param {TagsList} tagsToCopy in form of {hashtags: [], mentions: []}
 */
function updateParagraphTags(thisParagraph: TParagraph, tagsToCopy: TagsList): void {
  const existingTags = getTagsFromString(thisParagraph.content)
  const mentions = eliminateExistingTags(existingTags.mentions, tagsToCopy.mentions)
  const hashtags = eliminateExistingTags(existingTags.hashtags, tagsToCopy.hashtags)
  if (hashtags.length || mentions.length) {
    const stuff = `${hashtags.join(' ')} ${mentions.join(' ')}`.trim()
    if (stuff.length) {
      thisParagraph.content = `${thisParagraph.content ? `${thisParagraph.content} ` : ''} ${stuff}`.replace(/\s{2,}/gm, ' ')
      Editor.updateParagraph(thisParagraph)
    }
  } else {
    console.log('no tags found or no tags need to be copied in list: ', tagsToCopy.toString())
  }
}

/**
 * Try to determine the paragraph that the cursor is in (in the Editor)
 * There are some NotePlan bugs that make this not work perfectly
 * @returns {TParagraph} the paragraph that the cursor is in or null if not found
 */
function getSelectedParagraph(): TParagraph | null {
  //   const thisParagraph = Editor.selectedParagraphs // recommended by @eduard but currently not reliable (Editor.selectedParagraphs is empty on a new line)
  let thisParagraph
  if (Editor.selection?.start) {
    thisParagraph = getParagraphContainingPosition(Editor.note, Editor.selection.start)
  }
  if (!thisParagraph || !Editor.selection?.start)
    showMessage(`No paragraph found selection.start: ${selection?.start} Editor.selectedParagraphs.length = ${Editor.selectedParagraphs?.length}`)
  return thisParagraph
}

/**
 * Copy the tags from the line above the cursor to the current line in the Editor
 * Useful for quickly repeating tags from a previous line to the current line
 * (plugin Entry Point for "cta - Copy tags from previous line")
 */
export function copyTagsFromLineAbove() {
  const thisParagraph = getSelectedParagraph()
  const { noteType, lineIndex } = thisParagraph
  const topOfNote = noteType === 'Notes' ? 1 : 0
  if (lineIndex > 0) {
    const prevLineTags = getTagsFromString(getParagraphByIndex(Editor, lineIndex - 1).content)
    updateParagraphTags(thisParagraph, prevLineTags)
  } else {
    showMessage(`Cannot run this command on the first line of the ${noteType}`)
  }
}

/**
 * Copy the tags from the last heading above the cursor to all lines between the heading and the cursor
 * Useful for quickly repeating tags from a heading to each line below it (e.g. in a task list)
 * (plugin Entry Point for "cth - Copy tags from heading above")
 */
export function copyTagsFromHeadingAbove() {
  let thisParagraph = getSelectedParagraph()
  const { noteType, lineIndex, heading, headingRange } = thisParagraph
  const topOfNote = noteType === 'Notes' ? 1 : 0
  if (heading.length) {
    const headingPara = getParagraphContainingPosition(Editor.note, headingRange.start)
    if (headingPara) {
      let headingLineTags = getTagsFromString(heading)
      clo(headingLineTags, 'headingLineTags')
      console.log(`copyTagsFromHeadingAbove indeces: ${headingPara.lineIndex + 1}-${thisParagraph.lineIndex}`)
      for (let index = headingPara.lineIndex + 1; index <= thisParagraph.lineIndex; index++) {
        const currentPara = getParagraphByIndex(Editor.note, index)
        updateParagraphTags(currentPara, headingLineTags)
      }
    } else {
      showMessage(`Could not find the paragraph matching ${heading}`)
    }
  } else {
    showMessage(`Can only run this command on a line under a heading`)
  }
}
