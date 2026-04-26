// @flow
//---------------------------------------------------------------
// HTMLView generation helpers for single-window review mode
// Jonathan Clark + Cursor
// last update 2026-04-15 for v2.0.0.b10 by @jgclark + @Cursor
//---------------------------------------------------------------

import moment from 'moment'
import pluginJson from '../plugin.json'
import type { PeriodicReviewConfigType, ParsedQuestionType } from './periodicReviewHelpers'
import {
  buildNextPlanSectionHeadingTitle,
  buildThisPlanSectionHeadingTitle,
  getPeriodAdjectiveFromType,
  mergeUniqueSummaryDoneTaskLines,
  splitMergedSummaryDoneLinesIntoWinsAndOthers,
  substituteReviewPeriodPlaceholders,
} from './periodicReviewHelpers'
import { getReviewQuestionSegmentRegExpGi } from './reviewQuestions'
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
  const pattern =
    questionType.toLowerCase() === 'int'
      ? '<\\s*(?:integer|int)\\s*>'
      : `<\\s*${questionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`
  const re = new RegExp(pattern, 'i')
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
  config: PeriodicReviewConfigType,
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
  config: PeriodicReviewConfigType,
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
  const lineHasOnlyHeadingQuestions =
    lineQuestionsOrdered.length > 0 && lineQuestionsOrdered.every(({ q }) => headingTypes.includes(q.type))
  // `##` / `###` lines have no angle-bracket typed segments; use the heading row path so the flex
  // segment matcher does not treat heading text as inline fragments.
  const isMarkdownStyleHeadingLine = lineHasOnlyHeadingQuestions && !cleanRawLine.includes('<')
  if (isMarkdownStyleHeadingLine) {
    return lineQuestionsOrdered
      .map(({ q, globalIndex }) => makeReviewQuestionRowDiv(q, globalIndex, config, '', periodString, periodType))
      .join('\n')
  }

  const parts: Array<string> = []
  let lastIndex = 0
  let segmentOrdinal = 0
  const segmentRe = getReviewQuestionSegmentRegExpGi()
  segmentRe.lastIndex = 0
  let match = segmentRe.exec(cleanRawLine)
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
      match = segmentRe.exec(cleanRawLine)
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
    match = segmentRe.exec(cleanRawLine)
  }

  if (lastIndex < cleanRawLine.length) {
    parts.push(`<span class="review-line-text-fragment">${escapeHTML(cleanRawLine.slice(lastIndex))}</span>`)
  }

  if (parts.length === 0) {
    return `<span class="review-line-text-fragment">${escapeHTML(cleanRawLine)}</span>`
  }
  return `<div class="review-question-line-block">${parts.join('')}</div>`
}

/**
 * Heading for the wins-only block when wins and other completed tasks are both shown.
 * @param {number} count
 * @returns {string}
 */
function formatWinsSummaryHeading(count: number): string {
  return count === 1 ? '1 win' : `${count} wins`
}

/**
 * Wrap a summary subheading and body in `<details>` / `<summary>` for collapsible lists.
 * @param {string} detailsExtraClassNames classes after base `summary-details` (e.g. `summary-details-events`)
 * @param {string} summaryLabelPlainText visible heading (HTML-escaped)
 * @param {string} bodyInnerHtml markup after `</summary>`
 * @param {{ defaultOpen?: boolean, summaryExtraClasses?: string }=} opts first summary defaults open; later sections default closed
 * @returns {string}
 */
function wrapSummaryDetailsBlock(
  detailsExtraClassNames: string,
  summaryLabelPlainText: string,
  bodyInnerHtml: string,
  opts?: {| defaultOpen?: boolean, summaryExtraClasses?: string |},
): string {
  const extra = detailsExtraClassNames.trim()
  const classes = extra === '' ? 'summary-details' : `summary-details ${extra}`
  const defaultOpen = opts?.defaultOpen ?? true
  const summaryExtra = opts?.summaryExtraClasses != null ? opts.summaryExtraClasses.trim() : ''
  const summaryClasses = summaryExtra === '' ? 'summary-title' : `summary-title ${summaryExtra}`
  const openAttr = defaultOpen ? ' open' : ''
  return `<details class="${classes}"${openAttr}>
  <summary class="${summaryClasses}">${escapeHTML(summaryLabelPlainText)}</summary>
${bodyInnerHtml}
</details>`
}

