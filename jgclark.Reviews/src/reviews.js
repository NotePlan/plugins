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
// Last updated 2024-09-27 for v1.0.0.b1, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter'
import pluginJson from '../plugin.json'
import { checkForWantedResources, logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import {
  deleteMetadataMentionInEditor,
  deleteMetadataMentionInNote,
  getReviewSettings,
  type ReviewConfig,
  saveEditorToCache,
  updateDashboardIfOpen,
  updateMetadataInEditor,
  updateMetadataInNote,
} from './reviewHelpers'
import {
  filterAndSortProjectsList,
  // filterAndSortReviewList,
  getNextNoteToReview,
  // makeFullReviewList,
  generateAllProjectsList,
  updateProjectsListAfterChange
} from './reviewListHelpers'
import { Project } from './projectClass'
import { checkString } from '@helpers/checkType'
import {
  calcOffsetDateStr, getDateObjFromDateString,
  getTodaysDateHyphenated,
  RE_DATE, RE_DATE_INTERVAL, todaysDateISOString
} from '@helpers/dateTime'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import {
  createRunPluginCallbackUrl, displayTitle,
} from '@helpers/general'
import {
  makePluginCommandButton,
  showHTMLV2
} from '@helpers/HTMLView'
import { getOrMakeNote } from '@helpers/note'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
// import { findNotesMatchingHashtag } from '@helpers/NPnote'
// import { sortListBy } from '@helpers/sorting'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'
import {
  isHTMLWindowOpen, logWindowsList, noteOpenInEditor, setEditorWindowId,
} from '@helpers/NPWindows'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${pluginID}/full-review-list.md` // to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
// const allProjectsListFilename = `../${pluginID}/allProjectsList.json` // to ensure that it saves in the Reviews directory (which wasn't the case when called from Dashboard)
const windowTitle = `Project Review List`
const filenameHTMLCopy = '../../jgclark.Reviews/review_list.html'
const customRichWinId = `${pluginID}.rich-review-list`
const customMarkdownWinId = `markdown-review-list`

//-------------------------------------------------------------------------------

const faLinksInHeader = `
<!-- Load in Project List-specific CSS -->
<link href="projectList.css" rel="stylesheet">
<link href="projectListDialog.css" rel="stylesheet">

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
  if (typeof window.pageYOffset != 'undefined') {
    scrollPos = window.pageYOffset;
  }
  else if (typeof document.compatMode != 'undefined' && document.compatMode != 'BackCompat') {
    scrollPos = document.documentElement.scrollTop;
  }
  else if (typeof document.body != 'undefined') {
    scrollPos = document.body.scrollTop;
  }
  let label = document.getElementById("scrollDisplay");
  label.innerHTML = String(scrollPos);
  console.log(String(scrollPos));
}

function setScrollPos(h) {
  document.documentElement.scrollTop = h;
  document.body.scrollTop = h;
  console.log('Set scroll pos to ' + String(h));
}

// ???
function setRefreshButtonURL(h) {
  // TODO:
  // document.documentElement.scrollTop = h;
  // document.body.scrollTop = h;
  console.log('Set refresh button x-callback to ???');
}

// This works in Safari, but not in NP:
// window.onbeforeunload = function () {
//   let scrollPos;
//   if (typeof window.pageYOffset != 'undefined') {
//     scrollPos = window.pageYOffset;
//   }
//   else if (typeof document.compatMode != 'undefined' && document.compatMode != 'BackCompat') {
//     scrollPos = document.documentElement.scrollTop;
//   }
//   else if (typeof document.body != 'undefined') {
//     scrollPos = document.body.scrollTop;
//   }
//   const info = "scrollTop=" + scrollPos + "URL=" + window.location.href;
//   console.log(info);
//   document.cookie = info;
// }
//
// This works in Safari, but not in NP:
// window.onload = function () {
//   console.log('Looking for cookies for '+window.location.href)
//   if (document.cookie.includes(window.location.href)) {
//     if (document.cookie.match(/scrollTop=([^;]+)(;|$)/) != null) {
//       let arr = document.cookie.match(/scrollTop=([^;]+)(;|$)/);
//       console.log('Found matching cookie(s): '+String(arr))
//       document.documentElement.scrollTop = parseInt(arr[1]);
//       document.body.scrollTop = parseInt(arr[1]);
//     }
//   }
// }
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

/* the onMessageFromPlugin function is called when data is received from your plugin and needs to be processed. this function
   should not do the work itself, it should just send the data payload to a function for processing. The onMessageFromPlugin function
   below and your processing functions can be in your html document or could be imported in an external file. The only
   requirement is that onMessageFromPlugin (and receivingPluginID) must be defined or imported before the pluginToHTMLCommsBridge
   be in your html document or could be imported in an external file */
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

/**
 * TODO: this would need to go in commsSwitchboard.js. And contents uncommented out.
 * Event handler for the 'change' event on a checkbox
 * @param {string} settingName of checkbox
 * @param {boolean} state that it now has
 */
