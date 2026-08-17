/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Project list display, rendering, and display-filter commands
// Extracted from reviews.js
// by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { invalidateDashboardPluginSettingsCache } from '../../jgclark.Dashboard/src/dashboardPluginSettings.js'
import pluginJson from '../plugin.json'
import { checkForWantedResources } from '../../np.Shared/src/index.js'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import {
  filterAndSortProjectsList,
  generateAllProjectsList,
} from './allProjectsListHelpers.js'
import { Project } from './projectClass'
import {
  buildEmptyProjectListHelpHtml,
  buildProjectLineForStyle,
  buildProjectListTopBarHtml,
  buildProjectControlDialogHtml,
  buildFolderGroupHeaderHtml,
} from './projectsHTMLGenerator.js'
import {
  stylesheetinksInHeader,
  faLinksInHeader,
  checkboxHandlerJSFunc,
  scrollPreLoadJSFuncs,
  commsBridgeScripts,
  shortcutsScript,
  autoRefreshScript,
  addToggleEvents,
  displayFiltersDropdownScript,
  tagTogglesVisibilityScript,
  resizeListenerScript,
  windowCloseAndReopenScripts,
} from './projectsHTMLTemplates.js'
import {
  customMarkdownWinId,
  filenameHTMLCopy,
  pluginID,
  RICH_PROJECT_LIST_WIN_ID,
  windowTitle,
  type DisplayToggleKey,
} from './reviewsConstants'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import { getFolderDisplayName, getFolderDisplayNameForHTML } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { showHTMLV2, sendToHTMLWindow } from '@helpers/HTMLView'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { getOrOpenEditorFromFilename, isNoteOpenInEditor } from '@helpers/NPEditor'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { isHTMLWindowOpen, setEditorWindowId } from '@helpers/NPWindows'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { showMessage } from '@helpers/userInput'

/**
 * Tell the Project List HTML window which project is currently being reviewed (if the window is open).
 * Adds the 'reviewing' class on the matching projectRow.
 * Call this after opening/focusing the note so a list refresh from the open does not wipe the highlight.
 * @param {CoreNoteFields | TNote | any} note - note being reviewed
 */
export async function setReviewingProjectInHTML(note: any): Promise<void> {
  try {
    logDebug('setReviewingProjectInHTML', `Setting 'reviewing' state for note '${displayTitle(note)}' for window ${RICH_PROJECT_LIST_WIN_ID}`)
    if (!note || note.type !== 'Notes') {
      return
    }
    if (!isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)) {
      logDebug('setReviewingProjectInHTML', `- Rich project list window not open; skipping`)
      return
    }
    const encodedFilename = encodeRFC3986URIComponent(note.filename)
    await sendToHTMLWindow(RICH_PROJECT_LIST_WIN_ID, 'SET_REVIEWING_PROJECT', { encodedFilename })
  } catch (error) {
    logError('setReviewingProjectInHTML', error.message)
  }
}

/**
 * Clear the 'reviewing' state from all project rows in the Project List HTML window.
 * @author @jgclark
 */
export async function clearProjectReviewingInHTML(): Promise<void> {
  try {
    if (!isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)) {
      return
    }
    await sendToHTMLWindow(RICH_PROJECT_LIST_WIN_ID, 'CLEAR_REVIEWING_PROJECT')
  } catch (error) {
    logError('clearProjectReviewingInHTML', error.message)
  }
}
/**
 * Return a grouped folder display label, optionally hiding top-level path parts.
 * Handles both teamspace and standard folder names.
 * @param {string} folder
 * @param {boolean} isRichStyle
 * @param {boolean} hideTopLevelFolder
 * @returns {string}
 * @private
 */
function getGroupedFolderDisplayLabel(folder: string, isRichStyle: boolean, hideTopLevelFolder: boolean): string {
  const folderDisplayName = isRichStyle
    ? getFolderDisplayNameForHTML(folder)
    : getFolderDisplayName(folder, true)

  let folderPart = folderDisplayName
  if (hideTopLevelFolder) {
    if (folderDisplayName.includes(']')) {
      const match = folderDisplayName.match(/^(\[.*?\])\s*(.+)$/)
      if (match) {
        const pathPart = match[2]
        const pathParts = pathPart.split('/').filter(p => p !== '')
        const lastPathPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : pathPart
        folderPart = `${match[1]} ${lastPathPart}`
      } else {
        folderPart = folderDisplayName.split('/').slice(-1)[0] || folderDisplayName
      }
    } else {
      const pathParts = folderDisplayName.split('/').filter(p => p !== '')
      folderPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : folderDisplayName
    }
  }

  if (folder === '/') {
    folderPart = '(root folder)'
  }
  return folderPart
}

