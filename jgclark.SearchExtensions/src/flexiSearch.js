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


//-----------------------------------------------------------------------------
const flexiSearchDialogHTML = ` <form type="dialog" id="searchOptions">
  <div class="dialogSection">
		<b>Search Terms</b> <input type="text" id="searchTerms" name="searchTerms" style="width: 16rem;" value="#test" />
    <br />(Separate terms by spaces. You can use +term, -term and !term as well.)
  </div>

  <div class="dialogSection">
		<b>Include </b>
    <input type="checkbox" name="notetype" id="notes" value="notes"  />
    <label for="notetype">Regular notes</label>
    <input type="checkbox" name="notetype" id="calendar" value="calendar"  />
    <label for="notetype">Calendar notes</label>
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
    <input type="checkbox" id="taskDone" name="task" value="done"  />
    <label for="task"><i class="fa-regular fa-circle-check"></i>Complete</label>
		</li>
		<li>
    <input type="checkbox" id="taskScheduled" name="task"
      value="taskScheduled" />
    <label for="task"><i class="fa-regular fa-clock"></i>Scheduled</label>
		</li>
		<li>
    <input type="checkbox" id="taskCancelled" name="task" value="taskCancelled" />
    <label for="task"><i class="fa-regular fa-circle-xmark"></i>Cancelled</label>
		</li>
    <!--
		<li>
    <input type="checkbox" id="taskNone" name="task" value="" />
    <label for="task">None</label>
		</li>
    -->
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
    <input type="checkbox" id="checklistDone" name="checklist" value="checklistDone" checked />
    <label for="checklist"><i class="fa-regular fa-square-check"></i>Complete</label>
		</li>
		<li>
    <input type="checkbox" id="checklistScheduled" name="checklist"
      value="checklistScheduled" />
    <!-- TODO: other icons needed -->
    <label for="checklist"><i class="fa-regular fa-square-chevron-right"></i>Scheduled</label>
		</li>
		<li>
    <input type="checkbox" id="checklistCancelled" name="checklist" value="checklistCancelled" />
    <label for="checklist"><i class="fa-regular fa-square-xmark"></i>Cancelled</label>
		</li>
    <!--
		<li>
    <input type="checkbox" id="checklistNone" name="checklist" value="" />
    <label for="checklist">None</label>
		</li>
    -->
  </ul>
	</td>
	<td>
	<ul class="dialogList">
		<li>Other line types:</li>
		<li>
    <input type="checkbox" name="other" id="list" value="list" checked />
    <label for="checklist"><kbd>-</kbd> Bullet lists</label>
		</li>
		<li>
    <input type="checkbox" name="other" id="quote" value="quote" checked />
    <label for="checklist"><kbd>&gt;</kbd> Quotations</label>
		</li>
		<li>
    <input type="checkbox" name="other" id="headings" value="title" checked />
    <label for="checklist"><kbd>#</kbd> Headings</label>
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
  <div class="dialogSection buttonRow">
    <input type="submit" value="Cancel" />
    <input type="submit" value="Search" />
  </div>
</form>
`

// Script to start the search options to the plugin and start it
const JSStartSearchInPlugin = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('flexiSearchHandler', 'jgclark.SearchExtensions', ['%%SEARCHTERMS%%', '%%NOTETYPES%%', '%%PARATYPES%%'] )
})()
`)

// Script to close the dialog box
const JSCloseDialog = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('closeDialogWindow', 'jgclark.SearchExtensions', ['flexiSearchDialog'] )
})()
`)

// TODO: Script to save item to pref
const JSUpdatePref = JSON.stringify(`
(async function() {
  await DataStore.invokePluginCommandByName('???', 'jgclark.SearchExtensions', ['%%KEY%%', '%%VALUE%%'] )
})()
`)

