// @flow

import { logDebug } from '../helpers/dev'
import { hasFrontMatter, getAttributes } from '@helpers/NPFrontMatter'

/*
 * Note mock class
 *
 * Usage: const myNote = new Note({ param changes here })
 *
 */
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
export class Note {
  // Explicitly define properties that are dynamically assigned
  content: string
  paragraphs: any[]
  // Properties
  backlinks: any[] = [] /* sample:  [ SOMETHING ], */
  changedDate: any = {} /* new Date("Tue Sep 07 2021 06:49:41 GMT-0700 (PDT)"),  */
  /**
   * @private
   * @type {string}
   */
  _content: string = 'CONTENT_PLACEHOLDER_FROM_NOTE_MOCK' // see setter and getter at the bottom of the file
  createdDate: any = {} /* new Date("Thu Apr 29 2021 13:30:00 GMT-0700 (PDT)"),  */
  date: string = 'DATE_PLACEHOLDER_FROM_NOTE_MOCK' // TODO: add value
  datedTodos: any[] = [] /* sample:  [ SOMETHING ], */
  filename: string = 'FILENAME_PLACEHOLDER_FROM_NOTE_MOCK' // TODO: add value
  frontmatterTypes: string[] = [] /* sample:  [ SOMETHING ], */
  frontmatterAttributes: any = {}
  hashtags: any[] = [] /* sample:  [ SOMETHING ], */
  linkedItems: any[] = [] /* sample:  [ SOMETHING ], */
  mentions: any[] = [] /* sample:  [ SOMETHING ], */
  paragraphs: any[] = [] /* sample:  [{
 "type": "Notes",
 "content": "",
 "rawContent": "# ",
 "prefix": "# ",
 "contentRange": {},
 "lineIndex": 0,
 "heading": "",
 "headingLevel": 1,
 "isRecurring": false,
 "indents": 0,
 "filename": "Migrated/Marlita Hours.md",
 "noteType": "Notes",
 "linkedNoteTitles": [],
 "subItems": [],
 "referencedBlocks": [],
 "note": {}
} ], */
  title: string = 'TITLE_PLACEHOLDER_FROM_NOTE_MOCK' // TODO: add value
  type: string = 'Notes'

