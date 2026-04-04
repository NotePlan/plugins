// @flow
//---------------------------------------------------------------
// HTMLView generation helpers for single-window review mode
// Jonathan Clark + Cursor
// last update 2026-04-03 for v2.0.0.b6 by @jgclark + @Cursor
//---------------------------------------------------------------

import moment from 'moment'
import pluginJson from '../plugin.json'
import type { JournalConfigType, ParsedQuestionType } from './journalHelpers'
import {
  buildNextPlanSectionHeadingTitle,
  buildThisPlanSectionHeadingTitle,
  getPeriodAdjectiveFromType,
  REVIEW_QUESTION_TYPE_NAMES_ALT,
  substituteReviewPeriodPlaceholders,
} from './journalHelpers'
import { RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import { getTaskPriority } from '@helpers/paragraph'
import {
  convertBoldAndItalicToHTML,
  convertHashtagsToHTML,
  convertHighlightsToHTML,
  convertMentionsToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  convertUnderlinedToHTML,
  makePluginCommandButton,
  replaceMarkdownLinkWithHTMLLink,
  simplifyInlineImagesForHTML,
  simplifyNPEventLinksForHTML,
} from '@helpers/HTMLView.js'
import { RE_SYNC_MARKER } from '@helpers/regex'
import {
  // changeBareLinksToHTMLLink,
  // changeMarkdownLinksToHTMLLink,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString,
  truncateHTML,
} from '@helpers/stringTransforms'


//-----------------------------------------------------------------------------
// Constants

const useFlexbox = true

// Types of questions that use a block layout in the review window.
const blockRowTypes = ['string', 'subheading', 'h2', 'h3', 'bullets', 'checklists', 'tasks']

// Keep in sync with parseQuestions() in journal.js (segment extraction).
const REVIEW_SEGMENT_RE = new RegExp(
  `[^<]*?<\\s*(?:${REVIEW_QUESTION_TYPE_NAMES_ALT})\\s*>\\)?[^\\s]*`,
  'gi',
)

/** Remove @done(…) from summary lines (date with optional time), global. */
const RE_DONE_MENTION_STRIP_FOR_SUMMARY_G = new RegExp(RE_DONE_DATE_OPT_TIME.source, 'gi')

//-----------------------------------------------------------------------------
// HTML template strings

export const stylesheetinksInHeader: string = `
<!-- Load in Journalling-specific CSS -->
<link href="./reviews.css" rel="stylesheet">
`

export const faLinksInHeader: string = `
<!-- Load in fontawesome assets (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

//-----------------------------------------------------------------------------
// Helper functions

/**
 * Escape text for safe insertion into HTML.
 * @param {string} input
 * @returns {string}
 */
function escapeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Remove display-only delimiter tokens from text before rendering.
 * @param {string} input
 * @returns {string}
 */
function stripPresentationDelimiters(input: string): string {
  return input.replace(/ \|\| /g, ' ')
}

/**
 * Format one done-task line for HTML using the same NotePlan-oriented conversions as getNoteContentAsHTML (minus full-note showdown).
 * @param {string} taskContent
 * @returns {string}
 */
function formatTaskAsHTML(taskContent: string): string {
  const taskPriority = getTaskPriority(taskContent)
  let line = taskContent.replace(RE_DONE_MENTION_STRIP_FOR_SUMMARY_G, '').replace(/\s{2,}/g, ' ').trim()
  line = line.replace(RE_SYNC_MARKER, '')
  line = replaceMarkdownLinkWithHTMLLink(line)
  line = simplifyNPEventLinksForHTML(line)
  line = simplifyInlineImagesForHTML(line)
  line = convertHashtagsToHTML(line)
  line = convertMentionsToHTML(line)
  line = convertPreformattedToHTML(line)
  line = convertStrikethroughToHTML(line)
  line = convertHighlightsToHTML(line)
  line = stripTodaysDateRefsFromString(line)
  line = stripThisWeeksDateRefsFromString(line)
  line = stripBackwardsDateRefsFromString(line)
  line = convertBoldAndItalicToHTML(line)
  line = convertUnderlinedToHTML(line)
  line = line.replace(/\[\[([^\]]+)\]\]/g, (_match, title) => `~${String(title)}~`)
  line = line.trimRight()
  line = truncateHTML(line, 120)

  // If priority > 0, add priorityN styling around the whole string. Where it is "working-on", it uses priority4.
  if (taskPriority > 0) {
    // remove the priority markers from the start of the line
    const lineWithoutPriorityMarkers = line.replace(/^!{1,3}\s*/, '').replace(/^>>\s?/, '')
    line = `<span class="priority${String(taskPriority)}">${lineWithoutPriorityMarkers}</span>`
  }
  return line
}

/**
 * Split a question segment at the typed marker (e.g. `<int>`) so controls can sit inline with prefix/suffix text.
 * @param {string} segment
 * @param {string} questionType
 * @returns {{ prefix: string, suffix: string }}
 */
function splitSegmentAtTypeMarker(segment: string, questionType: string): {| prefix: string, suffix: string |} {
  const safeType = questionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<\\s*${safeType}\\s*>`, 'i')
  const m = segment.match(re)
  if (!m || m.index == null) {
    return { prefix: segment, suffix: '' }
  }
  const idx = m.index
  const tagLen = m[0].length
  return { prefix: segment.slice(0, idx), suffix: segment.slice(idx + tagLen) }
}