/**
 * Render markdown and/or rich project list outputs from config.outputStyle.
 * @param {ReviewConfig} config
 * @param {boolean} shouldOpen
 * @param {number} scrollPos
 * @returns {Promise<void>}
 * @private
 */
async function runProjectListRenderers(config: ReviewConfig, shouldOpen: boolean, scrollPos: number = 0): Promise<void> {
  if (config.outputStyle.match(/markdown/i)) {
    // eslint-disable-next-line no-floating-promise/no-floating-promise -- no need to wait here
    renderProjectListsMarkdown(config, shouldOpen)
  }
  if (config.outputStyle.match(/rich/i)) {
    await renderProjectListsHTML(config, shouldOpen, scrollPos)
  }
}

/**
 * Toggle a display filter flag and re-render open project list windows.
 * @param {DisplayToggleKey} key
 * @param {boolean} defaultValueWhenUnset
 * @param {string} logContext
 * @param {number} scrollPos
 * @returns {Promise<void>}
 * @private
 */
async function toggleDisplayFilterKey(
  key: DisplayToggleKey,
  defaultValueWhenUnset: boolean,
  logContext: string,
  scrollPos: number = 0,
): Promise<void> {
  const config: ?ReviewConfig = await getReviewSettings()
  if (!config) throw new Error('No config found. Stopping.')

  const savedValue = config[key] ?? defaultValueWhenUnset
  const newValue = !savedValue
  logDebug(logContext, `${key}? now '${String(newValue)}' (was '${String(savedValue)}')`)
  const updatedConfig = { ...config }
  if (key === 'displayFinished') {
    updatedConfig.displayFinished = newValue
  } else if (key === 'displayOnlyDue') {
    updatedConfig.displayOnlyDue = newValue
  } else {
    updatedConfig.displayNextActions = newValue
  }
  await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
  await renderProjectListsIfOpen(updatedConfig, scrollPos)
}

//-----------------------------------------------------------------------------
// Main functions

/** Prevents stacked Rich-list re-renders when many callers refresh during a Dashboard perspective switch. */
let renderProjectListsIfOpenInFlight: boolean = false

/**
 * Decide which of the project list outputs to call (or more than one) based on x-callback args or config.outputStyle.
 * Now includes support for calling from x-callback, using full JSON '{"a":"b", "x":"y"}' version of settings and values that will override ones in the user's settings.
 * @param {string? | null} argsIn as JSON (optional)
 * @param {number?} scrollPos in pixels (optional, for HTML only)
 */
export async function displayProjectLists(argsIn?: string | null = null, scrollPos: number = 0): Promise<void> {
  try {
    let config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const args = argsIn?.toString() || ''
    logDebug(pluginJson, `displayProjectLists: starting with JSON args <${args}> and scrollPos ${String(scrollPos)}`)
    if (args !== '') {
      config = overrideSettingsWithEncodedTypedArgs(config, args)
      // clo(config, 'Review settings updated with args:')
    } else {
      // clo(config, 'Review settings with no args:')
    }

    // Re-calculate the allProjects list (in foreground)
    await generateAllProjectsList(config, true)
    // Call the relevant rendering function with the updated config
    await renderProjectLists(config, true, scrollPos)
  } catch (error) {
    logError('displayProjectLists', JSP(error))
  }
}

/**
 * Regenerate `allProjectsList.json` and re-render the Rich project list when open.
 * Invoked from Dashboard when folder include/exclude filters change (`includedFolders` / `excludedFolders`).
 * @param {number?} scrollPos - Rich list scroll position (pixels)
 * @param {boolean?} skipUpdateDashboardIfOpen - when true, skip Dashboard PROJ* invoke (Dashboard refreshes sections itself)
 * @returns {Promise<any>}
 */
