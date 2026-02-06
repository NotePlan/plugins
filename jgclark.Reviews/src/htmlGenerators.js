// @flow
//-----------------------------------------------------------------------------
// HTML Generation Functions for Reviews Plugin
// Consolidated HTML generation logic from multiple files
// by Jonathan Clark
// Last updated 2026-01-14 for v1.3.0.b4, @jgclark
//-----------------------------------------------------------------------------

import { Project } from './projectClass'
import { addFAIcon } from './reviewHelpers'
import { checkBoolean, checkString } from '@helpers/checkType'
import { tailwindToHsl } from '@helpers/colors'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderDisplayNameForHTML } from '@helpers/folders'
import { createOpenOrDeleteNoteCallbackUrl } from '@helpers/general'
import { makePluginCommandButton, makeSVGPercentRing, redToGreenInterpolation } from '@helpers/HTMLView'
import { localeRelativeDateFromNumber, nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { getLineMainContentPos } from '@helpers/search'
import { encodeRFC3986URIComponent, prepAndTruncateMarkdownForDisplay } from '@helpers/stringTransforms'

//-----------------------------------------------------------------------------
// Project Row HTML Generation
//-----------------------------------------------------------------------------

/**
 * Returns line showing more detailed summary of the project, for output in Rich (HTML) or Markdown formats or simple list format.
 * Now uses fontawesome icons for some indicators.
 * Note: this is V2, now *not* part of the Project class, so can take config etc.
 * @param {Project} thisProject
 * @param {any} config
 * @param {string} style
 * @returns {string}
 */
export function generateProjectOutputLine(
  thisProject: Project,
  config: any,
  style: string,
): string {
  // logDebug('generateProjectOutputLine', `- ${thisProject.title}: nRD ${thisProject.nextReviewDays} / due ${thisProject.dueDays}`)
  const ignoreChecklistsInProgress = checkBoolean(DataStore.preference('ignoreChecklistsInProgress')) || false
  let output = ''
  let statsProgress = ''
  let thisPercent = ''
  if (thisProject.percentComplete != null) {
    thisPercent = (isNaN(thisProject.percentComplete)) ? '0%' : ` ${thisProject.percentComplete}%`
    const totalItemsStr = (isNaN(thisProject.numTotalItems)) ? '0' : thisProject.numTotalItems.toLocaleString()
    if (ignoreChecklistsInProgress) {
      statsProgress = `${thisPercent} done (of ${totalItemsStr} ${(thisProject.numCompletedItems + thisProject.numOpenItems !== 1) ? 'tasks' : 'task'})`
    } else {
      statsProgress = `${thisPercent} done (of ${totalItemsStr} ${(thisProject.numCompletedItems + thisProject.numOpenItems !== 1) ? 'items' : 'item'})`
    }
  } else {
    statsProgress = '(0 tasks)'
  }

  if (style === 'Rich') {
    output = generateRichHTMLRow(thisProject, config, statsProgress)
  } else if (style === 'Markdown' || style === 'list') {
    output = generateMarkdownLine(thisProject, config, style, statsProgress, thisPercent)
  } else {
    logWarn('htmlGenerators::generateProjectOutputLine', `Unknown style '${style}'; nothing returned.`)
    output = ''
  }
  return output
}

/**
 * Generate Rich HTML row for project
 * @param {Project} thisProject
 * @param {any} config
 * @param {string} statsProgress
 * @returns {string}
 * @private
 */
function generateRichHTMLRow(thisProject: Project, config: any, statsProgress: string): string {
  const parts: Array<string> = []
  parts.push(`\t<tr class="projectRow" data-encoded-filename="${encodeRFC3986URIComponent(thisProject.filename)}">\n\t\t`)
  parts.push(generateCircleIndicator(thisProject))

  // Column 2a: Project name / link / edit dialog trigger button
  const editButton = `          <span class="pad-left dialogTrigger" onclick="showProjectControlDialog({encodedFilename: '${encodeRFC3986URIComponent(thisProject.filename)}', reviewInterval:'${thisProject.reviewInterval}', encodedTitle:'${encodeRFC3986URIComponent(thisProject.title)}'})"><i class="fa-light fa-edit"></i></span>\n`
  parts.push(`\n\t\t\t<td><span class="projectTitle">${decoratedProjectTitle(thisProject, 'Rich', config)}${editButton}</span>`)

  if (!thisProject.isCompleted && !thisProject.isCancelled) {
    const nextActionsContent: Array<string> = thisProject.nextActionsRawContent
      ? thisProject.nextActionsRawContent.map((na) => na.slice(getLineMainContentPos(na)))
      : []

    if (config.displayDates) {
      // Write column 2b/2c under title
      parts.push(generateProgressSection(thisProject, config, statsProgress, false))
      parts.push(generateNextActionsSection(config, nextActionsContent))
      parts.push(`</td>`)
    } else {
      // write progress in next cell instead
      parts.push(`</td>\n`)
      parts.push(`\t\t\t<td>`)
      parts.push(generateProgressSection(thisProject, config, statsProgress, true))
      parts.push(generateNextActionsSection(config, nextActionsContent))
    }
  }

  // Columns 3/4: date information
  parts.push(generateDateSection(thisProject, config))
  parts.push('\n\t</tr>')

  return parts.join('')
}

/**
 * Generate circle indicator HTML for project status
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function generateCircleIndicator(thisProject: Project): string {
  if (thisProject.isCompleted) {
    return `<td class="first-col-indicator checked">${addFAIcon('fa-solid fa-circle-check circle-icon')}</td>`
  } else if (thisProject.isCancelled) {
    return `<td class="first-col-indicator cancelled">${addFAIcon('fa-solid fa-circle-xmark circle-icon')}</td>`
  } else if (thisProject.isPaused) {
    return `<td class="first-col-indicator">${addFAIcon("fa-solid fa-circle-pause circle-icon", "var(--project-pause-color)")}</td>`
  } else if (thisProject.percentComplete == null || isNaN(thisProject.percentComplete)) {
    return `<td class="first-col-indicator">${addFAIcon('fa-solid fa-circle circle-icon', 'var(--project-no-percent-color)')}</td>`
  } else if (thisProject.percentComplete === 0) {
    return `<td class="first-col-indicator">${addSVGPercentRing(thisProject, 100, '#FF000088', '0')}</td>`
  } else {
    return `<td class="first-col-indicator">${addSVGPercentRing(thisProject, thisProject.percentComplete, 'multicol', String(thisProject.percentComplete))}</td>`
  }
}

/**
 * Generate progress section HTML
 * @param {Project} thisProject
 * @param {any} config
 * @param {string} statsProgress
 * @param {boolean} useDiv - Whether to use div instead of span
 * @returns {string}
 * @private
 */
function generateProgressSection(thisProject: Project, config: any, statsProgress: string, useDiv: boolean = false): string {
  if (!config.displayProgress) return ''

  const tag = useDiv ? 'div' : 'span'
  const indent = useDiv ? '\t\t\t\t' : '\n\t\t\t\t'
  let output = `${indent}<${tag} class="progress">`

  if (thisProject.lastProgressComment !== '') {
    output += `<span class="progressIcon"><i class="fa-solid fa-info-circle"></i></span><span class="progressText">${thisProject.lastProgressComment}</span>`
  } else {
    output += `<span class="progressText">${statsProgress}</span>`
  }
  output += `</${tag}>`
  return output
}

/**
 * Generate next actions text lines as HTML <divs>.
 * Prepares and truncates long next actions to 80 characters, with ellipsis if truncated. Also simplifies Markdown links to just the [title].
 * @param {any} config
 * @param {Array<string>} nextActionsContent
 * @returns {string}
 * @private
 */
function generateNextActionsSection(config: any, nextActionsContent: Array<string>): string {
  if (!config.displayNextActions || nextActionsContent.length === 0) return ''

  const parts: Array<string> = []
  for (const NAContent of nextActionsContent) {
    // const truncatedNAContent = trimString(NAContent, 80)
    const truncatedNAContent = prepAndTruncateMarkdownForDisplay(NAContent, 80)
    parts.push(`\n\t\t\t<div class="nextAction"><span class="nextActionIcon"><i class="todo fa-regular fa-circle"></i></span><span class="nextActionText">${truncatedNAContent}</span></div>`)
  }
  return parts.join('')
}

/**
 * Generate date section HTML for Rich format
 * @param {Project} thisProject
 * @param {any} config
 * @returns {string}
 * @private
 */
function generateDateSection(thisProject: Project, config: any): string {
  if (!config.displayDates || thisProject.isPaused) {
    return '<td></td><td></td>'
  }

  if (thisProject.isCompleted) {
    const completionRef = thisProject.completedDuration || "completed"
    return `<td colspan=2 class="checked">Completed ${completionRef}</td>`
  } else if (thisProject.isCancelled) {
    const cancellationRef = thisProject.cancelledDuration || "cancelled"
    return `<td colspan=2 class="cancelled">Cancelled ${cancellationRef}</td>`
  }

  const parts: Array<string> = []
  // Next review date
  if (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays)) {
    const reviewDate = localeRelativeDateFromNumber(thisProject.nextReviewDays)
    if (thisProject.nextReviewDays > 0) {
      parts.push(`<td>${reviewDate}</td>`)
    } else {
      parts.push(`<td><p><b>${reviewDate}</b></p></td>`)
    }
  } else {
    parts.push('<td></td>')
  }

  // Due date
  if (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) {
    const dueDate = localeRelativeDateFromNumber(thisProject.dueDays)
    if (thisProject.dueDays > 0) {
      parts.push(`<td>${dueDate}</td>`)
    } else {
      parts.push(`<td><p><b>${dueDate}</b></p></td>`)
    }
  } else {
    parts.push('<td></td>')
  }

  return parts.join('')
}

