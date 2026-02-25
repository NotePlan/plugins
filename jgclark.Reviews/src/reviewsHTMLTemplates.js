// @flow
//-----------------------------------------------------------------------------
// HTML and JS template strings for Reviews plugin HTML view
// Extracted from reviews.js to keep command logic separate from templates.
// Last updated 2026-02-24 for v1.4.0.b3, @jgclark
//-----------------------------------------------------------------------------

export const stylesheetinksInHeader: string = `
<!-- Load in Project List-specific CSS -->
<link href="projectList.css" rel="stylesheet">
<link href="projectListDialog.css" rel="stylesheet">
`

export const faLinksInHeader: string = `
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

export const commsBridgeScripts: string = `
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
export const shortcutsScript: string = `
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

export const addToggleEvents: string = `
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
    if (input.getAttribute('data-tag-toggle')) continue; // tag toggles are client-side only
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

export const displayFiltersDropdownScript: string = `
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

export const tagTogglesVisibilityScript: string = `
<script>
  (function() {
    function applyTagToggleVisibility() {
      var toggles = document.querySelectorAll('input[data-tag-toggle]');
      var offTags = [];
      for (var i = 0; i < toggles.length; i++) {
        if (!toggles[i].checked) offTags.push(toggles[i].getAttribute('data-tag-toggle'));
      }
      var rows = document.querySelectorAll('.projectRow[data-wanted-tags]');
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var raw = row.getAttribute('data-wanted-tags') || '';
        var rowTags = raw ? raw.trim().split(/\\s+/) : [];
        var hide = false;
        for (var t = 0; t < offTags.length; t++) {
          if (rowTags.length === 1 && rowTags[0] === offTags[t]) {
            hide = true;
            break;
          }
        }
        row.style.display = hide ? 'none' : '';
      }
    }
    document.addEventListener('DOMContentLoaded', function() {
      applyTagToggleVisibility();
      var container = document.getElementById('tagToggles');
      if (container) {
        container.addEventListener('change', applyTagToggleVisibility);
      }
    });
    if (document.readyState !== 'loading') applyTagToggleVisibility();
  })();
</script>
`
