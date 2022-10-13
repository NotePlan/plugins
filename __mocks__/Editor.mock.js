/* eslint-disable */
/*
 * Editor mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 * TODO: IMPORTANT NOTE
 * - @dwertheimer started adding some of the underlying methods to Note.mock.js, but it's not complete
 * - if you need to add a method to Editor that's in Note also, add it to Note.mock.js and then add it here
 *
 */

import { Note } from './Note.mock'
const note = new Note()

const Editor = {
  // async addBlockID() { return null },
  // async addParagraphBelowHeadingTitle() { return null },
  // async addTheme() { return null },
  // async addTodoBelowHeadingTitle() { return null },
  async appendParagraph(title = 'mock tester', type: 'text') {
    return null
  },
  // async appendParagraphBelowHeadingLineIndex() { return null },
  // async appendTodo() { return null },
  // async appendTodoBelowHeadingLineIndex() { return null },
  /* availableThemes: [{ return default }], */
  // content: VALUE ,
  // async copySelection() { return null },
  filename: 'thisFileName.txt',
  // async highlight() { return null },
  // async highlightByIndex() { return null },
  // async highlightByRange() { return null },
  // async insertCancelledTodo() { return null },
  // async insertCompletedTodo() { return null },
  // async insertHeading() { return null },
  // async insertList() { return null },
  async insertParagraph(name = 'mock tester', lineIndex = 1, type: 'text') {
    return null
  },
  // async insertParagraphAfterParagraph() { return null },
  // async insertParagraphAtCursor() { return null },
  // async insertParagraphBeforeParagraph() { return null },
  // async insertQuote() { return null },
  // async insertScheduledTodo() { return null },
  async insertTextAtCharacterIndex(text = '', length = 0) {
    return text
  },
  async insertTextAtCursor(text: string) {
    return text //void return
  },
  // async insertTodo() { return null },
  // async insertTodoAfterParagraph() { return null },
  // async insertTodoBeforeParagraph() { return null },
  async isFolded(para) {
    return false
  },
  note: null,

  async openNoteByDate(date: Date, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean, timeframe?: string): Promise<TNote> {
    return this.note
  },
  // async openNoteByDateString() { return null },
  // async openNoteByFilename() { return null },
  // async openNoteByTitle() { return null },
  // async openNoteByTitleCaseInsensitive() { return null },
  async paragraphRangeAtCharacterIndex() {
    return null
  },
  /* paragraphs: [{ return {
		"type": "title",
		"content": "MyNoteTitle",
		"rawContent": "# MyNoteTitle",
		"prefix": "# ",
		"contentRange": {},
		"lineIndex": 0,
		"heading": "",
		"headingLevel": 1,
		"isRecurring": false,
		"indents": 0,
		"filename": "_TEST/New Note - 15.3950.md",
		"noteType": "Notes",
		"linkedNoteTitles": [],
		"subItems": [],
		"referencedBlocks": [],
		"note": {}
} }], */
  // async pasteClipboard() { return null },
  // async prependParagraph() { return null },
  // async prependTodo() { return null },
  // async printNote() { return null },
  // async removeBlockID() { return null },

  async removeParagraph(para) {
    return note.removeParagraph(para)
  },
  async removeParagraphs(paras) {
    return note.removeParagraphs(paras)
  },

  // async removeParagraphAtIndex() { return null },
  // async renderedSelect() { return null },
  /* renderedSelection: {
		"start": 36,
		"end": 36,
		"length": 0
} ,  */
  // async replaceSelectionWithText() { return null },
  // async replaceTextInCharacterRange() { return null },
  // async select() { return null },
  // async selectAll() { return null },
  /* selectedLinesText: [{ return * one task in the note }], */
  /* selectedParagraphs: [{ return {
		"type": "open",
		"content": "one task in the note",
		"rawContent": "* one task in the note",
		"prefix": "* ",
		"contentRange": {},
		"lineIndex": 0,
		"heading": "",
		"headingLevel": -1,
		"isRecurring": false,
		"indents": 0,
		"filename": "_TEST/New Note - 15.3950.md",
		"noteType": "Notes",
		"linkedNoteTitles": [],
		"subItems": [],
		"referencedBlocks": [],
		"note": {}
} }], */
  // selectedText: VALUE ,
  /* selection: {
		"start": 36,
		"end": 36,
		"length": 0
} ,  */
  // async setTheme() { return null },
  // title: VALUE ,
  async toggleFolding() {
    return null
  },
  // type: VALUE ,

  async updateParagraph(para) {
    return note.updateParagraph(para)
  },
  async updateParagraphs(paras) {
    return note.updateParagraphs(paras)
  },
}

module.exports = Editor
