// @flow
//-----------------------------------------------------------------------------
// Save search but with flexible options presented as HTML dialog to user first
// Jonathan Clark
// Last updated 29.5.2023 for v1.1.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { saveSearch } from './saveSearch'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { type HtmlWindowOptions, showHTMLV2 } from '@helpers/HTMLView'
import { closeWindowFromCustomId, logWindowsList } from '@helpers/NPWindows'

const pluginID = "jgclark.SearchExtensions"

//-----------------------------------------------------------------------------
const flexiSearchDialogHTML = `
<div class="dialogBox">
 <form type="dialog" id="searchOptions">
  <div class="dialogSection">
		<b>Search Terms</b><input type="text" id="searchTerms" name="searchTerms" size="25" value="#test" autofocus tabindex="1" />
    <br />
    (Separate terms by spaces. You can use +term, -term and !term as well. See <a href="https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions/" target="_blank">README</a> for more details.)
	</div>

	<div class="dialogSection">
		<b>Save results to </b>
    <input type="radio" name="savetype" id="quick" value="quick" />
    <label for="notetype">'Quick Search' note</label>
    <input type="radio" name="savetype" id="newnote" value="newnote" />
    <label for="notetype">Specific note</label>
  </div>

  <div class="dialogSection">
		<b>Include </b>
    <input type="checkbox" name="notetype" id="notes" value="notes"  />
    <label for="notetype">Regular notes</label>
    <input type="checkbox" name="notetype" id="calendar" value="calendar"  />
    <label for="notetype">Calendar notes</label>
    <!-- following will normally be hidden by CSS -->
    <span class="atLeastOneCheckboxWarning">[Please select at least one!]</span>
  </div>

  <div class="dialogSection">
	<b>Line Types to include</b>
	<table>
		<tr>
  		<td>
				<ul class="dialogList">
				<li>Tasks:</li>
		<li>
    <input type="checkbox" id="taskOpen" name="task"
      value="open" />
    <label for="task"><i class="fa-regular fa-circle"></i>Open</label>
		</li>
		<li>
    <input type="checkbox" id="taskScheduled" name="task"
      value="taskScheduled" />
    <label for="task"><i class="fa-regular fa-clock"></i>Scheduled</label>
		</li>
		<li>
    <input type="checkbox" id="taskDone" name="task" value="done"  />
    <label for="task"><i class="fa-regular fa-circle-check"></i>Complete</label>
		</li>
		<li>
    <input type="checkbox" id="taskCancelled" name="task" value="taskCancelled" />
    <label for="task"><i class="fa-regular fa-circle-xmark"></i>Cancelled</label>
		</li>
    </ul>
	</td>
	<td>
	<ul class="dialogList">
		<li>Checklist items:</li>
		<li>
    <input type="checkbox" id="checklistOpen" name="checklist"
      value="checklistOpen" checked />
    <label for="checklist"><i class="fa-regular fa-square"></i>Open</label>
		</li>
		<li>
    <input type="checkbox" id="checklistScheduled" name="checklist"
      value="checklistScheduled" />
    <label for="checklist"><i class="fa-regular fa-square-chevron-right"></i>Scheduled</label>
		</li>
		<li>
    <input type="checkbox" id="checklistDone" name="checklist" value="checklistDone" checked />
    <label for="checklist"><i class="fa-regular fa-square-check"></i>Complete</label>
		</li>
		<li>
    <input type="checkbox" id="checklistCancelled" name="checklist" value="checklistCancelled" />
    <label for="checklist"><i class="fa-regular fa-square-xmark"></i>Cancelled</label>
		</li>
  </ul>
	</td>
	<td>
	<ul class="dialogList">
		<li>Other line types:</li>
		<li>
    <input type="checkbox" name="other" id="list" value="list" checked />
    <label for="checklist"><kbd>-</kbd>Bullet lists</label>
		</li>
		<li>
    <input type="checkbox" name="other" id="quote" value="quote" checked />
    <label for="checklist"><kbd>&gt;</kbd>Quotations</label>
		</li>
		<li>
    <input type="checkbox" name="other" id="headings" value="title" checked />
    <label for="checklist"><kbd>#</kbd>Headings</label>
		</li>
		<li>
    <input type="checkbox" name="other" id="text" value="text" checked />
    <label for="checklist">Other note lines</label>
		</li>
  </ul>
			</td>
		</tr>
	</table>

	</div>
  <div class="dialogSection">
    <div class="buttonRow">
    <input type="submit" value="Search" class="mainButton" tabindex="2"/>
    <input type="submit" value="Cancel" id="displayFirst" tabindex="3"/>
    </div>
  </div>
 </form>
</div>
`

