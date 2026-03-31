// @flow
//---------------------------------------------------------------
// HTMLView generation helpers for single-window review mode
// Jonathan Clark + Cursor
// last update 2026-03-28 for v2.0.0.b4 by @jgclark + @Cursor
//---------------------------------------------------------------

import moment from 'moment'
import pluginJson from '../plugin.json'
import type { JournalConfigType, ParsedQuestionType } from './journalHelpers'
import {
  getPeriodAdjectiveFromType,
  REVIEW_QUESTION_TYPE_NAMES_ALT,
  substituteReviewPeriodPlaceholders,
} from './journalHelpers'
import { RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import {
  convertBoldAndItalicToHTML,
  convertHashtagsToHTML,
  convertHighlightsToHTML,
  convertMentionsToHTML,
  convertUnderlinedToHTML,
  makePluginCommandButton,
  replaceMarkdownLinkWithHTMLLink,
  simplifyInlineImagesForHTML,
  simplifyNPEventLinksForHTML,
} from '@helpers/HTMLView.js'
import { RE_SYNC_MARKER } from '@helpers/regex'

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
 * @param {string} taskLine
 * @returns {string}
 */
function formatTaskAsHTML(taskLine: string): string {
  let line = taskLine.replace(RE_DONE_MENTION_STRIP_FOR_SUMMARY_G, '').replace(/\s{2,}/g, ' ').trim()
  line = line.replace(RE_SYNC_MARKER, '')
  line = line.trimRight()
  line = convertBoldAndItalicToHTML(line)
  line = replaceMarkdownLinkWithHTMLLink(line)
  line = simplifyNPEventLinksForHTML(line)
  line = simplifyInlineImagesForHTML(line)
  line = convertHashtagsToHTML(line)
  line = convertMentionsToHTML(line)
  line = convertHighlightsToHTML(line)
  line = line.replace(/\[\[([^\]]+)\]\]/g, (_match, title) => `~${String(title)}~`)
  line = convertUnderlinedToHTML(line)
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
 * @returns {string}
 */
function makeReviewRawQuestionLineDiv(
  rawLine: string,
  lineIndex: number,
  parsedQuestions: Array<ParsedQuestionType>,
  config: JournalConfigType,
  initialAnswers: { [string]: string },
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
      .map(({ q, globalIndex }) => makeReviewQuestionRowDiv(q, globalIndex, config, ''))
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
      parts.push(`<div class="review-raw-question-line">${makeReviewQuestionRowDiv(pq, globalIndex, config, initialVal)}</div>`)
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
    return `<div class="review-raw-question-line-block"><span class="review-line-text-fragment">${escapeHTML(cleanRawLine)}</span></div>`
  }
  return `<div class="review-raw-question-line-block">${parts.join('')}</div>`
}

/**
 * Build a summary of calendar events for the review period: count and total timed duration (all-day excluded from hours).
 * @param {string} periodType
 * @param {string} periodString
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @returns {string} HTML string for the summary block
 */
