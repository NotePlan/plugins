// @flow

import moment from 'moment-business-days'

import pluginJson from '../plugin.json'
import { log, logDebug, logError, clo, JSP } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import { getAttributes } from '@templatingModules/FrontmatterModule'
import NPTemplating from 'NPTemplating'

/**
 * FIXME(Eduard): please document me!
 * @param {string} origFileName
 * @param {Date} dailyNoteDate
 */
export async function insertNoteTemplate(origFileName: string, dailyNoteDate: Date): Promise<void> {
  logDebug(pluginJson, 'insertNoteTemplate')
  const templateFilename: ?string = await chooseTemplateIfNeeded(origFileName, false)
  if (!templateFilename) {
    return
  }

  logDebug(pluginJson, 'get content of template for rendering')
  let templateContent = DataStore.projectNoteByFilename(templateFilename)?.content

  if (!templateContent) {
    logError(pluginJson, `couldnt load content of template "${templateFilename}", try NPTemplating method`)
    templateContent = await NPTemplating.getTemplate(templateFilename)
    //
    // templateContent = await DataStore.invokePluginCommandByName('getTemplate', 'np.Templating', [templateFilename])
    return
  }

  logDebug(pluginJson, 'preRender() template')
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent)

  // const { frontmatterBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('preRender', 'np.Templating', [templateContent])

  logDebug(pluginJson, 'render() template')
  const result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)

  // const result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [frontmatterBody, frontmatterAttributes])

  if (dailyNoteDate) {
    logDebug(pluginJson, `apply rendered template to daily note with date ${String(dailyNoteDate)}`)
    const note = DataStore.calendarNoteByDate(dailyNoteDate)
    if (note) {
      note.content = result
    }
  } else {
    logDebug(pluginJson, 'apply rendered template to the current editor')
    // Editor.content = result
    Editor.insertTextAtCursor(result)
  }
}

/**
 * Get a calendar event from ID and pass it to newMeetingNote
 * @param {string} eventID
 * @param {string} template
 */
export async function newMeetingNoteFromID(eventID: string, template?: string): Promise<void> {
  logDebug(pluginJson, `newMeetingNoteFromID id:${eventID} template:${String(template)}`)
  const selectedEvent = await Calendar.eventByID(eventID)
  if (selectedEvent) {
    clo(selectedEvent, 'newMeetingNoteFromID: selectedEvent')
    await newMeetingNote(selectedEvent, template)
  }
}

/**
 * Create a meeting note for a calendar event
 * This function is called when the user right-clicks a calendar event and selects "New Meeting Note" (NP passes the CalendarItem to the function)
 * Can also be called via newMeetingNoteFromID() when it receives an x-callback-url (with or without arguments)
 * If arguments are not provided, the user will be prompted to select an event and a template
 * @param {TCalendarItem} _selectedEvent
 * @param {string?} _templateTitle
 */
export async function newMeetingNote(_selectedEvent?: TCalendarItem, _templateFilename?: string): Promise<void> {
  logDebug(pluginJson, 'newMeetingNote')
  const selectedEvent = await chooseEventIfNeeded(_selectedEvent)

  const templateFilename: ?string = await chooseTemplateIfNeededFromTemplateTitle(_templateFilename, true) //await chooseTemplateIfNeeded(_templateFilename, true)

  try {
    let templateData, templateContent
    if (selectedEvent) {
      logDebug(pluginJson, 'generateTemplateData')
      templateData = generateTemplateData(selectedEvent)
    }
    if (templateFilename) {
      templateContent = DataStore.projectNoteByFilename(templateFilename)?.content || ''
      // logDebug(pluginJson, `template content: <${templateContent}>`)
    }

    logDebug(pluginJson, 'preRender template')
    const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent, templateData)
    // JGC: TODO: why is this commented out? This looks the 'right' way to do it ...
    // const { frontmatterBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('preRender', 'np.Templating', [templateContent, templateData])
    // logDebug(pluginJson, `-> <${frontmatterBody}>`)

    const attrs = frontmatterAttributes
    const folder = attrs?.folder || ''
    const append = attrs?.append || ''
    const prepend = attrs?.prepend || ''
    const newNoteTitle = attrs?.newNoteTitle || ''

    logDebug(pluginJson, 'render template')
    let result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)
    // JGC: TODO: why is this commented out? This looks the 'right' way to do it ...
    // let result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [frontmatterBody, frontmatterAttributes])
    logDebug(pluginJson, `-> <${result}>`)

    if (newNoteTitle.length > 0) {
      result = `# ${newNoteTitle}\n${result}`
    }

    let newTitle = null
    if (append || prepend) {
      logDebug(pluginJson, 'append/prepend template')
      newTitle = (await appendPrependNewNote(append, prepend, folder, result)) ?? '<error>'
    } else {
      logDebug(pluginJson, 'create a new note with the rendered template')
      newTitle = (await newNoteWithFolder(result, folder)) ?? '<error>' // FIXME(Eduard): only 2 params allowed
    }

    logDebug(pluginJson, 'write the note-link into the event')
    if (selectedEvent) {
      writeNoteLinkIntoEvent(selectedEvent, newTitle)
    }
  } catch (error) {
    logError(pluginJson, `error in newMeetingNote: ${error}`)
  }
}

/**
 * FIXME(Eduard): please document me!
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
 * FIXME(Eduard): please document me!
 * @param {string} append
 * @param {string} prepend
 * @param {string?} folder
 * @param {string} content
 * @returns {Promise<string?>} title (or null)
 */
