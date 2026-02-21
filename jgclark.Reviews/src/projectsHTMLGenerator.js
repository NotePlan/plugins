// @flow
//-----------------------------------------------------------------------------
// HTML Generation Functions for Reviews Plugin
// Consolidated HTML generation logic from multiple files
// by Jonathan Clark
// Last updated 2026-02-16 for v1.3.0.b12 by @jgclark
//-----------------------------------------------------------------------------

import { Project } from './projectClass'
import { addFAIcon, getIntervalDueStatus, getIntervalReviewStatus, type ReviewConfig } from './reviewHelpers'
import { checkBoolean, checkString } from '@helpers/checkType'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderDisplayName, getFolderDisplayNameForHTML } from '@helpers/folders'
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
 * @param {ReviewConfig} config
 * @param {string} style: 'Rich' (-> HTML), or 'Markdown'
 * @returns {string} HTML or Markdown string for the project output line (or empty string if error)
 */
export function generateProjectOutputLine(
  thisProject: Project,
  config: ReviewConfig,
  style: string,
): string {
  // logInfo('generateProjectOutputLine', `- ${thisProject.title}: nRD ${thisProject.nextReviewDays} / due ${thisProject.dueDays}`)
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
    output = generateRichHTMLRow(thisProject, config)
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
 * @param {ReviewConfig} config
 * @returns {string}
 * @private
 */
function generateRichHTMLRow(thisProject: Project, config: ReviewConfig): string {
  const parts: Array<string> = []
  parts.push(`\t<div class="project-grid-row projectRow" data-encoded-filename="${encodeRFC3986URIComponent(thisProject.filename)}">\n\t\t`)
  parts.push(generateCircleIndicator(thisProject))

  // Column 2a: Project name + link / item count badge / edit dialog trigger button
  const editButton = `          <span class="pad-left dialogTrigger" onclick="showProjectControlDialog({encodedFilename: '${encodeRFC3986URIComponent(thisProject.filename)}', reviewInterval:'${thisProject.reviewInterval}', encodedTitle:'${encodeRFC3986URIComponent(thisProject.title)}', encodedLastProgressComment:'${encodeRFC3986URIComponent(thisProject.lastProgressComment ?? '')}'})"><i class="fa-light fa-edit"></i></span>\n`
  const openItemCount = generateItemCountsBadge(thisProject)
  parts.push(`\n\t\t\t<div class="project-grid-cell project-grid-cell--content"><span class="projectTitle">${decoratedProjectTitle(thisProject, 'Rich', config)}${editButton}${openItemCount}</span>`)

  if (!thisProject.isCompleted && !thisProject.isCancelled) {
    const nextActionsContent: Array<string> = thisProject.nextActionsRawContent
      ? thisProject.nextActionsRawContent.map((na) => na.slice(getLineMainContentPos(na)))
      : []

    // Write column 2b/2c under title: progress line row (if any) then stats then next actions
    parts.push(generateProgressSection(thisProject, config, false))
    parts.push(generateNextActionsSection(config, nextActionsContent))
  }
  parts.push(`</div>`)

  // Column 3: metadata (dates + project tags/hashtags)
  parts.push(generateDateSection(thisProject, config))
  parts.push('\n\t</div>')

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
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator checked">${addFAIcon('fa-solid fa-circle-check circle-icon')}</div>`
  } else if (thisProject.isCancelled) {
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator cancelled">${addFAIcon('fa-solid fa-circle-xmark circle-icon')}</div>`
  } else if (thisProject.isPaused) {
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator">${addFAIcon("fa-solid fa-circle-pause circle-icon", "var(--project-pause-color)")}</div>`
  } else if (thisProject.percentComplete == null || isNaN(thisProject.percentComplete)) {
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator">${addFAIcon('fa-solid fa-circle circle-icon', 'var(--project-no-percent-color)')}</div>`
  } else if (thisProject.percentComplete === 0) {
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator">${addSVGPercentRing(thisProject, 100, '#FF000088', '0')}</div>`
  } else {
    return `<div class="project-grid-cell project-grid-cell--indicator first-col-indicator">${addSVGPercentRing(thisProject, thisProject.percentComplete, 'multicol', String(thisProject.percentComplete))}</div>`
  }
}

