/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
//
// The major part is creating HTML view for the review list.
// This doesn't require any comms back to the plugin through bridges;
// all such activity happens via x-callback calls for simplicity.
///
// It draws its data from an intermediate 'full review list' CSV file, which is (re)computed as necessary.
//
// by @jgclark
// Last updated 2026-05-02 for v2.0.0.b29, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { checkForWantedResources, logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import {
  clearNextReviewFrontmatterField,
  deleteMetadataMentionInEditor,
  deleteMetadataMentionInNote,
  getProjectMetadataLineIndex,
  getNextActionLineIndex,
  getReviewSettings,
  isProjectNoteIsMarkedSequential,
  migrateProjectMetadataLineInEditor,
  migrateProjectMetadataLineInNote,
  type ReviewConfig,
  updateBodyMetadataInEditor,
  updateBodyMetadataInNote,
} from './reviewHelpers'
import {
  copyDemoDefaultToAllProjectsList,
  filterAndSortProjectsList,
  getNextNoteToReview,
  getSpecificProjectFromList,
  generateAllProjectsList,
  updateProjectInAllProjectsList,
} from './allProjectsListHelpers.js'
import { clearNextReviewMetadataFields, Project } from './projectClass'
import { calcReviewFieldsForProject } from './projectClassCalculations.js'
import {
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
  // setPercentRingJSFunc,
  addToggleEvents,
  displayFiltersDropdownScript,
  tagTogglesVisibilityScript,
  windowCloseAndReopenScripts,
} from './projectsHTMLTemplates.js'
import { checkString } from '@helpers/checkType'
import { getTodaysDateHyphenated, RE_DATE, RE_DATE_INTERVAL, todaysDateISOString } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import { getFolderDisplayName, getFolderDisplayNameForHTML } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { showHTMLV2, sendToHTMLWindow } from '@helpers/HTMLView'
import { numberOfOpenItemsInNote } from '@helpers/note'
import { saveSettings } from '@helpers/NPConfiguration'
import { calcOffsetDateStr, nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { getFirstRegularNoteAmongOpenEditors, getOrOpenEditorFromFilename, getOpenEditorFromFilename, isNoteOpenInEditor, saveEditorIfNecessary } from '@helpers/NPEditor'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import {
  isHTMLWindowOpen, logWindowsList,
  openNoteInSplitViewIfNotOpenAlready,
  setEditorWindowId
} from '@helpers/NPWindows'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Constants

const pluginID = 'jgclark.Reviews'
const windowTitle = `Projects List`
const windowTitleDemo = 'Projects List (Demo)'
const filenameHTMLCopy = 'projects_list.html'
const customRichWinId = `${pluginID}.rich-review-list`
const customRichWinIdDemo = `${pluginID}.rich-review-list-demo`
const customMarkdownWinId = `markdown-review-list`

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Tell the Project List HTML window which project is currently being reviewed (if the window is open).
 * Adds or removes the 'reviewing' class on the matching projectRow.
 * TODO: this is OK on 'start review' but not on 'next review'. Is it the wrong windowID?
 * @param {CoreNoteFields | TNote | any} note - note being reviewed
 */
async function setReviewingProjectInHTML(note: any): Promise<void> {
  try {
    logDebug('setReviewingProjectInHTML', `Setting 'reviewing' state for note '${displayTitle(note)}' for window ${customRichWinId}`)
    if (!note || note.type !== 'Notes') {
      return
    }
    if (!isHTMLWindowOpen(customRichWinId)) {
      return
    }
    const encodedFilename = encodeRFC3986URIComponent(note.filename)
    await sendToHTMLWindow(customRichWinId, 'SET_REVIEWING_PROJECT', { encodedFilename })
  } catch (error) {
    logError('setReviewingProjectInHTML', error.message)
  }
}

/**
 * Clear the 'reviewing' state from all project rows in the Project List HTML window.
 * @author @jgclark 
 */
async function clearProjectReviewingInHTML(): Promise<void> {
  try {
    if (!isHTMLWindowOpen(customRichWinId)) {
      return
    }
    await sendToHTMLWindow(customRichWinId, 'CLEAR_REVIEWING_PROJECT')
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

type DisplayToggleKey = 'displayFinished' | 'displayOnlyDue' | 'displayNextActions'

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
  const updatedConfig = { ...config, [key]: newValue }
  await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
  await renderProjectListsIfOpen(updatedConfig, scrollPos)
}

//-----------------------------------------------------------------------------
// Main functions

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

    if (!(config.useDemoData ?? false)) {
      // Re-calculate the allProjects list (in foreground)
      await generateAllProjectsList(config, true)
    }
    // Call the relevant rendering function with the updated config
    await renderProjectLists(config, true, scrollPos)
  } catch (error) {
    logError('displayProjectLists', JSP(error))
  }
}

