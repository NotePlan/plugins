// @flow
//-----------------------------------------------------------------------------
// Save search but with flexible options presented as HTML dialog to user first
// Jonathan Clark
// Last updated 2026-08-31 for v3.0.0.b, @jgclark & @CursorAI
//-----------------------------------------------------------------------------
// TODO: fix Cancel button not working on iOS

import pluginJson from '../plugin.json'
import { saveSearch } from './saveSearch'
import type { TSearchOptions } from './searchHelpers'
import { getNoteTypesFromString, getParaTypesFromString, getSearchSettings } from './searchHelpers'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'
import { closeWindowFromCustomId, logWindowsList } from '@helpers/NPWindows'

const pluginID = "jgclark.SearchExtensions"

/**
 * Map legacy flexiSearch para-type tokens to current ParagraphType strings.
 * @param {string} paraTypesStr
 * @returns {string}
 */
function normalizeParaTypesPref(paraTypesStr: string): string {
  return paraTypesStr
    .replace(/taskScheduled/g, 'scheduled')
    .replace(/taskCancelled/g, 'cancelled')
    .replace(/checklistOpen/g, 'checklist')
    .replace(/other/g, 'not-task')
}

/**
 * Treat stored preference as checked for case/full-word dialog controls.
 * @param {any} pref
 * @returns {boolean}
 */
function isTruthySearchFlagPref(pref: any): boolean {
  return pref === true || pref === 'true' || pref === 'casesens' || pref === 'fullword'
}

//-----------------------------------------------------------------------------
const infoHelpBodyForPluginExtendedSyntax = `
      Searches match on whole or partial words.<br />
      Separate search terms by spaces; surround an exact phrase in double quotes.<br />
      Must find: <kbd>+term</kbd><br />
      Must not find in same line: <kbd>-term</kbd><br />
      Must not find in note: <kbd>!term</kbd><br />
      <i class="fa-regular fa-fw fa-globe"></i><a href="https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions/" target="_blank">Full documentation</a>
`
const infoHelpBodyForNPExtendedSyntax = `
      Searches match on partial words; to get whole words enclose in double quotes. Separate search terms by spaces; surround an exact phrase in double quotes. 
      <i class="fa-regular fa-fw fa-globe"></i><a href="https://help.noteplan.co/article/269-advanced-search" target="_blank">Full documentation</a><br />
      Must find: <kbd>term</kbd><br />
      Must not find in same line: <kbd>-term</kbd><br />
      May find in same line: <kbd>termA OR termB</kbd> and negative groups <kbd>-(termA OR termB)</kbd><br />
      Source: <kbd>source:calendar|dated-notes|notes|events|reminders|list-reminders</kbd><br />
      Relative Dates: <kbd>date:yesterday|today|tomorrow|past|future|past-and-today|this-week|last-week|next-week|this-month|last-month|next-month|this-year|last-year|next-year|30days|all</kbd><br />
      Specific Date: <kbd>date:2025-01-01|2025-W01|2025-01|2025-Q1|2025</kbd><br />
      Date range: <kbd>date:2025-01-01-2025-01-31|2025-W01-2025-W52|2025-01-2025-02|2025-Q1-2025-Q4|2024-2025</kbd><br />
      Path: <kbd>path:Projects/Work</kbd><br />
      Task type(s): <kbd>is:open|done|scheduled|cancelled|checklist|checklist-done|checklist-scheduled|checklist-cancelled|not-task</kbd><br />
      Heading: <kbd>heading:Projects</kbd><br />
      Sort: <kbd>sort:asc|desc</kbd><br />
      Show/Hide: <kbd>show|hide:past-events|archive|teamspace|timeblocked</kbd>
`

const infoHelpBodyToUse = async (): Promise<string> => {
  // TODO(later): remove config check, and then can take out the async stuff
  const config = await getSearchSettings()
  const useNPAdvancedSyntax = config.useNativeSearch && (NotePlan.environment.buildVersion >= 1429)
  return useNPAdvancedSyntax ? infoHelpBodyForNPExtendedSyntax : infoHelpBodyForPluginExtendedSyntax
}

