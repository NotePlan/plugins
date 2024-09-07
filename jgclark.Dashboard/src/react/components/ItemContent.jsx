// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the main item content in an ItemRow.
// Last updated 2024-09-06 for v2.0.4+ by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev'
import {
  changeBareLinksToHTMLLink,
  changeMarkdownLinksToHTMLLink,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString,
  truncateHTML,
} from '@helpers/stringTransforms'
import {
  simplifyNPEventLinksForHTML,
  simplifyInlineImagesForHTML,
  convertHashtagsToHTML,
  convertMentionsToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  // convertTimeBlockToHTML,
  convertUnderlinedToHTML,
  convertHighlightsToHTML,
  convertNPBlockIDToHTML,
  convertBoldAndItalicToHTML,
} from '@helpers/HTMLView'
import { RE_SCHEDULED_DATES_G } from '@helpers/regex'
import {
  findLongestStringInArray,
  RE_TIMEBLOCK_APP,
} from '@helpers/timeblocks'
import { replaceArrowDatesInString } from '@helpers/dateTime'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
  children: Array<Node>
}

/**
 * Represents the main content for a single item within a section
 */
function ItemContent({ item, children }: Props): React$Node {
  const { sendActionToPlugin, dashboardSettings } = useAppContext()
  // const itemType = para.type

  // logDebug('ItemContent', `- for ${item.ID}: '${item.para?.content ?? '<null>'}'`)

  // compute the things we need later
  let mainContent = makeParaContentToLookLikeNPDisplayInReact(item, 140)

  // get rid of arrowDates if desired by user
  if (mainContent && !dashboardSettings.includeScheduledDates) mainContent = replaceArrowDatesInString(mainContent, '')

  // get rid of priority markers if desired by user (maincontent starts with <span> etc.)
  const shouldRemove = dashboardSettings && dashboardSettings.hidePriorityMarkers === true
  // logDebug('ItemContent', `mainContent: ${mainContent} dashboardSettings.hidePriorityMarkers=${shouldRemove} (type: ${typeof dashboardSettings.hidePriorityMarkers})`)
  // Check if we need to remove exclamations or ">>" from mainContent
  if (shouldRemove) {
    // Regex to match the entire <span>...</span> block and capture its content
    mainContent = mainContent.replace(/(<span[^>]*>)(.*?)(<\/span>)/g, (_match, startTag, content, endTag) => {
      // Replace exclamations or ">>" within the captured content
      const replaced = content.replace(/(?:!+|>>)\s*/g, '')
      // Reconstruct the <span> block with the cleaned content
      return `${startTag}${replaced}${endTag}`
    })
  }
  function handleTaskClick(e: MouseEvent) {
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed -- Note: not yet used
    const dataObjectToPassToFunction = {
      actionType: 'showLineInEditorFromFilename',
      modifierKey: modifierName,
      item,
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Item clicked', true)
  }

  // console.log(`-> ${mainContent}`)

  // TODO(later): try not to live dangerously!
  // $FlowIgnore[incompatible-type] -- eventually we will remove the dangerousness
  return <div className="sectionItemContent sectionItem"><a className="content" onClick={(e) => handleTaskClick(e)} dangerouslySetInnerHTML={{ __html: mainContent }}></a>{children}</div>
}

/**
 * Produce an HTML version of the provided paragraph's content to mimic NP's native display of markdown (as best we can). Currently this:
 * - simplifies NP event links, and tries to colour them
 * - turns MD links -> HTML links
 * - truncates the display of raw URLs if necessary
 * - turns NP sync ids -> blue asterisk icon
 * - turns #hashtags and @mentions the colour that the theme displays them
 * - turns >date markers the colour that the theme displays them
 * - styles in bold/italic
 * Note: the actual note link is added following load by adding click handler to all items with class "sectionItemContent" (which already have a basic <a>...</a> wrapper).
 * It additionally:
 * - truncates the overall string if requested
 * - if noteTitle is supplied, then either 'append' it as a active NP note title, or make it the active NP note link for 'all' the string.
 * @author @jgclark
 * @param {SectionItem} thisItem
 * @param {string?} truncateLength (optional) length of string after which to truncate. Will not truncate if set to 0.
 * @returns {string} HTML string
 */
function makeParaContentToLookLikeNPDisplayInReact(
  thisItem: TSectionItem,
  truncateLength: number = 0,
): string {
  try {
    const { para } = thisItem
    if (!para || !para.content) {
      throw new Error(`No para/content in item ${thisItem.ID}`)
    }
    const origContent = para.content ?? '<error>'
    const noteTitle = para.title ?? ''
    // const noteFilename = para.filename ?? ''
    // logDebug('makeParaContent...', `- for '${thisItem.ID}' / noteTitle '${noteTitle}' / filename '${noteFilename}' / {${origContent}}`)
    // Start with the content of the item
    let output = origContent

    // // See if there's a !, !!, !!! or >> in the line, and if so set taskPriority accordingly
    // const taskPriority = getTaskPriority(output)
    // if (taskPriority > 0) {
    //   output = removeTaskPriorityIndicators(output)
    // }
    const taskPriority = para.priority ?? 0

    if (noteTitle === '(error)') {
      logError('makeParaContent...', `ERROR starting with noteTitle '(error)' for '${origContent}'`)
    }

    // Simplify NP event links of the form
    // `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)` to HTML with icon
    output = simplifyNPEventLinksForHTML(output)

    // Simplify embedded images of the form ![image](...) by replacing with an icon.
    // (This also helps remove false positives for ! priority indicator)
    output = simplifyInlineImagesForHTML(output)

    // Display markdown links of the form [title](URI) as HTML links
    output = changeMarkdownLinksToHTMLLink(output)

    // Display bare URLs as HTML links with web icon
    output = changeBareLinksToHTMLLink(output, true, truncateLength)

    // Display hashtags with .hashtag style
    output = convertHashtagsToHTML(output)

    // Display mentions with .attag style
    output = convertMentionsToHTML(output)

    // Display pre-formatted with .code style
    output = convertPreformattedToHTML(output)

    // Display time blocks with .timeBlock style
    if (thisItem.para?.startTime && thisItem.para?.startTime !== 'none') {
      // logDebug('makeParaContent...', `🕰️ found startTime '${thisItem.para.startTime}'`)
      output = convertTimeBlockToHTML(output)
    }

    // Display strikethrough with .strikethrough style
    output = convertStrikethroughToHTML(output)

    // Display highlights with .code style
    output = convertHighlightsToHTML(output)

    // Replace blockID sync indicator with icon
    // NB: needs to go after #hashtag change above, as it includes a # marker for colors.
    output = convertNPBlockIDToHTML(output)

    // Strip `>today` and scheduled dates of form `>YYYY-MM-DD` that point to today
    output = stripTodaysDateRefsFromString(output)

    // Strip refs to this week (of form `>YYYY-Www`)
    output = stripThisWeeksDateRefsFromString(output)

    // Strip all `<YYYY-MM-DD` dates
    output = stripBackwardsDateRefsFromString(output)

    // add basic ***bolditalic*** styling
    // add basic **bold** or __bold__ styling
    // add basic *italic* or _italic_ styling
    output = convertBoldAndItalicToHTML(output)

    // Display underline with .underlined style
    output = convertUnderlinedToHTML(output)

    // Add suitable colouring to 'arrow' >date< items
    // (Needs to go before match on >date dates)
    // TODO: turning off for now as it calls DataStore underneath
    // let captures = output.match(RE_ARROW_DATES_G)
    // if (captures) {
    //   // clo(captures, 'results from arrow >date< match:')
    //   for (const capture of captures) {
    //     // output = output.replace(capture, `<span style="color: var(--tint-color);">${capture}</span>`)
    //     console.log(`makeParaContet...: - making arrow date with ${capture}`)
    //     // Replace >date< with HTML link, aware that this will interrupt the <a>...</a> that will come around the whole string, and so it needs to make <a>...</a> regions for the rest of the string before and after the capture.
    //     const dateFilenamePart = capture.slice(1, -1)
    //     const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromNPDateStr(dateFilenamePart, thisItem.ID)
    //     output = output.replace(capture, `</a>${noteTitleWithOpenAction}<a class="content">`)
    //   }
    // }

    // Add suitable colouring to remaining >date items
    let captures = output.match(RE_SCHEDULED_DATES_G)
    if (captures) {
      // clo(captures, 'results from >date match:')
      for (const capture of captures) {
        output = output.replace(capture, `<span style="color: var(--tint-color);">${capture}</span>`)
      }
    }

    // Replace [[notelinks]] with HTML equivalent, and coloured
    // Note: needs to go after >date section above
    captures = output.match(/\[\[(.*?)\]\]/)
    if (captures) {
      // clo(captures, 'results from [[notelinks]] match:')
      for (const capturedTitle of captures) {
        // console.log(`makeParaContet...: - making notelink with ${thisItem.filename}, ${capturedTitle}`)
        // Replace [[notelinks]] with HTML equivalent, aware that this will interrupt the <a>...</a> that will come around the whole string, and so it needs to make <a>...</a> regions for the rest of the string before and after the capture.
        const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromTitle(capturedTitle, '') // don't want folder part here
        output = output.replace(`[[${capturedTitle}]]`, `</a>${noteTitleWithOpenAction}<a>`)
      }
    }

    // Truncate the HTML string if wanted (avoiding breaking in middle of HTML tags)
    // Note: Best done before the note link is added
    if (truncateLength > 0 && origContent.length > truncateLength) {
      output = truncateHTML(output, truncateLength, true)
    }

    // If we already know (from above) there's a !, !!, !!! or >> in the line add priorityN styling around the whole string. Where it is "working-on", it uses priority4.
    // Note: this wrapping needs to go last.
    if (taskPriority > 0) {
      output = `<span class="priority${String(taskPriority)}">${output}</span>`
    }

    // Add a child marker if relevant
    // Note: best done after truncation and adding priority style
    if (para.hasChild) {
      output += '<i class="childMarker fa-solid fa-block-quote pad-left"></i>'
      // clo(para,`makeParaContent...: - adding child marker for ${thisItem.ID}`)
    }

    // console.log(`makeParaContet...: \n-> ${output}`)
    return output
  } catch (error) {
    logError(`makeParaContentToLookLikeNPDisplayInReact`, error.message)
    return '(makeParaContent... error)'
  }
}

/**
 * Wrap string with href onClick event to show note in editor, using noteTitle param.
 * Note: based only on 'noteTitle', not a filename
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromTitle(noteTitle: string, folderNamePart: string): string {
  try {
    logDebug('makeNoteTitleWithOpenActionFromTitle', `- making notelink from ${folderNamePart} ${noteTitle}`)

    // Pass request back to plugin
    // Note: no longer passing rawContent, as it's not needed
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID:'fake', actionType:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(
      noteTitle,
    )}'})"><i class="fa-regular fa-file-lines pad-right"></i> ${folderNamePart}${noteTitle}</a>`
  } catch (error) {
    logError('makeNoteTitleWithOpenActionFromTitle', `${error.message} for input '${noteTitle}'`)
    return '(makeNoteTitle... error)'
  }
}


// Display time blocks with .timeBlock style
// Note: uses definition of time block syntax from plugin helpers, not directly from NP itself. So it may vary slightly.
// Note: this is forked from HTMLView, but with some changes to work with React (avoiding calling a DataStore function)
function convertTimeBlockToHTML(input: string): string {
  const timeBlockPart = getTimeBlockString(input)
  // logDebug('convertTimeBlockToHTML', `🕰️ found time block '${timeBlockPart}'`)
  const output = input.replace(timeBlockPart, `<span class="timeBlock">${timeBlockPart}</span>`)
  // }
  return output
}

/**
 * Get the timeblock portion of a timeblock line (also is a way to check if it's a timeblock line)
 * Does not return the text after the timeblock (you can use isTimeBlockLine to check if it's a timeblock line)
 * @tests available for jest
 * @author @dwertheimer
 *
 * @param {string} contentString
 * @returns {string} the time portion of the timeblock line
 */
const getTimeBlockString = (contentString: string): string => {
  // logDebug('getTimeBlockString', `for '${contentString}'...`)
  const matchedStrings = []
  if (contentString) {
    const reMatch: Array<string> = contentString.match(RE_TIMEBLOCK_APP) ?? []
    if (contentString && reMatch && reMatch.length) {
      matchedStrings.push(reMatch[0].trim())
    }
  }
  // matchedStrings could have several matches, so find the longest one
  return matchedStrings.length ? findLongestStringInArray(matchedStrings) : ''
}

export default ItemContent
