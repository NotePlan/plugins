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
// Last updated 2026-02-13 for v1.3.0.b8, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { checkForWantedResources, logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import {
  deleteMetadataMentionInEditor,
  deleteMetadataMentionInNote,
  getNextActionLineIndex,
  getReviewSettings,
  isProjectNoteIsMarkedSequential,
  type ReviewConfig,
  updateMetadataInEditor,
  updateMetadataInNote,
} from './reviewHelpers'
import {
  filterAndSortProjectsList,
  getNextNoteToReview,
  getSpecificProjectFromList,
  generateAllProjectsList,
  updateProjectInAllProjectsList,
} from './allProjectsListHelpers.js'
import { calcReviewFieldsForProject, Project } from './projectClass'
import {
  generateProjectOutputLine,
  generateTopBarHTML,
  generateProjectTagSectionHTML,
  generateTableStructureHTML,
  generateProjectControlDialogHTML,
  generateFolderHeaderHTML,
} from './projectsHTMLGenerator.js'
import { checkString } from '@helpers/checkType'
import { getTodaysDateHyphenated, RE_DATE, RE_DATE_INTERVAL, todaysDateISOString } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import { getFolderDisplayName, getFolderDisplayNameForHTML } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { showHTMLV2, sendToHTMLWindow } from '@helpers/HTMLView'
import { numberOfOpenItemsInNote } from '@helpers/note'
import { calcOffsetDateStr, nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { getOrOpenEditorFromFilename, getOpenEditorFromFilename, isNoteOpenInEditor, saveEditorIfNecessary } from '@helpers/NPEditor'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { isHTMLWindowOpen, logWindowsList, setEditorWindowId } from '@helpers/NPWindows'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Constants

const pluginID = 'jgclark.Reviews'
const windowTitle = `Project Review List`
const filenameHTMLCopy = '../../jgclark.Reviews/review_list.html'
const customRichWinId = `${pluginID}.rich-review-list`
const customMarkdownWinId = `markdown-review-list`

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Tell the Project List HTML window which project is currently being reviewed.
 * Adds or removes the 'reviewing' class on the matching projectRow, if the window is open.
 * @param {CoreNoteFields | TNote | any} note - note being reviewed
 * @param {boolean} isReviewing - whether this note is now being reviewed
 */
async function setReviewingProjectInHTML(note: any, isReviewing: boolean): Promise<void> {
  try {
    if (!note || note.type !== 'Notes') {
      return
    }
    if (!isHTMLWindowOpen(customRichWinId)) {
      return
    }
    const encodedFilename = encodeRFC3986URIComponent(note.filename)
    await sendToHTMLWindow(customRichWinId, 'SET_REVIEWING_PROJECT', { encodedFilename, isReviewing })
  } catch (error) {
    logError('setReviewingProjectInHTML', error.message)
  }
}

async function clearProjectReviewingInHTML(): Promise<void> {
  try {
    await sendToHTMLWindow(customRichWinId, 'CLEAR_REVIEWING_PROJECT')
    if (!isHTMLWindowOpen(customRichWinId)) {
      return
    }
  } catch (error) {
    logError('clearProjectReviewingInHTML', error.message)
  }
}

//-------------------------------------------------------------------------------
// JS scripts

const stylesheetinksInHeader = `
<!-- Load in Project List-specific CSS -->
<link href="projectList.css" rel="stylesheet">
<link href="projectListDialog.css" rel="stylesheet">
`
const faLinksInHeader = `
<!-- Load in fontawesome assets (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

export const checkboxHandlerJSFunc: string = `
<script type="text/javascript">
async function handleCheckboxClick(cb) {
  try {
  console.log("Checkbox for " + cb.name + " clicked, new value = " + cb.checked);
  const callbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=toggle"+cb.name;
  console.log("Calling URL " + callbackURL + " ...");
  // v1: use fetch() - doesn't work in plugin
  // const res = await fetch(callbackURL);
  // console.log("Result: " + res.status);
  // v2: use window.open() - doesn't work in plugin
  // window.open(callbackURL);
  // v3: use window.location ... - doesn't work in plugin
  // window.location.href = callbackURL;
  // v4:
  const options = {
    method: 'GET',
  }
  fetch(callbackURL, options)
  .then(response => {
    console.log("Result: " + response.status);
  })
  .catch(error => {
    console.log("Error Result: " + response.status);
  });

  // onChangeCheckbox(cb.name, cb.checked); // this uses handler func in commsSwitchboard.js
  }
  catch (err) {
    console.error(err.message);
  }
}
</script>
`

/**
 * Functions to get/set scroll position of the project list content.
 * Helped by https://stackoverflow.com/questions/9377951/how-to-remember-scroll-position-and-scroll-back
 * But need to find a different approach to store the position, as cookies not available.
 */
export const scrollPreLoadJSFuncs: string = `
<script type="text/javascript">
function getCurrentScrollHeight() {
  let scrollPos;
  if (typeof window.pageYOffset !== 'undefined') {
    scrollPos = window.pageYOffset;
  }
  else if (typeof document.compatMode !== 'undefined' && document.compatMode !== 'BackCompat') {
    scrollPos = document.documentElement.scrollTop;
  }
  else if (typeof document.body !== 'undefined') {
    scrollPos = document.body.scrollTop;
  }
  let label = document.getElementById("scrollDisplay");
  label.innerHTML = String(scrollPos);
  console.log("getCurrentScrollHeight = " + String(scrollPos));
}

// Note: saving scroll position to cookie does not work in Safari, but not in NP.
function setScrollPos(h) {
  document.documentElement.scrollTop = h;
  document.body.scrollTop = h;
  console.log('setScrollPos = ' + String(h));
}
</script>
`

const commsBridgeScripts = `
<!-- commsBridge scripts -->
<script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
<script>
/* you must set this before you import the CommsBridge file */
const receivingPluginID = "jgclark.Reviews"; // the plugin ID of the plugin which will receive the comms from HTML
// That plugin should have a function NAMED onMessageFromHTMLView (in the plugin.json and exported in the plugin's index.js)
// this onMessageFromHTMLView will receive any arguments you send using the sendToPlugin() command in the HTML window

/* The onMessageFromPlugin function is called when data is received from your plugin and needs to be processed.
 * This function should not do the work itself, it should just send the data payload to a function for processing.
 * The onMessageFromPlugin function below and your processing functions can be in your html document or could be imported in an external file.
 * The only requirement is that onMessageFromPlugin (and receivingPluginID) must be defined or imported before the 
   pluginToHTMLCommsBridge in your html document or could be imported in an external file. */
</script>
<script type="text/javascript" src="./HTMLWinCommsSwitchboard.js"></script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
`
/**
 * Script to add some keyboard shortcuts to control the dashboard. (Meta=Cmd here.)
 */
const shortcutsScript = `
<!-- shortcuts script -->
<script type="text/javascript" src="./shortcut.js"></script>
<script>
// send 'refresh' command
shortcut.add("meta+r", function() {
  console.log("Shortcut '⌘r' triggered: will call refresh");
  sendMessageToPlugin('refresh', {});
});
// send 'toggleDisplayOnlyDue' command
shortcut.add("meta+d", function() {
  console.log("Shortcut '⌘d' triggered: will call toggleDisplayOnlyDue");
  sendMessageToPlugin('runPluginCommand', {pluginID: 'jgclark.Reviews', commandName:'toggleDisplayOnlyDue', commandArgs: []});
});
// send 'toggleDisplayFinished' command
shortcut.add("meta+f", function() {
  console.log("Shortcut '⌘f' triggered: will call toggleDisplayFinished");
  sendMessageToPlugin('runPluginCommand', {pluginID: 'jgclark.Reviews', commandName: 'toggleDisplayFinished', commandArgs: []});
});
</script>
`

export const setPercentRingJSFunc: string = `
<script>
/**
 * Sets the value of a SVG percent ring.
 * @param {number} percent The percent value to set.
 */
function setPercentRing(percent, ID) {
  let svg = document.getElementById(ID);
  let circle = svg.querySelector('circle');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  circle.style.strokeDasharray = String(circumference) + ' ' + String(circumference);
  circle.style.strokeDashoffset = String(circumference);

  const offset = circumference - percent / 100 * circumference;
  circle.style.strokeDashoffset = offset;  // Set to negative for anti-clockwise.

  // let text = svg.querySelector('text');
  // text.textContent = String(percent); // + '%';
}
</script>
`

const addToggleEvents: string = `
<script>
  /**
   * Register click handlers for each checkbox/toggle in the window with details of the items.
   * Skip checkboxes inside the Display filters dropdown (those use Save instead).
   */
  allInputs = document.getElementsByTagName("INPUT");
  let added = 0;
  for (const input of allInputs) {
    if (input.type !== 'checkbox') continue;
    if (input.getAttribute('data-display-filter') === 'true') continue;
    const thisSettingName = input.name;
    console.log("- adding event for checkbox '"+thisSettingName+"' currently set to state "+input.checked);
    input.addEventListener('change', function (event) {
      event.preventDefault();
      sendMessageToPlugin('onChangeCheckbox', { settingName: thisSettingName, state: event.target.checked });
    }, false);
    added++;
  }
  console.log('- '+ String(added) + ' input ELs added');
</script>
`

const displayFiltersDropdownScript: string = `
<script>
  (function() {
    var btn = document.getElementById('displayFiltersButton');
    var dropdown = document.getElementById('displayFiltersDropdown');
    if (!btn || !dropdown) return;

    var savedState = null;

    function getCheckboxState() {
      var onlyDue = dropdown.querySelector('input[name="displayOnlyDue"]');
      var finished = dropdown.querySelector('input[name="displayFinished"]');
      var paused = dropdown.querySelector('input[name="displayPaused"]');
      var nextActions = dropdown.querySelector('input[name="displayNextActions"]');
      return onlyDue && finished && paused && nextActions
        ? { displayOnlyDue: onlyDue.checked, displayFinished: finished.checked, displayPaused: paused.checked, displayNextActions: nextActions.checked }
        : null;
    }

    function closeDropdown(apply) {
      dropdown.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (apply) {
        var state = getCheckboxState();
        if (state) {
          // Only save + refresh if something actually changed while the dropdown was open
          var hasChanges =
            !savedState ||
            state.displayOnlyDue !== savedState.displayOnlyDue ||
            state.displayFinished !== savedState.displayFinished ||
            state.displayPaused !== savedState.displayPaused ||
            state.displayNextActions !== savedState.displayNextActions;
          if (hasChanges) {
            sendMessageToPlugin('saveDisplayFilters', state);
          }
        }
      } else if (savedState) {
        var onlyDue = dropdown.querySelector('input[name="displayOnlyDue"]');
        var finished = dropdown.querySelector('input[name="displayFinished"]');
        var paused = dropdown.querySelector('input[name="displayPaused"]');
        var nextActions = dropdown.querySelector('input[name="displayNextActions"]');
        if (onlyDue && finished && paused && nextActions) {
          onlyDue.checked = savedState.displayOnlyDue;
          finished.checked = savedState.displayFinished;
          paused.checked = savedState.displayPaused;
          nextActions.checked = savedState.displayNextActions;
        }
      }
    }

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) savedState = getCheckboxState();
    });

    document.addEventListener('click', function(e) {
      if (dropdown.classList.contains('is-open') && !dropdown.contains(e.target) && e.target !== btn) {
        closeDropdown(true);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (!dropdown.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeDropdown(false);
      } else if (e.key === 'Enter') {
        closeDropdown(true);
      }
    });
  })();
