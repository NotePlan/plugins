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
// Last updated 26.12.2023 for v0.13.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter'
import { checkForWantedResources, logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import { getOrMakeMetadataLine, getReviewSettings, makeFakeButton, Project, saveEditorToCache } from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import { calcOffsetDate, calcOffsetDateStr, getDateObjFromDateString, getJSDateStartOfToday, getTodaysDateHyphenated, hyphenatedDateString, RE_DATE, RE_DATE_INTERVAL, todaysDateISOString } from '@helpers/dateTime'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { type HtmlWindowOptions, makeSVGPercentRing, redToGreenInterpolation, showHTML, showHTMLV2 } from '@helpers/HTMLView'
import { getOrMakeNote } from '@helpers/note'
import { findNotesMatchingHashtag } from '@helpers/NPnote'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { fieldSorter, sortListBy } from '@helpers/sorting'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'
import { focusHTMLWindowIfAvailable, isHTMLWindowOpen, logWindowsList, noteOpenInEditor, setEditorWindowId, setHTMLWindowId } from '@helpers/NPWindows'

//-----------------------------------------------------------------------------

// Settings
const pluginID = 'jgclark.Reviews'
const fullReviewListFilename = 'full-review-list.md'
const windowTitle = `Review List`
const filenameHTMLCopy = '../../jgclark.Reviews/review_list.html'
const customRichWinId = `${pluginID}.rich-review-list`
const customMarkdownWinId = `markdown-review-list`
// const reviewListPref = `${pluginID}.reviewList`
// const fullReviewJSONFilename = 'full-review-list.json'

//-------------------------------------------------------------------------------

const faLinksInHeader = `
<!-- Load in Project List-specific CSS -->
<link href="projectList.css" rel="stylesheet">

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

/**
 * TODO: this would need to go in commsSwitchboard.js. And contents uncommented out.
 * Event handler for the 'change' event on a checkbox
 * @param {string} settingName of checkbox
 * @param {boolean} state that it now has
 */
function onChangeCheckbox(settingName: string, state: boolean) {
  // const data = { settingName, state }
  // console.log(`onChangeCheckbox received: settingName: ${data.settingName}, state: ${String(data.state)}; sending 'onChangeCheckbox' to plugin`)
  // sendMessageToPlugin('onChangeCheckbox', data) // actionName, data
}


// TODO: in time make a 'timeago' relative display, e.g. using MOMENT moment.duration(-1, "minutes").humanize(true); // a minute ago
// or https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html
// or https://theprogrammingexpert.com/javascript-count-up-timer/
export const timeAgoClockJSFunc: string = `
<script type="text/javascript">
function timeAgo() {
  const startTime = document.getElementsByName('startTime')[0].getAttribute('content'); // Get startTime from meta tag
  const now = Date.now();
	const diff = (Math.abs(now - startTime)/1000.0/60.0);  // in Mins
	if (diff === 0) {
		output = 'just now';
	} else if (diff <= 90) {
		output = String(diff) + ' mins';
	} else if (diff <= 1440) {
		output = String(Math.round(diff / 60.0)) + ' hours';
	} else if (diff <= 43776) {
		output = String(Math.round(diff / 60.0 / 24.0)) + ' days';
	} else if (diff <= 525312) {
		output = String(Math.round(diff / 60.0 / 24.0 / 30.4)) + ' mon';
	} else {
		output = String(Math.round(diff / 60.0 / 24.0 / 30.4 / 365.0)) + ' yrs';
	}
  document.getElementById('timer').innerHTML = output + ' ago';
  setTimeout(startTime, 5000);
}
</script>`

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
 * @param {string | null} arguments as JSON
 * @param {number?} scrollPos in pixels (optional, for HTML only)
 */
export async function makeProjectLists(argsIn?: string | null = null, scrollPos: number = 1000): Promise<void> {
  try {
    let args = argsIn?.toString() || ''
    logDebug(pluginJson, `makeProjectLists: starting with JSON args <${args}> and scrollPos ${String(scrollPos)}`)
    let config = await getReviewSettings()
    if (args !== '') {
      config = overrideSettingsWithEncodedTypedArgs(config, args)
      // clo(config, 'Review settings updated with args:')
    } else {
      // clo(config, 'Review settings with no args:')
    }

    // Re-calculate the full-review-list (in foreground)
    await makeFullReviewList(config, true)

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
  config: any,
  shouldOpen: boolean = true,
  scrollPos: number = 0
): Promise<void> {
  try {
    // clo(config, 'config at start of renderProjectLists:')
    logDebug('renderProjectLists', `Started with displayOnlyOverdue? ${String(config.displayOnlyOverdue ?? '(error)')} displayFinished? ${String(config.displayFinished ?? '(error)')}`)

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

    logDebug('renderProjectListsHTML', `>> after checkForWantedResources and before possible makeFullReviewList: ${timer(funcTimer)}`)

    // Ensure noteTypeTags is an array before proceeding
    if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]

    // String array to save all output
    let outputArray = []

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
    const refreshXCallbackButton = makeFakeButton(
      `<i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh`,
      'project lists',
      '',
      'Recalculate project lists and update this window',
    )
    const startReviewButton = makeFakeButton(
      `<i class="fa-solid fa-play"></i>\u00A0Start\u00A0Reviews`,
      'start reviews',
      '',
      'Opens the next project to review in the NP editor',
    )
    const reviewedXCallbackButton = makeFakeButton(
      `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish\u00A0Review`,
      'finish project review',
      '',
      `Update the ${checkString(DataStore.preference('reviewedMentionStr'))}() date for the Project you're currently editing`,
    )
    const nextReviewXCallbackButton = makeFakeButton(
      `<i class="fa-regular fa-calendar-check"></i>\u00A0Finish\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next\u00A0Review`,
      'next project review',
      '',
      `Finish review of currently open Project and start the next review`,
    )
    const updateProgressXCallbackButton = makeFakeButton(
      `\u00A0<i class="fa-regular fa-message-pen"></i>\u00A0Add Progress`,
      'add progress update',
      '',
      'Add a progress line to the currently open Project note',
    )
    const pauseXCallbackButton = makeFakeButton(
      `Toggle\u00A0<i class="fa-solid fa-play-pause"></i>\u00A0Pause`,
      'pause project toggle',
      '',
      'Pause the currently open Project note',
    )
    const completeXCallbackButton = makeFakeButton(
      `<i class="fa-solid fa-check"></i>\u00A0Complete`,
      'complete project',
      '',
      'Complete the currently open Project note',
    )
    const cancelXCallbackButton = makeFakeButton(
      `<i class="fa-solid fa-xmark"></i>\u00A0Cancel`,
      'cancel project',
      '',
      'Cancel the currently open Project note'
    )
    const skipReviewXCallbackButton = makeFakeButton(`<i class="fa-solid fa-forward"></i>\u00A0Skip\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next\u00A0Review`,
      'skip project review',
      '',
      'Skip this Project review and select new date')

    // write lines before first table
    outputArray.push(`<h1>${windowTitle}</h1>`)
    // Add a sticky area for buttons
    let controlButtons = `<b>Reviews</b>: ${startReviewButton} \n${reviewedXCallbackButton} \n${nextReviewXCallbackButton}\n${skipReviewXCallbackButton}\n<br /><b>List</b>: \n${refreshXCallbackButton} \n<b>Project</b>: ${updateProgressXCallbackButton} ${pauseXCallbackButton} \n${completeXCallbackButton} \n${cancelXCallbackButton}`
    // TODO: remove test lines to see scroll position:
    // controlButtons += ` <input id="id" type="button" value="Update Scroll Pos" onclick="getCurrentScrollHeight();"/>`
    // controlButtons += ` <span id="scrollDisplay" class="fix-top-right">?</span>`
    outputArray.push(`<div class="sticky-box-top-middle">\n${controlButtons}\n</div>\n`)

    // Show date + display settings
    const displayFinished = DataStore.preference('Reviews-DisplayFinished' ?? 'display at end')
    const displayOnlyOverdue = DataStore.preference('Reviews-DisplayOnlyOverdue' ?? false)
    // v1: text labels
    let togglesValues = (displayOnlyOverdue) ? 'showing only projects/areas overdue for review' : 'showing all open projects/areas'
    togglesValues += (displayFinished === 'hide') ? '' : ', plus finished ones'
    // v1: simple text
    outputArray.push(`<p>Last updated: <span id="timer">${nowLocaleShortDateTime()}</span> (${togglesValues})</p>`)

    // v2: TODO: working on HTML checkbox toggles
    // // Note: capitalised start of checkbox names: to make it possible to simply prepend 'toggle' to get to name of controlling function.
    // outputArray.push(`<ul>`)
    // outputArray.push(`  <li>Last updated: <span id="timer">${nowLocaleShortDateTime()}</span></li>`)
    // // Proper checkboxes don't work at all easily ...
    // // outputArray.push(` <li><input type="checkbox" class="apple-switch" onchange='handleCheckboxClick(this);' name="DisplayOnlyOverdue" ${displayOnlyOverdue ? "checked" : "unchecked"}><label for="DisplayOnlyOverdue">Show only overdue items?</label></input></span></li>\n`)
    // // outputArray.push(` <li><input type="checkbox" class="apple-switch" onchange='handleCheckboxClick(this);' name="DisplayFinished" ${displayFinished ? "checked" : "unchecked"}><label for="DisplayFinished">Also show finished items?</label></input></span></li>\n`)
    // // ... so will use fake ones
    // outputArray.push(` <li><a class="fake-checkbox" id="DisplayOnlyOverdue" href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=toggleDisplayOnlyOverdue">Show only overdue items? (${displayOnlyOverdue ? "checked" : "unchecked"})</a></li>\n`)
    // outputArray.push(` <li><a class="fake-checkbox" id="DisplayFinished" href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=toggleDisplayFinished">??? Show finished items? (${displayFinished ? "checked" : "unchecked"})</a></li>\n`)
    // outputArray.push(`</ul>`)

    // Allow multi-col working
    outputArray.push(`<div class="multi-cols">`)

    logDebug('renderProjectListsHTML', `>> before main loop: ${timer(funcTimer)}`)

    // Make the Summary list, for each noteTag in turn
    let tagCount = 0
    for (const thisTag of config.noteTypeTags) {
      // Get the summary line for each revelant project
      const [thisSummaryLines, noteCount, overdue] = await generateReviewSummaryLines(thisTag, 'Rich', config)

      // Write out all relevant HTML
      outputArray.push('')
      outputArray.push(`<h2>${thisTag}: ${noteCount} notes, ${overdue} ready for review</h2>`)
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
\t<col style="width: 3rem">
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
      tagCount++
      logDebug('renderProjectListsHTML', `>> end of loop for ${thisTag}: ${timer(funcTimer)}`)
    }
    outputArray.push(`</div>`)
    const body = outputArray.join('\n')
    logDebug('renderProjectListsHTML', `>> end of main loop: ${timer(funcTimer)}`)

    const setScrollPosJS: string = `<script type="text/javascript">
  console.log('Attemping to set scroll pos to ${scrollPos}');
  setScrollPos(${scrollPos});
  console.log('Attemping to set scroll pos for refresh button to ${scrollPos}');
  setRefreshButtonURL(${scrollPos});
</script>`

    const winOptions = {
      windowTitle: windowTitle,
      headerTags: faLinksInHeader + `\n<meta name="startTime" content="${String(Date.now())}">`,
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: '', // now in requiredFiles/reviewListCSS instead
      makeModal: false, // = not modal window
      bodyOptions: '', // TODO: find a different way to get this working 'onload="timeAgo()"',
      preBodyScript: setPercentRingJSFunc + scrollPreLoadJSFuncs,
      postBodyScript: checkboxHandlerJSFunc + setScrollPosJS, // timeAgoClockJSFunc, // resizeListenerScript + unloadListenerScript,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 800, // = default width of window (px)
      height: 1200, // = default height of window (px)
      customId: customRichWinId,
      shouldFocus: true, // shouuld not focus, if Window already exists
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
          const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'project lists', encodeURIComponent(`noteTypeTags=${tag}`)) //`noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=` + encodeURIComponent(`noteTypeTags=${tag}`)

          // Get the summary line for each revelant project
          const [outputArray, noteCount, overdue] = await generateReviewSummaryLines(tag, 'Markdown', config)
          logDebug('renderProjectListsHTML', `>> after generateReviewSummaryLines(${tag}) for ${String(overdue)} projects: ${timer(funcTimer)}`)

          // print header info just the once (if any notes)
          const startReviewButton = `[Start reviewing ${overdue} ready for review](${startReviewXCallbackURL})`
          const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

          if (overdue > 0) {
            outputArray.unshift(`Review: ${reviewedXCallbackButton} ${nextReviewXCallbackButton} Current open project note: ${addProgressXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
          }
          const displayFinished = DataStore.preference('Reviews-DisplayFinished' ?? 'display at end')
          const displayOnlyOverdue = DataStore.preference('Reviews-DisplayOnlyOverdue' ?? false)
          let togglesValues = (displayOnlyOverdue) ? 'showing only projects/areas overdue for review' : 'showing all open projects/areas'
          togglesValues += (displayFinished === 'hide') ? '' : 'plus finished ones'
          outputArray.unshift(`Total ${noteCount} active projects${overdue > 0 ? `: **${startReviewButton}**` : '.'} (${togglesValues}.) Last updated: ${nowDateTime} ${refreshXCallbackButton}`)

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
        const [outputArray, noteCount, overdue] = await generateReviewSummaryLines('', 'Markdown', config)
        const startReviewButton = `[Start reviewing ${overdue} ready for review](${startReviewXCallbackURL})`
        logDebug('renderProjectListsHTML', `>> after generateReviewSummaryLines: ${timer(funcTimer)}`)

        const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'project lists', '') //`noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=`
        const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`### All folders (${noteCount} notes)`)
        }
        if (overdue > 0) {
          outputArray.unshift(`${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
        }
        outputArray.unshift(`Total ${noteCount} active projects${overdue > 0 ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
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
    logDebug('renderProjectListsMarkdown', `>> end at ${timer(funcTimer)}`)
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
    // const config = await getReviewSettings()
    // Try loading HTML saved copy
    const savedHTML = DataStore.loadData(filenameHTMLCopy, true) ?? ''
    if (savedHTML !== '') {
      const winOptions = {
        windowTitle: windowTitle,
        headerTags: faLinksInHeader + `\n<meta name="startTime" content="${String(Date.now())}">`,
        generalCSSIn: '', // get general CSS set automatically
        specificCSS: '', // now provided by separate projectList.css
        makeModal: false, // = not modal window
        bodyOptions: '', // TODO: find a different way to get this working  'onload="timeAgo()"',
        preBodyScript: setPercentRingJSFunc,
        postBodyScript: checkboxHandlerJSFunc, // timeAgoClockJSFunc, // resizeListenerScript + unloadListenerScript,
        savedFilename: savedHTML,
        reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
        width: 800, // = default width of window (px)
        height: 1200, // = default height of window (px)
        customId: customRichWinId,
        shouldFocus: true, // shouuld not focus, if Window already exists
      }
      const thisWindow = await showHTMLV2(savedHTML, winOptions)
      clo(thisWindow, 'created window')
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
 * @author @jgclark
 *
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} output summary lines
 * @returns {number} number of notes
 * @returns {number} number of overdue notes (ready to review)
 */
async function generateReviewSummaryLines(noteTag: string, style: string, config: any): Promise<[Array<string>, number, number]> {
  try {
    logDebug('generateReviewSummaryLines', `Starting for tag(s) '${noteTag}' in ${style} style`)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // Read each line in full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      // await makeFullReviewList(config, true)
      // reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      // if (!reviewListContents) {
        // If still no luck, throw an error
      throw new Error('full-review-list note empty or missing. Please try running "Project Lists" command again.')
      // }
    }

    // Ignore its frontmatter and sort rest by days before next review (first column), ignoring those for a different noteTag than we're after.
    const fmObj = fm(reviewListContents)
    let reviewLines = fmObj.body.split('\n').filter((f) => f.match(noteTag))

    let lastFolder = ''
    // Process each line in the file
    for (let thisLine of reviewLines) {
      // Split each TSV line into its parts
      const fields = thisLine.split('\t')
      const title = fields[2]
      const folder = fields[3] !== '' ? fields[3] : '(root folder)' // root is a special case

      // If displayOnlyOverdue, then filter out non-overdue
      const displayOnlyOverdue = DataStore.preference('Reviews-DisplayOnlyOverdue' ?? false)
      if (displayOnlyOverdue && fields[0] >= 0) {
        logDebug('generateReviewSummaryLines', `ignoring ${title} as not overdue`)
        continue
      }

      const notes = DataStore.projectNoteByTitle(title)
      if (notes == null || notes.length === 0) {
        logWarn('generateReviewSummaryLines', `No note found matching title '${title}'; skipping.`)
        continue // go on to next line
      }
      const thisProject = new Project(notes[0])

      const out = thisProject.detailedSummaryLine(style, false, config.displayDates, config.displayProgress)

      // Add to number of notes to review (if appropriate)
      if (!thisProject.isPaused && thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays) && thisProject.nextReviewDays <= 0) {
        overdue += 1
      }

      // Write new folder header (if change of folder)
      if (config.displayGroupedByFolder && lastFolder !== folder) {
        let folderPart = config.hideTopLevelFolder
          ? String(folder.split('/').slice(-1)) // just last part. String(...) to satisfy flow
          : folder
        if (folderPart === '/') folderPart = '(root folder)'
        if (style.match(/rich/i)) {
          outputArray.push(`<thead>\n <tr class="section-header-row">  <td colspan=2 class="h3 section-header">${folderPart}</td>`)
          if (config.displayDates) {
            outputArray.push(`  <td>Next Review</td><td>Due Date</td>`)
          } else if (config.displayProgress) {
            outputArray.push(`  <td>Progress</td>`)
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
    return [outputArray, noteCount, overdue]
  } catch (error) {
    logError('generateReviewSummaryLines', `${error.message}`)
    return [[], NaN, NaN] // for completeness
  }
}

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export async function logFullReviewList(): Promise<void> {
  const content = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
  console.log(`Contents of ${fullReviewListFilename}:\n${content}`)
}

/**
 * Generate machine-readable list of all project-type notes,
 * ordered by the setting 'displayOrder', optionally also pre-ordered by 'folder'.
 * This is V3, which uses Plugins/data/jgclark.Reviews/full-review-list.md to store the list
 * @author @jgclark
 * @param {any} configIn
 * @param {boolean} runInForeground?
 */
export async function makeFullReviewList(configIn: any, runInForeground: boolean = false): Promise<void> {
  try {
    const config = configIn ? configIn : await getReviewSettings() // get config from passed config if possible
    logDebug('makeFullReviewList', `Starting for ${String(config.noteTypeTags)} tags, running in ${runInForeground ? 'foreground' : 'background'}`)
    let startTime = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

    // Get list of folders, excluding @specials and our foldersToIgnore setting
    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore, true, config.foldersToInclude, true).sort()
    // For filtering DataStore, no need to look at folders which are in other folders on the list already
    const filteredFolderListWithoutSubdirs = filteredFolderList.reduce((acc: Array<string>, f: string) => {
      const exists = acc.some((s) => f.startsWith(s))
      if (!exists) acc.push(f)
      return acc
    }, [])
    // logDebug('makeFullReviewList', `filteredFolderListWithoutSubdirs: ${String(filteredFolderListWithoutSubdirs)}`)

    // filter DataStore one time, searching each item to see if it startsWith an item in filterFolderList
    // but need to deal with ignores here because of this optimization (in case an ignore folder is inside an included folder)
    // TODO: make the excludes an includes not startsWith
    let filteredDataStore = DataStore.projectNotes.filter(
      (f) => filteredFolderListWithoutSubdirs.some((s) => f.filename.startsWith(s)) && !config.foldersToIgnore.some((s) => f.filename.includes(`${s}/`.replace('//', '/')))
    )
    // Above ignores root notes, so now need to add them (if we have '/' folder)
    if (filteredFolderListWithoutSubdirs.includes('/')) {
      const rootNotes = DataStore.projectNotes.filter((f) => !f.filename.includes('/'))
      filteredDataStore = filteredDataStore.concat(rootNotes)
      // logDebug('makeFullReviewList', `Added root folder notes: ${rootNotes.map((n) => n.title).join(' / ')}`)
    }

    logDebug(`makeFullReviewList`, `>> filteredDataStore: ${filteredDataStore.length} potential project notes in ${timer(startTime)}`)

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating Project Review list`)
      // TODO: work out what to do about this: currently commented this out as it gives warnings because Editor is accessed.
      // await CommandBar.onAsyncThread()
    }

    // Iterate over the folders, using settings from config.foldersToProcess and config.foldersToIgnore list
    const projectInstances = []
    for (const folder of filteredFolderList) {
      // Either we have defined tag(s) to filter and group by, or just use []
      const tags = config.noteTypeTags != null && config.noteTypeTags.length > 0 ? config.noteTypeTags : []

      // Get notes that include noteTag in this folder, ignoring subfolders
      // Note: previous method using (plural) findNotesMatchingHashtags can't distinguish between a note with multiple tags of interest
      for (const tag of tags) {
        let funcTimer = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
        const projectNotesArr = findNotesMatchingHashtag(tag, folder, false, [], true, filteredDataStore, false)
        logDebug('makeFullReviewList', `>> findNotesMatchingHashtag(${tag}, ${folder}): ${timer(funcTimer)}`)
        if (projectNotesArr.length > 0) {
          // Get Project class representation of each note.
          // Save those which are ready for review in projectsReadyToReview array
          for (const n of projectNotesArr) {
            const np = new Project(n, tag) // specifying tag in case the note has more than 1 tag
            projectInstances.push(np)
          }
        }
      }
    }
    logDebug('makeFullReviewList', `>> Finding notes: ${timer(startTime)}`)
    if (runInForeground) {
      // await CommandBar.onMainThread()
      CommandBar.showLoading(false)
    }

    // Get machineSummaryLine for each of the projectInstances
    let reviewLines: Array<string> = []
    // let lineArrayObjs = []
    for (const p of projectInstances) {
      const mSL = p.machineSummaryLine()
      reviewLines.push(mSL)
    }

    // sort the output list by the fields we want, and add frontmatter
    startTime = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const outputArray = filterAndSortReviewList(reviewLines, config)

    // write summary to full-review-list file
    DataStore.saveData(outputArray.join('\n'), fullReviewListFilename, true)

    logDebug(`makeFullReviewList`, `- written ${outputArray.length} lines to ${fullReviewListFilename}`)

    // Finally, refresh Dashboard. Note: Designed to fail silently if it isn't installed, or open.
    // DataStore.invokePluginCommand('refreshDashboard', '')
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'refreshDashboard', '')
    logDebug('makeFullReviewList', `sent message to refresh Dashboard: ${refreshXCallbackURL}`)
    await NotePlan.openURL(refreshXCallbackURL)

  } catch (error) {
    logError(pluginJson, `makeFullReviewList: ${error.message}`)
  }
}

/**
 * Take a set of machineSummaryLines, filter if required by 'displayFinished' setting, sort them according to config, and then add frontmatter
 * TODO: this isn't a very sensible way of operating: in/out of TSV.
 * @param {Array<string>} linesIn
 * @param {any} config
 * @returns {Array<string>} outputArray
 */
function filterAndSortReviewList(linesIn: Array<string>, config: any): Array<string> {
  try {
    logDebug('filterAndSortReviewList', `Starting with ${linesIn.length} lines`)
    const outputArray = []
    let lineArrayObjs = []

    // turn each TSV string into an object
    for (const line of linesIn) {
      const fields = line.split('\t')
      lineArrayObjs.push({
        reviewDays: fields[0],
        dueDays: fields[1],
        title: fields[2],
        folder: fields[3],
        tags: fields[4],
        state: fields[5],
      })
    }

    // Filter out finished projects if required
    const displayFinished = DataStore.preference('Reviews-DisplayFinished' ?? 'display at end')
    if (displayFinished === 'hide') {
      lineArrayObjs = lineArrayObjs.filter((lineObj) => !lineObj.state.match('finished'))
    }

    // Sort projects
    // Method 3: use DW fieldSorter() function
    // Requires turning each TSV line into an Object (above)
    const sortingSpecification = []
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('reviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }
    if (displayFinished === 'display at end') {
      sortingSpecification.push('state') // i.e. 'active' before 'finished'
    }

    // Method 2: use lodash _.orderBy() function
    // Requires turning each TSV line into an Object (above)
    // Note: Crashes for some reason neither DW or I can understand.
    // clo(lineArrayObjs, "Before orderBy")
    // if (lineArrayObjs) {
    //   lineArrayObjs = orderBy(lineArrayObjs, ['folder', 'reviewDays'], ['asc', 'asc'])
    //   clo(lineArrayObjs, "After orderBy")
    // }
    // // turn lineArrayObjs back to a TSV string
    // for (let lineObj of lineArrayObjs) {
    //   outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    // }

    logDebug('filterAndSortReviewList', `- sorting by ${String(sortingSpecification)} ...`)
    const sortedlineArrayObjs = sortListBy(lineArrayObjs, sortingSpecification)

    // turn each lineArrayObj back to a TSV string
    for (let lineObj of sortedlineArrayObjs) {
      outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags + '\t' + lineObj.state)
    }

    // Write some metadata to start
    outputArray.unshift('---')
    outputArray.unshift(`key: reviewDays\tdueDays\ttitle\tfolder\ttags\tstate`)
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift('title: full-review-list')
    outputArray.unshift('---')

    return outputArray
  } catch (error) {
    logError('filterAndSortReviewList', error.message)
    return [] // for completeness
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
    const config = await getReviewSettings()

    // Make/update list of projects ready for review
    await makeFullReviewList(config, true)

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
 * @author @jgclark
 */
export async function finishReview(): Promise<void> {
  try {
    const config = await getReviewSettings()
    const currentNote = Editor // note: not Editor.note
    if (currentNote && currentNote.type === 'Notes') {
      logInfo(pluginJson, `finishReview: Starting with Editor ${displayTitle(currentNote)}`)
      const thisNoteAsProject = new Project(currentNote)

      const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
      const RE_REVIEWED_MENTION = new RegExp(`${reviewedMentionStr}\\(${RE_DATE}\\)`, 'gi')
      const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`
      // logDebug('finishReview', String(RE_REVIEWED_MENTION))

      // First update @review(date) on current open note
      let openNote: ?TNote = await updateMetadataInEditor([reviewedTodayString])
      // Remove a @nextReview(date) if there is one, as that is used to skip a review, which is now done.
      openNote = await deleteMetadataMentionInEditor([config.nextReviewMentionStr])
      // logDebug('finishReview', `- after metadata updates`)

      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      // if (NotePlan.environment.buildVersion > 1049) {
      //   await Editor.save()
      // }
      await saveEditorToCache(null)

      // Note: I haven't tried loading a new Project instance here

      // Then update the Project instance
      thisNoteAsProject.reviewedDate = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      thisNoteAsProject.calcNextReviewDate()
      logDebug('finishReview', `- mSL='${thisNoteAsProject.machineSummaryLine()}'`)

      // Also update the full-review-list
      await updateReviewListAfterChange(currentNote.title ?? '', false, config, thisNoteAsProject.machineSummaryLine())

      // Update list for user (but don't focus)
      await renderProjectLists(config, false)
    } else {
      logWarn('finishReview', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
    }
  } catch (error) {
    logError('finishReview', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then open the next one to review in the Editor.
 * @author @jgclark
 */
export async function finishReviewAndStartNextReview(): Promise<void> {
  try {
    logDebug('finishReviewAndStartNextReview', `Starting`)
    const config = await getReviewSettings()

    // Finish review
    await finishReview()

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
 * Skip the next review, asking when to delay to, add that as a @nextReview() date, and jump to next project to review
 * @author @jgclark
 */
export async function skipReview(): Promise<void> {
  try {
    const config = await getReviewSettings()
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
    let newDateStr: string = reply.match(RE_DATE)
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

    // Following not wanted when skipping a review
    // Form updated @review(date) for today
    // const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    // const reviewedTodayMetadataStr = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`

    // Update metadata in the current open note
    const result = await updateMetadataInEditor([nextReviewMetadataStr])

    // Save Editor, so the latest changes can be picked up elsewhere
    // Putting the Editor.save() here, rather than in the above functions, seems to work
    await saveEditorToCache(null)

    // Update the full-review-list too
    thisNoteAsProject.nextReviewDateStr = newDateStr
    thisNoteAsProject.nextReviewDate = nextReviewDate
    thisNoteAsProject.calcDurations()
    thisNoteAsProject.calcNextReviewDate()
    logDebug('calcNextReviewDate', `-> reviewedDate = ${String(thisNoteAsProject.reviewedDate)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDate = ${String(thisNoteAsProject.nextReviewDate)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
    const newMSL = thisNoteAsProject.machineSummaryLine()
    logDebug('skipReview', `- updatedMachineSummaryLine => '${newMSL}'`)
    await updateReviewListAfterChange(currentNote.title ?? '', false, config, newMSL)
    // Update list for user
    await renderProjectLists(config)

    // Then move to nextReview
    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (noteToReview != null) {
      if (config.confirmskipReview) {
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

//-------------------------------------------------------------------------------
/**
 * Update the full-review-list after completing a review or completing/cancelling a whole project.
 * Note: Called by nextReview, skipReview, completeProject, cancelProject, pauseProject.
 * @author @jgclark
 * @param {string} title of note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {any} config
 * @param {string?} updatedMachineSummaryLine to write to full-review-list (optional)
 */
export async function updateReviewListAfterChange(
  reviewedTitle: string,
  simplyDelete: boolean,
  configIn: any,
  updatedMachineSummaryLine: string = '',
): Promise<void> {
  try {
    if (reviewedTitle === '') {
      throw new Error('Empty title passed')
    }
    logInfo('updateReviewListAfterChange', `Updating full-review-list for '${reviewedTitle}' -> ${simplyDelete ? 'simplyDelete' : 'update'} with '${updatedMachineSummaryLine}'`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(configIn, true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    let reviewLines = fmObj.body.split('\n')
    // const firstLineAfterFrontmatter = fmObj.bodyBegin - 1

    // Find right line to update
    let thisLineNum: number = NaN
    let thisTitle = ''
    // for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
    for (let i = 0; i < reviewLines.length; i++) {
      // const line = fileLines[i]
      const line = reviewLines[i]
      // check for title match just using field 3
      const titleField = line.split('\t')[2] ?? ''
      if (titleField === reviewedTitle) {
        thisLineNum = i
        thisTitle = reviewedTitle
        logDebug('updateReviewListAfterChange', `- Found '${reviewedTitle}' to update from '${line}' at line number ${String(thisLineNum)}`)
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    if (isNaN(thisLineNum)) {
      logWarn('updateReviewListAfterChange', `- Can't find '${reviewedTitle}' to update in full-review-list, so will regenerate whole list.`)
      await makeFullReviewList(configIn, false)
      return
    } else {
      if (simplyDelete) {
        // delete line 'thisLineNum'
        reviewLines.splice(thisLineNum, 1)
        logDebug('updateReviewListAfterChange', `- Deleted '${reviewedTitle}' from line number ${thisLineNum}`)
      } else {
        // update this line in the full-review-list
        reviewLines[thisLineNum] = updatedMachineSummaryLine
        logDebug('updateReviewListAfterChange', `- Updated '${reviewedTitle}'  line number ${thisLineNum}`)
      }
      // re-form the file
      const outputLines = filterAndSortReviewList(reviewLines, configIn)
      DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true)

      // Finally, refresh Dashboard. Note: Designed to fail silently if it isn't installed, or open.
      // DataStore.invokePluginCommand('refreshDashboard', '')
      const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'refreshDashboard', '')
      logDebug('updateReviewListAfterChange', `sent message to refresh Dashboard: ${refreshXCallbackURL}`)
      await NotePlan.openURL(refreshXCallbackURL)
    }

  } catch (error) {
    logError('updateReviewListAfterChange', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Work out the next note to review (if any).
 * It assumes the full-review-list is sorted by nextReviewDate (earliest to latest).
 * Note: there is now a multi-note variant of this in jgclark.Dashboard/src/dataGeneration.js
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  try {
    logDebug('getNextNoteToReview', `Started`)
    const config = await getReviewSettings()

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(config, true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n')

    // Now read from the top until we find a line with a negative value in the first column (nextReviewDays)
    for (let i = 0; i < reviewLines.length; i++) {
      const thisLine = reviewLines[i]
      const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
      const nextNoteTitle = thisLine.split('\t')[2] // get third field = title
      if (nextReviewDays <= 0) {
        logDebug('getNextNoteToReview', `- Next to review -> '${nextNoteTitle}'`)
        const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
        return nextNotes[0] // return first matching note
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `- No notes left due for review 🎉`)
    return
  } catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return
  }
}

//-------------------------------------------------------------------------------
/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the metadata line of the note in the Editor.
 * It takes each mention in the array (e.g. '@reviewed(2023-06-23)') and all other versions of @reviewed will be removed first, before that string is appended.
 * @author @jgclark
 * @param {Array<string>} mentions to update:
 * @returns { ?TNote } current note
 */
export async function updateMetadataInEditor(updatedMetadataArr: Array<string>): Promise<?TNote> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('updateMetadataInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = Editor // note: not Editor.note

    const metadataLineIndex: number = getOrMakeMetadataLine(Editor)
    // Re-read paragraphs, as they might have changed
    let metadataPara = Editor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(Editor)}`)
    }

    const origLine: string = metadataPara.content
    let updatedLine = origLine

    logDebug('updateMetadataInEditor', `starting for '${displayTitle(thisNote)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`)

    for (const item of updatedMetadataArr) {
      // logDebug('updateMetadataInEditor', `Processing ${item} for ${mentionName}`)
      const mentionName = item.split('(', 1)[0]
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      updatedLine = updatedLine.replace(RE_THIS_MENTION_ALL, '')
      // Then append this @mention
      updatedLine += ' ' + item
      // logDebug('updateMetadataInEditor', `-> ${updatedLine}`)
    }

    // send update to Editor (removing multiple and trailing spaces)
    metadataPara.content = updatedLine.replace(/\s{2,}/g, ' ').trimRight()
    Editor.updateParagraph(metadataPara)
    // await saveEditorToCache() // might be stopping code execution here for unknown reasons
    logDebug('updateMetadataInEditor', `- After update ${metadataPara.content}`)

    // update this note in the review list
    return thisNote
  } catch (error) {
    logError('updateMetadataInEditor', `${error.message}`)
    return null
  }
}

//-------------------------------------------------------------------------------
/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 * @returns { ?TNote } current note
 */
export async function deleteMetadataMentionInEditor(mentionsToDeleteArr: Array<string>): Promise<?TNote> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = Editor // note: not Editor.note

    const metadataLineIndex: number = getOrMakeMetadataLine(Editor)
    // Re-read paragraphs, as they might have changed
    let metadataPara = Editor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(Editor)}`)
    }

    const origLine: string = metadataPara.content
    let newLine = origLine

    logDebug('deleteMetadataMentionInEditor', `starting for '${displayTitle(Editor)}' with metadataLineIndex ${metadataLineIndex} to remove [${String(mentionsToDeleteArr)}]`)

    for (const mentionName of mentionsToDeleteArr) {
      // logDebug('deleteMetadataMentionInEditor', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      newLine = newLine.replace(RE_THIS_MENTION_ALL, '')
      logDebug('deleteMetadataMentionInEditor', `-> ${newLine}`)
    }

    // send update to Editor (removing multiple and trailing spaces)
    metadataPara.content = newLine.replace(/\s{2,}/g, ' ').trimRight()
    Editor.updateParagraph(metadataPara)
    // await saveEditorToCache() // seems to stop here but without error
    logDebug('deleteMetadataMentionInEditor', `- After update ${metadataPara.content}`)

    // update this note in the review list
    return thisNote
  } catch (error) {
    logError('deleteMetadataMentionInEditor', `${error.message}`)
    return null
  }
}

export async function toggleDisplayFinished(): Promise<void> {
  try {
    logDebug('toggleDisplayFinished', `starting ...`)
    let savedValue = DataStore.preference('Reviews-DisplayFinished' ?? false)
    let newValue = !savedValue
    logDebug('toggleDisplayFinished', `displayFinished? toggled to ${String(newValue)}`)
    DataStore.setPreference('Reviews-DisplayFinished', newValue)
    let config = await getReviewSettings()
    await renderProjectLists(config, true)
  }
  catch (error) {
    logError('toggleDisplayFinished', error.message)
  }
}

export async function toggleDisplayOnlyOverdue(): Promise<void> {
  try {
    logDebug('toggleDisplayOnlyOverdue', `starting ...`)
    let savedValue = DataStore.preference('Reviews-DisplayOnlyOverdue' ?? false)
    let newValue = !savedValue
    logDebug('toggleDisplayOnlyOverdue', `DisplayOnlyOverdue? toggled to ${String(newValue)}`)
    DataStore.setPreference('Reviews-DisplayOnlyOverdue', newValue)
    let config = await getReviewSettings()
    await renderProjectLists(config, true)
  }
  catch (error) {
    logError('toggleDisplayOnlyOverdue', error.message)
  }
}
