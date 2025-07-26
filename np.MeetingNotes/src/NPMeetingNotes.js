// @flow

const scriptLoad = new Date()

import moment from 'moment-business-days'

import { getTemplate } from '../../np.Templating/lib/core'
import pluginJson from '../plugin.json'
import { showMessage, chooseFolder, chooseOption, showMessageYesNo } from '../../helpers/userInput'
import { getNoteByFilename } from '../../helpers/note'
import { isCalendarNoteFilename } from '@helpers/regex'
import { log, logDebug, logError, clo, JSP, timer } from '@helpers/dev'
import { findProjectNoteUrlInText } from '@helpers/urls'
import { getAttributes } from '@helpers/NPFrontMatter'
import { checkAndProcessFolderAndNewNoteTitle } from '@helpers/editor'

/**
 * Insert a template into a daily note or the current editor.
 * Called from the 'insert template' button of an empty note.
 * Called from 'insert template' context menu or "/-commands"
 * @param {string} origFileName -> (optional) Template filename, if not set the user will be asked
 * @param {Date} dailyNoteDate -> (optional) Date of the daily note, if not set the current editor will be used
 */
export async function insertNoteTemplate(origFileName: string, dailyNoteDate: Date, timeframe: string, shouldReplaceContent: boolean = false): Promise<void> {
  logDebug(pluginJson, 'insertNoteTemplate')
  const templateFilename = await chooseTemplateIfNeeded(origFileName, false)
  if (!templateFilename) {
    return
  }

  logDebug(pluginJson, 'get content of template for rendering')
  const templateNote = DataStore.projectNoteByFilename(templateFilename)
  let templateContent = templateNote?.content

  if (!templateContent) {
    logError(pluginJson, `couldnt load content of template "${templateFilename}"`)
    templateContent = await getTemplate(templateFilename)
    //
    // templateContent = await DataStore.invokePluginCommandByName('getTemplate', 'np.Templating', [templateFilename])
    return
  }

  logDebug(pluginJson, 'calling renderFrontmatter() to pre-render template')
  const { frontmatterBody: templateBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateContent])

  // Check if the template wants the note to be created in a folder (or with a new title) and if so, move the empty note to the trash and create a new note in the folder
  if (templateNote && (await checkAndProcessFolderAndNewNoteTitle(templateNote, frontmatterAttributes))) return

  logDebug(pluginJson, `render() template with frontmatterAttributes: [${Object.keys(frontmatterAttributes).join(', ')}]`)

  const result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [templateBody, frontmatterAttributes])

  if (dailyNoteDate) {
    logDebug(pluginJson, `apply rendered template to daily note with date ${String(dailyNoteDate)}`)
    const note = DataStore.calendarNoteByDate(dailyNoteDate, timeframe)
    if (note) {
      if (note.content && note.content !== '') {
        note.content += `\n\n${result}`
      } else {
        note.content = result
      }
    }
  } else {
    logDebug(pluginJson, 'apply rendered template to the current editor')
    // Editor.content = result
    if (shouldReplaceContent) {
      Editor.content = result
    } else {
      Editor.insertTextAtCursor(result)
    }
  }
}

/**
 * Ask user which linked note they want to open
 * @param {*} filenames
 * @returns {string} - the filename that the user chose or "" if no choice or no linked project noces
 */
async function askWhichNoteToOpen(filenames: Array<string>): Promise<string> {
  const options = filenames
    .filter((f) => !isCalendarNoteFilename(f)) // ignore the links to the calendar notes
    .map((f) => {
      const note = getNoteByFilename(f)
      return { label: `${note?.title || ''}`, value: f }
    })
  const num = options.length
  if (num) {
    if (num === 1) return options[0].value
    return await chooseOption(`${num} notes are linked. Open which?`, options)
  } else {
    return ''
  }
}

/**
 * Get a calendar event from ID and pass it to newMeetingNote
 * @param {string} eventID
 * @param {string} template
 */
