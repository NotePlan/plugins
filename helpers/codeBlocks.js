// @flow
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { displayTitle } from '@helpers/general'

export type CodeBlock = { type: string, code: string, paragraphs: Array<TParagraph> }

export function addCodeBlock(destNote: CoreNoteFields, textToAdd: string, codeBlockType: string): boolean {
  try {
    logDebug('addCodeBlock', `starting for note ${displayTitle(destNote)}`)
    const codeBlock = `\`\`\` ${codeBlockType}\n${textToAdd}\n\`\`\`\n`
    destNote.appendParagraph(codeBlock, 'code')
    return true
  } catch (err) {
    logError('addCodeBlock()', JSP(err))
    return false
  }
}

/**
 * WARNING: Incomplete, so not exported. I had a better idea when I was part-way through it.
 * @param {CoreNoteFields} note
 * @param {string} textToAdd
 * @param {string} codeBlockType, e.g. 'json'
 * @returns {boolean} success?
 */
function updateCodeBlock(note: CoreNoteFields, textToAdd: string, codeBlockType: string): boolean {
  try {
    const updatedCodeBlock = `\`\`\` ${codeBlockType}\n${textToAdd}\n\`\`\`\n`
    const existingCodeBlocks: Array<$ReadOnly<CodeBlock>> = getCodeBlocks(note).slice() // copy

    // Find match to existingCodeBlocks by having the same codeBlockType and the same WindowSet.name item in the JSON object
    const RE_FOR_THIS_SET_NAME = new RegExp(`"name":\s*"${codeBlockType}"`)
    const matchedCodeBlocks = existingCodeBlocks.filter((cb) => cb.type === codeBlockType && RE_FOR_THIS_SET_NAME.test(cb.code)) // un-tested
    clo(matchedCodeBlocks, 'matchedCodeBlocks')
    if (matchedCodeBlocks.length > 0) {
      // TODO:
      existingCodeBlocks.delete({ type: codeBlockType, code: matchedCodeBlocks[0].code })
      existingCodeBlocks.push({ type: codeBlockType, code: updatedCodeBlock, paragraphs: [] })
      return true
    }
    // clo(codeBlocks, 'codeBlocks')
    return true
  } catch (err) {
    logError('updateCodeBlock()', JSP(err))
    return false
  }
}

export function getCodeBlocks(note: CoreNoteFields): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const paragraphs = note.paragraphs ?? []
  // logDebug('getCodeBlocks', `Starting with ${String(paragraphs.length)} paragraphs in note '${displayTitle(note)}'`)

  let inCodeBlock = false
  const codeBlocks: Array<CodeBlock> = []
  let language = ''
  let queryString = []
  let codeParagraphs = []
  for (const paragraph of paragraphs) {
    if (paragraph.type === 'code') {
      if (inCodeBlock) {
        if (paragraph.content.startsWith('```')) {
          // this is the end of the code block - save it and reset for next code block
          inCodeBlock = false
          codeBlocks.push({ type: language, code: queryString.join('\n'), paragraphs: codeParagraphs })
          queryString = []
          codeParagraphs = []
          language = ''
        } else {
          queryString.push(paragraph.content)
          codeParagraphs.push(paragraph)
        }
      } else if (paragraph.content.startsWith('```')) {
        inCodeBlock = true
        language = paragraph.content.slice(3)
      }
    } else {
      if (inCodeBlock) {
        inCodeBlock = false
        codeBlocks.push({ type: language, code: queryString.join('\n'), paragraphs: codeParagraphs })
        queryString = []
        codeParagraphs = []
        language = ''
      }
    }
  }

  return codeBlocks
}

/**
 * Get all Code Blocks of a given type (or multiple types like ["javascript","js"])
 * Whatever is listed behind the ```nameHere in the code block
 * @param {CoreNoteFields} note
 * @param {Array<string>|string} types -- either a single string type to look for or an array of them
 * @returns {$ReadOnlyArray<$ReadOnly<{ type: string, code: string }>>} an array of {type:string, code:string}
 */
export function getCodeBlocksOfType(note: CoreNoteFields, types: Array<string>|string): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const allBlocks = getCodeBlocks(note)
  if (allBlocks.length) {
    const typesArr = Array.isArray(types) ? types : [types]
    // return allBlocks.filter(b=>typesArr.(b.type.trim()))
    // return allBlocks filtered to only those with a type which starts with one of the types in typesArr
    return allBlocks.filter(b => typesArr.some(t => b.type.trim().startsWith(t)))
  }
  return []
}