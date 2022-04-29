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

export async function insertNoteTemplate(templateFilename): Promise<void> {
  log(pluginJson, 'chooseTemplateIfNeeded')
  templateFilename = await chooseTemplateIfNeeded(templateFilename, false)

  let templateContent = DataStore.projectNoteByFilename(templateFilename).content
  const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(templateContent)

  const result = await NPTemplating.render(frontmatterBody, frontmatterAttributes)
  Editor.content = result
}

export async function newMeetingNote(selectedEvent, templateFilename): Promise<void> {
  log(pluginJson, 'chooseTemplateIfNeeded')
  templateFilename = await chooseTemplateIfNeeded(templateFilename, true)

  log(pluginJson, 'chooseEventIfNeeded')
  selectedEvent = await chooseEventIfNeeded(selectedEvent)

  log(pluginJson, 'generateTemplateData')
  let templateData = generateTemplateData(selectedEvent)

  try {
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

    if(newNoteTitle.length > 0) {
      result = "# " + newNoteTitle + "\n" + result
    }

    log(pluginJson, 'insert template')
    if(append || prepend) {
      await appendPrependNewNote(append, prepend, folder, result)
    } else {
      await newNoteWithFolder(result, folder, newNoteTitle)
    }

  } catch (error) {
    log(pluginJson, 'error: ' + error)
  }
}

async function appendPrependNewNote(append, prepend, folder, content) {
  let noteName = append || prepend

  let note = undefined
  if(noteName == "<select>") {
    let notes = DataStore.projectNotes.sort((a, b) => a.changedDate < b.changedDate)

    // If a folder was defined, filter down the options
    if(folder) {
      let filteredNotes = notes.filter(n => n.filename.startsWith(folder))
      if(filteredNotes.length > 0) { // If it's empty, show all notes
        notes = filteredNotes
      }
    }

    let selection = await CommandBar.showOptions(notes.map(n => n.title), "Select a note")
    note = notes[selection.index]
  } else if(noteName == "<current>") {
    note = Editor.note
  } else {
    // TODO: We don't know if its a title or a filename, so try first looking for a filename, then title
    let availableNotes = DataStore.projectNoteByTitle(noteName)
    note = availableNotes[0]

    if(folder) { // Look for the note in the defined folder
      let filteredNotes = availableNotes.filter(n => n.filename.startsWith(folder))
      if(filteredNotes.length > 0) {
        note = filteredNotes[0]
      }
    }
  }

  if(!note) {
    if(!folder) { folder = "" }

    let filename = DataStore.newNote(noteName, folder)
    if(filename) {
      note = DataStore.projectNoteByFilename(filename)
    }

    if(!note) {
      CommandBar.prompt("Could not find or create the note '" + noteName + "'")
    }
  }

  let originalContentLength = note.content.length

  if(append) {
    note.appendParagraph("\n\n" + content, "text")
  } else if(prepend) {
    note.prependParagraph(content + "\n\n", "text")
  }

  await Editor.openNoteByFilename(note.filename)

  // Scroll to the paragraph if we appended it
  if(append) {
    Editor.select(originalContentLength + 3, 0)
  }
}

async function newNoteWithFolder(content, folder) {
  if(folder == "<select>") {
    let folders = DataStore.folders
    let selection = await CommandBar.showOptions(folders, "Select a folder")
    folder = folders[selection.index]

  } else if(folder == "<current>") {
    let currentFilename = ""

    if(Editor.note) {
      currentFilename = Editor.note.filename.split("/")

      if(currentFilename.length > 1) {
        currentFilename.pop()
        folder = currentFilename.join("/")
      } else {
        folder = ""
      }
    } else {
      folder = NotePlan.selectedSidebarFolder
    }
  }

  let filename = DataStore.newNoteWithContent(content, folder)
  Editor.openNoteByFilename(filename)
}

async function chooseTemplateIfNeeded(templateFilename, onlyMeetingNotes) {
  if(!templateFilename) {
    let templates = DataStore.projectNotes
        .filter(n => n.filename.startsWith(NotePlan.environment.templateFolder))

    if(onlyMeetingNotes) {
      templates = templates.filter(n => fm(n.content)?.attributes.type == "meeting-note")
    } else {
      templates = templates.filter(n => fm(n.content)?.attributes.type != "meeting-note")
    }

    let selectedTemplate = await CommandBar.showOptions(templates.map(n => n.title), "Select a template")
    templateFilename = templates[selectedTemplate.index].filename
  }

  return templateFilename
}

async function chooseEventIfNeeded(selectedEvent) {
  if(!selectedEvent) {
    let events = undefined

    if(Editor.type == "Calendar") {
      let date = Editor.note.date
      events = await Calendar.eventsBetween(date, date)
    } else {
      events = await Calendar.eventsToday()
    }

    if(events.length == 0) {
      CommandBar.prompt("No events on the selected day, try another.")
      return
    }

    let selectedEventValue = await CommandBar.showOptions(events.map(event => event.title), "Select an event")
    selectedEvent = events[selectedEventValue.index]
  }

  return selectedEvent
}

function generateTemplateData(selectedEvent) {
  return {
    data: {
      eventTitle: selectedEvent.title,
      eventNotes: selectedEvent.notes,
      eventLink: selectedEvent.url,
      calendarItemLink: selectedEvent.calendarItemLink,
      eventAttendees: selectedEvent.attendees.join(", "),
      eventLocation: selectedEvent.location,
      eventCalendar: selectedEvent.calendar
    },
    methods: {
      eventDate: (format: string = 'YYYY MM DD') => {
        return moment(selectedEvent.date).format(`${format}`)
      },
      eventEndDate: (format: string = 'YYYY MM DD') => {
        return moment(selectedEvent.endDate).format(`${format}`)
      },
    }
  }
}
