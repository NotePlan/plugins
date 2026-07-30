#!/usr/bin/env node
'use strict'

// Lines matching any pattern here are dropped before they ever enter nplog's
// buffer -- not dimmed, not filterable back in, just gone. Reserve this for
// noise that carries zero signal on every viewing (a known-benign warning
// that fires constantly), not for things you'd occasionally want to see with
// a broader filter. If in doubt, leave it visible.
//
// Add entries as plain RegExp literals. Matched against each entry's text
// (post-marker-strip, pre-timestamp-dim), so no need to anchor on JSLog: or a
// leading timestamp.

module.exports = [
  // NotePlan logs this once per malformed/incomplete command entry in a
  // plugin.json -- harmless and constant across nearly every session, so it
  // just buries real output.
  /Skipping plugin command 'unknown': 'name' or 'jsFunction' missing in plugin\.json/,

  // Fires whenever an update check lands while another install/update is
  // already in flight -- expected under normal auto-update churn, not a
  // real failure worth surfacing.
  /Plugin update failed: Already installing other plugins\./,
]
