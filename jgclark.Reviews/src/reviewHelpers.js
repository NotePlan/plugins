// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// @jgclark
// Last updated 15.9.2022 for v0.8.0-betas, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from '../plugin.json'
import { checkString } from '@helpers/checkType'
import { daysBetween, getDateObjFromDateString, getDateFromUnhyphenatedDateString, includesScheduledFutureDate, relativeDateFromDate, relativeDateFromNumber, toISODateString, unhyphenateString } from '@helpers/dateTime'
import { calcOffsetDate } from '@helpers/NPDateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { getContentFromBrackets, getStringFromList } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import { showMessage } from '@helpers/userInput'

import { rgbToHex, redToGreenInterpolation, makeSVGPercentRing } from '@helpers/HTMLView'

//------------------------------
// Config setup

export type ReviewConfig = {
  outputStyle: string,
  folderToStore: string,
  foldersToIgnore: Array<string>,
  noteTypeTags: Array<string>,
  displayDates: boolean,
  displayProgress: boolean,
  displayOrder: string,
  displayGroupedByFolder: boolean,
  displayArchivedProjects: boolean,
  finishedListHeading: string,
  startMentionStr: string,
  completedMentionStr: string,
  cancelledMentionStr: string,
  dueMentionStr: string,
  reviewIntervalMentionStr: string,
  reviewedMentionStr: string,
  confirmNextReview: boolean,
}

/**
 * Get config settings using Config V2 system.
 * @author @jgclark
 * @return {ReviewConfig} object with configuration
 */
export async function getReviewSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getReviewSettings()`)
  try {
    // Get settings
    const v2Config: ReviewConfig = await DataStore.loadJSON('../jgclark.Reviews/settings.json')

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'Reviews' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    }
    // clo(v2Config, `Review settings:`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    DataStore.setPreference('startMentionStr', v2Config.startMentionStr)
    DataStore.setPreference('completedMentionStr', v2Config.completedMentionStr)
    DataStore.setPreference('cancelledMentionStr', v2Config.cancelledMentionStr)
    DataStore.setPreference('dueMentionStr', v2Config.dueMentionStr)
    DataStore.setPreference('reviewIntervalMentionStr', v2Config.reviewIntervalMentionStr)
    DataStore.setPreference('reviewedMentionStr', v2Config.reviewedMentionStr)

    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
    return
  }
}

//----------------------------------------------------------------

/**
 * Write the contents of a given preference to the log
 * @author @jgclark
 * @param {string} prefName
 */
export function logPreference(prefName: string): void {
  logDebug(pluginJson, `${prefName} contents:\n${checkString(DataStore.preference(prefName))}`)
}

/**
 * Calculate the next date to review, based on last review date and date interval.
 * If no last review date, then the answer is today's date.
 * @author @jgclark
 * @param {Date} lastReviewDate - JS Date
 * @param {string} interval - interval specified as nn[bdwmqy]
 * @return {Date} - JS Date
 */
export function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  // $FlowFixMe[incompatible-type]
  const reviewDate: Date = lastReviewDate != null ? calcOffsetDate(toISODateString(lastReviewDate), interval) : new Date() // today's date
  return reviewDate
}

/**
 * From an array of strings, return the first string that matches the
 * wanted parameterised @mention, or empty String.
 * @author @jgclark
 * @param {Array<string>} mentionList - list of strings to search
 * @param {string} mention - string to match (with a following '(' to indicate start of parameter)
 * @return {?Date} - JS Date version, if valid date found
 */
export function getParamMentionFromList(mentionList: $ReadOnlyArray<string>, mention: string): string {
  // logDebug(pluginJson, `getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

/**
 * Read lines in 'note' and return any lines that contain fields
 * (that start with 'fieldName' parameter before a colon with text after).
 * The matching is done case insensitively, and only in the active region of the note.
 * TODO: add check to see if the note uses frontmatter; if so, restrict to searching there?
 * @param {TNote} note
 * @param {string} fieldName
 * @returns {Array<string>}
 */