/**
 * Build checkbox / short input / mood select for inline placement (same classes as makeReviewQuestionRowDiv).
 * @param {ParsedQuestionType} parsedQuestion
 * @param {number} globalIndex
 * @param {JournalConfigType} config
 * @returns {string}
 */
function makeReviewInlineControl(
  parsedQuestion: ParsedQuestionType,
  globalIndex: number,
  config: JournalConfigType,
  initialValue: string = '',
): string {
  const fieldName = `q_${globalIndex}`
  const checkedAttr = initialValue === 'yes' ? ' checked' : ''
  switch (parsedQuestion.type) {
    case 'boolean': {
      return `<input class="review-checkbox" id="${fieldName}" name="${fieldName}" type="checkbox" value="yes"${checkedAttr} />`
    }
    case 'int':
    case 'number': {
      return `<input class="review-input review-input-short review-input-inline" id="${fieldName}" name="${fieldName}" type="text" value="${escapeHTML(initialValue)}" />`
    }
    case 'duration': {
      return `<input class="review-input review-input-short review-input-inline" id="${fieldName}" name="${fieldName}" type="text" value="${escapeHTML(initialValue)}" placeholder="H:MM" pattern="\\d{1,2}:[0-5]\\d" title="Enter duration as H:MM or HH:MM" />`
    }
    case 'mood': {
      const moodArray = typeof config.moods === 'string' ? config.moods.split(',').map((m) => m.trim()) : config.moods
      const moodOptions = moodArray
        .filter((m) => m !== '')
        .map((mood) => {
          const selectedAttr = mood === initialValue ? ' selected' : ''
          return `<option value="${escapeHTML(mood)}"${selectedAttr}>${escapeHTML(mood)}</option>`
        })
        .join('')
      return `<select class="review-input review-input-fit review-input-inline" id="${fieldName}" name="${fieldName}">
        <option value="">Skip</option>
        ${moodOptions}
      </select>`
    }
    default: {
      return ''
    }
  }
}

/**
 * Build one flex row for a raw config line: literal text and inline controls in original order.
 * String questions use the same block layout as makeReviewQuestionRowDiv(); other types use inline controls.
 * @param {string} rawLine
 * @param {number} lineIndex
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {JournalConfigType} config
 * @param {string} periodString calendar period title for placeholder substitution in labels/headings
 * @param {string} periodType
 * @returns {string}
 */
