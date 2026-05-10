// @flow
// Granola Sync for NotePlan v2.1.0
// Syncs Granola AI meeting notes into NotePlan

import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, JSP } from '@helpers/dev'

// =============================================================================
// SETTINGS HELPERS
// =============================================================================

const DEFAULTS = {
  granolaAccessToken: '',
  syncFolder: 'Granola',
  filenameTemplate: '{created_date}_{title}',
  dateFormat: 'YYYY-MM-DD',
  documentSyncLimit: '100',
  skipExistingNotes: true,
  includeMyNotes: true,
  includeEnhancedNotes: true,
  includeTranscript: false,
  includeAttendeeTags: false,
  excludeMyName: '',
  attendeeTagTemplate: 'person/{name}',
  includeGranolaUrl: false,
  enableGranolaFolders: false,
  enableDailyNoteIntegration: true,
  dailyNoteSectionName: '## Granola Meetings',
  enableWeeklyNoteIntegration: false,
  weeklyNoteSectionName: '## Granola Meetings',
  enableMonthlyNoteIntegration: false,
  monthlyNoteSectionName: '## Granola Meetings',
}

const BOOL_KEYS = [
  'skipExistingNotes', 'includeMyNotes', 'includeEnhancedNotes',
  'includeTranscript', 'includeAttendeeTags', 'enableGranolaFolders',
  'enableDailyNoteIntegration', 'includeGranolaUrl',
  'enableWeeklyNoteIntegration', 'enableMonthlyNoteIntegration',
]

function getSettings(): any {
  const raw = DataStore.settings || {}
  const s = {}
  const keys = Object.keys(DEFAULTS)
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]
    let val = raw[key] !== undefined && raw[key] !== null ? raw[key] : DEFAULTS[key]
    if (BOOL_KEYS.indexOf(key) !== -1) {
      val = val === true || val === 'true'
    }
    s[key] = val
  }
  return s
}

// =============================================================================
// API LAYER
// =============================================================================

function loadToken(): ?string {
  const s = getSettings()
  const token = (s.granolaAccessToken || '').trim()
  if (!token) {
    logWarn(pluginJson, 'No access token configured. Add it in plugin settings.')
    return null
  }
  return token
}

async function fetchApi(url: string, token: string, body: any): Promise<any> {
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'User-Agent': 'Granola/5.354.0',
    'X-Client-Version': '5.354.0',
  }

  let text
  try {
    text = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    })
  } catch (e) {
    logError(pluginJson, 'Fetch failed for ' + url + ': ' + e)
    return null
  }

  if (!text || typeof text !== 'string') {
    logError(pluginJson, 'Empty response from ' + url)
    return null
  }

  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    logError(pluginJson, 'Failed to parse API response from ' + url)
    return null
  }

  if (data.message) {
    logError(pluginJson, 'API error from ' + url + ': ' + data.message)
    return null
  }

  return data
}

async function fetchDocuments(token: string, limit: ?number): Promise<any> {
  const allDocs = []
  let offset = 0
  const batchSize = 100
  let hasMore = true
  const maxDocs = limit || Number.MAX_SAFE_INTEGER

  while (hasMore && allDocs.length < maxDocs) {
    const data = await fetchApi('https://api.granola.ai/v2/get-documents', token, {
      limit: batchSize,
      offset: offset,
      include_last_viewed_panel: true,
      include_panels: true,
    })

    if (!data || !data.docs) {
      return allDocs.length > 0 ? allDocs : null
    }

    allDocs.push(...data.docs)

    if (data.docs.length < batchSize) {
      hasMore = false
    } else {
      offset += batchSize
    }
  }

  if (allDocs.length > maxDocs) {
    allDocs.length = maxDocs
  }

  return allDocs
}

async function fetchFolders(token: string): Promise<any> {
  const data = await fetchApi('https://api.granola.ai/v1/get-document-lists-metadata', token, {
    include_document_ids: true,
    include_only_joined_lists: false,
  })

  if (!data || !data.lists) return null
  return Object.values(data.lists)
}

