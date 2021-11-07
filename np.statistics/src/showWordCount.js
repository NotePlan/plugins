// @flow

// Show word counts etc. for currently displayed note
export async function showWordCount(): Promise<void> {
  const paragraphs = Editor.paragraphs
  const note = Editor.note
  if (note == null) {
    // No note open.
    return
  }

  let charCount = 0
  let wordCount = 0
  let lineCount = 0
  const mentionCount = note.mentions.length
  const tagCount = note.hashtags.length

  paragraphs.forEach((p) => {
    charCount += p.content.length

    if (p.content.length > 0) {
      const match = p.content.match(/\w+/g)
      if (match != null) {
        wordCount += match.length
      }
    }

    lineCount += 1
  })

  const selectedCharCount = Editor.selectedText?.length ?? 0
  let selectedWordCount = 0

  if (selectedCharCount > 0) {
    selectedWordCount = Editor.selectedText?.match(/\w+/g)?.length ?? 0
  }

  const selectedLines = Editor.selectedLinesText.length

  const display = [
    `Characters: ${
      selectedCharCount > 0 ? `${selectedCharCount.toLocaleString()}/${charCount.toLocaleString()}` : charCount.toLocaleString()
    }`,
    `Words: ${
      selectedWordCount > 0 ? `${selectedWordCount.toLocaleString()}/${wordCount.toLocaleString()}` : wordCount.toLocaleString()
    }`,
    `Lines: ${selectedLines > 1 ? `${selectedLines.toLocaleString()}/${lineCount.toLocaleString()}` : lineCount.toLocaleString()}`,
    `Mentions: ${mentionCount.toLocaleString()}`,
    `Hashtags: ${tagCount.toLocaleString()}`,
  ]

  const re = await CommandBar.showOptions(
    display,
    'Word count. Select anything to copy.',
  )
  if (re !== null) {
    Clipboard.string = display.join('\n')
  }
}
