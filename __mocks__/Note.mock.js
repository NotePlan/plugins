/*
 * Note mock class
 *
 * Usage: const myNote = new Note({ param changes here })
 *
 */

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
  type = 'PLACEHOLDER' // TODO: add value

  // Methods
  async addBlockID() {
    throw 'Note :: addBlockID Not implemented yet'
  }
  async addParagraphBelowHeadingTitle() {
    throw 'Note :: addParagraphBelowHeadingTitle Not implemented yet'
  }
  async addTodoBelowHeadingTitle() {
    throw 'Note :: addTodoBelowHeadingTitle Not implemented yet'
  }
  async appendParagraph() {
    throw 'Note :: appendParagraph Not implemented yet'
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
  async insertParagraph() {
    throw 'Note :: insertParagraph Not implemented yet'
  }
  async insertParagraphAfterParagraph() {
    throw 'Note :: insertParagraphAfterParagraph Not implemented yet'
  }
  async insertParagraphBeforeParagraph() {
    throw 'Note :: insertParagraphBeforeParagraph Not implemented yet'
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
  async prependParagraph() {
    throw 'Note :: prependParagraph Not implemented yet'
  }
  async prependTodo() {
    throw 'Note :: prependTodo Not implemented yet'
  }
  async printNote() {
    throw 'Note :: printNote Not implemented yet'
  }
  async removeBlockID() {
    throw 'Note :: removeBlockID Not implemented yet'
  }
  async removeParagraph() {
    throw 'Note :: removeParagraph Not implemented yet'
  }
  async removeParagraphAtIndex() {
    throw 'Note :: removeParagraphAtIndex Not implemented yet'
  }
  async removeParagraphs(pd) {
    return
  }
  async replaceTextInCharacterRange() {
    throw 'Note :: replaceTextInCharacterRange Not implemented yet'
  }
  async updateParagraph() {
    throw 'Note :: updateParagraph Not implemented yet'
  }
  async updateParagraphs() {
    throw 'Note :: updateParagraphs Not implemented yet'
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