export function getFieldsFromNote(note: TNote, fieldName: string): Array<string> {
  const paras = note.paragraphs
  const endOfActive = findEndOfActivePartOfNote(note)
  const matchArr = []
  const RE = new RegExp(`^${fieldName}:\\s*(.+)`, 'i') // case-insensitive match at start of line
  for (const p of paras) {
    const matchRE = p.content.match(RE)
    if (matchRE && p.lineIndex < endOfActive) {
      matchArr.push(matchRE[1])
    }
  }
  // logDebug('getFieldsFromNote()', `Found ${matchArr.length} fields matching '${fieldName}'`)
  return matchArr
}

function mostRecentProgressLine(progressLines: Array<string>): string {
  // Default to returning first line
  let outputLine = progressLines[0]
  // Then check each line to see if its newer
  let lastDatePart = '1000-01-01' // earliest possible YYYY-MM-DD date
  for (const progressLine of progressLines) {
    const progressLineParts = progressLine.split(/[:@]/)
    if (progressLineParts.length >= 3) {
      const thisDatePart = progressLineParts[1]
      if (thisDatePart > lastDatePart) {
        outputLine = progressLine
        // logDebug('Project::mostRecentProgressLine', `Found latest datePart ${thisDatePart}`)
      }
      lastDatePart = thisDatePart
    }
  }
  return outputLine
}

//-----------------------------------------------------------------------------

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date,
 * number of closed, open & waiting for tasks.
 * 
 * @example To create a project instance for a note call 'const x = new Project(note)'
 * @author @jgclark
 */
export class Project {
  // Types for the class instance properties
  note: TNote
  metadataPara: TParagraph
  noteType: string // project, area, other
  title: string
  startDate: ?Date
  dueDate: ?Date
  dueDays: ?number
  reviewedDate: ?Date
  reviewInterval: ?string
  nextReviewDate: ?Date
  nextReviewDays: ?number
  completedDate: ?Date
  cancelledDate: ?Date
  finishedDays: ?number // either days until completed or cancelled
  isCompleted: boolean
  openTasks: number
  completedTasks: number
  waitingTasks: number
  futureTasks: number
  isArchived: boolean
  isActive: boolean
  isCancelled: boolean
  folder: string
  percentComplete: number = NaN
  lastProgressComment: string = '' // e.g. "Progress: 60@20220809: comment
  ID: string // required when making HTML views