// Dialog box, for use with plugin extended syntax (i.e. before NP extended syntax available in 3.18)
const flexiSearchDialogHTML = async () => {
  const infoHelpBody = await infoHelpBodyToUse()
  return `
<div class="dialogBox">
 <form type="dialog" id="searchOptions">
  <div class="dialogSection">
		<div class="searchTerms">
      <b>Search terms</b>
      <button type="button" id="infoHelpToggle" class="infoHelpToggle gap-left" aria-expanded="false" aria-controls="infoHelpPanel" title="Search help">
        <i class="fa-regular fa-fw fa-circle-question"></i>
      </button>
      <input type="text" id="searchTerms" name="searchTerms" value="" autofocus tabindex="1" />
    </div>
	</div>

  <div id="infoHelpPanel" class="infoHelpPanel" aria-hidden="true">
    <div class="infoHelpPanelInner">
      <div class="infoHelpPanelBody">
${infoHelpBody}
      </div>
      <div class="infoHelpCloseRow">
        <button type="button" id="infoHelpClose" class="infoHelpClose">Close</button>
      </div>
    </div>
  </div>

	<div class="dialogSection">
		<b>Save results to </b>
    <input type="radio" name="savetype" id="quick" value="quick" />
    <label for="notetype">'Quick Search' note</label>
    <input type="radio" name="savetype" id="newnote" value="newnote" />
    <label for="notetype">Specific note</label>
  </div>

	<div class="dialogSection">
    <input type="checkbox" id="casesens" name="casesens" value="casesens"/>
    <label for="casesens"><b>Case sensitive searching?</b></label>
    <input type="checkbox" id="fullword" name="fullword" value="fullword" class="gap-left" />
    <label for="fullword"><b>Match full words only?</b></label>
  </div>

  <div class="dialogSection">
		<b>Include </b>
    <input type="checkbox" name="notetype" id="notes" value="notes" />
    <label for="notes">Regular notes</label>
    <input type="checkbox" name="notetype" id="calendar" value="calendar" />
    <label for="calendar">Calendar notes</label>
    <!-- following will normally be hidden by CSS -->
    <span id="noteTypeWarning" class="validationWarning">[Please select at least one!]</span>
  </div>

  <div class="dialogSection">
	<b>Line Types to include</b>

  <div class="grid-v3-container">
    <div class="dialogList">
      <ul class="grid-item">
        <b>Tasks</b>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="taskOpen" name="task" value="open" />
        <label for="taskOpen"><i class="fa-regular fa-fw fa-circle"></i>Open</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="taskScheduled" name="task" value="scheduled" />
        <label for="taskScheduled"><i class="fa-regular fa-fw fa-clock"></i>Scheduled</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="taskDone" name="task" value="done"  />
        <label for="taskDone"><i class="fa-regular fa-fw fa-circle-check"></i>Complete</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="taskCancelled" name="task" value="cancelled" />
        <label for="taskCancelled"><i class="fa-regular fa-fw fa-circle-xmark"></i>Cancelled</label>
      </ul>
    </div>

    <div class="dialogList">
      <ul class="grid-item">
        <b>Checklists</b>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="checklistOpen" name="checklist"
        value="checklist" checked />
        <label for="checklistOpen"><i class="fa-regular fa-fw fa-square"></i>Open</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="checklistScheduled" name="checklist"
        value="checklistScheduled" />
        <label for="checklistScheduled"><i class="fa-regular fa-fw fa-square-chevron-right"></i>Scheduled</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="checklistDone" name="checklist" value="checklistDone" checked />
        <label for="checklistDone"><i class="fa-regular fa-fw fa-square-check"></i>Complete</label>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" id="checklistCancelled" name="checklist" value="checklistCancelled" />
        <label for="checklistCancelled"><i class="fa-regular fa-fw fa-square-xmark">
        </i>Cancelled</label>
      </ul>
    </div>

    <div class="dialogList">
      <ul class="grid-item">
        <b>Other line types</b>
      </ul>
      <ul class="grid-item">
        <input type="checkbox" name="other" id="list" value="not-task" checked />
        <label for="list">bullets, quotes, headings, ordinary lines</label>
      </ul>
    </div>
  </div>

  <!-- following will normally be hidden by CSS -->
  <span id="paraTypeWarning" class="validationWarning">[Please select at least one!]</span>
	</div>

  <div class="dialogSection">
    <div class="buttonRow">
    <input type="submit" value="Search" class="mainButton" tabindex="2"/>
    <!-- remove for now as it doesn't work on iOS/iPadOS and there's an alternative on macOS
    <input type="submit" value="Cancel" id="displayFirst" tabindex="3"/> -->
    </div>
  </div>
 </form>
</div>
`
}