function makeQuestionLineDiv(
  rawLine: string,
  lineIndex: number,
  parsedQuestions: Array<ParsedQuestionType>,
  config: JournalConfigType,
  initialAnswers: { [string]: string },
  periodString: string,
  periodType: string,
): string {
  const cleanRawLine = stripPresentationDelimiters(rawLine)
  if (cleanRawLine.trim() === '') {
    return ''
  }

  const lineQuestionsOrdered: Array<{| q: ParsedQuestionType, globalIndex: number |}> = parsedQuestions
    .map((q, globalIndex) => ({ q, globalIndex }))
    .filter(({ q }) => q.lineIndex === lineIndex)

  const headingTypes = ['subheading', 'h2', 'h3']
  const isHeadingOnlyLine = !cleanRawLine.includes('<')
    && lineQuestionsOrdered.length > 0
    && lineQuestionsOrdered.every(({ q }) => headingTypes.includes(q.type))
  if (isHeadingOnlyLine) {
    return lineQuestionsOrdered
      .map(({ q, globalIndex }) => makeReviewQuestionRowDiv(q, globalIndex, config, '', periodString, periodType))
      .join('\n')
  }

  const parts: Array<string> = []
  let lastIndex = 0
  let segmentOrdinal = 0
  REVIEW_SEGMENT_RE.lastIndex = 0
  let match = REVIEW_SEGMENT_RE.exec(cleanRawLine)
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(`<span class="review-line-text-fragment">${escapeHTML(cleanRawLine.slice(lastIndex, match.index))}</span>`)
    }
    const segmentTrimmed = match[0].trim()
    const pair = lineQuestionsOrdered[segmentOrdinal]
    segmentOrdinal += 1
    if (!pair) {
      parts.push(`<span class="review-line-text-fragment">${escapeHTML(match[0])}</span>`)
      lastIndex = match.index + match[0].length
      match = REVIEW_SEGMENT_RE.exec(cleanRawLine)
      continue
    }
    const { q: pq, globalIndex } = pair
    const initialVal = initialAnswers[`q_${globalIndex}`] ?? ''

    if (blockRowTypes.includes(pq.type)) {
      parts.push(
        `<div class="review-question-line">${makeReviewQuestionRowDiv(pq, globalIndex, config, initialVal, periodString, periodType)}</div>`,
      )
    } else {
      const { prefix, suffix } = splitSegmentAtTypeMarker(segmentTrimmed, pq.type)
      const control = makeReviewInlineControl(pq, globalIndex, config, initialVal)
      parts.push(
        `<span class="review-line-segment">${escapeHTML(prefix)}${control}${escapeHTML(suffix)}</span>`,
      )
    }
    lastIndex = match.index + match[0].length
    match = REVIEW_SEGMENT_RE.exec(cleanRawLine)
  }

  if (lastIndex < cleanRawLine.length) {
    parts.push(`<span class="review-line-text-fragment">${escapeHTML(cleanRawLine.slice(lastIndex))}</span>`)
  }

  if (parts.length === 0) {
    // return `<div class="review-question-line-block"><span class="review-line-text-fragment">${escapeHTML(cleanRawLine)}</span></div>`
    // TEST:
    return `<span class="review-line-text-fragment">${escapeHTML(cleanRawLine)}</span>`
  }
  return `<div class="review-question-line-block">${parts.join('')}</div>`
}

/**
 * Build a summary of calendar events for the review period: count and total timed duration (all-day excluded from hours).
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @returns {string} HTML string for the summary block
 */
function makePeriodDaysSummaryDiv(eventsForPeriod: Array<TCalendarItem>): string {
  const totalDuration = eventsForPeriod.reduce((total, event) => total + getEventDurationHours(event), 0)
  const output = []
  output.push(`<div class="summary-title">${eventsForPeriod.length} events (${totalDuration.toFixed(1)} hours)</div>`)
  output.push(`<div class="summary-content">`)
  eventsForPeriod.forEach( e => {
    output.push(`\t<div class="summary-item">`)
    output.push(`\t\t<i aria-hidden="true" class="summary-item-event-icon fa-regular fa-calendar-week"></i>`)
    output.push(`\t\t<span class="summary-item-text">${e.title}</span>`)
    output.push('\t</div>')
  })
  output.push(`</div>`)
  return output.join('\n')  
}