</script>
`

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

    // Re-calculate the allProjects list (in foreground)
    await generateAllProjectsList(config, true)

    // Call the relevant rendering function with the updated config
    await renderProjectLists(config, true, scrollPos)
  } catch (error) {
    logError('displayProjectLists', JSP(error))
  }
}

/**
 * Internal version of above that doesn't open window if not already open.
 * @param {number?} scrollPos 
 */
export async function generateProjectListsAndRenderIfOpen(scrollPos: number = 0): Promise<any> {
  try {
    const config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    logDebug(pluginJson, `generateProjectListsAndRenderIfOpen() starting with scrollPos ${String(scrollPos)}`)

    // Re-calculate the allProjects list (in foreground)
    await generateAllProjectsList(config, true)
    logDebug('generateProjectListsAndRenderIfOpen', `generatedAllProjectsList() called, and now will call renderProjectLists() if open`)

    // Call the relevant rendering function, but only continue if relevant window is open
    await renderProjectLists(config, false, scrollPos)
    return {} // just to avoid NP silently failing when called by invokePluginCommandByName
  } catch (error) {
    logError('displayProjectLists', JSP(error))
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

    // If we want Markdown display, call the relevant function with config, but don't open up the display window unless already open.
    if (config.outputStyle.match(/markdown/i)) {
      // eslint-disable-next-line no-floating-promise/no-floating-promise -- no need to wait here
      renderProjectListsMarkdown(config, shouldOpen)
    }
    if (config.outputStyle.match(/rich/i)) {
      await renderProjectListsHTML(config, shouldOpen, scrollPos)
    }
  } catch (error) {
    logError('renderProjectLists', `Error: ${error.message}. configIn: ${JSP(configIn, 2)}`)
  }
}

/**
 * Render the project list, according to the chosen output style. Note: this does *not* re-calculate the project list.
 * @author @jgclark
 */
export async function renderProjectListsIfOpen(
): Promise<any> {
  try {
    logInfo(pluginJson, `renderProjectListsIfOpen ----------------------------------------`)
    const config = await getReviewSettings()

    // If we want Markdown display, call the relevant function with config, but don't open up the display window unless already open.
    if (config.outputStyle.match(/markdown/i)) {
      // eslint-disable-next-line no-floating-promise/no-floating-promise -- no need to wait here
      renderProjectListsMarkdown(config, false)
    }
    if (config.outputStyle.match(/rich/i)) {
      await renderProjectListsHTML(config, false)
    }
    // return {} just to avoid possibility of NP silently failing when called by invokePluginCommandByName
    return {}
  } catch (error) {
    logError('renderProjectListsIfOpen', error.message)
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
  scrollPos: number = 0
): Promise<void> {
  try {
    if (config.projectTypeTags.length === 0) {
      throw new Error('No projectTypeTags configured to display')
    }

    if (!shouldOpen && !isHTMLWindowOpen(customRichWinId)) {
      logDebug('renderProjectListsHTML', `not continuing, as HTML window isn't open and 'shouldOpen' is false.`)
      return
    }

    const funcTimer = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    logInfo(pluginJson, `renderProjectLists ----------------------------------------`)
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

    // String array to save all output
    const outputArray = []

    // Generate top bar HTML
    outputArray.push(generateTopBarHTML(config))

    // Start multi-col working (if space)
    outputArray.push(`<div class="multi-cols">`)

    logTimer('renderProjectListsHTML', funcTimer, `before main loop`)

    // Make the Summary list, for each projectTag in turn
    for (const thisTag of config.projectTypeTags) {
      // Get the summary line for each revelant project
      const [thisSummaryLines, noteCount, due] = await generateReviewOutputLines(thisTag, 'Rich', config)

      // Generate project tag section HTML
      outputArray.push(generateProjectTagSectionHTML(thisTag, noteCount, due, config, config.projectTypeTags.length > 1))
      
      if (noteCount > 0) {
        // Generate table structure HTML
        outputArray.push(generateTableStructureHTML(config, noteCount))
        // outputArray.push('<tbody>')
        outputArray.push(thisSummaryLines.join('\n'))
        outputArray.push('   </tbody>')
        outputArray.push('  </table>')
        outputArray.push(' </div>') // details-content div
        if (config.projectTypeTags.length > 1) {
          outputArray.push(`</details>`)
        }
      }
      // tagCount++
      logTimer('renderProjectListsHTML', funcTimer, `end of loop for ${thisTag}`)
    }

    // Generate project control dialog HTML
    outputArray.push(generateProjectControlDialogHTML())

    const body = outputArray.join('\n')
    logTimer('renderProjectListsHTML', funcTimer, `end of main loop`)

    const setScrollPosJS: string = `
<script type="text/javascript">
  console.log('Attemping to set scroll pos to ${scrollPos}');
  setScrollPos(${scrollPos});
</script>`

    const winOptions = {
      windowTitle: windowTitle,
      customId: customRichWinId,
      headerTags: `${faLinksInHeader}${stylesheetinksInHeader}\n<meta name="startTime" content="${String(Date.now())}">`,
      generalCSSIn: generateCSSFromTheme(config.reviewsTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // now in requiredFiles/reviewListCSS instead
      makeModal: false, // = not modal window
      bodyOptions: 'onload="showTimeAgo()"',
      preBodyScript: setPercentRingJSFunc + scrollPreLoadJSFuncs,
      postBodyScript: checkboxHandlerJSFunc + setScrollPosJS + displayFiltersDropdownScript + `<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
      <script type="text/javascript" src="./showTimeAgo.js" ></script>
      <script type="text/javascript" src="./projectListEvents.js"></script>
      ` + commsBridgeScripts + shortcutsScript + addToggleEvents, // + collapseSection +  resizeListenerScript + unloadListenerScript,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 800, // = default width of window (px)
      height: 1200, // = default height of window (px)
      shouldFocus: false, // shouuld not focus, if Window already exists
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

          // Get the summary line for each revelant project
          const [outputArray, noteCount, due] = await generateReviewOutputLines(tag, 'Markdown', config)
          logTimer('renderProjectListsHTML', funcTimer, `after generateReviewOutputLines(${tag}) for ${String(due)} projects`)
          if (isNaN(noteCount)) logWarn('renderProjectListsHTML', `Warning: noteCount is NaN`)

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
        logTimer('renderProjectListsHTML', funcTimer, `after generateReviewOutputLines`)

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
        // Open the note in a new window
        // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
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
 * Re-display the project list from saved HTML file, if available, or if not then render the current all projects list.
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
        headerTags: '', // don't set as it is already in the saved file
        generalCSSIn: '', // don't set as it is already in the saved file
        specificCSS: '', // now provided by separate projectList.css
        makeModal: false, // = not modal window
        bodyOptions: '', // don't set as it is already in the saved file
        preBodyScript: '', // don't set as it is already in the saved file
        postBodyScript: '', // don't set as it is already in the saved file
        savedFilename: '', // don't re-save it
        reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
        width: 800, // = default width of window (px)
        height: 1200, // = default height of window (px)
        customId: customRichWinId,
        shouldFocus: true, // shouuld focus
      }
      const _thisWindow = await showHTMLV2(savedHTML, winOptions)
      // clo(_thisWindow, 'created window')
      logDebug('redisplayProjectListHTML', `Displayed HTML from saved file ${filenameHTMLCopy}`)
      return
    } else {
      logWarn('redisplayProjectListHTML', `Couldn't read from saved HTML file ${filenameHTMLCopy}.`)
    }
  } catch (error) {
    logError('redisplayProjectListHTML', error.message)
  }
}

