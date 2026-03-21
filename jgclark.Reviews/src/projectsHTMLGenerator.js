// @flow
//-----------------------------------------------------------------------------
// HTML Generation Functions for Reviews Plugin
// Consolidated HTML generation logic from multiple files
// by Jonathan Clark
// Last updated 2026-03-20 for v1.4.0.b9 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { Project } from './projectClass'
import { addFAIcon, type ReviewConfig } from './reviewHelpers'
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
 * Folder label for a per-project row, matching folder header display (hideTopLevelFolder, root).
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @returns {string}
 */
function getFolderPartForProjectRow(thisProject: Project, config: ReviewConfig): string {
  const folderDisplayName = getFolderDisplayNameForHTML(thisProject.folder)
  let folderPart = folderDisplayName
  if (config.hideTopLevelFolder) {
    if (folderDisplayName.includes(']')) {
      const match = folderDisplayName.match(/^(\[.*?\])\s*(.+)$/)
      if (match) {
        const pathPart = match[2]
        const pathParts = pathPart.split('/').filter((p) => p !== '')
        folderPart = `${match[1]} ${pathParts.length > 0 ? pathParts[pathParts.length - 1] : pathPart}`
      } else {
        folderPart = folderDisplayName.split('/').slice(-1)[0] || folderDisplayName
      }
    } else {
      const pathParts = folderDisplayName.split('/').filter((p) => p !== '')
      folderPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : folderDisplayName
    }
  }
  if (thisProject.folder === '/') folderPart = '(root folder)'
  return folderPart
}

/**
 * Second line in column 2 when "Group by folder" is on: note folder path (same rules as folder headers).
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @returns {string}
 */
function generateFolderRowHtml(thisProject: Project, config: ReviewConfig): string {
  const folderPart = getFolderPartForProjectRow(thisProject, config)

  // Show review interval (for active projects only)
  const isActiveProject = !thisProject.isCompleted && !thisProject.isCancelled && !thisProject.isPaused
  const reviewIntervalStr = isActiveProject ? `・ <i class="fa-light fa-repeat pad-right"></i>${thisProject.reviewInterval}` : ''

  const statusLozenges = config.statusLozengesInColumn2 ? generateStatusLozengesSpans(thisProject).join('\n') : ''

  const rowString = `\n\t\t\t<div class="projectFolderRow projectColumn2SubRow projectFolderText"><span class="projectFolderIcon"><i class="fa-regular fa-folder"></i></span><span class="pad-left pad-right-larger projectFolderText">${folderPart}${reviewIntervalStr} ${statusLozenges}</span></div>`
  return rowString
}

/**
 * Returns line showing more detailed summary of the project, for output in Rich (HTML) or Markdown formats or simple list format.
 * Now uses fontawesome icons for some indicators.
 * Note: this is V2, now *not* part of the Project class, so can take config etc.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {string} style: 'Rich' (-> HTML), or 'Markdown'
 * @param {Array<string>?} wantedTagsForRow - when provided (single-section view), added as data-wanted-tags on the row for tag toggles
 * @returns {string} HTML or Markdown string for the project output line (or empty string if error)
 */
