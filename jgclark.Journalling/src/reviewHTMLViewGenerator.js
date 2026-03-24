// @flow
//---------------------------------------------------------------
// HTMLView generation helpers for single-window review mode
// Jonathan Clark + Cursor
// last update 2026-03-23 for v2.0.0.b1 by @jgclark + @Cursor
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { JournalConfigType, ParsedQuestionType } from './journalHelpers'
import { makePluginCommandButton } from '@helpers/HTMLView.js'

//-----------------------------------------------------------------------------
// Constants

const useFlexbox = true

// Keep in sync with parseQuestions() in journal.js (segment extraction).
const REVIEW_SEGMENT_RE = new RegExp('[^<]*?<\\s*(?:string|int|number|boolean|mood|subheading)\\s*>\\)?[^\\s]*', 'gi')

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
function makeReviewInlineControl(parsedQuestion: ParsedQuestionType, globalIndex: number, config: JournalConfigType): string {
  const fieldName = `q_${globalIndex}`
  switch (parsedQuestion.type) {
    case 'boolean': {
      return `<input class="review-checkbox" id="${fieldName}" name="${fieldName}" type="checkbox" value="yes" />`
    }
    case 'int':
    case 'number': {
      return `<input class="review-input review-input-short review-input-inline" id="${fieldName}" name="${fieldName}" type="text" value="" />`
    }
    case 'mood': {
      const moodArray = typeof config.moods === 'string' ? config.moods.split(',').map((m) => m.trim()) : config.moods
      const moodOptions = moodArray
        .filter((m) => m !== '')
        .map((mood) => `<option value="${escapeHTML(mood)}">${escapeHTML(mood)}</option>`)
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
): string {
  const cleanRawLine = stripPresentationDelimiters(rawLine)
  if (cleanRawLine.trim() === '') {
    return ''
  }

  const lineQuestionsOrdered: Array<{| q: ParsedQuestionType, globalIndex: number |}> = parsedQuestions
    .map((q, globalIndex) => ({ q, globalIndex }))
    .filter(({ q }) => q.lineIndex === lineIndex)

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
    if (pq.type === 'string' || pq.type === 'subheading') {
      parts.push(`<div class="review-raw-question-line-block">${makeReviewQuestionRowDiv(pq, globalIndex, config)}</div>`)
    } else {
      const { prefix, suffix } = splitSegmentAtTypeMarker(segmentTrimmed, pq.type)
      const control = makeReviewInlineControl(pq, globalIndex, config)
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
    return `<div class="review-raw-question-line"><span class="review-line-text-fragment">${escapeHTML(cleanRawLine)}</span></div>`
  }
  return `<div class="review-raw-question-line">${parts.join('')}</div>`
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
  config: JournalConfigType
): string {
  const fieldName = `q_${index}`
  if (parsedQuestion.type === 'subheading') {
    const cleanSubheading = stripPresentationDelimiters(parsedQuestion.question)
    return `<div class="review-subheading">${escapeHTML(cleanSubheading)}</div>`
  }

  const questionText = stripPresentationDelimiters(parsedQuestion.question).trim()
  const questionLabel = `<label class="review-label" for="${fieldName}">${escapeHTML(questionText)}</label>`
  let control = ''
  const useInlineRow = useFlexbox && parsedQuestion.type !== 'string' && parsedQuestion.type !== 'subheading'
  const rowClass = useInlineRow ? 'review-row review-row-inline' : 'review-row'
  switch (parsedQuestion.type) {
    case 'boolean': {
      control = `<input class="review-checkbox" id="${fieldName}" name="${fieldName}" type="checkbox" value="yes" />`
      break
    }
    case 'int':
    case 'number': {
      control = `<input class="review-input review-input-short" id="${fieldName}" name="${fieldName}" type="text" value="" />`
      break
    }
    case 'mood': {
      const moodArray = (typeof config.moods === 'string') ? config.moods.split(',').map((m) => m.trim()) : config.moods
      const moodOptions = moodArray
        .filter((m) => m !== '')
        .map((mood) => `<option value="${escapeHTML(mood)}">${escapeHTML(mood)}</option>`)
        .join('')
      control = `<select class="review-input review-input-fit" id="${fieldName}" name="${fieldName}">
        <option value="">Skip</option>
        ${moodOptions}
      </select>`
      break
    }
    case 'string':
    default: {
      control = `<textarea class="review-input" id="${fieldName}" name="${fieldName}" rows="3"></textarea>`
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
 * @param {string} periodAdjective
 * @param {string} periodString the calendar note title string for the review period
 * @param {string} callbackCommandName
 * @returns {string}
 */
export function buildReviewHTML(
  config: JournalConfigType,
  parsedQuestions: Array<ParsedQuestionType>,
  rawQuestionLines: Array<string>,
  periodAdjective: string,
  periodType: string,
  periodString: string,
  callbackCommandName: string,
): string {
  const questionRows = rawQuestionLines
    .map((line, lineIndex) => makeReviewRawQuestionLineDiv(line, lineIndex, parsedQuestions, config))
    .filter((row) => row !== '')
    .join('\n')
  return `
    <h2 class="review-title">${escapeHTML(periodAdjective)} Review for ${periodString}</h2>
    <!--
    <div class="section-wrap">
      <p class="review-description">Something here ...</p>
    </div>
    -->
    <div class="section-wrap">
      <form id="review-form" class="review-form">
        ${questionRows}
        <div class="review-actions">
          <button class="review-button" type="button" id="review-cancel" onclick=cancel()>Cancel</button>
          <!--${makePluginCommandButton('Cancel', pluginJson['plugin.id'], 'onReviewWindowAction', 'cancel', 'Cancel', true)} -->
          <!-- type="submit" -->
          <button class="review-button review-button-primary" type="button"  id="review-submit" onclick=submit()>Save</button>
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
        hasSentReviewAction = true
        // Use x-callback-url to avoid relying on DataStore in the WebView JS runtime.
        const actionName = String(commandArgs?.[0] ?? '')
        const payload = commandArgs?.[1] ?? {}
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
      }
      const reviewForm = document.getElementById('review-form')
      const cancelButton = document.getElementById('review-cancel')

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
        // Add a special 'answer's for the period type (day, week, month, quarter, year) and string (e.g. '2026-03-23')
        answers['periodType'] = '${periodType}'
        answers['periodString'] = '${periodString}'
        console.log("collectAnswers(): -> "+JSON.stringify(answers))
        return answers
      }

      function cancel() {
        console.log("HTMLView: cancel() called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['cancel', { }])
      }

      function submit() {
        console.log("HTMLView: submit() called")
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['submit', JSON.stringify(collectAnswers())])
      }

      const firstInputControl = reviewForm.querySelector('textarea, input:not([type="hidden"]), select')
      if (firstInputControl && typeof firstInputControl.focus === 'function') {
        firstInputControl.focus()
      }

<!--
      reviewForm.addEventListener('submit', function (event) {
        event.preventDefault()
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['submit', JSON.stringify(collectAnswers())])
      })
      console.log("HTMLView: added EL to reviewForm")

      cancelButton.addEventListener('click', function () {
        sendToPlugin('${callbackCommandName}', '${pluginJson['plugin.id']}', ['cancel', { }])
      })
      console.log("HTMLView: added EL to cancelButton")
-->
    </script>
  `
}

