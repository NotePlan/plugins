/*
 * NoteMock mock class
 *
 * Usage: const myNoteMock = new NoteMock({ param changes here })
 *
 */

export class NoteMock {
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
    throw 'NoteMock :: addBlockID Not implemented yet'
  }
  async addParagraphBelowHeadingTitle() {
    throw 'NoteMock :: addParagraphBelowHeadingTitle Not implemented yet'
  }
  async addTodoBelowHeadingTitle() {
    throw 'NoteMock :: addTodoBelowHeadingTitle Not implemented yet'
  }
  async appendParagraph() {
    throw 'NoteMock :: appendParagraph Not implemented yet'
  }
  async appendParagraphBelowHeadingLineIndex() {
    throw 'NoteMock :: appendParagraphBelowHeadingLineIndex Not implemented yet'
  }
  async appendTodo() {
    throw 'NoteMock :: appendTodo Not implemented yet'
  }
  async appendTodoBelowHeadingLineIndex() {
    throw 'NoteMock :: appendTodoBelowHeadingLineIndex Not implemented yet'
  }
  async insertCancelledTodo() {
    throw 'NoteMock :: insertCancelledTodo Not implemented yet'
  }
  async insertCompletedTodo() {
    throw 'NoteMock :: insertCompletedTodo Not implemented yet'
  }
  async insertHeading() {
    throw 'NoteMock :: insertHeading Not implemented yet'
  }
  async insertList() {
    throw 'NoteMock :: insertList Not implemented yet'
  }
  async insertParagraph() {
    throw 'NoteMock :: insertParagraph Not implemented yet'
  }
  async insertParagraphAfterParagraph() {
    throw 'NoteMock :: insertParagraphAfterParagraph Not implemented yet'
  }
  async insertParagraphBeforeParagraph() {
    throw 'NoteMock :: insertParagraphBeforeParagraph Not implemented yet'
  }
  async insertQuote() {
    throw 'NoteMock :: insertQuote Not implemented yet'
  }
  async insertScheduledTodo() {
    throw 'NoteMock :: insertScheduledTodo Not implemented yet'
  }
  async insertTextAtCharacterIndex() {
    throw 'NoteMock :: insertTextAtCharacterIndex Not implemented yet'
  }
  async insertTodo() {
    throw 'NoteMock :: insertTodo Not implemented yet'
  }
  async insertTodoAfterParagraph() {
    throw 'NoteMock :: insertTodoAfterParagraph Not implemented yet'
  }
  async insertTodoBeforeParagraph() {
    throw 'NoteMock :: insertTodoBeforeParagraph Not implemented yet'
  }
  async paragraphRangeAtCharacterIndex() {
    throw 'NoteMock :: paragraphRangeAtCharacterIndex Not implemented yet'
  }
  async prependParagraph() {
    throw 'NoteMock :: prependParagraph Not implemented yet'
  }
  async prependTodo() {
    throw 'NoteMock :: prependTodo Not implemented yet'
  }
  async printNote() {
    throw 'NoteMock :: printNote Not implemented yet'
  }
  async removeBlockID() {
    throw 'NoteMock :: removeBlockID Not implemented yet'
  }
  async removeParagraph() {
    throw 'NoteMock :: removeParagraph Not implemented yet'
  }
  async removeParagraphAtIndex() {
    throw 'NoteMock :: removeParagraphAtIndex Not implemented yet'
  }
  async removeParagraphs() {
    throw 'NoteMock :: removeParagraphs Not implemented yet'
  }
  async replaceTextInCharacterRange() {
    throw 'NoteMock :: replaceTextInCharacterRange Not implemented yet'
  }
  async updateParagraph() {
    throw 'NoteMock :: updateParagraph Not implemented yet'
  }
  async updateParagraphs() {
    throw 'NoteMock :: updateParagraphs Not implemented yet'
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