/**
 * Duration of a calendar item in hours (all-day => 0; uses `date` and `endDate` like EventHelpers).
 * @param {TCalendarItem} event
 * @returns {number}
 */
function getEventDurationHours(event: TCalendarItem): number {
  if (event.isAllDay) {
    return 0
  }
  const end = event.endDate != null ? event.endDate : event.date
  return Math.max(0, moment(end).diff(moment(event.date), 'minutes') / 60)
}

/**
 * First summary block: carried-over plan tasks from this note (open = hollow circle, done = check).
 * @param {Array<{ content: string, isDone: boolean }>} carryOverPlanItems
 * @returns {string} HTML or empty when none
 */
function makeCarryOverPlanSummaryContentDiv(
  planningSectionTitle: string,
  carryOverPlanItems: Array<{ content: string, isDone: boolean }>,
): string {
  const rows: Array<string> = []
  rows.push(`<div class="plan-title h3">${escapeHTML(planningSectionTitle)}</div>`)
  rows.push(`<div class="summary-content">`)
  if (carryOverPlanItems.length > 0) {
    carryOverPlanItems.forEach((item) => {
      if (item.isDone) {
        rows.push(`
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-completed-icon fa-solid fa-circle-check"></i>
        <span class="summary-item-text">${formatTaskAsHTML(item.content)}</span>
      </div>`)
      } else {
      rows.push(`
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-incomplete-icon fa-regular fa-circle"></i>
        <span class="summary-item-text">${formatTaskAsHTML(item.content)}</span>
      </div>`)
      }
    })
    rows.push(`</div>`)
  } else {
    rows.push(`<span class="summary-empty">No planned items found for this period</span>`)
  }
  rows.push(`</div>`)
  return rows.join('\n')
}

/**
 * Summary card: optional carry-over plan tasks, then (daily only) completed-task wins + calendar events.
 * @param {string} periodType
 * @param {string} periodString
 * @param {Array<{ content: string, isDone: boolean }>} carryOverPlanItems
 * @param {Array<string>} completedTasks
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @returns {string} HTML for section-wrap or ''
 */
function buildReviewSummarySectionHTML(
  periodType: string,
  carryOverPlanItems: Array<{ content: string, isDone: boolean }>,
  planningSectionTitle: string,
  completedTasks: Array<string>,
  eventsForPeriod: Array<TCalendarItem>,
): string {
  const hasCarryOver = carryOverPlanItems.length > 0
  const isDay = periodType === 'day'
  if (!hasCarryOver && !isDay) {
    return ''
  }
  const parts: Array<string> = [
    '<div class="section-wrap" id="summary">',
  ]
  const carryBlock = makeCarryOverPlanSummaryContentDiv(planningSectionTitle, carryOverPlanItems)
  parts.push(carryBlock)
  if (isDay) {
    const summaryItems =
      completedTasks.length > 0
        ? completedTasks
            .map(
              (taskLine) => `
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-completed-icon fa-regular fa-circle-check"></i>
        <span class="summary-item-text">${formatTaskAsHTML(taskLine)}</span>
      </div>`,
            )
            .join('\n')
        : `<div class="summary-empty">No completed tasks found during the ${periodType}</div>`
    parts.push(`<div class="summary-title">${completedTasks.length} completed tasks</div>`)
    parts.push(`<div class="summary-content summary-content-completed-tasks">\n${summaryItems}\n</div>`)
    parts.push(makePeriodDaysSummaryDiv(eventsForPeriod))
  }
  parts.push('</div>')
  return parts.join('\n')
}

