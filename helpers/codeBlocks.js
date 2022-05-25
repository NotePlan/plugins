// @flow

export function getCodeBlocks(note: TNote): $ReadOnlyArray<$ReadOnly<{ type: string, code: string }>> {
  const paragraphs = note.paragraphs ?? []

  let inCodeBlock = false
  const codeBlocks: Array<{ type: string, code: string }> = []
  let language = ''
  let queryString = []
  for (const paragraph of paragraphs) {
    if (paragraph.type === 'code') {
      if (inCodeBlock) {
        if (paragraph.content.startsWith('```')) {
          inCodeBlock = false
          codeBlocks.push({ type: language, code: queryString.join('\n') })
          queryString = []
          language = ''
        } else {
          queryString.push(paragraph.content)
        }
      } else if (paragraph.content.startsWith('```')) {
        inCodeBlock = true
        language = paragraph.content.slice(3)
      }
    } else {
      if (inCodeBlock) {
        inCodeBlock = false
        codeBlocks.push({ type: language, code: queryString.join('\n') })
        queryString = []
        language = ''
      }
    }
  }

  return codeBlocks
}