async function fetchTranscript(token: string, docId: string): Promise<any> {
  const data = await fetchApi('https://api.granola.ai/v1/get-document-transcript', token, {
    document_id: docId,
  })
  if (!data) return null
  // API returns { segments: [...] } — extract the array
  return data.segments || data
}

// =============================================================================
// CONTENT CONVERSION
// =============================================================================

function convertProseMirrorToMarkdown(content: any): string {
  if (!content || typeof content !== 'object' || !Array.isArray(content.content)) {
    return ''
  }

  function processNode(node, indentLevel) {
    if (!node || typeof node !== 'object') return ''

    const type = node.type || ''
    const children = node.content || []
    const text = node.text || ''

    switch (type) {
      case 'heading': {
        const level = (node.attrs && node.attrs.level) || 1
        const inner = children.map(function(c) { return processNode(c, indentLevel) }).join('')
        return '#'.repeat(level) + ' ' + inner + '\n\n'
      }
      case 'paragraph': {
        const inner = children.map(function(c) { return processNode(c, indentLevel) }).join('')
        return inner + '\n\n'
      }
      case 'bulletList': {
        const items = []
        for (let i = 0; i < children.length; i++) {
          if (children[i].type === 'listItem') {
            const item = processListItem(children[i], indentLevel, false, 0)
            if (item) items.push(item)
          }
        }
        return items.join('\n') + '\n\n'
      }
      case 'orderedList': {
        const items = []
        let num = 1
        for (let i = 0; i < children.length; i++) {
          if (children[i].type === 'listItem') {
            const item = processListItem(children[i], indentLevel, true, num)
            if (item) {
              items.push(item)
              num++
            }
          }
        }
        return items.join('\n') + '\n\n'
      }
      case 'blockquote': {
        const inner = children.map(function(c) { return processNode(c, indentLevel) }).join('').trim()
        const quoted = inner.split('\n').map(function(line) {
          return line.trim() ? '> ' + line : '>'
        }).join('\n')
        return quoted + '\n\n'
      }
      case 'codeBlock': {
        const lang = (node.attrs && node.attrs.language) || ''
        const code = children.map(function(c) { return c.type === 'text' ? (c.text || '') : '' }).join('')
        return '```' + lang + '\n' + code + '\n```\n\n'
      }
      case 'hardBreak':
        return '\n'
      case 'text': {
        let result = text
        if (node.marks && node.marks.length > 0) {
          for (let m = node.marks.length - 1; m >= 0; m--) {
            const mark = node.marks[m]
            if (mark.type === 'bold') {
              result = '**' + result + '**'
            } else if (mark.type === 'italic') {
              result = '*' + result + '*'
            } else if (mark.type === 'code') {
              result = '`' + result + '`'
            } else if (mark.type === 'link' && mark.attrs && mark.attrs.href) {
              result = '[' + result + '](' + mark.attrs.href + ')'
            }
          }
        }
        return result
      }
      default:
        return children.map(function(c) { return processNode(c, indentLevel) }).join('')
    }
  }

  function processListItem(item, indentLevel, ordered, num) {
    if (!item || !item.content) return ''

    const indent = '  '.repeat(indentLevel)
    let mainText = ''
    let nested = ''

    for (let i = 0; i < item.content.length; i++) {
      const child = item.content[i]
      if (child.type === 'paragraph') {
        const para = (child.content || []).map(function(c) { return processNode(c, indentLevel) }).join('').trim()
        if (para) mainText += para
      } else if (child.type === 'bulletList') {
        const nestedItems = []
        for (let j = 0; j < (child.content || []).length; j++) {
          const ni = child.content[j]
          if (ni.type === 'listItem') {
            const processed = processListItem(ni, indentLevel + 1, false, 0)
            if (processed) nestedItems.push(processed)
          }
        }
        if (nestedItems.length > 0) nested += '\n' + nestedItems.join('\n')
      } else if (child.type === 'orderedList') {
        const nestedItems = []
        let nestedNum = 1
        for (let j = 0; j < (child.content || []).length; j++) {
          const ni = child.content[j]
          if (ni.type === 'listItem') {
            const processed = processListItem(ni, indentLevel + 1, true, nestedNum)
            if (processed) {
              nestedItems.push(processed)
              nestedNum++
            }
          }
        }
        if (nestedItems.length > 0) nested += '\n' + nestedItems.join('\n')
      } else {
        const other = processNode(child, indentLevel)
        if (other.trim()) mainText += (mainText ? '\n' : '') + other.trim()
      }
    }

    if (!mainText.trim()) return ''

    const bullet = ordered ? indent + num + '. ' + mainText : indent + '- ' + mainText
    return bullet + nested
  }

  return processNode(content, 0).trim()
}

