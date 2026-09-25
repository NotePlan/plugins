/* eslint-env node */
// Bundle the shared editor into both standalone plugins without a runtime dependency.
const fs = require('fs')
const path = require('path')
const { installCalendarEventEditor } = require('../../helpers/calendarEditor/editor')
const { createCalendarEditorBridge } = require('../../helpers/calendarEditor/bridge')
const begin = '// BEGIN SHARED CALENDAR EDITOR (generated; edit helpers/calendarEditor)'
const end = '// END SHARED CALENDAR EDITOR'
const bundle = `${begin}\n${createCalendarEditorBridge.toString()}\n\n${installCalendarEventEditor.toString()}\n${end}\n`
let changed = false
for (const plugin of ['emetzger.Calendar', 'emetzger.LinearCalendar']) {
  const file = path.resolve(__dirname, '../../', plugin, 'script.js')
  const before = fs.readFileSync(file, 'utf8')
  const start = before.indexOf(begin)
  const after = start < 0 ? `${bundle}\n${before}` : before.slice(0, start) + bundle + before.slice(before.indexOf(end, start) + end.length + 1)
  if (before !== after) {
    changed = true
    if (!process.argv.includes('--check')) fs.writeFileSync(file, after)
  }
}
if (process.argv.includes('--check') && changed) {
  console.error('Calendar editor bundles are stale. Run node scripts/calendar-editor/build.js')
  process.exitCode = 1
}