// Script to start the search options to the plugin and start it
const JSStartSearchInPlugin = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('flexiSearchHandler', 'jgclark.SearchExtensions', ['%%SEARCHTERMS%%', '%%SAVETYPE%%', '%%NOTETYPES%%', '%%PARATYPES%%'] )
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
		let noteTypesStr = '%%NOTETYPESSTRPREF%%'
		let paraTypesStr = '%%PARATYPESSTRPREF%%'
    const formID = "searchOptions"
		// Get the form element + input controls
    const form = document.getElementById(formID)
		const inputs = form.elements

		// Iterate over checkbox controls setting whether they're initially checked or not
    // Note additionaly complexity because 'list' is a substring of '...Checklist'
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
        } else if (inputs[i].type === "checkbox") {
          console.log('- setting paraTypesStr "'+ val +'" to ' + String(noteTypesStr.includes(val)))
          inputs[i].checked = paraTypesArr.includes(val)
        }
			}
		}

		initDialogState()

		function saveDialogState() {
			console.log('saveDialogState()')
			noteTypesStr = ''
			paraTypesStr = ''
			// Iterate over the optional controls
			for (let i = 0; i < inputs.length; i++) {
				// console.log(inputs[i].nodeName, inputs[i].type, inputs[i].checked, inputs[i].value)
				if (inputs[i].checked && inputs[i].name === "notetype") {
					// Add this checked value to a CSV string
					noteTypesStr += inputs[i].value + ','
				}
				if (inputs[i].checked && (inputs[i].name === "savetype")) {
					// Set this
					saveType = inputs[i].value
				}
				if (inputs[i].checked && (inputs[i].name === "task" || inputs[i].name === "checklist" || inputs[i].name === "other")) {
					// Add this checked value to a CSV string
					paraTypesStr += inputs[i].value + ','
				}
			}
			console.log('Saving ' + saveType + ' / ' + noteTypesStr + ' / ' + paraTypesStr)
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'saveType').replace('%%VALUE%%', saveType),
        onHandle: "miscFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'noteTypesStr').replace('%%VALUE%%', noteTypesStr),
        onHandle: "miscFunc",
        id: "1"
      })
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSUpdatePref}.replace('%%KEY%%', 'paraTypesStr').replace('%%VALUE%%', paraTypesStr),
        onHandle: "miscFunc",
        id: "1"
      })
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
        // Note: can't just do 'window.close()' as the window wasn't open by a window.open() command
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: ${JSCloseDialog},
          onHandle: "miscFunc",
          id: "1"
        })
        return
      }

			// Get text input
			const searchTerms = inputs["searchTerms"].value

      // Remove any multiple or leading or trailing comma(s)
      let noteTypes = noteTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')
      noteTypes = (noteTypes === 'notes,calendar') ? 'both' : noteTypes
      let paraTypes = paraTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')

      // Update the JS to send to the plugin based on the form values, and then send
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSStartSearchInPlugin}
          .replace('%%SEARCHTERMS%%', searchTerms)
          .replace('%%SAVETYPE%%', saveType)
          .replace('%%NOTETYPES%%', noteTypes)
          .replace('%%PARATYPES%%', paraTypes),
        onHandle: "miscFunc",
        id: "1"
      })
    })
  })

  // placeholder function; not sure why it's needed, but it is!
  function miscFunc(re, id) {
  }

</script>
`

const headerTags = `
  <!-- Load in fontawesome assets (licensed for NotePlan) -->
  <link href="../np.Shared/fontawesome.css" rel="stylesheet">
  <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