export async function newMeetingNoteFromID(eventID: string, template?: string): Promise<void> {
  const startTime = new Date()
  try {
    logDebug(pluginJson, `${timer(scriptLoad)} - newMeetingNoteFromID id:${eventID} template:${String(template)}`)
    const selectedEvent: TCalendarItem = await Calendar.eventByID(eventID)
    if (selectedEvent) {
      clo(selectedEvent, `${timer(scriptLoad)} - newMeetingNoteFromID: selectedEvent`)
      // First try to look for an existing meeting note we can just open up
      // NOTE: a URL is not always written into the note (not written if there are attendees or calendar not writeable)
      const linkedFilenames = (await selectedEvent.findLinkedFilenames()).filter((l) => !isCalendarNoteFilename(l)) // Assuming that the [0] item will be the meeting note and the 2nd item is the calendar note
      clo(
        linkedFilenames.map((f) => decodeURIComponent(f)),
        `newMeetingNoteFromID: Linked filenames:${linkedFilenames.length}`,
      )
      const existingMeetingNoteFilename = linkedFilenames.length === 2 ? linkedFilenames[0] : await askWhichNoteToOpen(linkedFilenames)
      let forceNewNote = false
      if (existingMeetingNoteFilename || selectedEvent.notes?.length) {
        const meetingNoteURL = findProjectNoteUrlInText(selectedEvent.notes)
        clo(linkedFilenames, `Searching note for meetingNote links yielded: URL:"${meetingNoteURL}"); selectedEvent.findLinkedFilenames=`)
        if (existingMeetingNoteFilename || meetingNoteURL) {
          logDebug(pluginJson, `newMeetingNoteFromID Pre-existing note exists.`)
          if (!selectedEvent.isRecurring) {
            // this is a one-time event and a meeting note link already exists, so open it
            existingMeetingNoteFilename ? await Editor.openNoteByFilename(existingMeetingNoteFilename) : NotePlan.openURL(meetingNoteURL)
            logDebug(pluginJson, `newMeetingNoteFromID is not a recurring event. opening and done.`)
            return
          } else {
            // this is a recurring event so let's show it and aks what to do
            const options = [
              { label: `Open the pre-existing Meeting Note for the series`, value: `open` },
              { label: `Create a new note for this occurrence`, value: `new` },
            ]
            const res = await chooseOption(`Note exists, but this is a recurring event, so:`, options)
            if (res === 'open') {
              NotePlan.openURL(meetingNoteURL)
              return
            } else {
              forceNewNote = true
            }
          }
        }
      }
      await newMeetingNote(selectedEvent, template, forceNewNote)
    }
  } catch (error) {
    logError(pluginJson, `error in newMeetingNoteFromID: ${JSP(error)}`)
  }
  logDebug(pluginJson, `newMeetingNoteFromID: finished after ${timer(startTime)}`)
}

/**
 * Selects an event and a template.
 * @param {TCalendarItem} _selectedEvent
 * @param {string} _templateFilename
 * @returns {Promise<{selectedEvent: TCalendarItem, templateFilename: string}>}
 */
async function selectEventAndTemplate(
  _selectedEvent?: TCalendarItem | null = null,
  _templateFilename?: string,
): Promise<{ selectedEvent: TCalendarItem | null, templateFilename: string }> {
  const selectedEvent = await chooseEventIfNeeded(_selectedEvent)
  const templateFilename = await chooseTemplateIfNeededFromTemplateTitle(_templateFilename, true)
  return { selectedEvent, templateFilename }
}

/**
 * Pre-renders and renders the template for a selected event.
 * @param {TCalendarItem} selectedEvent
 * @param {string} templateFilename
 * @returns {Promise<{result: string, attrs: any}>}
 */
async function renderTemplateForEvent(selectedEvent, templateFilename): Object {
  logDebug(pluginJson, `${timer(scriptLoad)} - renderTemplateForEvent: templateFilename: "${templateFilename}"; selectedEvent.title: "${selectedEvent?.title}"`)
  let templateVariables, templateContent
  if (selectedEvent) {
    templateVariables = generateEventData(selectedEvent)
  }
  if (templateFilename) {
    templateContent = DataStore.projectNoteByFilename(templateFilename)?.content || ''
  }
  logDebug(
    pluginJson,
    `${timer(scriptLoad)} - renderTemplateForEvent: calling renderFrontmatter() with content and variables (${
      templateVariables ? Object.keys(templateVariables).join(', ') : 'none'
    })`,
  )
  const { frontmatterBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateContent, templateVariables])

  clo(frontmatterBody, 'renderTemplateForEvent frontmatterBody:')
  clo(frontmatterAttributes, 'renderTemplateForEvent frontmatterAttributes:')

  const result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [frontmatterBody, frontmatterAttributes, templateVariables])

  return { result, attrs: frontmatterAttributes }
}

