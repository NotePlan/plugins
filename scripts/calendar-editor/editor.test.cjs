const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const { installCalendarEventEditor } = require('../../helpers/calendarEditor/editor')
const { createCalendarEditorBridge } = require('../../helpers/calendarEditor/bridge')
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
function setup(overrides = {}) {
  const dom = new JSDOM('<button id="launch">Open</button>', { url: 'https://calendar.test', runScripts: 'outside-only' })
  dom.window.HTMLElement.prototype.scrollIntoView = function() {}
  const calls = { saves: [], removes: [], refresh: [] }
  const host = {
    calendars: () => [{ id: 'work', title: 'Work', source: 'iCloud', isWritable: true }],
    capabilities: async () => ({ version: 1 }),
    save: async (data) => { calls.saves.push(data); return { ...data, id: 'saved' } },
    remove: async (event, scope) => { calls.removes.push({ event, scope }); return true },
    refresh: async (...args) => { calls.refresh.push(args) },
    ...overrides,
  }
  const install = dom.window.eval('(' + installCalendarEventEditor.toString() + ')')
  const editor = install(host)
  const doc = dom.window.document
  const field = (name) => doc.querySelector('form').elements.namedItem(name)
  function change(name, value) {
    const input = field(name)
    if (input.type === 'checkbox') input.checked = value; else input.value = value
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  }
  async function click(selector) {
    // Finish the repeat screen before using the main form's Save action.
    if (selector === '#ce-save' && doc.querySelector('#ce-recurrence').open) {
      doc.querySelector('[data-action="repeat-done"]').click(); await tick()
      if (doc.querySelector('#ce-recurrence').open) return
    }
    doc.querySelector(selector).click(); await tick()
  }
  return { dom, host, calls, editor, doc, field, change, click, close: () => dom.window.close() }
}
const timed = { id: 'event', calendar: 'Work', calendarID: 'work', title: 'Planning', date: '2026-09-14T09:00:00', endDate: '2026-09-14T10:30:00', isAllDay: false, isCalendarWritable: true, notes: 'Agenda', url: 'https://example.com', location: 'Room 2', availability: 1 }

