// @Flow
/*
TODO: /ctt is working, but future commands could easily rewrite the order so they are not different

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
export function getTagsFromString(content: string): TagsList {
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
function getParagraphContainingPosition(note: TNote | Editor, position: number): TParagraph | null {
  let foundParagraph = null
  note.paragraphs.forEach((p, i) => {
    const { start, end } = p.contentRange
    if (start <= position && end >= position) {
      foundParagraph = p
      if (i > 0)
        log(
          pluginJson,
          `getParagraphContainingPosition: paragraph before: ${i - 1} (${note.paragraphs[i - 1].contentRange.start}-${note.paragraphs[i - 1].contentRange.end}) - "${
            note.paragraphs[i - 1].content
          }"`,
        )
      log(pluginJson, `getParagraphContainingPosition: found position ${position} in paragraph ${i} (${start}-${end}) -- "${p.content}"`)
    }
  })
  if (!foundParagraph) {
    log(pluginJson, `getParagraphContainingPosition: *** Looking for cursor position ${position}`)
    note.paragraphs.forEach((p, i) => {
      const { start, end } = p.contentRange
      log(pluginJson, `getParagraphContainingPosition: paragraph ${i} (${start}-${end}) "${p.content}"`)
    })
    log(pluginJson, `getParagraphContainingPosition: *** position ${position} not found`)
  }
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
export function getUnduplicatedMergedTagArray(existingTags: Array<string> = [], newTags: Array<string> = []): Array<string> {
  return [...new Set([...existingTags, ...newTags])]
}

/**
 * Append specific hashtags and mentions to a string (if they don't already exist)
 * @param {string} paraText - the original paragraph text
 * @param {TagsList} tagsToCopy in form of {hashtags: [], mentions: []}
 */
export function appendTagsToText(paraText: string, tagsToCopy: TagsList): string | null {
  log(pluginJson, `appendTagsToText: tagsToCopy.mentions=${tagsToCopy.mentions.toString()}`)
  const existingTags = getTagsFromString(paraText)
  const nakedLine = removeTagsFromLine(paraText, [...existingTags.mentions, ...existingTags.hashtags])
  log(pluginJson, `appendTagsToText: nakedLine=${nakedLine}`)
  log(pluginJson, `existingTags: existingTags.mentions=${existingTags.mentions.toString()}`)
  const mentions = getUnduplicatedMergedTagArray(existingTags.mentions, tagsToCopy.mentions)
  const hashtags = getUnduplicatedMergedTagArray(existingTags.hashtags, tagsToCopy.hashtags)
  log(pluginJson, `appendTagsToText: mentions=${mentions.toString()}`)
  if (hashtags.length || mentions.length) {
    const stuff = `${hashtags.join(' ')} ${mentions.join(' ')}`.trim()
    if (stuff.length) {
      return `${nakedLine ? `${nakedLine} ` : ''} ${stuff}`.replace(/\s{2,}/gm, ' ')
    }
  } else {
    console.log('no tags found or no tags need to be copied in list: ', tagsToCopy.toString())
    return paraText
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
    thisParagraph = getParagraphContainingPosition(Editor, Editor.selection.start)
  }
  if (!thisParagraph || !Editor.selection?.start) {
    log(pluginJson, `getSelectedParagraph: no paragraph found for cursor position Editor.selection?.start=${Editor.selection?.start} thisParagraph=${thisParagraph}`)
    showMessage(`No paragraph found selection.start: ${selection?.start} Editor.selectedParagraphs.length = ${Editor.selectedParagraphs?.length}`)
  }
  return thisParagraph
}

/**
 * Given a flat array of tags (hashtags and mentions), remove them from an input string
 * and return the naked line without the tags
 * @param {string} line
 * @param {Array<string>} tagsToRemove
 * @returns {string} the naked line
 */
export function removeTagsFromLine(line: string, tagsToRemove: Array<string>): string {
  if (tagsToRemove?.length) {
    return tagsToRemove.reduce((acc, tag) => {
      return acc.replace(new RegExp(`\\s+${tag}`, 'gim'), '')
    }, line)
  } else {
    return line
  }
}

/**
 * Make a copy of the selected line and insert just beneath the line
 * Useful for creating multiple tasks (e.g. one for each person tagged in the paragraph)
 * @param {string} type 'hashtags' | 'mentions'
 */
function copyLineForTags(type: 'hashtags' | 'mentions'): void {
  const thisParagraph = getSelectedParagraph()
  const { noteType, lineIndex } = thisParagraph
  const existingTags = getTagsFromString(thisParagraph.content)
  let tagsInQuestion = existingTags[type]
  if (tagsInQuestion.length <= 1) {
    showMessage(`No ${type} to copy`)
    return
  } else {
    let contentWithoutTheseTags = removeTagsFromLine(thisParagraph.content, existingTags.hashtags)
    contentWithoutTheseTags = removeTagsFromLine(contentWithoutTheseTags, existingTags.mentions)
    for (let i = 0; i < tagsInQuestion.length; i++) {
      const tag = tagsInQuestion[i]
      if (i > 0) {
        tagsInQuestion.push(tagsInQuestion.shift())
        const updatedText = appendTagsToText(contentWithoutTheseTags, { ...existingTags, ...{ [type]: tagsInQuestion } })
        if (updatedText) {
          Editor.insertParagraphAfterParagraph(updatedText, thisParagraph, thisParagraph.type)
        }
      }
    }
  }
}

/**
 * Copy line multiple times (one for each mention)
 * (plugin Entry Point for "ctm - Copy line for each @mention, listing it first")
 */
export function copyLineForEachMention() {
  copyLineForTags('mentions')
}

/**
 * Copy line multiple times (one for each mention)
 * (plugin Entry Point for "ctm - Copy line for each @mention, listing it first")
 */
export function copyLineForEachHashtag() {
  copyLineForTags('hashtags')
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
    const updatedText = appendTagsToText(thisParagraph.content, prevLineTags)
    // log(pluginJson, `copyTagsFromLineAbove: updatedText=${updatedText}`)
    if (updatedText) {
      // clo(thisParagraph, `thisParagraph before:`)
      thisParagraph.content = updatedText
      Editor.updateParagraph(thisParagraph)
      // clo(thisParagraph, `thisParagraph after:`)
    }
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
    const headingPara = getParagraphContainingPosition(Editor, headingRange.start)
    if (headingPara) {
      let headingLineTags = getTagsFromString(heading)
      for (let index = headingPara.lineIndex + 1; index <= thisParagraph.lineIndex; index++) {
        const currentPara = getParagraphByIndex(Editor.note, index)
        const updatedText = appendTagsToText(currentPara.content, headingLineTags)
        if (updatedText) {
          currentPara.content = updatedText
          Editor.updateParagraph(currentPara)
        }
      }
    } else {
      showMessage(`Could not find the paragraph matching ${heading}`)
    }
  } else {
    showMessage(`Can only run this command on a line under a heading`)
  }
}
