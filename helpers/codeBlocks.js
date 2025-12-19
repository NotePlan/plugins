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
export function getCodeBlocksOfType(note: CoreNoteFields, types: Array<string> | string): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const allBlocks = getCodeBlocks(note)
  if (allBlocks.length) {
    const typesArr = Array.isArray(types) ? types : [types]
    // return allBlocks.filter(b=>typesArr.(b.type.trim()))
    // return allBlocks filtered to only those with a type which starts with one of the types in typesArr
    return allBlocks.filter((b) => typesArr.some((t) => b.type.trim().startsWith(t)))
  }
  return []
}

/**
 * Replace the content inside a code block while preserving the fences
 * If the code block doesn't exist, it will be added at the end of the note
 * @param {CoreNoteFields} note - The note containing the code block
 * @param {string} codeBlockType - The type/language of the code block (e.g., 'formfields', 'template:ignore form variables')
 * @param {string} newContent - The new content to put inside the code block
 * @param {string} pluginIdentifier - Optional identifier for logging (defaults to 'replaceCodeBlockContent')
 * @returns {boolean} - true if replacement was successful, false otherwise
 */
export function replaceCodeBlockContent(note: CoreNoteFields, codeBlockType: string, newContent: string, pluginIdentifier: string = 'replaceCodeBlockContent'): boolean {
  try {
    const allParas = note.paragraphs
    const existingCodeBlocks = getCodeBlocksOfType(note, codeBlockType)

    if (existingCodeBlocks.length > 0) {
      // Replace content in existing code block (keep fences, replace interior content)
      const codeBlockToUpdate = existingCodeBlocks[0]

      let openingFenceIndex = -1
      let closingFenceIndex = -1

      if (codeBlockToUpdate.paragraphs && codeBlockToUpdate.paragraphs.length > 0) {
        // Code block has content - find fences relative to content
        const firstContentLineIndex = codeBlockToUpdate.paragraphs[0].lineIndex
        const lastContentLineIndex = codeBlockToUpdate.paragraphs[codeBlockToUpdate.paragraphs.length - 1].lineIndex

        // Find opening fence (line before first content)
        openingFenceIndex = firstContentLineIndex > 0 ? firstContentLineIndex - 1 : -1
        // Find closing fence (line after last content)
        closingFenceIndex = lastContentLineIndex + 1

        logDebug(
          pluginIdentifier,
          `Will replace content between line ${firstContentLineIndex} and ${lastContentLineIndex} (fences at ${openingFenceIndex} and ${closingFenceIndex})`,
        )
      } else {
        // Code block is empty (just fences) - find them by searching for code paragraphs with the block type
        logDebug(pluginIdentifier, `Code block is empty, searching for fence paragraphs`)
        const codeBlockTypePrefix = codeBlockType.trim()

        for (let i = 0; i < allParas.length; i++) {
          const para = allParas[i]
          if (para.type === 'code' && para.content.startsWith('```')) {
            const typeInFence = para.content.slice(3).trim()
            if (typeInFence === codeBlockTypePrefix || typeInFence.startsWith(`${codeBlockTypePrefix} `)) {
              // Found opening fence
              openingFenceIndex = para.lineIndex
              // Look for closing fence (next code paragraph that starts with ```)
              for (let j = i + 1; j < allParas.length; j++) {
                const nextPara = allParas[j]
                if (nextPara.type === 'code' && nextPara.content.trim() === '```') {
                  closingFenceIndex = nextPara.lineIndex
                  break
                }
              }
              break
            }
          }
        }

        if (openingFenceIndex === -1 || closingFenceIndex === -1) {
          logError(pluginIdentifier, `Could not find fence paragraphs for empty code block`)
          return false
        }

        logDebug(pluginIdentifier, `Found empty code block fences at ${openingFenceIndex} and ${closingFenceIndex}`)
      }

      // Rebuild the entire content string: keep everything before opening fence, add new content, keep everything after closing fence
      // Note: We need to exclude the fence paragraphs from contentBefore/contentAfter since we'll add them separately
      const contentBefore = allParas
        .filter((p) => p.lineIndex < openingFenceIndex)
        .map((p) => p.rawContent)
        .join('\n')
      const contentAfter = allParas
        .filter((p) => p.lineIndex > closingFenceIndex)
        .map((p) => p.rawContent)
        .join('\n')

      // Get opening and closing fence content
      const openingFencePara = allParas.find((p) => p.lineIndex === openingFenceIndex)
      const closingFencePara = allParas.find((p) => p.lineIndex === closingFenceIndex)

      if (openingFencePara && closingFencePara) {
        // Build final content: before + opening fence + new content + closing fence + after
        const parts = []
        if (contentBefore.length > 0) parts.push(contentBefore)
        parts.push(openingFencePara.rawContent)
        parts.push(newContent)
        parts.push(closingFencePara.rawContent)
        if (contentAfter.length > 0) parts.push(contentAfter)
        const finalContent = parts.join('\n')

        note.content = finalContent
        note.updateParagraphs(note.paragraphs)
        return true
      } else {
        logError(pluginIdentifier, `Could not find fence paragraphs`)
        return false
      }
    } else {
      // No existing code block, add new one at the end
      const newCodeBlock = `\`\`\`${codeBlockType}\n${newContent}\n\`\`\``
      const existingContent = allParas.map((p) => p.rawContent).join('\n')
      const finalContent = existingContent ? `${existingContent}\n\n${newCodeBlock}` : newCodeBlock

      note.content = finalContent
      note.updateParagraphs(note.paragraphs)
      return true
    }
  } catch (error) {
    logError(pluginIdentifier, `replaceCodeBlockContent error: ${JSP(error)}`)
    return false
  }
}
