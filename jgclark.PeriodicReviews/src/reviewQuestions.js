// @flow
//---------------------------------------------------------------
// Review question parsing, pre-fill extraction, and answer → note text.
// Jonathan Clark
// last update 2026-04-26 for v2.0.0.b12 by @jgclark + @Cursor
//---------------------------------------------------------------

import type { ParsedQuestionType } from './periodicReviewHelpers'
import { substituteReviewPeriodPlaceholders } from './periodicReviewHelpers'
import { escapeRegExp } from '@helpers/regex'
import { isInt } from '@helpers/userInput'

/** `<type>` names in review question templates — single source for parse + HTML segment splitting. (`integer` before `int` so `<integer>` matches as one token.) */
export const REVIEW_QUESTION_TYPE_NAMES_ALT =
  'string|integer|int|number|duration|boolean|mood|subheading|bullets|checklists|tasks'

/**
 * Strip `:`, parentheses, and angle-bracket type tokens (`<string>`, `<int>`, …) from a segment when deriving the human label.
 * Must match full `<type>` tags only — not bare names (e.g. `string` would wrongly match inside words and leave stray `<>`).
 */
const RE_SEGMENT_LABEL_STRIP = new RegExp(
  `:|\\(|\\)|<\\s*(?:${REVIEW_QUESTION_TYPE_NAMES_ALT.split('|')
    .map((t) => escapeRegExp(t))
    .join('|')})\\s*>`,
  'gi',
)

/**
 * TODO: pull these two to be just a constant.
 * RegExp matching one typed segment (e.g. `Sleep: <int> hours`) — same pattern as `parseQuestions` uses.
 * Callers should use a fresh instance per scan or reset `lastIndex` to avoid `/g` state bugs.
 * @returns {RegExp} global, case-insensitive
 */
export function getReviewQuestionSegmentRegExpGi(): RegExp {
  return new RegExp(`[^<]*?<\\s*(?:${REVIEW_QUESTION_TYPE_NAMES_ALT})\\s*>\\)?[^\\s]*`, 'gi')
}

/**
 * RegExp matching the type tag within a segment (first capture = type name).
 * @returns {RegExp}
 */
export function getReviewQuestionTypeTagRegExp(): RegExp {
  return new RegExp(`<\\s*(${REVIEW_QUESTION_TYPE_NAMES_ALT})\\s*>`, 'i')
}

const RE_DURATION_HHMM = /^(\d{1,2}):([0-5]\d)$/

/**
 * Parse question lines to extract questions and their types.
 * Supports multiple questions per line separated by '||'.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<string> | string} questionLines raw question lines from config
 * @returns {Array<ParsedQuestionType>}
 */