/**
 * Get the pre-existing title of this note as defined in the content itself
 * There are multiple ways to define a note's title: in frontmatter, as the first line of text
 * @param {string} content
 * @param {Object} attributes
 * @returns {string|null} the title if it exists
 */
function titleExistsInNote(content: string): string | null {
  // logDebug(pluginJson, `titleExistsInNote attributes?.title=${attributes?.title}`)
  // if (attributes?.title) return attributes.title // commenting this out because attributes is the template's attributes, not the resulting doc
  const lines = content.split('\n')
  const headingLine = lines.find((l) => l.startsWith('# '))
  logDebug(pluginJson, `titleExistsInNote headingLine || null=${headingLine || 'null (no title in content)'}`)
  return headingLine || null
}

/**
 * Gets the note title from the template or the first line of the rendered template.
 * @param {string} _noteTitle - newNotetitle specified in the template (may be empty)
 * @param {string} renderedTemplateContent - rendered template content
 * @param {Object} attributes - attributes of the note
 * @returns {string} note title or ''
 */
function getNoteTitle(_noteTitle: string, renderedTemplateContent: string, attributes: Object): string {
  if (_noteTitle) return _noteTitle
  // if (attributes?.title) return attributes.title
  // grab the first line of the result as the title
  const lines = renderedTemplateContent.split('\n')
  const headingLine = lines.find((l) => l.startsWith('#')) // may need to infer the title from a ## title etc.
  const noteTitle = headingLine ? headingLine.replace(/(^#*\s*)/, '').trim() : ''
  logDebug(pluginJson, `No title specified directly. Trying to infer it from the headingLine: "${headingLine || ''}" => "${noteTitle}"`)
  return noteTitle
}

/**
 * Handles existing notes.
 * @param {string} noteTitle - The title of the note.
 * @param {string} renderedContent - The rendered content.
 * @param {string} folder - The folder.
 * @param {Object} attributes
 * @param {boolean} forceNewNote - skip "note already exists" check and create new note
 * @returns {Promise<string>} The note title.
 */
async function handleExistingNotes(_noteTitle: string, renderedContent: string, folder: string, forceNewNote: boolean = false): Promise<string> {
  let noteTitle = _noteTitle
  const existingNotes = await DataStore.projectNoteByTitle(noteTitle, false, false)
  const noteContent = titleExistsInNote(renderedContent) ? renderedContent : `# ${noteTitle}\n${renderedContent}`
  logDebug(pluginJson, `handleExistingNotes: Found ${String(existingNotes?.length)} existing notes with title ${noteTitle}`)
  if (!forceNewNote && existingNotes?.length) {
    // split here
    await Editor.openNoteByFilename(existingNotes[0].filename)
    const options = [
      { label: `Open the existing note (no changes)`, value: `open` },
      { label: `Prepend meeting info to note`, value: `prepend` },
      { label: `Append meeting info to note`, value: `append` },
      { label: `Create a new note with same title`, value: `new` },
    ]
    const res = await chooseOption(`Note exists: "${noteTitle}".`, options)
    switch (res) {
      case 'new':
        noteTitle = (await newNoteWithFolder(noteContent, folder)) ?? '<error>'
        break
      case 'append':
      case 'prepend':
        noteTitle = (await appendPrependNewNote(noteTitle, res, folder, renderedContent)) ?? '<error>'
        break
      case 'open':
      case null:
        return ''
    }
  } else {
    logDebug(pluginJson, `handleExistingNotes: creating note with content:"${noteContent}"`)
    if (/choose|select/i.test(folder)) {
      folder = await chooseFolder('Choose a folder to create note in', false, true)
    }
    noteTitle = (await newNoteWithFolder(noteContent, folder)) ?? '<error>'
  }
  return noteTitle
}

/**
 * Creates a new note and links it to the event itself.
 * @param {TCalendarItem | null} selectedEvent - The selected event.
 * @param {string} renderedContent - The rendered content.
 * @param {Object} attrs - The attributes.
 * @param {boolean} forceNewNote - ignore the "note exists" commandbar and force new note creation
 * @returns {Promise<void>}
 */
async function createNoteAndLinkEvent(selectedEvent: TCalendarItem | null, renderedContent: string, attrs: Object, forceNewNote: boolean = false): Promise<void> {
  const folder: string = attrs?.folder || ''
  const append: string = attrs?.append || ''
  const prepend: string = attrs?.prepend || ''
  const cursor: string = attrs?.cursor || ''
  const newNoteTitle: string = attrs?.newNoteTitle || ''

  let noteTitle: string = (append || prepend || cursor).trim()
  const location: string = append.length ? 'append' : cursor.length ? 'cursor' : 'prepend'
  noteTitle = noteTitle.length ? noteTitle : newNoteTitle

  if (append || prepend || cursor) {
    noteTitle = (await appendPrependNewNote(noteTitle, location, folder, renderedContent)) ?? '<error>'
  } else {
    noteTitle = getNoteTitle(noteTitle, renderedContent, attrs)
    if (selectedEvent && noteTitle) {
      noteTitle = await handleExistingNotes(noteTitle, renderedContent, folder, forceNewNote)
    } else {
      logDebug(pluginJson, `Could not ${selectedEvent ? 'find selected event' : 'determine note title'}`)
      return
    }
  }
  selectedEvent ? writeNoteLinkIntoEvent(selectedEvent, noteTitle) : null
}

/**
 * Create a meeting note for a calendar event
 * This function is called when the user right-clicks a calendar event and selects "New Meeting Note" (NP passes the CalendarItem to the function)
 * Can also be called via newMeetingNoteFromID() when it receives an x-callback-url (with or without arguments)
 * If arguments are not provided, the user will be prompted to select an event and a template
 * @param {TCalendarItem} _selectedEvent
 * @param {string?} _templateFilename
 * @param {boolean} forceNewNote - override the "note exists" commandbar and force new note creation
 * @returns {Promise<void>}
 */
export async function newMeetingNote(_selectedEvent?: TCalendarItem, _templateFilename?: string, forceNewNote: boolean = false): Promise<void> {
  const { selectedEvent, templateFilename } = await selectEventAndTemplate(_selectedEvent, _templateFilename)
  logDebug(pluginJson, `${timer(scriptLoad)} - newMeetingNote: got selectedEvent and templateFilename; calling renderTemplateForEvent()`)
  const { result, attrs } = await renderTemplateForEvent(selectedEvent, templateFilename)
  logDebug(pluginJson, `${timer(scriptLoad)} - newMeetingNote: rendered template`)
  clo(result, 'rendered template:')
  await createNoteAndLinkEvent(selectedEvent, result, attrs, forceNewNote)
  logDebug(pluginJson, `${timer(scriptLoad)} - newMeetingNote: created note and linked event`)
}

/**
 * Writes a x-callback-url note link into the event after creating a meeting note, so you can access the meeting note from a calendar app by clicking on it.
 * @param {TCalendarItem} selectedEvent
 * @param {string} newTitle
 */
function writeNoteLinkIntoEvent(selectedEvent: TCalendarItem, newTitle: string): void {
  try {
    // Only add the link to events without attendees
    logDebug(pluginJson, 'writing event link into event notes.')

    if (newTitle && selectedEvent?.attendees && selectedEvent.attendees.length === 0 && selectedEvent.isCalendarWritable) {
      // FIXME(Eduard): no such field on Calendar or CalendarItem
      let noteLink = `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(newTitle)}`
      const eventNotes = selectedEvent.notes
      if (eventNotes.length > 0) {
        noteLink = `\n${noteLink}`
      }

      selectedEvent.notes = eventNotes + noteLink

      logDebug(pluginJson, 'update the event')
      Calendar.update(selectedEvent)
    } else {
      logDebug(pluginJson, `note link not written to event because it contains attendees (${selectedEvent.attendees.length}) or calendar doesnt allow content changes.`)
    }
  } catch (error) {
    logError(pluginJson, `error in writeNoteLinkIntoEvent: ${error}`)
  }
}

/**
 * Get a note based on its name.
 * @param {string} noteName - The name of the note.
 * @param {string} folder - The folder where the note is located.
 * @returns {Promise<CoreNoteFields>} The note.
 */
async function getNoteBasedOnName(noteName: string, folder: string): Promise<CoreNoteFields | null> {
  logDebug(`np.MeetingNotes getNoteBasedOnName: "${noteName}" folder: ${folder}`)
  if (noteName === '<select>') {
    return await getNoteFromSelection(folder)
  } else if (/<current>/i.test(noteName)) {
    return getNoteFromEditor()
  } else if (/<today>/i.test(noteName)) {
    await Editor.openNoteByDate(new Date())
    return Editor
  } else {
    return getNoteByTitle(noteName, folder)
  }
}

/**
 * Get a note from the user's selection.
 * @param {string} folder - The folder where the note is located.
 * @returns {Promise<CoreNoteFields>} The note.
 */
async function getNoteFromSelection(folder: string): Promise<CoreNoteFields> {
  let notes = [...DataStore.projectNotes].sort((a, b) => (a.changedDate < b.changedDate ? 1 : -1))

  if (folder) {
    const filteredNotes = notes.filter((n) => n.filename.startsWith(folder))
    if (filteredNotes.length > 0) {
      notes = filteredNotes
    }
  }
  const selection = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'Untitled Note'),
    'Select a note',
  )
  return notes[selection.index]
}

