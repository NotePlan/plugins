// @flow
//--------------------------------------------------------------------------
// Shared: turn a raw task line string into HTML matching NotePlan-style display
// (hashtags, mentions, links, etc.) for TaskItem (via ItemContent) and ProjectItem.
// Last updated 2026-04-13 for v2.4.0.b24 by @jgclark/@Cursor
//--------------------------------------------------------------------------

import type { TDashboardSettings, TSectionItem } from '../types.js'
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
  convertNPBlockIDToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  convertTimeBlockToHTML,
  convertUnderlinedToHTML,
  simplifyInlineImagesForHTML,
  simplifyNPEventLinksForHTML,
} from '@helpers/HTMLView'
import { RE_SCHEDULED_DATES_G } from '@helpers/regex'

export type TDashboardLineDisplayOptions = {
  truncateLength?: number,
  taskPriority?: number,
  startTime?: string,
  timeblockTextMustContainString?: string,
  noteTitle?: string,
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
 * @param {string} noteTitle
 * @param {string} folderNamePart
 * @returns {string}
 */
function makeNoteTitleWithOpenActionFromTitle(noteTitle: string, folderNamePart: string): string {
  try {
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID:'fake', actionType:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(
      noteTitle,
    )}'})"><i class="fa-regular fa-file-lines pad-right"></i> ${folderNamePart}${noteTitle}</a>`
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
  const timeblockTextMustContainString = options?.timeblockTextMustContainString ?? ''
  const noteTitle = options?.noteTitle ?? ''

  try {
    if (content == null || content === '') {
      return ''
    }
    const origContent = content
    if (noteTitle === '(error)') {
      logError('makeStringContentToLookLikeNPDisplayInReact', `ERROR starting with noteTitle '(error)' for '${origContent}'`)
    }

    let output = origContent

    output = simplifyNPEventLinksForHTML(output)
    output = simplifyInlineImagesForHTML(output)
    output = changeMarkdownLinksToHTMLLink(output)
    output = changeBareLinksToHTMLLink(output, true, truncateLength)
    output = convertHashtagsToHTML(output)
    output = convertMentionsToHTML(output)
    output = convertPreformattedToHTML(output)

    if (startTime && startTime !== 'none') {
      output = convertTimeBlockToHTML(output, timeblockTextMustContainString)
    }

    output = convertStrikethroughToHTML(output)
    output = convertHighlightsToHTML(output)
    output = convertNPBlockIDToHTML(output)
    output = stripTodaysDateRefsFromString(output)
    output = stripThisWeeksDateRefsFromString(output)
    output = stripBackwardsDateRefsFromString(output)
    output = convertBoldAndItalicToHTML(output)
    output = convertUnderlinedToHTML(output)

    let captures = output.match(RE_SCHEDULED_DATES_G)
    if (captures) {
      for (const capture of captures) {
        output = output.replace(capture, `<span style="color: var(--tint-color);">${capture}</span>`)
      }
    }

    if (truncateLength > 0 && origContent.length > truncateLength) {
      output = truncateHTML(output, truncateLength, true)
    }

    captures = output.match(/\[\[(.*?)\]\]/)
    if (captures) {
      for (const capturedTitle of captures) {
        const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromTitle(capturedTitle, '')
        output = output.replace(`[[${capturedTitle}]]`, `</a>${noteTitleWithOpenAction}<a>`)
      }
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
      timeblockTextMustContainString,
      noteTitle: para.title ?? '',
    })
  } catch (error) {
    logError(`makeParaContentToLookLikeNPDisplayInReact`, error.message)
    return ''
  }
}
