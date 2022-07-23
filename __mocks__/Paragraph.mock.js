/* eslint-disable */
/*
 * Paragraph mock class
 *
 * Usage: const myParagraph = new Paragraph({ param changes here })
 *
 */

export class Paragraph {
  // Properties
  blockId = 'PLACEHOLDER' // TODO: add value
  content = 'PLACEHOLDER' // TODO: add value
  contentRange = {} /* {
		"start": 0,
		"end": 2,
		"length": 2
} ,  */
  date = 'PLACEHOLDER' // TODO: add value
  filename = 'PLACEHOLDER' // TODO: add value
  heading = 'PLACEHOLDER' // TODO: add value
  headingLevel = 'PLACEHOLDER' // TODO: add value
  headingRange = 'PLACEHOLDER' // TODO: add value
  indents = 'PLACEHOLDER' // TODO: add value
  isRecurring = 'PLACEHOLDER' // TODO: add value
  lineIndex = 'PLACEHOLDER' // TODO: add value
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
  noteType = 'PLACEHOLDER' // TODO: add value
  prefix = 'PLACEHOLDER' // TODO: add value
  rawContent = 'PLACEHOLDER' // TODO: add value
  referencedBlocks = []
  subItems = []
  type = 'PLACEHOLDER' // TODO: add value

  // Methods
  async children() {
    throw 'Paragraph :: children Not implemented yet'
  }
  // async duplicate() {
  //   return this
  // }
  async init() {
    throw 'Paragraph :: init Not implemented yet'
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