/**
 * Get the note that is currently open in the editor.
 * @returns {CoreNoteFields} The note.
 */
function getNoteFromEditor(): CoreNoteFields {
  if (Editor.note) {
    return Editor.note
  } else {
    logError(pluginJson, 'want to use <current> note, but no note is open in the editor')
    throw new Error('There is no note open in the editor, so cannot apply the Template')
  }
}

/**
 * Get a note by its title.
 * @param {string} noteName - The name of the note.
 * @param {string} folder - The folder where the note is located.
 * @returns {CoreNoteFields} The note.
 */
function getNoteByTitle(noteName: string, folder: string): CoreNoteFields | null {
  const availableNotes = DataStore.projectNoteByTitle(noteName)
  if (availableNotes && availableNotes.length > 0) {
    if (folder && !/choose|select/i.test(folder)) {
      const filteredNotes = availableNotes?.filter((n) => n.filename.startsWith(folder)) ?? []
      if (filteredNotes.length > 0) {
        return filteredNotes[0]
      }
    }
    return availableNotes[0]
  }
  return null
}

/**
 * Create a new note if no note was found.
 * @param {string} noteName - The name of the note.
 * @param {string} folder - The folder where the note is located.
 * @returns {Promise<CoreNoteFields>} The note.
 */
// eslint-disable-next-line require-await
async function createNewNoteIfNotFound(noteName: string, folder: string): Promise<CoreNoteFields | null> {
  const filename = DataStore.newNote(noteName, folder)
  if (filename) {
    if (DataStore.projectNoteByFilename(filename)) {
      return DataStore.projectNoteByFilename(filename) || null
    } else {
      logError(pluginJson, `can't find project note '${filename}' so stopping`)
      throw new Error(`can't find project note '${filename}' so stopping`)
    }
  }
  return null
}

