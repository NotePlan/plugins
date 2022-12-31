/* eslint-disable */

/*
 * Note mock class
 *
 * Usage: const myNote = new Note({ param changes here })
 *
 */
import { strings } from '@codedungeon/gunner'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { throwIfEmpty } from 'rxjs'
export class Note {
  // Properties
  backlinks = [] /* sample:  [ SOMETHING ], */
  changedDate = {} /* new Date("Tue Sep 07 2021 06:49:41 GMT-0700 (PDT)"),  */
  content = 'PLACEHOLDER' // TODO: add value
  createdDate = {} /* new Date("Thu Apr 29 2021 13:30:00 GMT-0700 (PDT)"),  */
  date = 'PLACEHOLDER' // TODO: add value
  datedTodos = [] /* sample:  [ SOMETHING ], */
  filename = 'PLACEHOLDER' // TODO: add value
  frontmatterTypes = [] /* sample:  [ SOMETHING ], */
  hashtags = [] /* sample:  [ SOMETHING ], */
  linkedItems = [] /* sample:  [ SOMETHING ], */
  mentions = [] /* sample:  [ SOMETHING ], */
  paragraphs = [] /* sample:  [{
 "type": "title",
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
  title = 'PLACEHOLDER' // TODO: add value
  type = 'Notes'

  // Methods
  async addBlockID(p) {
    if (!/\^[a-zA-Z0-9]{6}/.test(p.content)) {
      p.content = `${textWithoutSyncedCopyTag(p.content)} ^123456`
      p.rawContent = `${textWithoutSyncedCopyTag(p.rawContent || p.content)} ^123456`
      p.blockId = '^123456'
    }
  }
  async addParagraphBelowHeadingTitle(content, paragraphType, headingTitle, shouldAppend, shouldCreate) {
    // TODO: may need to create actual rawContent for certain tests
    const paras = content.split('\n').map((c) => ({ content: c, type: paragraphType, rawContent: c, lineIndex: -1 }))
    const paragraphs = this.paragraphs
    // find paragraph with content === headingTitle
    const headingIndex = paragraphs.findIndex((p) => p.content === headingTitle)
    this.paragraphs.splice(headingIndex + 1, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
  }
  async addTodoBelowHeadingTitle() {
    throw 'Note :: addTodoBelowHeadingTitle Not implemented yet'
  }
  appendParagraph(title: string, type: ParagraphType): void {
    this.paragraphs.push({ content: title, type })
    return
  }
  async appendParagraphBelowHeadingLineIndex() {
    throw 'Note :: appendParagraphBelowHeadingLineIndex Not implemented yet'
  }
  async appendTodo() {
    throw 'Note :: appendTodo Not implemented yet'
  }
  async appendTodoBelowHeadingLineIndex() {
    throw 'Note :: appendTodoBelowHeadingLineIndex Not implemented yet'
  }
  async insertCancelledTodo() {
    throw 'Note :: insertCancelledTodo Not implemented yet'
  }
  async insertCompletedTodo() {
    throw 'Note :: insertCompletedTodo Not implemented yet'
  }
  async insertHeading() {
    throw 'Note :: insertHeading Not implemented yet'
  }
  async insertList() {
    throw 'Note :: insertList Not implemented yet'
  }
  insertParagraph(content: string, lineIndex: number, type: ParagraphType): void {
    //TODO: deal with the lineIndex?
    // .insertParagraph(content, lineIndex, type)
    // if string contains "\n" then split into multiple paragraphs
    const paras = content.split('\n').map((c) => ({ content: c, type: type, rawContent: c, lineIndex: -1 }))
    this.paragraphs.splice(lineIndex, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
    this.content = this.paragraphs.map((p) => p.content).join('\n')
    return
  }
  async insertParagraphAfterParagraph(content, otherParagraph, paragraphType) {
    // .insertParagraphAfterParagraph(content, otherParagraph, paragraphType)
    // TODO: may need to create actual rawContent for certain tests
    const paras = content.split('\n').map((c) => ({ content: c, type: c.type, rawContent: c, lineIndex: -1 }))
    this.paragraphs.splice(otherParagraph.lineIndex + 1, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
  }
  async insertParagraphBeforeParagraph(content, otherParagraph, type: paragraphType) {
    // .insertParagraphBeforeParagraph(content, otherParagraph, paragraphType)
    // TODO: may need to create actual rawContent for certain tests
    const paras = content.split('\n').map((c) => ({ content: c, type: c.type, rawContent: c, lineIndex: -1 }))
    this.paragraphs.splice(otherParagraph.lineIndex, 0, ...paras)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
  }
  async insertQuote() {
    throw 'Note :: insertQuote Not implemented yet'
  }
  async insertScheduledTodo() {
    throw 'Note :: insertScheduledTodo Not implemented yet'
  }
  async insertTextAtCharacterIndex() {
    throw 'Note :: insertTextAtCharacterIndex Not implemented yet'
  }
  async insertTodo() {
    throw 'Note :: insertTodo Not implemented yet'
  }
  async insertTodoAfterParagraph() {
    throw 'Note :: insertTodoAfterParagraph Not implemented yet'
  }
  async insertTodoBeforeParagraph() {
    throw 'Note :: insertTodoBeforeParagraph Not implemented yet'
  }
  async paragraphRangeAtCharacterIndex() {
    throw 'Note :: paragraphRangeAtCharacterIndex Not implemented yet'
  }
  async prependParagraph(content: strings, type: ParagraphType) {
    this.paragraphs = [{ content, type }, ...this.paragraphs]
    console.log(`JEST Note: note.prependParagraph() called. but .content is approximated but not exactly correct, because it does not add markdown.`)
    this.content = content.concat('\n', this.content)
    // throw 'Note :: prependParagraph Not implemented yet'
  }
  async prependTodo() {
    throw 'Note :: prependTodo Not implemented yet'
  }
  async printNote() {
    throw 'Note :: printNote Not implemented yet'
  }
  async removeBlockID(p) {
    p.content = textWithoutSyncedCopyTag(p.content)
    p.rawContent = textWithoutSyncedCopyTag(p.rawContent)
    if (p.blockId) delete p.blockId
  }
  async removeParagraph(para) {
    this.paragraphs.filter((p) => p.lineIndex !== para.lineIndex)
    this.paragraphs.forEach((p, i) => (this.paragraphs[i].lineIndex = i))
  }
  async removeParagraphAtIndex() {
    throw 'Note :: removeParagraphAtIndex Not implemented yet'
  }
  async removeParagraphs(paras) {
    paras.forEach((para) => {
      this.paragraphs = this.paragraphs.filter((p) => p.lineIndex !== para.lineIndex)
    })
    this.paragraphs.forEach((p, i) => {
      this.paragraphs[i].lineIndex = i
    })
  }
  async replaceTextInCharacterRange() {
    throw 'Note :: replaceTextInCharacterRange Not implemented yet'
  }
  async updateParagraph(para) {
    this.paragraphs[para.lineIndex] = para
  }
  async updateParagraphs(paras) {
    paras.forEach((para) => {
      this.paragraphs[para.lineIndex] = para
    })
  }

  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
