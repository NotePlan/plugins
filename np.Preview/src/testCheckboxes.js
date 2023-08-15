// @flow

//--------------------------------------------------------------
// Test function for checkboxes
// by Jonathan Clark, last updated 11.8.2023
//--------------------------------------------------------------

import pluginJson from '../plugin.json'
// import open, { openApp, apps } from 'open'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  type HtmlWindowOptions,
  showHTMLV2
} from '@helpers/HTMLView'

//--------------------------------------------------------------

// Constants
const savedFilename = '../../np.Preview/testCheckboxes.html'

const toggleURL = 'noteplan://x-callback-url/runPlugin?pluginID=np.Preview&command=toggle'

const extraCSS = `
svg input:checked  {
    fill:yellow;
}

.my-image:hover {
    background-color:green;
    fill:red;
}

input[type="checkbox"]:checked + .my-image {
    fill:red;
}
`

const preBodyScripts = `
<script type="text/javascript">
function doToggle() {
  console.log('doToggle() called');
  const svgOn = this.getElementById('checkOn');
  const svgOff = this.getElementById('checkOff');
  const currentState = this.dataset.state;
  if (currentState === 'on') {
    svgOn.style.display = 'none';
    svgOff.style.display = 'inline';
    this.dataset.state = 'off';
  }
  else {
    svgOff.style.display = 'none';
    svgOn.style.display = 'inline';
    this.dataset.state = 'on';
  }
}

</script>
`

const body = `
<p>SVG assets:
  checkOff:
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="checkOn" width="3rem" height="1.5rem" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" fill="#4CAF50" />
    <circle cx="18" cy="12" r="5" fill="#FFFFFF" />
  </svg>
  checkOn:
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="checkOff" width="3rem" height="1.5rem" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" fill="#E0E0E0" />
    <circle cx="6" cy="12" r="5" fill="#FFFFFF" />
  </svg>
  </p>

<p><b>Option 1</b>: A + SVG</p>
<a href="${toggleURL}" id="a1" onclick="doToggle();" data-state="off">
  <svg id="checkOff" style="visibility: hidden;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="3rem" height="1.5rem" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" fill="#E0E0E0" />
    <circle cx="6" cy="12" r="5" fill="#FFFFFF" />
  </svg>
  <svg id="checkOn" style="visibility: hidden;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="3rem" height="1.5rem" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" fill="#4CAF50" />
    <circle cx="18" cy="12" r="5" fill="#FFFFFF" />
  </svg>
  Toogle something</a>
</a>

<!--
<p><b>Option 2</b>: INPUT + A</p>
<a href="${toggleURL}"</a>
  <input type="checkbox" id="c2" name="" value="" checked/>
</a>

<p><b>Option 3</b>: A with open()</p>
<label>
  <input type="checkbox" name="" value="" checked onChange="window.open('${toggleURL}')"/>Text label
</label>

<p><b>Option 4</b>: BUTTON with action</p>
<form action="${toggleURL}" method="get">
  <button type="submit" name="toggle-button" value="toggle">Toggle Button</button>
</form>

<p><b>Option 5</b>: BUTTON with sendData() XHR</p>
<button type="submit" id="b3" name="toggle-button" value="toggle">Toggle Button</button>
-->
`

const postBodyScript = `
const a1elem = document.getElementById("a1");
const a1state = a1.dataset.state;
console.log('starting with state '+a1state);


`

/**
 * ???
 */
export function testCheckboxes(): void {
  try {

    const windowOpts: HtmlWindowOptions = {
      windowTitle: `Test Checkboxes`,
      headerTags: '',
      generalCSSIn: '', // get general CSS set automatically
      bodyOptions: '',
      specificCSS: extraCSS,
      makeModal: false, // = not modal window
      preBodyScript: preBodyScripts, // for MathJax libraries
      postBodyScript: postBodyScript, // none
      savedFilename: savedFilename,
      reuseUsersWindowRect: false, // do try to use user's position for this window, otherwise use following defaults ...
      customId: 'textCheckboxes',
      shouldFocus: true, // shouuld not focus, if Window already exists
      width: 400,
      height: 450
      // not setting defaults for x, y
    }
    showHTMLV2(body, windowOpts)
    // logDebug('preview', `written results to HTML`)
  }
  catch (error) {
    logError(pluginJson, `textCheckboxes: ${error.message}`)
  }
}

export function toggle(): void {
  logDebug('preview:testCheckboxes', 'toggle called')
}