/**
 * Update the content of a note.
 * @param {CoreNoteFields} note - The note to update.
 * @param {string} location - The location where to update the note.
 * @param {string} content - The new content.
 * @param {number} originalContentLength - The original content length.
 * @returns {Promise<void>}
 */
async function updateNoteContent(note: CoreNoteFields, location: string, content: string, originalContentLength: number): Promise<void> {
  if (location === 'append') {
    note.appendParagraph(content, 'text')
  } else if (location === 'cursor') {
    const cursorPosition = Editor.selection
    Editor.insertTextAtCursor(content)
    Editor.select(cursorPosition?.start || 0 + content.length + 3, 0)
  } else {
    note.prependParagraph(content, 'text')
  }

  if (location !== 'cursor') {
    await Editor.openNoteByFilename(note.filename)
  }

  if (location === 'append') {
    Editor.select(originalContentLength + 3, 0)
  }
}

/**
 * Appends or prepends a string to a note. Used for meeting note templates to append the meeting note to the current or a selected note for example.
 * @param {string} noteName - The name of the note.
 * @param {string} location - The location where to update the note.
 * @param {string} folder - The folder where the note is located.
 * @param {string} content - The new content.
 * @returns {Promise<string|null>} The title of the note or null.
 */
async function appendPrependNewNote(noteName: string, location: string, _folder: string = '', content: string): Promise<string | null> {
  try {
    let folder = _folder
    logDebug(`np.MeetingNotes appendPrependNewNote noteName=${noteName} location:${location} folder:${folder}`)
    let note = await getNoteBasedOnName(noteName, folder)
    if (!note) {
      if (/<choose>|<select>/i.test(folder)) folder = await chooseFolder('Choose folder to create note in', false, true)
      note = await createNewNoteIfNotFound(noteName, folder)
    }

    if (!note) {
      CommandBar.prompt(`Could not find or create the note '${noteName}'`, '')
      return null
    }

    const originalContentLength = note.content?.length ?? 0
    await updateNoteContent(note, location, content, originalContentLength)
    return note?.title || ''
  } catch (error) {
    logDebug(pluginJson, `error in appendPrependNewNote: ${error}`)
  }
}