// function onChangeCheckbox(settingName: string, state: boolean) {
  // const data = { settingName, state }
  // console.log(`onChangeCheckbox received: settingName: ${data.settingName}, state: ${String(data.state)}; sending 'onChangeCheckbox' to plugin`)
  // sendMessageToPlugin('onChangeCheckbox', data) // actionName, data
// }

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

//-------------------------------------------------------------------
// Moved following from projectLists.js to avoid circular dependency
//-------------------------------------------------------------------

/**
 * Decide which of the project list outputs to call (or more than one) based on x-callback args or config.outputStyle.
 * Now includes support for calling from x-callback, using full JSON '{"a":"b", "x":"y"}' version of settings and values that will override ones in the user's settings.
 * @param {string? | null} argsIn as JSON (optional)
 * @param {number?} scrollPos in pixels (optional, for HTML only)
 */
export async function makeProjectLists(argsIn?: string | null = null, scrollPos: number = 1000): Promise<void> {
  try {
    let config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const args = argsIn?.toString() || ''
    logDebug(pluginJson, `makeProjectLists: starting with JSON args <${args}> and scrollPos ${String(scrollPos)}`)
    if (args !== '') {
      config = overrideSettingsWithEncodedTypedArgs(config, args)
      // clo(config, 'Review settings updated with args:')
    } else {
      // clo(config, 'Review settings with no args:')
    }

    // Re-calculate the full-review-list (in foreground)
    // await makeFullReviewList(config, true)
    await generateAllProjectsList(config, true)

    // Call the relevant rendering function with the updated config
    await renderProjectLists(config, true, scrollPos)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Render the project list, according to the chosen output style.
 * Note: this does not re-calculate the data.
 * @author @jgclark
 * @param {any} config
 * @param {boolean} shouldOpen window/note if not already open?
 * @param {number?} scrollPos scroll position to set (pixels) for HTML display (default: 0)
 */
export async function renderProjectLists(
  config: ReviewConfig,
  shouldOpen: boolean = true,
  scrollPos: number = 0
): Promise<void> {
  try {
    // clo(config, 'config at start of renderProjectLists:')
    logDebug('renderProjectLists', `Started with displayOnlyDue? ${String(config.displayOnlyDue ?? '(error)')} displayFinished? ${String(config.displayFinished ?? '(error)')}`)

    // If we want Markdown display, call the relevant function with config, but don't open up the display window unless already open.
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, shouldOpen)
    }
    if (config.outputStyle.match(/rich/i)) {
      await renderProjectListsHTML(config, shouldOpen, scrollPos)
    }
  } catch (error) {
    clo(config, 'config at start of renderProjectLists:')
  }
}

//---------------------------------------------------------------------

/**
 * Generate 'Rich' HTML view of project notes for each tag of interest, using the pre-built full-review-list.
 * Note: Requires NP 3.7.0 (build 844) or greater.
 * Note: Currently we can only display 1 HTML Window at a time, so need to include all tags in a single view. In time this can hopefully change.
 * @author @jgclark
 * @param {any} config
 * @param {boolean} shouldOpen window/note if not already open?
 * @param {number?} scrollPos scroll position to set (pixels) for HTML display  */