export async function onDashboardFolderFiltersChanged(
  scrollPos: number = 0,
  skipUpdateDashboardIfOpen: boolean = true,
): Promise<any> {
  logInfo(
    'onDashboardFolderFiltersChanged',
    `Dashboard folder filters changed; regenerating allProjectsList (skipUpdateDashboardIfOpen=${String(skipUpdateDashboardIfOpen)})`,
  )
  return generateProjectListsAndRenderIfOpen(scrollPos, skipUpdateDashboardIfOpen)
}

/**
 * Internal version of earlier function that doesn't open window if not already open.
 * @param {number?} scrollPos
 * @param {boolean?} skipUpdateDashboardIfOpen - when true, skip Dashboard PROJ* invoke (Dashboard perspective switch sets this; `PERSPECTIVE_CHANGED` refreshes sections instead).
 */
export async function generateProjectListsAndRenderIfOpen(
  scrollPos: number = 0,
  skipUpdateDashboardIfOpen: boolean = false,
): Promise<any> {
  // Note: Errors are caught and logged below (not rethrown) so NotePlan's invokePluginCommandByName from Dashboard
  // does not surface a rejection in a fragile way; the invoke may still appear successful when work failed - check console logs.
  try {
    let config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    if (config.usePerspectives) {
      invalidateDashboardPluginSettingsCache()
      const reloaded = await getReviewSettings()
      if (reloaded) config = reloaded
      logInfo('generateProjectListsAndRenderIfOpen',  `using perspective '${config.perspectiveName ?? '?'}': foldersToInclude=[${String(config.foldersToInclude)}] foldersToIgnore=[${String(config.foldersToIgnore)}]`)
    }
    logDebug(pluginJson, `generateProjectListsAndRenderIfOpen() starting (with scrollPos ${String(scrollPos)})`)
    const richWindowOpen = isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)
    const htmlWindowSummary = NotePlan.htmlWindows.map((w) => `${w.customId ?? '-'}:${w.isVisible ? 'visible' : 'hidden'}`).join(', ')
    logInfo('generateProjectListsAndRenderIfOpen', `pre-render visibility: ${RICH_PROJECT_LIST_WIN_ID} open=${String(richWindowOpen)}; htmlWindows=[${htmlWindowSummary}]`)

    // Re-calculate the allProjects list (in foreground). Skip Rich invoke from write - render once below (avoids double render per generate).
    await generateAllProjectsList(config, true, scrollPos, skipUpdateDashboardIfOpen, true)
    logDebug('generateProjectListsAndRenderIfOpen', `generatedAllProjectsList() called, and now will call renderProjectListsIfOpen()`)

    // Single in-process Rich/markdown refresh if the list window is already open
    await renderProjectListsIfOpen(config, scrollPos)
    logInfo('generateProjectListsAndRenderIfOpen', `after renderProjectListsIfOpen()`)
    return {} // just to avoid NP silently failing when called by invokePluginCommandByName
  } catch (error) {
    // Deliberately no rethrow: same rationale as the function-level note above.
    logError('generateProjectListsAndRenderIfOpen', JSP(error))
  }
}

/**
 * Render the project list, according to the chosen output style. Note: this does *not* re-calculate the project list.
 * @author @jgclark
 * @param {ReviewConfig?} configIn
 * @param {boolean?} shouldOpen window/note if not already open?
 * @param {number?} scrollPos scroll position to set (pixels) for HTML display (default: 0)
 */
export async function renderProjectLists(
  configIn: ?ReviewConfig = null,
  shouldOpen: boolean = true,
  scrollPos: number = 0
): Promise<void> {
  try {
    const config = (configIn) ? configIn : await getReviewSettings()
    if (config == null) {
      await showMessage('No Projects & Reviews settings found. Stopping. Please try deleting and re-installing the plugin.')
      throw new Error('No config found. Stopping.')
    }

    await runProjectListRenderers(config, shouldOpen, scrollPos)
  } catch (error) {
    logError('renderProjectLists', `Error: ${error.message}.\nconfigIn: ${JSP(configIn, 2)}`)
  }
}

/**
 * Render the project list, according to the chosen output style. This does *not* re-calculate the project list.
 * Note: Called by Dashboard, as well as internally.
 * @param {any} configIn (optional; will look up if not given)
 * @param {number} scrollPos for HTML view (optional; defaults to 0)
 * @author @jgclark
 */