/**
 * Create a new note in a folder (if specified, or if not specified, the user will choose)
 * @param {string} content
 * @param {string} _folder
 * @returns {Promise<string?>} title (or null)
 */
async function newNoteWithFolder(content: string, _folder?: string): Promise<?string> {
  let folder = _folder
  try {
    if (!folder || folder === '<select>') {
      logDebug(pluginJson, 'get all folders and show them for selection')
      folder = await chooseFolder('Select a folder to create the note in', false, true)
    } else if (folder === '<current>') {
      logDebug(pluginJson, 'find the current folder of the opened note')
      let currentFilename

      if (Editor.note) {
        currentFilename = Editor.note.filename.split('/')

        if (currentFilename.length > 1) {
          currentFilename.pop()
          folder = currentFilename.join('/')
        } else {
          folder = ''
        }
      } else {
        logDebug(pluginJson, 'choose the folder which is selected in the sidebar')
        folder = NotePlan.selectedSidebarFolder
      }
    }

    logDebug(pluginJson, 'create a new note')
    // $FlowFixMe
    const filename = DataStore.newNoteWithContent(content, folder)

    logDebug(pluginJson, 'open the created note')
    Editor.openNoteByFilename(filename)

    logDebug(pluginJson, 'find the note and return the title')
    const note = DataStore.projectNoteByFilename(filename)
    if (note) {
      return note.title
    }
    return null
  } catch (error) {
    logDebug(pluginJson, `error in newNoteWithFolder: ${error}`)
    return null
  }
}

const errorReporter = async (error: any, note: TNote) => {
  const msg = `Error found in frontmatter of a template. I will try to continue, but you should try to fix the error in the following template:\nfilename:"${
    note.filename
  }",\n note titled:"${note.title ?? ''}".\nThe problem is:\n"${error.message}"`
  if (error.stack) delete error.stack
  logError(pluginJson, `${msg}\n${JSP(error)}`)
  await showMessage(msg)
}

/**
 * Get the template name to be used
 * Check to see if an template has already been selected, and if so, pass it back
 * If not, ask the user to select a template from a lsit of tempates
 * @param {string?} templateTitle to use
 * @param {boolean} onlyMeetingNotes? (optional) - if true, only show meeting notes, otherwise show all templates except type:ignore templates
 * @returns {Promise<string>} filename of the template
 */