export function generateProjectOutputLine(
  thisProject: Project,
  config: ReviewConfig,
  style: string,
  wantedTagsForRow?: Array<string>,
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
    output = generateRichHTMLRow(thisProject, config, wantedTagsForRow)
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
 * @param {Array<string>?} wantedTagsForRow - when provided, output as data-wanted-tags for tag-toggle filtering
 * @returns {string}
 * @private
 */
function generateRichHTMLRow(thisProject: Project, config: ReviewConfig, wantedTagsForRow?: Array<string>): string {
  const parts: Array<string> = []
  const wantedTagsAttr = (wantedTagsForRow != null && wantedTagsForRow.length > 0)
    ? ` data-wanted-tags="${wantedTagsForRow.join(' ').replace(/"/g, '&quot;')}"`
    : ''
  const extraStyle = `style="border-left: 5px solid ${getProjectIndicatorColor(thisProject)};"`
  parts.push(`\t<div class="project-grid-row projectRow" data-encoded-filename="${encodeRFC3986URIComponent(thisProject.filename)}"${wantedTagsAttr}${extraStyle}>\n\t\t`)
  parts.push(generateCircleIndicator(thisProject))

  // Column 2a: Project name + link / edit button / open-count badge / project tags (if setting is column2)
  const editButtonSpan = `\t\t\t\t\t<span class="pad-left dialogTrigger" onclick="showProjectControlDialog({encodedFilename: '${encodeRFC3986URIComponent(thisProject.filename)}', reviewInterval:'${thisProject.reviewInterval}', encodedTitle:'${encodeRFC3986URIComponent(thisProject.title)}', encodedLastProgressComment:'${encodeRFC3986URIComponent(thisProject.lastProgressComment ?? '')}'})"><i class="fa-light fa-edit"></i></span>\n`

  const showTagsInColumn2 = config.projectTagsInColumn !== 'column3'
  const projectTags = showTagsInColumn2 ? generateProjectTagsLozengesSpan(thisProject).join('\n') : ''

  // const statusLozenges = config.statusLozengesInColumn2 ? generateStatusLozengesSpans(thisProject).join('\n') : ''
  // TEST: moved statusLozenges from after projectTags here to folder row
  if (!config.displayGroupedByFolder) {
    // parts.push(`\n\t\t\t<div class="project-grid-cell project-grid-cell--content">`)
    parts.push(`\n\t\t\t\t<span class="projectMainDetailsRow">${ decoratedProjectTitle(thisProject, 'Rich', config)}
      ${editButtonSpan}
      <span class="projectTagsInline">${projectTags}</span>
      </span>`)
  } else {
    const statusLozenges = config.statusLozengesInColumn2 ? generateStatusLozengesSpans(thisProject).join('\n') : ''
    // parts.push(`\n\t\t\t<div class="project-grid-cell project-grid-cell--content">`)
    parts.push(`\n\t\t\t\t<span class="projectMainDetailsRow">${decoratedProjectTitle(thisProject, 'Rich', config)}
      ${editButtonSpan}
      <span class="projectTagsInline">${projectTags}${statusLozenges}</span>
      </span>`)
  }
  // Write possible row 2 under project title: folder path (if any)
  if (!config.displayGroupedByFolder) {
    parts.push(generateFolderRowHtml(thisProject, config))
  }

  // Write possible rows 3 + 4 under project title: progress line row (if any) then stats then next actions (if any)
  const nextActionsContent: Array<string> = thisProject.nextActionsRawContent
    ? thisProject.nextActionsRawContent.map((na) => na.slice(getLineMainContentPos(na)))
    : []
  parts.push(generateProgressRowDiv(thisProject))
  parts.push(generateNextActionsSection(config, nextActionsContent))
  // parts.push(`</div>`)

  // Column 3: metadata (dates + project tags/hashtags), unless status lozenges are shown inline in column 2
  if (!config.statusLozengesInColumn2) {
    parts.push(generateDateSectionForCol3(thisProject, config))
  }
  parts.push('\n\t</div>')

  return parts.join('')
}

/**
 * Get the color for the project indicator
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function getProjectIndicatorColor(thisProject: Project): string {
  if (thisProject.isCompleted) {
    return 'var(--project-completed-color)'
  } else if (thisProject.isCancelled) {
    return 'var(--project-cancelled-color)'
  } else if (thisProject.isPaused) {
    return 'var(--project-paused-color)'
  } else if (thisProject.percentComplete == null || isNaN(thisProject.percentComplete)) {
    return 'var(--project-no-percent-color)'
  } else if (thisProject.percentComplete === 0) {
    return 'var(--project-zero-progress-color)'
  } else {
    return redToGreenInterpolation(thisProject.percentComplete)
  }
}

/**
 * Generate circle indicator HTML for project status
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function generateCircleIndicator(thisProject: Project): string {
  let specificClass = ''
  let decoration = ''
  if (thisProject.isCompleted) {
    specificClass = 'checked'
    decoration = addFAIcon('fa-solid fa-circle-check circle-icon')
  } else if (thisProject.isCancelled) {
    specificClass = 'cancelled'
    decoration = addFAIcon('fa-solid fa-circle-xmark circle-icon')
  } else if (thisProject.isPaused) {
    decoration = addFAIcon("fa-solid fa-circle-pause circle-icon", "var(--project-paused-color)")
  } else if (thisProject.percentComplete == null || isNaN(thisProject.percentComplete)) {
    decoration = addFAIcon('fa-solid fa-circle circle-icon', 'var(--project-no-percent-color)')
  } else if (thisProject.percentComplete === 0) {
    decoration = addSVGPercentRing(thisProject, 100, '#FF000088', '0')
  } else {
    decoration = addSVGPercentRing(thisProject, thisProject.percentComplete, 'multicol', String(thisProject.percentComplete))
  }
  // Historic layout with circle
  // const divString = `<div class="project-grid-cell first-col-indicator ${specificClass}">${decoration}</div>`
  // TEST: New version without circle
  const divString = ``
  return divString
}

/**
 * Generate item count badge HTML
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function getItemCountsString(thisProject: Project): string {
  // Only show counts for active projects
  if (thisProject.isCompleted || thisProject.isCancelled || thisProject.isPaused) {
    return ''
  }
  
  // Task count badge (circle)
  const badgeNumber = (thisProject.numOpenItems - thisProject.numFutureItems > 0) ? thisProject.numOpenItems - thisProject.numFutureItems : 0
  if (badgeNumber > 0) {
    return badgeNumber.toLocaleString()
  }
  return 'no'
}

/**
 * Generate project tags as lozenge spans (for use in column 2 after open-count badge).
 * @param {Project} thisProject
 * @returns {Array<string>} lozenges
 * @private
 */
function generateProjectTagsLozengesSpan(thisProject: Project): Array<string> {
  if (thisProject.allProjectTags == null || thisProject.allProjectTags.length === 0) return []
  const tagsToUse = thisProject.allProjectTags.filter((hashtag) => hashtag !== '#sequential')
  const parts = tagsToUse.map((hashtag) => `<span class="metadata-lozenge lozenge-general">${hashtag}</span>`)
  return parts
}

/**
 * Build review/due status lozenges (without wrapping container), for use either in column 2 or column 3.
 * @param {Project} thisProject
 * @returns {Array<string>} lozenges
 * @private
 */
function generateStatusLozengesSpans(thisProject: Project): Array<string> {
  const lozenges: Array<string> = []
  // return empty array if project is completed, cancelled or paused
  if (thisProject.isCompleted || thisProject.isCancelled || thisProject.isPaused) {
    return []
  }

  // Make Review status lozenge (from getIntervalReviewStatus)
  if (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays)) {
    const reviewStatus = getIntervalReviewStatus(thisProject.nextReviewDays)
    if (reviewStatus.text !== '') {
      lozenges.push(
        // `<span class="metadata-lozenge lozenge-${reviewStatus.colorClass}">${addFAIcon(reviewStatus.icon ?? '')} ${reviewStatus.text}</span>`,
        `<span class="pad-left ${reviewStatus.colorClass}">${addFAIcon(reviewStatus.icon ?? '')} ${reviewStatus.text}</span>`,
      )
    }
  }

  // Make Due status lozenge (from getIntervalDueStatus), follows review in same container
  if (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) {
    const dueStatus = getIntervalDueStatus(thisProject.dueDays)
    if (dueStatus.text !== '') {
      lozenges.push(
        // `<span class="metadata-lozenge lozenge-${dueStatus.colorClass}">${addFAIcon(dueStatus.icon ?? '')} ${dueStatus.text}</span>`,
        `<span class="pad-left ${dueStatus.colorClass}">${addFAIcon(dueStatus.icon ?? '')} ${dueStatus.text}</span>`,
      )
    }
  }

  return lozenges
}