export async function renderProjectListsIfOpen(
  configIn?: any,
  scrollPos?: number = 0
): Promise<boolean> {
  if (renderProjectListsIfOpenInFlight) {
    logDebug('renderProjectListsIfOpen', `skipped: render already in flight`)
    return true
  }
  renderProjectListsIfOpenInFlight = true
  try {
    logDebug(pluginJson, `renderProjectListsIfOpen starting...`)
    const config = configIn ? configIn : await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    await runProjectListRenderers(config, false, scrollPos)

    // Note: return true to avoid possibility of NP silently failing when called by invokePluginCommandByName
    return true
  } catch (error) {
    logError('renderProjectListsIfOpen', error.message)
    return false
  } finally {
    renderProjectListsIfOpenInFlight = false
  }
}

//---------------------------------------------------------------------

/**
 * Generate 'Rich' HTML view of project notes for each tag of interest, using the pre-built full-review-list.
 * Note: Requires NP 3.7.0 (build 844) or greater.
 * Note: Built when we could only display 1 HTML Window at a time, so need to include all tags in a single view.
 * @author @jgclark
 * @param {any} config
 * @param {boolean} shouldOpen window/note if not already open?
 * @param {number?} scrollPos scroll position to set (pixels) for HTML display
 */
export async function renderProjectListsHTML(
  config: any,
  shouldOpen: boolean = true,
  scrollPos: number = 0,
): Promise<void> {
  try {
    if (config.projectTypeTags.length === 0) {
      throw new Error('No projectTypeTags configured to display')
    }

    const richWinId = RICH_PROJECT_LIST_WIN_ID
    if (!shouldOpen && !isHTMLWindowOpen(richWinId)) {
      logDebug('renderProjectListsHTML', `not continuing, as HTML window isn't open and 'shouldOpen' is false.`)
      return
    }

    const funcTimer = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    logInfo(pluginJson, `renderProjectLists ------------------------------------`)
    logDebug('renderProjectListsHTML', `Starting for ${String(config.projectTypeTags)} tags`)

    // Test to see if we have the font resources we want
    const res = await checkForWantedResources(pluginID)
    if (!res) {
      logError(pluginJson, `Sorry, I can't find the file resources I need to continue. Stopping.`)
      await showMessage(`Sorry, I can't find the file resources I need to continue. Please check you have installed the 'Shared Resources' plugin, and then try again.`)
      return
    } else {
      logDebug('renderProjectListsHTML', `${String(res)} required shared resources found`)
    }

    // Ensure projectTypeTags is an array before proceeding
    if (typeof config.projectTypeTags === 'string') config.projectTypeTags = [config.projectTypeTags]

    // Fetch project list first so we can compute per-tag active counts for the Filters dropdown
    const [projectsToReview, countAfterTagFilterOnly] = await filterAndSortProjectsList(config, '', [], true)

    // Omit stale JSON entries whose note no longer exists so the top-bar count matches rendered rows
    const projectsForDisplay: Array<Project> = projectsToReview.filter((p) => {
      const note = DataStore.projectNoteByFilename(p.filename)
      if (!note) {
        logWarn('renderProjectListsHTML', `Can't find note for filename ${p.filename}; omitting from Rich list`)
      }
      return !!note
    })

    const wantedTags = config.projectTypeTags ?? []
    // Counts must match rows in this list (same perspective as the grid); do not strip paused/finished here - those may still be shown.
    const tagActiveCounts = wantedTags.map((tag) =>
      projectsForDisplay.filter((p) => p.allProjectTags != null && p.allProjectTags.includes(tag)).length
    )
    config.tagActiveCounts = tagActiveCounts

    // String array to save all output
    const outputArray = []

    // Generate top bar HTML (uses config.tagActiveCounts for dropdown tag counts)
    config.projectsShownCount = projectsForDisplay.length
    outputArray.push(buildProjectListTopBarHtml(config))

    logTimer('renderProjectListsHTML', funcTimer, `before main loop`)
    const noteCount = projectsForDisplay.length
    if (noteCount > 0) {
      // Start multi-col working (if space)
      outputArray.push(`<div class="multi-cols">`)

      let lastFolder = ''
      for (const thisProject of projectsForDisplay) {
        if (config.displayGroupedByFolder && lastFolder !== thisProject.folder) {
          const folderPart = getGroupedFolderDisplayLabel(thisProject.folder, true, config.hideTopLevelFolder)
          outputArray.push(buildFolderGroupHeaderHtml(folderPart))
        }
        const wantedTagsForRow = (thisProject.allProjectTags != null && wantedTags.length > 0)
          ? thisProject.allProjectTags.filter(t => wantedTags.includes(t))
          : []
        outputArray.push(buildProjectLineForStyle(thisProject, config, 'Rich', wantedTagsForRow))
        lastFolder = thisProject.folder
      }
      outputArray.push('  </div>')
    } else {
      // Help text when the list is empty (setup guidance, or filters hiding all rows)
      const projectsHiddenByDisplayFilters = projectsToReview.length === 0 ? countAfterTagFilterOnly : 0
      outputArray.push(buildEmptyProjectListHelpHtml(config, projectsHiddenByDisplayFilters))
    }
    logTimer('renderProjectListsHTML', funcTimer, `end single section (${noteCount} projects)`)

    // Generate project control dialog HTML
    outputArray.push(buildProjectControlDialogHtml())

    const body = outputArray.join('\n')
    logTimer('renderProjectListsHTML', funcTimer, `end of main loop`)

    const setScrollPosJS: string = `
<script type="text/javascript">
  setScrollPos(${scrollPos});
</script>`

    const headerTags = `${faLinksInHeader}${stylesheetinksInHeader}
  <meta name="startTime" content="${String(Date.now())}">
  <meta name="autoUpdateAfterIdleTime" content="${String(config.autoUpdateAfterIdleTime ?? 0)}">`

    const winOptions = {
      windowTitle: windowTitle,
      customId: richWinId,
      headerTags: headerTags,
      generalCSSIn: generateCSSFromTheme(config.reviewsTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // now in requiredFiles/projectList.css instead
      makeModal: false, // = not modal window
      bodyOptions: '',
      preBodyScript: /* setPercentRingJSFunc + */ scrollPreLoadJSFuncs,
      postBodyScript: checkboxHandlerJSFunc + setScrollPosJS + displayFiltersDropdownScript + tagTogglesVisibilityScript + autoRefreshScript + `<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
      <script type="text/javascript" src="./showTimeAgo.js" ></script>
      <script type="text/javascript" src="./projectListEvents.js"></script>
      <script>window.__reviewsPersistFloatingRect = ${config.preferredWindowType === 'New Window' ? 'true' : 'false'};</script>
      ` + commsBridgeScripts + shortcutsScript + addToggleEvents + resizeListenerScript + windowCloseAndReopenScripts,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 660, // = default width of window (px)
      height: 1200, // = default height of window (px)
      shouldFocus: false, // should not focus, if Window already exists
      // If we should open in main/split view, or the default new window
      showInMainWindow: config.preferredWindowType !== 'New Window',
      splitView: config.preferredWindowType === 'Split View',
      // Set icon details in case we are opening in main/split view
      icon: pluginJson['plugin.icon'],
      iconColor: pluginJson['plugin.iconColor'],
      autoTopPadding: true,
      showReloadButton: true,
      reloadCommandName: 'displayProjectLists',
      reloadPluginID: 'jgclark.Reviews',
    }
    const thisWindow = await showHTMLV2(body, winOptions)
    if (thisWindow) {
      logTimer('renderProjectListsHTML', funcTimer, `end (written results to HTML window and file)`)
    } else {
      logError('renderProjectListsHTML', `- didn't get back a valid HTML Window`)
    }
  } catch (error) {
    logError('renderProjectListsHTML', error.message)
  }
}

/**
 * Generate human-readable lists of project notes in markdown for each tag of interest and write out to note(s) in the config.folderToStore folder.
 * 
 * @author @jgclark
 * @param {any} config - from the main entry function, which can include overrides from passed args
 * @param {boolean} shouldOpen note if not already open?
 */
export async function renderProjectListsMarkdown(config: any, shouldOpen: boolean = true): Promise<void> {
  try {
    if (!shouldOpen) {
      logDebug('renderProjectListsMarkdown', `shouldOpen is false: skipping markdown generation (e.g. renderProjectListsIfOpen)`)
      return
    }
    logDebug('renderProjectListsMarkdown', `Starting for ${String(config.projectTypeTags)} tags`)
    const funcTimer = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone

    // Set up x-callback URLs for various commands
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'start reviews', '')
    const reviewedXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'finish project review', '')
    const nextReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')
    const newIntervalXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'set new review interval', '')
    const addProgressXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'add progress update', '')
    const pauseXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'pause project toggle', '')
    const completeXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'complete project', '')
    const cancelXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'cancel project', '')

    // style the x-callback URLs into markdown 'button' links
    const reviewedXCallbackButton = `[Finish](${reviewedXCallbackURL})`
    const nextReviewXCallbackButton = `[Finish+Next](${nextReviewXCallbackURL})`
    const newIntervalXCallbackButton = `[New Review Interval](${newIntervalXCallbackURL})`
    const addProgressXCallbackButton = `[Add progress](${addProgressXCallbackURL})`
    const pauseXCallbackButton = `[toggle Pause](${pauseXCallbackURL})`
    const completeXCallbackButton = `[Complete](${completeXCallbackURL})`
    const cancelXCallbackButton = `[Cancel](${cancelXCallbackURL})`
    const nowDateTime = nowLocaleShortDateTime()
    const perspectivePart = (config.usePerspectives) ? ` from _${config.perspectiveName}_ Perspective` : ''

    if (config.projectTypeTags.length > 0) {
      if (typeof config.projectTypeTags === 'string') config.projectTypeTags = [config.projectTypeTags]
      // We have defined tag(s) to filter and group by
      for (const tag of config.projectTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const noteTitle = `${tag} Review List`
        const noteTitleWithoutHash = `${tagWithoutHash} Review List`

        // Do the main work
        const note: ?TNote = await getOrMakeRegularNoteInFolder(noteTitleWithoutHash, config.folderToStore)
        if (note != null) {
          const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'project lists', encodeURIComponent(`{"projectTypeTags":["${tag}"]}`))

          // Get the summary line for each relevant project
          const [outputArray, noteCount, due] = await generateReviewOutputLines(tag, 'Markdown', config)
          logTimer('renderProjectListsMarkdown', funcTimer, `after generateReviewOutputLines(${tag}) for ${String(due)} projects`)
          if (isNaN(noteCount)) logWarn('renderProjectListsMarkdown', `Warning: noteCount is NaN`)

          // print header info just the once (if any notes)
          const startReviewButton = `[Start reviewing ${due} ready for review](${startReviewXCallbackURL})`
          const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

          if (!config.displayGroupedByFolder) outputArray.unshift(`### All folders (${noteCount} notes)`)

          if (due > 0) {
            outputArray.unshift(`**${startReviewButton}**. For open Project note: Review: ${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${newIntervalXCallbackButton} Project: ${addProgressXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
          }
        const displayFinished = config.displayFinished ?? false
        const displayOnlyDue = config.displayOnlyDue ?? false
        const displayPaused = config.displayPaused ?? true
        let togglesValues = (displayOnlyDue) ? 'showing only projects/areas ready for review' : 'showing all open projects/areas'
        togglesValues += (displayFinished) ? ' plus finished ones' : ''
        togglesValues += (!displayPaused) ? ' (paused projects hidden)' : ''
          // Write out the count + metadata
          outputArray.unshift(`Total ${noteCount} active projects${perspectivePart} (${togglesValues}). Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
          outputArray.unshift(`# ${noteTitle}`)

          // Save the list(s) to this note
          note.content = outputArray.join('\n')
          logDebug('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
          // Open the note in a window
          if (shouldOpen && !isNoteOpenInEditor(note.filename)) {
            logDebug('renderProjectListsMarkdown', `- opening note '${noteTitle}' as the note is not already open.`)
            await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
            setEditorWindowId(note.filename, customMarkdownWinId)
          }
        } else {
          await showMessage('Oops: failed to find or make project summary note', 'OK')
          logError('renderProjectListsMarkdown', "Shouldn't get here -- no valid note to write to!")
          return
        }
      }
    } else {
      // We will just use all notes with a @review() string, in one go
      const noteTitle = `Review List`
      const note: ?TNote = await getOrMakeRegularNoteInFolder(noteTitle, config.folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const [outputArray, noteCount, due] = await generateReviewOutputLines('', 'Markdown', config)
        const startReviewButton = `[Start reviewing ${due} ready for review](${startReviewXCallbackURL})`
        logTimer('renderProjectListsMarkdown', funcTimer, `after generateReviewOutputLines`)

        const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'project lists', '') //`noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=`
        const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`### All folders (${noteCount} notes)`)
        }
        if (due > 0) {
          outputArray.unshift(`**${startReviewButton}** ${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
        }
        outputArray.unshift(`Total ${noteCount} active projects${perspectivePart}. Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
        // Focus the note in an existing split view, or open the note in a new split window (if not already open)
        const possibleThisEditor = getOrOpenEditorFromFilename(note.filename, 'split')
        if (!possibleThisEditor) {
          logWarn('renderProjectListsMarkdown', `- failed to open note '${noteTitle}' in an Editor`)
        }
      } else {
        await showMessage('Oops: failed to find or make project summary note', 'OK')
        logError('renderProjectListsMarkdown', "Shouldn't get here -- no valid note to write to!")
        return
      }
    }
    logTimer('renderProjectListsMarkdown', funcTimer, `end`)
  } catch (error) {
    logError('renderProjectListsMarkdown', error.message)
  }
}