async function appendPrependNewNote(append: string, prepend: string, folder: string = '', content: string): Promise<?string> {
  try {
    const noteName = append || prepend

    let note: CoreNoteFields
    if (noteName === '<select>') {
      logDebug(pluginJson, 'load project notes (sorted) to display for selection')
      let notes = [...DataStore.projectNotes].sort((a, b) => (a.changedDate < b.changedDate ? 1 : -1))

      // If a folder was defined, filter down the options
      if (folder) {
        logDebug(pluginJson, 'a folder was defined, so filter the available notes')
        const filteredNotes = notes.filter((n) => n.filename.startsWith(folder))
        if (filteredNotes.length > 0) {
          // If it's empty, show all notes
          notes = filteredNotes
        }
      }

      logDebug(pluginJson, 'display notes for selection')
      const selection = await CommandBar.showOptions(
        notes.map((n) => n.title ?? 'Untitled Note'),
        'Select a note',
      )
      note = notes[selection.index]
    } else if (noteName === '<current>') {
      logDebug(pluginJson, 'use the current note (Editor)')
      if (Editor.note) {
        note = Editor.note
      } else {
        logError(pluginJson, 'want to use <current> note, but no note is open in the editor')
        throw new Error('There is no note open in the editor, so cannot apply the Template')
      }
    } else {
      // TODO: We don't know if its a title or a filename, so try first looking for a filename, then title
      logDebug(pluginJson, 'find the note by title')
      const availableNotes = DataStore.projectNoteByTitle(noteName)
      if (availableNotes && availableNotes.length > 0) {
        note = availableNotes[0]
      }

      if (folder) {
        // Look for the note in the defined folder
        logDebug(pluginJson, 'a folder was defined, check for the note there first')
        const filteredNotes = availableNotes?.filter((n) => n.filename.startsWith(folder)) ?? []
        if (filteredNotes.length > 0) {
          note = filteredNotes[0]
        }
      }
    }

    if (!note) {
      logDebug(pluginJson, 'note not found, create a new one')

      const filename = DataStore.newNote(noteName, folder)
      if (filename) {
        logDebug(pluginJson, 'note created, now get the Note object')
        if (DataStore.projectNoteByFilename(filename)) {
          // $FlowIgnore[incompatible-type]
          note = DataStore.projectNoteByFilename(filename)
        } else {
          logError(pluginJson, `can't find project note '${filename}' so stopping`)
          throw new Error(`can't find project note '${filename}' so stopping`)
        }
      }

      if (!note) {
        CommandBar.prompt(`Could not find or create the note '${noteName}'`, '')
        return null
      }
    }

    const originalContentLength = note.content?.length ?? 0

    if (append) {
      logDebug(pluginJson, 'append the template')
      note.appendParagraph(content, 'text')
    } else if (prepend) {
      logDebug(pluginJson, 'prepend the template')
      note.prependParagraph(content, 'text')
    }

    logDebug(pluginJson, 'open the note')
    await Editor.openNoteByFilename(note.filename)

    // Scroll to the paragraph if we appended it
    if (append) {
      logDebug(pluginJson, 'scroll down to the appended template text')
      Editor.select(originalContentLength + 3, 0)
    }

    return note.title
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
      const folders = DataStore.folders
      const selection = await CommandBar.showOptions(folders, 'Select a folder')
      folder = folders[selection.index]
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
  logDebug(pluginJson, `chooseTemplateIfNeededFromTemplateTitle starting`)
  if (templateTitle) {
    const matchingTemplates = DataStore.projectNotes.filter((n) => n.title === templateTitle)
    logDebug(pluginJson, `- got ${matchingTemplates.length} template matches from '${templateTitle}'`)
    if (matchingTemplates && matchingTemplates.length > 0) {
      return await chooseTemplateIfNeeded(matchingTemplates[0].filename, onlyMeetingNotes)
    } else {
      return await chooseTemplateIfNeeded(templateTitle, onlyMeetingNotes)
    }
  }
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
  try {
    if (!templateFilename) {
      logDebug(pluginJson, `no template was defined, find all available templates and show them`)
      const allTemplates = DataStore.projectNotes.filter((n) => n.filename.startsWith(NotePlan.environment.templateFolder))

      if (!allTemplates || allTemplates.length === 0) {
        await showMessage(`Couldn't find any templates in the template folder (${NotePlan.environment.templateFolder})})`)
        throw new Error(`Couldn't find any templates`)
      } else {
        logDebug(pluginJson, `${allTemplates.length} templates found`)
      }

      const templates = []
      for (const template of allTemplates) {
        try {
          const attributes = getAttributes(template.content)
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
        logDebug(pluginJson, `of those, ${templates.length} are ${onlyMeetingNotes ? 'meeting-note' : 'non-ignore'} templates`)
      }

      logDebug(pluginJson, `asking user to select from ${templates.length} ${onlyMeetingNotes ? 'meeting-note' : ''} templates ...`)
      const selectedTemplate =
        templates.length > 1
          ? await CommandBar.showOptions(
              templates.map((n) => n.title ?? 'Untitled Note'),
              'Select a template',
            )
          : { index: 0 }
      return templates[selectedTemplate.index].filename
    } else {
      logDebug(pluginJson, `will use Template file '${templateFilename}' ...`)
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
async function chooseEventIfNeeded(selectedEvent?: TCalendarItem): Promise<?TCalendarItem | null> {
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
 * FIXME(Eduard): please document me!
 * @param {TCalendarItem} selectedEvent
 */
function generateTemplateData(selectedEvent: TCalendarItem) {
  logDebug(pluginJson, `generateTemplateData running for event titled: "${selectedEvent.title}"`)
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
    },
    methods: {
      eventDate: (format: string = 'YYYY MM DD') => {
        return moment(selectedEvent.date).format(`${format}`)
      },
      eventEndDate: (format: string = 'YYYY MM DD') => {
        return moment(selectedEvent.endDate).format(`${format}`)
      },
    },
  }
}