function makePeriodDaysSummaryDiv(_periodType: string, eventsForPeriod: Array<TCalendarItem>): string {
  const totalDuration = eventsForPeriod.reduce((total, event) => total + getEventDurationHours(event), 0)
  const output = []
  output.push(`<div class="summary-title">${eventsForPeriod.length} events (${totalDuration.toFixed(1)} hours)</div>`)
  output.push(`<div class="summary-content">`)
  eventsForPeriod.forEach( e => {
    output.push(`\t<div class="summary-item">`)
    output.push(`\t\t<i aria-hidden="true" class="summary-item-event-icon fa-light fa-calendar-week"></i>`)
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
 * Build a summary div for the review period.
 * Present completed tasks in a nicely formatted multi-column list in small writing. Each one should start with a circle-check icon.
 * @param {string} periodType
 * @param {string} periodString
 * @param {Array<string>} completedTasks
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @returns {string} HTML string for the summary div
 */
function makePeriodSummaryDiv(
  periodType: string,
  _periodString: string,
  completedTasks: Array<string>,
  eventsForPeriod: Array<TCalendarItem>
): string {
  const summaryItems = completedTasks.length > 0
    ? completedTasks.map((taskLine) => `
      <div class="summary-item">
        <i class="summary-item-completed-icon fa-regular fa-circle-check"></i>
        <span class="summary-item-text">${formatTaskAsHTML(taskLine)}</span>
      </div>`).join('\n')
    : `<div class="summary-empty">No completed tasks found during the ${periodType}</div>`

  const outputHTML = `
<div class="section-wrap">
  <div class="summary-title">${completedTasks.length} completed tasks</div>
  <div class="summary-content">
    ${summaryItems}
  </div>
  ${makePeriodDaysSummaryDiv(periodType, eventsForPeriod)}
</div>`

  return outputHTML
}

/**
 * Build a single form row for one question (used for string, subheading, and legacy paths).
 * Note: This assumes one question per line. *So no longer used for boolean/int/number/mood inline types (I hope).*
 * @param {ParsedQuestionType} parsedQuestion
 * @param {number} index
 * @param {JournalConfigType} config
 * @returns {string}
 */
function makeReviewQuestionRowDiv(
  parsedQuestion: ParsedQuestionType,
  index: number,
  config: JournalConfigType,
  initialValue: string = '',
): string {
  const fieldName = `q_${index}`
  if (parsedQuestion.type === 'subheading' || parsedQuestion.type === 'h2' || parsedQuestion.type === 'h3') {
    const cleanHeading = stripPresentationDelimiters(parsedQuestion.question)
    const tag = parsedQuestion.type === 'h2' ? 'h2' : 'h3' // `<subheading>` defaults to h3
    const className = tag
    return `<div class="review-subheading ${className}">${escapeHTML(cleanHeading)}</div>`
  }

  const questionText = stripPresentationDelimiters(parsedQuestion.question).trim()
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
    case 'string':
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
  initialAnswers?: { [string]: string },
): string {
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  const resolvedInitialAnswers = initialAnswers ?? {}
  const renderQuestionLines = rawQuestionLines.map((l) => substituteReviewPeriodPlaceholders(l, periodString, periodType))
  const questionRows = renderQuestionLines
    .map((line, lineIndex) => makeReviewRawQuestionLineDiv(line, lineIndex, parsedQuestions, config, resolvedInitialAnswers))
    .filter((row) => row !== '')
    .join('\n')
  const possibleSummarySection = (periodType === 'day') ? makePeriodSummaryDiv(periodType, periodString, summaryCompletedTasks, eventsForPeriod) : ''
  
  return `
    <h2 class="review-title">${escapeHTML(periodAdjective)} Review for ${escapeHTML(periodString)}</h2>
    
    ${possibleSummarySection}
    
    <div class="section-wrap">
      <form id="review-form" class="review-form">
        ${questionRows}
        <div class="review-actions">
          <button class="review-button" type="button" id="review-cancel">Cancel</button>
          <!--${makePluginCommandButton('Cancel', pluginJson['plugin.id'], 'onReviewWindowAction', 'cancel', 'Cancel', true)} -->
          <!-- type="submit" -->
          <button class="review-button review-button-primary" type="button" id="review-submit">Save</button>
        </div>
      </form>
    </div>

    <script type="text/javascript">
      let hasSentReviewAction = false
      const sendToPlugin = (commandName = '${callbackCommandName}', pluginID = '${pluginJson['plugin.id']}', commandArgs = []) => {
        // Prevent duplicate callbacks if handlers get attached more than once.
        if (hasSentReviewAction) {
          console.log("sendToPlugin: hasSentReviewAction is true; stopping.")
          return
        }
        const actionName = String(commandArgs?.[0] ?? '')
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
          hasSentReviewAction = true
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
        hasSentReviewAction = true
      }
      const reviewForm = document.getElementById('review-form')
      const cancelButton = document.getElementById('review-cancel')
      const submitButton = document.getElementById('review-submit')

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
    </script>
  `
}