/**
 * Re-display the project list from saved HTML file, if available.
 * Note: this is a test function that does not re-calculate the data.
 * @author @jgclark
 */
export async function redisplayProjectListHTML(): Promise<void> {
  try {
    // Re-load the saved HTML if it's available.
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Try loading HTML saved copy
    const savedHTML = DataStore.loadData(filenameHTMLCopy, true) ?? ''
    if (savedHTML !== '') {
      const winOptions = {
        windowTitle: windowTitle,
        headerTags: '',
        generalCSSIn: '',
        specificCSS: '',
        makeModal: false,
        bodyOptions: '',
        preBodyScript: '',
        postBodyScript: '',
        savedFilename: '',
        reuseUsersWindowRect: true,
        width: 800,
        height: 1200,
        customId: RICH_PROJECT_LIST_WIN_ID,
        shouldFocus: true,
      }
      const _thisWindow = await showHTMLV2(savedHTML, winOptions)
      // clo(_thisWindow, 'created window')
      logDebug('redisplayProjectListHTML', `Displayed HTML from saved file ${filenameHTMLCopy}`)
      return
    } else {
      logWarn('redisplayProjectListHTML', `Couldn't read from saved HTML file ${filenameHTMLCopy}.`)
      await showMessage('Sorry, I can\'t find the saved HTML file for Project Lists.')
    }
  } catch (error) {
    logError('redisplayProjectListHTML', error.message)
  }
}