// Script to send the search options to the plugin and start it
const JSStartSearchInPlugin = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('flexiSearchHandler', 'jgclark.SearchExtensions', ['%%SEARCHTERMS%%', '%%SAVETYPE%%', '%%CASE%%', '%%FULLWORD%%', '%%NOTETYPES%%', '%%PARATYPES%%'] )
})()
`)

// Script to close the dialog box
const JSCloseDialog = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('closeDialogWindow', 'jgclark.SearchExtensions', ['flexiSearchDialog'] )
})()
`)

// Script to save item to DataStore.preference
const JSUpdatePref = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('savePluginPreference', 'jgclark.SearchExtensions', ['%%KEY%%', '%%VALUE%%'] )
})()
`)

const flexiSearchDialogPostBodyScripts = `
<script type="text/javascript">
  window.addEventListener("load", () => {
    console.log('onLoad script running ...')

		// Set defaults to use.
		// Note following code assumes case sensitive matching, and that the values are distinct and not subset strings of each other.
    // Their values are substituted before the script is loaded
    let saveType = '%%SAVETYPEPREF%%'
    let caseSensitiveSearching = '%%CASESENSPREF%%'
    let fullWordSearching = '%%FULLWORDPREF%%'
		let noteTypesStr = '%%NOTETYPESSTRPREF%%'
		let paraTypesStr = '%%PARATYPESSTRPREF%%'
    const formID = "searchOptions"
		// Get the form element + input controls
    const form = document.getElementById(formID)
		const inputs = form.elements

		function isTruthyPref(val) {
			return val === true || val === 'true' || val === 'casesens' || val === 'fullword'
		}

		// Iterate over checkbox controls setting whether they're initially checked or not
    // Note additional complexity because 'list' is a substring of '...Checklist'
		function initDialogState() {
			console.log('initDialogState()')
      const paraTypesArr = paraTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '').split(',')
			for (let i = 0; i < inputs.length; i++) {
        const val = inputs[i].value
        if (inputs[i].name === "notetype") {
          console.log('- setting noteTypesStr "'+ val +'" to ' + String(noteTypesStr.includes(val)))
          inputs[i].checked = noteTypesStr.includes(val)
        } else if (inputs[i].name === "savetype") {
          console.log('- setting saveType "'+ val +'" to ' + String(saveType === val))
          inputs[i].checked = (saveType === val)
        } else if (inputs[i].name === "casesens") {
          console.log('- setting caseSensitiveSearching to ' + String(isTruthyPref(caseSensitiveSearching)))
          inputs[i].checked = isTruthyPref(caseSensitiveSearching)
        } else if (inputs[i].name === "fullword") {
          console.log('- setting fullWordSearching to ' + String(isTruthyPref(fullWordSearching)))
          inputs[i].checked = isTruthyPref(fullWordSearching)
        } else if (inputs[i].type === "checkbox") {
          console.log('- setting paraTypesStr "'+ val +'" to ' + String(paraTypesArr.includes(val)))
          inputs[i].checked = paraTypesArr.includes(val)
        }
			}
		}

		initDialogState()

    // save which items are checked in the Dialog by putting them in two comma-separated strings,
    // which get sent to hidden plugin command 'savePluginPreference'
		function saveDialogState() {
			console.log('saveDialogState()')
      let saveType = ''
			let caseSens = ''
			let fullWord = ''
			let noteTypesStr = ''
			let paraTypesStr = ''
			// Iterate over the optional controls
			for (let i = 0; i < inputs.length; i++) {
				console.log(inputs[i].nodeName, inputs[i].type, inputs[i].checked, inputs[i].value)
				if (inputs[i].checked && inputs[i].name === "notetype") {
					// Add this checked value to a CSV string
					noteTypesStr += inputs[i].value + ','
				}
				if (inputs[i].checked && (inputs[i].name === "savetype")) {
					// Set this
					saveType = inputs[i].value
				}
				if (inputs[i].name === "casesens") {
					caseSens = inputs[i].checked ? 'true' : 'false'
				}
				if (inputs[i].name === "fullword") {
					fullWord = inputs[i].checked ? 'true' : 'false'
				}
				if (inputs[i].checked && (inputs[i].name === "task" || inputs[i].name === "checklist" || inputs[i].name === "other")) {
					// Add this checked value to a CSV string
					paraTypesStr += inputs[i].value + ','
				}
			}
			console.log('Saving ' + saveType + ' / ' + caseSens + ' / ' + fullWord + ' / ' + noteTypesStr + ' / ' + paraTypesStr)
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'saveType').replace('%%VALUE%%', saveType),
        onHandle: "neededDummyFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'caseSensitiveSearching').replace('%%VALUE%%', caseSens),
        onHandle: "neededDummyFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'fullWordSearching').replace('%%VALUE%%', fullWord),
        onHandle: "neededDummyFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'noteTypesStr').replace('%%VALUE%%', noteTypesStr),
        onHandle: "neededDummyFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'paraTypesStr').replace('%%VALUE%%', paraTypesStr),
        onHandle: "neededDummyFunc",
        id: "1"
      })

      // check if noteTypesStr is empty, then we have no options set, so warn user
      if (noteTypesStr === '') {
        document.getElementById('noteTypeWarning').style.display = 'block'
      } else {
        document.getElementById('noteTypeWarning').style.display = 'none'
      }
      // check if paraTypesStr is empty, then we have no options set, so warn user
      if (paraTypesStr === '') {
        document.getElementById('paraTypeWarning').style.display = 'block'
      } else {
        document.getElementById('paraTypeWarning').style.display = 'none'
      }
      console.log('end of saveDialogState()')
    }

    // Add 'change' event handler to form
		form.addEventListener("change", (event) => {
			saveDialogState()
		})

    // Add 'submit' event handler to form
    form.addEventListener("submit", (event) => {
      event.preventDefault()
      const submitterValue = event.submitter.value
      console.log('submit event fired with value ' + submitterValue)

      // Close if user has cancelled
      if (submitterValue === 'Cancel') {
        console.log('cancel event fired ...')
        // Note: can't just do 'window.close()' as the window wasn't opened by a window.open() command
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: ${JSCloseDialog},
          onHandle: "neededDummyFunc",
          id: "1"
        })
        return
      }

      // Get the text input
			const searchTerms = inputs["searchTerms"].value

      // Read current form state (similar to saveDialogState but for immediate use)
      let currentSaveType = ''
      let currentCaseSens = ''
      let currentFullWord = ''
      let currentNoteTypesStr = ''
      let currentParaTypesStr = ''
      for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].checked && inputs[i].name === "notetype") {
          currentNoteTypesStr += inputs[i].value + ','
        }
        if (inputs[i].checked && (inputs[i].name === "savetype")) {
          currentSaveType = inputs[i].value
        }
        if (inputs[i].name === "casesens") {
          currentCaseSens = inputs[i].checked ? 'true' : 'false'
        }
        if (inputs[i].name === "fullword") {
          currentFullWord = inputs[i].checked ? 'true' : 'false'
        }
        if (inputs[i].checked && (inputs[i].name === "task" || inputs[i].name === "checklist" || inputs[i].name === "other")) {
          currentParaTypesStr += inputs[i].value + ','
        }
      }

      // Remove any multiple or leading or trailing comma(s)
      let noteTypes = currentNoteTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')
      noteTypes = (noteTypes === 'notes,calendar') ? 'both' : noteTypes
      let paraTypes = currentParaTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')

      if (paraTypes === '' || noteTypes === '') {
        console.log("** cancel submit form as we don't have valid options set yet ... **")
        return
      }

      // Update the JS to send to the plugin based on the form values, and then send
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSStartSearchInPlugin}
          .replace('%%SEARCHTERMS%%', searchTerms)
          .replace('%%SAVETYPE%%', currentSaveType)
          .replace('%%CASE%%', currentCaseSens)
          .replace('%%FULLWORD%%', currentFullWord)
          .replace('%%NOTETYPES%%', noteTypes)
          .replace('%%PARATYPES%%', paraTypes),
        onHandle: "neededDummyFunc",
        id: "1"
      })
    })

    // Sliding help panel under the search-terms info icon
    const infoHelpPanel = document.getElementById('infoHelpPanel')
    const infoHelpToggle = document.getElementById('infoHelpToggle')
    const infoHelpClose = document.getElementById('infoHelpClose')

    function openInfoHelp() {
      if (!infoHelpPanel || !infoHelpToggle) return
      infoHelpPanel.classList.add('is-open')
      infoHelpPanel.setAttribute('aria-hidden', 'false')
      infoHelpToggle.setAttribute('aria-expanded', 'true')
    }

    function closeInfoHelp() {
      if (!infoHelpPanel || !infoHelpToggle) return
      infoHelpPanel.classList.remove('is-open')
      infoHelpPanel.setAttribute('aria-hidden', 'true')
      infoHelpToggle.setAttribute('aria-expanded', 'false')
    }

    function toggleInfoHelp(event) {
      event.preventDefault()
      event.stopPropagation()
      if (!infoHelpPanel) return
      if (infoHelpPanel.classList.contains('is-open')) {
        closeInfoHelp()
      } else {
        openInfoHelp()
      }
    }

    if (infoHelpToggle) {
      infoHelpToggle.addEventListener('click', toggleInfoHelp)
    }
    if (infoHelpClose) {
      infoHelpClose.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        closeInfoHelp()
      })
    }
    if (infoHelpPanel) {
      infoHelpPanel.addEventListener('click', (event) => {
        event.stopPropagation()
      })
    }
    form.addEventListener('click', (event) => {
      if (!infoHelpPanel || !infoHelpPanel.classList.contains('is-open')) return
      const target = event.target
      if (infoHelpToggle && (target === infoHelpToggle || infoHelpToggle.contains(target))) return
      if (infoHelpPanel.contains(target)) return
      closeInfoHelp()
    })
  })

  // placeholder function; not sure why it's needed, but it is!
  function neededDummyFunc(re, id) {
  }