test('timed event round-trip preserves times, clears fields, and addresses the calendar by ID', async () => {
  const t = setup(); await t.editor.open({ event: timed })
  t.change('notes', ''); t.change('url', ''); t.change('location', '')
  await t.click('#ce-save')
  assert.equal(t.calls.saves.length, 1)
  const data = t.calls.saves[0]
  assert.equal(data.isAllDay, false); assert.equal(data.date.getHours(), 9); assert.equal(data.endDate.getMinutes(), 30)
  assert.equal(data.notes, ''); assert.equal(data.url, ''); assert.equal(data.location, ''); assert.equal(data.calendarID, 'work'); assert.equal(data.availability, 1)
  assert.equal(t.doc.querySelector('.ce-overlay').hidden, true); t.close()
})
test('exclusive all-day end is displayed inclusively and round-trips without adding a day', async () => {
  const t = setup(); await t.editor.open({ event: { ...timed, isAllDay: true, date: '2026-09-14T00:00:00', endDate: '2026-09-17T00:00:00' } })
  assert.equal(t.field('endDate').value, '2026-09-16')
  await t.click('#ce-save'); assert.equal(t.calls.saves[0].endDate.getDate(), 17); assert.equal(t.calls.saves[0].endDate.getHours(), 0); t.close()
})
test('new all-day event saves one calendar day even across daylight-saving changes', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 2, 8) }); t.change('title', 'Day off')
  await t.click('#ce-save'); const data = t.calls.saves[0]
  assert.equal(data.date.getDate(), 8); assert.equal(data.endDate.getDate(), 9); assert.equal(data.endDate.getHours(), 0); t.close()
})
test('invalid dates, empty title and reversed times do not write', async () => {
  const t = setup(); await t.editor.open({ event: timed }); t.change('title', ''); await t.click('#ce-save')
  assert.match(t.doc.querySelector('#ce-error').textContent, /title/)
  t.change('title', 'Valid'); t.change('endTime', '08:00'); await t.click('#ce-save'); assert.equal(t.calls.saves.length, 0)
  t.change('startDate', ''); await t.click('#ce-save'); assert.equal(t.calls.saves.length, 0); t.close()
})
test('save failure keeps the draft and duplicate submission is prevented', async () => {
  let reject; let count = 0
  const t = setup({ save: () => { count++; return new Promise((_, r) => { reject = r }) } })
  await t.editor.open({ event: timed }); t.change('title', 'Keep this draft'); await t.click('#ce-save')
  t.doc.querySelector('form').dispatchEvent(new t.dom.window.Event('submit', { cancelable: true })); assert.equal(count, 1)
  reject(new Error('Offline')); await tick()
  assert.equal(t.doc.querySelector('.ce-overlay').hidden, false); assert.equal(t.field('title').value, 'Keep this draft'); assert.match(t.doc.querySelector('#ce-error').textContent, /Offline/); t.close()
})
test('undefined create result is a failure', async () => {
  const t = setup({ save: async () => undefined }); await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Unsaved')
  await t.click('#ce-save'); assert.equal(t.doc.querySelector('.ce-overlay').hidden, false); assert.match(t.doc.querySelector('#ce-error').textContent, /did not save/); t.close()
})
test('read-only calendars and failed lookup cannot be mutated', async () => {
  for (const overrides of [{}, { load: async () => { throw new Error('Missing occurrence') } }]) {
    const t = setup(overrides); await t.editor.open({ event: { ...timed, isCalendarWritable: false } })
    assert.equal(t.doc.querySelector('#ce-save').hidden, true); assert.equal(t.field('title').disabled, true)
    assert.equal(t.doc.querySelector('[data-action="close"]').disabled, false); t.close()
  }
})
test('custom weekly recurrence and occurrence count reach the bridge', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Standup')
  t.change('repeat', 'custom'); t.change('frequency', 'weekly'); t.change('interval', '2'); t.change('repeatEnd', 'count'); t.change('count', '8')
  await t.click('[data-day="4"]'); await t.click('#ce-save')
  const rule = t.calls.saves[0].recurrenceRules[0]
  assert.equal(rule.frequency, 'weekly'); assert.equal(rule.interval, 2); assert.equal(rule.occurrenceCount, 8)
  assert.deepEqual(Array.from(rule.daysOfWeek, (day) => day.dayOfWeek), [2, 4]); t.close()
})
test('monthly last weekday and date termination are serialized', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Review')
  t.change('repeat', 'custom'); t.change('frequency', 'monthly'); t.change('monthlyMode', 'weekday'); t.change('ordinal', '-1'); t.change('ordinalDay', '6'); t.change('repeatEnd', 'date'); t.change('until', '2026-12-31')
  await t.click('#ce-save'); const rule = t.calls.saves[0].recurrenceRules[0]
  assert.equal(rule.daysOfWeek[0].weekNumber, -1); assert.equal(rule.daysOfWeek[0].dayOfWeek, 6); assert.equal(rule.endDate.getMonth(), 11); t.close()
})
test('unchanged complex recurrence and alerts are omitted, and occurrence scope is explicit', async () => {
  const t = setup(); const original = { ...timed, isRecurring: true, recurrenceRules: [{ frequency: 'yearly', interval: 1, weeksOfYear: [7] }], alertOffsets: [100], hasComplexAlerts: true }
  await t.editor.open({ event: original }); t.change('title', 'New name'); await t.click('#ce-save')
  assert.equal(t.calls.saves.length, 0); assert.equal(t.field('repeat').value, 'preserve')
  await t.click('[data-action="this"]'); const data = t.calls.saves[0]
  assert.equal(data.scope, 'this'); assert.equal('recurrenceRules' in data, false); assert.equal('alertOffsets' in data, false); t.close()
})
test('removing recurrence only offers future scope', async () => {
  const t = setup(); await t.editor.open({ event: { ...timed, isRecurring: true, recurrenceRules: [{ frequency: 'weekly', interval: 1 }] } })
  t.change('repeat', 'none'); await t.click('#ce-save'); assert.equal(t.doc.querySelector('[data-action="this"]').hidden, true)
  await t.click('[data-action="confirm"]'); assert.equal(t.calls.saves[0].scope, 'future'); assert.equal(t.calls.saves[0].recurrenceRules.length, 0); t.close()
})
test('deleting a recurring occurrence asks scope and reports errors inline', async () => {
  const t = setup({ remove: async () => { throw new Error('Denied') } }); await t.editor.open({ event: { ...timed, isRecurring: true } })
  await t.click('[data-action="delete"]'); await t.click('[data-action="this"]')
  assert.equal(t.doc.querySelector('.ce-overlay').hidden, false); assert.match(t.doc.querySelector('#ce-error').textContent, /Denied/); t.close()
})
test('unsaved dismissal asks before discarding and restores focus', async () => {
  const t = setup(); t.doc.querySelector('#launch').focus(); await t.editor.open({ event: timed }); t.change('title', 'Changed')
  await t.click('[data-action="close"]'); assert.equal(t.doc.querySelector('.ce-overlay').hidden, false)
  await t.click('[data-action="confirm"]'); assert.equal(t.doc.querySelector('.ce-overlay').hidden, true); assert.equal(t.doc.activeElement.id, 'launch'); t.close()
})
test('legacy bridge keeps recurring events read-only', async () => {
  const t = setup({ capabilities: async () => null }); await t.editor.open({ event: { ...timed, isRecurring: true } })
  assert.equal(t.doc.querySelector('#ce-save').hidden, true); assert.equal(t.field('repeat').disabled, true); t.close()
})
test('duplicate calendar titles select and save the intended calendar ID', async () => {
  const t = setup({ calendars: () => [{ id: 'personal', title: 'Work', source: 'Local' }, { id: 'work', title: 'Work', source: 'iCloud' }] })
  await t.editor.open({ event: timed }); assert.equal(t.field('calendar').value, 'work'); t.change('calendar', 'personal'); await t.click('#ce-save')
  assert.equal(t.calls.saves[0].calendarID, 'personal'); assert.equal(t.calls.saves[0].calendar, 'Work'); t.close()
})
test('bridge uses original occurrence identity after a date edit', async () => {
  let request
  const context = { Calendar: { eventEditorCapabilities: async () => ({ version: 1 }), saveEvent: async (data) => { request = data; return data } } }
  vm.createContext(context); vm.runInContext(createCalendarEditorBridge.toString(), context)
  const bridge = context.createCalendarEditorBridge({})
  await bridge.save({ ...timed, date: '2026-10-01T09:00:00', scope: 'future' }, timed)
  assert.equal(request.originalStartDate, timed.date); assert.equal(request.originalCalendarID, 'work'); assert.equal(request.date, '2026-10-01T09:00:00')
})
test('both standalone plugins render and their embedded JavaScript parses', () => {
  for (const plugin of ['emetzger.Calendar', 'emetzger.LinearCalendar']) {
    const source = fs.readFileSync(plugin + '/script.js', 'utf8'); const context = vm.createContext({})
    vm.runInContext(source, context); const html = context.getCalendarHTML(2026)
    const dom = new JSDOM(html)
    for (const script of dom.window.document.querySelectorAll('script:not([src])')) new vm.Script(script.textContent)
    assert.match(html, /const eventEditor = installCalendarEventEditor/)
    dom.window.close()
  }
})
test('custom monthly dates and yearly months can be selected independently', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Quarterly review')
  t.change('repeat', 'custom'); t.change('frequency', 'yearly'); await t.click('[data-month="3"]'); await t.click('#ce-save')
  const rule = t.calls.saves[0].recurrenceRules[0]
  assert.deepEqual(Array.from(rule.monthsOfYear), [3, 9]); assert.equal('daysOfMonth' in rule, false); t.close()
})
test('empty weekday and month selections are rejected', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Review')
  t.change('repeat', 'custom'); t.change('frequency', 'weekly'); await t.click('[data-day="2"]'); await t.click('#ce-save'); assert.equal(t.calls.saves.length, 0)
  t.change('frequency', 'yearly'); await t.click('[data-month="9"]'); await t.click('#ce-save'); assert.equal(t.calls.saves.length, 0); t.close()
})
test('both views open the clicked recurring occurrence, preserving timed data', async () => {
  for (const plugin of ['emetzger.Calendar', 'emetzger.LinearCalendar']) {
    const context = vm.createContext({}); vm.runInContext(fs.readFileSync(plugin + '/script.js', 'utf8'), context)
    const now = new Date(); now.setDate(14); now.setHours(9,0,0,0)
    const later = new Date(now); later.setDate(21)
    const events = [now, later].map((start) => ({ ...timed, date: start.toISOString(), endDate: new Date(start.getTime()+5400000).toISOString(), isRecurring: true, originalStartDate: start.toISOString(), color: '#d96512' }))
    const loaded = []
    const dom = new JSDOM(context.getCalendarHTML(now.getFullYear()), {url:'https://calendar.test', runScripts:'dangerously', pretendToBeVisual:true, beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addEventListener() {} })
      window.HTMLElement.prototype.scrollIntoView = function() {}
      window.Calendar = {
        availableCalendars: async () => [{id:'work', title:'Work', source:'iCloud', color:'#d96512', isWritable:true, isEnabled:true}],
        eventsBetween: async () => events,
        eventEditorCapabilities: async () => ({version:1}),
        eventForEditing: async (request) => { loaded.push(request); return events.find((event) => event.date === request.originalStartDate) },
      }
    }})
    await tick(); await tick(); await tick()
    const candidates = plugin.includes('Linear') ? Array.from(dom.window.document.querySelectorAll('.event-segment')) : Array.from(dom.window.document.querySelectorAll('[data-event-start]'))
    assert.ok(candidates.length >= 2, plugin + ' renders separate occurrences')
    candidates[candidates.length-1].click(); await tick(); await tick()
    assert.equal(loaded.length, 1, plugin); assert.equal(loaded[0].originalStartDate, later.toISOString(), plugin)
    assert.equal(dom.window.document.querySelector('[name="allDay"]').checked, false)
    assert.equal(dom.window.document.querySelector('[name="startTime"]').value, '09:00')
    dom.window.close()
  }
})
test('new timed events use the selected slot and a one-hour duration', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14, 14, 30), isAllDay: false }); t.change('title', 'Afternoon review')
  assert.equal(t.field('startTime').value, '14:30'); assert.equal(t.field('endTime').value, '15:30')
  await t.click('#ce-save'); assert.equal(t.calls.saves[0].isAllDay, false); t.close()
})
test('moving an all-day event across DST keeps its number of calendar days', async () => {
  const t = setup(); await t.editor.open({ event: {...timed, isAllDay: true, date:'2026-03-07T00:00:00', endDate:'2026-03-09T00:00:00'} })
  t.change('startDate', '2026-03-08'); assert.equal(t.field('endDate').value, '2026-03-09'); t.close()
})