/**
 * Returns title of note as folder name + link, also showing complete or cancelled where relevant.
 * Supports 'Markdown' or 'HTML' styling or simpler 'list' styling
 * @param {Project} thisProject 'Markdown' or 'HTML' or 'list'
 * @param {string} style 'Markdown' or 'HTML' or 'list'
 * @param {any} config
 * @return {string} - title as wikilink
 */
function decoratedProjectTitle(thisProject: Project, style: string, config: any): string {
  const folderNamePart = config.showFolderName ? `${thisProject.folder} / ` : ''
  const titlePart = thisProject.title ?? '(error, not available)'
  switch (style) {
    case 'Rich': {
      // Method 1: make [[notelinks]] via x-callbacks
      // Method 2: x-callback using note title
      // Method 3: x-callback using filename
      // Note: using an "onclick="window.location.href='${noteOpenActionURL}'" handler instead of an anchor tag doesn't work in the NP constrained environment.
      // Note: now using splitView if running in the main window on macOS
      const noteOpenActionURL = createOpenOrDeleteNoteCallbackUrl(thisProject.filename, "filename", "", "splitView", false)
      const extraClasses = (thisProject.isCompleted) ? 'checked' : (thisProject.isCancelled) ? 'cancelled' : (thisProject.isPaused) ? 'paused' : ''
      
      // Use icon from frontmatter if available, otherwise default to fa-file-lines
      const iconClass = thisProject.icon != null && thisProject.icon !== '' ? thisProject.icon : 'file-lines'
      // TEST: commenting out colour, to see if it helps the look and feel
      // const tailwindColor = thisProject.iconColor != null && thisProject.iconColor !== '' ? thisProject.iconColor : ''
      const iconColorStyle = '' // tailwindColor !== '' ? ` style="color: ${tailwindToHsl(tailwindColor)};"` : ''
      const iconHTML = `<i class="fa-regular fa-${iconClass}"${iconColorStyle}></i>`
      // logDebug('decoratedProjectTitle', `${thisProject.filename}: icon: ${thisProject.icon ?? '-'}, color: ${thisProject.iconColor ?? '-'}`)
      // logDebug('decoratedProjectTitle', `${thisProject.filename}:iconClass: ${iconClass}, tailwindColor: ${tailwindColor}, iconColorStyle: ${iconColorStyle}`)
      
      return `<a class="noteTitle" href="${noteOpenActionURL}"><span class="noteTitleIcon">${iconHTML}</span><span class="noteTitleText ${extraClasses}">${folderNamePart}${titlePart}</span></a>`
    }

    case 'Markdown': {
      if (thisProject.isCompleted) {
        return `[x] ${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isCancelled) {
        return `[-] ${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isPaused) {
        return `⏸ **Paused**: ${folderNamePart}[[${titlePart}]]`
      } else {
        return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
      }
    }

    case 'list': {
      if (thisProject.isCompleted) {
        return `${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isCancelled) {
        return `~~${folderNamePart}[[${titlePart}]]~~`
      } else if (thisProject.isPaused) {
        return `⏸ **Paused**: ${folderNamePart}[[${titlePart}]]`
      } else {
        return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
      }
    }

    default:
      logWarn('htmlGenerators::decoratedProjectTitle', `Unknown style '${style}'; nothing returned.`)
      return ''
  }
}

/**
 * Add SVG ready for percent ring with the number in the middle.
 * Note: this is kept in this file as it is specific to Review functionality. But it relies on the more generic 'makeSVGPercentRing' helper function.
 * Note: It needs to be followed by call to JS function setPercentRing() to set the ring's state.
 * Note: This is a non-Class version of the function.
 * @param {Project} thisProject
 * @param {number} percent 0-100
 * @param {string?} color for ring and text (as colour name or #RGB), or 'multicol' to mean shading between red and green
 * @param {string?} textToShow inside ring, which can be different from just the percent, which is used by default
 * @returns {string} SVG code to insert in HTML
 */
function addSVGPercentRing(thisProject: Project, percent: number, colorIn: string = 'multicol', text: string = ''): string {
  const textToShow = (text !== '') ? text : String(percent)
  const colorToUse = (colorIn === 'multicol')
    ? redToGreenInterpolation(percent)
    : colorIn
  return makeSVGPercentRing(percent, colorToUse, textToShow, thisProject.ID)
}

/**
 * Generate Markdown/list format line for project
 * @param {Project} thisProject
 * @param {any} config
 * @param {string} style
 * @param {string} statsProgress
 * @param {string} thisPercent
 * @returns {string}
 * @private
 */
function generateMarkdownLine(thisProject: Project, config: any, style: string, statsProgress: string, thisPercent: string): string {
  const parts: Array<string> = []
  parts.push('- ')
  parts.push(decoratedProjectTitle(thisProject, style, config))

  if (config.displayDates && !thisProject.isPaused) {
    if (thisProject.isCompleted) {
      const completionRef = thisProject.completedDuration || "completed"
      parts.push(`\t(Completed ${completionRef})`)
    } else if (thisProject.isCancelled) {
      const cancellationRef = thisProject.cancelledDuration || "cancelled"
      parts.push(`\t(Cancelled ${cancellationRef})`)
    }
  }

  if (config.displayProgress && !thisProject.isCompleted && !thisProject.isCancelled) {
    if (thisProject.lastProgressComment !== '') {
      parts.push(`\t${thisPercent} done: ${thisProject.lastProgressComment}`)
    } else {
      parts.push(`\t${statsProgress}`)
    }
  }

  if (config.displayDates && !thisProject.isPaused && !thisProject.isCompleted && !thisProject.isCancelled) {
    if (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) {
      parts.push(`\tdue ${localeRelativeDateFromNumber(thisProject.dueDays)}`)
    }
    if (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays)) {
      const reviewDate = localeRelativeDateFromNumber(thisProject.nextReviewDays)
      if (thisProject.nextReviewDays > 0) {
        parts.push(`\tReview ${reviewDate}`)
      } else {
        parts.push(`\tReview due **${reviewDate}**`)
      }
    }
  }

  // Add nextAction output if wanted and it exists
  if (config.displayNextActions && thisProject.nextActionsRawContent.length > 0 && !thisProject.isCompleted && !thisProject.isCancelled) {
    const nextActionsContent: Array<string> = thisProject.nextActionsRawContent.map((na) => na.slice(getLineMainContentPos(na)))
    for (const nextActionContent of nextActionsContent) {
      parts.push(`\n\t- Next action: ${nextActionContent}`)
    }
  }

  return parts.join('')
}

//-----------------------------------------------------------------------------
// HTML Structure Generation
//-----------------------------------------------------------------------------

/**
 * Generate top bar HTML with controls and toggles
 * @param {any} config
 * @returns {string}
 */
export function generateTopBarHTML(config: any): string {
  const parts: Array<string> = []
  
  // Add buttons for various commands
  const refreshPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh`,
    'jgclark.Reviews',
    'project lists',
    '',
    'Recalculate project lists and update this window',
    true
  )
  const startReviewPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-play"></i>\u00A0Start`,
    'jgclark.Reviews',
    'start reviews',
    '',
    'Opens the next project to review in the NP editor',
    true
  )
  const reviewedPCButton = makePluginCommandButton(
    `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish`,
    'jgclark.Reviews',
    'finish project review',
    '',
    `Update the ${checkString(DataStore.preference('reviewedMentionStr'))}() date for the Project you're currently editing`,
    true
  )
  const nextReviewPCButton = makePluginCommandButton(
    `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next`,
    'jgclark.Reviews',
    'next project review',
    '',
    `Finish review of currently open Project and start the next review`,
    true
  )

  // Start with a sticky top bar
  parts.push(`<div class="topbar">`)
  
  if (config.usePerspectives) {
    const perspectiveSection = `<div id="persp" class="topbar-item">Persp: <span class="perspective-name">${config.perspectiveName}</span></div>`
    parts.push(perspectiveSection)
  }
  
  // add checkbox toggles
  const displayFinished = config.displayFinished ?? false
  const displayOnlyDue = config.displayOnlyDue ?? false
  const displayNextActions = config.displayNextActions ?? false
  parts.push(`<div id="toggles" class="topbar-item">Display:`)
  parts.push(`  <input class="apple-switch pad-left-more" type="checkbox" ${displayOnlyDue ? 'checked' : ''} id="tog1" name="displayOnlyDue">only due?</input>`)
  parts.push(`  <input class="apple-switch pad-left-more" type="checkbox" ${displayFinished ? 'checked' : ''} id="tog2" name="displayFinished">finished?</input>`)
  parts.push(`  <input class="apple-switch pad-left-more" type="checkbox" ${displayNextActions ? 'checked' : ''} id="tog3" name="displayNextActions">next actions?</input>`)
  parts.push(`</div>`)

  const refreshSection = `<div id="refresh" class="topbar-item">${refreshPCButton}\n<span class="topbar-text pad-left">Updated: <span id="timer">${nowLocaleShortDateTime()}</span>\n</span></div>`
  parts.push(refreshSection)

  const controlButtons = `<div id="reviews" class="topbar-item">Reviews: ${startReviewPCButton}\n${reviewedPCButton}\n${nextReviewPCButton}\n</div>`
  parts.push(controlButtons)

  // Finish the sticky top bar
  parts.push(`</div>`)

  return parts.join('\n')
}

/**
 * Generate folder header HTML for Rich format
 * @param {string} folderPart - Display name for folder
 * @param {any} config
 * @returns {string}
 */
export function generateFolderHeaderHTML(folderPart: string, config: any): string {
  const parts: Array<string> = []
  parts.push(`<thead>\n <tr class="folder-header-row">`)
  parts.push(`  <th colspan=2 class="h4 folder-header">${folderPart}</th>`)
  if (config.displayDates) {
    parts.push(`  <th>Next Review</th><th>Due Date</th>`)
  } else if (config.displayProgress && config.displayNextActions) {
    parts.push(`  <th>Progress and/or Next Action</th>`)
  } else if (config.displayProgress) {
    parts.push(`  <th>Progress</th>`)
  } else if (config.displayNextActions) {
    parts.push(`  <th>Next Action</th>`)
  }
  parts.push(` </tr>\n</thead>\n`)
  parts.push(` <tbody>`)
  return parts.join('')
}

/**
 * Generate table structure HTML with colgroup
 * @param {any} config
 * @param {number} noteCount
 * @returns {string}
 */
export function generateTableStructureHTML(config: any, noteCount: number): string {
  const parts: Array<string> = []
  
  if (noteCount > 0) {
    // In some cases, include colgroup to help massage widths a bit
    if (config.displayDates) {
      parts.push(`<thead>
<colgroup>
\t<col style="width: 3.2rem">
\t<col>
\t<col style="width: 5.5rem">
\t<col style="width: 5.5rem">
</colgroup>
`)
    } else if (config.displayProgress) {
      parts.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
    } else {
      parts.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
    }
  }
  
  return parts.join('')
}

/**
 * Generate project tag section HTML
 * @param {string} thisTag
 * @param {number} noteCount
 * @param {number} due
 * @param {any} config
 * @param {boolean} isMultipleTags
 * @returns {string}
 */
export function generateProjectTagSectionHTML(
  thisTag: string,
  noteCount: number,
  due: number,
  config: any,
  isMultipleTags: boolean
): string {
  const parts: Array<string> = []
  const headingContent = `<span class="h3 folder-name">${thisTag}</span> (${noteCount} notes, ${due} ready for review${config.numberDaysForFutureToIgnore > 0 ? ', with future items ignored' : ''})`
  
  if (isMultipleTags) {
    parts.push(`  <details open>`) // start it open
    parts.push(`   <summary class="folder-header">${headingContent}</summary>`)
  } else {
    parts.push(`  <div class="folder-header">${headingContent}</div>`)
  }
  parts.push('\n<div class="details-content">')
  
  // Add folder name, but only if we're only looking at 1 folder, and we're not grouping by folder
  if (!config.displayGroupedByFolder && config.foldersToInclude.length === 1) {
    const folderDisplayName = getFolderDisplayNameForHTML(config.foldersToInclude[0])
    parts.push(`<h4>${folderDisplayName} folder</h4>`)
  }
  
  parts.push('\n<table>')
  
  return parts.join('\n')
}

/**
 * Generate project control dialog HTML
 * @returns {string}
 */
export function generateProjectControlDialogHTML(): string {
  return `
  <!----------- Dialog to show on Project items ----------->
  <dialog id="projectControlDialog" class="projectControlDialog" aria-labelledby="Actions Dialog"
    aria-describedby="Actions that can be taken on projects">
    <div class="dialogTitle">
      <div>For <i class="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogProjectNote">?</span></b> <span id="dialogProjectInterval">?</span></div>
      <div class="dialog-top-right"><form><button id="closeButton" class="closeButton">
        <i class="fa-solid fa-square-xmark"></i>
      </button></form></div>
    </div>
    <div class="dialogBody">
      <div class="buttonGrid" id="projectDialogButtons">
        <div>Review:</div>
        <div id="projectControlDialogProjectControls">
          <button data-control-str="finish"><i class="fa-regular fa-calendar-check"></i> Finish</button>
          <button data-control-str="nr+1w"><i class="fa-solid fa-forward"></i> Skip 1w</button>
          <button data-control-str="nr+2w"><i class="fa-solid fa-forward"></i> Skip 2w</button>
          <button data-control-str="nr+1m"><i class="fa-solid fa-forward"></i> Skip 1m</button>
          <button data-control-str="nr+1q"><i class="fa-solid fa-forward"></i> Skip 1q</button>
          <button data-control-str="newrevint"><i class="fa-solid fa-arrows-left-right"></i> New Interval</button>
        </div>
        <div>Project:</div>
        <div>
          <button data-control-str="progress"><i class="fa-solid fa-comment-lines"></i> Add Progress</button>
          <button data-control-str="pause">Toggle <i class="fa-solid fa-circle-pause"></i> Pause</button>
          <button data-control-str="complete"><i class="fa-solid fa-circle-check"></i> Complete</button>
          <button data-control-str="cancel"><i class="fa-solid fa-circle-xmark"></i> Cancel</button>
        </div>
        <div></div>
        <!-- <div><form><button id="closeButton" class="mainButton">Close</button></form></div> -->
        </div>
      </div>
    </div>
  </dialog>
`
}