  constructor(note: TNote) {
    this.ID = String(Math.round((Math.random()) * 99999)) // TODO: Make a one-up number
    const mentions: $ReadOnlyArray<string> = note.mentions
    const hashtags: $ReadOnlyArray<string> = note.hashtags
    this.note = note
    const mln = getOrMakeMetadataLine(note)
    this.metadataPara = note.paragraphs[mln]
    this.title = note.title ?? '(error)'
    logDebug(pluginJson, `new Project: ${this.title} with metadata in line ${this.metadataPara.lineIndex}`)
    this.folder = getFolderFromFilename(note.filename)

    // work out note review type: 'project' or 'area' or ''
    this.noteType = hashtags.includes('#project') ? 'project' : hashtags.includes('#area') ? 'area' : ''

    // read in various metadata fields (if present)
    // (now uses DataStore.preference mechanism to pick up current terms for @start, @due, @reviewed etc.)
    let tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('startMentionStr')))
    this.startDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
    // read in due date (if found)
    tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('dueMentionStr')))
    this.dueDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
    // read in reviewed date (if found)
    tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewedMentionStr')))
    this.reviewedDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
    // read in completed date (if found)
    tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('completedMentionStr')))
    this.completedDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
    // read in cancelled date (if found)
    tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('cancelledMentionStr')))
    this.cancelledDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
    // read in review interval (if found)
    const tempIntervalStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewIntervalMentionStr')))
    this.reviewInterval = tempIntervalStr !== '' ? getContentFromBrackets(tempIntervalStr) : undefined
    // calculate the durations from these dates
    this.calcDurations()

    // count tasks
    this.openTasks = note.paragraphs.filter((p) => p.type === 'open').length
    this.completedTasks = note.paragraphs.filter((p) => p.type === 'done').length
    this.waitingTasks = note.paragraphs.filter((p) => p.type === 'open').filter((p) => p.content.match('#waiting')).length
    this.futureTasks = note.paragraphs.filter((p) => p.type === 'open').filter((p) => includesScheduledFutureDate(p.content)).length
    // Track percentComplete: either through calculation from counts ...
    if (this.completedTasks > 0) {
      this.percentComplete = Math.round((this.completedTasks / (this.completedTasks + this.openTasks)) * 100)
      logDebug(pluginJson, `- ${this.title}: % complete = ${this.percentComplete}`)
    } else {
      this.percentComplete = NaN
      logDebug(pluginJson, `- ${this.title}: % complete = NaN`)
    }
    // ... or through specific 'Progress' field
    const progressLines = getFieldsFromNote(this.note, 'progress')
    if (progressLines.length > 0) {
      // Get the most recent line to use
      const progressLine = mostRecentProgressLine(progressLines)

      // Get the first part of the value of the Progress field: nn@YYYYMMDD ...
      // logDebug(pluginJson, `progressLine: ${progressLine}`)
      const progressLineParts = progressLine.split(/[:@]/)
      if (progressLineParts.length >= 3) {
        this.percentComplete = Number(progressLineParts[0])
        const datePart = unhyphenateString(progressLineParts[1])
        // $FlowFixMe
        this.lastProgressComment = `${progressLineParts[2].trim()} (${relativeDateFromDate(getDateFromUnhyphenatedDateString(datePart))})`
        logDebug(pluginJson, `- progress field -> ${this.percentComplete} / '${this.lastProgressComment}' from <${progressLine}>`)
      } else {
        logWarn(pluginJson, `- cannot properly parse progress field <${progressLine}> in project '${this.title}'`)
      }
    }

    // make project completed if @completed_date set
    this.isCompleted = this.completedDate != null ? true : false
    // make project archived if #archive tag present
    this.isArchived = getStringFromList(hashtags, '#archive') !== ''
    // make project cancelled if #cancelled or #someday flag set or @cancelled date set
    this.isCancelled = getStringFromList(hashtags, '#cancelled') !== '' || getStringFromList(hashtags, '#someday') !== '' || this.completedDate != null

    // set project to active if #active is set or a @review date found,
    // and not completed / cancelled.
    this.isActive = (getStringFromList(hashtags, '#active') !== '' || this.reviewInterval != null) && !this.isCompleted && !this.isCancelled && !this.isArchived ? true : false
    logDebug(pluginJson, `Project object created OK with Metadata = '${this.generateMetadataLine()}'`)
  }

  /**
   * Is this project ready for review?
   * Return true if review is overdue and not archived or completed
   * @return {boolean}
   */
  get isReadyForReview(): boolean {
    logDebug(pluginJson, `isReadyForReview: ${this.title}:  ${String(this.nextReviewDays)} ${String(this.isActive)}`)
    return this.nextReviewDays != null && this.nextReviewDays <= 0 && this.isActive
  }

  /**
   * From the metadata read in, calculate due/review/finished durations
   */
  calcDurations(): void {
    const now = new Date()
    this.dueDays =
      this.dueDate != null
        ? // NB: Written while there was an error in EM's Calendar.unitsBetween() function
      daysBetween(now, this.dueDate)
        : undefined
    this.finishedDays =
      this.completedDate != null && this.startDate != null
        ? daysBetween(this.startDate, this.completedDate)
        : this.cancelledDate != null && this.startDate != null
        ? daysBetween(this.startDate, this.cancelledDate)
        : undefined
    if (this.reviewInterval != null) {
      if (this.reviewedDate != null) {
        this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
        this.nextReviewDays = daysBetween(now, this.nextReviewDate)
      } else {
        // no next review date, so set at today
        this.nextReviewDate = now
        this.nextReviewDays = 0
      }
    }
  }

  /**
   * Close a Project/Area note by updating the metadata and saving it:
   * - adding @completed(<today's date>) to the current note in the Editor
   * - add '#archive' flag to metadata line
   * @author @jgclark
   */
  completeProject(): boolean {
    // const todayStr = hyphenatedDateString(new Date())
    // const yearStr = todayStr.substring(0, 4)
    // const completedTodayString = `${completedMentionString}(${todayStr})`
    // const metadataLine = getOrMakeMetadataLine(note)

    // update the metadata fields
    this.isArchived = true
    this.isCompleted = true
    this.isCancelled = true
    this.completedDate = new Date()
    this.calcDurations()

    // re-write the note's metadata line
    logDebug(pluginJson, `Completing ${this.title} ...`)
    const newMetadataLine = this.generateMetadataLine()
    logDebug(pluginJson, `... metadata now '${newMetadataLine}'`)
    this.metadataPara.content = newMetadataLine

    // send update to Editor
    // TODO: Will need updating when supporting frontmatter for metadata
    Editor.updateParagraph(this.metadataPara)
    return true
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding @cancelled(<today's date>)
   * - add '#archive' flag to metadata line
   * @author @jgclark
   */
  cancelProject(): boolean {
    // update the metadata fields
    this.isArchived = true
    this.isCompleted = false
    this.isCancelled = true
    this.cancelledDate = new Date()
    this.calcDurations()

    // re-write the note's metadata line
    logDebug(pluginJson, `Cancelling ${this.title} ...`)
    const newMetadataLine = this.generateMetadataLine()
    logDebug(pluginJson, `... metadata now '${newMetadataLine}'`)
    this.metadataPara.content = newMetadataLine

    // send update to Editor TODO: Will need updating when supporting frontmatter for metadata
    Editor.updateParagraph(this.metadataPara)
    return true
  }

  /**
   * Generate a one-line tab-sep summary line ready for MD note 
   */
  generateMetadataLine(): string {

    let output = ''
    // output = (this.isActive) ? '#active ' : ''
    // output = (this.isCancelled) ? '#cancelled ' : ''
    output = this.isArchived ? '#archive ' : ''
    output += this.noteType === 'project' || this.noteType === 'area' ? `#${this.noteType} ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.startDate && this.startDate !== undefined ? `${checkString(DataStore.preference('startMentionStr'))}(${toISODateString(this.startDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.dueDate && this.startDate !== undefined ? `${checkString(DataStore.preference('dueMentionStr'))}(${toISODateString(this.dueDate)}) ` : ''
    output +=
      this.reviewInterval && this.reviewInterval !== undefined ? `${checkString(DataStore.preference('reviewIntervalMentionStr'))}(${checkString(this.reviewInterval)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.reviewedDate && this.reviewedDate !== undefined ? `${checkString(DataStore.preference('reviewedMentionStr'))}(${toISODateString(this.reviewedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.completedDate && this.completedDate !== undefined ? `${checkString(DataStore.preference('completedMentionStr'))}(${toISODateString(this.completedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.cancelledDate && this.cancelledDate !== undefined ? `${checkString(DataStore.preference('cancelledMentionStr'))}(${toISODateString(this.cancelledDate)}) ` : ''

    return output
  }

  /**
   * Returns CSV line showing just days until next review + title
   * @return {string}
   */
  machineSummaryLine(): string {
    const numString = this.nextReviewDays?.toString() ?? ''
    return `${numString}\t${this.title}`
  }

  /**
   * Returns title of note as folder name + link, also showing complete or cancelled where relevant.
   * Now also supports 'markdown' or 'HTML' styling.
   * TODO: do I really support scheduled/postponed? If so style.checked-scheduled ...
   * @param {string} style 'markdown' or 'HTML'
   * @param {boolean} includeFolderName whether to include folder name at the start of the entry.
   * @return {string} - title as wikilink
   */
  decoratedProjectTitle(style: string, includeFolderName: boolean): string {
    const folderNamePart = includeFolderName ? this.folder + ' ' : ''
    const titlePart = this.title ?? '(error, not available)'
    switch (style) {
      case 'HTML':
        // Method 1: make [[notelinks]] via x-callbacks
        const noteTitleWithOpenAction = `<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePart}">${folderNamePart}${titlePart}</a></span>`
        // Method 2: internal links
        // see discussion at https://discord.com/channels/763107030223290449/1007295214102269982/1016443125302034452
        // const noteTitleWithOpenAction = `<button onclick=openNote()>${folderNamePart}${titlePart}</button>`

        if (this.isCompleted) {
          // Looked earlier at FontAwesome icons:
          // - <i class="fa-solid fa-square-check"></i> from https://fontawesome.com/icons/square-check?s=solid
          return `<span class="task-checked">${noteTitleWithOpenAction}</span>`
        } else if (this.isCancelled) {
          // Looked earlier at FontAwesome icons:
          // - https://fontawesome.com/icons/rectangle-xmark?s=solid
          // - refresh = https://fontawesome.com/icons/arrow-rotate-right?s=solid
          // - start = https://fontawesome.com/icons/circle-play?s=solid
          return `<span class="task-cancelled">${noteTitleWithOpenAction}</span>`
        } else {
          // return `<span class="checkbox">* [ ]</span> &#x2610; ${noteTitleWithOpenAction}`
          return `${noteTitleWithOpenAction}`
        }

      case 'markdown':
        if (this.isCompleted) {
          return `[x] ${folderNamePart}[[${titlePart}]]`
        } else if (this.isCancelled) {
          return `[-] ${folderNamePart}[[${titlePart}]]`
        } else {
          return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
        }

      default:
        logWarn('Project::decoratedProjectTitle', `Unknown style '${style}'; nothing returned.`)
        return ''
    }
  }

  /** 
   * Returns line to go before main output summary lines. Two output styles are available:
   * - markdown
   * - HTML
   */
  static detailedSummaryLineHeader(style: string, displayDates: boolean = true, displayProgress: boolean = true): string {
    switch (style) {
      case 'HTML':
        // In some cases, include colgroup to help massage widths a bit
        if (displayDates && displayProgress) {
          return `<thead>
<colgroup>
\t<col>
\t<col>
\t<col width="15%">
\t<col width="15%">
</colgroup>
\t<tr class="sticky-row">
\t<th>%</th><th>Project/Area Title</th><th>Due Date</th><th>Next Review</th>
\t</tr>
</thead>
<tbody>
`
        }
        else if (!displayDates && displayProgress) {
          return `<thead>
<colgroup>
\t<col>
\t<col width="30%">
\t<col>
</colgroup>
\t<tr class="sticky-row">
\t<th>%</th><th>Project/Area Title</th><th>Progress</th>
\t</tr>
</thead>
<tbody>
`
        }
        else if (displayDates && !displayProgress) {
          return `<thead>
\t<tr class="sticky-row">
\t<th>%</th><th>Project/Area Title</th><th>Due Date</th><th>Next Review</th>
\t</tr>
</thead>
<tbody>
`
        } else {
          return `<thead>
\t<tr class="sticky-row">
\t<th>%</th><th>Project/Area Title</th><th>Due Date</th><th>Next Review</th>
\t</tr>
</thead>
<tbody>
`
        }

      case 'markdown':
        // only add header if putting dates, otherwise not needed
        if (displayDates) {
          let output = '_Key:  Project/Area Title'
          if (displayProgress) {
            // output += '#tasks open / complete / waiting / future'
            output += '\tProgress'
          }
          output += '\tNext review / Due date_'
          return output
        }

      default:
        logWarn('Project::detailedSummaryLineHeader', `Unknown style '${style}'; nothing returned.`)
        return ''
    }
  }

  /**
   * Returns line showing more detailed summary of the project, for output to a note.
   * @param {string} style
   * @param {boolean} includeFolderName
   * @param {boolean?} displayDates
   * @param {boolean?} displayProgress
   * @returns {string}
   */
  detailedSummaryLine(style: string, includeFolderName: boolean, displayDates: boolean = true, displayProgress: boolean = true): string {
    let output = ''
    const thisPercent = (isNaN(this.percentComplete)) ? '0%' : ` ${this.percentComplete}%`
    const totalTasksStr = (this.completedTasks + this.openTasks).toLocaleString()
    const statsProgress = `${thisPercent} done (of ${totalTasksStr} ${(this.openTasks > 1) ? 'tasks' : 'task'})`

    switch (style) {
      case 'HTML':
        output = '\t<tr>'
        if (this.isCompleted) {
          output += '<td>' + this.addNPStateIcon('#00D050', 'a') + '</td>' // ✓
          output += `<td colspan=2>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (this.isCancelled) {
          output += '<td>' + this.addNPStateIcon('#D00050', 'c') + '</td>' // X
          output += `<td colspan=2>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (isNaN(this.percentComplete)) { // NaN
          output += '<td>' + this.addSVGPercentRing(100, 'grey', '0') + '</td>'
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else {
          output += '<td>' + this.addSVGPercentRing(this.percentComplete, 'multicol', String(this.percentComplete)) + '</td>'
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        if (displayProgress && !this.isCompleted && !this.isCancelled) {
          // Add this.lastProgressComment (if it exists) on line under title (and project is still open)
          if (displayDates) {
            if (this.lastProgressComment !== '') {
              output = `${output}<br />${this.lastProgressComment}</td>`
            } else {
              output = `${output}<br />${statsProgress}</td>`
            }
          } else {
            // write progress in next cell instead
            if (this.lastProgressComment !== '') {
              output += `</td><td>${this.lastProgressComment}</td>`
            } else {
              output += `</td><td>${statsProgress}</td>`
            }
          }
        }
        if (displayDates) {
          if (this.completedDate != null) {
            output += `<td class="task-checked">Completed ${relativeDateFromDate(this.completedDate)}</td><td></td>`
          } else if (this.cancelledDate != null) {
            output += `<td class="task-cancelled">Cancelled ${relativeDateFromDate(this.cancelledDate)}</td><td></td>`
          }
          if (!this.isCompleted && !this.isCancelled) {
            output = (this.dueDays != null)
              ? (this.dueDays > 0)
                ? `${output}<td>${relativeDateFromNumber(this.dueDays)}`
                : `${output}<td><b>${relativeDateFromNumber(this.dueDays)}</b></td>`
              : `${output}<td></td>`
            output = (this.nextReviewDays != null)
              ? (this.nextReviewDays > 0)
                ? `${output}<td>${relativeDateFromNumber(this.nextReviewDays)}</td>`
                : `${output}<td><b>${relativeDateFromNumber(this.nextReviewDays)}</b></td>`
              : `${output}<td></td>`
          }
        }
        output += '</tr>'
        break

      case 'markdown':
        // TEST: implement displayDates & displayProgress
        output = '- '
        output += `${this.decoratedProjectTitle(style, includeFolderName)}`
        if (displayDates) {
          if (this.completedDate != null) {
            // $FlowIgnore[incompatible-call]
            output += `\t(Completed ${relativeDateFromNumber(this.finishedDays)})`
          } else if (this.cancelledDate != null) {
            // $FlowIgnore[incompatible-call]
            output += `\t(Cancelled ${relativeDateFromNumber(this.finishedDays)})`
          }
        }
        if (displayProgress && !this.isCompleted && !this.isCancelled) {
          // const thisPercent = (isNaN(this.percentComplete)) ? '' : ` (${this.percentComplete}%)`
          // Show progress comment if available ...
          if (this.lastProgressComment !== '' && !this.isCompleted && !this.isCancelled) {
            output += `\t${thisPercent} done: ${this.lastProgressComment}`
          }
          // ... else show stats
          else {
            output += `\t${statsProgress}`
            // Older more detailed stats:
            // output += `\tc${this.completedTasks.toLocaleString()}${thisPercent} / o${this.openTasks} / w${this.waitingTasks} / f${this.futureTasks}`
          }
        }
        if (displayDates && !this.isCompleted && !this.isCancelled) {
          output =
            this.nextReviewDays != null
              ? this.nextReviewDays > 0
                ? `${output} / ${relativeDateFromNumber(this.nextReviewDays)}`
                : `${output} / **${relativeDateFromNumber(this.nextReviewDays)}**`
              : `${output} / -`
          output = this.dueDays != null ? `${output} / ${relativeDateFromNumber(this.dueDays)}` : `${output} / -`
        }
        break

      default:
        logWarn('Project::detailedSummaryLine', `Unknown style '${style}'; nothing returned.`)
        output = ''
    }
    return output
  }

  /**
   * Add SVG ready for percent ring with the number in the middle.
   * @@@
   * Note: It needs to be followed by call to JS function setPercentRing() to set the ring's state.
   * @param {number} percent 0-100
   * @param {string?} color for ring and text (as colour name or #RGB), or 'multicol' to mean shading between red and green
   * @param {string?} textToShow inside ring, which can be different from just the percent, which is used by default
   * @returns {string} SVG code to insert in HTML
   */
  addSVGPercentRing(percent: number, colorIn: string = 'multicol', text: string = ''): string {
    const textToShow = (text !== '') ? text : String(percent)
    const colorToUse = (colorIn === 'multicol')
      ? redToGreenInterpolation(percent)
      : colorIn
    return makeSVGPercentRing(percent, colorToUse, textToShow, this.ID)
  }

  /**
   * Insert one of NP's state icons in given color.
   * Other styling comes from CSS for 'circle-char-text'
   * @param {string} color 
   * @param {string} char to display (normally just 1 character)
   * @returns HTML string to insert
   */
  addNPStateIcon(color: string, char: string): string {
    return `<span class="circle-char-text" style="color: ${color}">${char}</span>`
  }
}