//-------------------------------------------------------------------------------

/**
 * Return summary of notes that contain a specified 'projectTag', for all wanted folders, and suitably filtered, in 'Markdown' or 'Rich' style.
 * Reads from the already generated allProjects JSON file.
 * @author @jgclark
 *
 * @param {string} projectTag - the current hashtag of interest
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {ReviewConfig} config - from settings (and any passed args)
 * @returns {[Array<string>, number, number]} [output summary lines, number of lines emitted (excludes missing notes), number of due notes (ready to review)]
 */
export async function generateReviewOutputLines(projectTag: string, style: string, config: ReviewConfig): Promise<[Array<string>, number, number]> {
  try {
    const startTime = new Date()
    logDebug('generateReviewOutputLines', `Starting for tag(s) '${projectTag}' in ${style} style`)

    // Get all wanted projects (in useful order and filtered)
    const [projectsToReview, countAfterTagFilterOnly] = await filterAndSortProjectsList(config, projectTag)
    let lastFolder = ''
    let noteCount = 0
    let due = 0
    const outputArray: Array<string> = []

    // Process each project
    for (const thisProject of projectsToReview) {
      const thisNote = DataStore.projectNoteByFilename(thisProject.filename)
      if (!thisNote) {
        logWarn('generateReviewOutputLines', `Can't find note for filename ${thisProject.filename}`)
        continue
      }
      // Make the output line for this project
      const out = buildProjectLineForStyle(thisProject, config, style)

      // Add to number of notes to review (if appropriate)
      if (!thisProject.isPaused && thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays) && thisProject.nextReviewDays <= 0) {
        due += 1
      }

      // Write new folder header (if change of folder)
      const folder = thisProject.folder
      if (config.displayGroupedByFolder && lastFolder !== folder) {
        const isRichStyle = style.match(/rich/i) != null
        const folderPart = getGroupedFolderDisplayLabel(folder, isRichStyle, config.hideTopLevelFolder)
        if (style.match(/rich/i)) {
          outputArray.push(buildFolderGroupHeaderHtml(folderPart))
        } else if (style.match(/markdown/i)) {
          outputArray.push(`### ${folderPart}`)
        }
      }

      outputArray.push(out)
      noteCount++

      lastFolder = folder
    }
    logTimer(
      'generateReviewOutputLines',
      startTime,
      `Generated ${String(noteCount)} lines for tag(s) '${projectTag}' in ${style} style (${String(countAfterTagFilterOnly)} after tag filter, before missing-note skips)`,
    )
    return [outputArray, noteCount, due]
  } catch (error) {
    logError('generateReviewOutputLines', `${error.message}`)
    return [[], NaN, NaN] // for completeness
  }
}
//-------------------------------------------------------------------------------