/**
 * Generate progress section HTML (stats: percent done / item count; comment shown in progress line row when present)
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function generateProgressRowDiv(thisProject: Project): string {
  // V2 with added info at start of line
  // if (!config.displayProgress) return ''
  // Start with stat progress % and number of open tasks
  const timeAgoStr = (thisProject.isCompleted)
    ? moment(thisProject.completedDate).fromNow()
    : (thisProject.isCancelled)
      ? moment(thisProject.cancelledDate).fromNow()
      : (thisProject.isPaused)
        ? 'paused'
        : ''
  const extraClass = (thisProject.isCompleted)
    ? 'checked'
    : (thisProject.isCancelled)
      ? 'cancelled'
      : (thisProject.isPaused)
        ? 'paused'
        : ''
  const statsStr = (thisProject.isCompleted)
    ? `<i class="fa-solid fa-circle-check pad-right"></i> ${timeAgoStr}`
    : (thisProject.isCancelled)
      ? `<i class="fa-solid fa-circle-xmark pad-right"></i> ${timeAgoStr}`
      : (thisProject.isPaused)
        ? `<i class="fa-solid fa-circle-pause pad-right"></i> ${timeAgoStr}`
        : (isNaN(thisProject.percentComplete))
          ? ''
          : `${thisProject.percentComplete}% done ・ `
  let statsString = `<span class="progressText ${extraClass}">${statsStr}</span>`
  
  if (!thisProject.isCompleted && !thisProject.isCancelled && !thisProject.isPaused) {
    const itemCountsStr = getItemCountsString(thisProject)
    const itemCountsDescription = (itemCountsStr === "1") ? `open item` : `open items`
    statsString += `<span class="pad-left">${itemCountsStr} ${itemCountsDescription}</span>`
  }

  // If there is a progress comment, show it in the progress line row, otherwise show only stats
  // logDebug('generateProgressRowDiv', `for ${thisProject.title}: lastProgressComment: ${thisProject.lastProgressComment}`)
  if (thisProject.lastProgressComment !== '') {
    statsString += `<span 
    class="progressIcon pad-left-larger"><i class="fa-regular fa-circle-info"></i></span><span class="pad-left">${thisProject.lastProgressComment}</span>`
  // } else {
  //   //   return `${indent}<${tag} class="progress"><span class="progressText">${statsProgress}</span></${tag}>`
  //   return ''
  }
  const outputString = `\n\t\t\t\t<div class="projectProgressRow projectColumn2SubRow">${statsString}</div>`
  return outputString
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
    parts.push(`\n\t\t\t<div class="nextActionRow projectColumn2SubRow projectColumn2SubRow"><span class="nextActionIcon"><i class="todo fa-regular fa-circle"></i></span><span class="pad-left-larger nextActionText">${truncatedNAContent}</span></div>`)
  }
  return parts.join('')
}

/**
 * Generate HTML for column 3 (metadata column) for up to two coloured lozenges (review status then due status from getIntervalReviewStatus / getIntervalDueStatus),
 * and when present a line of project hashtags from from metadata line and/or frontmatter `project` value.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @returns {string}
 * @private
 */