//-------------------------------------------------------------------------------

/**
 * Return summary of notes that contain a specified 'projectTag', for all relevant folders, in 'Markdown' or 'Rich' style.
 * Reads from the already generated allProjects JSON file.
 * @author @jgclark
 *
 * @param {string} projectTag - the current hashtag (only now used in logging)
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} output summary lines
 * @returns {number} number of notes
 * @returns {number} number of due notes (ready to review)
 */
export async function generateReviewOutputLines(projectTag: string, style: string, config: ReviewConfig): Promise<[Array<string>, number, number]> {
  try {
    const startTime = new Date()
    logDebug('generateReviewOutputLines', `Starting for tag(s) '${projectTag}' in ${style} style`)

    // Get all wanted projects (in useful order and filtered)
    const projectsToReview: Array<Project> = await filterAndSortProjectsList(config, projectTag)
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
      const out = generateProjectOutputLine(thisProject, config, style)

      // Add to number of notes to review (if appropriate)
      if (!thisProject.isPaused && thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays) && thisProject.nextReviewDays <= 0) {
        due += 1
      }

      // Write new folder header (if change of folder)
      const folder = thisProject.folder
      if (config.displayGroupedByFolder && lastFolder !== folder) {
        // Get display name with teamspace name if applicable
        const folderDisplayName = ((style.match(/rich/i))
          ? getFolderDisplayNameForHTML(folder)
          : getFolderDisplayName(folder, true))
        let folderPart: string
        if (config.hideTopLevelFolder) {
          // Extract just the last part of the folder path
          // Handle teamspace format: [👥 TeamspaceName] /folder/path -> [👥 TeamspaceName] path
          // Handle regular format: folder/path -> path
          if (folderDisplayName.includes(']')) {
            // Teamspace folder: extract prefix and last part of path
            const match = folderDisplayName.match(/^(\[.*?\])\s*(.+)$/)
            if (match) {
              const teamspacePrefix = match[1]
              const pathPart = match[2]
              const pathParts = pathPart.split('/').filter(p => p !== '')
              const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : pathPart
              folderPart = `${teamspacePrefix} ${lastPart}`
            } else {
              folderPart = folderDisplayName.split('/').slice(-1)[0] || folderDisplayName
            }
          } else {
            // Regular folder: just get last part
            const pathParts = folderDisplayName.split('/').filter(p => p !== '')
            folderPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : folderDisplayName
          }
        } else {
          folderPart = folderDisplayName
        }
        // Handle root folder display - check if original folder was root, not the display name
        if (folder === '/') folderPart = '(root folder)'
        if (style.match(/rich/i)) {
          outputArray.push(generateFolderHeaderHTML(folderPart, config))
        } else if (style.match(/markdown/i)) {
          outputArray.push(`### ${folderPart}`)
        }
      }

      outputArray.push(out)
      noteCount++

      lastFolder = folder
    }
    logTimer('generateReviewOutputLines', startTime, `Generated for ${String(noteCount)} notes for tag(s) '${projectTag}' in ${style} style`)
    return [outputArray, noteCount, due]
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
async function finishReviewCoreLogic(note: CoreNoteFields): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
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
    if (possibleThisEditor) {
      logDebug('finishReviewCoreLogic', `Updating Editor '${displayTitle(possibleThisEditor)}' ...`)
      // First update @review(date) on current open note
      updateMetadataInEditor(possibleThisEditor, [reviewedTodayString])
      // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
      deleteMetadataMentionInEditor(possibleThisEditor, [config.nextReviewMentionStr])
      await possibleThisEditor.save()
      // Note: no longer seem to need to update cache
    } else {
      logDebug('finishReviewCoreLogic', `Updating note '${displayTitle(note)}' ...`)
      // First update @review(date) on the note
      updateMetadataInNote(note, [reviewedTodayString])
      // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
      deleteMetadataMentionInNote(note, [config.nextReviewMentionStr])
      // $FlowIgnore[prop-missing]
      DataStore.updateCache(note, true)
    }
    logDebug('finishReviewCoreLogic', `- done`)

    // Then update the Project instance
    // v1:
    // const thisNoteAsProject = new Project(noteToUse)
    // v2: Try to find this project in allProjects, and update that as well
    let thisNoteAsProject: ?Project = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.reviewedDate = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      // Clear nextReviewDateStr so it recalculates from the new reviewedDate and reviewInterval
      thisNoteAsProject.nextReviewDateStr = null
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      const nextReviewDays = thisNoteAsProject.nextReviewDays
      if (nextReviewDays < 0) {
        logWarn('finishReviewCoreLogic', `- project.nextReviewDays is still negative (${String(nextReviewDays)}). This should not happen.`)
      } else {
        logDebug('finishReviewCoreLogic', `- PI now shows next review due in ${String(thisNoteAsProject.nextReviewDays)} days (${String(thisNoteAsProject.nextReviewDateStr)})`)
      }

      // Save changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (but don't open if it isn't already)
      await renderProjectLists(config, false)
    } else {
      // Regenerate whole list (and display if window is already open)
      logInfo('finishReviewCoreLogic', `- In allProjects list couldn't find project '${note.filename}'. So regenerating whole list and will display if list is open.`)
      await generateProjectListsAndRenderIfOpen()
    }

    // Ensure the Project List window (if open) no longer shows this project as being actively reviewed
    await clearProjectReviewingInHTML()

    logDebug('finishReviewCoreLogic', `- finished successfully`)
  }
  catch (error) {
    logError('finishReviewCoreLogic', error.message)
  }
}

