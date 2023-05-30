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
  <h4>Search Terms:</h4>
  <p>
    <input type="text" id="searchTerms" name="searchTerms" style="width: 20rem;" value="#test" />
    (Separate terms by spaces. You can use +term, -term and !term as well.)
  </p>

  <h4>Note types to include:</h4>
  <p>
    <input type="checkbox" name="notetype" id="notes" value="notes" checked />
    <label for="notetype">Notes</label>
    <input type="checkbox" name="notetype" id="calendar" value="calendar" checked />
    <label for="notetype">Calendar notes</label>
  </p>

  <h4>Line Types:</h4>
  <p>Tasks:
    <input type="radio" id="tasksAll" name="task" value="open,done,scheduled,cancelled" checked />
    <!-- TODO: add appropriate icons -->
    <label for="task">All</label>
    <input type="radio" id="tasksNotComplete" name="task" value="open,scheduled" />
    <label for="task">Not complete</label>
    <input type="radio" id="tasksComplete" name="task" value="done,cancelled" />
    <label for="task">Completed</label>
    <input type="radio" id="tasksNone" name="task" value="" />
    <label for="task">None</label>
  </p>

  <p>Checklist items:
    <input type="radio" id="checklistAll" name="checklist"
      value="checklistOpen,checklistScheduled,checklistDone,checklistCancelled" checked />
    <label for="checklist">All</label>
    <input type="radio" id="checklistNotComplete" name="checklist" value="checklistOpen,checklistScheduled" />
    <label for="checklist">Not complete</label>
    <input type="radio" id="checklistComplete" name="checklist" value="checklistDone,checklistCancelled" />
    <label for="checklist">Completed</label>
    <input type="radio" id="checklistNone" name="checklist" value="" />
    <label for="checklist">None</label>
  </p>
  <p>Others:
    <input type="checkbox" name="other" id="list" value="list" checked />
    <label for="checklist">- Bullet lists</label>
    <input type="checkbox" name="other" id="quote" value="quote" checked />
    <label for="checklist">> Quotations</label>
    <input type="checkbox" name="other" id="headings" value="title" checked />
    <label for="checklist">Headings</label>
    <input type="checkbox" name="other" id="text" value="text" checked />
    <label for="checklist">Other note lines</label>
  </p>
  <input type="submit" value="Cancel" />
  <input type="submit" value="Search!" />
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

const flexiSearchDialogPostBodyScripts = `
<script type="text/javascript">
  window.addEventListener("load", () => {
    console.log('onLoad script running ...')
    const formID = "searchOptions"
    const form = document.getElementById(formID)

    // Add 'submit' event handler
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

      // Get the form element
      const inputs = form.elements

      // Get main text input
      const searchTerms = inputs["searchTerms"].value
      console.log(searchTerms)

      // Iterate over the optional controls
      let noteTypesStr = ''
      let paraTypesStr = ''
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

      console.log('part2')

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

    function miscFunc(re, id) {
      // placeholder?
    }
  });

</script>
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

    // write HTML to capture relevant search options
    const opts: HtmlWindowOptions = {
      windowTitle: 'FlexiSearch',
      customId: 'flexiSearchDialog',
      generalCSSIn: '',
      specificCSS: '',
      makeModal: false, // TODO: is this more helpful?
      postBodyScript: flexiSearchDialogPostBodyScripts,
      savedFilename: '../../jgclark.SearchExtensions/flexiSearchDialog.html',
      width: 400, // FIXME: being ignored sometimes?
      height: 300,
      reuseUsersWindowRect: true,
      shouldFocus: true,
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
