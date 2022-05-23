// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

import helloWorldUtils from './support/hello-world'
import NPTemplating from 'NPTemplating'
import moment from 'moment-business-days'
import fm from 'front-matter'

import { log } from '@helpers/dev'
import pluginJson from '../plugin.json'

export async function insertNoteTemplate(origFileName, dailyNoteDate): Promise<void> {
  log(pluginJson, 'chooseTemplateIfNeeded')
  const templateFilename = await chooseTemplateIfNeeded(origFileName, false)
  
  log(pluginJson, 'get content of template for rendering')
  const templateContent = DataStore.projectNoteByFilename(templateFilename)?.content

  if(!templateContent) {
    log(pluginJson, 'couldnt load content of template "' + templateFilename + '", try NPTemplating method')
    templateContent = await NPTemplating.getTemplate(templateFilename)
    return
  }

  log(pluginJson, 'preRender template')
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent)

  log(pluginJson, 'render template')
  const result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)

  if(dailyNoteDate) {
    log(pluginJson, 'apply rendered template to daily note with date ' + dailyNoteDate)
    let note = DataStore.calendarNoteByDate(dailyNoteDate)
    note.content = result
  } else {
    log(pluginJson, 'apply rendered template to the current editor')
    Editor.content = result
  }
}

export async function newMeetingNote(selectedEvent, templateFilename: string): Promise<void> {
  log(pluginJson, 'chooseTemplateIfNeeded')
  templateFilename = await chooseTemplateIfNeeded(templateFilename, true)

  log(pluginJson, 'chooseEventIfNeeded')
  selectedEvent = await chooseEventIfNeeded(selectedEvent)

  try {
    log(pluginJson, 'generateTemplateData')
    let templateData = generateTemplateData(selectedEvent)

    log(pluginJson, 'get template content')
    let templateContent = DataStore.projectNoteByFilename(templateFilename).content

    log(pluginJson, 'preRender template')
    const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent, templateData)

    let attrs = frontmatterAttributes
    let folder = attrs?.folder || ''
    let append = attrs?.append || ''
    let prepend = attrs?.prepend || ''
    let newNoteTitle = attrs?.newNoteTitle || ''

    log(pluginJson, 'render template')
    let result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)

    if (newNoteTitle.length > 0) {
      result = '# ' + newNoteTitle + '\n' + result
    }

    let newTitle = null
    if(append || prepend) {
      log(pluginJson, 'append/prepend template')
      newTitle = await appendPrependNewNote(append, prepend, folder, result)
    } else {
      log(pluginJson, 'create a new note with the rendered template')
      newTitle = await newNoteWithFolder(result, folder, newNoteTitle)
    }

    log(pluginJson, 'write the note-link into the event')
    writeNoteLinkIntoEvent(selectedEvent, newTitle)

  } catch (error) {
    log(pluginJson, 'error in newMeetingNote: ' + error)
  }
}

function writeNoteLinkIntoEvent(selectedEvent, newTitle) {
  try {
    // Only add the link to events without attendees
    log(pluginJson, 'writing event link into event notes.')

    if(newTitle && selectedEvent.attendees.length == 0 && selectedEvent.isCalendarWritable) {
      let noteLink = "noteplan://x-callback-url/openNote?noteTitle=" + encodeURIComponent(newTitle)
      let eventNotes = selectedEvent.notes
      if(eventNotes.length > 0) {
        noteLink = "\n" + noteLink
      }

      selectedEvent.notes = eventNotes + noteLink

      log(pluginJson, 'update the event')
      Calendar.update(selectedEvent)
    } else {
      log(pluginJson, 'note link not written to event because it contains attendees (' + selectedEvent.attendees.length + ') or calendar doesnt allow content changes.')
    }
  } catch (error) {
    log(pluginJson, 'error in writeNoteLinkIntoEvent: ' + error)
  }
}