/**
 * Planning block (outside the main review form): title + tasks textarea.
 * @param {string} planningSectionTitle
 * @returns {string}
 */
function makePlanningSectionHTML(planningSectionTitle: string): string {
  return `<div class="section-wrap" id="planning-questions">
  <div class="plan-title h3">${escapeHTML(planningSectionTitle)}</div>
  <div class="review-row">
    <div class="review-answer">
      <textarea class="review-input" id="planning_tasks" name="planning_tasks" rows="3" placeholder="Enter one per line"></textarea>
    </div>
  </div>
</div>`
}

/**
 * Build a single form row for one question (used for string, subheading, and legacy paths).
 * Note: This assumes one question per line. *So no longer used for boolean/int/number/mood inline types (I hope).*
 * @param {ParsedQuestionType} parsedQuestion
 * @param {number} index
 * @param {JournalConfigType} config
 * @param {string} initialValue
 * @param {string} periodString calendar period title for `<date>` / `<datenext>` in question text
 * @param {string} periodType
 * @returns {string}
 */
function makeReviewQuestionRowDiv(
  parsedQuestion: ParsedQuestionType,
  index: number,
  config: JournalConfigType,
  initialValue: string = '',
  periodString: string,
  periodType: string,
): string {
  const fieldName = `q_${index}`
  /** Parsed question text still contains `<date>` etc.; raw display lines are substituted earlier. */
  const questionForDisplay = substituteReviewPeriodPlaceholders(parsedQuestion.question, periodString, periodType)
  if (parsedQuestion.type === 'subheading' || parsedQuestion.type === 'h2' || parsedQuestion.type === 'h3') {
    const cleanHeading = stripPresentationDelimiters(questionForDisplay)
    const tag = parsedQuestion.type === 'h2' ? 'h2' : 'h3' // `<subheading>` defaults to h3
    const className = tag
    return `<div class="h3 ${className}">${escapeHTML(cleanHeading)}</div>`
  }

  const questionText = stripPresentationDelimiters(questionForDisplay).trim()
  const questionLabel = `<label class="review-label" for="${fieldName}">${escapeHTML(questionText)}</label>`
  let control = ''
  const useInlineRow = useFlexbox && !blockRowTypes.includes(parsedQuestion.type)
  const rowClass = useInlineRow ? 'review-row review-row-inline' : 'review-row'
  const checkedAttr = initialValue === 'yes' ? ' checked' : ''
  switch (parsedQuestion.type) {
    case 'boolean': {
      control = `<input class="review-checkbox" id="${fieldName}" name="${fieldName}" type="checkbox" value="yes"${checkedAttr} />`
      break
    }
    case 'int':
    case 'number': {
      control = `<input class="review-input review-input-short" id="${fieldName}" name="${fieldName}" type="text" value="${escapeHTML(initialValue)}" />`
      break
    }
    case 'duration': {
      control = `<input class="review-input review-input-short" id="${fieldName}" name="${fieldName}" type="text" value="${escapeHTML(initialValue)}" placeholder="H:MM" pattern="\\d{1,2}:[0-5]\\d" title="Enter duration as H:MM or HH:MM" />`
      break
    }
    case 'mood': {
      const moodArray = (typeof config.moods === 'string') ? config.moods.split(',').map((m) => m.trim()) : config.moods
      const moodOptions = moodArray
        .filter((m) => m !== '')
        .map((mood) => {
          const selectedAttr = mood === initialValue ? ' selected' : ''
          return `<option value="${escapeHTML(mood)}"${selectedAttr}>${escapeHTML(mood)}</option>`
        })
        .join('')
      control = `<select class="review-input review-input-fit" id="${fieldName}" name="${fieldName}">
        <option value="">Skip</option>
        ${moodOptions}
      </select>`
      break
    }
    case 'string': {
      control = `<textarea class="review-input" id="${fieldName}" name="${fieldName}" rows="2">${escapeHTML(initialValue)}</textarea>`
      break
    }
    case 'bullets':
    case 'checklists':
    case 'tasks': {
      control = `<textarea class="review-input" id="${fieldName}" name="${fieldName}" rows="3">${escapeHTML(initialValue)}</textarea>`
      break
    }
    default: {
      logWarn(`makeReviewQuestionRowDiv(): unknown question type: ${parsedQuestion.type} -- ignoring it.`)
      break
    }
  }
  return useInlineRow
    ? `<div class="${rowClass}">${questionLabel}<div class="review-answer-inline">${control}</div></div>`
    : `<div class="${rowClass}">${questionLabel}<div class="review-answer">${control}</div></div>`
}