/**
 * Generate item count badge HTML
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function generateItemCountsBadge(thisProject: Project): string {
  const parts: Array<string> = []
  
  // Only show counts for active projects
  if (thisProject.isCompleted || thisProject.isCancelled) {
    return ''
  }
  
  // Task count badge (circle)
  const badgeNumber = (thisProject.numOpenItems - thisProject.numFutureItems > 0) ? thisProject.numOpenItems - thisProject.numFutureItems : 0
  if (badgeNumber > 0) {
    parts.push(`<span class="openItemCount">${badgeNumber}</span>`)
  }
  
  return parts.join('')
}

/**
 * Generate progress section HTML (stats: percent done / item count; comment shown in progress line row when present)
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {boolean} useDiv - Whether to use div instead of span
 * @returns {string}
 * @private
 */
function generateProgressSection(thisProject: Project, config: ReviewConfig, useDiv: boolean = false): string {
  if (!config.displayProgress) return ''
  const tag = useDiv ? 'div' : 'span'
  const indent = useDiv ? '\t\t\t\t' : '\n\t\t\t\t'

  // logDebug('generateProgressSection', `for ${thisProject.title}: lastProgressComment: ${thisProject.lastProgressComment}`)
  // If there is a progress comment, show it in the progress line row, otherwise show only stats
  if (thisProject.lastProgressComment !== '') {
    return `${indent}<${tag} class="projectProgress"><i class="fa-regular fa-circle-info pad-right"></i>${thisProject.lastProgressComment}</${tag}>`
  } else {
  //   return `${indent}<${tag} class="progress"><span class="progressText">${statsProgress}</span></${tag}>`
    return ''
  }
}

/**
 * Generate next actions text lines as HTML <divs>.
 * Prepares and truncates long next actions to 80 characters, with ellipsis if truncated. Also simplifies Markdown links to just the [title].
 * @param {ReviewConfig} config
 * @param {Array<string>} nextActionsContent
 * @returns {string}
 * @private
 */
function generateNextActionsSection(config: ReviewConfig, nextActionsContent: Array<string>): string {
  if (!config.displayNextActions || nextActionsContent.length === 0) return ''

  const parts: Array<string> = []
  for (const NAContent of nextActionsContent) {
    // const truncatedNAContent = trimString(NAContent, 80)
    const truncatedNAContent = prepAndTruncateMarkdownForDisplay(NAContent, 80)
    parts.push(`\n\t\t\t<div class="nextAction"><span class="nextActionIcon"><i class="todo fa-regular fa-circle"></i></span><span class="nextActionText pad-left">${truncatedNAContent}</span></div>`)
  }
  return parts.join('')
}

/**
 * Generate column 3 (metadata column) HTML for Rich format.
 * Shows up to two coloured lozenges (review status then due status from getIntervalReviewStatus / getIntervalDueStatus),
 * and when present a line of project hashtags from from metadata line and/or frontmatter `project` value.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @returns {string}
 * @private
 */