/** 
 * Toggle displayFinished setting, held as a setting in the `settings.json` file.
*/
export async function toggleDisplayFinished(scrollPos: number = 0): Promise<void> {
  try {
    // v1 used NP Preference mechanism, but not ideal as it can't be used from frontend
    // v2 directly update settings.json instead
    await toggleDisplayFilterKey('displayFinished', true, 'toggleDisplayFinished', scrollPos)
  }
  catch (error) {
    logError('toggleDisplayFinished', error.message)
  }
}

/** 
 * Toggle displayOnlyDue setting, held as a setting in the `settings.json` file.
*/
export async function toggleDisplayOnlyDue(scrollPos: number = 0): Promise<void> {
  try {
    // v1 used NP Preference mechanism, but not ideal as it can't be used from frontend
    // v2 directly update settings.json instead
    await toggleDisplayFilterKey('displayOnlyDue', true, 'toggleDisplayOnlyDue', scrollPos)
  }
  catch (error) {
    logError('toggleDisplayOnlyDue', error.message)
  }
}

/** 
 * Toggle displayNextActions setting, held as a setting in the `settings.json` file.
*/
export async function toggleDisplayNextActions(scrollPos: number = 0): Promise<void> {
  try {
    // v2 directly update settings.json
    await toggleDisplayFilterKey('displayNextActions', false, 'toggleDisplayNextActions', scrollPos)
  }
  catch (error) {
    logError('toggleDisplayNextActions', error.message)
  }
}

