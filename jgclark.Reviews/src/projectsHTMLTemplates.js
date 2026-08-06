// @flow
//-----------------------------------------------------------------------------
// HTML and JS template strings for Reviews plugin HTML view
// Extracted from reviews.js to keep command logic separate from templates.
// Last updated 2026-05-10 for v2.0.0.b31, @CursorAI & @jgclark
//-----------------------------------------------------------------------------

export const stylesheetinksInHeader: string = `
<!-- Load in Project List-specific CSS -->
<link href="./projectList.css" rel="stylesheet">
<link href="./projectListDialog.css" rel="stylesheet">
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
  <!-- console.log('setScrollPos = ' + String(h)); -->
  document.documentElement.scrollTop = h;
  document.body.scrollTop = h;
}
</script>
`

export const autoRefreshScript: string = `
<script type="text/javascript">
(function() {
  function getScrollPos() {
    if (typeof window.pageYOffset !== 'undefined') {
      return window.pageYOffset;
    } else if (document.documentElement && typeof document.documentElement.scrollTop !== 'undefined') {
      return document.documentElement.scrollTop;
    } else if (document.body && typeof document.body.scrollTop !== 'undefined') {
      return document.body.scrollTop;
    }
    return 0;
  }

  // Expose the function to get the scroll position to the window object so it can also be used by the windowCloseAndReopenScripts function.
  window.__reviewsGetScrollPos = getScrollPos;

  function scheduleAutoRefresh() {
    var meta = document.querySelector('meta[name="autoUpdateAfterIdleTime"]');
    if (!meta) return;
    var minutes = parseInt(meta.getAttribute('content') || '0', 10);
    if (!minutes || minutes <= 0) return;
    var intervalMs = minutes * 60 * 1000;

    if (window.__reviewsAutoRefreshTimer) {
      clearInterval(window.__reviewsAutoRefreshTimer);
    }

    window.__reviewsAutoRefreshTimer = setInterval(function() {
      try {
        var scrollPos = getScrollPos();
        console.log('Auto-refreshing Project List at scrollPos ' + String(scrollPos));
        sendMessageToPlugin('refresh', { scrollPos: scrollPos });
      } catch (e) {
        console.log('Auto-refresh error', e && e.message);
      }
    }, intervalMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAutoRefresh);
  } else {
    scheduleAutoRefresh();
  }
})();
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
  var scrollPos = (typeof window.pageYOffset !== 'undefined')
    ? window.pageYOffset
    : (document.documentElement && typeof document.documentElement.scrollTop !== 'undefined')
      ? document.documentElement.scrollTop
      : (document.body && typeof document.body.scrollTop !== 'undefined')
        ? document.body.scrollTop
        : 0;
  sendMessageToPlugin('refresh', { scrollPos: scrollPos });
});
// send 'toggleDisplayOnlyDue' command
shortcut.add("meta+d", function() {
  console.log("Shortcut '⌘d' triggered: will call toggleDisplayOnlyDue");
  var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0
  // console.log("Sending to backend: toggleDisplayOnlyDue scrollPos=" + String(scrollPos))
  sendMessageToPlugin('runPluginCommand', {pluginID: 'jgclark.Reviews', commandName:'toggleDisplayOnlyDue', commandArgs: [scrollPos], scrollPos: scrollPos});
});
// send 'toggleDisplayFinished' command
shortcut.add("meta+f", function() {
  console.log("Shortcut '⌘f' triggered: will call toggleDisplayFinished");
  var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0
  // console.log("Sending to backend: toggleDisplayFinished scrollPos=" + String(scrollPos))
  sendMessageToPlugin('runPluginCommand', {pluginID: 'jgclark.Reviews', commandName: 'toggleDisplayFinished', commandArgs: [scrollPos], scrollPos: scrollPos});
});
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
      var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0
      // console.log("Sending to backend: onChangeCheckbox(" + thisSettingName + ") scrollPos=" + String(scrollPos))
      sendMessageToPlugin('onChangeCheckbox', { settingName: thisSettingName, state: event.target.checked, scrollPos: scrollPos });
    }, false);
    added++;
  }
  <!-- console.log('- '+ String(added) + ' input ELs added'); -->
</script>
`

