// @flow
//--------------------------------------------------------------------------
// Shared: turn a raw task line string into HTML matching NotePlan-style display
// (hashtags, mentions, links, etc.) for TaskItem (via ItemContent) and ProjectItem.
// Last updated 2026-10-12 for v2.6.0 by @jgclark/@Cursor
//--------------------------------------------------------------------------

import { getNoteIconDisplayProps } from '../noteIconDisplay.js'
import type { TDashboardSettings, TLinkedNoteIconInfo, TSectionItem } from '../types.js'
import type { TReminderDisplayById } from '@helpers/NPReminders'
import { replaceArrowDatesInString } from '@helpers/dateTime'
import { contentWithoutDueDate, replaceFarDueDatesWithChips } from '@helpers/dueStartDates'
import { logError } from '@helpers/react/reactDev.js'
import {
  changeBareLinksToHTMLLink,
  changeMarkdownLinksToHTMLLink,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString,
  truncateHTML,
} from '@helpers/stringTransforms'
import {
  convertBoldAndItalicToHTML,
  convertHashtagsToHTML,
  convertHighlightsToHTML,
  convertMentionsToHTML,
  makeRepeatMarkerHTML,
  convertNPReminderIDToHTML,
  convertNPBlockIDToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  convertUnderlinedToHTML,
  findNoteLinksForDisplay,
  simplifyInlineImagesForHTML,
  simplifyNPEventLinksForHTML,
} from '@helpers/HTMLView'
import { RE_SCHEDULED_DATES_G } from '@helpers/regex'
import { prepareTimeBlockContentForDisplay } from '@helpers/timeblocks'

export type TDashboardLineDisplayOptions = {
  truncateLength?: number,
  taskPriority?: number,
  startTime?: string,
  endTime?: string,
  timeblockTextMustContainString?: string,
  noteTitle?: string,
  linkedNoteIcons?: { [string]: TLinkedNoteIconInfo },
  reminderDisplayById?: TReminderDisplayById,
  /** When true, keep >today and >this-week on the line (regular notes). Calendar rows still drop those as redundant. */
  keepRelativeScheduledDates?: boolean,
  /** Days ahead at which the countdown chip starts. Due dates further out stay in the task text as an ok chip. */
  showDueDatesWithinDays?: number,
  /** Far due-date chips use a relative date ("in 3 wks") instead of YYYY-MM-DD. */
  showFarDueDateAsRelative?: boolean,
}

/**
 * Apply dashboard display toggles to HTML already produced by makeStringContentToLookLikeNPDisplayInReact / makeParaContentToLookLikeNPDisplayInReact.
 * Mirrors post-processing in ItemContent (scheduled dates visibility, priority marker hiding).
 * @param {string} mainContent
 * @param {TDashboardSettings} dashboardSettings
 * @returns {string}
 */
export function applyDashboardSettingsToDisplayedItemHtml(mainContent: string, dashboardSettings: TDashboardSettings): string {
  let out = mainContent
  if (out && !dashboardSettings.showScheduledDates) {
    // Remove scheduled-date lozenges first, then any remaining raw >dates
    out = out.replace(/<span class="scheduledDate">[\s\S]*?<\/span>/g, '')
    out = replaceArrowDatesInString(out, '')
  }
  const shouldRemove = dashboardSettings && dashboardSettings.hidePriorityMarkers === true
  if (shouldRemove && out) {
    out = out.replace(/(<span[^>]*>)(.*?)(<\/span>)/g, (_match, startTag, content, endTag) => {
      const replaced = content.replace(/^(!{1,3}|>>)\s+/g, '')
      return `${startTag}${replaced}${endTag}`
    })
  }
  return out
}

/**
 * Wrap string with onClick to show note in editor, using noteTitle param.
 * @param {string} noteTitle - full wiki inner title used for open (may include #heading)
 * @param {string} folderNamePart
 * @param {string} displayText - visible label (may be aliased / truncated)
 * @param {?TLinkedNoteIconInfo} linkedIconInfo - optional FM icon for the linked note
 * @returns {string}
 */
function makeNoteTitleWithOpenActionFromTitle(
  noteTitle: string,
  folderNamePart: string,
  displayText: string = noteTitle,
  linkedIconInfo: ?TLinkedNoteIconInfo = null,
): string {
  try {
    const titleKey = noteTitle.split('#')[0]
    const { iconClassName, iconStyleAttr } = getNoteIconDisplayProps({
      icon: linkedIconInfo?.icon,
      iconColor: linkedIconInfo?.iconColor,
      filenameOrTitle: linkedIconInfo?.filename ?? titleKey,
    })
    const styleAttr = iconStyleAttr ? ` style="${iconStyleAttr}"` : ''
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID:'fake', actionType:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(
      noteTitle,
    )}'})"><i class="${iconClassName}"${styleAttr}></i> ${folderNamePart}${displayText}</a>`
  } catch (error) {
    logError('makeNoteTitleWithOpenActionFromTitle', `${error.message} for input '${noteTitle}'`)
    return '(makeNoteTitle... error)'
  }
}