export async function renderProjectListsHTML(
  config: any,
  shouldOpen: boolean = true,
  scrollPos: number = 0
): Promise<void> {
  try {
    if (config.noteTypeTags.length === 0) {
      throw new Error('No noteTypeTags configured to display')
    }

    if (!shouldOpen && !isHTMLWindowOpen(customRichWinId)) {
      logDebug('renderProjectListsHTML', `not continuing, as HTML window isn't open and 'shouldOpen' is false.`)
      return
    }

    const funcTimer = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    logDebug('renderProjectListsHTML', `starting for ${String(config.noteTypeTags)} tags`)

    // Test to see if we have the font resources we want
    if (!(await checkForWantedResources(pluginID))) {
      logError(pluginJson, `Sorry, I can't find the font resources I need to continue.`)
      await showMessage(`Sorry, I can't find the font resources I need to continue. Please check you have installed the 'Shared Resources' plugin, and then try again.`)
      return
    } else {
      const wantedFilenames = ['fontawesome.css', 'regular.min.flat4NP.css', 'solid.min.flat4NP.css', 'fa-regular-400.woff2', 'fa-solid-900.woff2']
      const numFoundFilenames = await checkForWantedResources(pluginID, wantedFilenames)
      if (Number(numFoundFilenames) < wantedFilenames.length) {
        logWarn(pluginJson, `Sorry, I can only find ${String(numFoundFilenames)} of the ${String(wantedFilenames.length)} wanted shared resource files`)
      }
    }

    logTimer('renderProjectListsHTML', funcTimer, `>> after checkForWantedResources and before possible makeFullReviewList`)

    // Ensure noteTypeTags is an array before proceeding
    if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]

    // String array to save all output
    const outputArray = []

    // Add (pseduo-)buttons for various commands
    // Note: this is not a real button, bcause at the time I started this real < button > wouldn't work in NP HTML views, and Eduard didn't know why.
    // Version 3: using proper link to the internal function using HTMLView::getCallbackCodeString() instead
    // Useful fontawesome icons include:
    // https://fontawesome.com/icons/play
    // https://fontawesome.com/icons/forward-step
    // https://fontawesome.com/icons/play-pause
    // https://fontawesome.com/icons/calendar-pen
    // https://fontawesome.com/icons/check
    // https://fontawesome.com/icons/xmark
    // https://fontawesome.com/icons/forward
    const refreshPCButton = makePluginCommandButton(
      `<i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh`,
      'jgclark.Reviews',
      'project lists',
      '',
      'Recalculate project lists and update this window',
    )
    const startReviewPCButton = makePluginCommandButton(
      `<i class="fa-solid fa-play"></i>\u00A0Start`,
      'jgclark.Reviews',
      'start reviews',
      '',
      'Opens the next project to review in the NP editor',
    )
    const reviewedPCButton = makePluginCommandButton(
      `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish`,
      'jgclark.Reviews',
      'finish project review',
      '',
      `Update the ${checkString(DataStore.preference('reviewedMentionStr'))}() date for the Project you're currently editing`,
    )
    const nextReviewPCButton = makePluginCommandButton(
      `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next`,
      'jgclark.Reviews',
      'next project review',
      '',
      `Finish review of currently open Project and start the next review`,
    )
    const skipReviewPCButton = makePluginCommandButton(`<i class="fa-solid fa-forward"></i>\u00A0Skip\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next`,
      'jgclark.Reviews',
      'skip project review',
      '',
      'Skip this Project review and select new date')
    const updateProgressPCButton = makePluginCommandButton(
      `\u00A0<i class="fa-solid fa-comment-lines"></i>\u00A0Add Progress`,
      'jgclark.Reviews',
      'add progress update',
      '',
      'Add a progress line to the currently open Project note',
    )
    const pausePCButton = makePluginCommandButton(
      `Toggle\u00A0<i class="fa-solid fa-circle-pause"></i>\u00A0Pause`,
      'jgclark.Reviews',
      'pause project toggle',
      '',
      'Pause the currently open Project note',
    )
    const completePCButton = makePluginCommandButton(
      `<i class="fa-solid fa-circle-check"></i>\u00A0Complete`,
      'jgclark.Reviews',
      'complete project',
      '',
      'Complete the currently open Project note',
    )
    const cancelPCButton = makePluginCommandButton(
      `<i class="fa-solid fa-circle-xmark"></i>\u00A0Cancel`,
      'jgclark.Reviews',
      'cancel project',
      '',
      'Cancel the currently open Project note'
    )

    // write lines before first table
    // outputArray.push(`<h1>${windowTitle}</h1>`)

    // Add a sticky area for buttons
    const controlButtons = `<span class="sticky-box-header">Reviews</span> ${startReviewPCButton} \n${reviewedPCButton} \n${nextReviewPCButton}\n${skipReviewPCButton}\n<br /><span class="sticky-box-header">List</span>: \n${refreshPCButton} \n<span class="sticky-box-header">Project</span>: ${updateProgressPCButton} ${pausePCButton} \n${completePCButton} \n${cancelPCButton}`
    // Note: remove test lines to see scroll position:
    // controlButtons += ` <input id="id" type="button" value="Update Scroll Pos" onclick="getCurrentScrollHeight();"/>`
    // controlButtons += ` <span id="scrollDisplay" class="fix-top-right">?</span>`
    outputArray.push(`<div class="sticky-box-top-middle">\n${controlButtons}\n</div>\n`)

    // Show date + display settings
    const displayFinished = DataStore.preference('Reviews-DisplayFinished' ?? 'display at end')
    const displayOnlyDue = DataStore.preference('Reviews-DisplayOnlyDue' ?? false)
    // v1: text labels
    let togglesValues = (displayOnlyDue) ? 'showing only projects/areas ready for review' : 'showing all open projects/areas'
    togglesValues += (displayFinished === 'hide') ? '' : ', plus finished ones'
    // v1: simple text
    outputArray.push(`<p>Last updated: <span id="timer">${nowLocaleShortDateTime()}</span> (${togglesValues})</p>`)

    // v2: TODO: add checkbox toggles

    // Allow multi-col working
    outputArray.push(`<div class="multi-cols">`)

    logTimer('renderProjectListsHTML', funcTimer, `before main loop`)

    // Make the Summary list, for each noteTag in turn
    // let tagCount = 0
    for (const thisTag of config.noteTypeTags) {
      // Get the summary line for each revelant project
      const [thisSummaryLines, noteCount, due] = await generateReviewOutputLines(thisTag, 'Rich', config)

      // Write out all relevant HTML
      outputArray.push('')
      outputArray.push(`<h2>${thisTag}: ${noteCount} notes, ${due} ready for review</h2>`)
      // Add folder name, but only if we're only looking at 1 folder, and we're not grouping by folder. (If we are then folder names are added inside the table.)
      if (!config.displayGroupedByFolder && config.foldersToInclude.length === 1) {
        outputArray.push(`<h3>${config.foldersToInclude[0]} folder</h3>`)
      }

      // Start constructing table (if there any results)
      outputArray.push('\n<table>')
      if (noteCount > 0) {
        // In some cases, include colgroup to help massage widths a bit
        if (config.displayDates) {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 2.6em">
\t<col>
\t<col style="width: 6em">
\t<col style="width: 6em">
</colgroup>
`)
        } else if (config.displayProgress) {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
        } else {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
        }
        // outputArray.push('<tbody>')
        outputArray.push(thisSummaryLines.join('\n'))
        outputArray.push('</tbody>')
        outputArray.push('</table>')
      }
      // tagCount++
      logTimer('renderProjectListsHTML', funcTimer, `end of loop for ${thisTag}`)
    }
    outputArray.push(`</div>`)

    // Project control dialog
    // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
    const projectControlDialogHTML = `
  <!----------- Dialog to show on Project items ----------->
  <dialog id="projectControlDialog" class="projectControlDialog" aria-labelledby="Actions Dialog"
    aria-describedby="Actions that can be taken on projects">
    <div class="dialogTitle">For <i class="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogProjectNote">?</span></b></div>
    <div class="dialogBody">
      <div class="buttonGrid" id="projectDialogButtons">
        <div>Reviews</div>
        <div id="projectControlDialogProjectControls">
          <button data-control-str="finish"><i class="fa-regular fa-calendar-check"></i> Finish Review</button>
          <button data-control-str="nr+1w"><i class="fa-solid fa-forward"></i> Skip 1w</button>
          <button data-control-str="nr+2w"><i class="fa-solid fa-forward"></i> Skip 2w</button>
          <button data-control-str="nr+1m"><i class="fa-solid fa-forward"></i> Skip 1m</button>
          <button data-control-str="nr+1q"><i class="fa-solid fa-forward"></i> Skip 1q</button>
        </div>
        <div>Actions</div>
        <div>
          <button data-control-str="progress"><i class="fa-solid fa-comment-lines"></i> Add Progress</button>
          <button data-control-str="pause">Toggle <i class="fa-solid fa-circle-pause"></i> Pause</button>
          <button data-control-str="complete"><i class="fa-solid fa-circle-check"></i> Complete</button>
          <button data-control-str="cancel"><i class="fa-solid fa-circle-xmark"></i> Cancel</button>
        </div>
        <div></div>
        <div><form><button id="closeButton" class="mainButton">Close</button></form></div>
        </div>
      </div>
    </div>
  </dialog>
`
    outputArray.push(projectControlDialogHTML)

    const body = outputArray.join('\n')
    logTimer('renderProjectListsHTML', funcTimer, `end of main loop`)

    const setScrollPosJS: string = `
<script type="text/javascript">
  console.log('Attemping to set scroll pos to ${scrollPos}');
  setScrollPos(${scrollPos});
  console.log('Attemping to set scroll pos for refresh button to ${scrollPos}');
  setRefreshButtonURL(${scrollPos});
</script>`

    const winOptions = {
      windowTitle: windowTitle,
      customId: customRichWinId,
      headerTags: `${faLinksInHeader}\n<meta name="startTime" content="${String(Date.now())}">`,
      generalCSSIn: generateCSSFromTheme(config.reviewsTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // now in requiredFiles/reviewListCSS instead
      makeModal: false, // = not modal window
      bodyOptions: 'onload="showTimeAgo()"',
      preBodyScript: setPercentRingJSFunc + scrollPreLoadJSFuncs,
      postBodyScript: checkboxHandlerJSFunc + setScrollPosJS + `<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
      <script type="text/javascript" src="./showTimeAgo.js" ></script>
      <script type="text/javascript" src="./projectListEvents.js"></script>
      ` + commsBridgeScripts + shortcutsScript, // resizeListenerScript + unloadListenerScript,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 800, // = default width of window (px)
      height: 1200, // = default height of window (px)
      shouldFocus: false, // shouuld not focus, if Window already exists
    }
    const thisWindow = await showHTMLV2(body, winOptions)
    if (thisWindow) {
      logDebug('renderProjectListsHTML', `- written results to HTML window and file`)
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
    logDebug('renderProjectListsMarkdown', `Starting for ${String(config.noteTypeTags)} tags`)
    const funcTimer = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

    // Set up x-callback URLs for various commands
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'start reviews', '') // "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=start%20reviews"
    const reviewedXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'finish project review', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=finish%20project%20review&arg0="
    const nextReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review&arg0="
    const addProgressXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'add progress update', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=pause%20project%20toggle&arg0="
    const pauseXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'pause project toggle', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=pause%20project%20toggle&arg0="
    const completeXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'complete project', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=complete%20project&arg0="
    const cancelXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'cancel project', '') //"noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=cancel%20project&arg0="

    // style the x-callback URLs into markdown 'button' links
    const reviewedXCallbackButton = `[Finish](${reviewedXCallbackURL})`
    const nextReviewXCallbackButton = `[Finish + Next](${nextReviewXCallbackURL})`
    const addProgressXCallbackButton = `[Add progress](${addProgressXCallbackURL})`
    const pauseXCallbackButton = `[toggle Pause](${pauseXCallbackURL})`
    const completeXCallbackButton = `[Complete](${completeXCallbackURL})`
    const cancelXCallbackButton = `[Cancel](${cancelXCallbackURL})`
    const nowDateTime = nowLocaleShortDateTime()

    if (config.noteTypeTags.length > 0) {
      if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]
      // We have defined tag(s) to filter and group by
      for (const tag of config.noteTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const noteTitle = `${tag} Review List`
        const noteTitleWithoutHash = `${tagWithoutHash} Review List`

        // Do the main work
        const note: ?TNote = await getOrMakeNote(noteTitleWithoutHash, config.folderToStore)
        if (note != null) {
          const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'project lists', encodeURIComponent(`{"noteTypeTags":["${tag}"]}`)) //`noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=` + encodeURIComponent(`noteTypeTags=${tag}`)

          // Get the summary line for each revelant project
          const [outputArray, noteCount, due] = await generateReviewOutputLines(tag, 'Markdown', config)
          logTimer('renderProjectListsHTML', funcTimer, `after generateReviewOutputLines(${tag}) for ${String(due)} projects`)

          // print header info just the once (if any notes)
          const startReviewButton = `[Start reviewing ${due} ready for review](${startReviewXCallbackURL})`
          const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

          if (due > 0) {
            outputArray.unshift(`Review: ${reviewedXCallbackButton} ${nextReviewXCallbackButton} Current open project note: ${addProgressXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
          }
          const displayFinished = DataStore.preference('Reviews-DisplayFinished' ?? 'display at end')
          const displayOnlyDue = DataStore.preference('Reviews-DisplayOnlyDue' ?? false)
          let togglesValues = (displayOnlyDue) ? 'showing only projects/areas ready for review' : 'showing all open projects/areas'
          // FIXME:  report that noteCount can be NaN
          togglesValues += (displayFinished === 'hide') ? '' : ' plus finished ones'
          outputArray.unshift(`Total ${noteCount} active projects${due > 0 ? `: **${startReviewButton}**` : ''} (${togglesValues}). Last updated: ${nowDateTime} ${refreshXCallbackButton}`)

          if (!config.displayGroupedByFolder) {
            outputArray.unshift(`### All folders (${noteCount} notes)`)
          }
          outputArray.unshift(`# ${noteTitle}`)

          // Save the list(s) to this note
          note.content = outputArray.join('\n')
          logDebug('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
          // Open the note in a window
          if (shouldOpen && !noteOpenInEditor(note.filename)) {
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
      const note: ?TNote = await getOrMakeNote(noteTitle, config.folderToStore)
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
          outputArray.unshift(`${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
        }
        outputArray.unshift(`Total ${noteCount} active projects${due > 0 ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
        // Open the note in a new window
        // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
        if (!noteOpenInEditor(note.filename)) {
          logDebug('renderProjectListsMarkdown', `- opening note '${noteTitle}' as the note is not already open.`)
          await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
          setEditorWindowId(note.filename, noteTitle)
        } else {
          logDebug('renderProjectListsMarkdown', `- note '${noteTitle}' already open in the editor.`)
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
 * Re-display the project list from saved HTML file, if available, or if not then render the project list.
 * Note: this is a test function that does not re-calculate the data.
 * @author @jgclark
 */
export async function redisplayProjectListHTML(): Promise<void> {
  try {
    // Re-load the saved HTML if it's available.
    // $FlowIgnore[incompatible-type]
    const config: ?ReviewConfig = await getReviewSettings()
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
 * Return summary of notes that contain a specified tag, for all relevant folders, in 'Markdown' or 'Rich' style.
 * V2: Changed to read from the TSV file 'data/full-review-list.md' folder rather than calcuate from scratch.
 * V3: Now doesn't handle output before the main list(s) start. That is now done in the calling function.
 * v4: Changed to read from the allProjects JSON file.
 *     Also added nextAction outputs.
 * @author @jgclark
 *
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} output summary lines
 * @returns {number} number of notes
 * @returns {number} number of due notes (ready to review)
 */
export async function generateReviewOutputLines(noteTag: string, style: string, config: ReviewConfig): Promise<[Array<string>, number, number]> {
  try {
    logDebug('generateReviewOutputLines', `Starting for tag(s) '${noteTag}' in ${style} style`)

    // Read each line in full-review-list
    // const reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    // if (!reviewListContents) {
    //   throw new Error('full-review-list note empty or missing. Please try running "Project Lists" command again.')
    // }

    // Ignore its frontmatter
    // const fmObj = fm(reviewListContents)
    // sort rest by days before next review(first column), ignoring those for a different noteTag than we're after.
    // const reviewLines = fmObj.body.split('\n')

    // Get all wanted projects (in useful order and filtered)
    const projectsToReview = await filterAndSortProjectsList(config)
    let lastFolder = ''
    let noteCount = 0
    let due = 0
    const outputArray: Array<string> = []

    // Process each project
    // Note: this logic is ~ repeated in two funcs near the end of this file.
    // for (const thisLine of reviewLines) {
      // Split each TSV line into its parts
    // const fields = thisLine.split('\t')
    // const title = fields[2]
    // const folder = fields[3] !== '' ? fields[3] : '(root folder)' // root is a special case
    // const tags = fields[4]

    // TEST: have I used this logic in the re-write?
    // // Note: has to be a full not partial match to avoid edge case dupes
    // if (!tags.split(' ').includes(noteTag)) {
    //   continue // go on to next line
    // }

    // Process each project
    for (const thisP of projectsToReview) {
      const thisNote = DataStore.projectNoteByFilename(thisP.filename)
      if (!thisNote) {
        logWarn('generateReviewOutputLines', `Can't find note for filename ${thisP.filename}`)
        continue
      }
      // Build the Project object again
      // TODO: be smarter: re-write generateProjectOutputLine to avoid this
      const thisProject = new Project(thisNote, noteTag, false, config.nextActionTag)
      // Make the summary line
      const out = thisProject.generateProjectOutputLine(style, false, config.displayDates, config.displayProgress, config.displayNextActions)

      // Add to number of notes to review (if appropriate)
      if (!thisProject.isPaused && thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays) && thisProject.nextReviewDays <= 0) {
        due += 1
      }

      // Write new folder header (if change of folder)
      const folder = thisProject.folder
      if (config.displayGroupedByFolder && lastFolder !== folder) {
        let folderPart = config.hideTopLevelFolder
          ? String(folder.split('/').slice(-1)) // just last part. String(...) to satisfy flow
          : folder
        if (folderPart === '/') folderPart = '(root folder)'
        if (style.match(/rich/i)) {
          outputArray.push(`<thead>\n <tr class="section-header-row">  <td colspan=2 class="h3 section-header">${folderPart}</td>`)
          if (config.displayDates) {
            outputArray.push(`  <td>Next Review</td><td>Due Date</td>`)
          } else if (config.displayProgress && config.displayNextActions) {
            outputArray.push(`  <td>Progress and/or Next Action</td>`)
          } else if (config.displayProgress) {
            outputArray.push(`  <td>Progress</td>`)
          } else if (config.displayNextActions) {
            outputArray.push(`  <td>Next Action</td>`)
          }
          outputArray.push(` </tr>\n</thead>\n\n<tbody>`)
        } else if (style.match(/markdown/i)) {
          outputArray.push(`### ${folderPart}`)
        }
      }

      outputArray.push(out)
      noteCount++

      lastFolder = folder
    }
    return [outputArray, noteCount, due]
  } catch (error) {
    logError('generateReviewOutputLines', `${error.message}`)
    return [[], NaN, NaN] // for completeness
  }
}

// --------------------------------------------------------------------

/**
 * Start a series of project reviews.
 * This starts by generating a new machine-readable list of project-type notes ready
 * for review, ordered by oldest next review date.
 * Then offers to load the first note to review.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Make/update list of projects ready for review
    // await makeFullReviewList(config, true)
    await generateAllProjectsList(config, true)

    // Now offer first review
    const noteToReview = await getNextNoteToReview()
    // Open that note in editor
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logInfo('startReviews', `Opening '${displayTitle(noteToReview)}' note to review ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  } catch (error) {
    logError('startReviews', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete the current review
 * TEST: following change to allProjects
 * @author @jgclark
 */
export async function finishReview(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const currentNote = Editor // note: not Editor.note
    if (currentNote && currentNote.type === 'Notes') {
      logInfo(pluginJson, `finishReview: Starting with Editor ${displayTitle(currentNote)}`)
      const thisNoteAsProject = new Project(currentNote)

      const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
      // const RE_REVIEWED_MENTION = new RegExp(`${reviewedMentionStr}\\(${RE_DATE}\\)`, 'gi')
      const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`
      // logDebug('finishReview', String(RE_REVIEWED_MENTION))

      // First update @review(date) on current open note
      let res: ?TNote = await updateMetadataInEditor([reviewedTodayString])
      // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
      res = await deleteMetadataMentionInEditor([config.nextReviewMentionStr])
      // logDebug('finishReview', `- after metadata updates`)

      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() or equivalent here, rather than in the above functions, seems to work
      await saveEditorToCache(null)

      // Note: I haven't tried loading a new Project instance here

      // Then update the Project instance
      thisNoteAsProject.reviewedDate = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      thisNoteAsProject.calcNextReviewDate()
      logDebug('finishReview', `- mSL='${thisNoteAsProject.TSVSummaryLine()}'`)

      // Also update the full-review-list
      await updateProjectsListAfterChange(currentNote.filename, false, config)

      // Update list for user (but don't focus)
      await renderProjectLists(config, false)
    } else {
      logWarn('finishReview', `- There's no project note in the Editor to finish reviewing.`)
    }
  } catch (error) {
    logError('finishReview', error.message)
  }
}

/**
 * Complete review of the given note
 * Note: Used by Dashboard
 * * TEST: following change to allProjects
 * @author @jgclark
 * @param {TNote} noteIn
 */
export async function finishReviewForNote(noteToUse: TNote): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    if (noteToUse && noteToUse.type === 'Notes') {
      logInfo(pluginJson, `finishReviewForNote: Starting for passed note '${displayTitle(noteToUse)}'`)
      const thisNoteAsProject = new Project(noteToUse)

      const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
      // const RE_REVIEWED_MENTION = new RegExp(`${reviewedMentionStr}\\(${RE_DATE}\\)`, 'gi')
      const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`
      // logDebug('finishReviewForNote', String(RE_REVIEWED_MENTION))

      // First update @review(date) on current open note
      await updateMetadataInNote(noteToUse, [reviewedTodayString])
      // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
      await deleteMetadataMentionInNote(noteToUse, [config.nextReviewMentionStr])
      // logDebug('finishReviewForNote', `- after metadata updates`)

      // Save changes

      // Note: I haven't tried loading a new Project instance here

      // Then update the Project instance
      thisNoteAsProject.reviewedDate = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      thisNoteAsProject.calcNextReviewDate()
      logDebug('finishReviewForNote', `- mSL='${thisNoteAsProject.TSVSummaryLine()}'`)

      // Also update the full-review-list
      await updateProjectsListAfterChange(noteToUse.filename, false, config)

      // Update list for user (but don't focus)
      await renderProjectLists(config, false)
    } else {
      logWarn('finishReviewForNote', `- There's no valid project note to finish reviewing.`)
    }
  } catch (error) {
    logError('finishReviewForNote', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then open the next one to review in the Editor.
 * * TEST: following change to allProjects
 * @author @jgclark
 */
export async function finishReviewAndStartNextReview(): Promise<void> {
  try {
    logDebug('finishReviewAndStartNextReview', `Starting`)
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Finish review
    await finishReview()
    // This also:
    // updates the full-review-list = updateProjectsListAfterChange(...)
    // Update list for user (but don't focus) = renderProjectLists(...)

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
      logDebug('finishReviewAndStartNextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
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
 * Skip the next review for the note open in the Editor, asking when to delay to, add that as a @nextReview() date, and jump to next project to review.
 * * TEST: following change to allProjects
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 */
export async function skipReview(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const currentNote = Editor
    if (!currentNote || currentNote.type !== 'Notes') {
      logWarn('skipReview', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
    }

    logDebug(pluginJson, `skipReview: Starting for ${displayTitle(currentNote)}`)
    const thisNoteAsProject = new Project(currentNote)

    // Ask for new date
    const reply = await getInputTrimmed("Next review date (YYYY-MM-DD) or date interval (e.g. '2w' or '3m') to skip until:", 'OK', 'Skip next review')
    if (!reply || typeof reply === 'boolean') {
      logDebug('skipReview', `User cancelled command.`)
      return
    }
    // Get new date from input in the common ISO format, and create new metadata `@nextReview(date)`. Note: different from `@reviewed(date)` below.
    const newDateStr: string = reply.match(RE_DATE)
      ? reply
      : reply.match(RE_DATE_INTERVAL)
        ? calcOffsetDateStr(todaysDateISOString, reply)
        : ''
    if (newDateStr === '') {
      logWarn('skipReview', `No valid date entered, so will stop.`)
      return
    }
    const nextReviewDate = getDateObjFromDateString(newDateStr)
    const nextReviewMetadataStr = `${config.nextReviewMentionStr}(${newDateStr})`
    logDebug('skipReview', `- nextReviewDate: ${String(nextReviewDate)} / nextReviewMetadataStr: ${nextReviewMetadataStr}`)

    // Update metadata in the current open note
    const res = await updateMetadataInEditor([nextReviewMetadataStr])

    // Save Editor, so the latest changes can be picked up elsewhere
    // Putting the Editor.save() here, rather than in the above functions, seems to work
    await saveEditorToCache(null)

    // Update the full-review-list too
    thisNoteAsProject.nextReviewDateStr = newDateStr
    thisNoteAsProject.nextReviewDate = nextReviewDate
    thisNoteAsProject.calcDurations()
    thisNoteAsProject.calcNextReviewDate()
    logDebug('calcNextReviewDate', `-> reviewedDate = ${String(thisNoteAsProject.reviewedDate)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDate = ${String(thisNoteAsProject.nextReviewDate)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
    const newMSL = thisNoteAsProject.TSVSummaryLine()
    logDebug('skipReview', `- updatedTSVSummaryLine => '${newMSL}'`)
    await updateProjectsListAfterChange(currentNote.filename, false, config, newMSL)
    // Update list for user
    await renderProjectLists(config)

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
 * * TEST: following change to allProjects
 * Note: skipReview() is an interactive version of this for Editor.note
 * @author @jgclark
 */
export async function skipReviewForNote(note: TNote, skipIntervalOrDate: string): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    if (!note || note.type !== 'Notes') {
      logWarn('skipReview', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
    }
    logDebug(pluginJson, `skipReviewForNote: Starting for ${displayTitle(note)} with ${skipIntervalOrDate}`)

    const thisNoteAsProject = new Project(note)

    // Get new date from parameter as date interval or iso date 
    const newDateStr: string = skipIntervalOrDate.match(RE_DATE_INTERVAL)
      ? calcOffsetDateStr(todaysDateISOString, skipIntervalOrDate)
      : skipIntervalOrDate.match(RE_DATE)
        ? skipIntervalOrDate
        : ''
    if (newDateStr === '') {
      logWarn('skipReviewForNote', `${skipIntervalOrDate} is not a valid interval, so will stop.`)
      return
    }

    // create new metadata`@nextReview(date)`. Note: different from `@reviewed(date)` below.
    const nextReviewDate = getDateObjFromDateString(newDateStr)
    const nextReviewMetadataStr = `${config.nextReviewMentionStr}(${newDateStr})`
    logDebug('skipReviewForNote', `- nextReviewDate: ${String(nextReviewDate)} / nextReviewMetadataStr: ${nextReviewMetadataStr}`)

    // Update metadata in that note
    await updateMetadataInNote(note, [nextReviewMetadataStr])

    // Update the full-review-list too
    thisNoteAsProject.nextReviewDateStr = newDateStr
    thisNoteAsProject.nextReviewDate = nextReviewDate
    thisNoteAsProject.calcDurations()
    thisNoteAsProject.calcNextReviewDate()
    logDebug('skipReviewForNote', `-> reviewedDate = ${String(thisNoteAsProject.reviewedDate)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDate = ${String(thisNoteAsProject.nextReviewDate)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
    const newMSL = thisNoteAsProject.TSVSummaryLine()
    logDebug('skipReviewForNote', `- updatedTSVSummaryLine => '${newMSL}'`)
    await updateProjectsListAfterChange(note.filename, false, config, newMSL)

    // Update list window for user (if already open)
    await renderProjectLists(config, false)
  } catch (error) {
    logError('skipReviewForNote', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Set a new review interval the note open in the Editor, by asking user.
 * * TEST: following change to allProjects
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function setNewReviewInterval(noteArg?: TNote): Promise<void> {
  try {
    logDebug('setNewReviewInterval', `Starting for ${noteArg ? 'passed note (' + noteArg.filename + ')' : 'Editor'}`)
    const currentNote: TNote = noteArg ? noteArg : Editor
    if (!currentNote || currentNote.type !== 'Notes') {
      throw new Error(`Not in a Project note (at least 2 lines long)`)
    }
    const thisNoteAsProject = new Project(currentNote)

    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Ask for new date interval
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
    logDebug('setNewReviewInterval', `- intervals: existing = ${thisNoteAsProject.reviewInterval ?? '-'} / new = ${newIntervalStr}`)

    // Update metadata in the current open note in Editor, or the given note
    if (!noteArg) {
      logDebug('setNewReviewInterval', `- updating metadata in Editor`)
      const res = await updateMetadataInEditor([`@review(${newIntervalStr})`])
      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorToCache(null)
    } else {
      logDebug('setNewReviewInterval', `- updating metadata in note`)
      const res = await updateMetadataInNote(currentNote, [`@review(${newIntervalStr})`])
    }

    // Update the full-review-list too
    thisNoteAsProject.reviewInterval = newIntervalStr
    thisNoteAsProject.calcDurations()
    thisNoteAsProject.calcNextReviewDate()
    logDebug('setNewReviewInterval', `-> reviewInterval = ${String(thisNoteAsProject.reviewInterval)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDate = ${String(thisNoteAsProject.nextReviewDate)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
    // FIXME: check implication of removing newMSL
    const newMSL = thisNoteAsProject.TSVSummaryLine()
    logDebug('setNewReviewInterval', `- updatedTSVSummaryLine => '${newMSL}'`)
    await updateProjectsListAfterChange(currentNote.filename, false, config)

    // Update list for user (if open)
    await renderProjectLists(config, false)
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
    logDebug('toggleDisplayFinished', `starting with pref='${String(DataStore.preference('Reviews-DisplayFinished') ?? '(not set))')}' ...`)
    logDebug('toggleDisplayFinished', typeof DataStore.preference('Reviews-DisplayFinished'))
    const savedValue = DataStore.preference('Reviews-DisplayFinished' ?? false)
    const newValue = !savedValue
    logDebug('toggleDisplayFinished', `displayFinished? toggled to ${String(newValue)}`)

    // FIXME: Need to add a settings.json updater here
    DataStore.setPreference('Reviews-DisplayFinished', newValue)
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    await renderProjectLists(config, true)
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
    logDebug('toggleDisplayOnlyDue', `starting with pref='${String(DataStore.preference('Reviews-DisplayOnlyDue') ?? '(not set))')}' ...`)
    logDebug('toggleDisplayFinished', typeof DataStore.preference('Reviews-DisplayOnlyDue'))
    const savedValue = DataStore.preference('Reviews-DisplayOnlyDue' ?? false)
    const newValue = !savedValue
    logDebug('toggleDisplayOnlyDue', `DisplayOnlyDue? toggled to ${String(newValue)}`)

    // FIXME: Need to add a settings.json updater here
    DataStore.setPreference('Reviews-DisplayOnlyDue', newValue)
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    await renderProjectLists(config, true)
  }
  catch (error) {
    logError('toggleDisplayOnlyDue', error.message)
  }
}
