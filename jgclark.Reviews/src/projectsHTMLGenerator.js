// @flow
//-----------------------------------------------------------------------------
// HTML Generation Functions for Reviews Plugin
// Consolidated HTML generation logic from multiple files
// by Jonathan Clark
// Last updated 2026-03-29 for v1.4.0.b16, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { Project } from './projectClass'
import { addFAIcon, pluralise } from './reviewHelpers'
import type { ReviewConfig } from './reviewHelpers'
import { checkBoolean, checkString } from '@helpers/checkType'
import { logWarn } from '@helpers/dev'
import { getFolderDisplayName, getFolderDisplayNameForHTML } from '@helpers/folders'
import { createOpenOrDeleteNoteCallbackUrl } from '@helpers/general'
import { makePluginCommandButton, redToGreenInterpolation } from '@helpers/HTMLView'
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
function projectFolderDisplayLabel(thisProject: Project, config: ReviewConfig): string {
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
 * One HTML row '<div class="projectFolderRow">', with folder path, optional review interval, and review/due status <span>s.
 * Shown under the title when 'displayGroupedByFolder' is false.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @returns {string}
 */
function buildProjectFolderMetadataRowDiv(thisProject: Project, config: ReviewConfig): string {
  const folderPart = projectFolderDisplayLabel(thisProject, config)

  // Show review interval (for active projects only)
  const isActiveProject = !thisProject.isCompleted && !thisProject.isCancelled && !thisProject.isPaused
  const reviewIntervalStr = isActiveProject ? `・ <i class="fa-light fa-repeat pad-right"></i>${thisProject.reviewInterval}` : ''

  const statusLozenges = buildReviewAndDueStatusSpans(thisProject).join('\n')

  const rowString = `\n\t\t\t<div class="projectFolderRow project-metadata-row projectFolderText"><span class="projectFolderIcon"><i class="fa-regular fa-folder"></i></span><span class="pad-left pad-right-larger projectFolderText">${folderPart}${reviewIntervalStr} ${statusLozenges}</span></div>`
  return rowString
}

/**
 * Format one project for export: HTML list row (style === 'Rich'), Markdown line, or simple list line.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {string} style 'Rich' (HTML grid row), 'Markdown', or 'list'
 * @param {Array<string>?} wantedTagsForRow - when provided (single-section view), added as data-wanted-tags on the row for tag toggles
 * @returns {string} HTML or Markdown string for the project output line (or empty string if error)
 */
export function buildProjectLineForStyle(
  thisProject: Project,
  config: ReviewConfig,
  style: string,
  wantedTagsForRow?: Array<string>,
): string {
  const ignoreChecklistsInProgress = checkBoolean(DataStore.preference('ignoreChecklistsInProgress')) || false
  let output = ''
  let statsProgress = ''
  let thisPercent = ''
  if (thisProject.percentComplete != null) {
    thisPercent = (isNaN(thisProject.percentComplete)) ? '0%' : ` ${thisProject.percentComplete}%`
    const totalItemsStr = (isNaN(thisProject.numTotalItems)) ? '0' : thisProject.numTotalItems.toLocaleString()
    const numberToShow = thisProject.numCompletedItems + thisProject.numOpenItems
    if (ignoreChecklistsInProgress) {
      statsProgress = `${thisPercent} done (of ${totalItemsStr} ${pluralise('task', numberToShow)})`
    } else {
      statsProgress = `${thisPercent} done (of ${totalItemsStr} ${pluralise('item', numberToShow)})`
    }
  } else {
    statsProgress = '(0 tasks)'
  }

  if (style === 'Rich') {
    output = buildProjectListRowDiv(thisProject, config, wantedTagsForRow)
  } else if (style === 'Markdown' || style === 'list') {
    output = formatMarkdownProjectLine(thisProject, config, style, statsProgress, thisPercent)
  } else {
    logWarn('projectsHTMLGenerator::buildProjectLineForStyle', `Unknown style '${style}'; nothing returned.`)
    output = ''
  }
  return output
}

/**
 * Return HTML list row '<div class="project-grid-row projectRow">': title block, optional folder row, progress row, next-action rows.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {Array<string>?} wantedTagsForRow - when provided, output as data-wanted-tags for tag-toggle filtering
 * @returns {string}
 * @private
 */
function buildProjectListRowDiv(thisProject: Project, config: ReviewConfig, wantedTagsForRow?: Array<string>): string {
  // Build the various HTML parts of the row, and store in 'parts'
  const parts: Array<string> = []
  const wantedTagsAttr = (wantedTagsForRow != null && wantedTagsForRow.length > 0)
    ? ` data-wanted-tags="${wantedTagsForRow.join(' ').replace(/"/g, '&quot;')}"`
    : ''
  const extraStyle = `style="border-left: 5px solid ${getProjectIndicatorColor(thisProject)};"`
  
  // Start the row with the outer <div>, and inject the colour style for its left border
  parts.push(`\t<div class="project-grid-row projectRow" data-encoded-filename="${encodeRFC3986URIComponent(thisProject.filename)}"${wantedTagsAttr}${extraStyle}>\n\t\t`)

  // Edit button
  const editButtonSpan = `\t\t\t\t\t<span class="pad-left dialogTrigger" onclick="showProjectControlDialog({encodedFilename: '${encodeRFC3986URIComponent(thisProject.filename)}', reviewInterval:'${thisProject.reviewInterval}', encodedTitle:'${encodeRFC3986URIComponent(thisProject.title)}', encodedLastProgressComment:'${encodeRFC3986URIComponent(thisProject.lastProgressComment ?? '')}'})"><i class="fa-light fa-edit"></i></span>\n`

  const projectTags = buildProjectTagLozengeSpans(thisProject).join('\n')

  // Project title block
  if (!config.displayGroupedByFolder) {
    parts.push(`\n\t\t\t\t<span class="projectMainDetailsRow">${formatProjectTitleForStyle(thisProject, 'Rich', config)}
      ${editButtonSpan}
      <span class="projectTagsInline">${projectTags}</span>
      </span>`)
  } else {
    const statusLozenges = buildReviewAndDueStatusSpans(thisProject).join('\n')
    parts.push(`\n\t\t\t\t<span class="projectMainDetailsRow">${formatProjectTitleForStyle(thisProject, 'Rich', config)}
      ${editButtonSpan}
      <span class="projectTagsInline">${projectTags}${statusLozenges}</span>
      </span>`)
  }
  // Write possible row 2 under project title: folder path (if any)
  if (!config.displayGroupedByFolder) {
    parts.push(buildProjectFolderMetadataRowDiv(thisProject, config))
  }

  // Write possible rows 3 + 4 under project title: progress line row (if any) then stats then next actions (if any)
  const nextActionsContent: Array<string> = thisProject.nextActionsRawContent
    ? thisProject.nextActionsRawContent.map((na) => na.slice(getLineMainContentPos(na)))
    : []
  parts.push(buildProjectProgressRowDiv(thisProject, config))
  parts.push(buildNextActionRowDivs(config, nextActionsContent))

  // End the row with the outer </div>
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
 * Label for the progress line: localized open-task count as a numeric string, '' if inactive project.
 * When there are no open (non-future) tasks, returns '0'.
 * @param {Project} thisProject
 * @returns {string}
 * @private
 */
function formatOpenItemCountForProgressLine(thisProject: Project): string {
  // Only show counts for active projects
  if (thisProject.isCompleted || thisProject.isCancelled || thisProject.isPaused) {
    return ''
  }

  // Task count badge (circle): non-future open tasks
  const badgeNumber = (thisProject.numOpenItems - thisProject.numFutureItems > 0) ? thisProject.numOpenItems - thisProject.numFutureItems : 0
  return badgeNumber.toLocaleString()
}

/**
 * Project tag chips: each entry is one HTML <span class="metadata-lozenge"> string.
 * @param {Project} thisProject
 * @returns {Array<string>}
 * @private
 */
function buildProjectTagLozengeSpans(thisProject: Project): Array<string> {
  if (thisProject.allProjectTags == null || thisProject.allProjectTags.length === 0) return []
  const tagsToUse = thisProject.allProjectTags.filter((hashtag) => hashtag !== '#sequential')
  const parts = tagsToUse.map((hashtag) => `<span class="metadata-lozenge lozenge-general">${hashtag}</span>`)
  return parts
}

/**
 * Review and due chips: each entry is one HTML <span> string.
 * @param {Project} thisProject
 * @returns {Array<string>}
 * @private
 */
function buildReviewAndDueStatusSpans(thisProject: Project): Array<string> {
  const lozenges: Array<string> = []
  // return empty array if project is completed, cancelled or paused
  if (thisProject.isCompleted || thisProject.isCancelled || thisProject.isPaused) {
    return []
  }

  // Make Review status lozenge (from mapReviewDaysToStatus)
  if (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays)) {
    const reviewStatus = mapReviewDaysToStatus(thisProject.nextReviewDays)
    if (reviewStatus.text !== '') {
      lozenges.push(
        `<span class="pad-left ${reviewStatus.colorClass}">${addFAIcon(reviewStatus.icon ?? '')} ${reviewStatus.text}</span>`,
      )
    }
  }

  // Make Due status lozenge (from mapDueDaysToStatus), follows review in same container
  if (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) {
    const dueStatus = mapDueDaysToStatus(thisProject.dueDays)
    if (dueStatus.text !== '') {
      lozenges.push(
        `<span class="pad-left ${dueStatus.colorClass}">${addFAIcon(dueStatus.icon ?? '')} ${dueStatus.text}</span>`,
      )
    }
  }

  return lozenges
}

/**
 * One '<div class="projectProgressRow">' completion/cancel/pause line, percent and open count copy, optional progress comment.
 * Open task vs open item labels follow {@code DataStore.preference('ignoreChecklistsInProgress')} (same as {@link buildProjectLineForStyle}).
 * @param {Project} thisProject
 * @param {ReviewConfig} _config unused; kept so callers pass config unchanged
 * @returns {string}
 * @private
 */
function buildProjectProgressRowDiv(thisProject: Project, _config: ReviewConfig): string {
  // V2 with added info at start of line
  // if (!_config.displayProgress) return ''
  // Start with stat progress % and number of open tasks/items
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
        : (typeof thisProject.percentComplete === 'number' && !isNaN(thisProject.percentComplete))
          ? `${thisProject.percentComplete}% done ・ `
          : ''
  let statsString = `<span class="progressText ${extraClass}">${statsStr}</span>`

  // Match buildProjectLineForStyle / Project counts: use NotePlan preference, not ReviewConfig (they can differ).
  const ignoreChecklistsInProgress = checkBoolean(DataStore.preference('ignoreChecklistsInProgress')) || false
  if (!thisProject.isCompleted && !thisProject.isCancelled && !thisProject.isPaused) {
    const itemCountsStr = formatOpenItemCountForProgressLine(thisProject)
    const openCountLabel = ignoreChecklistsInProgress ? pluralise('task', itemCountsStr) : pluralise('item', itemCountsStr)
    statsString += `<span class="pad-left">${itemCountsStr} open ${openCountLabel}</span>`
  }

  // If there is a progress comment, show it in the progress line row, otherwise show only stats
  // logDebug('buildProjectProgressRowDiv', `for ${thisProject.title}: lastProgressComment: ${thisProject.lastProgressComment}`)
  if (thisProject.lastProgressComment !== '') {
    statsString += `<span 
    class="progressIcon pad-left-larger"><i class="fa-regular fa-circle-info"></i></span><span class="pad-left">${thisProject.lastProgressComment}</span>`
  // } else {
  //   //   return `${indent}<${tag} class="progress"><span class="progressText">${statsProgress}</span></${tag}>`
  //   return ''
  }
  const outputString = `\n\t\t\t\t<div class="projectProgressRow project-metadata-row">${statsString}</div>`
  return outputString
}

/**
 * Zero or more '<div class="nextActionRow">' rows (plain text body), joined into one string. Truncates to 80 chars per line.
 * @param {ReviewConfig} config
 * @param {Array<string>} nextActionsContent
 * @returns {string}
 * @private
 */
function buildNextActionRowDivs(config: ReviewConfig, nextActionsContent: Array<string>): string {
  if (!config.displayNextActions || nextActionsContent.length === 0) return ''

  const parts: Array<string> = []
  for (const NAContent of nextActionsContent) {
    // const truncatedNAContent = trimString(NAContent, 80)
    const truncatedNAContent = prepAndTruncateMarkdownForDisplay(NAContent, 80)
    parts.push(`\n\t\t\t<div class="nextActionRow project-metadata-row project-metadata-row"><span class="nextActionIcon"><i class="todo fa-regular fa-circle"></i></span><span class="pad-left-larger nextActionText">${truncatedNAContent}</span></div>`)
  }
  return parts.join('')
}

/**
 * Title fragment for one project: Rich HTML link + icon, Markdown wikilinks, or list-style wikilinks (not necessarily a single root element).
 * @param {Project} thisProject
 * @param {string} style 'Rich' | 'Markdown' | 'list'
 * @param {any} config
 * @return {string}
 */
function formatProjectTitleForStyle(thisProject: Project, style: string, config: any): string {
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
      logWarn('projectsHTMLGenerator::formatProjectTitleForStyle', `Unknown style '${style}'; nothing returned.`)
      return ''
  }
}