</script>
`

const resourceLinksInHeader = `
  <!-- Load in FlexiSearch-specific CSS -->
  <link href="flexiSearch.css" rel="stylesheet">

  <!-- Load in fontawesome assets (licensed for NotePlan) -->
  <link href="../np.Shared/fontawesome.css" rel="stylesheet">
  <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">

  <!-- Tell the browser to render the page at 1x to make it work on iOS -->
  <meta name="viewport" content="width=device-width, initial-scale=1" />
`

// ------------------------------------------------------------------------

/** 
 * Display the flexiSearch dialog to user, using saved settings and preferences to pre-populate the various controls on the dialog.
 * This in turn will call back to flexiSearchHandler() below.
 * @author @jgclark
*/
export async function showFlexiSearchDialog(
): Promise<void> {
  try {
    // Look up the 5 preferences from local store
    // Note: extra commas aren't typos
    const saveTypePref = DataStore.preference(`${pluginID}.saveType`)
    const saveType = (saveTypePref != null) ? String(saveTypePref) : 'quick'
    const caseSensitiveSearchingPref = DataStore.preference(`${pluginID}.caseSensitiveSearching`) ?? false
    const fullWordSearchingPref = DataStore.preference(`${pluginID}.fullWordSearching`) ?? false
    const noteTypesStrPref = DataStore.preference(`${pluginID}.noteTypesStr`)
    const noteTypesStr = (noteTypesStrPref != null) ? String(noteTypesStrPref) : 'notes,calendar,'
    const paraTypesStrPref = DataStore.preference(`${pluginID}.paraTypesStr`)
    const paraTypesStr = normalizeParaTypesPref(
      (paraTypesStrPref != null) ? String(paraTypesStrPref) : 'open,done,checklist,checklistDone,non-task,'
    )
    const flexiSearchDialogPostBodyScriptsWithPrefValues = flexiSearchDialogPostBodyScripts
      .replace('%%SAVETYPEPREF%%', saveType)
      .replace('%%CASESENSPREF%%', String(isTruthySearchFlagPref(caseSensitiveSearchingPref)))
      .replace('%%FULLWORDPREF%%', String(isTruthySearchFlagPref(fullWordSearchingPref)))
      .replace('%%NOTETYPESSTRPREF%%', noteTypesStr)
      .replace('%%PARATYPESSTRPREF%%', paraTypesStr)

    // Dialog-only: +2px on the theme/editor base so rem-based dialog CSS scales with it.
    const editorFontSize = Number(DataStore.preference('fontSize'))
    const dialogBaseFontSize = (Number.isFinite(editorFontSize) && editorFontSize > 0 ? editorFontSize : 14) + 2

    // write HTML to capture relevant search options
    const opts: HtmlWindowOptions = {
      windowTitle: 'FlexiSearch',
      customId: 'flexiSearchDialog',
      headerTags: resourceLinksInHeader,
      generalCSSIn: '', // i.e. generate from theme
      specificCSS: `
