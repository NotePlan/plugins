/* eslint-disable */
/*
 * DataStore mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 */

const DataStore = {
  // async calendarNoteByDate() { return null },
  // async calendarNoteByDateString() { return null },
  /* calendarNotes: [{ return {
		"filename": "20200202.md",
		"type": "Calendar",
		"title": "2020-02-02",
		"date": "2020-02-02T08:00:00.000Z",
		"changedDate": "2022-05-11T14:09:19.432Z",
		"createdDate": "2022-05-11T14:09:19.432Z",
		"hashtags": [],
		"mentions": [],
		"linkedItems": [],
		"datedTodos": [],
		"backlinks": [
				"{"type":"note","content":"testt","rawContent":"testt","prefix":"","lineIndex":0,"heading":"","headingLevel":0,"isRecurring":false,"indents":0,"filename":"Summaries/testt.md","noteType":"Notes","linkedNoteTitles":[],"subItems":["{"type":"title","content":"foo","rawContent":"# foo","prefix":"# ","contentRange":{},"lineIndex":0,"date":"2020-02-02T08:00:00.000Z","heading":"testt","headingLevel":0,"isRecurring":false,"indents":0,"filename":"Summaries/testt.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}","{"type":"list","content":"==foo==  >2020-02-02","rawContent":"- ==foo==  >2020-02-02","prefix":"- ","contentRange":{},"lineIndex":3,"date":"2020-02-02T08:00:00.000Z","heading":"foo","headingRange":{},"headingLevel":3,"isRecurring":false,"indents":0,"filename":"Summaries/testt.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}"],"referencedBlocks":[],"note":{}}"
		],
		"frontmatterTypes": [],
		"content": "
* foo",
		"paragraphs": [
				"{"type":"empty","content":"","rawContent":"","prefix":"","contentRange":{},"lineIndex":0,"heading":"","headingLevel":-1,"isRecurring":false,"indents":0,"filename":"20200202.md","noteType":"Calendar","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}",
				"{"type":"open","content":"foo","rawContent":"* foo","prefix":"* ","contentRange":{},"lineIndex":1,"heading":"","headingLevel":-1,"isRecurring":false,"indents":0,"filename":"20200202.md","noteType":"Calendar","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}"
		]
} }], */
  // defaultFileExtension: VALUE ,
  /* folders: [{ return / }], */
  // async installOrUpdatePluginsByID() { return null },
  // async installPlugin() { return null },
  // async installedPlugins() { return null },
  // async invokePluginCommand() { return null },
  // async invokePluginCommandByName() { return null },
  // async isPluginInstalledByID() { return null },
  // async listPlugins() { return null },
  // async loadData() { return null },
  // async loadJSON() { return null },
  // async moveNote() { return null },
  async newNote(title = '', folder = '') {
    return `# ${title}`
  },
  // async newNoteWithContent() { return null },
  // async noteByFilename() { return null },

  preference(key: string = ''): string {
    // let deliberatelyUndefined
    switch (key) {
      case 'timeblockTextMustContainString':
        // return 'at' // to test use of 'must contain string'
        // return deliberatelyUndefined // to test an error case
        return '' // set to blank to mimic no additional NP checking of text strings
        break
      case 'isAsteriskTodo':
        return true
        break

      default:
        return ''
        break
    }
  },

  // async projectNoteByFilename() { return null },
  // async projectNoteByTitle() { return null },
  // async projectNoteByTitleCaseInsensitive() { return null },
  /* projectNotes: [{ return {
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
				"{"type":"title","content":"","rawContent":"# ","prefix":"# ","contentRange":{},"lineIndex":0,"heading":"","headingLevel":1,"isRecurring":false,"indents":0,"filename":"Migrated/Marlita Hours.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}"
		]
} }], */
  // async referencedBlocks() { return null },
  // async saveData() { return null },
  // async saveJSON() { return null },
  // async search() { return null },
  // async searchCalendarNotes() { return null },
  // async searchProjectNotes() { return null },
  // async setPreference() { return null },
  settings: {
    settingsFieldName: 'Settings field value',
    _logLevel: 'DEBUG',
  },
}

module.exports = DataStore