async function appendPrependNewNote(append, prepend, folder, content) {
  try {
    let noteName = append || prepend

    let note = undefined
    if (noteName == '<select>') {
      log(pluginJson, 'load project notes (sorted) to display for selection')
      let notes = DataStore.projectNotes.sort((a, b) => a.changedDate < b.changedDate)

      // If a folder was defined, filter down the options
      if (folder) {
        log(pluginJson, 'a folder was defined, so filter the available notes')
        let filteredNotes = notes.filter((n) => n.filename.startsWith(folder))
        if (filteredNotes.length > 0) {
          // If it's empty, show all notes
          notes = filteredNotes
        }
      }

      log(pluginJson, 'display notes for selection')
      let selection = await CommandBar.showOptions(
        notes.map((n) => n.title),
        'Select a note',
      )
      note = notes[selection.index]
    } else if (noteName == '<current>') {
      log(pluginJson, 'use the current note')
      note = Editor.note
    } else {
      // TODO: We don't know if its a title or a filename, so try first looking for a filename, then title
      log(pluginJson, 'find the note by title')
      let availableNotes = DataStore.projectNoteByTitle(noteName)
      note = availableNotes[0]

      if (folder) {
        // Look for the note in the defined folder
        log(pluginJson, 'a folder was defined, check for the note there first')
        let filteredNotes = availableNotes.filter((n) => n.filename.startsWith(folder))
        if (filteredNotes.length > 0) {
          note = filteredNotes[0]
        }
      }
    }

    if (!note) {
      log(pluginJson, 'note not found, create a new one')

      if (!folder) {
        folder = ''
      }

      let filename = DataStore.newNote(noteName, folder)
      if (filename) {
        log(pluginJson, 'note created, now get the Note object')
        note = DataStore.projectNoteByFilename(filename)
      }

      if (!note) {
        CommandBar.prompt("Could not find or create the note '" + noteName + "'")
        return null
      }
    }

    let originalContentLength = note.content.length

    if(append) {
      log(pluginJson, 'append the template')
      note.appendParagraph(content, "text")
    } else if(prepend) {
      log(pluginJson, 'prepend the template')
      note.prependParagraph(content, "text")
    }

    log(pluginJson, 'open the note')
    await Editor.openNoteByFilename(note.filename)

    // Scroll to the paragraph if we appended it
    if (append) {
      log(pluginJson, 'scroll down to the appended template text')
      Editor.select(originalContentLength + 3, 0)
    }

    return note.title

  } catch (error) {
    log(pluginJson, 'error in appendPrependNewNote: ' + error)
  }
}

async function newNoteWithFolder(content, folder) {
  try {
    if (folder == '<select>') {
      log(pluginJson, 'get all folders and show them for selection')
      let folders = DataStore.folders
      let selection = await CommandBar.showOptions(folders, 'Select a folder')
      folder = folders[selection.index]

    } else if (folder == '<current>') {
      log(pluginJson, 'find the current folder of the opened note')
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
        log(pluginJson, 'choose the folder which is selected in the sidebar')
        folder = NotePlan.selectedSidebarFolder
      }
    }

    log(pluginJson, 'create a new note')
    let filename = DataStore.newNoteWithContent(content, folder)

    log(pluginJson, 'open the created note')
    Editor.openNoteByFilename(filename)

    log(pluginJson, 'find the note and return the title')
    let note = DataStore.projectNoteByFilename(filename)
    if(note) { return note.title }
    return null

  } catch (error) {
    log(pluginJson, 'error in newNoteWithFolder: ' + error)
  }
}

async function chooseTemplateIfNeeded(templateFilename, onlyMeetingNotes) {
  try {
    if (!templateFilename) {
      log(pluginJson, 'no template was defined, find all available templates and show them')
      let templates = DataStore.projectNotes.filter((n) => n.filename.startsWith(NotePlan.environment.templateFolder))

      log(pluginJson, 'include/exlcude meeting notes')
      if (onlyMeetingNotes) {
        templates = templates.filter((n) => fm(n.content)?.attributes.type == 'meeting-note')
      } else {
        templates = templates.filter((n) => fm(n.content)?.attributes.type != 'meeting-note')
      }

      log(pluginJson, 'show template options')
      let selectedTemplate = await CommandBar.showOptions(
        templates.map((n) => n.title),
        'Select a template',
      )
      templateFilename = templates[selectedTemplate.index].filename
    }

    return templateFilename
  } catch (error) {
    log(pluginJson, 'error in chooseTemplateIfNeeded: ' + error)
  }
}

async function chooseEventIfNeeded(selectedEvent) {
  try {
    if (!selectedEvent) {
      let events = undefined

      log(pluginJson, 'load available events for the given timeframe')
      if (Editor.type == 'Calendar') {
        let date = Editor.note.date
        events = await Calendar.eventsBetween(date, date)
      } else {
        events = await Calendar.eventsToday()
      }

      if (events.length == 0) {
        log(pluginJson, 'no events found')
        CommandBar.prompt('No events on the selected day, try another.')
        return
      }

      log(pluginJson, 'show available events')
      let selectedEventValue = await CommandBar.showOptions(
        events.map((event) => event.title),
        'Select an event',
      )
      selectedEvent = events[selectedEventValue.index]
    }

    return selectedEvent
  } catch (error) {
    log(pluginJson, 'error in chooseEventIfNeeded: ' + error)
  }
}

function generateTemplateData(selectedEvent) {
  return {
    data: {
      eventTitle: selectedEvent.title,
      eventNotes: selectedEvent.notes,
      eventLink: selectedEvent.url,
      calendarItemLink: selectedEvent.calendarItemLink,
      eventAttendees: selectedEvent.attendees.join(', '),
      eventAttendeeNames: selectedEvent.attendeeNames.join(', '),
      eventLocation: selectedEvent.location,
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