html, body, .body {
  font-size: ${String(dialogBaseFontSize)}px;
}
`,
      makeModal: false, // modal doesn't actually help us here
      postBodyScript: flexiSearchDialogPostBodyScriptsWithPrefValues,
      savedFilename: '../../jgclark.SearchExtensions/flexiSearchDialog.html',
      width: 440,
      height: 450,
      reuseUsersWindowRect: true,
      shouldFocus: true,
    }
    // show dialog as non-modal HTML window
    await showHTMLV2(await flexiSearchDialogHTML(), opts)
  }
  catch (err) {
    logError(pluginJson, `showFlexiSearchDialog: ${err.message}`)
  }
}

/**
 * Handle search request from the flexiSearch dialog.
 * @param {string} searchTerms 
 * @param {string} saveType 
 * @param {string} caseSensitiveSearchingAsStr Note: string due to limit of bridge to plugin. 'true' or legacy 'casesens'
 * @param {string} fullWordSearchingAsStr Note: string due to limit of bridge to plugin. 'true' or legacy 'fullword'
 * @param {string} noteType 'notes' | 'calendar' | 'both'
 * @param {string} paraTypes 
 * @returns {any} but in practice empty object
 */
export async function flexiSearchHandler(
  searchTerms: string,
  saveType: string,
  caseSensitiveSearchingAsStr: string,
  fullWordSearchingAsStr: string,
  noteType: string,
  paraTypes: string
): Promise<void> {
  try {
    logDebug(pluginJson, `flexiSearchHandler called with [${searchTerms}] / ${saveType} / ${caseSensitiveSearchingAsStr} / ${fullWordSearchingAsStr} / ${noteType} / ${paraTypes}`)
    // First close the window
    closeDialogWindow('flexiSearchDialog')

    // Take saveType and noteType add set originatorCommand from it
    const originatorCommand =
      (saveType === 'quick') ? 'quickSearch'
        : (noteType === 'notes') ? 'searchOverNotes'
          : (noteType === 'calendar') ? 'searchOverCalendar'
            : 'search' // which defaults to 'both'

    // Set searchOptions
    const caseSensitiveSearching: boolean = caseSensitiveSearchingAsStr === 'true' || caseSensitiveSearchingAsStr === 'casesens'
    const fullWordSearching: boolean = fullWordSearchingAsStr === 'true' || fullWordSearchingAsStr === 'fullword'
    // saveSearch(searchTerms, noteType, originatorCommand, paraTypes, 'Searching', caseSensitiveSearching, fullWordSearching)
    const searchOptions: TSearchOptions = {
      noteTypesToInclude: getNoteTypesFromString(noteType),
      paraTypesToInclude: getParaTypesFromString(paraTypes),
      caseSensitiveSearching,
      fullWordSearching,
      originatorCommand,
    }
    // Then call main saveSearch function. No need to await, but done for consistency
    await saveSearch(searchOptions, searchTerms)
    return
  }
  catch (err) {
    logError(pluginJson, `flexiSearchHandler: ${err.message}`)
    return
  }
}

/**
 * Way for an HTML window to request that it be closed.
 * Is there a simpler way? I can't find one yet.
 * @param {customId} customId
 * @returns {any} not used, but has to be present
 */
export function closeDialogWindow(customId: string): any {
  try {
    // logDebug(pluginJson, `closeDialogWindow('${customId}') called`)
    closeWindowFromCustomId(customId)

    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, `closeDialogWindow: ${err.message}`)
    return {}
  }
}

/**
 * Helper function for HTML views to set a DataStore.preference value (as a string)
 * @param {string} key to set
 * @param {string} value to set
 * @returns {any}
 */
export function savePluginPreference(key: string, value: string): any {
  try {
    const prefName = `${pluginID}.${key}`
    logDebug(pluginJson, `savePluginPreference('${key}', '${value}') called for ${pluginID}`)
    if (key === 'caseSensitiveSearching' || key === 'fullWordSearching') {
      DataStore.setPreference(prefName, value === 'true' || value === 'casesens' || value === 'fullword')
    } else {
      DataStore.setPreference(prefName, value)
    }
    logDebug(pluginJson, `-> ${String(DataStore.preference(prefName))}`)

    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, `savePluginPreference: ${err.message}`)
    return {}
  }
}

/**
 * Helper function for HTML views to get DataStore.preference value
 * @param {string} key to read
 * @returns {any}
 */
export function getPluginPreference(key: string): any {
  try {
    const prefName = `${pluginID}.${key}`
    const prefValue = DataStore.preference(prefName)
    logDebug(pluginJson, `getPluginPreference('${key}') called for ${pluginID} → ${String(prefValue)}`)
    return prefValue
  }
  catch (err) {
    logError(pluginJson, `getPluginPreference: ${err.message}`)
    return {}
  }
}