const dialogCSS = `
  /* Speciifc CSS for the dialog box */
  .dialogBox {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: var(--bg-main-color);
    min-width: 20rem;
    min-height: 17rem;
  }
	.dialogBox > div {
    max-width: 25rem;
    max-height: 22rem;
    background-color: var(--bg-alt-color);
  }
	ul.dialogList {
		list-style-type: none;
    margin: 0rem;
    padding-inline: 0.5rem;
	}
  .dialogSection {
    margin: 0.4rem 0rem; /* horiz + vert */
  }
  .dialogSection b {
    font-weight: bold;
    color: var(--tint-color);
  }
  i, kbd {
    color: var(--tint-color);
    padding-right: 0.4rem;
  }
  input[type="submit"] {
    margin: 3px 6px;
    padding: 3px 6px 4px 6px;
    font-size: 0.9rem;
  }
  input[type="text"] {
    margin-left: 0.4rem;
    padding-left: 0.2rem;
    font-size: 0.9rem;
  }
  .buttonRow {
    display: flex;
    flex-direction: row-reverse;
    justify-content: right;
    align-items: right;
  }
	.mainButton {
		font-weight: 700;
	}
  .atLeastOneCheckboxWarning {
    font-size: 0.9rem;
    color: red;
    display: inline;
  }
  input:checked ~ span { /* when at least one of the checkboxes is checked its sibling span is hidden */
    display: none;
  }
`

/**------------------------------------------------------------------------
 * Run a search over all notes, saving the results in one of several locations.
 * Works interactively (if no arguments given) or in the background (using supplied arguments).
 * @author @jgclark
*/
export async function flexiSearchRequest(
): Promise<void> {
  try {
    // Look up the 3 preferences from local store
    // Note: extra commas aren't typos
    const saveType = String(DataStore.preference(pluginID + '.saveType')) ?? 'quick'
    const noteTypesStr = String(DataStore.preference(pluginID + '.noteTypesStr')) ?? 'notes,calendar,'
    const paraTypesStr = String(DataStore.preference(pluginID + '.paraTypesStr')) ?? 'open,done,checklistOpen,checklistDone,list,quote,title,text,'
    const flexiSearchDialogPostBodyScriptsWithPrefValues = flexiSearchDialogPostBodyScripts
      .replace('%%SAVETYPEPREF%%', saveType)
      .replace('%%NOTETYPESSTRPREF%%', noteTypesStr)
      .replace('%%PARATYPESSTRPREF%%', paraTypesStr)

    logDebug(pluginJson, `flexiSearchRequest called`)
    // write HTML to capture relevant search options
    const opts: HtmlWindowOptions = {
      windowTitle: 'FlexiSearch',
      customId: 'flexiSearchDialog',
      headerTags: headerTags,
      generalCSSIn: '',
      specificCSS: dialogCSS,
      makeModal: false, // modal doesn't actually help us here
      postBodyScript: flexiSearchDialogPostBodyScriptsWithPrefValues,
      savedFilename: '../../jgclark.SearchExtensions/flexiSearchDialog.html',
      width: 440,
      height: 350,
      reuseUsersWindowRect: true,
      shouldFocus: true,
    }
    // show dialog as non-modal HTML window
    await showHTMLV2(flexiSearchDialogHTML, opts)
  }
  catch (err) {
    logError(pluginJson, 'flexiSearcRequest: ' + err.message)
  }
}

export function flexiSearchHandler(searchTerms: string, saveType: string, noteTypeToInclude: string, paraTypes: string): any {
  try {
    logDebug(pluginJson, `flexiSearchHandler called with [${searchTerms}] / ${saveType} / ${noteTypeToInclude} / ${paraTypes}`)
    // First close the window
    closeDialogWindow('flexiSearchDialog')

    // Take saveType and noteTypeToInclude add create originatorCommand from it
    let originatorCommand =
      (saveType === 'quick') ? 'quickSearch'
        : (noteTypeToInclude === 'notes') ? 'searchOverNotes'
          : (noteTypeToInclude === 'calendar') ? 'searchOverCalendar'
            : 'search' // which defaults to 'both'

    // Then call main saveSearch function (no need to await for it)
    // TODO: how to deal with case of empty search terms going to previous dialog?
    saveSearch(searchTerms, noteTypeToInclude, originatorCommand, paraTypes, 'Searching')
    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, 'flexiSearchHandler: ' + err.message)
    return {}
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
    logError(pluginJson, 'closeDialogWindow: ' + err.message)
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
    logDebug(pluginJson, `savePluginPreference('${key}', '${value}') called for ${pluginID}`)
    DataStore.setPreference(pluginID + '.' + key, value)
    // logDebug(pluginJson, `-> ${DataStore.preference(pluginID + '.' + key)}}`)

    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, 'savePluginPreference: ' + err.message)
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
    logDebug(pluginJson, `getPluginPreference('${key}') called for ${pluginID}`)
    // logDebug(pluginJson, `-> ${DataStore.preference(pluginID + '.' + key)}}`)
    return DataStore.preference(pluginID + '.' + key)

    // return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, 'getPluginPreference: ' + err.message)
    return {}
  }
}