/**
 * Build a summary of calendar events for the review period: count and total timed duration (all-day excluded from hours).
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @returns {string} HTML string for the summary block
 */
function makePeriodDaysSummaryDiv(eventsForPeriod: Array<TCalendarItem>): string {
  if (eventsForPeriod.length === 0) {
    return ''
  }
  const totalDuration = eventsForPeriod.reduce((total, event) => total + getEventDurationHours(event), 0)
  let title = `${eventsForPeriod.length} events`
  if (totalDuration > 0) {
    title += ` (${totalDuration.toFixed(1)} hours)`
  }
  const output = []
  output.push(`<div class="summary-content">`)
  eventsForPeriod.forEach((e) => {
    output.push(`\t<div class="summary-item">`)
    output.push(`\t\t<i aria-hidden="true" class="summary-item-icon event-icon fa-regular fa-calendar-week"></i>`)
    output.push(`\t\t<span class="summary-item-text">${e.title}</span>`)
    output.push('\t</div>')
  })
  output.push(`</div>`)
  return wrapSummaryDetailsBlock('summary-details-events', title, output.join('\n'), { defaultOpen: false })
}

/**
 * Placeholder for the calendar-events block while the WebView loads events via `Calendar.*`.
 * Client script replaces this with markup matching {@link makePeriodDaysSummaryDiv} (or removes it when there are no events).
 * @returns {string}
 */