  // Methods
  async addBlockID(p: any) {
    if (!/\^[a-zA-Z0-9]{6}/.test(p.content)) {
      p.content = `${textWithoutSyncedCopyTag(p.content)} ^123456`
      p.rawContent = `${textWithoutSyncedCopyTag(p.rawContent || p.content)} ^123456`
      p.blockId = '^123456'
    }
  }
  async addParagraphBelowHeadingTitle(content: string, paragraphType: string, headingTitle: string, shouldAppend: boolean, shouldCreate: boolean) {
    // TODO: may need to create actual rawContent for certain tests
    const paras = makeParagraphsFromContent(content)
    const paragraphs = this.paragraphs
    // find paragraph with content === headingTitle
    const headingIndex = paragraphs.findIndex((p) => p.content === headingTitle)
    this.paragraphs.splice(headingIndex + 1, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this.resetLineIndexesAndContent()
  }
  async addTodoBelowHeadingTitle(): Promise<void> {
    throw 'Note :: addTodoBelowHeadingTitle Not implemented yet'
  }
  appendParagraph(title: string, type: ParagraphType): void {
    this.paragraphs.push({ content: title, type: type, lineIndex: this.paragraphs.length })
    return
  }
  async appendParagraphBelowHeadingLineIndex(): Promise<void> {
    throw 'Note :: appendParagraphBelowHeadingLineIndex Not implemented yet'
  }
  async appendTodo(): Promise<void> {
    throw 'Note :: appendTodo Not implemented yet'
  }
  async appendTodoBelowHeadingLineIndex(): Promise<void> {
    throw 'Note :: appendTodoBelowHeadingLineIndex Not implemented yet'
  }
  async insertCancelledTodo(): Promise<void> {
    throw 'Note :: insertCancelledTodo Not implemented yet'
  }
  async insertCompletedTodo(): Promise<void> {
    await Promise.resolve()
    throw 'Note :: insertCompletedTodo Not implemented yet'
  }
  async insertHeading(): Promise<void> {
    await Promise.resolve()
    throw 'Note :: insertHeading Not implemented yet'
  }
  async insertList(): Promise<void> {
    await Promise.resolve()
    throw 'Note :: insertList Not implemented yet'
  }
  insertParagraph(content: string, lineIndex: number, type: ParagraphType): void {
    //TODO: deal with the lineIndex?
    // .insertParagraph(content, lineIndex, type)
    // if string contains "\n" then split into multiple paragraphs
    const paras = makeParagraphsFromContent(content)
    // if (paras[paras.length - 1].content === '') paras.pop()
    // splice at lineIndex, do not remove any existing paragraphs
    this.paragraphs.splice(lineIndex, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this.resetLineIndexesAndContent()
    return
  }
  async insertParagraphAfterParagraph(content: string, otherParagraph: any, paragraphType: string) {
    // .insertParagraphAfterParagraph(content, otherParagraph, paragraphType)
    // TODO: may need to create actual rawContent for certain tests
    const paras = makeParagraphsFromContent(content)
    this.paragraphs.splice(otherParagraph.lineIndex + 1, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this.resetLineIndexesAndContent()
  }
  async insertParagraphBeforeParagraph(content: string, otherParagraph: any, type: string) {
    // .insertParagraphBeforeParagraph(content, otherParagraph, paragraphType)
    // TODO: may need to create actual rawContent for certain tests
    const paras = makeParagraphsFromContent(content)
    this.paragraphs.splice(otherParagraph.lineIndex, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this.resetLineIndexesAndContent()
  }
  async insertQuote(): Promise<void> {
    throw 'Note :: insertQuote Not implemented yet'
  }
  async insertScheduledTodo(): Promise<void> {
    throw 'Note :: insertScheduledTodo Not implemented yet'
  }
  async insertTextAtCharacterIndex(): Promise<void> {
    throw 'Note :: insertTextAtCharacterIndex Not implemented yet'
  }
  async insertTodo(): Promise<void> {
    throw 'Note :: insertTodo Not implemented yet'
  }
  async insertTodoAfterParagraph(): Promise<void> {
    throw 'Note :: insertTodoAfterParagraph Not implemented yet'
  }
  async insertTodoBeforeParagraph(): Promise<void> {
    throw 'Note :: insertTodoBeforeParagraph Not implemented yet'
  }
  async paragraphRangeAtCharacterIndex(): Promise<void> {
    throw 'Note :: paragraphRangeAtCharacterIndex Not implemented yet'
  }
  async prependParagraph(content: string, type: ParagraphType) {
    this.paragraphs = [{ content, type }, ...this.paragraphs]
    logDebug(`JEST Note: note.prependParagraph() called. but .content is approximated but not exactly correct, because it does not add markdown.`) // TODO(@dwertheimer): Is this now correct for .rawContent? And isn't .content set here?
    this.resetLineIndexesAndContent()
  }
  async prependTodo(): Promise<void> {
    throw 'Note :: prependTodo Not implemented yet'
  }
  async printNote(): Promise<void> {
    throw 'Note :: printNote Not implemented yet'
  }
  async removeBlockID(p: any) {
    p.content = textWithoutSyncedCopyTag(p.content)
    p.rawContent = textWithoutSyncedCopyTag(p.rawContent)
    if (p.blockId) delete p.blockId
  }
  async removeParagraph(para: any) {
    this.paragraphs = this.paragraphs.filter((p) => p.lineIndex !== para.lineIndex)
    this.resetLineIndexesAndContent()
  }
  async removeParagraphAtIndex(): Promise<void> {
    throw 'Note :: removeParagraphAtIndex Not implemented yet'
  }
  async removeParagraphs(paras: any[]) {
    // filter this.paragraphs to remove paragraphs with lineIndex in paras
    this.paragraphs = this.paragraphs.filter((p) => !paras.find((para) => para.lineIndex === p.lineIndex))
    this.resetLineIndexesAndContent()
  }
  async replaceTextInCharacterRange(): Promise<void> {
    throw 'Note :: replaceTextInCharacterRange Not implemented yet'
  }
  async updateParagraph(para: any) {
    this.paragraphs[para.lineIndex] = para
  }
  async updateParagraphs(paras: any[]) {
    paras.forEach((para) => {
      this.paragraphs[para.lineIndex] = para
      this.resetLineIndexesAndContent()
    })
  }

  /**
   * HELPERS TO SET UP THE NOTE AFTER PARAGRAPH CHANGES
   */
  resetLineIndexesAndContent() {
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this._content = this.paragraphs.map((p) => p.content).join('\n')
    this.setFrontmatterAttributes()
  }

  /**
   * Sets the frontmatter attributes of the note after the note content has been updated
   */
  setFrontmatterAttributes() {
    if (hasFrontMatter(this._content)) {
      this.frontmatterAttributes = getAttributes(this._content) || {}
      this.frontmatterTypes =
        Object.keys(this.frontmatterAttributes).length > 0 ? (this.frontmatterAttributes.type ? this.frontmatterAttributes.type.split(',').map((t) => t.trim()) : []) : []
    }
  }

  /**
   * Gets the content of the note.
   * @returns {string} The current content of the note.
   */
  get content(): string {
    return this._content
  }

  /**
   * Sets the content of the note and performs additional actions.
   * @param {string} value - The new content value.
   */
  set content(value: string) {
    this._content = value
    this.paragraphs = makeParagraphsFromContent(value)
    this.setFrontmatterAttributes()
  }

  __update(data?: any = {}): this {
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (key === 'content') {
        if (value !== '') {
          this._content = value
          this.paragraphs = makeParagraphsFromContent(this._content)
        }
      } else {
        this[key] = data[key]
      }
    })
    return this
  }

  constructor(data?: any = {}) {
    this.__update(data)
    if (!this.paragraphs) this.paragraphs = []
    this.resetLineIndexesAndContent()
  }
}

// Helper function to determine the type of a line based on its content
function getLineTypeAndContent(content: string, lastHeadingLevel: number = 0): { content: string, type: string, headingLevel: number } {
  const trimmedContent = content.trim()
  let type = 'unknown'
  let lineContent = trimmedContent.replace(/^\t*/, '')
  let headingLevel = lastHeadingLevel
  if (lineContent === '---') {
    type = 'separator'
  } else if (/^\s*#{1,} /.test(lineContent)) {
    type = 'title'
    lineContent = lineContent.replace(/^\s*#{1,} /, '')
    headingLevel = lineContent.match(/^#{1,}/)?.length || 1
  } else if (lineContent.startsWith('- [x]') || lineContent.startsWith('* [x]')) {
    type = 'done'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('- [-]') || lineContent.startsWith('* [-]')) {
    type = 'cancelled'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('- [>]') || lineContent.startsWith('* [>]')) {
    type = 'scheduled'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('- [ ]') || lineContent.startsWith('* [ ]')) {
    type = 'open'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('- ') && !lineContent.startsWith('- [')) {
    type = 'list'
    lineContent = lineContent.slice(2)
  } else if (lineContent.startsWith('+ [x]')) {
    type = 'checklistDone'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('+ [-]')) {
    type = 'checklistCancelled'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('+ [>]')) {
    type = 'checklistScheduled'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('+ [ ]')) {
    type = 'checklist'
    lineContent = lineContent.slice(5)
  } else if (lineContent.startsWith('+ ') && !lineContent.startsWith('+ [')) {
    type = 'checklist'
    lineContent = lineContent.slice(2)
  } else if (lineContent.startsWith('* ')) {
    type = 'open'
    lineContent = lineContent.slice(2)
  } else if (/^\s*\d|\w/.test(lineContent)) {
    type = 'text'
  }

  return { content: lineContent.trim(), type, headingLevel }
}

// Helper function to count leading tabs in a line
function countLeadingTabs(content: string): number {
  const match = content.match(/^\t*/)
  return match ? match[0].length : 0
}

// Helper function to create paragraphs from content
function makeParagraphsFromContent(content: string): any[] {
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') {
    lines.pop() // Remove the last line if it's empty
  }
  return lines.map((c, i) => {
    let lastHeadingLevel = 0
    const { content: lineContent, type, headingLevel } = getLineTypeAndContent(c, lastHeadingLevel)
    lastHeadingLevel = headingLevel
    return {
      content: lineContent,
      type,
      rawContent: c,
      lineIndex: i,
      indents: countLeadingTabs(c),
      headingLevel,
    }
  })
}