async function chooseTemplateIfNeededFromTemplateTitle(templateTitle?: string, onlyMeetingNotes: boolean = false): Promise<?string> {
  // Get the filename and then pass to the main function
  logDebug(
    pluginJson,
    `${timer(scriptLoad)} - chooseTemplateIfNeededFromTemplateTitle starting with templateTitle: "${String(templateTitle)}" and onlyMeetingNotes: ${String(onlyMeetingNotes)}`,
  )
  if (templateTitle) {
    if (!templateTitle.endsWith('.md') && !templateTitle.endsWith('.txt')) {
      const matchingTemplates = DataStore.projectNotes.filter((n) => n.title === templateTitle)
      logDebug(pluginJson, `${timer(scriptLoad)}- got ${matchingTemplates.length} template title matches for '${templateTitle}'`)
      if (matchingTemplates && matchingTemplates.length > 0) {
        logDebug(pluginJson, `${timer(scriptLoad)}- choosing the first template title match for '${templateTitle}'; filename: ${matchingTemplates[0].filename}`)
        return await chooseTemplateIfNeeded(matchingTemplates[0].filename, onlyMeetingNotes)
      }
    } else {
      logDebug(pluginJson, `${timer(scriptLoad)}- we have a filename (template name ends with .md or .txt), so sending filename directly to chooseTemplateIfNeeded`)
    }
    return await chooseTemplateIfNeeded(templateTitle, onlyMeetingNotes)
  }
  logDebug(pluginJson, `${timer(scriptLoad)} - no template title provided; chooseTemplateIfNeededFromTemplateTitle ending`)
  return await chooseTemplateIfNeeded('', onlyMeetingNotes)
}

/**
 * Get the template name to be used
 * Check to see if an template has already been selected, and if so, pass it back
 * If not, ask the user to select a template from a lsit of tempates
 * @param {string?} templateFilename to use (optional)
 * @param {boolean} onlyMeetingNotes? (optional) - if true, only show meeting notes, otherwise show all templates except type:ignore templates
 * @returns {Promise<string>} filename of the template
 */
async function chooseTemplateIfNeeded(templateFilename?: string, onlyMeetingNotes: boolean = false): Promise<?string> {
  logDebug(
    pluginJson,
    `${timer(scriptLoad)} - chooseTemplateIfNeeded() starting with templateFilename: "${String(templateFilename)}" and onlyMeetingNotes: ${String(onlyMeetingNotes)}`,
  )
  try {
    if (!templateFilename) {
      logDebug(pluginJson, `${timer(scriptLoad)} - no template was defined, find all available templates and show them`)

      const templateFolder = NotePlan.environment.templateFolder
      logDebug(pluginJson, `${timer(scriptLoad)} templateFolder ${templateFolder}`)
      const notes = DataStore.projectNotes
      logDebug(pluginJson, `${timer(scriptLoad)} notes ${notes.length}`)
      const allTemplates = notes.filter((n) => n.filename.startsWith(templateFolder))
      logDebug(pluginJson, `${timer(scriptLoad)} allTemplates ${allTemplates.length}`)

      // const allTemplates = DataStore.projectNotes.filter((n) => n.filename.startsWith(NotePlan.environment.templateFolder))
      logDebug(pluginJson, `${timer(scriptLoad)} - ${allTemplates.length} templates found`)
      if (!allTemplates || allTemplates.length === 0) {
        await showMessage(`Couldn't find any templates in the template folder (${NotePlan.environment.templateFolder})})`)
        throw new Error(`Couldn't find any templates`)
      }

      const templates = []
      for (const template of allTemplates) {
        try {
          const attributes = getAttributes(template.content, true)
          if (attributes) {
            // logDebug(pluginJson, `chooseTemplateIfNeeded ${template.filename}: type:${attributes.type} (${typeof attributes.type})`)
            if ((onlyMeetingNotes && attributes.type && attributes.type.includes('meeting-note')) || (!onlyMeetingNotes && (!attributes.type || attributes.type !== 'ignore'))) {
              templates.push(template)
            }
          }
        } catch (error) {
          await errorReporter(error, template)
          continue
        }
      }

      if (!templates || templates.length === 0) {
        await showMessage(`Couldn't find any templates in the template folder (${NotePlan.environment.templateFolder})})`)
        throw new Error(`Couldn't find any meeting-note templates`)
      } else {
        logDebug(pluginJson, `${timer(scriptLoad)} - of those, ${templates.length} are ${onlyMeetingNotes ? 'meeting-note' : 'non-ignore'} templates`)
      }

      logDebug(pluginJson, `${timer(scriptLoad)} - asking user to select from ${templates.length} ${onlyMeetingNotes ? 'meeting-note' : ''} templates ...`)
      const selectedTemplate =
        templates.length > 1
          ? await CommandBar.showOptions(
              templates.map((n) => n.title ?? 'Untitled Note'),
              'Select a template',
            )
          : { index: 0 }
      return templates[selectedTemplate.index].filename
    } else {
      logDebug(pluginJson, `Will use Template file '${templateFilename}'`)
    }
    return templateFilename
  } catch (error) {
    logError(pluginJson, `error in chooseTemplateIfNeeded: ${JSP(error)}`)
  }
}