test('repeat screen traps focus, validates before Done, and returns to the draft on Escape', async () => {
  const t = setup(); await t.editor.open({ start: new Date(2026, 8, 14) })
  t.change('title', 'Standup'); t.change('repeat', 'custom'); t.change('frequency', 'weekly')
  assert.equal(t.doc.querySelector('#ce-recurrence').open, true)
  assert.ok(t.field('title').closest('[inert]'))
  assert.equal(t.doc.activeElement.dataset.action, 'repeat-done')
  await t.click('[data-day="2"]'); await t.click('[data-action="repeat-done"]')
  assert.equal(t.doc.querySelector('#ce-recurrence').open, true)
  assert.match(t.doc.querySelector('#ce-repeat-error').textContent, /at least one day/)
  await t.click('[data-day="4"]'); await t.click('[data-action="repeat-done"]')
  assert.equal(t.doc.querySelector('#ce-recurrence').open, false)
  assert.equal(t.doc.querySelectorAll('[inert]').length, 0)
  assert.equal(t.doc.activeElement, t.field('repeat'))
  await t.click('#ce-repeat-heading')
  t.doc.dispatchEvent(new t.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(t.doc.querySelector('#ce-recurrence').open, false)
  assert.equal(t.doc.querySelector('.ce-overlay').hidden, false)
  assert.equal(t.field('title').value, 'Standup')
  await t.click('#ce-repeat-heading')
  t.doc.querySelector('form').dispatchEvent(new t.dom.window.Event('submit', { cancelable: true }))
  assert.equal(t.doc.querySelector('#ce-recurrence').open, false)
  assert.equal(t.calls.saves.length, 0)
  await t.click('#ce-save'); assert.equal(t.calls.saves[0].recurrenceRules[0].daysOfWeek[0].dayOfWeek, 4)
  t.close()
})

test('new drafts remember the last saved writable calendar and fall back when it disappears', async () => {
  let calendars = [{ id: 'work', title: 'Work' }, { id: 'home', title: 'Home' }]
  const t = setup({ calendars: () => calendars })
  await t.editor.open({ start: new Date(2026, 8, 14) }); t.change('title', 'Home event'); t.change('calendar', 'home')
  await t.click('#ce-save'); await t.editor.open({ start: new Date(2026, 8, 15) })
  assert.equal(t.field('calendar').value, 'home')
  assert.equal(t.dom.window.localStorage.getItem('noteplan.calendarEditor.lastCalendarID'), 'home')
  await t.click('[data-action="close"]'); calendars = [calendars[0]]
  await t.editor.open({ start: new Date(2026, 8, 16) }); assert.equal(t.field('calendar').value, 'work'); t.close()
})