function makeCalendarEventsSummaryMountHTML(): string {
  return `<details class="summary-details summary-details-events periodic-review-calendar-events-details-loading" id="periodic-review-calendar-events-details">
  <summary class="summary-title">Calendar events</summary>
  <div id="periodic-review-calendar-events-mount" class="periodic-review-calendar-events-mount">
    <div class="periodic-review-calendar-events-loading-msg">Loading calendar…</div>
  </div>
</details>`
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
 * Wrapped in `<details open>` so the heading matches other summary sections; first section stays expanded by default.
 * @param {Array<{ content: string, isDone: boolean }>} carryOverPlanItems
 * @returns {string} HTML or empty when none
 */
function makeCarryOverPlanSummaryContentDiv(
  planningSectionTitle: string,
  carryOverPlanItems: Array<{ content: string, isDone: boolean }>,
): string {
  const rows: Array<string> = []
  rows.push(`<div class="summary-content">`)
  if (carryOverPlanItems.length > 0) {
    carryOverPlanItems.forEach((item) => {
      if (item.isDone) {
        rows.push(`
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-icon item-completed-icon fa-solid fa-circle-check"></i>
        <span class="summary-item-text">${formatTaskAsHTML(item.content)}</span>
      </div>`)
      } else {
      rows.push(`
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-icon summary-item-incomplete-icon fa-regular fa-circle"></i>
        <span class="summary-item-text">${formatTaskAsHTML(item.content)}</span>
      </div>`)
      }
    })
  } else {
    rows.push(`<span class="summary-empty">No planned items found for this period</span>`)
  }
  rows.push(`</div>`)
  return wrapSummaryDetailsBlock('summary-details-carry-over-plan', planningSectionTitle, rows.join('\n'), {
    defaultOpen: true,
    summaryExtraClasses: 'plan-title h3',
  })
}

/**
 * HTML list rows for done tasks in the summary (wins or completed — same markup).
 * @param {Array<string>} taskLines
 * @returns {string}
 */
function formatSummaryTaskItemsHTML(taskLines: Array<string>): string {
  return taskLines
    .map(
      (taskLine) => `
      <div class="summary-item">
        <i aria-hidden="true" class="summary-item-icon item-completed-icon fa-regular fa-circle-check"></i>
        <span class="summary-item-text">${formatTaskAsHTML(taskLine)}</span>
      </div>`,
    )
    .join('\n')
}

/**
 * Singular or plural "task" / "tasks" for summary counts (0 uses "tasks").
 * @param {number} count
 * @returns {string}
 */
function pluralCompletedTaskWord(count: number): string {
  return count === 1 ? 'task' : 'tasks'
}

/**
 * Title row for the done-task summary: plain "N completed task(s)", or "N other completed task(s)" after a wins block.
 * @param {number} lineCount
 * @param {'plain' | 'other'} variant
 * @returns {string}
 */
function formatCompletedTasksSummaryHeading(lineCount: number, variant: 'plain' | 'other'): string {
  const w = pluralCompletedTaskWord(lineCount)
  if (variant === 'other') {
    return `${lineCount} other completed ${w}`
  }
  return `${lineCount} completed ${w}`
}

/**
 * Summary card: optional carry-over plan tasks, then one completed-task list (wins first: #win / #bigwin / `>>`, then other dones; each line once) and (daily only) calendar events.
 * @param {string} periodType
 * @param {Array<{ content: string, isDone: boolean }>} carryOverPlanItems
 * @param {Array<string>} winTasks
 * @param {Array<string>} completedTasks non-win completed tasks (daily only)
 * @param {Array<TCalendarItem>} eventsForPeriod server-built events when not using client summary
 * @returns {string} HTML for section-wrap or ''
 */
function buildReviewSummarySectionHTML(
  periodType: string,
  carryOverPlanItems: Array<{ content: string, isDone: boolean }>,
  planningSectionTitle: string,
  winTasks: Array<string>,
  completedTasks: Array<string>,
  eventsForPeriod: Array<TCalendarItem>
): string {
  const hasCarryOver = carryOverPlanItems.length > 0
  const isDay = periodType === 'day'
  const carryKeysOnly: Array<{ content: string }> = carryOverPlanItems.map((c) => ({ content: c.content }))
  /** Full list: unique wins (not in carry) first, then unique non-wins — same order as mergeUniqueSummaryDoneTaskLines. */
  const mergedCompletedLines: Array<string> = mergeUniqueSummaryDoneTaskLines(winTasks, completedTasks, carryKeysOnly)
  /** Split by the same win rules as note scanning (not by merge prefix length — avoids runtime mismatch). */
  const { wins: mergedWinsLines, others: mergedOtherLines } = splitMergedSummaryDoneLinesIntoWinsAndOthers(mergedCompletedLines)
  if (!hasCarryOver && !isDay && mergedCompletedLines.length === 0) {
    return ''
  }
  const parts: Array<string> = [
    '<div class="section-wrap" id="summary">',
  ]
  const carryBlock = makeCarryOverPlanSummaryContentDiv(planningSectionTitle, carryOverPlanItems)
  parts.push(carryBlock)

  const pushDoneTasksSummaryBlocks = () => {
    if (mergedCompletedLines.length === 0) {
      parts.push(
        wrapSummaryDetailsBlock(
          'summary-details-completed-tasks',
          formatCompletedTasksSummaryHeading(0, 'plain'),
          `<div class="summary-content summary-content-completed-tasks">\n<div class="summary-empty">No completed tasks found during the ${periodType}</div>\n</div>`,
          { defaultOpen: false },
        ),
      )
      return
    }
    if (mergedWinsLines.length > 0 && mergedOtherLines.length > 0) {
      parts.push(
        wrapSummaryDetailsBlock(
          'summary-details-completed-wins',
          formatWinsSummaryHeading(mergedWinsLines.length),
          `<div class="summary-content summary-content-completed-tasks">\n${formatSummaryTaskItemsHTML(mergedWinsLines)}\n</div>`,
          { defaultOpen: false },
        ),
      )
      parts.push(
        wrapSummaryDetailsBlock(
          'summary-details-completed-other',
          formatCompletedTasksSummaryHeading(mergedOtherLines.length, 'other'),
          `<div class="summary-content summary-content-completed-tasks">\n${formatSummaryTaskItemsHTML(mergedOtherLines)}\n</div>`,
          { defaultOpen: false },
        ),
      )
      return
    }
    const singleBlockLines = mergedWinsLines.length > 0 ? mergedWinsLines : mergedOtherLines
    parts.push(
      wrapSummaryDetailsBlock(
        'summary-details-completed-tasks',
        formatCompletedTasksSummaryHeading(singleBlockLines.length, 'plain'),
        `<div class="summary-content summary-content-completed-tasks">\n${formatSummaryTaskItemsHTML(singleBlockLines)}\n</div>`,
        { defaultOpen: false },
      ),
    )
  }

  if (isDay) {
    pushDoneTasksSummaryBlocks()
    parts.push(makePeriodDaysSummaryDiv(eventsForPeriod))
  } else if (mergedCompletedLines.length > 0) {
    pushDoneTasksSummaryBlocks()
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
  config: PeriodicReviewConfigType,
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
      control = `<textarea class="review-input" id="${fieldName}" name="${fieldName}" rows="3">${escapeHTML(initialValue)}</textarea>`
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
 * @tests in jest file
 * @param {JournalConfigType} config
 * @param {Array<ParsedQuestionType>} parsedQuestions same order as parseQuestions(rawQuestionLines) (field names q_0 …)
 * @param {Array<string>} rawQuestionLines lines from getQuestionsForPeriod()
 * @param {Array<string>} summaryWinTasks done tasks tagged as wins (#win / #bigwin / `>>`); listed first in the single summary list
 * @param {Array<string>} summaryCompletedTasks other done tasks (daily only; excludes win lines)
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} periodType
 * @param {Array<TCalendarItem>} eventsForPeriod
 * @param {string} callbackCommandName
 * @param {{ [string]: string }=} initialAnswers field names q_0 … to pre-fill from the calendar note
 * @param {{ carryOverPlanItems?: Array<{ content: string, isDone: boolean }>, planningSectionTitle?: string }=} reviewExtras carry-over plan tasks + planning block title
 * @param {Array<string>=} calendarSetForClientSummary calendars to include (empty = all), for WebView `Calendar.*` path
 * @param {string=} reviewDayYyyymmdd YYYYMMDD from `convertISOToYYYYMMDD(periodString)` when period is daily
 * @param {boolean=} overrideExperimentalClientCalendar override module flag: false forces server-rendered events; true forces client mount when daily + review day set
 * @returns {string}
 */
export function buildReviewHTML(
  config: PeriodicReviewConfigType,
  parsedQuestions: Array<ParsedQuestionType>,
  rawQuestionLines: Array<string>,
  summaryWinTasks: Array<string>,
  summaryCompletedTasks: Array<string>,
  periodString: string,
  periodType: string,
  eventsForPeriod: Array<TCalendarItem>,
  callbackCommandName: string,
  planName: string,
  initialAnswers?: { [string]: string },
  carryOverPlanItems?: Array<{ content: string, isDone: boolean }>,
  calendarSetForClientSummary?: Array<string>,
  reviewDayYyyymmdd?: string,
  overrideExperimentalClientCalendar?: ?boolean,
): string {
  const periodAdjective = getPeriodAdjectiveFromType(periodType)
  const resolvedInitialAnswers = initialAnswers ?? {}
  const resolvedCarryOver = carryOverPlanItems ?? []
  const calendarSetResolved: Array<string> = calendarSetForClientSummary ?? []
  const reviewDayResolved: string = reviewDayYyyymmdd ?? ''
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
    summaryWinTasks,
    summaryCompletedTasks,
    eventsForPeriod
  )
  const planningSectionHtml = planningSectionTitle !== '' ? makePlanningSectionHTML(planningSectionTitle) : ''

  return `
    <div class="review-title-row">
      <div class="h2 review-title">
        <span class="review-title-label">${escapeHTML(periodAdjective)} Review for
        <button class="review-period-step-button" type="button" id="review-period-prev" title="Previous period" aria-label="Previous period"><i class="fa-regular fa-angle-left"></i></button>
        ${escapeHTML(periodString)}
        <button class="review-period-step-button" type="button" id="review-period-next" title="Next period" aria-label="Next period"><i class="fa-regular fa-angle-right"></i></button>
      </div>
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

      <script>
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
      const periodPrevBtn = document.getElementById('review-period-prev')
      const periodNextBtn = document.getElementById('review-period-next')

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

      function navigatePeriod(direction) {
        console.log("HTMLView: navigatePeriod(" + direction + ") called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['navigatePeriod', {
          periodType: ${JSON.stringify(periodType)},
          periodString: ${JSON.stringify(periodString)},
          direction: direction,
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
      if (periodPrevBtn) {
        periodPrevBtn.addEventListener('click', function () {
          navigatePeriod('prev')
        })
      }
      if (periodNextBtn) {
        periodNextBtn.addEventListener('click', function () {
          navigatePeriod('next')
        })
      }
    </script>
  `
}
