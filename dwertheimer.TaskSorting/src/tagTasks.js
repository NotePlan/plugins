// @flow
/*
TODO: /ctt is working, but future commands could easily rewrite the order so they are not different

*/

import { clo, JSP, log, logDebug } from '../../helpers/dev'
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { getTagsFromString, type TagsList } from '../../helpers/paragraph'
import { getFrontMatterAttributes } from '@helpers/NPFrontMatter'
import { getSelectedParagraph, getParagraphContainingPosition } from '@helpers/NPParagraph'

/**
 * Get a paragraph by its index (mostly unnecessary)
 * @param {TNote} note
 * @param {number} index - the index of the paragraph to look for
 * @returns
 */
const getParagraphByIndex = (note: CoreNoteFields, index: number): TParagraph | null => {
  return note.paragraphs[index]
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
  logDebug(pluginJson, `appendTagsToText: tagsToCopy.mentions=${tagsToCopy.mentions.toString()}`)
  const existingTags = getTagsFromString(paraText)
  const nakedLine = removeTagsFromLine(paraText, [...existingTags.mentions, ...existingTags.hashtags])
  logDebug(pluginJson, `appendTagsToText: nakedLine=${nakedLine}`)
  logDebug(pluginJson, `existingTags: existingTags.mentions=${existingTags.mentions.toString()}`)
  const mentions = getUnduplicatedMergedTagArray(existingTags.mentions, tagsToCopy.mentions)
  const hashtags = getUnduplicatedMergedTagArray(existingTags.hashtags, tagsToCopy.hashtags)
  logDebug(pluginJson, `appendTagsToText: mentions=${mentions.toString()}`)
  if (hashtags.length || mentions.length) {
    const stuff = `${hashtags.join(' ')} ${mentions.join(' ')}`.trim()
    if (stuff.length) {
      return `${nakedLine ? `${nakedLine} ` : ''} ${stuff}`.replace(/\s{2,}/gm, ' ')
    }
  } else {
    logDebug('no tags found or no tags need to be copied in list: ', tagsToCopy.toString())
    return paraText
  }
  return null
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
async function copyLineForTags(typ: 'hashtags' | 'mentions'): Promise<void> {
  const thisParagraph = await getSelectedParagraph()
  if (thisParagraph) {
    // const { noteType, lineIndex } = thisParagraph
    const existingTags = getTagsFromString(thisParagraph.content)
    const tagsInQuestion = existingTags[typ]
    if (tagsInQuestion.length <= 1) {
      showMessage(`No ${typ} to copy`)
      return
    } else {
      let contentWithoutTheseTags = removeTagsFromLine(thisParagraph.content, existingTags.hashtags)
      contentWithoutTheseTags = removeTagsFromLine(contentWithoutTheseTags, existingTags.mentions)
      for (let i = 0; i < tagsInQuestion.length; i++) {
        // const tag = tagsInQuestion[i]
        if (i > 0) {
          tagsInQuestion.push(tagsInQuestion.shift())
          const updatedText = appendTagsToText(contentWithoutTheseTags, {
            ...existingTags,
            //$FlowIgnore
            ...{ [typ]: tagsInQuestion },
          })
          if (updatedText) {
            Editor.insertParagraphAfterParagraph(updatedText, thisParagraph, thisParagraph.type)
          }
        }
      }
    }
  }
  return
}

/**
 * Copy line multiple times (one for each mention)
 * (plugin Entry Point for "ctm - Copy line for each @mention, listing it first")
 */
export async function copyLineForEachMention() {
  await copyLineForTags('mentions')
}

/**
 * Copy line multiple times (one for each mention)
 * (plugin Entry Point for "ctm - Copy line for each @mention, listing it first")
 */
export async function copyLineForEachHashtag() {
  await copyLineForTags('hashtags')
}

/**
 * Copy the tags from the line above the cursor to the current line in the Editor
 * Useful for quickly repeating tags from a previous line to the current line
 * (plugin Entry Point for "cta - Copy tags from previous line")
 */
export async function copyTagsFromLineAbove() {
  const thisParagraph = await getSelectedParagraph()
  if (thisParagraph) {
    const { noteType, lineIndex } = thisParagraph
    // const topOfNote = noteType === 'Notes' ? 1 : 0
    if (lineIndex > 0) {
      const para = getParagraphByIndex(Editor, lineIndex - 1)
      if (para) {
        const prevLineTags = getTagsFromString(para.content)
        const updatedText = appendTagsToText(thisParagraph.content, prevLineTags)
        //logDebug(pluginJson, `copyTagsFromLineAbove: updatedText=${updatedText}`)
        if (updatedText) {
          // clo(thisParagraph, `thisParagraph before:`)
          thisParagraph.content = updatedText
          Editor.updateParagraph(thisParagraph)
          // clo(thisParagraph, `thisParagraph after:`)
        }
      }
    } else {
      showMessage(`Cannot run this command on the first line of the ${noteType || ''}`)
    }
  }
}

/**
 * Copy the tags from the last heading above the cursor to all lines between the heading and the cursor
 * Useful for quickly repeating tags from a heading to each line below it (e.g. in a task list)
 * (plugin Entry Point for "cth - Copy tags from heading above")
 */
export async function copyTagsFromHeadingAbove() {
  const thisParagraph = await getSelectedParagraph()
  if (thisParagraph) {
    const { heading, headingRange } = thisParagraph
    // const topOfNote = noteType === 'Notes' ? 1 : 0
    if (heading.length && headingRange && Editor?.note) {
      const headingPara = getParagraphContainingPosition(Editor, headingRange.start)
      if (headingPara) {
        const headingLineTags = getTagsFromString(heading)
        for (let index = headingPara.lineIndex + 1; index <= thisParagraph.lineIndex; index++) {
          if (Editor) {
            const currentPara = getParagraphByIndex(Editor, index)
            if (currentPara) {
              const updatedText = appendTagsToText(currentPara.content, headingLineTags)
              if (updatedText) {
                currentPara.content = updatedText
                Editor.updateParagraph(currentPara)
              }
            }
          }
        }
      } else {
        showMessage(`Could not find the paragraph matching ${heading}`)
      }
    } else {
      showMessage(`Can only run this command on a line under a heading`)
    }
  }
}

/**
 * Copy the tags from the front matter
 * Supports comma or space separated tags
 *
 */
function findTagsInFrontMatter(): Array<string> | null {
    const frontMatter = getFrontMatterAttributes(Editor)
    if (frontMatter && frontMatter.noteTags) {
        const tags = frontMatter.noteTags.replaceAll(',', ' ').trim().split(' ').filter(tag => tag !== '')
        return tags
    }
    return null
}

/**
 * Add all noteTags to all tasks in the note
 * (plugin Entry Point for "cnt - Copy tags from front matter to all tasks")
 *
 */
export function addNoteTagsToAllTask(): void {
    const tags = findTagsInFrontMatter()
    if (tags) {
      const taskTypes = ['open', 'done', 'scheduled']
       const tasksParagraphs = Editor.paragraphs.filter(p => taskTypes.includes(p.type))
       tasksParagraphs.forEach(currentPara => {
          const updatedText = appendTagsToText(currentPara.content, {hashtags: tags, mentions: []})
          if (updatedText !== null && updatedText !== '') {
            currentPara.content = updatedText
            Editor.updateParagraph(currentPara)
          }
        })
    } else {
        showMessage('No \'noteTags\' found in front matter')
    }
}