const flexiSearchDialogPostBodyScripts = `
<script type="text/javascript">
  window.addEventListener("load", () => {
    console.log('onLoad script running ...')
		// Set defaults to use.
		// Note following code assumes case sensitive matching, and that the values are distinct and not subset strings of each other
		let noteTypesStr = 'notes,calendar,'
		let paraTypesStr = 'open,done,checklistOpen,checklistDone,list,quote,title,text,'
    const formID = "searchOptions"
		// Get the form element + input controls
    const form = document.getElementById(formID)
		const inputs = form.elements

		function loadDialogState() {
			// TODO: load it or have it passed in some way
			console.log('loadDialogState()')
		}

		loadDialogState()

		// Iterate over checkbox controls setting whether they're initially checked or not
		function initDialogState() {
			console.log('initDialogState()')
			for (let i = 0; i < inputs.length; i++) {
				if (inputs[i].type === "checkbox") {
					const val = inputs[i].value
					if (inputs[i].name === "notetype") {
						console.log('- setting noteTypesStr "'+ val +'" to ' + noteTypesStr.includes(val))
						inputs[i].checked = noteTypesStr.includes(val)
					} else {
						console.log('- setting paraTypesStr "'+ val +'" to ' + noteTypesStr.includes(val))
						inputs[i].checked = paraTypesStr.includes(val)
					}
				}
			}
		}

		initDialogState()

		function saveDialogState() {
			noteTypesStr = ''
			paraTypesStr = ''
			console.log('saveDialogState()')
			// Iterate over the optional controls
			for (let i = 0; i < inputs.length; i++) {
				// console.log(inputs[i].nodeName, inputs[i].type, inputs[i].checked, inputs[i].value)
				if (inputs[i].checked && inputs[i].name === "notetype") {
					// Add this checked value to a CSV string
					noteTypesStr += inputs[i].value + ','
				}
				if (inputs[i].checked && (inputs[i].name === "task" || inputs[i].name === "checklist" || inputs[i].name === "other")) {
					// Add this checked value to a CSV string
					paraTypesStr += inputs[i].value + ','
				}
			}
      // TODO: warning if noteTypesStr is empty

			// TODO: save
			console.log('Saving ' + noteTypesStr + ' / ' + paraTypesStr)
      window.webkit.messageHandlers.jsBridge.postMessage({
          code: ${JSUpdatePref}.replace(%%KEY%%, 'noteTypesStr').replace(%%VALUE%%, noteTypesStr),
          function: "miscFunc",
          id: "1"
        })
      window.webkit.messageHandlers.jsBridge.postMessage({
          code: ${JSUpdatePref}.replace(%%KEY%%, 'paraTypesStr').replace(%%VALUE%%, paraTypesStr),
          function: "miscFunc",
          id: "1"
        })
      }

    // Add 'change' event handler to form
		form.addEventListener("change", (event) => {
			saveDialogState()
		})

    // Add 'submit' event handler to form
    form.addEventListener("submit", (event) => {
      event.preventDefault()
      const submitterValue = event.submitter.value
      console.log('submit event fired with value '+submitterValue)

      // Close if user has cancelled
      if (submitterValue === 'Cancel') {
        console.log('cancel event fired ...')
        // Note: can't just do 'window.close()' as the window wasn't open by a window.open() command
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: ${JSCloseDialog},
          function: "miscFunc",
          id: "1"
        })
        return
      }

			// Get text input
			const searchTerms = inputs["searchTerms"].value
			console.log(searchTerms)

      // Remove any multiple or leading or trailing comma(s)
      let noteTypes = noteTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')
      noteTypes = (noteTypes === 'notes,calendar') ? 'both' : noteTypes
      // console.log(noteTypes)
      let paraTypes = paraTypesStr.replace(/,{2,}/g, ',').replace(/,$/, '').replace(/^,/, '')
      // console.log(paraTypesStr)
      // console.log(paraTypes)

      // Update the JS to send to the plugin based on the form values, and then send
      window.webkit.messageHandlers.jsBridge.postMessage({
        code: ${JSStartSearchInPlugin}.replace('%%SEARCHTERMS%%', searchTerms).replace('%%NOTETYPES%%', noteTypes).replace('%%PARATYPES%%', paraTypes),
        onHandle: "miscFunc",
        id: "1"
      })
    })

    // placeholder function; not sure why it's needed, but it is!
    function miscFunc(re, id) {
    }
  });

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
	ul.dialogList {
		list-style-type: none;
    margin: 0rem;
    padding-inline: 0.5rem;
	}
  .dialogSection {
    margin: 0.3rem 0rem;
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
    padding: 3px 6px 4px 6px;
    margin: 3px 6px;
    font-size: 0.8rem;
  }
  .buttonRow {
    text-align: center;
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

    logDebug(pluginJson, `flexiSearchRequest called`)
    // TODO: add appropriate FA libraries
    // write HTML to capture relevant search options
    const opts: HtmlWindowOptions = {
      windowTitle: 'FlexiSearch',
      customId: 'flexiSearchDialog',
      headerTags: headerTags,
      generalCSSIn: '',
      specificCSS: dialogCSS,
      makeModal: false, // TODO: is this more helpful?
      postBodyScript: flexiSearchDialogPostBodyScripts,
      savedFilename: '../../jgclark.SearchExtensions/flexiSearchDialog.html',
      width: 400, // FIXME: being ignored
      height: 300,
      reuseUsersWindowRect: false,
      shouldFocus: true, // FIXME: being ignored?
    }
    // show dialog as non-modal HTML window
    await showHTMLV2(flexiSearchDialogHTML, opts)
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}

export function flexiSearchHandler(searchTerms: string, noteTypeToInclude: string, paraTypes: string): any {
  try {
    logDebug(pluginJson, `flexiSearchHandler called with ${searchTerms} / ${noteTypeToInclude} / ${paraTypes}`)
    // First close the window
    closeDialogWindow('flexiSearchDialog')

    // Then call main saveSearch function (no need to await for it)
    // FIXME: how to deal with case of empty search terms going to previous dialog?
    saveSearch(searchTerms, noteTypeToInclude, 'newnote', paraTypes, 'Searching')
    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, err.message)
    return {}
  }
}

export function closeDialogWindow(customId: string): any {
  try {
    logDebug(pluginJson, `closeDialogWindow('${customId}') called`)
    logWindowsList()
    // Close the window
    closeWindowFromCustomId(customId)

    return {} // apparently required to avoid error in log
  }
  catch (err) {
    logError(pluginJson, err.message)
    return {}
  }
}