/**
 * Lift `@repeat(...)` tokens out of the line so they can be shown after the task text
 * (and after any priority highlight wrapper).
 * Skips a token that sits inside an HTML tag (for example an href) so link URLs stay intact.
 * Must run before `convertMentionsToHTML`, which would otherwise style `@repeat(...)` as a plain @mention.
 * @param {string} input
 * @returns {{ rest: string, markersHtml: string }}
 */
function extractRepeatMarkers(input: string): { rest: string, markersHtml: string } {
  const markers: Array<string> = []
  const withoutTokens = input.replace(/\B@repeat\([^)]*\)/g, (repeatStr, offset) => {
    const before = input.slice(0, offset)
    const lastOpen = before.lastIndexOf('<')
    const lastClose = before.lastIndexOf('>')
    if (lastOpen > lastClose) {
      return repeatStr
    }
    markers.push(makeRepeatMarkerHTML(repeatStr))
    return ''
  })
  const rest = withoutTokens.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
  return { rest, markersHtml: markers.join(' ') }
}

/**
 * Turn scheduled `>date` markers into calendar lozenges.
 * A due date written `!>YYYY-MM-DD` starts with `>` too; leave that marker for the due-date chip.
 * @param {string} output
 * @returns {string}
 */
function replaceScheduledDatesWithLozenges(output: string): string {
  const re = new RegExp(RE_SCHEDULED_DATES_G.source, 'g')
  let result = ''
  let lastIndex = 0
  for (const match of output.matchAll(re)) {
    const index = match.index
    if (typeof index !== 'number') continue
    if (index > 0 && output.charAt(index - 1) === '!') continue
    const capture = match[0]
    const dateText = capture.startsWith('>') ? capture.slice(1) : capture
    const lozenge = `<span class="scheduledDate"><i class="fa-regular fa-calendar pad-right"></i>${dateText}</span>`
    result += `${output.slice(lastIndex, index)}${lozenge}`
    lastIndex = index + capture.length
  }
  return `${result}${output.slice(lastIndex)}`
}

/**
 * Produce HTML from a raw line string to mimic NP's native display (same pipeline as task rows).
 * @param {string} content - raw paragraph content
 * @param {TDashboardLineDisplayOptions} options
 * @returns {string} HTML string
 */