function formatDate(dateStr: string, format: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace(/YYYY/g, year)
    .replace(/YY/g, String(year).slice(-2))
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
}

function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(function(v) { return String(v).padStart(2, '0') })
    .join(':')
}

function getSpeakerLabel(source: string): string {
  return source === 'microphone' ? 'Me' : 'Them'
}

function transcriptToMarkdown(segments: any): ?string {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return null
  }

  const sorted = segments.slice().sort(function(a, b) {
    return new Date(a.start_timestamp || 0) - new Date(b.start_timestamp || 0)
  })

  const lines = []
  let currentSpeaker = null
  let currentText = ''
  let currentTimestamp = null

  function flush() {
    const clean = currentText.trim().replace(/\s+/g, ' ')
    if (clean && currentSpeaker) {
      const time = formatTimestamp(currentTimestamp)
      const label = getSpeakerLabel(currentSpeaker)
      lines.push('**' + label + '** *(' + time + ')*: ' + clean)
    }
    currentText = ''
    currentSpeaker = null
    currentTimestamp = null
  }

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]
    if (currentSpeaker && currentSpeaker !== seg.source) {
      flush()
    }
    if (!currentSpeaker) {
      currentSpeaker = seg.source
      currentTimestamp = seg.start_timestamp
    }
    if (seg.text && seg.text.trim()) {
      currentText += currentText ? ' ' + seg.text : seg.text
    }
  }
  flush()

  return lines.length === 0 ? null : lines.join('\n\n')
}

// =============================================================================
// NOTE BUILDING
// =============================================================================

function extractPanelContent(doc: any, panelType: string): any {
  // Check panels array first
  if (doc.panels && Array.isArray(doc.panels)) {
    for (let i = 0; i < doc.panels.length; i++) {
      const panel = doc.panels[i]
      if (panel.type === panelType && panel.content && panel.content.type === 'doc') {
        return panel.content
      }
    }
  }

  // Fallback for enhanced_notes: check last_viewed_panel
  if (panelType === 'enhanced_notes' && doc.last_viewed_panel &&
      doc.last_viewed_panel.content && doc.last_viewed_panel.content.type === 'doc') {
    return doc.last_viewed_panel.content
  }

  // Fallback for my_notes: check doc.content directly
  if (panelType === 'my_notes' && doc.content && doc.content.type === 'doc') {
    return doc.content
  }

  return null
}