// --------------------------------------------------------------------

/**
 * Start a series of project reviews..
 * Then offers to load the first note to review, based on allProjectsList, ordered by most overdue for review.
 * Note: Used by Project List dialog, and Dashboard.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Get the next note to review, based on allProjectsList, ordered by most overdue for review.
    const noteToReview = await getNextNoteToReview()
    // Open that note in an Editor, confirming with the user if necessary.
    if (!noteToReview) {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
      return
    }

    if (config.confirmNextReview) {
      const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
      if (res !== 'OK') {
        logDebug('startReviews', `- User didn't want to continue.`)
        return
      }
    }
    logInfo('startReviews', `🔍 Opening '${displayTitle(noteToReview)}' note to review ...`)
    await Editor.openNoteByFilename(noteToReview.filename)
    // Highlight this project in the Project List window (if open)
    await setReviewingProjectInHTML(noteToReview, true)
  } catch (error) {
    logError('startReviews', error.message)
  }
}

/**
 * Start a single project review.
 * Note: Used by Project List dialog (and Dashboard in future?)
 * @param {TNote} noteToReview - the note to start reviewing
 * @author @jgclark
 */
export async function startReviewForNote(noteToReview: TNote): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    logInfo('startReviews', `🔍 Opening '${displayTitle(noteToReview)}' note to review ...`)
    await Editor.openNoteByFilename(noteToReview.filename)
    // Highlight this project in the Project List window (if open)
    await setReviewingProjectInHTML(noteToReview, true)
  
  } catch (error) {
    logError('startReviews', error.message)
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
    const currentNote = Editor // note: not Editor.note
    if (currentNote && currentNote.type === 'Notes') {
      logInfo('finishReview', `Starting with Editor '${displayTitle(currentNote)}'`)
      await finishReviewCoreLogic(currentNote)
    } else {
      logWarn('finishReview', `- There's no project note in the Editor to finish reviewing.`)
      await showMessage(`The current Editor note doesn't contain a project note to finish reviewing.`, 'OK, thanks', 'Reviews')
    }
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
export async function finishReviewForNote(noteToUse: TNote): Promise<void> {
  try {
    if (!noteToUse || noteToUse.type !== 'Notes') {
      logWarn('finishReviewForNote', `- Not passed a valid project note to finish reviewing. Stopping.`)
      return
    }

    logInfo('finishReviewForNote', `Starting for passed note '${displayTitle(noteToUse)}'`)
    await finishReviewCoreLogic(noteToUse)
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
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Finish review of the current project
    await finishReview()
    logDebug('finishReviewAndStartNextReview', `- Returned from finishReview() and will now look for next review ...`)

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (noteToReview != null) {
      logDebug('finishReviewAndStartNextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      await Editor.openNoteByFilename(noteToReview.filename)

      // Highlight this as the newly active review in the Project List window (if open)
      await setReviewingProjectInHTML(noteToReview, true)
    } else {
      logInfo('finishReviewAndStartNextReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
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
async function skipReviewCoreLogic(note: CoreNoteFields, skipIntervalOrDate: string = ''): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    logDebug('skipReviewForNote', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
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
        logWarn('skipReviewForNote', `${skipIntervalOrDate} is not a valid interval, so will stop.`)
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
      // Update metadata in the current open note
      logDebug('skipReviewCoreLogic', `Updating Editor ...`)
      updateMetadataInEditor(possibleThisEditor, [nextReviewMetadataStr])

      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorIfNecessary()
      logDebug('skipReviewCoreLogic', `- done`)
    } else {
      // add/update metadata on the note
      logDebug('skipReviewCoreLogic', `Updating note ...`)
      updateMetadataInNote(note, [nextReviewMetadataStr])
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
      await renderProjectLists(config, false)
    } else {
      // Regenerate whole list (and display if window is already open)      
      logWarn('skipReviewCoreLogic', `- Couldn't find project '${note.filename}' in allProjects list. So regenerating whole list and display.`)
      await generateProjectListsAndRenderIfOpen()
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
    const config: ReviewConfig = await getReviewSettings()
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
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logDebug('skipReview', `- opening '${displayTitle(noteToReview)}' as next note ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('skipReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
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
export async function skipReviewForNote(note: TNote, skipIntervalOrDate: string): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    if (!note || note.type !== 'Notes') {
      logWarn('skipReviewForNote', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
    }
    logDebug('skipReviewForNote', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
    await skipReviewCoreLogic(note, skipIntervalOrDate)
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
export async function setNewReviewInterval(noteArg?: TNote): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
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
        updateMetadataInEditor(possibleThisEditor, [`@review(${newIntervalStr})`])
      } else {
        logDebug('setNewReviewInterval', `- Couldn't find open Editor for note '${note.filename}', so will update note directly.`)
        updateMetadataInNote(note, [`@review(${newIntervalStr})`])
      }
      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorIfNecessary()
    } else {
      // update metadata on the note
      logDebug('setNewReviewInterval', `Updating metadata in note`)
      updateMetadataInNote(note, [`@review(${newIntervalStr})`])
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
      await renderProjectLists(config, false)
    }
  } catch (error) {
    logError('setNewReviewInterval', error.message)
  }
}

//-------------------------------------------------------------------------------

/** 
 * Toggle displayFinished setting, held as a NP preference, as it is shared between frontend and backend
*/
export async function toggleDisplayFinished(): Promise<void> {
  try {
    // v1 used NP Preference mechanism, but not ideal as it can't be used from frontend
    // v2 directly update settings.json instead
    const config: ReviewConfig = await getReviewSettings()
    const savedValue = config.displayFinished ?? 'hide'
    // const newValue = (savedValue === 'display')
    //   ? 'display at end'
    //   : (savedValue === 'display at end')
    //     ? 'hide'
    //     : 'display'
    const newValue = !savedValue
    logDebug('toggleDisplayOnlyDue', `displayOnlyDue? now '${String(newValue)}' (was '${String(savedValue)}')`)

    const updatedConfig = config
    updatedConfig.displayFinished = newValue
    // logDebug('toggleDisplayFinished', `updatedConfig.displayFinished? now is '${String(updatedConfig.displayFinished)}'`)
    const res = await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
    // clo(updatedConfig, 'updatedConfig at end of toggle...()')
    await renderProjectLists(updatedConfig, false)
  }
  catch (error) {
    logError('toggleDisplayFinished', error.message)
  }
}

/** 
 * Toggle displayFinished setting, held as a NP preference, as it is shared between frontend and backend
*/
export async function toggleDisplayOnlyDue(): Promise<void> {
  try {
    // v1 used NP Preference mechanism, but not ideal as it can't be used from frontend
    // v2 directly update settings.json instead
    const config: ReviewConfig = await getReviewSettings()
    const savedValue = config.displayOnlyDue ?? true
    const newValue = !savedValue
    logDebug('toggleDisplayOnlyDue', `displayOnlyDue? now '${String(newValue)}' (was '${String(savedValue)}')`)
    const updatedConfig = config
    updatedConfig.displayOnlyDue = newValue
    // logDebug('toggleDisplayOnlyDue', `updatedConfig.displayOnlyDue? now is '${String(updatedConfig.displayOnlyDue)}'`)
    const res = await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
    // clo(updatedConfig, 'updatedConfig at end of toggle...()')
    await renderProjectLists(updatedConfig, false)
  }
  catch (error) {
    logError('toggleDisplayOnlyDue', error.message)
  }
}

/** 
 * Toggle displayNextActions setting, held as a NP preference, as it is shared between frontend and backend
*/
export async function toggleDisplayNextActions(): Promise<void> {
  try {
    // v2 directly update settings.json
    const config: ReviewConfig = await getReviewSettings()
    const savedValue = config.displayNextActions ?? false
    const newValue = !savedValue
    logDebug('toggleDisplayNextActions', `displayNextActions? now '${String(newValue)}' (was '${String(savedValue)}')`)
    const updatedConfig = config
    updatedConfig.displayNextActions = newValue
    // logDebug('toggleDisplayNextActions', `updatedConfig.displayNextActions? now is '${String(updatedConfig.displayNextActions)}'`)
    const res = await DataStore.saveJSON(updatedConfig, '../jgclark.Reviews/settings.json', true)
    // clo(updatedConfig, 'updatedConfig at end of toggle...()')
    await renderProjectLists(updatedConfig, false)
  }
  catch (error) {
    logError('toggleDisplayNextActions', error.message)
  }
}

/**
 * Save all display filter settings at once (used by Display filters dropdown).
 * @param {{ displayOnlyDue: boolean, displayFinished: boolean, displayPaused: boolean, displayNextActions: boolean }} data
 */
export async function saveDisplayFilters(data: {
  displayOnlyDue: boolean,
  displayFinished: boolean,
  displayPaused: boolean,
  displayNextActions: boolean,
}): Promise<void> {
  try {
    const config: ReviewConfig = await getReviewSettings()
    config.displayOnlyDue = data.displayOnlyDue
    config.displayFinished = data.displayFinished
    config.displayPaused = data.displayPaused
    config.displayNextActions = data.displayNextActions
    await DataStore.saveJSON(config, '../jgclark.Reviews/settings.json', true)
    await renderProjectLists(config, false)
  } catch (error) {
    logError('saveDisplayFilters', error.message)
  }
}
