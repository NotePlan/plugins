import { clo, JSP, log } from '../../helpers/dev'
import { showMessage } from '../../helpers/userInput'
import { getElementsFromTask } from './taskHelpers'

// These are different from taskHelpers because they include the # or @
export const HASHTAGS = /\B(#[a-zA-Z0-9\/]+\b)/g
export const MENTIONS = /\B(@[a-zA-Z0-9\/]+\b)/g

const getParagraphByIndex = (note: TNote, index: number): TParagraph | null => {
  return note.paragraphs[index]
}

function getTagsFromString(content: string): { hashtags: string[], mentions: string[] } {
  const hashtags = getElementsFromTask(content, HASHTAGS)
  const mentions = getElementsFromTask(content, MENTIONS)
  clo(hashtags, 'getTagsFromString hashtags')
  clo(mentions, 'getTagsFromString mentions')
  return { hashtags, mentions }
}

function getParagraphContainingPosition(note: TNote, position: number): TParagraph | null {
  let foundParagraph = null
  note.paragraphs.forEach((p, i) => {
    const { start, end } = p.contentRange
    console.log(`LookingFor:${position} in paragraph[${i}] start:${start} end:${end}`)
    if (start <= position && end >= position) foundParagraph = p
  })
  return foundParagraph
}

function eliminateExistingTags(existingTags, newTags): Array<string> {
  let revisedTags = []
  if (newTags.length) {
    if (existingTags.length) {
      clo(existingTags, 'existingTags')
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

export function copyTagsFromLineAbove() {
  const selection = Editor.selection
  const thisParagraph = getParagraphContainingPosition(Editor.note, selection.start)
  if (!thisParagraph) showMessage(`No paragraph found selection.start: ${selection.start} Editor.selectedParagraphs.length = ${Editor.selectedParagraphs.length}`)
  //   const thisParagraph = Editor.selectedParagraphs // not reliable (Editor.selectedParagraphs is empty on a new line)
  const { noteType, lineIndex } = thisParagraph
  const topOfNote = noteType === 'Notes' ? 1 : 0
  if (lineIndex > 0) {
    const existingTags = getTagsFromString(thisParagraph.content)
    let prevLineTags = getTagsFromString(getParagraphByIndex(Editor, lineIndex - 1).content)
    clo(existingTags, 'existingTags')
    clo(prevLineTags, 'prevLineTags')
    const mentions = eliminateExistingTags(existingTags.mentions, prevLineTags.mentions)
    const hashtags = eliminateExistingTags(existingTags.hashtags, prevLineTags.hashtags)
    clo(mentions, 'mentions')
    clo(hashtags, 'hashtags')
    if (hashtags.length || mentions.length) {
      const stuff = `${hashtags.join(' ')} ${mentions.join(' ')}`.trim()
      console.log(stuff)
      if (stuff.length) {
        clo(thisParagraph, 'thisParagraph')
        thisParagraph.content = `${thisParagraph.content ? `${thisParagraph.content} ` : ''} ${stuff}`.replace(/\s{2,}/gm, ' ')
        Editor.updateParagraph(thisParagraph)
      }
    } else {
      showMessage('No tags found on line above.')
    }
  }
}

export function copyTagsFromHeadingAbove() {
  const selection = Editor.selection
  const { noteType, lineIndex, headingRange } = getParagraphContainingPosition(Editor, selection.start)
  const { headinglineIndex } = getParagraphContainingPosition(Editor, headingRange.start)
  const topOfNote = noteType === 'Notes' ? 1 : 0
}