export function parseQuestions(questionLines: Array<string> | string): Array<ParsedQuestionType> {
  const parsed = []
  const typeRE = getReviewQuestionTypeTagRegExp()
  const segmentRE = getReviewQuestionSegmentRegExpGi()
  const linesToProcess = Array.isArray(questionLines) ? questionLines : String(questionLines ?? '').split('\n')

  for (let lineIndex = 0; lineIndex < linesToProcess.length; lineIndex++) {
    const line = linesToProcess[lineIndex]
    const mH2 = line.match(/^##\s+(.+)$/)
    if (mH2) {
      parsed.push({ question: String(mH2[1] ?? '').trim(), type: 'h2', originalLine: line, lineIndex })
      continue
    }
    const mH3 = line.match(/^###\s+(.+)$/)
    if (mH3) {
      parsed.push({ question: String(mH3[1] ?? '').trim(), type: 'h3', originalLine: line, lineIndex })
      continue
    }
    const questionParts = line.split(/\s*\|\|\s*/).map(part => part.trim()).filter(part => part !== '')

    for (const questionPart of questionParts) {
      const segments = questionPart.match(segmentRE) ?? []
      for (const segmentRaw of segments) {
        const segment = segmentRaw.trim()
        const reArray = segment.match(typeRE)
        let questionType = String(reArray?.[1] ?? '<error in question type>').toLowerCase()
        if (questionType === 'integer') {
          questionType = 'int'
        }
        const tokenMatch = segment.match(/([@#][^\s(<]+)/)
        const question = tokenMatch?.[1] ?? segment.replace(RE_SEGMENT_LABEL_STRIP, '').trim()
        parsed.push({ question, type: questionType, originalLine: segment, lineIndex })
      }
    }
  }

  return parsed
}

/**
 * Handle an HTML heading question type.
 * @param {string} question the question text
 * @param {string} headingType 'subheading' (legacy; subheading uses same marker as h3)
 * @returns {string} the formatted markdown heading block
 */
function handleHeadingQuestion(question: string, headingType: string): string {
  const cleanHeading = question.replace(/<\s*subheading\s*>\s*$/i, '').trim()
  const headingMarker = headingType === 'h2' ? '##' : '###'
  return `\n${headingMarker} ${cleanHeading}`
}

/** Output prefix per line for multiline journal types (`<bullets>`, `<checklists>`, `<tasks>`). */
const MULTILINE_ANSWER_PREFIX_BY_TYPE: { [string]: string } = {
  bullets: '- ',
  checklists: '+ ',
  tasks: '* ',
}

/**
 * Markdown prefix written before each answer line for a multiline question type.
 * @param {string} questionType
 * @returns {string}
 */
function linePrefixForMultilineAnswerType(questionType: string): string {
  return MULTILINE_ANSWER_PREFIX_BY_TYPE[questionType.toLowerCase()] ?? ''
}

/**
 * Remove leading line markers from saved note text so the review textarea shows plain lines.
 * @param {string} rawBlock
 * @param {string} linePrefix e.g. '- '
 * @returns {string}
 */
function stripMultilineAnswerPrefixes(rawBlock: string, linePrefix: string): string {
  if (linePrefix === '') {
    return rawBlock.trim()
  }
  return rawBlock
    .split(/\r?\n/)
    .map((l) => {
      const trimmed = l.trim()
      if (trimmed.startsWith(linePrefix)) {
        return trimmed.slice(linePrefix.length).trim()
      }
      return trimmed
    })
    .join('\n')
    .trim()
}

/**
 * Split a question segment at the typed marker (same idea as reviewHTMLViewGenerator.splitSegmentAtTypeMarker).
 * @param {string} segment
 * @param {string} questionType
 * @returns {{ prefix: string, suffix: string }}
 */
function splitParsedSegmentAtTypeMarker(segment: string, questionType: string): {| prefix: string, suffix: string |} {
  const pattern =
    questionType.toLowerCase() === 'int'
      ? '<\\s*(?:integer|int)\\s*>'
      : `<\\s*${escapeRegExp(questionType)}\\s*>`
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
 * Normalize a line prefix used to match `<string>` answers against existing note content.
 * @param {string} input
 * @returns {string}
 */
function normalizeStringMatchKey(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Return stable match key for a parsed `<string>` question segment (text before the `<string>` tag).
 * Empty key means this question should not attempt line upsert matching.
 * @param {ParsedQuestionType} parsedQuestion
 * @returns {string}
 */
export function getStringQuestionMatchKeyFromParsedQuestion(parsedQuestion: ParsedQuestionType): string {
  if (String(parsedQuestion.type).toLowerCase() !== 'string') {
    return ''
  }
  const { prefix } = splitParsedSegmentAtTypeMarker(String(parsedQuestion.originalLine ?? ''), 'string')
  const key = normalizeStringMatchKey(prefix)
  return key.startsWith('-') ? '' : key
}

/**
 * Return the `<string>` question match key corresponding to an output line, if any.
 * @param {string} outputLine
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @returns {string}
 */
export function getStringQuestionMatchKeyFromOutputLine(outputLine: string, parsedQuestions: Array<ParsedQuestionType>): string {
  const normalizedOutput = normalizeStringMatchKey(outputLine)
  if (normalizedOutput === '') {
    return ''
  }
  const candidateKeys = parsedQuestions
    .map((pq) => getStringQuestionMatchKeyFromParsedQuestion(pq))
    .filter((k) => k !== '')
    .sort((a, b) => b.length - a.length)
  const matchedKey = candidateKeys.find((k) => normalizedOutput.startsWith(k))
  return matchedKey ?? ''
}

/**
 * Parse one line of note content for a single parsed question's answer (form-ready value). Match for question in case-insensitive way.
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string} line
 * @returns {string} value for the HTML control, or '' if not found on this line
 */
function extractExistingAnswerOnLine(parsedQuestion: ParsedQuestionType, line: string): string {
  const t = parsedQuestion.type.toLowerCase()
  const seg = parsedQuestion.originalLine.trim()
  const token = parsedQuestion.question
  if (t === 'subheading' || t === 'h2' || t === 'h3') {
    return ''
  }
  if (t === 'boolean') {
    const token = parsedQuestion.question
    if (!token) {
      return ''
    }
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`)
    return re.test(line) ? 'yes' : ''
  }
  const { prefix, suffix } = splitParsedSegmentAtTypeMarker(seg, parsedQuestion.type)
  if (t === 'int') {
    if (token && token.startsWith('@')) {
      const tokenIntRE = new RegExp(`${escapeRegExp(token)}\\s*\\(\\s*(\\d+)\\s*\\)`, 'i')
      const tokenIntMatch = line.match(tokenIntRE)
      if (tokenIntMatch?.[1] != null) {
        return tokenIntMatch[1]
      }
    }
    const re = new RegExp(`${escapeRegExp(prefix)}(\\d+)${escapeRegExp(suffix)}`)
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'number') {
    if (token && token.startsWith('@')) {
      const tokenNumberRE = new RegExp(
        `${escapeRegExp(token)}\\s*\\(\\s*([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s*\\)`,
        'i',
      )
      const tokenNumberMatch = line.match(tokenNumberRE)
      if (tokenNumberMatch?.[1] != null) {
        return tokenNumberMatch[1]
      }
    }
    const re = new RegExp(
      `${escapeRegExp(prefix)}([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)${escapeRegExp(suffix)}`,
    )
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'duration') {
    if (token && token.startsWith('@')) {
      const tokenDurationRE = new RegExp(`${escapeRegExp(token)}\\s*\\(\\s*(\\d{1,2}:[0-5]\\d)\\s*\\)`, 'i')
      const tokenDurationMatch = line.match(tokenDurationRE)
      if (tokenDurationMatch?.[1] != null) {
        return tokenDurationMatch[1]
      }
    }
    const re = new RegExp(`${escapeRegExp(prefix)}(\\d{1,2}:[0-5]\\d)${escapeRegExp(suffix)}`)
    const m = line.match(re)
    return m?.[1] != null ? m[1] : ''
  }
  if (t === 'bullets' || t === 'checklists' || t === 'tasks') {
    const marker = linePrefixForMultilineAnswerType(t)
    const { prefix: p2, suffix: s2 } = splitParsedSegmentAtTypeMarker(seg, parsedQuestion.type)
    if (s2 === '') {
      if (p2 === '') {
        const trimmed = line.trim()
        if (!trimmed.startsWith(marker.trim())) {
          return ''
        }
        return stripMultilineAnswerPrefixes(trimmed, marker)
      }
      const idx = line.toLowerCase().indexOf(p2.toLowerCase())
      if (idx < 0) {
        return ''
      }
      const raw = line.slice(idx + p2.length).trim()
      if (raw === '') {
        return ''
      }
      return stripMultilineAnswerPrefixes(raw, marker)
    }
    const re = new RegExp(`${escapeRegExp(p2)}([\\s\\S]*?)${escapeRegExp(s2)}`, 'i')
    const m = line.match(re)
    if (m?.[1] == null) {
      return ''
    }
    return stripMultilineAnswerPrefixes(m[1].trim(), marker)
  }
  if (t === 'mood' || t === 'string') {
    if (suffix === '') {
      if (prefix === '') {
        return ''
      }
      const idx = line.toLowerCase().indexOf(prefix.toLowerCase())
      if (idx < 0) {
        return ''
      }
      return line.slice(idx + prefix.length).trim()
    }
    const re = new RegExp(`${escapeRegExp(prefix)}(.*?)${escapeRegExp(suffix)}`, 'i')
    const m = line.match(re)
    return m?.[1] != null ? m[1].trim() : ''
  }
  return ''
}

/**
 * Get first matching answer in the note for question
 * @param {ParsedQuestionType} parsedQuestion
 * @param {Array<string>} textLines
 * @returns {string}
 */
function extractExistingAnswerForReviewForm(parsedQuestion: ParsedQuestionType, textLines: Array<string>): string {
  for (let i = 0; i <= textLines.length - 1; i++) {
    const line = textLines[i]
    const v = extractExistingAnswerOnLine(parsedQuestion, line)
    if (v !== '') {
      return v
    }
  }
  return ''
}

/**
 * Map field names q_0, q_1, … to existing answers in the calendar note for pre-filling the review HTML form.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<string>} textLines text of lines to scan
 * @returns {{ [string]: string }}
 */
export function buildInitialReviewAnswersByFieldName(
  parsedQuestions: Array<ParsedQuestionType>,
  textLines: Array<string>,
): { [string]: string } {
  const out: { [string]: string } = {}
  for (let i = 0; i < parsedQuestions.length; i++) {
    const pq = parsedQuestions[i]
    const v = extractExistingAnswerForReviewForm(pq, textLines)
    if (v !== '') {
      out[`q_${i}`] = v
    }
  }
  return out
}

/**
 * Convert parsed questions into line-indexed groups.
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @returns {{ [number]: Array<ParsedQuestionType> }}
 */
function groupQuestionsByLine(parsedQuestions: Array<ParsedQuestionType>): { [number]: Array<ParsedQuestionType> } {
  const questionsByLine: { [number]: Array<ParsedQuestionType> } = {}
  for (let i = 0; i < parsedQuestions.length; i++) {
    const q = parsedQuestions[i]
    if (!questionsByLine[q.lineIndex]) {
      questionsByLine[q.lineIndex] = []
    }
    questionsByLine[q.lineIndex].push(q)
  }
  return questionsByLine
}

/**
 * Convert answer payload from single window into output line for one parsed question.
 * @param {ParsedQuestionType} parsedQuestion
 * @param {string | boolean} answerRaw
 * @returns {string}
 */
function answerFromReviewWindowPayload(parsedQuestion: ParsedQuestionType, answerRaw: string | boolean): string {
  const t = parsedQuestion.type
  if (t === 'boolean') {
    const on = answerRaw === true || answerRaw === 'yes'
    return on ? parsedQuestion.question : ''
  }
  const answer = (typeof answerRaw === 'string' ? answerRaw : String(answerRaw ?? '')).trim()
  if (answer === '' && t !== 'subheading' && t !== 'h2' && t !== 'h3') {
    return ''
  }
  switch (t) {
    case 'int': {
      if (isInt(answer)) {
        return parsedQuestion.originalLine.startsWith('-')
          ? `- ${answer}`
          : parsedQuestion.originalLine.replace(/<\s*(?:integer|int)\s*>/i, answer)
      }
      return ''
    }
    case 'number': {
      if (answer != null && Number(answer)) {
        return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<number>/, answer)
      }
      return ''
    }
    case 'duration': {
      if (RE_DURATION_HHMM.test(answer)) {
        return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<duration>/, answer)
      }
      return ''
    }
    case 'string': {
      return parsedQuestion.originalLine.startsWith('-') ? `- ${answer}` : parsedQuestion.originalLine.replace(/<string>/, answer)
    }
    case 'mood': {
      return parsedQuestion.originalLine.replace(/<mood>/, answer)
    }
    case 'bullets':
    case 'checklists':
    case 'tasks': {
      const marker = linePrefixForMultilineAnswerType(t)
      const lines = answer.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
      if (lines.length === 0) {
        return ''
      }
      const formatted = lines.map((l) => `${marker}${l}`).join('\n')
      const ol = parsedQuestion.originalLine
      if (ol.trimStart().startsWith('-')) {
        return formatted
      }
      const { prefix, suffix } = splitParsedSegmentAtTypeMarker(ol, t)
      const prefixTrimmed = prefix.trimEnd()
      if (prefixTrimmed === '') {
        return `${formatted}${suffix}`
      }
      return `${prefixTrimmed}\n${formatted}${suffix}`
    }
    case 'subheading': {
      return handleHeadingQuestion(parsedQuestion.question, 'subheading')
    }
    case 'h2': {
      return handleHeadingQuestion(parsedQuestion.question, 'h2')
    }
    case 'h3': {
      return handleHeadingQuestion(parsedQuestion.question, 'h3')
    }
    default: {
      return ''
    }
  }
}

/**
 * Build output from answers returned by single-window mode.
 * @tests in __tests__/periodReviews.test.js
 * @param {Array<ParsedQuestionType>} parsedQuestions
 * @param {Array<string>} rawQuestionLines
 * @param {string} periodString
 * @param {string} periodType for journal questions: 'day', 'week', 'month', 'quarter', 'year'
 * @param {{ [string]: string | boolean }} answersByIndex
 * @returns {string}
 */
export function buildOutputFromReviewWindowAnswers(
  parsedQuestions: Array<ParsedQuestionType>,
  rawQuestionLines: Array<string>,
  periodString: string,
  periodType: string,
  answersByIndex: { [string]: string | boolean },
): string {
  let output = ''
  const questionsByLine = groupQuestionsByLine(parsedQuestions)
  const lineCount = rawQuestionLines.length
  const stripPresentationDelimiters = (input: string): string => input.replace(/ \|\| /g, ' ')

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    const lineQuestions = questionsByLine[lineIndex] ?? []
    const lineAnswers: Array<string> = []
    for (let i = 0; i < lineQuestions.length; i++) {
      const globalIndex = parsedQuestions.findIndex((q) => q === lineQuestions[i])
      const parsedQuestion = lineQuestions[i]
      const answer = answerFromReviewWindowPayload(parsedQuestion, answersByIndex[`q_${globalIndex}`] ?? '')
      if (answer !== '') {
        lineAnswers.push(answer)
      }
    }
    if (lineAnswers.length > 0) {
      const hasMultiline = lineAnswers.some((a) => a.includes('\n'))
      let combinedLine = hasMultiline ? lineAnswers.join('\n') : lineAnswers.join(' ')
      if (!hasMultiline) {
        combinedLine = combinedLine.replace(/\s+/g, ' ')
      }
      output += `${substituteReviewPeriodPlaceholders(combinedLine, periodString, periodType)}\n`
      continue
    }

    const rawLine = rawQuestionLines[lineIndex] ?? ''
    if (/<\s*date\s*>/i.test(rawLine) || /<\s*(?:datenext|nextdate)\s*>/i.test(rawLine)) {
      const substituted = substituteReviewPeriodPlaceholders(stripPresentationDelimiters(rawLine), periodString, periodType).trim()
      if (substituted !== '') {
        output += `${substituted}\n`
      }
    }
  }
  return output
}
