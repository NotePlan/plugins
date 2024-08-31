/* eslint-disable */
/*
 * Paragraph mock class
 *
 * Usage: const myParagraph = new Paragraph({ param changes here })
 *
 */

export class Paragraph {
  // Properties
  blockId = null
  content = 'SET_ME_IN_TEST'
  contentRange = {} /* {
		"start": 0,
		"end": 2,
		"length": 2
} ,  */
  date = new Date()
  filename = 'testFile.md'
  heading = ''
  headingLevel = 1
  headingRange = { start: 0, end: 0, length: 0 }
  indents = 0
  isRecurring = false
  lineIndex = 0
  linkedNoteTitles = []
  note = {} /* {
		"filename": "Migrated/Marlita Hours.md",
		"type": "Notes",
		"title": "",
		"changedDate": "2021-09-07T13:49:41.000Z",
		"createdDate": "2021-04-29T20:30:00.000Z",
		"hashtags": [],
		"mentions": [],
		"linkedItems": [],
		"datedTodos": [],
		"backlinks": [],
		"frontmatterTypes": [],
		"content": "# ",
		"paragraphs": [
				"{\"type\":\"title\",\"content\":\"\",\"rawContent\":\"# \",\"prefix\":\"# \",\"contentRange\":{},\"lineIndex\":0,\"heading\":\"\",\"headingLevel\":1,\"isRecurring\":false,\"indents\":0,\"filename\":\"Migrated/Marlita Hours.md\",\"noteType\":\"Notes\",\"linkedNoteTitles\":[],\"subItems\":[],\"referencedBlocks\":[],\"note\":{}}"
		]
} ,  */
  noteType = 'Notes'
  prefix = ''
  rawContent = 'SET_ME_IN_TEST'
  referencedBlocks = []
  subItems = []
  type = 'text'

  // Methods
  async children() {
    throw 'Paragraph :: children called, but children was not set. You should pass a children function with the paragraph'
  }
  // async duplicate() {
  //   return this
  // }
  async init() {
    throw 'Paragraph :: init Not implemented yet'
  }

  constructor(data?: any = {}) {
    this.__update(data)
    if (!data.rawContent) {
      // set rawContent from content
      switch (this.type) {
        case 'open':
          this.rawContent = `- [ ] ${this.content}`
          break
        case 'cancelled':
          this.rawContent = `- [-] ${this.content}`
          break
        case 'done':
          this.rawContent = `- [x] ${this.content}`
          break
        case 'scheduled':
          this.rawContent = `- [>] ${this.content}`
          break
        case 'checklist':
          this.rawContent = `+ [ ] ${this.content}`
          break
        case 'checklistCancelled':
          this.rawContent = `+ [-] ${this.content}`
          break
        case 'checklistDone':
          this.rawContent = `+ [x] ${this.content}`
          break
        case 'checklistScheduled':
          this.rawContent = `+ [>] ${this.content}`
          break
        case 'separator':
          this.rawContent = `---`
          break
        case 'empty':
          this.rawContent = ``
          break
      }
    }
    // TODO: is there a way of incrementing lineIndex here?
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