function buildNoteContent(doc: any, settings: any, transcript: ?string, calendarMatch: any): string {
  const sections = []
  const title = (doc.title || 'Untitled Granola Note').replace(/[<>:"/\\|?*]/g, '').trim()

  sections.push('# ' + title)

  // Calendar event link
  if (calendarMatch && calendarMatch.calendarItemLink) {
    sections.push('\n[Calendar Event](' + calendarMatch.calendarItemLink + ')')
  }

  // My Notes
  if (settings.includeMyNotes) {
    const myNotesContent = extractPanelContent(doc, 'my_notes')
    if (myNotesContent) {
      const md = convertProseMirrorToMarkdown(myNotesContent)
      if (md && md.trim()) {
        sections.push('\n## My Notes\n\n' + md.trim())
      }
    }
  }

  // Enhanced Notes
  if (settings.includeEnhancedNotes) {
    const enhancedContent = extractPanelContent(doc, 'enhanced_notes')
    if (enhancedContent) {
      const md = convertProseMirrorToMarkdown(enhancedContent)
      if (md && md.trim()) {
        sections.push('\n## Enhanced Notes\n\n' + md.trim())
      }
    }
  }

  // Transcript
  if (settings.includeTranscript && transcript) {
    sections.push('\n## Transcript\n\n' + transcript)
  }

  // Attendee tags
  if (settings.includeAttendeeTags) {
    const tags = extractAttendees(doc, settings)
    if (tags) {
      sections.push('\n---\n' + tags)
    }
  }

  // Granola URL
  if (settings.includeGranolaUrl) {
    sections.push('\n[Open in Granola](https://notes.granola.ai/d/' + doc.id + ')')
  }

  // Granola ID tracking via HTML comment
  let meta = '\n<!-- granola_id: ' + doc.id + ' -->'
  if (doc.created_at) {
    meta += '\n<!-- granola_created_at: ' + doc.created_at + ' -->'
  }
  if (doc.updated_at) {
    meta += '\n<!-- granola_updated_at: ' + doc.updated_at + ' -->'
  }
  sections.push(meta)

  return sections.join('\n')
}

function generateFilename(doc: any, settings: any): string {
  const title = doc.title || 'Untitled Granola Note'
  const docId = doc.id || 'unknown'

  const createdDate = doc.created_at ? formatDate(doc.created_at, settings.dateFormat) : ''
  const updatedDate = doc.updated_at ? formatDate(doc.updated_at, settings.dateFormat) : ''
  const createdTime = doc.created_at ? formatDate(doc.created_at, 'HH-mm-ss') : ''
  const updatedTime = doc.updated_at ? formatDate(doc.updated_at, 'HH-mm-ss') : ''
  const createdDateTime = doc.created_at ? formatDate(doc.created_at, settings.dateFormat + '_HH-mm-ss') : ''
  const updatedDateTime = doc.updated_at ? formatDate(doc.updated_at, settings.dateFormat + '_HH-mm-ss') : ''

  let filename = settings.filenameTemplate
    .replace(/{title}/g, title)
    .replace(/{id}/g, docId)
    .replace(/{created_date}/g, createdDate)
    .replace(/{updated_date}/g, updatedDate)
    .replace(/{created_time}/g, createdTime)
    .replace(/{updated_time}/g, updatedTime)
    .replace(/{created_datetime}/g, createdDateTime)
    .replace(/{updated_datetime}/g, updatedDateTime)

  // Sanitise for filesystem
  filename = filename.replace(/[<>:"/\\|?*]/g, '')
  filename = filename.replace(/\s+/g, '_')

  return filename
}

function extractAttendees(doc: any, settings: any): ?string {
  const names = []
  const seen = {}

  function addName(name) {
    if (!name) return
    const key = name.toLowerCase().trim()
    if (seen[key]) return
    // Exclude user's own name
    if (settings.excludeMyName && key === settings.excludeMyName.toLowerCase().trim()) return
    seen[key] = true
    names.push(name.trim())
  }

  // Extract from people array
  if (doc.people && Array.isArray(doc.people)) {
    for (let i = 0; i < doc.people.length; i++) {
      const person = doc.people[i]
      if (person.name) {
        addName(person.name)
      } else if (person.display_name) {
        addName(person.display_name)
      } else if (person.details && person.details.person && person.details.person.name) {
        const pn = person.details.person.name
        addName(pn.fullName || (pn.givenName && pn.familyName ? pn.givenName + ' ' + pn.familyName : pn.givenName))
      } else if (person.email) {
        addName(person.email.split('@')[0].replace(/[._]/g, ' '))
      }
    }
  }

  // Extract from calendar event attendees
  if (doc.google_calendar_event && doc.google_calendar_event.attendees) {
    const attendees = doc.google_calendar_event.attendees
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i]
      if (a.displayName) {
        addName(a.displayName)
      } else if (a.email) {
        addName(a.email.split('@')[0].replace(/[._]/g, ' '))
      }
    }
  }

  if (names.length === 0) return null

  // Format as hashtags using configurable template
  const template = settings.attendeeTagTemplate || 'person/{name}'
  const tags = names.map(function(name) {
    const clean = name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
    return '#' + template.replace(/\{name\}/g, clean)
  })

  return tags.join(' ')
}

// =============================================================================
// NOTE MANAGEMENT
// =============================================================================

function findExistingNote(granolaId: string): any {
  const allNotes = DataStore.projectNotes || []
  const marker = '<!-- granola_id: ' + granolaId + ' -->'

  for (let i = 0; i < allNotes.length; i++) {
    const note = allNotes[i]
    const noteContent = note.content || ''
    if (noteContent.indexOf(marker) !== -1) {
      return note
    }
  }

  return null
}

function isNoteOutdated(note: any, doc: any): boolean {
  if (!doc.updated_at) return false

  const content = note.content || ''
  const match = content.match(/<!-- granola_updated_at: (.+?) -->/)
  if (!match) return true // No timestamp means it's outdated

  const existing = new Date(match[1])
  const incoming = new Date(doc.updated_at)
  return incoming > existing
}

function createOrUpdateNote(doc: any, content: string, settings: any, folderMap: any): any {
  let folder = settings.syncFolder

  // Use Granola folder structure if enabled
  if (settings.enableGranolaFolders && folderMap && folderMap[doc.id]) {
    const granolaFolder = folderMap[doc.id]
    if (granolaFolder.title) {
      const cleanFolder = granolaFolder.title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .trim()
      folder = folder + '/' + cleanFolder
    }
  }

  const filename = generateFilename(doc, settings)

  // Check for existing note
  const existing = findExistingNote(doc.id)

  if (existing) {
    if (settings.skipExistingNotes && !isNoteOutdated(existing, doc)) {
      return { action: 'skipped', filename: filename, folder: folder }
    }
    // Update existing note
    existing.content = content
    return { action: 'updated', filename: filename, folder: folder }
  }

  // Create new note using newNoteWithContent(content, folder, filename)
  const result = DataStore.newNoteWithContent(content, folder, filename)
  if (result) {
    return { action: 'created', filename: filename, folder: folder }
  }

  logError(pluginJson, 'Failed to create note: ' + filename)
  return null
}

// =============================================================================
// CALENDAR EVENT MATCHING
// =============================================================================

function matchCalendarEvent(doc: any, calendarEvents: any): any {
  if (!calendarEvents || !Array.isArray(calendarEvents) || calendarEvents.length === 0) return null
  if (!doc.google_calendar_event) return null

  const gcalEvent = doc.google_calendar_event
  const gcalTitle = (gcalEvent.summary || '').toLowerCase().trim()
  const gcalStart = gcalEvent.start && gcalEvent.start.dateTime ? new Date(gcalEvent.start.dateTime) : null

  if (!gcalTitle && !gcalStart) return null

  const TOLERANCE_MS = 5 * 60 * 1000 // 5 minutes

  for (let i = 0; i < calendarEvents.length; i++) {
    const event = calendarEvents[i]
    const eventTitle = (event.title || '').toLowerCase().trim()
    const eventDate = event.date ? new Date(event.date) : null

    // Match by title
    const titleMatch = gcalTitle && eventTitle && (gcalTitle === eventTitle || eventTitle.indexOf(gcalTitle) !== -1 || gcalTitle.indexOf(eventTitle) !== -1)

    // Match by start time (within tolerance)
    let timeMatch = false
    if (gcalStart && eventDate) {
      timeMatch = Math.abs(gcalStart.getTime() - eventDate.getTime()) <= TOLERANCE_MS
    }

    // Require title match + time match for confidence, or exact title match alone
    if (titleMatch && timeMatch) {
      return event
    }
    if (titleMatch && gcalTitle === eventTitle) {
      return event
    }
  }

  return null
}

// =============================================================================
// CALENDAR NOTE HELPERS
// =============================================================================

function replaceSectionInNote(note: any, sectionName: string, sectionContent: string): void {
  let content = note.content || ''

  // Escape section name for regex
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionRegex = new RegExp('^' + escaped, 'm')

  if (sectionRegex.test(content)) {
    // Replace existing section (up to next heading or end of string)
    const replaceRegex = new RegExp(escaped + '[\\s\\S]*?(?=\\n#{1,6}\\s|$)')
    content = content.replace(replaceRegex, sectionContent)
  } else {
    // Append section
    content += '\n\n' + sectionContent
  }

  note.content = content
}

function formatMeetingLine(note: any): string {
  const link = '[[' + note.filename + '|' + note.title + ']]'
  return '- ' + note.time + ' ' + link
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDayHeading(date: Date): string {
  return '### ' + DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTH_NAMES[date.getMonth()]
}

function buildGroupedByDayContent(notes: Array<any>, sectionName: string): string {
  // Sort by date then time
  notes.sort(function(a, b) {
    const dateComp = a.date.getTime() - b.date.getTime()
    if (dateComp !== 0) return dateComp
    return a.time.localeCompare(b.time)
  })

  // Group by day
  const days = []
  let currentDay = null
  let currentLines = []
  let currentDate = null

  for (let i = 0; i < notes.length; i++) {
    const dayStr = notes[i].date.toDateString()
    if (dayStr !== currentDay) {
      if (currentDay !== null) {
        days.push({ date: currentDate, lines: currentLines })
      }
      currentDay = dayStr
      currentDate = notes[i].date
      currentLines = []
    }
    currentLines.push(formatMeetingLine(notes[i]))
  }
  if (currentDay !== null) {
    days.push({ date: currentDate, lines: currentLines })
  }

  const parts = [sectionName]
  for (let d = 0; d < days.length; d++) {
    parts.push(formatDayHeading(days[d].date))
    parts.push(days[d].lines.join('\n'))
  }

  return parts.join('\n')
}

// =============================================================================
// DAILY NOTE
// =============================================================================

function updateDailyNote(todaysNotes: Array<any>, settings: any): void {
  if (!settings.enableDailyNoteIntegration || todaysNotes.length === 0) return

  let dailyNote
  try {
    dailyNote = DataStore.calendarNoteByDate(new Date(), 'day')
  } catch (e) {
    logWarn(pluginJson, 'Could not access daily note: ' + e.message)
    return
  }

  if (!dailyNote) {
    logDebug(pluginJson, 'No daily note found for today')
    return
  }

  const sectionName = settings.dailyNoteSectionName || '## Granola Meetings'

  // Sort by time
  todaysNotes.sort(function(a, b) { return a.time.localeCompare(b.time) })

  const meetingLines = todaysNotes.map(function(note) {
    return formatMeetingLine(note)
  }).join('\n')

  replaceSectionInNote(dailyNote, sectionName, sectionName + '\n' + meetingLines)
  log(pluginJson, 'Updated daily note with ' + todaysNotes.length + ' meeting(s)')
}

// =============================================================================
// WEEKLY NOTE
// =============================================================================

function updateWeeklyNote(thisWeeksNotes: Array<any>, settings: any): void {
  if (!settings.enableWeeklyNoteIntegration || thisWeeksNotes.length === 0) return

  let weeklyNote
  try {
    weeklyNote = DataStore.calendarNoteByDate(new Date(), 'week')
  } catch (e) {
    logWarn(pluginJson, 'Could not access weekly note: ' + e.message)
    return
  }

  if (!weeklyNote) {
    logDebug(pluginJson, 'No weekly note found')
    return
  }

  const sectionName = settings.weeklyNoteSectionName || '## Granola Meetings'
  const sectionContent = buildGroupedByDayContent(thisWeeksNotes, sectionName)

  replaceSectionInNote(weeklyNote, sectionName, sectionContent)
  log(pluginJson, 'Updated weekly note with ' + thisWeeksNotes.length + ' meeting(s)')
}

// =============================================================================
// MONTHLY NOTE
// =============================================================================

function updateMonthlyNote(thisMonthsNotes: Array<any>, settings: any): void {
  if (!settings.enableMonthlyNoteIntegration || thisMonthsNotes.length === 0) return

  let monthlyNote
  try {
    monthlyNote = DataStore.calendarNoteByDate(new Date(), 'month')
  } catch (e) {
    logWarn(pluginJson, 'Could not access monthly note: ' + e.message)
    return
  }

  if (!monthlyNote) {
    logDebug(pluginJson, 'No monthly note found')
    return
  }

  const sectionName = settings.monthlyNoteSectionName || '## Granola Meetings'
  const sectionContent = buildGroupedByDayContent(thisMonthsNotes, sectionName)

  replaceSectionInNote(monthlyNote, sectionName, sectionContent)
  log(pluginJson, 'Updated monthly note with ' + thisMonthsNotes.length + ' meeting(s)')
}

// =============================================================================
// SYNC COMMANDS
// =============================================================================

export async function syncGranolaNotes(): Promise<void> {
  await runSync(false)
}

export async function syncGranolaNotesAll(): Promise<void> {
  await runSync(true)
}

async function runSync(syncAll: boolean): Promise<void> {
  try {
    const settings = getSettings()
    const token = loadToken()
    if (!token) {
      await CommandBar.prompt('Granola Sync Error', 'No access token configured. Add your Granola token in plugin settings.')
      return
    }

    const limit = syncAll ? null : parseInt(settings.documentSyncLimit) || 100
    log(pluginJson, 'Starting sync' + (syncAll ? ' (all historical)' : ' (limit: ' + limit + ')') + '...')

    // Move heavy work to async thread so UI stays responsive
    await CommandBar.onAsyncThread()

    // Fetch documents
    CommandBar.showLoading(true, 'Fetching documents from Granola...')
    const documents = await fetchDocuments(token, limit)
    if (!documents) {
      CommandBar.showLoading(false)
      await CommandBar.onMainThread()
      await CommandBar.prompt('Granola Sync Error', 'Failed to fetch documents from Granola. Check your access token.')
      return
    }
    if (documents.length === 0) {
      CommandBar.showLoading(false)
      await CommandBar.onMainThread()
      await CommandBar.prompt('Granola Sync', 'No documents found in Granola.')
      return
    }

    logDebug(pluginJson, 'Fetched ' + documents.length + ' documents')

    // Fetch folders if needed
    let folderMap = null
    if (settings.enableGranolaFolders) {
      CommandBar.showLoading(true, 'Fetching Granola folders...')
      const folders = await fetchFolders(token)
      if (folders) {
        folderMap = {}
        for (let f = 0; f < folders.length; f++) {
          const folder = folders[f]
          if (folder.document_ids) {
            for (let d = 0; d < folder.document_ids.length; d++) {
              folderMap[folder.document_ids[d]] = folder
            }
          }
        }
      }
    }

    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const todaysNotes = []
    const thisWeeksNotes = []
    const thisMonthsNotes = []
    const now = new Date()
    const today = now.toDateString()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth()

    // Week bounds: find start (Monday) and end (Sunday) of current week
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(thisYear, now.getMonth(), now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Fetch calendar events for matching (on main thread)
    let calendarEvents = null
    try {
      await CommandBar.onMainThread()
      calendarEvents = await Calendar.eventsBetween(weekStart, weekEnd)
      await CommandBar.onAsyncThread()
    } catch (e) {
      logDebug(pluginJson, 'Could not fetch calendar events: ' + (e.message || e))
      try { await CommandBar.onAsyncThread() } catch (ignore) {}
    }

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      const progress = (i + 1) / documents.length
      CommandBar.showLoading(true, 'Processing ' + (i + 1) + '/' + documents.length + ': ' + (doc.title || 'Untitled'), progress)

      try {
        // Fetch transcript if enabled
        let transcript = null
        if (settings.includeTranscript) {
          const transcriptData = await fetchTranscript(token, doc.id)
          transcript = transcriptToMarkdown(transcriptData)
        }

        // Check if there's any content
        const hasMyNotes = settings.includeMyNotes && extractPanelContent(doc, 'my_notes')
        const hasEnhanced = settings.includeEnhancedNotes && extractPanelContent(doc, 'enhanced_notes')
        const hasTranscript = settings.includeTranscript && transcript

        if (!hasMyNotes && !hasEnhanced && !hasTranscript) {
          skipped++
          continue
        }

        // Determine meeting time: prefer calendar event start over doc.created_at
        let meetingTime
        if (doc.google_calendar_event && doc.google_calendar_event.start && doc.google_calendar_event.start.dateTime) {
          meetingTime = new Date(doc.google_calendar_event.start.dateTime)
        } else {
          meetingTime = new Date(doc.created_at)
        }

        // Match to a NotePlan calendar event
        const calendarMatch = matchCalendarEvent(doc, calendarEvents)

        const content = buildNoteContent(doc, settings, transcript, calendarMatch)

        // Return to main thread for DataStore operations
        await CommandBar.onMainThread()
        const result = createOrUpdateNote(doc, content, settings, folderMap)
        await CommandBar.onAsyncThread()

        if (!result) {
          failed++
          continue
        }

        if (result.action === 'created') created++
        else if (result.action === 'updated') updated++
        else if (result.action === 'skipped') skipped++

        // Collect notes for calendar note updates (include ALL synced docs, even skipped)
        const noteEntry = {
          title: doc.title || 'Untitled Granola Note',
          time: String(meetingTime.getHours()).padStart(2, '0') + ':' + String(meetingTime.getMinutes()).padStart(2, '0'),
          filename: result.filename,
          folder: result.folder,
          date: meetingTime,
        }

        // Daily: matches today
        if (meetingTime.toDateString() === today) {
          todaysNotes.push(noteEntry)
        }

        // Weekly: within current week bounds
        if (meetingTime >= weekStart && meetingTime <= weekEnd) {
          thisWeeksNotes.push(noteEntry)
        }

        // Monthly: same year and month
        if (meetingTime.getFullYear() === thisYear && meetingTime.getMonth() === thisMonth) {
          thisMonthsNotes.push(noteEntry)
        }
      } catch (err) {
        logError(pluginJson, 'Error processing "' + (doc.title || doc.id) + '": ' + (err.message || err))
        failed++
      }
    }

    CommandBar.showLoading(false)

    // Return to main thread for UI and DataStore operations
    await CommandBar.onMainThread()

    // Update calendar notes
    updateDailyNote(todaysNotes, settings)
    updateWeeklyNote(thisWeeksNotes, settings)
    updateMonthlyNote(thisMonthsNotes, settings)

    // Summary
    const parts = []
    if (created > 0) parts.push(created + ' created')
    if (updated > 0) parts.push(updated + ' updated')
    if (skipped > 0) parts.push(skipped + ' skipped')
    if (failed > 0) parts.push(failed + ' failed')
    const summary = parts.length > 0 ? parts.join(', ') : 'no changes'

    log(pluginJson, 'Sync complete — ' + summary)
    await CommandBar.prompt('Granola Sync Complete', summary)

  } catch (error) {
    CommandBar.showLoading(false)
    try { await CommandBar.onMainThread() } catch (e) { /* already on main */ }
    logError(pluginJson, 'Sync failed — ' + (error.message || error))
    await CommandBar.prompt('Granola Sync Error', 'Sync failed: ' + (error.message || error))
  }
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

export async function findGranolaDuplicates(): Promise<void> {
  const allNotes = DataStore.projectNotes || []
  const idMap = {}
  let duplicateCount = 0

  for (let i = 0; i < allNotes.length; i++) {
    const note = allNotes[i]
    const content = note.content || ''
    const match = content.match(/<!-- granola_id: (.+?) -->/)
    if (!match) continue

    const granolaId = match[1]
    if (!idMap[granolaId]) {
      idMap[granolaId] = []
    }
    idMap[granolaId].push(note.title || note.filename || 'Unknown')
  }

  const reportLines = []
  const keys = Object.keys(idMap)
  for (let k = 0; k < keys.length; k++) {
    const id = keys[k]
    if (idMap[id].length > 1) {
      duplicateCount++
      reportLines.push('Granola ID: ' + id)
      for (let n = 0; n < idMap[id].length; n++) {
        reportLines.push('  - ' + idMap[id][n])
      }
      reportLines.push('')
    }
  }

  if (duplicateCount === 0) {
    await CommandBar.prompt('Granola Sync', 'No duplicate Granola notes found.')
  } else {
    const settings = getSettings()
    let report = '# Granola Duplicate Notes Report\n\n'
    report += 'Found ' + duplicateCount + ' Granola IDs with multiple notes:\n\n'
    report += reportLines.join('\n')
    report += '\n<!-- Generated by Granola Sync -->'
    DataStore.newNoteWithContent(report, settings.syncFolder, 'Granola_Duplicates_Report')
    await CommandBar.prompt('Granola Sync', 'Found ' + duplicateCount + ' duplicate(s). Report created in ' + settings.syncFolder + ' folder.')
  }
}