function generateDateSection(thisProject: Project, config: ReviewConfig): string {
  if (!config.displayDates) return ''

  if (thisProject.isPaused) return '<div class="project-grid-cell project-grid-cell--metadata"></div>'

  if (thisProject.isCompleted) {
    const completionRef = thisProject.completedDuration || "completed"
    return `<div class="project-grid-cell project-grid-cell--metadata checked">Completed ${completionRef}</div>`
  } else if (thisProject.isCancelled) {
    const cancellationRef = thisProject.cancelledDuration || "cancelled"
    return `<div class="project-grid-cell project-grid-cell--metadata cancelled">Cancelled ${cancellationRef}</div>`
  }

  const lozenges: Array<string> = []

  // Add all lozenges, each in their own span within one div
  // Start with project tags
  if (thisProject.allProjectTags != null && thisProject.allProjectTags.length > 0) {
    for (const hashtag of thisProject.allProjectTags) {
      lozenges.push(`<span class="metadata-lozenge metadata-lozenge--tag">${hashtag}</span>`)
    }
  }

  // Review status lozenge (from getIntervalReviewStatus)
  if (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays)) {
    const reviewStatus = getIntervalReviewStatus(thisProject.nextReviewDays)
    lozenges.push(`<span class="metadata-lozenge metadata-lozenge--${reviewStatus.color}">${reviewStatus.text}</span>`)
  }
  // Due status lozenge (from getIntervalDueStatus), follows review in same column
  if (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) {
    const dueStatus = getIntervalDueStatus(thisProject.dueDays)
    lozenges.push(`<span class="metadata-lozenge metadata-lozenge--${dueStatus.color}">${dueStatus.text}</span>`)
  }

  return `<div class="project-grid-cell project-grid-cell--metadata project-metadata-cell">${lozenges.join('\n')}</div>`
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

      const folderNamePart = config.showFolderName ? getFolderDisplayNameForHTML(thisProject.folder) : ''
      
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
      const folderNamePart = config.showFolderName ? getFolderDisplayName(thisProject.folder, true) : ''
      
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
      const folderNamePart = config.showFolderName ? getFolderDisplayName(thisProject.folder, true) : ''
      const folderPrefix = folderNamePart!=='' ? `${folderNamePart} / ` : ''
      if (thisProject.isCompleted) {
        return `${folderPrefix}[[${titlePart}]]`
      } else if (thisProject.isCancelled) {
        return `~~${folderPrefix}[[${titlePart}]]~~`
      } else if (thisProject.isPaused) {
        return `⏸ **Paused**: ${folderPrefix}[[${titlePart}]]`
      } else {
        return `${folderPrefix}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
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
  const finishAndNextReviewPCButton = makePluginCommandButton(
    `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next`,
    'jgclark.Reviews',
    'finish project review and start next',
    '',
    `Finish review of currently open Project and start the next review`,
    true
  )
  const nextReviewPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next`,
    'jgclark.Reviews',
    'next project review',
    '',
    `Move on to the next project to review`,
    true
  )

  // Start with a sticky top bar
  parts.push(`<div class="topbar">`)
  
  if (config.usePerspectives) {
    const perspectiveSection = `<div id="persp" class="topbar-item">Persp: <span class="perspective-name">${config.perspectiveName}</span></div>`
    parts.push(perspectiveSection)
  }

  const refreshSection = `<div id="refresh" class="topbar-item">${refreshPCButton}\n<span class="topbar-text pad-left">Updated: <span id="timer">${nowLocaleShortDateTime()}</span>\n</span></div>`
  parts.push(refreshSection)

  // Display filters: button (same style as Refresh) after Refresh + time, opens dropdown; click outside saves, Escape cancels
  const displayOnlyDue = config.displayOnlyDue ?? false
  const displayFinished = config.displayFinished ?? false
  const displayPaused = config.displayPaused ?? true
  const displayNextActions = config.displayNextActions ?? false
  parts.push(`<div id="toggles" class="topbar-item display-filters-wrapper">`)
  parts.push(`  <button type="button" class="PCButton" id="displayFiltersButton" aria-haspopup="true" aria-expanded="false"><i class="fa-solid fa-filter pad-right"></i>Filters…</button>`)
  parts.push(`  <div class="display-filters-dropdown" id="displayFiltersDropdown" role="menu" aria-label="Display filters">`)
  parts.push(`    <div class="display-filters-dropdown-content">`)
  parts.push(`      <label class="display-filters-option">Show only projects ready for review?<input class="apple-switch pad-left" type="checkbox" ${displayOnlyDue ? 'checked' : ''} name="displayOnlyDue" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show finished projects?<input class="apple-switch pad-left" type="checkbox" ${displayFinished ? 'checked' : ''} name="displayFinished" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show paused projects?<input class="apple-switch pad-left" type="checkbox" ${displayPaused ? 'checked' : ''} name="displayPaused" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show next actions?<input class="apple-switch pad-left" type="checkbox" ${displayNextActions ? 'checked' : ''} name="displayNextActions" data-display-filter="true"></label>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)
  parts.push(`</div>`)

  const controlButtons = `<div id="reviews" class="topbar-item">Reviews: ${startReviewPCButton}\n${reviewedPCButton}\n${finishAndNextReviewPCButton}\n${nextReviewPCButton}\n</div>`
  parts.push(controlButtons)

  // Finish the sticky top bar
  parts.push(`</div>`)

  return parts.join('\n')
}

/**
 * Generate folder header HTML for Rich format.
 * @param {string} folderPart - Display name for folder
 * @param {any} config
 * @returns {string}
 */
export function generateFolderHeaderHTML(folderPart: string, config: any): string {
  const parts: Array<string> = []
  parts.push(` <div class="project-grid-row folder-header-row">`)
  parts.push(`  <div class="project-grid-cell project-grid-cell--span-2 folder-header h3">${folderPart}</div>`)
  if (config.displayDates) {
    parts.push(`  <div class="project-grid-cell folder-header"></div>`) // deliberately no header text
  }
  parts.push(` </div>`)
  return parts.join('')
}

/**
 * Generate table structure HTML with colgroup
 * @param {any} config
 * @param {number} noteCount
 * @returns {string}
 */
export function generateTableStructureHTML(_config: any, _noteCount: number): string {
  // Grid column layout is defined in CSS via .project-list-grid--with-dates / .project-list-grid--no-dates
  return ''
}

/**
 * Generate HTML for project tag section header
 * @param {string} thisTag
 * @param {number} noteCount
 * @param {number} due
 * @param {any} config
 * @param {boolean} isMultipleTags
 * @returns {string}
 */
export function generateHTMLForProjectTagSectionHeader(
  thisTag: string,
  noteCount: number,
  due: number,
  config: any,
  isMultipleTags: boolean
): string {
  const parts: Array<string> = []
  // TODO: figure out what to do about paused/caompleted being filtered out, when displaying the count here.
  let numberItemsStr = (config.displayOnlyDue)
    ? `${due} of ${noteCount} notes ready for review`
    : `${noteCount} notes`
  if (config.numberDaysForFutureToIgnore > 0) {
    numberItemsStr += ` (with future tasks ignored)`
  }
  const headingContent = `<span class="h2">${thisTag}</span><span class="folder-header-text">${numberItemsStr}</span>`
  
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
  
  const gridClass = config.displayDates ? 'project-list-grid project-list-grid--with-dates' : 'project-list-grid project-list-grid--no-dates'
  parts.push(`\n<div class="${gridClass}">`)

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
      <div><i class="pad-left pad-right fa-regular fa-file-lines"></i>
        <span id="dialogProjectFolder" class="dialogProjectFolder"></span>
        <b><span id="dialogProjectNote" class="dialogProjectNoteLink">?</span></b>
        <span id="dialogProjectInterval" class="pad-left">?</span>
      </div>
      <div class="dialog-top-right">
        <form><button id="closeButton" class="closeButton">
        <i class="fa-solid fa-circle-xmark"></i>
      </button></form></div>
    </div>
    <div class="dialogBody">
      <div class="buttonGrid" id="projectDialogButtons">
        <div>Review:</div>
        <div id="projectControlDialogProjectControls">
          <button data-control-str="start"><i class="fa-solid fa-play"></i> Start</button>
          <button data-control-str="finish"><i class="fa-regular fa-calendar-check"></i> Finish Review</button>
          <button data-control-str="nr+1w"><i class="fa-solid fa-forward"></i> Skip 1w</button>
          <button data-control-str="nr+2w"><i class="fa-solid fa-forward"></i> Skip 2w</button>
          <button data-control-str="nr+1m"><i class="fa-solid fa-forward"></i> Skip 1m</button>
          <button data-control-str="nr+1q"><i class="fa-solid fa-forward"></i> Skip 1q</button>
        </div>
        <div>Project:</div>
        <div>
          <button data-control-str="pause">Toggle <i class="fa-solid fa-circle-pause"></i> Pause</button>
          <button data-control-str="complete"><i class="fa-solid fa-circle-check"></i> Complete</button>
          <button data-control-str="cancel"><i class="fa-solid fa-circle-xmark"></i> Cancel</button>
          <button data-control-str="newrevint"><i class="fa-solid fa-arrows-left-right"></i> New Interval</button>
          <button data-control-str="addtask"><i class="fa-solid fa-circle-plus"></i> Add Task</button>
        </div>
        <div>Progress:</div>
        <div class="dialogProgressRow">
          <button data-control-str="progress"><i class="fa-solid fa-comment-lines"></i> Add Progress</button>
          <div><!-- to stop gap from appearing between next 2 spans -->
            <span id="dialogLatestProgressLabel" class="dialogLatestProgressLabel"></span>
            <span id="dialogLatestProgressText" class="dialogLatestProgressText"></span>
          </div>
        </div>
        <div>
        </div>
      </div>
    </div>
  </dialog>
`
}