/**
 * Save all display filter settings at once (used by Display filters dropdown).
 * @param {{ displayOnlyDue: boolean, displayFinished: boolean, displayPaused: boolean, displayNextActions: boolean, displayOrder?: string, hiddenProjectTypeTags?: Array<string> }} data
 */
export async function saveDisplayFilters(data: {
  displayOnlyDue: boolean,
  displayFinished: boolean,
  displayPaused: boolean,
  displayNextActions: boolean,
  displayOrder?: string,
  hiddenProjectTypeTags?: Array<string>,
}, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    config.displayOnlyDue = data.displayOnlyDue
    config.displayFinished = data.displayFinished
    config.displayPaused = data.displayPaused
    config.displayNextActions = data.displayNextActions
    if (typeof data.displayOrder === 'string' && data.displayOrder !== '') {
      config.displayOrder = data.displayOrder
    }
    if (Array.isArray(data.hiddenProjectTypeTags)) {
      config.hiddenProjectTypeTags = data.hiddenProjectTypeTags
    }
    await DataStore.saveJSON(config, '../jgclark.Reviews/settings.json', true)
    await renderProjectListsIfOpen(config, scrollPos)
  } catch (error) {
    logError('saveDisplayFilters', error.message)
  }
}

/**
 * Persist which project-type hashtags are toggled off in Filter + Order, without re-rendering.
 * Used when the user toggles a tag while the dropdown is open (visibility is already applied client-side).
 * @param {Array<string>} hiddenProjectTypeTags
 * @returns {Promise<void>}
 */
export async function saveHiddenProjectTypeTags(hiddenProjectTypeTags: Array<string>): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    config.hiddenProjectTypeTags = Array.isArray(hiddenProjectTypeTags) ? hiddenProjectTypeTags : []
    logDebug('saveHiddenProjectTypeTags', `saving hiddenProjectTypeTags=[${String(config.hiddenProjectTypeTags)}]`)
    await DataStore.saveJSON(config, '../jgclark.Reviews/settings.json', true)
  } catch (error) {
    logError('saveHiddenProjectTypeTags', error.message)
  }
}