/**
 * Demo variant of project lists.
 * Reads from fixed demo JSON (copied into allProjectsList.json) without regenerating from live notes.
 * @param {string? | null} argsIn as JSON (optional)
 * @param {number?} scrollPos in pixels (optional, for HTML only)
 */
export async function toggleDemoModeForProjectLists(): Promise<void> {
  try {
    const config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    const isCurrentlyDemoMode = config.useDemoData ?? false
    logInfo('toggleDemoModeForProjectLists', `Demo mode is currently ${isCurrentlyDemoMode ? 'ON' : 'off'}.`)
    const willBeDemoMode = !isCurrentlyDemoMode
    // Save a plain object so the value persists (loaded config may be frozen or a proxy)
    const toSave = { ...config, useDemoData: willBeDemoMode }
    const saved = await saveSettings(pluginJson['plugin.id'], toSave, false)
    if (!saved) throw new Error('Failed to save demo mode setting.')

    if (willBeDemoMode) {
      // Copy the fixed demo list into allProjectsList.json (first time after switching to demo)
      const copied = await copyDemoDefaultToAllProjectsList()
      if (!copied) {
        throw new Error('Failed to copy demo list. Please check that allProjectsDemoListDefault.json exists in data/jgclark.Reviews, and try again.')
      }
      logInfo('toggleDemoModeForProjectLists', 'Demo mode is now ON; project list copied from demo default.')
    } else {
      // First time after switching away from demo: re-generate list from live notes
      logInfo('toggleDemoModeForProjectLists', 'Demo mode now off; regenerating project list from notes.')
      await generateAllProjectsList(toSave, true)
    }

    // Now run the project lists display
    await renderProjectLists(toSave, true)
  } catch (error) {
    logError('toggleDemoModeForProjectLists', JSP(error))
  }
}

/**
 * Internal version of earlier function that doesn't open window if not already open.
 * @param {number?} scrollPos 
 */
