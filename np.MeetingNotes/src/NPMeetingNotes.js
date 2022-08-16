// @flow

import moment from 'moment-business-days'
import fm from 'front-matter'

import pluginJson from '../plugin.json'
import { log, logDebug, logError } from '@helpers/dev'
import NPTemplating from 'NPTemplating'

/**
 * FIXME(Eduard): please document me!
 * @param {*} origFileName
 * @param {*} dailyNoteDate
 * @returns
 */
export async function insertNoteTemplate(origFileName: string, dailyNoteDate: Date): Promise<void> {
  logDebug(pluginJson, 'chooseTemplateIfNeeded')
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

  logDebug(pluginJson, 'preRender template')
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent)

  // const { frontmatterBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('preRender', 'np.Templating', [templateContent])

  logDebug(pluginJson, 'render template')
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
    Editor.content = result
  }
}

/**
 * FIXME(Eduard): please document me!
 * @param {*} _selectedEvent
 * @param {*} _templateFilename
 */
export async function newMeetingNote(_selectedEvent?: TCalendarItem, _templateFilename?: string): Promise<void> {
  logDebug(pluginJson, 'chooseTemplateIfNeeded')
  const templateFilename: ?string = await chooseTemplateIfNeeded(_templateFilename, true)

  logDebug(pluginJson, 'chooseEventIfNeeded')
  const selectedEvent = await chooseEventIfNeeded(_selectedEvent)

  try {
    logDebug(pluginJson, 'generateTemplateData')
    const templateData = generateTemplateData(selectedEvent)

    logDebug(pluginJson, 'get template content')
    const templateContent = DataStore.projectNoteByFilename(templateFilename).content

    logDebug(pluginJson, 'preRender template')
    const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent, templateData)
    
    // const { frontmatterBody, frontmatterAttributes } = await DataStore.invokePluginCommandByName('preRender', 'np.Templating', [templateContent, templateData])

    const attrs = frontmatterAttributes
    const folder = attrs?.folder || ''
    const append = attrs?.append || ''
    const prepend = attrs?.prepend || ''
    const newNoteTitle = attrs?.newNoteTitle || ''

    logDebug(pluginJson, 'render template')
    let result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)

    // let result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [frontmatterBody, frontmatterAttributes])

    if (newNoteTitle.length > 0) {
      result = `# ${newNoteTitle}\n${result}`
    }

    let newTitle = null
    if (append || prepend) {
      logDebug(pluginJson, 'append/prepend template')
      newTitle = (await appendPrependNewNote(append, prepend, folder, result)) ?? '<error>'
    } else {
      logError(pluginJson, 'create a new note with the rendered template')
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
 * @param {*} selectedEvent
 * @param {*} newTitle
 */
function writeNoteLinkIntoEvent(selectedEvent: TCalendarItem, newTitle: string): void {
  try {
    // Only add the link to events without attendees
    logDebug(pluginJson, 'writing event link into event notes.')

    if (newTitle && selectedEvent.attendees.length === 0 && selectedEvent.isCalendarWritable) {
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
 * @param {*} append
 * @param {*} prepend
 * @param {*} folder
 * @param {*} content
 * @returns
 */
async function appendPrependNewNote(append: string, prepend: string, folder: string = '', content: string): Promise<?string> {
  try {
    const noteName = append || prepend

    let note = undefined
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
      logDebug(pluginJson, 'use the current note')
      note = Editor.note
    } else {
      // TODO: We don't know if its a title or a filename, so try first looking for a filename, then title
      logDebug(pluginJson, 'find the note by title')
      const availableNotes = DataStore.projectNoteByTitle(noteName)
      note = availableNotes[0]

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
        note = DataStore.projectNoteByFilename(filename)
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
 * FIXME(Eduard): please document me!  Also I suggest you put a verb on the front of this function so its clearer what it is doing.
 * @param {*} content
 * @param {*} _folder
 * @returns
 */
async function newNoteWithFolder(content: string, _folder: string): Promise<?string> {
  let folder = _folder
  try {
    if (folder === '<select>') {
      logDebug(pluginJson, 'get all folders and show them for selection')
      const folders = DataStore.folders
      const selection = await CommandBar.showOptions(folders, 'Select a folder')
      folder = folders[selection.index]
    } else if (folder === '<current>') {
      logDebug(pluginJson, 'find the current folder of the opened note')
      let currentFilename = ''

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

/**
 * FIXME(Eduard): please document me!
 * @param {*} templateFilename
 * @param {*} onlyMeetingNotes
 * @returns
 */
async function chooseTemplateIfNeeded(templateFilename?: string, onlyMeetingNotes: boolean = false): Promise<?string> {
  try {
    if (!templateFilename) {
      logDebug(pluginJson, 'no template was defined, find all available templates and show them')
      let templates = DataStore.projectNotes.filter((n) => n.filename.startsWith(NotePlan.environment.templateFolder))

      logDebug(pluginJson, 'include/exlcude meeting notes')
      if (onlyMeetingNotes) {
        templates = templates.filter((n) => fm(n.content)?.attributes.type === 'meeting-note')
      } else {
        templates = templates.filter((n) => fm(n.content)?.attributes.type !== 'meeting-note')
      }

      logDebug(pluginJson, 'show template options')
      const selectedTemplate = await CommandBar.showOptions(
        templates.map((n) => n.title ?? 'Untitled Note'),
        'Select a template',
      )
      return templates[selectedTemplate.index].filename
    }

    return templateFilename
  } catch (error) {
    logDebug(pluginJson, `error in chooseTemplateIfNeeded: ${error}`)
  }
}

/**
 * FIXME(Eduard): please document me!
 * @param {*} selectedEvent
 * @returns
 */
async function chooseEventIfNeeded(selectedEvent?: TCalendarItem) {
  try {
    if (!selectedEvent) {
      let events = undefined

      logDebug(pluginJson, 'load available events for the given timeframe')
      if (Editor.type === 'Calendar') {
        const date = Editor.note?.date ?? new Date()
        events = await Calendar.eventsBetween(date, date)
      } else {
        events = await Calendar.eventsToday()
      }

      if (events.length === 0) {
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
  }
}

/**
 * FIXME(Eduard): please document me!
 * @param {*} selectedEvent
 * @returns
 */
function generateTemplateData(selectedEvent: TCalendarItem) {
  return {
    data: {
      eventTitle: selectedEvent.title,
      eventNotes: selectedEvent.notes,
      eventLink: selectedEvent.url,
      calendarItemLink: selectedEvent.calendarItemLink,
      eventAttendees: selectedEvent.attendees.join(', '),
      eventAttendeeNames: selectedEvent.attendeeNames.join(', '),
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