export const displayFiltersDropdownScript: string = `
<script>
  (function() {
    var btn = document.getElementById('displayFiltersButton');
    var dropdown = document.getElementById('displayFiltersDropdown');
    if (!btn || !dropdown) return;

    var savedState = null;

    function getHiddenProjectTypeTagsFromDom() {
      var toggles = dropdown.querySelectorAll('input[data-tag-toggle]');
      var hidden = [];
      for (var i = 0; i < toggles.length; i++) {
        if (!toggles[i].checked) {
          var tag = toggles[i].getAttribute('data-tag-toggle');
          if (tag) hidden.push(tag);
        }
      }
      return hidden;
    }

    function hiddenTagsEqual(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    function getCheckboxState() {
      var onlyDue = dropdown.querySelector('input[name="displayOnlyDue"]');
      var finished = dropdown.querySelector('input[name="displayFinished"]');
      var paused = dropdown.querySelector('input[name="displayPaused"]');
      var nextActions = dropdown.querySelector('input[name="displayNextActions"]');
      var displayOrder = dropdown.querySelector('#displayOrderSelect');
      return onlyDue && finished && paused && nextActions
        ? {
            displayOnlyDue: onlyDue.checked,
            displayFinished: finished.checked,
            displayPaused: paused.checked,
            displayNextActions: nextActions.checked,
            displayOrder: displayOrder ? displayOrder.value : 'review',
            hiddenProjectTypeTags: getHiddenProjectTypeTagsFromDom(),
          }
        : null;
    }

    function applyHiddenTagsToCheckboxes(hiddenTags) {
      var toggles = dropdown.querySelectorAll('input[data-tag-toggle]');
      var hidden = hiddenTags || [];
      for (var i = 0; i < toggles.length; i++) {
        var tag = toggles[i].getAttribute('data-tag-toggle');
        toggles[i].checked = hidden.indexOf(tag) === -1;
      }
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
            state.displayNextActions !== savedState.displayNextActions ||
            state.displayOrder !== savedState.displayOrder ||
            !hiddenTagsEqual(state.hiddenProjectTypeTags, savedState.hiddenProjectTypeTags);
          if (hasChanges) {
            var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0
            // console.log("Sending to backend: saveDisplayFilters scrollPos=" + String(scrollPos))
            // TEST: change from spread to explicit list of properties, to see if this fixes runtime issue with @CursorAI thinking WebView doesn't support ES2020 syntax.
            sendMessageToPlugin('saveDisplayFilters', {
              displayOnlyDue: state.displayOnlyDue,
              displayFinished: state.displayFinished,
              displayPaused: state.displayPaused,
              displayNextActions: state.displayNextActions,
              displayOrder: state.displayOrder,
              hiddenProjectTypeTags: state.hiddenProjectTypeTags,
              scrollPos: scrollPos
            });
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
        var orderSel = dropdown.querySelector('#displayOrderSelect');
        if (orderSel && savedState.displayOrder != null) {
          orderSel.value = savedState.displayOrder;
        }
        applyHiddenTagsToCheckboxes(savedState.hiddenProjectTypeTags);
        if (typeof window.__reviewsApplyTagToggleVisibility === 'function') {
          window.__reviewsApplyTagToggleVisibility();
        }
        // Tag toggles save immediately on change; Escape must write the restored set back
        sendMessageToPlugin('saveHiddenProjectTypeTags', {
          hiddenProjectTypeTags: savedState.hiddenProjectTypeTags || []
        });
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

    // Sort order is an explicit immediate action: save + refresh on change.
    var displayOrderSelect = dropdown.querySelector('#displayOrderSelect');
    if (displayOrderSelect) {
      displayOrderSelect.addEventListener('change', function() {
        var state = getCheckboxState();
        if (state) {
          var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0
          // console.log("Sending to backend: saveDisplayFilters(displayOrderChange) scrollPos=" + String(scrollPos))
          // TEST: change from spread to explicit list of properties, to see if this fixes runtime issue with @CursorAI thinking WebView doesn't support ES2020 syntax.
          sendMessageToPlugin('saveDisplayFilters', {
            displayOnlyDue: state.displayOnlyDue,
            displayFinished: state.displayFinished,
            displayPaused: state.displayPaused,
            displayNextActions: state.displayNextActions,
            displayOrder: state.displayOrder,
            hiddenProjectTypeTags: state.hiddenProjectTypeTags,
            scrollPos: scrollPos
          });
          savedState = state;
        }
      });
    }
  })();
</script>
`

