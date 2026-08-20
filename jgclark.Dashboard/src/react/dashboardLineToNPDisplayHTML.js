// @flow
//--------------------------------------------------------------------------
// Shared: turn a raw task line string into HTML matching NotePlan-style display
// (hashtags, mentions, links, etc.) for TaskItem (via ItemContent) and ProjectItem.
// Last updated 2026-08-12 for v2.4.0.b62 by @jgclark/@Cursor
//--------------------------------------------------------------------------

import type { TDashboardSettings, TLinkedNoteIconInfo, TSectionItem } from '../types.js'
import type { TReminderDisplayById } from '@helpers/NPReminders'
import { getNoteIconDisplayProps } from '../noteIconDisplay.js'
import { replaceArrowDatesInString } from '@helpers/dateTime'
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
    output = convertMentionsToHTML(output)
    output = convertPreformattedToHTML(output)

    // Place the timeblock lozenge at the start of the displayed text
    if (timeBlockLabel) {
      output = `<span class="timeBlock margin-right-larger"><i class="fa-regular fa-clock pad-right"></i>${timeBlockLabel}</span>${output}`
    }

    output = convertStrikethroughToHTML(output)
    output = convertHighlightsToHTML(output)
    output = convertNPBlockIDToHTML(output)
    output = stripTodaysDateRefsFromString(output)
    output = stripThisWeeksDateRefsFromString(output)
    output = stripBackwardsDateRefsFromString(output)
    output = convertBoldAndItalicToHTML(output)
    output = convertUnderlinedToHTML(output)

    const captures = output.match(RE_SCHEDULED_DATES_G)
    if (captures) {
      for (const capture of captures) {
        // Lozenge like .timeBlock: calendar icon + date text (without leading '>')
        const dateText = capture.startsWith('>') ? capture.slice(1) : capture
        output = output.replace(capture, `<span class="scheduledDate"><i class="fa-regular fa-calendar pad-right"></i>${dateText}</span>`)
      }
    }

    if (truncateLength > 0 && origContent.length > truncateLength) {
      output = truncateHTML(output, truncateLength, true)
    }

    if (taskPriority > 0) {
      output = `<span class="priority${String(taskPriority)}">${output}</span>`
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
 * @returns {string}
 */
export function makeParaContentToLookLikeNPDisplayInReact(
  thisItem: TSectionItem,
  truncateLength: number = 0,
  timeblockTextMustContainString: string = '',
  reminderDisplayById?: TReminderDisplayById,
): string {
  try {
    const { para } = thisItem
    if (!para || !para.content) {
      throw new Error(`No para/content in item ${thisItem.ID}`)
    }
    return makeStringContentToLookLikeNPDisplayInReact(para.content, {
      truncateLength,
      taskPriority: para.priority ?? 0,
      startTime: para.startTime,
      endTime: para.endTime,
      timeblockTextMustContainString,
      noteTitle: para.title ?? '',
      linkedNoteIcons: para.linkedNoteIcons,
      reminderDisplayById,
    })
  } catch (error) {
    logError(`makeParaContentToLookLikeNPDisplayInReact`, error.message)
    return ''
  }
}