function generateDateSectionForCol3(thisProject: Project, config: ReviewConfig): string {
  if (!config.displayDates) return ''

  // When status lozenges are shown inline in column 2, there is no separate metadata column (column 3)
  if (config.statusLozengesInColumn2) return ''

  if (thisProject.isPaused) return '<div class="project-grid-cell project-grid-cell--metadata"></div>'

  if (thisProject.isPaused) {
    return '<div class="project-grid-cell project-grid-cell--metadata"></div>'
  }
  else if (thisProject.isCompleted) {
    const completionRef = thisProject.completedDuration || "completed"
    return `<div class="project-grid-cell project-grid-cell--metadata checked">Completed ${completionRef}</div>`
  }
  else if (thisProject.isCancelled) {
    const cancellationRef = thisProject.cancelledDuration || "cancelled"
    return `<div class="project-grid-cell project-grid-cell--metadata cancelled">Cancelled ${cancellationRef}</div>`
  }

  const lozenges: Array<string> = []

  // Project tags: in column 3 only when setting is 'column3'; otherwise they are in column 2
  if (config.projectTagsInColumn === 'column3' && thisProject.allProjectTags != null && thisProject.allProjectTags.length > 0) {
    // for (const hashtag of thisProject.allProjectTags) {
    //   lozenges.push(`<span class="metadata-lozenge lozenge-general">${hashtag}</span>`)
    // }
    lozenges.push(...generateProjectTagsLozengesSpan(thisProject))
  }

  // Review/due status lozenges (from helper), follow tags in same column
  lozenges.push(...generateStatusLozengesSpans(thisProject))

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

type IntervalStatus = {
  colorClass: string,
  icon: string,
  text: string,
}

/**
 * Map a review interval (days until/since due) to a display color and label.
 * @param {number} interval - days until due (negative = overdue, positive = due in future)
 * @returns {{ color: string, text: string }}
 */
function getIntervalDueStatus(interval: number): IntervalStatus {
  // if (interval < -90) return { color: 'red', icon: 'fa-solid fa-flag-checkered', text: 'very overdue' }
  if (interval < -14) return { colorClass: 'overdue', icon: 'fa-light fa-flag-checkered', text: 'overdue' }
  if (interval < 0) return { colorClass: 'due', icon: 'fa-light fa-flag-checkered', text: 'due now' }
  if (interval > 30) return { colorClass: 'soon', icon: 'fa-light fa-flag-checkered', text: 'due soon' }
  return { text: '', colorClass: '', icon: '' }
}

/**
 * Map a review interval (days until/since next review) to a display color and label.
 * @param {number} interval - days until next review (negative = overdue, positive = due in future)
 * @returns {{ color: string, text: string }}
 */
function getIntervalReviewStatus(interval: number): IntervalStatus {
  // if (interval < -90) return { color: 'red', icon: 'fa-solid fa-user-clock', text: 'very overdue' }
  if (interval < -14) return { colorClass: 'overdue', icon: 'fa-light fa-user-clock', text: 'overdue' }
  if (interval < 0) return { colorClass: 'due', icon: 'fa-light fa-user-clock', text: 'due now' }
  if (interval < 30) return { colorClass: 'soon', icon: 'fa-light fa-user-clock', text: 'due soon' }
  return { text: '', colorClass: '', icon: '' }
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
  const displayOrder = (typeof config.displayOrder === 'string' && config.displayOrder !== '') ? config.displayOrder : 'review'
  
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

  // Start with a sticky top bar (grid with 4 elements spaced out)
  parts.push(`<div class="topbar">`)

  if (config.usePerspectives) {
    const perspectiveSection = `<div id="persp" class="topbar-item">Persp: <span class="perspective-name">${config.perspectiveName}</span></div>`
    parts.push(perspectiveSection)
  } else {
    // Need an empty element to for the grid to work
    parts.push(`<div class="topbar-item"></div>`)
  }

  const refreshSection = `<div id="refresh">${refreshPCButton}\n<span class="topbar-item">Updated: <span id="timer">${nowLocaleShortDateTime()}</span>\n</span></div>`
  parts.push(refreshSection)

  parts.push(`<div class="topbar-center-cluster">`)
  // Display filters: centred button opens dropdown; click outside saves, Escape cancels
  const displayOnlyDue = config.displayOnlyDue ?? false
  const displayFinished = config.displayFinished ?? false
  const displayPaused = config.displayPaused ?? true
  const displayNextActions = config.displayNextActions ?? false
  parts.push(`<span id="toggles" class="display-filters-wrapper">`)
  parts.push(`  <button type="button" class="PCButton" id="displayFiltersButton" aria-haspopup="true" aria-expanded="false"><i class="fa-solid fa-filter pad-right"></i>Filter & Order…</button>`)
  parts.push(`  <div class="display-filters-dropdown" id="displayFiltersDropdown" role="menu" aria-label="Filter and order">`)
  parts.push(`    <div class="display-filters-dropdown-content">`)
  // Tag toggles: one per wanted tag; when off, hide projects that only have that tag (client-side). Count = active (not paused/cancelled/completed).
  const projectTypeTags = config.projectTypeTags != null && typeof config.projectTypeTags === 'string' ? [config.projectTypeTags] : (config.projectTypeTags ?? [])
  const tagActiveCounts = config.tagActiveCounts ?? []
  if (projectTypeTags.length > 0) {
    parts.push(`      <div id="tagToggles" class="display-filters-tag-toggles">`)
    for (let i = 0; i < projectTypeTags.length; i++) {
      const tag = projectTypeTags[i]
      const count = tagActiveCounts[i] != null ? tagActiveCounts[i] : 0
      const safeId = `tagToggle-${tag.replace(/[^a-zA-Z0-9-_]/g, '_')}`
      parts.push(`        <label class="display-filters-option display-filters-option--tag-row">`)
      parts.push(`          <span class="display-filters-option-text">${tag}</span> <span class="display-filters-option-count">(${count})</span>`)
      parts.push(`          <input type="checkbox" class="apple-switch" data-tag-toggle="${tag.replace(/"/g, '&quot;')}" id="${safeId}" checked>`)
      parts.push(`        </label>`)
    }
    parts.push(`      </div>`)
    parts.push(`      <hr class="display-filters-divider">`)
  }
  parts.push(`      <label class="display-filters-option">Show only projects ready for review?<input class="apple-switch pad-left" type="checkbox" ${displayOnlyDue ? 'checked' : ''} name="displayOnlyDue" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show finished projects?<input class="apple-switch pad-left" type="checkbox" ${displayFinished ? 'checked' : ''} name="displayFinished" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show paused projects?<input class="apple-switch pad-left" type="checkbox" ${displayPaused ? 'checked' : ''} name="displayPaused" data-display-filter="true"></label>`)
  parts.push(`      <label class="display-filters-option">Show next actions?<input class="apple-switch pad-left" type="checkbox" ${displayNextActions ? 'checked' : ''} name="displayNextActions" data-display-filter="true"></label>`)
  parts.push(`      <hr class="display-filters-divider">`)
  parts.push(`      <div class="display-filters-order-row">`)
  parts.push(`        <label for="displayOrderSelect" class="display-filters-order-label">Order by</label>`)
  parts.push(`        <select id="displayOrderSelect" class="topbar-select display-filters-order-select" name="displayOrder" aria-label="Sort projects by">`)
  parts.push(`          <option value="review" ${displayOrder === 'review' ? 'selected' : ''}>Review date</option>`)
  parts.push(`          <option value="due" ${displayOrder === 'due' ? 'selected' : ''}>Due date</option>`)
  parts.push(`          <option value="title" ${displayOrder === 'title' ? 'selected' : ''}>Title</option>`)
  parts.push(`        </select>`)
  parts.push(`      </div>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)
  parts.push(`</span>`)

  parts.push(`</div>`)

  // const controlButtons = `<div id="reviews" class="topbar-item">Reviews: ${startReviewPCButton}\n${reviewedPCButton}\n${finishAndNextReviewPCButton}\n${nextReviewPCButton}\n</div>`
  const controlButtons = `<div class="topbar-right-cluster"><div id="reviews" class="topbar-item">Reviews: ${startReviewPCButton}\n${reviewedPCButton}\n${nextReviewPCButton}\n</div></div>`
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
  const hasMetadataColumn = config.displayDates && !config.statusLozengesInColumn2
  // Note: following uses header-row--newer to turn off borders on the folder header row
  parts.push(` <div class="folder-header-row--newer">`)
  parts.push(`  <div class="project-grid-cell project-grid-cell--span-2 folder-header h3">${folderPart}</div>`)
  if (hasMetadataColumn) {
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
 * Generate HTML for single always-visible projects section (no details/summary).
 * Used when showing all projects in one section with tag toggles in the topbar.
 * @param {number} noteCount
 * @param {number} due
 * @param {any} config
 * @returns {string}
 */
export function generateSingleSectionHeaderHTML(noteCount: number, due: number, config: any): string {
  const parts: Array<string> = []
  let numberItemsStr = (config.displayOnlyDue)
    ? `${due} of ${noteCount} notes ready for review`
    : `${noteCount} notes`
  if (config.numberDaysForFutureToIgnore > 0) {
    numberItemsStr += ` (with future tasks ignored)`
  }
  // parts.push(`  <div class="folder-header">`)
  // parts.push(`    <span class="h2">Projects</span><span class="folder-header-text">${numberItemsStr}</span>`)
  // parts.push(`  </div>`)
  
  parts.push(`\n<div class="details-content projects-single-section-content">`)
  if (!config.displayGroupedByFolder && config.foldersToInclude.length === 1) {
    const folderDisplayName = getFolderDisplayNameForHTML(config.foldersToInclude[0])
    parts.push(`<h4>${folderDisplayName} folder</h4>`)
  }
  const hasMetadataColumn = config.displayDates && !config.statusLozengesInColumn2
  const gridClass = hasMetadataColumn ? 'project-list-grid project-list-grid--with-dates' : 'project-list-grid project-list-grid--no-dates'
  parts.push(`\n<div class="${gridClass}">`)
  return parts.join('\n')
}

/**
 * Generate HTML for project tag section header (legacy: per-tag sections; kept for Markdown path if needed)
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
  const hasMetadataColumn = config.displayDates && !config.statusLozengesInColumn2
  const gridClass = hasMetadataColumn ? 'project-list-grid project-list-grid--with-dates' : 'project-list-grid project-list-grid--no-dates'
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