export function makeStringContentToLookLikeNPDisplayInReact(content: string, options?: TDashboardLineDisplayOptions): string {
  const truncateLength = options?.truncateLength ?? 0
  const taskPriority = options?.taskPriority ?? 0
  const startTime = options?.startTime
  const endTime = options?.endTime
  const timeblockTextMustContainString = options?.timeblockTextMustContainString ?? ''
  const noteTitle = options?.noteTitle ?? ''
  const linkedNoteIcons = options?.linkedNoteIcons
  const reminderDisplayById = options?.reminderDisplayById
  const keepRelativeScheduledDates = options?.keepRelativeScheduledDates === true
  const showDueDatesWithinDays = options?.showDueDatesWithinDays
  const showFarDueDateAsRelative = options?.showFarDueDateAsRelative === true

  try {
    if (content == null || content === '') {
      return ''
    }
    const origContent = content
    if (noteTitle === '(error)') {
      logError('makeStringContentToLookLikeNPDisplayInReact', `ERROR starting with noteTitle '(error)' for '${origContent}'`)
    }

    let output = origContent
    let timeBlockLabel = ''
    let repeatMarkersHtml = ''

    // Convert NP calendar event links (and inline images) before timeblock handling, so embedded event
    // times are not stripped from the raw `![📅](...)` path and the link can still be recognised.
    output = simplifyNPEventLinksForHTML(output)
    output = simplifyInlineImagesForHTML(output)

    // For timeblocks: strip TB + must-contain from content, and keep a leading label from startTime/endTime
    if (startTime && startTime !== 'none') {
      const prepared = prepareTimeBlockContentForDisplay(output, startTime, endTime, timeblockTextMustContainString)
      timeBlockLabel = prepared.timeLabel
      output = prepared.restContent
    }

    // Note links (including [alias]([[title]])) before markdown-link conversion so aliases are not treated as external URLs
    const noteLinks = findNoteLinksForDisplay(output)
    for (const noteLink of noteLinks) {
      const titleKey = noteLink.noteTitleInner.split('#')[0]
      const linkedIconInfo = linkedNoteIcons ? linkedNoteIcons[titleKey] : null
      const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromTitle(
        noteLink.noteTitleInner,
        '',
        noteLink.displayText,
        linkedIconInfo,
      )
      output = `${output.slice(0, noteLink.startIndex)}</a>${noteTitleWithOpenAction}<a>${output.slice(noteLink.startIndex + noteLink.fullMatch.length)}`
    }

    output = changeMarkdownLinksToHTMLLink(output)
    output = changeBareLinksToHTMLLink(output, true, truncateLength)
    output = convertHashtagsToHTML(output)
    // Convert @remind(<UUID>) after hashtags (hex in marker styles) but before @mentions (@remind looks like a mention)
    output = convertNPReminderIDToHTML(output, reminderDisplayById)
    // @repeat(...) also looks like a mention; lift it out before mention styling and append after priority highlighting
    const extractedRepeats = extractRepeatMarkers(output)
    output = extractedRepeats.rest
    repeatMarkersHtml = extractedRepeats.markersHtml
    output = convertMentionsToHTML(output)
    output = convertPreformattedToHTML(output)

    // Place the timeblock lozenge at the start of the displayed text
    if (timeBlockLabel) {
      output = `<span class="timeBlock margin-right-larger"><i class="fa-regular fa-clock pad-right"></i>${timeBlockLabel}</span>${output}`
    }

    output = convertStrikethroughToHTML(output)
    output = convertHighlightsToHTML(output)
    output = convertNPBlockIDToHTML(output)
    // Calendar rows drop >today / >this-week (the section already is that period).
    // Regular notes keep them: Move to Note appends that >date, and it has to stay visible.
    if (!keepRelativeScheduledDates) {
      output = stripTodaysDateRefsFromString(output)
      output = stripThisWeeksDateRefsFromString(output)
    }
    output = stripBackwardsDateRefsFromString(output)
    output = convertBoldAndItalicToHTML(output)
    output = convertUnderlinedToHTML(output)

    output = replaceScheduledDatesWithLozenges(output)

    // Due dates further ahead than the countdown window stay in the task text, as an ok-colored chip.
    output = replaceFarDueDatesWithChips(output, showDueDatesWithinDays, showFarDueDateAsRelative)

    if (truncateLength > 0 && origContent.length > truncateLength) {
      output = truncateHTML(output, truncateLength, true)
    }

    if (taskPriority > 0) {
      output = `<span class="priority${String(taskPriority)}">${output}</span>`
    }

    // After the priority span, so the marker keeps tag/mention colour rather than the priority highlight
    if (repeatMarkersHtml) {
      output = output ? `${output} ${repeatMarkersHtml}` : repeatMarkersHtml
    }

    return output
  } catch (error) {
    logError(`makeStringContentToLookLikeNPDisplayInReact`, error.message)
    return ''
  }
}

/**
 * Produce HTML for a section item paragraph (delegates to makeStringContentToLookLikeNPDisplayInReact).
 * @param {TSectionItem} thisItem
 * @param {number} truncateLength
 * @param {string} timeblockTextMustContainString
 * @param {boolean} suppressDueDate - drop the in-window `!YYYY-MM-DD` or `!>YYYY-MM-DD` when a countdown chip is shown for this line
 * @param {number} showDueDatesWithinDays - countdown window; farther due dates render in the task text
 * @param {boolean} showFarDueDateAsRelative - far due chips use a relative date instead of YYYY-MM-DD
 * @returns {string}
 */
export function makeParaContentToLookLikeNPDisplayInReact(
  thisItem: TSectionItem,
  truncateLength: number = 0,
  timeblockTextMustContainString: string = '',
  reminderDisplayById?: TReminderDisplayById,
  suppressDueDate: boolean = false,
  showDueDatesWithinDays?: number,
  showFarDueDateAsRelative?: boolean,
): string {
  try {
    const { para } = thisItem
    if (!para || !para.content) {
      throw new Error(`No para/content in item ${thisItem.ID}`)
    }
    const content = suppressDueDate ? contentWithoutDueDate(para.content, showDueDatesWithinDays) : para.content
    return makeStringContentToLookLikeNPDisplayInReact(content, {
      truncateLength,
      taskPriority: para.priority ?? 0,
      startTime: para.startTime,
      endTime: para.endTime,
      timeblockTextMustContainString,
      noteTitle: para.title ?? '',
      linkedNoteIcons: para.linkedNoteIcons,
      reminderDisplayById,
      keepRelativeScheduledDates: para.noteType === 'Notes',
      showDueDatesWithinDays,
      showFarDueDateAsRelative,
    })
  } catch (error) {
    logError(`makeParaContentToLookLikeNPDisplayInReact`, error.message)
    return ''
  }
}