export async function generateProjectListsAndRenderIfOpen(scrollPos: number = 0): Promise<any> {
  try {
    const config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    logDebug(pluginJson, `generateProjectListsAndRenderIfOpen() starting with scrollPos ${String(scrollPos)}`)

    if (config.useDemoData ?? false) {
      const copied = await copyDemoDefaultToAllProjectsList()
      if (!copied) {
        logWarn('generateProjectListsAndRenderIfOpen', 'Demo mode on but copy of demo list failed.')
      }
    } else {
      // Re-calculate the allProjects list (in foreground)
      await generateAllProjectsList(config, true)
      logDebug('generateProjectListsAndRenderIfOpen', `generatedAllProjectsList() called, and now will call renderProjectListsIfOpen()`)
    }

    // Call the relevant rendering function, but only continue if relevant window is open
    await renderProjectListsIfOpen(config, scrollPos)
    return {} // just to avoid NP silently failing when called by invokePluginCommandByName
  } catch (error) {
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
  try {
    logDebug(pluginJson, `renderProjectListsIfOpen starting...`)
    const config = configIn ? configIn : await getReviewSettings()

    if (!config) throw new Error('No config found. Stopping.')
    await runProjectListRenderers(config, false, scrollPos)
    // return true to avoid possibility of NP silently failing when called by invokePluginCommandByName
    return true
  } catch (error) {
    logError('renderProjectListsIfOpen', error.message)
    return false
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
    const useDemoData = config.useDemoData ?? false
    if (config.projectTypeTags.length === 0) {
      throw new Error('No projectTypeTags configured to display')
    }

    const richWinId = useDemoData ? customRichWinIdDemo : customRichWinId
    if (!shouldOpen && !isHTMLWindowOpen(richWinId)) {
      logDebug('renderProjectListsHTML', `not continuing, as HTML window isn't open and 'shouldOpen' is false.`)
      return
    }

    const funcTimer = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    logInfo(pluginJson, `renderProjectLists ------------------------------------`)
    logDebug('renderProjectListsHTML', `Starting for ${String(config.projectTypeTags)} tags${useDemoData ? ' (demo)' : ''}`)

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
    const [projectsToReview, _numberProjectsUnfiltered] = await filterAndSortProjectsList(config, '', [], true, useDemoData)
    const wantedTags = config.projectTypeTags ?? []
    const tagActiveCounts = wantedTags.map((tag) =>
      projectsToReview.filter(
        (p) =>
          !p.isPaused &&
          !p.isCancelled &&
          !p.isCompleted &&
          p.allProjectTags != null &&
          p.allProjectTags.includes(tag)
      ).length
    )
    config.tagActiveCounts = tagActiveCounts

    // String array to save all output
    const outputArray = []

    // Generate top bar HTML (uses config.tagActiveCounts for dropdown tag counts)
    config.projectsShownCount = projectsToReview.length
    outputArray.push(buildProjectListTopBarHtml(config))

    logTimer('renderProjectListsHTML', funcTimer, `before main loop`)
    const noteCount = projectsToReview.length
    if (useDemoData && noteCount === 0) {
      outputArray.push('<p class="project-grid-row demo-file-message">Demo file (allProjectsDemoList.json) not found or empty.</p>')
    }
    if (noteCount > 0) {
      // Start multi-col working (if space)
      outputArray.push(`<div class="multi-cols">`)

      let lastFolder = ''
      for (const thisProject of projectsToReview) {
        if (!useDemoData) {
          const thisNote = DataStore.projectNoteByFilename(thisProject.filename)
          if (!thisNote) {
            logWarn('renderProjectListsHTML', `Can't find note for filename ${thisProject.filename}`)
            continue
          }
        }
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
    }
    logTimer('renderProjectListsHTML', funcTimer, `end single section (${noteCount} projects)`)

    // Generate project control dialog HTML
    outputArray.push(buildProjectControlDialogHtml())

    const body = outputArray.join('\n')
    logTimer('renderProjectListsHTML', funcTimer, `end of main loop`)

    const setScrollPosJS: string = `
<script type="text/javascript">
  console.log('Reviews render refresh: applying scrollPos = ${scrollPos}');
  setScrollPos(${scrollPos});
  console.log('Reviews render refresh: post-set current scrollPos = ' + String((typeof window.pageYOffset !== 'undefined')
    ? window.pageYOffset
    : (document.documentElement && typeof document.documentElement.scrollTop !== 'undefined')
      ? document.documentElement.scrollTop
      : (document.body && typeof document.body.scrollTop !== 'undefined')
        ? document.body.scrollTop
        : 0));
</script>`

    const headerTags = `${faLinksInHeader}${stylesheetinksInHeader}
  <meta name="startTime" content="${String(Date.now())}">
  <meta name="autoUpdateAfterIdleTime" content="${String(config.autoUpdateAfterIdleTime ?? 0)}">`

    const winOptions = {
      windowTitle: useDemoData ? windowTitleDemo : windowTitle,
      customId: richWinId,
      headerTags: headerTags,
      generalCSSIn: generateCSSFromTheme(config.reviewsTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // now in requiredFiles/projectList.css instead
      makeModal: false, // = not modal window
      bodyOptions: 'onload="showTimeAgo()"',
      preBodyScript: /* setPercentRingJSFunc + */ scrollPreLoadJSFuncs,
      postBodyScript: checkboxHandlerJSFunc + setScrollPosJS + displayFiltersDropdownScript + tagTogglesVisibilityScript + autoRefreshScript + `<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
      <script type="text/javascript" src="./showTimeAgo.js" ></script>
      <script type="text/javascript" src="./projectListEvents.js"></script>
      ` + commsBridgeScripts + shortcutsScript + addToggleEvents + windowCloseAndReopenScripts, // + collapseSection +  resizeListenerScript + unloadListenerScript,
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
      reloadCommandName: useDemoData ? 'displayProjectListsDemo' : 'displayProjectLists',
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
 * Generate human-readable lists of project notes in markdown for each tag of interest
 * and write out to note(s) in the config.folderToStore folder.
 * @author @jgclark
 * @param {any} config - from the main entry function, which can include overrides from passed args
 * @param {boolean} shouldOpen note if not already open?
 */
export async function renderProjectListsMarkdown(config: any, shouldOpen: boolean = true): Promise<void> {
  try {
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
    const nextReviewXCallbackButton = `[Finish + Next](${nextReviewXCallbackURL})`
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
    // $FlowIgnore[incompatible-type]
    const config: ReviewConfig = await getReviewSettings()
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
        customId: customRichWinId,
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
 * @returns {[Array<string>, number, number]} [output summary lines, number of notes, number of due notes (ready to review)]
 */
export async function generateReviewOutputLines(projectTag: string, style: string, config: ReviewConfig): Promise<[Array<string>, number, number]> {
  try {
    const startTime = new Date()
    logDebug('generateReviewOutputLines', `Starting for tag(s) '${projectTag}' in ${style} style`)

    // Get all wanted projects (in useful order and filtered)
    const [projectsToReview, numberProjectsUnfiltered] = await filterAndSortProjectsList(config, projectTag)
    let lastFolder = ''
    let noteCount = 0
    let due = 0
    const outputArray: Array<string> = []

    // TODO: @Cursor noticed this:
    // "Callers destructure it as noteCount (e.g. renderProjectListsMarkdown around 504, 548), but the value is numberProjectsUnfiltered from filterAndSortProjectsList, not the per-loop noteCount (lines 647–710). Headers like “Total X active projects” can disagree with the number of lines actually listed if those differ. Worth aligning the JSDoc, return value, and UI strings with either unfiltered total or rows emitted."
    // This is true, but not dealing with this at the moment.

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
    logTimer('generateReviewOutputLines', startTime, `Generated for ${String(noteCount)} notes (and ${numberProjectsUnfiltered} unfiltered) for tag(s) '${projectTag}' in ${style} style`)
    return [outputArray, numberProjectsUnfiltered, due]
  } catch (error) {
    logError('generateReviewOutputLines', `${error.message}`)
    return [[], NaN, NaN] // for completeness
  }
}

//-------------------------------------------------------------------------------

/**
 * Finish a project review -- private core logic used by 2 functions.
 * @param (CoreNoteFields) note - The note to finish
 */
async function finishReviewCoreLogic(note: CoreNoteFields, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`

    // If we're interested in Next Actions, and there are open items in the note, check to see if one is now set.
    // But if the note is marked as sequential, then no need to check.
    const numOpenItems = numberOfOpenItemsInNote(note)
    // $FlowIgnore[prop-missing]
    const isSequential = config.sequentialTag && isProjectNoteIsMarkedSequential(note, config.sequentialTag)
    const runNextActionCheck = !isSequential && config.nextActionTags.length > 0 && numOpenItems > 0
    const nextActionTagLineIndexes: Array<number> = []
    if (runNextActionCheck) {
      for (const naTag of config.nextActionTags) {
        logDebug('finishReviewCoreLogic', `Checking for Next Action tag '${naTag}' in '${displayTitle(note)}' ... with ${numOpenItems} open items`)
        const nextActionLineIndex = getNextActionLineIndex(note, naTag)
        logDebug('finishReviewCoreLogic', `- nextActionLineIndex= '${String(nextActionLineIndex)}'`)

        if (!isNaN(nextActionLineIndex)) {
          nextActionTagLineIndexes.push(nextActionLineIndex)
        }
      }
    }

    // For sequential projects, just make a log note if there are no open tasks
    if (isSequential && numOpenItems === 0) {
      logDebug('finishReviewCoreLogic', `Note: no open tasks found for sequential project '${displayTitle(note)}'.`)
    }

    const possibleThisEditor = getOpenEditorFromFilename(note.filename)
    if (possibleThisEditor && possibleThisEditor !== false) {
      const thisEditorNote: ?CoreNoteFields = possibleThisEditor.note
      if (!thisEditorNote) {
        logDebug('finishReviewCoreLogic', `No editor note found for '${displayTitle(note)}'; falling back to datastore note update path.`)
        migrateProjectMetadataLineInNote(note)
        const metadataLineIndex = getProjectMetadataLineIndex(note)
        if (metadataLineIndex === false) {
          logDebug('finishReviewCoreLogic', `No project metadata line found (body or frontmatter) for '${displayTitle(note)}'`)
        } else {
          deleteMetadataMentionInNote(note, metadataLineIndex, [config.nextReviewMentionStr])
        }
        clearNextReviewFrontmatterField(note)
        updateBodyMetadataInNote(note, [reviewedTodayString])
        // $FlowIgnore[prop-missing]
        DataStore.updateCache(note, true)
        return
      }
      logDebug('finishReviewCoreLogic', `Updating EDITOR note '${displayTitle(thisEditorNote)}' ...`)
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then clean up @nextReview/@reviewed mentions once.
      // FIXME: The following 3 calls get "Warning: The editor is not open! 'Editor' values will be undefined and functions not working. Open a note to fix this." errors
      migrateProjectMetadataLineInEditor(possibleThisEditor)
      const metadataLineIndex = getProjectMetadataLineIndex(possibleThisEditor)
      if (metadataLineIndex === false) {
        logDebug('finishReviewCoreLogic', `No project metadata line found (body or frontmatter) for '${displayTitle(thisEditorNote)}'`)
      } else {
        // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
        deleteMetadataMentionInEditor(possibleThisEditor, metadataLineIndex, [config.nextReviewMentionStr])
      }
      clearNextReviewFrontmatterField(possibleThisEditor)
      // Update @review(date) on current open note
      updateBodyMetadataInEditor(possibleThisEditor, [reviewedTodayString])
      await possibleThisEditor.save()
      // Note: no longer seem to need to update cache
    } else {
      logDebug('finishReviewCoreLogic', `Updating note '${displayTitle(note)}' ...`)
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then clean up @nextReview/@reviewed mentions once.
      migrateProjectMetadataLineInNote(note)
      const metadataLineIndex = getProjectMetadataLineIndex(note)
      if (metadataLineIndex === false) {
        logDebug('finishReviewCoreLogic', `No project metadata line found (body or frontmatter) for '${displayTitle(note)}'`)
      } else {
        // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
        deleteMetadataMentionInNote(note, metadataLineIndex, [config.nextReviewMentionStr])
      }
      clearNextReviewFrontmatterField(note)
      // Update @review(date) on the note
      updateBodyMetadataInNote(note, [reviewedTodayString])
      // $FlowIgnore[prop-missing]
      DataStore.updateCache(note, true)
    }

    // Then update the Project instance
    logDebug('finishReviewCoreLogic', `- updating Project instance`)
    // v1:
    // const thisNoteAsProject = new Project(noteToUse)
    // v2: Try to find this project in allProjects, and update that as well
    let thisNoteAsProject: ?Project = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.reviewedDate = moment().format('YYYY-MM-DD') // ISO date string (local timezone)
      // Clear nextReviewDateStr so it recalculates from the new reviewedDate and reviewInterval
      thisNoteAsProject.nextReviewDateStr = null
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      const nextReviewDays = thisNoteAsProject.nextReviewDays
      if (nextReviewDays < 0) {
        logWarn('finishReviewCoreLogic', `- project.nextReviewDays is still negative (${String(nextReviewDays)}). This should not happen.`)
      } else {
        logDebug('finishReviewCoreLogic', `- PI now shows next review due in ${String(thisNoteAsProject.nextReviewDays)} days (${String(thisNoteAsProject.nextReviewDateStr)})`)
      }

      // Clear next-review fields on the project list entry TEST:
      clearNextReviewMetadataFields(thisNoteAsProject)

      // Save changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (if window is already open)
      await renderProjectListsIfOpen(config, scrollPos)
    } else {
      // Regenerate whole list (and display if window is already open)
      logInfo('finishReviewCoreLogic', `- In allProjects list couldn't find project '${note.filename}'. So regenerating whole list and will display if list is open.`)
      // TODO: Split the following into just generate...(), and then move the renderProjectListsIfOpen() above to serve both if/else clauses
      await generateProjectListsAndRenderIfOpen(scrollPos)
    }

    // Ensure the Project List window (if open) no longer shows this project as being actively reviewed
    await clearProjectReviewingInHTML()

    logDebug('finishReviewCoreLogic', `- done`)
  }
  catch (error) {
    logError('finishReviewCoreLogic', error.message)
  }
}

// --------------------------------------------------------------------

/**
 * Core of the logic for starting a project review: optionally confirm with user, open note in Editor, highlight as active review in Project List HTML.
 * @param {TNote} noteToReview
 * @param {ReviewConfig} config
 * @param {boolean} offerConfirm - If true and config.confirmNextReview, prompt before opening (startReviews / finish-and-next). If false, open immediately (startReviewForNote).
 * @param {string} logContext - Log tag (e.g. startReviews, startReviewForNote, finishReviewAndStartNextReview)
 * @returns {Promise<boolean>} true if the note was opened, false if user cancelled confirmation
 * @private
 */
async function startReviewCoreLogic(
  noteToReview: TNote,
  config: ReviewConfig,
  offerConfirm: boolean,
  logContext: string,
): Promise<boolean> {
  if (offerConfirm && config.confirmNextReview) {
    const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
    if (res !== 'OK') {
      logDebug(logContext, `- User didn't want to continue.`)
      return false
    }
  }

  // Show that this project is now being reviewed, if the 'Rich' Project List is open
  logInfo(logContext, `🔍 Opening '${displayTitle(noteToReview)}' note to review ...`)
  await setReviewingProjectInHTML(noteToReview)

  // Check if note is already open in one of the Editor windows:
  // - If so, just focus it.
  // - Otherwise open it in the Editor (if running from 'New Window' or 'Split View' mode), or a new split view if not.
  // V1
  // const possibleEditor: TEditor | false = findEditorWindowByFilename(noteToReview.filename)
  // etc.
  // V2
  if (config.preferredWindowType === 'Main Window') {
    // Open in split view
    const res = openNoteInSplitViewIfNotOpenAlready(noteToReview.filename)
    if (res) {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was opened in a new split view.`)
    } else {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was already open in an Editor window. Focusing it.`)
    }
  } else {
    // Open in main Editor window
    const openedNote = await Editor.openNoteByFilename(noteToReview.filename)
    if (openedNote) {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was opened in the main Editor.`)
    } else {
      logWarn(logContext, `- Note '${displayTitle(noteToReview)}' couldn't be opened in the main Editor window.`)
    }
  }
  return true
}

/**
 * Start a series of project reviews..
 * Then offers to load the first note to review, based on allProjectsList, ordered by most overdue for review.
 * Note: Used by Project List dialog, and Dashboard.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Get the next note to review, based on allProjectsList, ordered by most overdue for review.
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
      return
    } else {
      await startReviewCoreLogic(noteToReview, config, true, 'startReviews')
    }
  } catch (error) {
    logError('startReviews', error.message)
  }
}

/**
 * Start a single project review.
 * Note: Used by Project List dialog (and Dashboard in future?). So bypasses startReviewCoreLogic() but should remain very similar.
 * @param {TNote} noteToReview - the note to start reviewing
 * @author @jgclark
 */
export async function startReviewForNote(noteToReview: TNote): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    logInfo('startReviewForNote', `🔍 Opening '${displayTitle(noteToReview)}' note to review ...`)
    await Editor.openNoteByFilename(noteToReview.filename)
    // Highlight this project in the Project List window (if open)
    await setReviewingProjectInHTML(noteToReview)
  
  } catch (error) {
    logError('startReviewForNote', error.message)
  }
}

/**
 * Start new review. 
 * Note: Just calls startReviews(), as there's nothing different between the two operations any more. But leaving the distinction in case this changes in future.
 * Note: Used by Project List dialog, ?and Dashboard?.
 * @author @jgclark
 */
export async function nextReview(): Promise<void> {
  try {
    logDebug('nextReview', `Simply calling startReviews() ...`)
    await startReviews()
  } catch (error) {
    logError('nextReview', error.message)
  }
}

/**
 * Complete the current review on the current Editor note
 * @author @jgclark
 */
export async function finishReview(): Promise<void> {
  try {
    // Prefer focused Editor when it is a project note; otherwise any open split with a regular note (calendar may have focus).
    const currentNote = getFirstRegularNoteAmongOpenEditors()
    if (!currentNote) {
      logWarn('finishReview', `- There's no project note in any open Editor pane to finish reviewing.`)
      await showMessage(`No open editor pane has a project note to finish reviewing. Open the project note (or focus it) and try again.`, 'OK, thanks', 'Reviews')
      return
    }
    logInfo('finishReview', `Starting with Editor note '${displayTitle(currentNote)}'`)
    await finishReviewCoreLogic(currentNote)
  } catch (error) {
    logError('finishReview', error.message)
  }
}

/**
 * Complete review of the given note
 * Note: Used by Dashboard and Project List dialog
 * @author @jgclark
 * @param {TNote} noteIn
 */
export async function finishReviewForNote(noteToUse: TNote, scrollPos: number = 0): Promise<void> {
  try {
    if (!noteToUse || noteToUse.type !== 'Notes') {
      logWarn('finishReviewForNote', `- Not passed a valid project note to finish reviewing. Stopping.`)
      return
    }

    logInfo('finishReviewForNote', `Starting for passed note '${displayTitle(noteToUse)}'`)
    await finishReviewCoreLogic(noteToUse, scrollPos)
  }
  catch (error) {
    logError('finishReviewForNote', error.message)
  }
}

/**
 * Complete current review, then open the next one to review in the Editor.
 * TODO: Update to get a note passed in, rather than using the current Editor note.
 * @author @jgclark
 */
export async function finishReviewAndStartNextReview(): Promise<void> {
  try {
    logDebug('finishReviewAndStartNextReview', `Starting`)
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Finish review of the current project
    await finishReview()
    logDebug('finishReviewAndStartNextReview', `- Returned from finishReview() and will now look for next review ...`)

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('finishReviewAndStartNextReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    } else {
      logDebug('finishReviewAndStartNextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      await startReviewCoreLogic(noteToReview, config, true, 'finishReviewAndStartNextReview')
    }
  } catch (error) {
    logError('finishReviewAndStartNextReview', error.message)
  }
}

//-------------------------------------------------------------------------------

/**
 * Skip a project review, moving it forward to a specified date/interval. 
 * Note: private core logic used by 2 functions.
 * @param (CoreNoteFields) note
 * @param (string?) skipIntervalOrDate (optional)
 */
async function skipReviewCoreLogic(note: CoreNoteFields, skipIntervalOrDate: string = '', scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (config == null) throw new Error('No config found. Stopping.')
    logDebug('skipReviewCoreLogic', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
    let newDateStr: string = ''

    // Calculate new date from param 'skipIntervalOrDate' (if given) or ask user
    if (skipIntervalOrDate !== '') {
      // Get new date from parameter as date interval or iso date 
      newDateStr = skipIntervalOrDate.match(RE_DATE_INTERVAL)
        ? calcOffsetDateStr(todaysDateISOString, skipIntervalOrDate)
        : skipIntervalOrDate.match(RE_DATE)
          ? skipIntervalOrDate
          : ''
      if (newDateStr === '') {
        logWarn('skipReviewCoreLogic', `${skipIntervalOrDate} is not a valid interval, so will stop.`)
        return
      }
    }
    else {
      // Get new date from input in the common ISO format, and create new metadata `@nextReview(date)`. Note: different from `@reviewed(date)`.
      const reply = await getInputTrimmed("Next review date (YYYY-MM-DD) or date interval (e.g. '2w' or '3m') to skip until:", 'OK', 'Skip next review')
      if (!reply || typeof reply === 'boolean') {
        logDebug('skipReviewCoreLogic', `User cancelled command.`)
        return
      }
      newDateStr = reply.match(RE_DATE)
        ? reply
        : reply.match(RE_DATE_INTERVAL)
          ? calcOffsetDateStr(todaysDateISOString, reply)
          : ''
      if (newDateStr === '') {
        logWarn('skipReviewCoreLogic', `No valid date entered, so will stop.`)
        return
      }
    }

    // create new metadata `@nextReview(date)`. Note: different from `@reviewed(date)` below.
    const nextReviewMetadataStr = `${config.nextReviewMentionStr}(${newDateStr})`
    logDebug('skipReviewCoreLogic', `- nextReviewDateStr: ${newDateStr} / nextReviewMetadataStr: ${nextReviewMetadataStr}`)

    const possibleThisEditor = getOpenEditorFromFilename(note.filename)
    if (possibleThisEditor) {
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then update @nextReview() in the canonical place.
      migrateProjectMetadataLineInEditor(possibleThisEditor)

      // Update metadata in the current open note
      logDebug('skipReviewCoreLogic', `Updating Editor ...`)
      updateBodyMetadataInEditor(possibleThisEditor, [nextReviewMetadataStr])

      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorIfNecessary()
      logDebug('skipReviewCoreLogic', `- done`)
    } else {
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions.
      migrateProjectMetadataLineInNote(note)

      // add/update metadata on the note
      logDebug('skipReviewCoreLogic', `Updating note ...`)
      updateBodyMetadataInNote(note, [nextReviewMetadataStr])
    }
    logDebug('skipReviewCoreLogic', `- done`)

    // Save changes to allProjects list
    // v1:
    // const thisNoteAsProject = new Project(note)
    // const newMSL = thisNoteAsProject.TSVSummaryLine()
    // logDebug('skipReviewCoreLogic', `- updatedTSVSummaryLine => '${newMSL}'`)
    // await updateAllProjectsListAfterChange(currentNote.filename, false, config, newMSL)
    // v2: Try to find this project in allProjects, and update that as well
    let thisNoteAsProject = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.nextReviewDateStr = newDateStr
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      logDebug('skipReviewCoreLogic', `-> reviewedDate = ${String(thisNoteAsProject.reviewedDate)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDateStr = ${String(thisNoteAsProject.nextReviewDateStr)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
      // Write changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (but don't open window if not open already)
      await renderProjectListsIfOpen(config, scrollPos)
    } else {
      // Regenerate whole list (and display if window is already open)
      logWarn('skipReviewCoreLogic', `- Couldn't find project '${note.filename}' in allProjects list. So regenerating whole list and display.`)
      await generateProjectListsAndRenderIfOpen(scrollPos)
    }
  }
  catch (error) {
    logError('skipReviewCoreLogic', error.message)
  }
}

/**
 * Skip the next review for the note open in the Editor, asking when to delay to, add that as a @nextReview() date, and jump to next project to review.
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 */
export async function skipReview(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    const currentNote = Editor
    if (!currentNote || currentNote.type !== 'Notes') {
      logWarn('skipReview', `- There's no project note in the Editor, so will stop.`)
      await showMessage(`The current Editor note doesn't contain a project note.`, 'OK, thanks', 'Skip Review')
      return
    }
    logDebug('skipReview', `Starting for Editor '${displayTitle(currentNote)}'`)
    await skipReviewCoreLogic(currentNote)

    // Then move to nextReview
    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('skipReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
      return
    }
    else {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logDebug('skipReview', `- opening '${displayTitle(noteToReview)}' as next note ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    }
  } catch (error) {
    logError('skipReview', error.message)
  }
}

/**
 * Skip the next review for the given note, to the date/interval specified.
 * Note: skipReview() is an interactive version of this for Editor.note
 * @author @jgclark
 */
export async function skipReviewForNote(note: TNote, skipIntervalOrDate: string, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    if (!note || note.type !== 'Notes') {
      logWarn('skipReviewForNote', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
      return
    }
    logDebug('skipReviewForNote', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
    await skipReviewCoreLogic(note, skipIntervalOrDate, scrollPos)
  }
  catch (error) {
    logError('skipReviewForNote', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Set a new review interval the note open in the Editor, by asking user.
 * TEST: following change to allProjects list
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function setNewReviewInterval(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (config == null) throw new Error('No config found. Stopping.')
    logDebug('setNewReviewInterval', `Starting for ${noteArg ? 'passed note (' + noteArg.filename + ')' : 'Editor'}`)
    const note: CoreNoteFields = noteArg ? noteArg : Editor
    if (!note || note.type !== 'Notes') {
      await showMessage(`The current Editor note doesn't contain a project note.`, 'OK, thanks', 'Set new review interval')
      throw new Error(`Not in a valid project note. Stopping.`)
    }

    // Ask user for new date interval
    const reply = await getInputTrimmed("Next review interval (e.g. '2w' or '3m') to set", 'OK', 'Set new review interval')
    if (!reply || typeof reply === 'boolean') {
      logDebug('setNewReviewInterval', `User cancelled command.`)
      return
    }
    // Get new date interval
    const newIntervalStr: string = reply.match(RE_DATE_INTERVAL) ? reply : ''
    if (newIntervalStr === '') {
      logError('setNewReviewInterval', `No valid interval entered, so will stop.`)
      return
    }
    logDebug('setNewReviewInterval', `- new review interval = ${newIntervalStr}`)

    // Update `@review(int)` metadata in the current open note in Editor, or the given note
    if (!noteArg) {
      // Update metadata in the current open note
      logDebug('setNewReviewInterval', `Updating metadata in Editor`)
      const possibleThisEditor = getOpenEditorFromFilename(note.filename)
      if (possibleThisEditor) {
        // Ensure any legacy body metadata is migrated into frontmatter before updating @review()
        migrateProjectMetadataLineInEditor(possibleThisEditor)
        updateBodyMetadataInEditor(possibleThisEditor, [`@review(${newIntervalStr})`])
      } else {
        logDebug('setNewReviewInterval', `- Couldn't find open Editor for note '${note.filename}', so will update note directly.`)
        migrateProjectMetadataLineInNote(note)
        updateBodyMetadataInNote(note, [`@review(${newIntervalStr})`])
      }
      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorIfNecessary()
    } else {
      // update metadata on the note
      logDebug('setNewReviewInterval', `Updating metadata in note`)
      migrateProjectMetadataLineInNote(note)
      updateBodyMetadataInNote(note, [`@review(${newIntervalStr})`])
    }
    logDebug('setNewReviewInterval', `- done`)

    // Save changes to allProjects list
    // v1:
    // const thisNoteAsProject = new Project(note)
    // thisNoteAsProject.calcDurations()
    // thisNoteAsProject.calcNextReviewDate()
    // const newMSL = thisNoteAsProject.TSVSummaryLine()
    // await updateAllProjectsListAfterChange(note.filename, false, config)
    // v2:
    let thisNoteAsProject = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.reviewInterval = newIntervalStr
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      logDebug('setNewReviewInterval', `-> reviewInterval = ${String(thisNoteAsProject.reviewInterval)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDateStr = ${String(thisNoteAsProject.nextReviewDateStr)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
      // Write changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (but don't focus)
      await renderProjectListsIfOpen(config, scrollPos)
    }
  } catch (error) {
    logError('setNewReviewInterval', error.message)
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
 * @param {{ displayOnlyDue: boolean, displayFinished: boolean, displayPaused: boolean, displayNextActions: boolean, displayOrder?: string }} data
 */
export async function saveDisplayFilters(data: {
  displayOnlyDue: boolean,
  displayFinished: boolean,
  displayPaused: boolean,
  displayNextActions: boolean,
  displayOrder?: string,
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
    await DataStore.saveJSON(config, '../jgclark.Reviews/settings.json', true)
    await renderProjectListsIfOpen(config, scrollPos)
  } catch (error) {
    logError('saveDisplayFilters', error.message)
  }
}