/**
 * One Markdown or list-format line for a project (plain text / markdown, not HTML row markup).
 * @param {Project} thisProject
 * @param {any} config
 * @param {string} style {@code 'Markdown'} | {@code 'list'}
 * @param {string} statsProgress
 * @param {string} thisPercent
 * @returns {string}
 * @private
 */
function formatMarkdownProjectLine(thisProject: Project, config: any, style: string, statsProgress: string, thisPercent: string): string {
  const parts: Array<string> = []
  parts.push('- ')
  parts.push(formatProjectTitleForStyle(thisProject, style, config))

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
function mapDueDaysToStatus(interval: number): IntervalStatus {
  // if (interval < -90) return { color: 'red', icon: 'fa-solid fa-flag-checkered', text: 'very overdue' }
  if (interval < -7) return { colorClass: 'overdue', icon: 'fa-light fa-flag-checkered', text: 'overdue' }
  if (interval < 7) return { colorClass: 'due', icon: 'fa-light fa-flag-checkered', text: 'due now' }
  if (interval < 21) return { colorClass: 'soon', icon: 'fa-light fa-flag-checkered', text: 'due soon' }
  return { text: '', colorClass: '', icon: '' }
}

/**
 * Map days-until-next-review to icon/text/css class for a status <span>.
 * @param {number} interval - days until next review (negative = overdue, positive = due in future)
 * @returns {IntervalStatus}
 */
function mapReviewDaysToStatus(interval: number): IntervalStatus {
  // if (interval < -90) return { color: 'red', icon: 'fa-solid fa-user-clock', text: 'very overdue' }
  if (interval < -7) return { colorClass: 'overdue', icon: 'fa-light fa-user-clock', text: 'overdue' }
  if (interval < 2) return { colorClass: 'due', icon: 'fa-light fa-user-clock', text: 'review now' }
  if (interval < 14) return { colorClass: 'soon', icon: 'fa-light fa-user-clock', text: 'review soon' }
  return { text: '', colorClass: '', icon: '' }
}

//-----------------------------------------------------------------------------
// HTML Structure Generation
//-----------------------------------------------------------------------------

/**
 * Sticky top bar <div>: refresh, filters dropdown, review command buttons.
 * @param {any} config
 * @returns {string}
 */
export function buildProjectListTopBarHtml(config: any): string {
  const topbarClasses = config.usePerspectives ? 'topbar' : 'topbar topbar-no-perspective'
  const parts: Array<string> = []
  const displayOrder = (typeof config.displayOrder === 'string' && config.displayOrder !== '') ? config.displayOrder : 'review'
  
  // Add buttons for various commands
  const refreshPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-arrow-rotate-right"></i><span class="hideable-label"> Refresh</span>`,
    'jgclark.Reviews',
    'project lists',
    '',
    'Recalculate project lists and update this window',
    true
  )
  const startReviewPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-play"></i><span class="hideable-label"> Start</span>`,
    'jgclark.Reviews',
    'start reviews',
    '',
    'Opens the next project to review in the NP editor',
    true
  )
  const reviewedPCButton = makePluginCommandButton(
    `<i class="fa-regular fa-calendar-check"></i><span class="hideable-label"> Finish</span>`,
    'jgclark.Reviews',
    'finish project review',
    '',
    `Update the ${checkString(DataStore.preference('reviewedMentionStr'))}() date for the Project you're currently editing`,
    true
  )
  const finishAndNextReviewPCButton = makePluginCommandButton(
    `<i class="fa-regular fa-calendar-check"></i><span class="hideable-label"> Finish +</span><i class="fa-solid fa-calendar-arrow-down pad-left"></i><span class="hideable-label"> Next</span>`,
    'jgclark.Reviews',
    'finish project review and start next',
    '',
    `Finish review of currently open Project and start the next review`,
    true
  )
  const nextReviewPCButton = makePluginCommandButton(
    `<i class="fa-solid fa-calendar-arrow-down"></i><span class="hideable-label"> Next</span>`,
    'jgclark.Reviews',
    'next project review',
    '',
    `Move on to the next project to review`,
    true
  )

  // Start with a sticky top bar (grid with 4 elements spaced out, or 3 if not using perspectives)
  parts.push(`<div class="${topbarClasses}">`)
  if (config.usePerspectives) {
    const perspectiveSection = `<div id="persp" class="topbar-item">Persp: <span class="perspective-name">${config.perspectiveName}</span></div>`
    parts.push(perspectiveSection)
  }

  const refreshSection = `<div id="refresh">${refreshPCButton}\n<span class="topbar-item"><span class="hideable-label">Updated: </span><span id="timer">${nowLocaleShortDateTime()}</span>\n</span></div>`
  parts.push(refreshSection)

  parts.push(`<div class="topbar-center-cluster">`)
  // Display filters: centred button opens dropdown; click outside saves, Escape cancels
  const displayOnlyDue = config.displayOnlyDue ?? false
  const displayFinished = config.displayFinished ?? false
  const displayPaused = config.displayPaused ?? true
  const displayNextActions = config.displayNextActions ?? false
  parts.push(`<span id="toggles" class="display-filters-wrapper">`)
  parts.push(`  <button type="button" class="PCButton" id="displayFiltersButton" aria-haspopup="true" aria-expanded="false" title="Open dropdown to change Filtering and Ordering of the list"><i class="fa-solid fa-filter pad-right"></i><span class="hideable-label">Filter +</span><i class="fa-regular fa-arrow-down-short-wide pad-left"></i><span class="hideable-label">Order…</span></button>`)
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
  parts.push(`          <option value="firstTag" ${displayOrder === 'firstTag' ? 'selected' : ''}>(first) Project tag</option>`)
  parts.push(`          <option value="title" ${displayOrder === 'title' ? 'selected' : ''}>Title</option>`)
  parts.push(`        </select>`)
  parts.push(`      </div>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)
  parts.push(`</span>`)

  parts.push(`</div>`)

  const controlButtons = `
<div class="topbar-right-cluster">
  <div id="reviews" class="topbar-item">Reviews: ${startReviewPCButton}
  ${reviewedPCButton}
  ${finishAndNextReviewPCButton}
  ${nextReviewPCButton}
  </div>
</div>`
  parts.push(controlButtons)

  // Finish the sticky top bar
  parts.push(`</div>`)

  return parts.join('\n')
}

/**
 * Folder group heading row ({@code <div class="folder-header-row">}).
 * @param {string} folderPart - Display name for folder
 * @returns {string}
 */
export function buildFolderGroupHeaderHtml(folderPart: string): string {
  const parts: Array<string> = []
  parts.push(` <div class="folder-header-row">`)
  parts.push(`  <div class="project-grid-cell project-grid-cell--span-2 folder-header h3">${folderPart}</div>`)
  parts.push(` </div>`)
  return parts.join('')
}

/**
 * {@code <dialog id="projectControlDialog">} markup for per-project actions.
 * @returns {string}
 */
export function buildProjectControlDialogHtml(): string {
  return `
  <!----------- Dialog to show on Project items ----------->
  <dialog id="projectControlDialog" class="projectControlDialog" aria-labelledby="Actions Dialog"
    aria-describedby="Actions that can be taken on projects">
    <div class="dialogTitle">
      <div><i class="pad-left pad-right fa-regular fa-file-lines"></i>
        <span id="dialogProjectFolder" class="dialogProjectFolder"></span>
        <b><span id="dialogProjectNote" class="dialogProjectNoteLink">?</span></b>
        <span id="dialogProjectInterval" class="pad-left dialogProjectFolder">?</span>
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
          <button data-control-str="newrevint"><i class="fa-regular fa-repeat"></i> New Interval</button>
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