/**
 * Check to see if an Event has already been selected, and if so, pass it back
 * If not, ask the user to select an event:
 * a) if they are on a calendar note, then select from the events on that day
 * b) if they are not on a calendar note, select from all the events on today's calendar
 * @param {TCalendarItem} selectedEvent - the event that has already been selected (optional)
 * @returns {Promise<TCalendarItem>} the selected event
 */
async function chooseEventIfNeeded(selectedEvent?: TCalendarItem | null): Promise<?TCalendarItem | null> {
  try {
    if (!selectedEvent) {
      let events = null

      logDebug(pluginJson, 'load available events for the given timeframe')
      if (Editor.type === 'Calendar') {
        const date = Editor.note?.date ?? new Date()
        events = await Calendar.eventsBetween(date, date)
      } else {
        events = await Calendar.eventsToday()
      }

      if (events?.length === 0) {
        logDebug(pluginJson, 'no events found')
        CommandBar.prompt('No events on the selected day, try another.', '')
        return
      }

      logDebug(pluginJson, 'show available events')
      const selectedEventValue = await CommandBar.showOptions(
        events.map((event) => event.title),
        'Select an event',
      )
      return events[selectedEventValue.index]
    }

    return selectedEvent
  } catch (error) {
    logError(pluginJson, `error in chooseEventIfNeeded: ${error}`)
    return null
  }
}

/**
 * Creates event data object (properties/methods) to be used as input for np.Templating to parse a template.
 * @param {TCalendarItem} selectedEvent
 * @returns {Object} data and methods for the template
 */
function generateEventData(selectedEvent: TCalendarItem): { data: Object, methods: Object } {
  if (!selectedEvent) {
    logError(pluginJson, 'generateEventData: no event provided')
    return { data: {}, methods: {} }
  }
  logDebug(pluginJson, `generateEventData populating event details for event titled: "${selectedEvent?.title}"`)
  return {
    data: {
      eventTitle: selectedEvent.title,
      eventNotes: selectedEvent.notes,
      eventLink: selectedEvent.url,
      calendarItemLink: selectedEvent.calendarItemLink,
      eventAttendees: selectedEvent && selectedEvent?.attendees?.length ? selectedEvent.attendees.join(', ') : '',
      eventAttendeeNames: selectedEvent && selectedEvent?.attendees?.length ? selectedEvent.attendeeNames.join(', ') : '',
      eventLocation: selectedEvent.location, // not yet documented!
      eventCalendar: selectedEvent.calendar,
      eventDateValue: selectedEvent.date,
      eventEndDateValue: selectedEvent.endDate,
    },
    methods: {
      // NOTE: functions cannot be passed via DataStore.invokePluginCommandByName(), so we will have to create these methods in np.Templating render pipeline
      // If you are looking for them, they are in restoreEventDateMethods() in np.Templating/lib/rendering/templateProcessor.js
      // eventDate: (format: string = 'YYYY MM DD') => {
      //   return moment(selectedEvent.date).format(`${format}`)
      // },
      // eventEndDate: (format: string = 'YYYY MM DD') => {
      //   return moment(selectedEvent.endDate).format(`${format}`)
      // },
    },
  }
}