/**
 * Build HTML body for single-window review form.
 * @param {JournalConfigType} config
 * @param {Array<ParsedQuestionType>} parsedQuestions same order as parseQuestions(rawQuestionLines) (field names q_0 …)
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod()
 * @param {Array<string>} summaryCompletedTasks
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} periodType
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @param {string} callbackCommandName
 * @param {{ [string]: string }=} initialAnswers field names q_0 … to pre-fill from the calendar note
 * @param {{ carryOverPlanItems?: Array<{ content: string, isDone: boolean }>, planningSectionTitle?: string }=} reviewExtras carry-over plan tasks + planning block title
 * @returns {string}
 */
export function buildReviewHTML(
  config: JournalConfigType,
  parsedQuestions: Array<ParsedQuestionType>,
  rawQuestionLines: Array<string>,
  summaryCompletedTasks: Array<string>,
  periodString: string,
  periodType: string,
  eventsForPeriod: Array<TCalendarItem>,
  callbackCommandName: string,
  planName: string,
  initialAnswers?: { [string]: string },
  carryOverPlanItems?: Array<{ content: string, isDone: boolean }>,
): string {
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  const resolvedInitialAnswers = initialAnswers ?? {}
  const resolvedCarryOver = carryOverPlanItems ?? []
  const plannedSectionTitle = buildThisPlanSectionHeadingTitle(planName)
  const planningSectionTitle = buildNextPlanSectionHeadingTitle(planName, periodType)
  const renderQuestionLines = rawQuestionLines.map((l) => substituteReviewPeriodPlaceholders(l, periodString, periodType))
  const questionRows = renderQuestionLines
    .map((line, lineIndex) =>
      makeQuestionLineDiv(line, lineIndex, parsedQuestions, config, resolvedInitialAnswers, periodString, periodType),
    )
    .filter((row) => row !== '')
    .join('\n')
  const summarySection = buildReviewSummarySectionHTML(
    periodType,
    resolvedCarryOver,
    plannedSectionTitle,
    summaryCompletedTasks,
    eventsForPeriod,
  )
  const planningSectionHtml = planningSectionTitle !== '' ? makePlanningSectionHTML(planningSectionTitle) : ''

  return `
    <div class="review-title-row">
      <h2 class="review-title">${escapeHTML(periodAdjective)} Review for ${escapeHTML(periodString)}</h2>
      <div class="review-title-row-actions">
        <button class="review-button" type="button" id="review-refresh" title="Reload questions and summary from the note">Refresh</button>
      </div>
    </div>

    ${summarySection}

      <form id="review-form" class="review-form">
    <div class="section-wrap" id="review-questions">
        ${questionRows}
      </div>
        
        ${planningSectionHtml}
      </form>

      <div class="review-actions">
        <button class="review-button" type="button" id="review-cancel">Cancel</button>
        <!--${makePluginCommandButton('Cancel', pluginJson['plugin.id'], 'onReviewWindowAction', 'cancel', 'Cancel', true)} -->
        <!-- type="submit" -->
        <button class="review-button review-button-primary" type="button" id="review-submit">Save</button>
    </div>

    <script type="text/javascript">
      let hasSentReviewAction = false
      const sendToPlugin = (commandName = '${callbackCommandName}', pluginID = '${pluginJson['plugin.id']}', commandArgs = []) => {
        const actionName = String(commandArgs?.[0] ?? '')
        const locksForm = actionName === 'submit' || actionName === 'cancel'
        // Prevent duplicate submit/cancel if handlers get attached more than once.
        if (locksForm && hasSentReviewAction) {
          console.log("sendToPlugin: hasSentReviewAction is true; stopping.")
          return
        }
        const payload = commandArgs?.[1] ?? {}
        
        // Primary path: use NotePlan's jsBridge to invoke DataStore from the native side.
        // This avoids URL length limits for large review payloads.
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.jsBridge) {
          const commandArgsArray = [actionName, JSON.stringify(payload)]
          const code = '(async function() { await DataStore.invokePluginCommandByName(%%commandName%%, %%pluginID%%, %%commandArgs%%);})()'
            .replace('%%commandName%%', JSON.stringify(commandName))
            .replace('%%pluginID%%', JSON.stringify(pluginID))
            .replace('%%commandArgs%%', JSON.stringify(commandArgsArray))
          console.log("window.sendToPlugin: Sending via jsBridge:", commandName, pluginID)
          window.webkit.messageHandlers.jsBridge.postMessage({
            code: code,
            onHandle: '',
            id: '1',
          })
          if (locksForm) {
            hasSentReviewAction = true
          }
          return
        }

        // Fallback path: x-callback-url for contexts without jsBridge.
        const callbackUrl = 'noteplan://x-callback-url/runPlugin?pluginID='
          + encodeURIComponent(pluginID)
          + '&command='
          + encodeURIComponent(commandName)
          + '&arg0='
          + encodeURIComponent(actionName)
          + '&arg1='
          + encodeURIComponent(JSON.stringify(payload))
        console.log("window.sendToPlugin: Sending callbackURL: "+callbackUrl)
        window.location.href = callbackUrl
        if (locksForm) {
          hasSentReviewAction = true
        }
      }
      const reviewForm = document.getElementById('review-form')
      const cancelButton = document.getElementById('review-cancel')
      const submitButton = document.getElementById('review-submit')
      const refreshBtn = document.getElementById('review-refresh')

      /**
       * Collect answers from the review form and return as a JSON string.
       * @returns {string}
       */
      function collectAnswers() {
        const formData = new FormData(reviewForm)
        const answers = {}
        for (const [key, value] of formData.entries()) {
          answers[key] = String(value)
        }
        const checkboxes = reviewForm.querySelectorAll('input[type="checkbox"]')
        for (const checkbox of checkboxes) {
          answers[checkbox.name] = checkbox.checked
        }
        const planningEl = document.getElementById('planning_tasks')
        if (planningEl) {
          answers.planning_tasks = String(planningEl.value ?? '')
        }
        const payload = {
          answers,
          periodType: ${JSON.stringify(periodType)},
          periodString: ${JSON.stringify(periodString)},
        }
        console.log("collectAnswers(): -> "+JSON.stringify(payload))
        return payload
      }

      function cancel() {
        console.log("HTMLView: cancel() called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['cancel', { }])
      }

      function submitReview() {
        console.log("HTMLView: submitReview() called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['submit', collectAnswers()])
      }

      function refreshReview() {
        console.log("HTMLView: refreshReview() called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['refresh', {
          periodType: ${JSON.stringify(periodType)},
          periodString: ${JSON.stringify(periodString)},
        }])
      }

      const firstInputControl = reviewForm.querySelector('textarea, input:not([type="hidden"]), select')
      if (firstInputControl && typeof firstInputControl.focus === 'function') {
        firstInputControl.focus()
      }

      if (cancelButton) {
        cancelButton.addEventListener('click', function () {
          cancel()
        })
      }
      if (submitButton) {
        submitButton.addEventListener('click', function () {
          submitReview()
        })
      }
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
          refreshReview()
        })
      }
    </script>
  `
}