export const tagTogglesVisibilityScript: string = `
<script>
  (function() {
    function updateRichListVisibleProjectCount() {
      var allRows = document.querySelectorAll('.projectRow');
      var visible = 0;
      for (var i = 0; i < allRows.length; i++) {
        if (allRows[i].style.display !== 'none') visible++;
      }
      var label = document.getElementById('richProjectListVisibleCount');
      if (label) {
        label.textContent = visible + ' ' + (visible === 1 ? 'project' : 'projects');
      }
    }
    function getHiddenProjectTypeTagsFromDom() {
      var toggles = document.querySelectorAll('input[data-tag-toggle]');
      var hidden = [];
      for (var i = 0; i < toggles.length; i++) {
        if (!toggles[i].checked) {
          var tag = toggles[i].getAttribute('data-tag-toggle');
          if (tag) hidden.push(tag);
        }
      }
      return hidden;
    }
    function applyTagToggleVisibility() {
      // Show a row iff it has at least one currently-ON project-type tag.
      // (Previously only hid single-tag rows matching an OFF tag, so multi-tag
      // notes like "#project #area" stayed visible when both toggles were off.)
      var toggles = document.querySelectorAll('input[data-tag-toggle]');
      var onTags = [];
      for (var i = 0; i < toggles.length; i++) {
        if (toggles[i].checked) {
          var onTag = toggles[i].getAttribute('data-tag-toggle');
          if (onTag) onTags.push(onTag);
        }
      }
      var rows = document.querySelectorAll('.projectRow[data-wanted-tags]');
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var raw = row.getAttribute('data-wanted-tags') || '';
        var rowTags = raw ? raw.trim().split(/\\s+/) : [];
        var show = false;
        for (var t = 0; t < rowTags.length; t++) {
          if (onTags.indexOf(rowTags[t]) !== -1) {
            show = true;
            break;
          }
        }
        row.style.display = show ? '' : 'none';
      }
      updateRichListVisibleProjectCount();
    }
    // Expose so Filter + Order Escape-cancel can re-apply after restoring checkbox state
    window.__reviewsApplyTagToggleVisibility = applyTagToggleVisibility;
    document.addEventListener('DOMContentLoaded', function() {
      applyTagToggleVisibility();
      var container = document.getElementById('tagToggles');
      if (container) {
        container.addEventListener('change', function() {
          applyTagToggleVisibility();
          // Persist immediately (no re-render) so Refresh keeps the same hashtag filters
          sendMessageToPlugin('saveHiddenProjectTypeTags', {
            hiddenProjectTypeTags: getHiddenProjectTypeTagsFromDom()
          });
        });
      }
    });
    if (document.readyState !== 'loading') applyTagToggleVisibility();
  })();
</script>
`

/**
 * Listen for geometry changes and ask the plugin to persist windowRect.
 * Note: DOM `resize` covers size changes only; position (move) is saved on hide via onViewWillDisappear.
 */
export const resizeListenerScript: string = `
<script>
(function() {
  var debounceTimeout = null;
  function notifyWindowGeometryChanged(reason) {
    try {
      console.log('Projects List window geometry change (' + reason + ') -> windowResized');
      sendMessageToPlugin('windowResized', { actionType: 'windowResized', reason: reason });
    } catch (e) {
      console.log('windowResized notify failed', e && e.message);
    }
  }
  window.addEventListener('resize', function() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    // Debounce so continuous drag-resize does not spam the plugin.
    debounceTimeout = setTimeout(function() {
      notifyWindowGeometryChanged('resize');
    }, 1000);
  });
  // Expose so onViewWillDisappear can flush any pending resize save immediately.
  window.__reviewsNotifyWindowGeometryChanged = notifyWindowGeometryChanged;
  window.__reviewsClearResizeGeometryTimer = function() {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
  };
})();
</script>
`

export const windowCloseAndReopenScripts: string = `
<script>
/**
 * Event handler for when the window is re-opened. (This is a workaround for the fact that the window is not actually closed, but just hidden, and can be re-opened by the user without the data being refreshed.)
 * Note: this only works from v3.21.0
 */
window.addEventListener('onViewDidAppear', () => {
  console.log('onViewDidAppear event handler called for Project List window');
  refreshData();
});

/**
 * Internal function to refresh data when the window is re-opened.
 * Note: when this approach is copied into other plugins, it may need to have saved the 'disappear' time and only update if its been a long enough interval since then.
 */
function refreshData() {
  console.log('refreshData called for Project List window');
  try {
    var scrollPos = typeof window.__reviewsGetScrollPos === 'function' ? window.__reviewsGetScrollPos() : 0;
    sendMessageToPlugin('refresh', { scrollPos: scrollPos });
  } catch (e) {
    console.log('refreshData error', e && e.message);
  }
}

/**
 * Event handler for when the window is closed. (This is a workaround for the fact that the window is not actually closed, but just hidden, with timers still running.)
 * Note: this only works from v3.21.0
 * Also persists window position/size - the only reliable path for pure window *moves* (DOM resize does not fire for those).
 */
window.addEventListener('onViewWillDisappear', () => {
  console.log('onViewWillDisappear event handler called for Project List window');
  cancelAutoRefresh();
  if (typeof window.__reviewsClearResizeGeometryTimer === 'function') {
    window.__reviewsClearResizeGeometryTimer();
  }
  if (typeof window.__reviewsNotifyWindowGeometryChanged === 'function') {
    window.__reviewsNotifyWindowGeometryChanged('willDisappear');
  } else {
    try {
      sendMessageToPlugin('windowResized', { actionType: 'windowResized', reason: 'willDisappear' });
    } catch (e) {
      console.log('windowResized on disappear failed', e && e.message);
    }
  }
});

/**
 * Cancel any automatic updates.
 */
function cancelAutoRefresh() {
  console.log('cancelAutoRefresh called for Project List window');
  if (window.__reviewsAutoRefreshTimer) {
    clearInterval(window.__reviewsAutoRefreshTimer);
    window.__reviewsAutoRefreshTimer = null;
  }
}
</script>
`