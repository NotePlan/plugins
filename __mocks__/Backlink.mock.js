/*
 * Backlink mock class
 *
 * Usage: const myBacklink = new Backlink({ param changes here })
 *
 */

export class Backlink {
  // Properties
  blockId = 'PLACEHOLDER' // TODO: add value
  content = 'PLACEHOLDER' // TODO: add value
  contentRange = 'PLACEHOLDER' // TODO: add value
  date = {} /* new Date("Tue Jun 14 2022 00:00:00 GMT-0700 (PDT)"),  */
  filename = 'PLACEHOLDER' // TODO: add value
  heading = 'PLACEHOLDER' // TODO: add value
  headingLevel = 'PLACEHOLDER' // TODO: add value
  headingRange = 'PLACEHOLDER' // TODO: add value
  indents = 'PLACEHOLDER' // TODO: add value
  isRecurring = 'PLACEHOLDER' // TODO: add value
  lineIndex = 'PLACEHOLDER' // TODO: add value
  linkedNoteTitles = []
  note = {} /* {
		"filename": "20220614.md",
		"type": "Calendar",
		"title": "2022-06-14",
		"date": "2022-06-14T07:00:00.000Z",
		"changedDate": "2022-06-15T23:34:12.000Z",
		"createdDate": "2022-06-15T23:34:12.000Z",
		"hashtags": [],
		"mentions": [],
		"linkedItems": [
				"{\"type\":\"open\",\"content\":\" >today add filler photo ^mmw6w5\",\"blockId\":\"^mmw6w5\",\"rawContent\":\"*  >today add filler photo ^mmw6w5\",\"prefix\":\"* \",\"contentRange\":{},\"lineIndex\":0,\"date\":\"2022-06-15T07:00:00.000Z\",\"heading\":\"\",\"headingLevel\":-1,\"isRecurring\":false,\"indents\":0,\"filename\":\"20220614.md\",\"noteType\":\"Calendar\",\"linkedNoteTitles\":[],\"subItems\":[],\"referencedBlocks\":[{}],\"note\":{}}"
		],
		"datedTodos": [
				"{\"type\":\"open\",\"content\":\" >today add filler photo ^mmw6w5\",\"blockId\":\"^mmw6w5\",\"rawContent\":\"*  >today add filler photo ^mmw6w5\",\"prefix\":\"* \",\"contentRange\":{},\"lineIndex\":0,\"date\":\"2022-06-15T07:00:00.000Z\",\"heading\":\"\",\"headingLevel\":-1,\"isRecurring\":false,\"indents\":0,\"filename\":\"20220614.md\",\"noteType\":\"Calendar\",\"linkedNoteTitles\":[],\"subItems\":[],\"referencedBlocks\":[{}],\"note\":{}}"
		],
		"backlinks": [],
		"frontmatterTypes": [],
		"content": "*  >today add filler photo ^mmw6w5\n* ",
		"paragraphs": [
				"{\"type\":\"open\",\"content\":\" >today add filler photo ^mmw6w5\",\"blockId\":\"^mmw6w5\",\"rawContent\":\"*  >today add filler photo ^mmw6w5\",\"prefix\":\"* \",\"contentRange\":{},\"lineIndex\":0,\"date\":\"2022-06-15T07:00:00.000Z\",\"heading\":\"\",\"headingLevel\":-1,\"isRecurring\":false,\"indents\":0,\"filename\":\"20220614.md\",\"noteType\":\"Calendar\",\"linkedNoteTitles\":[],\"subItems\":[],\"referencedBlocks\":[{}],\"note\":{}}",
				"{\"type\":\"open\",\"content\":\"\",\"rawContent\":\"* \",\"prefix\":\"* \",\"contentRange\":{},\"lineIndex\":1,\"heading\":\"\",\"headingLevel\":-1,\"isRecurring\":false,\"indents\":0,\"filename\":\"20220614.md\",\"noteType\":\"Calendar\",\"linkedNoteTitles\":[],\"subItems\":[],\"referencedBlocks\":[],\"note\":{}}"
		]
} ,  */
  noteType = 'PLACEHOLDER' // TODO: add value
  prefix = 'PLACEHOLDER' // TODO: add value
  rawContent = 'PLACEHOLDER' // TODO: add value
  referencedBlocks = []
  subItems = [] /* sample:  [{
 "type": "open",
 "content": " >today add filler photo ^mmw6w5",
 "blockId": "^mmw6w5",
 "rawContent": "*  >today add filler photo ^mmw6w5",
 "prefix": "* ",
 "contentRange": {},
 "lineIndex": 0,
 "date": "2022-06-15T07:00:00.000Z",
 "heading": "",
 "headingLevel": -1,
 "isRecurring": false,
 "indents": 0,
 "filename": "20220614.md",
 "noteType": "Calendar",
 "linkedNoteTitles": [],
 "subItems": [],
 "referencedBlocks": [
  {}
 ],
 "note": {}
} ] */
  type = 'PLACEHOLDER' // TODO: add value

  // Methods
  async children() {
    throw 'Backlink :: children Not implemented yet'
  }
  async duplicate() {
    throw 'Backlink :: duplicate Not implemented yet'
  }
  async init() {
    throw 'Backlink :: init Not implemented yet'
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
