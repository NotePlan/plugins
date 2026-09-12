// BEGIN SHARED CALENDAR EDITOR (generated; edit helpers/calendarEditor)
function createCalendarEditorBridge(config) {
  let capabilitiesPromise
  async function capabilities() {
    if (!capabilitiesPromise) {
      capabilitiesPromise = Promise.resolve()
        .then(() => Calendar.eventEditorCapabilities())
        .catch(() => null)
    }
    const result = await capabilitiesPromise
    return result && result.version === 1 ? result : null
  }
  function identity(event) {
    return { id: event.id, originalStartDate: event.originalStartDate || event.date || event.startDate, originalCalendarID: event.calendarID }
  }
  return {
    calendars: config.calendars,
    capabilities,
    async load(event) {
      if (await capabilities()) return Calendar.eventForEditing(identity(event))
      // Legacy eventByID may return the series master. Keep recurring snapshots read-only.
      if (event.isRecurring) return event
      try {
        return await Calendar.eventByID(event.id)
      } catch (_) {
        return Object.assign({}, event, { editorReadOnly: true })
      }
    },
    async save(data, original) {
      if (await capabilities()) return Calendar.saveEvent(Object.assign({}, data, original ? identity(original) : {}))
      if (original && original.isRecurring) throw new Error('Update NotePlan to edit recurring events here.')
      return original ? Calendar.update(data) : Calendar.add(data)
    },
    async remove(event, scope) {
      if (await capabilities()) return Calendar.removeEvent(Object.assign(identity(event), { scope }))
      if (event.isRecurring) throw new Error('Update NotePlan to edit recurring events here.')
      return Calendar.remove(event)
    },
    refresh: config.refresh,
    onClose: config.onClose,
    onRefreshError: config.onRefreshError,
  }
}

function installCalendarEventEditor(host) {
  function alertOptions() {
    return `<option value="none">None</option>${[
      [0, 'At time of event'],
      [-300, '5 minutes before'],
      [-600, '10 minutes before'],
      [-900, '15 minutes before'],
      [-1800, '30 minutes before'],
      [-3600, '1 hour before'],
      [-7200, '2 hours before'],
      [-86400, '1 day before'],
      [-172800, '2 days before'],
      [-604800, '1 week before'],
    ]
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('')}`
  }
  const root = document.createElement('div')
  root.className = 'ce-overlay'
  root.hidden = true
  root.innerHTML = `
    <section class="ce-dialog" role="dialog" aria-modal="true" aria-labelledby="ce-heading">
      <header class="ce-header"><h2 id="ce-heading">Add Event</h2></header>
      <form novalidate>
        <div class="ce-body">
          <div class="ce-identity">
            <label class="ce-sr" for="ce-title">Event title</label>
            <input id="ce-title" name="title" class="ce-title" placeholder="New Event" autocomplete="off" required>
            <label class="ce-sr" for="ce-location">Location</label>
            <input id="ce-location" name="location" placeholder="Location" autocomplete="off">
          </div>
          <p class="ce-notice" id="ce-notice" hidden></p>
          <fieldset class="ce-group"><legend>Schedule</legend>
            <div class="ce-row"><label for="ce-allDay">All Day</label><input id="ce-allDay" name="allDay" type="checkbox" role="switch"></div>
            <div class="ce-row"><label for="ce-startDate">Starts</label><div class="ce-datetime"><input id="ce-startDate" name="startDate" type="date" required><input aria-label="Start time" name="startTime" type="time" required></div></div>
            <div class="ce-row"><label for="ce-endDate">Ends</label><div class="ce-datetime"><input id="ce-endDate" name="endDate" type="date" required><input aria-label="End time" name="endTime" type="time" required></div></div>
            <div class="ce-row"><label for="ce-repeat">Repeat</label><select id="ce-repeat" name="repeat"><option value="none">Never</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option><option value="custom">Custom…</option><option value="preserve" hidden>Existing repeat schedule</option></select></div>
            <details id="ce-recurrence" class="ce-recurrence" hidden><summary id="ce-repeat-heading">Repeat options <span id="ce-repeat-description"></span></summary><button type="button" data-action="repeat-done" class="ce-repeat-done">Done</button><div class="ce-repeat-fields">
              <div class="ce-row"><label for="ce-frequency">Frequency</label><select id="ce-frequency" name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
              <div class="ce-row"><label for="ce-interval">Every</label><div class="ce-inline"><input id="ce-interval" name="interval" type="number" min="1" max="999" value="1"><span id="ce-unit">weeks</span></div></div>
              <div id="ce-weekdays" class="ce-weekdays" role="group" aria-label="Repeat on weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                .map((day, i) => `<button type="button" data-day="${i + 1}" aria-pressed="false" aria-label="${day}">${day}</button>`)
                .join('')}</div>
              <div class="ce-row" id="ce-monthly"><label for="ce-monthlyMode">On</label><select id="ce-monthlyMode" name="monthlyMode"><option value="date">Day of the month</option><option value="weekday">Weekday of the month</option></select></div>
              <div id="ce-months" class="ce-choice-grid ce-months" role="group" aria-label="Repeat in months">${[
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec',
              ]
                .map((month, i) => `<button type="button" data-month="${i + 1}" aria-pressed="false">${month}</button>`)
                .join('')}</div>
              <div id="ce-monthdays" class="ce-choice-grid ce-monthdays" role="group" aria-label="Repeat on days of the month">${Array.from(
                { length: 31 },
                (_, i) => `<button type="button" data-monthday="${i + 1}" aria-pressed="false">${i + 1}</button>`,
              ).join('')}</div>
              <div class="ce-row" id="ce-ordinal-row"><label for="ce-ordinal">Which week</label><select id="ce-ordinal" name="ordinal"><option value="1">First</option><option value="2">Second</option><option value="3">Third</option><option value="4">Fourth</option><option value="-1">Last</option></select><select name="ordinalDay" aria-label="Day of week">${[
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ]
                .map((day, i) => `<option value="${i + 1}">${day}</option>`)
                .join('')}</select></div>
              <div class="ce-row"><label for="ce-repeatEnd">End repeat</label><select id="ce-repeatEnd" name="repeatEnd"><option value="never">Never</option><option value="date">On date</option><option value="count">After occurrences</option></select></div>
              <div class="ce-row" id="ce-until-row"><label for="ce-until">Last day</label><input id="ce-until" name="until" type="date"></div>
              <div class="ce-row" id="ce-count-row"><label for="ce-count">Occurrences</label><input id="ce-count" name="count" type="number" min="1" max="9999" value="10"></div>
              <p class="ce-hint" id="ce-repeat-summary" aria-live="polite"></p><p class="ce-error" id="ce-repeat-error" role="alert" hidden></p></div>
            </details>
            <p class="ce-hint" id="ce-repeat-help"></p>
          </fieldset>
          <fieldset class="ce-group"><legend>Details</legend>
            <div class="ce-row" id="ce-alert-row"><label for="ce-alert">Alert</label><select name="alert" id="ce-alert">${alertOptions()}</select></div>
            <div class="ce-row" id="ce-second-alert-row"><label for="ce-secondAlert">2nd Alert</label><select name="secondAlert" id="ce-secondAlert">${alertOptions()}</select></div>
            <div class="ce-row"><label for="ce-calendar">Calendar</label><select id="ce-calendar" name="calendar" required></select></div>
            <p class="ce-hint" id="ce-alert-help" hidden>Existing custom alerts will be preserved. Manage them in Apple Calendar.</p>
            <div class="ce-url"><label class="ce-sr" for="ce-url">URL</label><input id="ce-url" name="url" type="url" placeholder="URL"></div>
            <div class="ce-notes"><label class="ce-sr" for="ce-notes">Notes</label><textarea id="ce-notes" name="notes" rows="4" placeholder="Notes"></textarea></div>
            <div class="ce-row" id="ce-attendees-row" hidden><span>Invitees</span><span id="ce-attendees"></span></div>
          </fieldset>
          <button type="button" data-action="delete" class="ce-delete">Delete event…</button>
          <p class="ce-error" role="alert" id="ce-error" hidden></p>
          <div class="ce-confirm" id="ce-confirm" hidden><p id="ce-confirm-text"></p><div class="ce-actions"><button type="button" data-action="keep">Keep editing</button><button type="button" data-action="this" hidden>This event only</button><button type="button" data-action="confirm" class="ce-danger">Discard changes</button></div></div>
        </div>
        <footer class="ce-footer"><button type="button" data-action="close">Cancel</button><button type="submit" class="ce-primary" id="ce-save">Add</button></footer>
      </form>
    </section>`
  const style = document.createElement('style')
  style.textContent = `
    .ce-overlay{--ce-bg:#fff;--ce-surface:#f3f4f6;--ce-text:#151d2d;--ce-label:#3c4658;--ce-muted:#9ba3b2;--ce-line:#d2d6de;--ce-accent:#df7600;--ce-focus:#4082ff;--ce-danger:#c33030;position:fixed;inset:0;z-index:10000;background:rgba(30,35,45,.12);display:flex;align-items:center;justify-content:center;padding:18px;color:var(--ce-text);font:15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left}
    .ce-overlay [hidden],.ce-overlay[hidden]{display:none!important}
    .ce-overlay *{box-sizing:border-box}
    .ce-dialog{position:relative;width:420px;max-width:100%;max-height:calc(100dvh - 36px);background:var(--ce-bg);border:0;border-radius:16px;box-shadow:0 16px 70px #20283818;overflow:hidden;display:flex;flex-direction:column}
    .ce-header{padding:22px 20px 24px;flex-shrink:0}
    .ce-header h2{font-size:23px;line-height:1.2;font-weight:700;letter-spacing:-.5px;color:var(--ce-text);margin:0}
    .ce-overlay button{font:inherit;cursor:pointer;border:1px solid var(--ce-line);background:var(--ce-bg);color:var(--ce-text);border-radius:9px;min-height:36px;padding:7px 12px}
    .ce-overlay button:hover{background:var(--ce-surface)}
    .ce-overlay button:disabled{opacity:.45;cursor:default}
    .ce-dialog form{display:flex;flex-direction:column;min-height:0;margin:0}
    .ce-body{padding:4px 20px 0;overflow-y:auto;overscroll-behavior:contain}
    .ce-overlay input,.ce-overlay select,.ce-overlay textarea{font:inherit;line-height:1.3;color:var(--ce-text);background:var(--ce-bg);border:1px solid var(--ce-line);border-radius:9px;padding:9px 12px;min-width:0;max-width:100%;margin:0}
    .ce-overlay :focus-visible{outline:2px solid var(--ce-focus);outline-offset:0}
    .ce-identity{display:grid;gap:12px;padding:0 0 8px}
    .ce-identity input{display:block;width:100%;min-height:42px}
    .ce-identity .ce-title{font-size:15px;font-weight:400;letter-spacing:0}
    .ce-overlay input::placeholder,.ce-overlay textarea::placeholder{color:var(--ce-muted);opacity:1}
    .ce-group{border:0;margin:0;padding:0;background:transparent;min-width:0}
    .ce-group legend,.ce-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
    .ce-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:5px 0}
    .ce-row>label,.ce-row>span:first-child{flex-shrink:0;color:var(--ce-label)}
    .ce-row>input:not([type=checkbox]),.ce-row>select{flex:1;text-align:right;max-width:74%}
    .ce-overlay select{appearance:none;-webkit-appearance:none;border-color:transparent;padding:8px 25px 8px 4px;text-align-last:right;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%239ba3b2' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 3px center}
    .ce-datetime{display:flex;justify-content:flex-end;gap:8px;min-width:0}
    .ce-datetime input{padding:7px 8px;min-height:36px;font-variant-numeric:tabular-nums}
    .ce-datetime input[type=date]{width:134px}.ce-datetime input[type=time]{width:117px}
    .ce-overlay input[type=checkbox]{appearance:none;-webkit-appearance:none;position:relative;width:38px;height:22px;background:#e4e6eb;border-radius:14px;border:0;cursor:pointer;padding:0;flex-shrink:0;margin-right:3px}
    .ce-overlay input[type=checkbox]:after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0003;transition:transform .15s}
    .ce-overlay input[type=checkbox]:checked{background:var(--ce-accent)}.ce-overlay input[type=checkbox]:checked:after{transform:translateX(16px)}
    .ce-url{padding-top:8px}.ce-url input{width:100%;min-height:42px}
    .ce-notes{padding:12px 0 0}.ce-notes textarea{display:block;width:100%;resize:vertical;min-height:100px;line-height:1.5}
    .ce-hint{font-size:12px;line-height:1.5;color:var(--ce-label);margin:8px 0 10px}.ce-hint:empty{display:none}
    .ce-footer{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:12px;padding:18px 20px;flex-shrink:0;background:var(--ce-bg)}
    .ce-footer button{min-height:42px;font-weight:600;border:0;background:var(--ce-surface);color:var(--ce-label)}
    .ce-overlay .ce-primary{background:var(--ce-accent);border-color:var(--ce-accent);color:#fff;font-weight:600}.ce-overlay .ce-primary:hover{filter:brightness(.94)}
    .ce-overlay .ce-delete{border:0;color:var(--ce-danger);padding:6px 0;background:transparent;font-size:13px;margin-top:5px}
    .ce-error,.ce-notice,.ce-confirm{padding:12px;border-radius:9px;line-height:1.5;margin:12px 0 0;background:var(--ce-surface);font-size:13px}.ce-error{color:var(--ce-danger);border:1px solid var(--ce-danger)}
    .ce-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:10px}.ce-overlay .ce-danger{color:var(--ce-danger)}
    .ce-inline{display:flex;align-items:center;gap:6px}.ce-overlay input[type=number]{width:65px;text-align:right}
    .ce-choice-grid{display:grid;gap:6px;padding:12px 0}.ce-months{grid-template-columns:repeat(4,1fr)}.ce-monthdays{grid-template-columns:repeat(7,1fr)}
    .ce-choice-grid button{padding:4px;font-size:13px;min-height:34px}.ce-choice-grid button[aria-pressed=true],.ce-weekdays button[aria-pressed=true]{background:var(--ce-accent);border-color:var(--ce-accent);color:white}
    .ce-weekdays{display:flex;gap:5px;padding:12px 0}.ce-weekdays button{padding:5px 0;flex:1;font-size:12px}
    .ce-recurrence summary{cursor:pointer;padding:8px 0;color:var(--ce-label);font-size:13px}.ce-recurrence summary span{float:right;font-size:12px;max-width:60%;text-align:right}
    .ce-recurrence .ce-repeat-done{display:none}
    .ce-dialog:has(.ce-recurrence[open]){height:min(600px,calc(100dvh - 36px))}
    .ce-recurrence[open] .ce-repeat-fields{position:absolute;inset:76px 20px 20px;overflow-y:auto;overscroll-behavior:contain}
    .ce-recurrence[open]{position:absolute;inset:0;z-index:2;background:var(--ce-bg);padding:20px;overflow:hidden}
    .ce-recurrence[open]>summary{list-style:none;font-size:22px;line-height:1.3;font-weight:700;color:var(--ce-text);padding:3px 65px 24px 0;pointer-events:none}
    .ce-recurrence[open]>summary::-webkit-details-marker{display:none}.ce-recurrence[open]>summary span{display:none}
    .ce-recurrence[open] .ce-repeat-done{display:block;position:absolute;top:18px;right:20px;border:0;color:var(--ce-focus);font-weight:600}
    #ce-attendees{max-width:75%;text-align:right;overflow-wrap:anywhere;color:var(--ce-label)}
    @media(prefers-color-scheme:dark){.ce-overlay{color-scheme:dark;--ce-bg:#252528;--ce-surface:#35353a;--ce-text:#f0f0f2;--ce-label:#d0d0d9;--ce-muted:#91919e;--ce-line:#51515a;--ce-accent:#df7600;--ce-focus:#70a2ff;--ce-danger:#ff8585;background:#0005}.ce-overlay input[type=checkbox]:not(:checked){background:#55555e}}
    @media(max-width:440px){.ce-overlay{padding:10px}.ce-dialog{max-height:calc(100dvh - 20px)}.ce-header{padding:20px 18px}.ce-body{padding:4px 18px 0}.ce-footer{padding:16px 18px}.ce-row{gap:6px}.ce-datetime{gap:6px}.ce-datetime input[type=date]{width:128px}.ce-datetime input[type=time]{width:110px}}
    @media(max-width:360px){.ce-datetime{flex-wrap:wrap}.ce-datetime input[type=date],.ce-datetime input[type=time]{width:125px}}
    @media(prefers-reduced-motion:reduce){.ce-overlay input[type=checkbox]:after{transition:none}}
  `
  document.head.appendChild(style)
  document.body.appendChild(root)
  const form = root.querySelector('form')
  const field = (name) => form.elements.namedItem(name)
  const el = (id) => root.querySelector(`#ce-${id}`)
  let event = null
  let busy = false
  let readOnly = false
  let baseline = ''
  let previousFocus = null
  let confirmation = null
  let previousDates = null
  let saved = false
  let selectedDays = new Set()
  let selectedMonthDays = new Set()
  let selectedMonths = new Set()
  let advanced = false
  let repeatBaseline = ''
  let alertBaseline = ''
  let pendingData = null
  let opening = 0
  let repeatPanelBranches = []
  let lastCalendar = ''
  try {
    lastCalendar = localStorage.getItem('noteplan.calendarEditor.lastCalendarID') || ''
  } catch (_) {
    // Some embedded web views disable storage; retain the preference for this view.
  }
  function setRepeatPanel(openPanel, restoreFocus = true) {
    el('recurrence').open = openPanel
    repeatPanelBranches.forEach((branch) => branch.removeAttribute('inert'))
    repeatPanelBranches = []
    if (openPanel) {
      // Hide the covered form from keyboard and assistive technology as well as sight.
      let branch = el('recurrence')
      while (branch !== root.querySelector('.ce-dialog')) {
        Array.from(branch.parentElement.children).forEach((sibling) => {
          if (sibling !== branch) {
            sibling.setAttribute('inert', '')
            repeatPanelBranches.push(sibling)
          }
        })
        branch = branch.parentElement
      }
    }
    root.querySelector('.ce-dialog').setAttribute('aria-labelledby', openPanel ? 'ce-repeat-heading' : 'ce-heading')
    if (restoreFocus) {
      if (openPanel) root.querySelector('[data-action="repeat-done"]').focus()
      else field('repeat').focus()
    }
  }
  el('recurrence').addEventListener('toggle', () => {
    if (el('recurrence').open !== !!repeatPanelBranches.length) setRepeatPanel(el('recurrence').open)
  })
  // Only a verified host adapter may opt in to writing recurrence rules.
  let recurrence = null
  function repeatSnapshot() {
    return JSON.stringify(
      ['repeat', 'frequency', 'interval', 'monthlyMode', 'ordinal', 'ordinalDay', 'repeatEnd', 'until', 'count']
        .map((name) => field(name).value)
        .concat([Array.from(selectedDays).sort(), Array.from(selectedMonthDays).sort(), Array.from(selectedMonths).sort()]),
    )
  }
  function alertSnapshot() {
    return `${field('alert').value},${field('secondAlert').value}`
  }

  function dateText(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  }
  function timeText(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  function parseDate(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return new Date(NaN)
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const value = new Date(year, month - 1, day, hour, minute)
    if (dateText(value) !== date || timeText(value) !== time) return new Date(NaN)
    return value
  }
  function snapshot() {
    return JSON.stringify(
      Array.from(form.elements)
        .filter((item) => item.name)
        .map((item) => [item.name, item.type === 'checkbox' ? item.checked : item.value])
        .concat([Array.from(selectedDays).sort(), Array.from(selectedMonthDays).sort(), Array.from(selectedMonths).sort()]),
    )
  }
  function error(message) {
    el('error').textContent = message
    el('error').hidden = !message
    if (!message) el('repeat-error').hidden = true
  }
  function setBusy(value) {
    busy = value
    root.setAttribute('aria-busy', String(value))
    Array.from(form.elements).forEach((item) => {
      item.disabled = value || readOnly
    })
    root.querySelectorAll('[data-action="close"], [data-action="keep"]').forEach((item) => {
      item.disabled = value
    })
    field('repeat').disabled = value || readOnly || !recurrence
    field('location').disabled = value || readOnly || !advanced
    field('alert').disabled = value || readOnly || !advanced || !!(event && event.hasComplexAlerts)
    field('secondAlert').disabled = field('alert').disabled
    el('save').textContent = value ? 'Saving…' : event ? 'Save' : 'Add'
  }
  function updateSchedule() {
    const allDay = field('allDay').checked
    field('startTime').hidden = allDay
    field('endTime').hidden = allDay
    updateRepeat()
  }
  function updateRepeat() {
    const repeat = field('repeat').value
    const custom = repeat === 'custom'
    if (!custom && repeat !== 'none' && repeat !== 'preserve') field('frequency').value = repeat
    const frequency = field('frequency').value
    el('recurrence').hidden = !recurrence || repeat === 'none' || repeat === 'preserve'
    el('frequency').closest('.ce-row').hidden = !custom
    el('interval').closest('.ce-row').hidden = !custom
    el('weekdays').hidden = frequency !== 'weekly' || !custom
    const monthly = frequency === 'monthly' || frequency === 'yearly'
    el('monthly').hidden = !monthly || !custom
    el('months').hidden = frequency !== 'yearly' || !custom
    el('monthdays').hidden = frequency !== 'monthly' || !custom || field('monthlyMode').value !== 'date'
    el('ordinal-row').hidden = !monthly || !custom || field('monthlyMode').value !== 'weekday'
    el('until-row').hidden = field('repeatEnd').value !== 'date'
    el('count-row').hidden = field('repeatEnd').value !== 'count'
    const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[frequency]
    const interval = custom ? Number(field('interval').value) : 1
    el('unit').textContent = unit + (interval === 1 ? '' : 's')
    const description = `Every ${interval === 1 ? unit : `${interval} ${unit}s`}`
    el('repeat-description').textContent = description
    let summary = description
    if (frequency === 'weekly' && custom) {
      summary += ` on ${Array.from(selectedDays)
        .sort()
        .map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day - 1])
        .join(', ')}`
    }
    if (frequency === 'yearly' && custom) {
      summary += ` in ${Array.from(selectedMonths)
        .sort((a, b) => a - b)
        .map((month) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1])
        .join(', ')}`
    }
    if (monthly && custom) {
      summary +=
        field('monthlyMode').value === 'date'
          ? ` on day ${Array.from(frequency === 'yearly' ? [Number(field('startDate').value.slice(-2))] : selectedMonthDays)
              .sort((a, b) => a - b)
              .join(', ')}`
          : ` on the ${field('ordinal').selectedOptions[0].textContent.toLowerCase()} ${field('ordinalDay').selectedOptions[0].textContent}`
    }
    if (field('repeatEnd').value === 'count') summary += `, ${field('count').value} times`
    if (field('repeatEnd').value === 'date') summary += `, until ${field('until').value}`
    el('repeat-summary').textContent = `${summary}.${monthly && field('monthlyMode').value === 'date' ? ' Months without the selected day are skipped.' : ''}`
  }

  function hydrateRule(rule, start) {
    const allowed = ['frequency', 'interval', 'daysOfWeek', 'daysOfMonth', 'monthsOfYear', 'endDate', 'occurrenceCount']
    if (Object.keys(rule).some((key) => !allowed.includes(key)) || !['daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency)) return
    const days = rule.daysOfWeek || []
    if (rule.frequency === 'daily' && (days.length || rule.daysOfMonth || rule.monthsOfYear)) return
    if (rule.frequency === 'weekly' && (rule.daysOfMonth || rule.monthsOfYear || days.some((day) => day.weekNumber))) return
    if (rule.frequency === 'monthly' && rule.monthsOfYear) return
    if (rule.frequency === 'yearly' && rule.daysOfMonth) return
    if (rule.frequency === 'monthly' || rule.frequency === 'yearly') {
      if (days.length > 1 || (days.length && rule.daysOfMonth)) return
      if (days.length && ![1, 2, 3, 4, -1].includes(days[0].weekNumber)) return
      if (rule.daysOfMonth && rule.daysOfMonth.some((day) => day < 1 || day > 31)) return
    }
    field('repeat').value = 'custom'
    field('frequency').value = rule.frequency
    field('interval').value = String(rule.interval || 1)
    if (rule.frequency === 'weekly') selectedDays = new Set(days.length ? days.map((day) => day.dayOfWeek) : [start.getDay() + 1])
    if ((rule.frequency === 'monthly' || rule.frequency === 'yearly') && days.length) {
      field('monthlyMode').value = 'weekday'
      field('ordinal').value = String(days[0].weekNumber)
      field('ordinalDay').value = String(days[0].dayOfWeek)
    }
    if (rule.daysOfMonth) selectedMonthDays = new Set(rule.daysOfMonth)
    if (rule.monthsOfYear) selectedMonths = new Set(rule.monthsOfYear)
    updateChoiceButtons()
    if (rule.endDate) {
      field('repeatEnd').value = 'date'
      field('until').value = dateText(new Date(rule.endDate))
    }
    if (rule.occurrenceCount) {
      field('repeatEnd').value = 'count'
      field('count').value = String(rule.occurrenceCount)
    }
    root.querySelectorAll('[data-day]').forEach((button) => button.setAttribute('aria-pressed', String(selectedDays.has(Number(button.dataset.day)))))
  }
  function updateChoiceButtons() {
    for (const [attribute, values] of [
      ['day', selectedDays],
      ['monthday', selectedMonthDays],
      ['month', selectedMonths],
    ]) {
      root.querySelectorAll(`[data-${attribute}]`).forEach((button) => button.setAttribute('aria-pressed', String(values.has(Number(button.dataset[attribute])))))
    }
  }
  function readRule(start) {
    if (!recurrence || repeatSnapshot() === repeatBaseline || field('repeat').value === 'preserve') return undefined
    if (field('repeat').value === 'none') return null
    const custom = field('repeat').value === 'custom'
    const frequency = field('frequency').value
    const interval = custom ? Number(field('interval').value) : 1
    if (!Number.isInteger(interval) || interval < 1 || interval > 999) throw new Error('Enter a repeat interval from 1 to 999.')
    const rule = { frequency, interval }
    if (frequency === 'weekly') {
      rule.daysOfWeek = (custom ? Array.from(selectedDays).sort() : [start.getDay() + 1]).map((dayOfWeek) => ({ dayOfWeek, weekNumber: 0 }))
      if (!rule.daysOfWeek.length) throw new Error('Choose at least one day to repeat on.')
    }
    if (frequency === 'monthly' || frequency === 'yearly') {
      if (custom && field('monthlyMode').value === 'weekday') rule.daysOfWeek = [{ dayOfWeek: Number(field('ordinalDay').value), weekNumber: Number(field('ordinal').value) }]
      else if (frequency === 'monthly') rule.daysOfMonth = custom ? Array.from(selectedMonthDays).sort((a, b) => a - b) : [start.getDate()]
      if (rule.daysOfMonth && !rule.daysOfMonth.length) throw new Error('Choose at least one day of the month.')
    }
    if (frequency === 'yearly') {
      rule.monthsOfYear = custom ? Array.from(selectedMonths).sort((a, b) => a - b) : [start.getMonth() + 1]
      if (!rule.monthsOfYear.length) throw new Error('Choose at least one month.')
    }
    if (field('repeatEnd').value === 'date') {
      const until = parseDate(field('until').value, '23:59')
      if (!Number.isFinite(until.getTime()) || until < start) throw new Error('End repeat must be on or after the event start date.')
      rule.endDate = until
    }
    if (field('repeatEnd').value === 'count') {
      rule.occurrenceCount = Number(field('count').value)
      if (!Number.isInteger(rule.occurrenceCount) || rule.occurrenceCount < 1 || rule.occurrenceCount > 9999) throw new Error('Enter an occurrence count from 1 to 9999.')
    }
    return rule
  }
  function readEvent() {
    const title = field('title').value.trim()
    if (!title) {
      field('title').focus()
      throw new Error('Give this event a title.')
    }
    if (!field('calendar').value) throw new Error('Choose a writable calendar before saving.')
    const isAllDay = field('allDay').checked
    const start = parseDate(field('startDate').value, isAllDay ? '00:00' : field('startTime').value)
    const end = parseDate(field('endDate').value, isAllDay ? '00:00' : field('endTime').value)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error('Enter valid start and end dates and times.')
    if (isAllDay ? end < start : end <= start) throw new Error('The end must be after the start.')
    // EventKit uses an exclusive end. Advance by a calendar day, not 24 hours (DST).
    if (isAllDay) end.setDate(end.getDate() + 1)
    const url = field('url').value.trim()
    if (url && (!event || url !== event.url)) {
      try {
        const parsed = new URL(url)
        if (['javascript:', 'data:', 'vbscript:'].includes(parsed.protocol)) throw new Error()
      } catch (_) {
        throw new Error('Enter a complete URL, or leave the link empty.')
      }
    }
    const data = Object.assign({}, event || {}, {
      title,
      date: start,
      endDate: end,
      isAllDay,
      type: 'event',
      calendar: field('calendar').selectedOptions[0].textContent,
      calendarID: field('calendar').selectedOptions[0].dataset.calendarId || undefined,
      location: field('location').value.trim(),
      notes: field('notes').value,
      url,
      availability: event && event.availability != null ? Number(event.availability) : 0,
      isCompleted: false,
    })
    if (advanced && (!event || alertSnapshot() !== alertBaseline)) {
      data.alertOffsets = [field('alert').value, field('secondAlert').value].filter((value) => value !== 'none').map(Number)
      data.alertOffsets = Array.from(new Set(data.alertOffsets))
    } else delete data.alertOffsets
    // A snapshot is not a request to replace the series rule.
    delete data.recurrenceRules
    const rule = readRule(start)
    if (rule !== undefined) recurrence.write(data, rule)
    return data
  }
  function close() {
    if (busy) return
    setRepeatPanel(false, false)
    root.hidden = true
    confirmation = null
    if (previousFocus && previousFocus.isConnected) previousFocus.focus()
    if (host.onClose) host.onClose()
  }
  function showConfirmation(kind) {
    confirmation = kind
    el('confirm').hidden = false
    const series = event && event.isRecurring && kind !== 'discard'
    const changingRepeat = kind === 'save' && pendingData && Object.prototype.hasOwnProperty.call(pendingData, 'recurrenceRules')
    el('confirm-text').textContent = series
      ? changingRepeat
        ? 'Apply this repeat schedule to this and future events?'
        : 'Apply this change to just this event, or this and future events?'
      : kind === 'delete'
      ? 'Delete this event? This cannot be undone here.'
      : 'Discard your unsaved changes?'
    root.querySelector('[data-action="this"]').hidden = !series || changingRepeat
    root.querySelector('[data-action="confirm"]').textContent = series ? 'This and future events' : kind === 'delete' ? 'Delete event' : 'Discard changes'
    root.querySelector('[data-action="keep"]').focus()
    el('confirm').scrollIntoView({ block: 'nearest' })
  }
  function requestClose() {
    if (busy || root.hidden) return
    if (!saved && !readOnly && snapshot() !== baseline) showConfirmation('discard')
    else close()
  }
  async function save(scope) {
    if (busy || readOnly || saved || root.hidden) return
    error('')
    let data
    try {
      data = readEvent()
    } catch (err) {
      error(err.message)
      return
    }
    if (event && event.isRecurring && !scope) {
      pendingData = data
      showConfirmation('save')
      return
    }
    if (scope) data.scope = scope
    setBusy(true)
    try {
      const result = await host.save(data, event)
      if (result === false || (!event && !result)) throw new Error('The calendar did not save the event. Your changes are still here; try again.')
      saved = true
      lastCalendar = data.calendarID || ''
      try {
        localStorage.setItem('noteplan.calendarEditor.lastCalendarID', lastCalendar)
      } catch (_) {
        // Saving an event must not depend on storage being available.
      }
    } catch (err) {
      error(`Could not save. ${err.message || String(err)}`)
      setBusy(false)
      return
    }
    setBusy(false)
    close()
    try {
      await host.refresh(data, event)
    } catch (err) {
      if (host.onRefreshError) host.onRefreshError(err)
    }
  }
  async function remove(scope) {
    if (busy || readOnly || !event || saved) return
    setBusy(true)
    el('save').textContent = 'Deleting…'
    try {
      const result = await host.remove(event, scope)
      if (result === false) throw new Error('The calendar did not delete the event.')
      saved = true
    } catch (err) {
      error(`Could not delete. ${err.message || String(err)}`)
      setBusy(false)
      return
    }
    setBusy(false)
    close()
    try {
      await host.refresh(null, event)
    } catch (err) {
      if (host.onRefreshError) host.onRefreshError(err)
    }
  }
  async function open(options) {
    if (busy || (!root.hidden && snapshot() !== baseline)) return
    const ticket = ++opening
    const capabilities = host.capabilities ? await host.capabilities() : null
    if (ticket !== opening) return
    advanced = !!capabilities
    recurrence = advanced
      ? {
          write(data, rule) {
            data.recurrenceRules = rule ? [rule] : []
          },
        }
      : null
    let loadError = ''
    if (options.event && host.load) {
      try {
        options = Object.assign({}, options, { event: await host.load(options.event) })
      } catch (err) {
        options = Object.assign({}, options, { event: Object.assign({}, options.event, { editorReadOnly: true }) })
        loadError = err.message || String(err)
      }
    }
    if (ticket !== opening) return
    previousFocus = document.activeElement
    event = options.event || null
    saved = false
    form.reset()
    error('')
    confirmation = null
    el('confirm').hidden = true
    setRepeatPanel(false, false)
    const start = new Date(event ? event.date || event.startDate : options.start || new Date())
    const allDay = event ? event.isAllDay === true : options.isAllDay !== false
    const end = new Date(event ? event.endDate : options.end || (allDay ? start : start.getTime() + 3600000))
    // Accept both historical 23:59 ends and EventKit's exclusive midnight ends.
    if (event && allDay && end > start && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) end.setDate(end.getDate() - 1)
    field('title').value = event ? event.title || '' : ''
    field('location').value = event ? event.location || '' : ''
    field('notes').value = event ? event.notes || '' : ''
    field('url').value = event ? event.url || '' : ''
    field('allDay').checked = allDay
    field('startDate').value = dateText(start)
    field('endDate').value = dateText(end)
    field('startTime').value = !allDay ? timeText(start) : '09:00'
    field('endTime').value = !allDay ? timeText(end) : '10:00'
    field('until').value = dateText(start)
    field('ordinalDay').value = String(start.getDay() + 1)
    selectedDays = new Set([start.getDay() + 1])
    selectedMonthDays = new Set([start.getDate()])
    selectedMonths = new Set([start.getMonth() + 1])
    updateChoiceButtons()
    root.querySelectorAll('[data-day]').forEach((button) => button.setAttribute('aria-pressed', String(selectedDays.has(Number(button.dataset.day)))))
    const calendars = (host.calendars() || []).filter((cal) => cal.isWritable !== false)
    const currentCalendar = event ? event.calendar || event.calendarTitle : ''
    const currentCalendarID = event && event.calendarID
    const matchesCalendar = (cal) => (currentCalendarID ? cal.id === currentCalendarID : cal.title === currentCalendar)
    const selectedCalendar = calendars.find(matchesCalendar)
    field('calendar').replaceChildren()
    const groups = new Map()
    calendars.forEach((cal) => {
      const source = cal.source || 'Other'
      if (!groups.has(source)) {
        const group = document.createElement('optgroup')
        group.label = source
        groups.set(source, group)
        field('calendar').appendChild(group)
      }
      const option = document.createElement('option')
      option.value = cal.id || cal.title
      option.dataset.calendarId = cal.id || ''
      option.textContent = cal.title
      groups.get(source).appendChild(option)
    })
    if (currentCalendar && !selectedCalendar) {
      const option = document.createElement('option')
      option.value = currentCalendar
      option.textContent = currentCalendar
      field('calendar').appendChild(option)
    }
    if (currentCalendar) field('calendar').value = selectedCalendar ? selectedCalendar.id || selectedCalendar.title : currentCalendar
    else if (lastCalendar && calendars.some((cal) => cal.id === lastCalendar)) field('calendar').value = lastCalendar
    // Without a documented occurrence/scope API, series writes are unsafe.
    readOnly = !!(event && (event.isCalendarWritable === false || event.editorReadOnly || !selectedCalendar || (event.isRecurring && !recurrence)))
    if (!event && !calendars.length) readOnly = true
    const recurring = event && event.isRecurring
    field('repeat').value = recurring ? 'preserve' : 'none'
    field('repeat').querySelector('[value="preserve"]').hidden = !recurring
    if (advanced && recurring && event.recurrenceRules && event.recurrenceRules.length === 1) hydrateRule(event.recurrenceRules[0], start)
    ;['alert', 'secondAlert'].forEach((name, i) => {
      const offset = event && event.alertOffsets ? event.alertOffsets[i] : undefined
      const value = offset === undefined ? 'none' : String(offset)
      field(name)
        .querySelectorAll('[data-custom]')
        .forEach((item) => item.remove())
      if (!Array.from(field(name).options).some((item) => item.value === value)) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = `Custom (${Math.abs(offset / 60)} min ${offset <= 0 ? 'before' : 'after'})`
        option.dataset.custom = 'true'
        field(name).appendChild(option)
      }
      field(name).value = value
    })
    el('alert-row').hidden = !advanced
    el('second-alert-row').hidden = !advanced
    el('alert-help').hidden = !(event && event.hasComplexAlerts)
    el('repeat-help').textContent = recurrence
      ? ''
      : recurring
      ? 'Edit this series and its repeat schedule in Apple Calendar.'
      : 'To make this event repeat, save it and set its repeat schedule in Apple Calendar.'
    el('notice').hidden = !readOnly
    el('notice').textContent =
      loadError ||
      (recurring && !recurrence
        ? 'Repeating event · View only here. Open Apple Calendar to change one occurrence or the series.'
        : !calendars.length
        ? 'No writable calendars available. Enable a calendar in NotePlan to create events.'
        : 'This event is read-only.')
    el('heading').textContent = readOnly ? 'Event Details' : event ? 'Edit Event' : 'Add Event'
    el('save').hidden = readOnly
    root.querySelector('[data-action="delete"]').hidden = !event || readOnly
    el('attendees-row').hidden = !(event && event.attendeeNames && event.attendeeNames.length)
    el('attendees').textContent = event && event.attendeeNames ? event.attendeeNames.join(', ') : ''
    previousDates = { start: field('startDate').value, time: field('startTime').value }
    setBusy(false)
    updateSchedule()
    baseline = snapshot()
    repeatBaseline = repeatSnapshot()
    alertBaseline = alertSnapshot()
    root.hidden = false
    if (readOnly) root.querySelector('[data-action="close"]').focus()
    else field('title').focus()
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (el('recurrence').open) root.querySelector('[data-action="repeat-done"]').click()
    else void save()
  })
  form.addEventListener('input', () => {
    error('')
    el('confirm').hidden = true
    confirmation = null
  })
  form.addEventListener('change', (e) => {
    if (e.target === field('repeat') && field('repeat').value === 'custom') setRepeatPanel(true)
    if (e.target === field('startDate') || e.target === field('startTime')) {
      const oldStart = parseDate(previousDates.start, previousDates.time)
      const newStart = parseDate(field('startDate').value, field('startTime').value)
      const oldEnd = parseDate(field('endDate').value, field('endTime').value)
      if ([oldStart, newStart, oldEnd].every((date) => Number.isFinite(date.getTime())) && oldEnd >= oldStart) {
        let nextEnd
        if (field('allDay').checked) {
          const days =
            (Date.UTC(newStart.getFullYear(), newStart.getMonth(), newStart.getDate()) - Date.UTC(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate())) / 86400000
          nextEnd = new Date(oldEnd)
          nextEnd.setDate(nextEnd.getDate() + days)
        } else nextEnd = new Date(oldEnd.getTime() + newStart.getTime() - oldStart.getTime())
        field('endDate').value = dateText(nextEnd)
        field('endTime').value = timeText(nextEnd)
      }
      previousDates = { start: field('startDate').value, time: field('startTime').value }
    }
    updateSchedule()
  })
  root.addEventListener('click', (e) => {
    if (e.target === root) {
      requestClose()
      return
    }
    const choice = e.target.closest('[data-day], [data-monthday], [data-month]')
    if (choice) {
      const attribute = choice.dataset.day ? 'day' : choice.dataset.monthday ? 'monthday' : 'month'
      const values = attribute === 'day' ? selectedDays : attribute === 'monthday' ? selectedMonthDays : selectedMonths
      const value = Number(choice.dataset[attribute])
      if (values.has(value)) values.delete(value)
      else values.add(value)
      updateChoiceButtons()
      updateRepeat()
      error('')
      confirmation = null
      el('confirm').hidden = true
      return
    }
    const button = e.target.closest('[data-action]')
    if (!button) return
    const action = button.dataset.action
    if (action === 'repeat-done') {
      try {
        readRule(parseDate(field('startDate').value, field('startTime').value))
        setRepeatPanel(false)
      } catch (err) {
        el('repeat-error').textContent = err.message
        el('repeat-error').hidden = false
      }
    }
    if (action === 'close') requestClose()
    if (action === 'delete') showConfirmation('delete')
    if (action === 'keep') {
      confirmation = null
      el('confirm').hidden = true
    }
    if (action === 'confirm' || action === 'this') {
      const scope = action === 'this' ? 'this' : 'future'
      if (confirmation === 'delete') void remove(scope)
      else if (confirmation === 'save') void save(scope)
      else if (confirmation === 'discard') close()
    }
  })
  document.addEventListener(
    'keydown',
    (e) => {
      if (root.hidden) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (el('recurrence').open) setRepeatPanel(false)
        else requestClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (el('recurrence').open) root.querySelector('[data-action="repeat-done"]').click()
        else void save()
      }
      if (e.key === 'Tab') {
        const items = Array.from(root.querySelectorAll('button,input,select,textarea,summary')).filter((item) => {
          if (item.disabled || item.closest('[hidden],[inert]')) return false
          const details = item.closest('details')
          if (details && !details.open && item.tagName !== 'SUMMARY') return false
          return !(details === el('recurrence') && details.open && item.tagName === 'SUMMARY')
        })
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    true,
  )
  return { open, close: requestClose }
}
// END SHARED CALENDAR EDITOR

/**
 * Linear Calendar Plugin
 * Displays a linear year view calendar with calendar events
 * Uses the Calendar API bridge from within HTML views
 *
 * Layout approach:
 * - 12 month rows, each with 1 label column + 31 day columns
 * - Events are assigned lanes globally across the entire year
 * - Multi-day events are split into per-month segments preserving lane
 * - CSS Grid is used for proper column spanning
 */

/**
 * Main function to show the linear calendar view
 * @param {number} year - Optional year to display (defaults to current year)
 */
async function showLinearCalendar(year) {
  try {
    const currentYear = year || new Date().getFullYear()
    HTMLView.showInMainWindow(getCalendarHTML(currentYear), "Linear Calendar", {
      splitView: false,
      icon: "calendar-lines",
      iconColor: "green-500",
    })
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Generates the HTML for the linear calendar view
 * @param {number} currentYear - The year to display
 * @returns {string} HTML string
 */
function getCalendarHTML(currentYear) {
  return `<!DOCTYPE html>
<html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
            background: #ffffff;
            color: #1d1d1f;
            height: 100vh;
            overflow: hidden;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            --cell-width: 35px;
      --event-text-size: 10px;
      --lane-height: 16px;
      --lane-gap: 2px;
          }
          
    /* ============================================
       Controls / Navigation Bar
       ============================================ */
          .controls {
            display: flex;
            align-items: center;
      gap: 8px;
      padding: 1px 6px 1px 6px;
      margin-bottom: 0;
      border-bottom: 1px solid rgba(229, 229, 231, 0.8);
            flex-shrink: 0;
      overflow: visible;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.85);
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      pointer-events: auto;
          }
          
          .year-navigation {
            display: flex;
            align-items: center;
      gap: 4px;
          }
          
          .year-button {
            background: transparent;
      border: none;
            border-radius: 4px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
      font-weight: 500;
      color: #86868b;
      transition: all 0.15s;
      opacity: 1;
      padding: 0;
      margin-bottom: 2px;
          }
          
          .year-button:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #1d1d1f;
          }
          
          .year-button:active {
      background: rgba(0, 0, 0, 0.1);
          }
          
          .year-display {
      font-size: 18px;
            font-weight: 600;
            color: #1d1d1f;
      min-width: auto;
      text-align: left;
      opacity: 1;
      letter-spacing: -0.2px;
    }
    
    .controls-right {
            display: flex;
            align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    /* Event Filter - Collapsible */
    .event-filter {
      display: flex;
      align-items: center;
      position: relative;
      background: transparent;
      border-radius: 6px;
      height: 28px;
      overflow: hidden;
    }

    .event-filter-toggle {
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .event-filter-toggle:hover {
      background: #f5f5f7;
    }

    .event-filter-icon {
      color: #86868b;
      font-size: 13px;
    }

    .event-filter.expanded .event-filter-icon,
    .event-filter.has-value .event-filter-icon {
      color: #FF8800;
    }

    .event-filter-input {
      border: none;
      background: #f5f5f7;
      color: #1d1d1f;
      font-size: 13px;
      width: 0;
      max-width: 0;
      outline: none;
      padding: 0;
      opacity: 0;
      border-radius: 6px;
      height: 28px;
      transition: width 0.2s ease, max-width 0.2s ease, opacity 0.15s ease, padding 0.2s ease;
    }

    .event-filter.expanded .event-filter-input {
      width: 140px;
      max-width: 140px;
      padding: 0 8px;
      opacity: 1;
      margin-left: 4px;
    }

    .event-filter-input::placeholder {
      color: #86868b;
      font-size: 12px;
    }

    .event-filter-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 0;
      height: 18px;
      border: none;
      background: #e5e5e7;
      color: #86868b;
      border-radius: 50%;
      cursor: pointer;
      font-size: 10px;
      flex-shrink: 0;
      opacity: 0;
      overflow: hidden;
      transition: width 0.15s ease, opacity 0.15s ease, margin 0.15s ease;
    }

    .event-filter-clear:hover {
      background: #d1d1d6;
      color: #1d1d1f;
    }

    .event-filter.expanded.has-value .event-filter-clear {
      width: 18px;
      opacity: 1;
      margin-left: 4px;
    }

    /* Dark mode event filter */
    @media (prefers-color-scheme: dark) {
      .event-filter-toggle:hover {
        background: #2c2c2e;
      }
      .event-filter-input {
        background: #2c2c2e;
        color: #f5f5f7;
      }
      .event-filter.expanded .event-filter-icon,
      .event-filter.has-value .event-filter-icon {
        color: #FF7700;
      }
      .event-filter-clear {
        background: #3a3a3c;
        color: #98989d;
      }
      .event-filter-clear:hover {
        background: #48484a;
        color: #f5f5f7;
      }
    }

    /* Settings dropdown */
    .settings-container {
      position: relative;
    }
    
    .settings-button {
      background: transparent;
      border: none;
      border-radius: 8px;
      padding: 4px 12px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
            font-size: 14px;
            font-weight: 400;
            color: #1d1d1f;
      transition: background-color 0.15s;
      opacity: 1;
    }
    
    .settings-button:hover {
      background: #f5f5f7;
    }
    
    .settings-icon {
      font-size: 14px;
      display: inline-block;
    }
    
    .settings-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 280px;
      background: #ffffff;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: none;
      padding: 12px;
    }
    
    .settings-section {
      margin-bottom: 16px;
    }
    
    .settings-section:last-child {
      margin-bottom: 0;
    }
    
    .settings-label {
      font-size: 12px;
      font-weight: 500;
      color: #86868b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .settings-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .settings-slider {
            flex: 1;
            height: 4px;
            border-radius: 2px;
            background: #e5e5e7;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
          }
          
    .settings-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #FF8800;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          
    .settings-value {
      font-size: 12px;
            color: #86868b;
      min-width: 36px;
            text-align: right;
          }
          
    .settings-checkbox-row {
            display: flex;
            align-items: center;
            gap: 8px;
      cursor: pointer;
      margin-bottom: 8px;
          }

    .settings-checkbox-row:last-child {
      margin-bottom: 0;
    }
          
    .settings-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: #FF8800;
          }
          
    .settings-checkbox-label {
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
            cursor: pointer;
          }
          
    .layout-button,
    .first-day-button {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 6px;
      background: #ffffff;
      font-size: 13px;
      font-weight: 400;
      color: #1d1d1f;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .layout-button:hover,
    .first-day-button:hover {
      background: #f5f5f7;
      border-color: #d1d1d6;
    }
    
    .layout-button.active,
    .first-day-button.active {
      background: #FF8800;
      border-color: #FF8800;
      color: #ffffff;
    }
          
    /* Calendar filter dropdown */
          .calendar-filter {
            display: flex;
            align-items: center;
            position: relative;
      z-index: 100;
    }
    
    .calendar-filter-button {
      width: 28px;
      height: 28px;
      padding: 0;
      margin-bottom: 2px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #86868b;
      cursor: pointer;
      outline: none;
      position: relative;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .calendar-filter-icon {
      font-size: 14px;
    }

    .calendar-filter-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: #FF8800;
      color: white;
      font-size: 9px;
      font-weight: 600;
      min-width: 14px;
      height: 14px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
    }

    .calendar-filter-badge.all-selected {
      display: none;
    }

    .calendar-filter-button:hover {
      background: #f5f5f7;
      color: #1d1d1f;
    }
          
          .calendar-filter-dropdown {
            position: absolute;
      top: calc(100% + 4px);
            left: 0;
            min-width: 250px;
            max-width: 350px;
            max-height: 300px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #e5e5e7;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 9999;
            display: none;
            padding: 4px 0;
          }
          
          .calendar-filter-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.15s;
          }
          
          .calendar-filter-item:hover {
            background-color: #f5f5f7;
          }
          
          .calendar-filter-color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
            border: 1px solid rgba(0, 0, 0, 0.1);
          }
          
          .calendar-filter-checkbox {
            margin: 0;
            cursor: pointer;
            width: 16px;
            height: 16px;
            accent-color: #FF8800;
          }
          
          .calendar-filter-item-label {
            flex: 1;
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
          }

          .calendar-filter-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .calendar-filter-item.disabled .calendar-filter-checkbox {
            cursor: not-allowed;
          }

          .calendar-filter-item.disabled .calendar-filter-item-label {
            font-style: italic;
          }

          .calendar-filter-disabled-note {
            font-size: 10px;
            color: #86868b;
            margin-left: auto;
            font-style: normal;
          }

          .calendar-filter-action-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.15s;
            border-bottom: 1px solid #e5e5e7;
            font-size: 13px;
            font-weight: 500;
            color: #FF8800;
          }
          
          .calendar-filter-action-item:hover {
            background-color: #f5f5f7;
          }
          
    /* ============================================
       Calendar Layout
       ============================================ */
          .calendar-wrapper {
            overflow-x: auto;
            overflow-y: auto;
      padding: 0 0 20px 0;
      height: calc(100vh - 38px);
            box-sizing: border-box;
      position: relative;
          }
          
          .calendar-container {
            display: flex;
            flex-direction: column;
            gap: 0;
            min-width: 1200px;
          }
          
    /* ============================================
       Month Row - CSS Grid Layout
       Each row has: 1 label column + 31 day columns
       Events are rendered in an overlay grid
       ============================================ */
          .month-row {
      position: relative;
            display: grid;
      /* Label (30px) + 31 day columns + spacer (10px) */
      grid-template-columns: 30px repeat(31, minmax(var(--cell-width), 1fr)) 10px;
      grid-template-rows: auto; /* Will expand based on content */
            border-bottom: 1px solid #e5e5e7;
      min-height: 50px;
      /* Height will be set via JavaScript to ensure all months have the same height */
          }
          
          .month-label {
      grid-column: 1;
      grid-row: 1 / -1; /* Span all rows */
            padding: 6px 4px;
            font-weight: 500;
            text-align: center;
            color: #1d1d1f;
            display: flex;
            align-items: center;
      justify-content: center;
            font-size: 11px;
      background: #e8f0f8;
      border-right: 1px solid #e5e5e7;
      position: sticky;
      left: 0;
      z-index: 10;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
    }
    
    /* Day header row */
    .day-headers {
      display: contents; /* Children participate in parent grid */
    }
    
    .day-header {
      grid-row: 1;
            padding: 4px 2px;
            text-align: center;
            cursor: pointer;
            border: none;
            background: transparent;
            transition: background-color 0.15s ease;
            display: flex;
      flex-direction: row;
      align-items: baseline;
      justify-content: center;
      gap: 2px;
      min-height: 24px;
    }
    
    .day-header:hover,
    .day-header.hovered {
            background-color: #f5f5f7;
          }
          
    .day-header.weekend {
            background-color: #fafafa;
          }
          
    .day-header.weekend:hover {
            background-color: #f5f5f7;
          }
          
    .day-header.today .day-number {
      color: #FF8800;
            font-weight: 600;
          }
          
    .day-header.today .day-name {
      color: #FF8800;
    }
    
    .day-header.empty {
            cursor: default;
            opacity: 0.3;
          }
          
    .day-header.empty:hover {
            background-color: transparent;
          }
    
    .day-header.spacer {
            cursor: default;
            opacity: 0;
            pointer-events: none;
            background: transparent !important;
            border: none;
            min-width: 10px;
            width: 10px;
          }
    
    /* Weekday header row for Fixed Week layout */
    .weekday-header-row {
      display: grid;
      /* grid-template-columns set via JavaScript */
      border-bottom: 1px solid #e5e5e7;
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(255, 255, 255, 0.95);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }
    
    .weekday-header-spacer {
      background: transparent;
    }
    
    /* Weekday header for Fixed Week layout */
    .weekday-header {
      padding: 4px 2px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #1d1d1f;
      background: #f5f5f7;
      border-bottom: 1px solid #e5e5e7;
    }
          
          .day-number {
      font-size: 12px;
            font-weight: 400;
            color: #1d1d1f;
            line-height: 1.2;
          }
          
          .day-name {
      font-size: 9px;
            font-weight: 400;
            color: #86868b;
            line-height: 1;
            text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    
    /* ============================================
       Events Layer - Absolute overlay with CSS Grid
       ============================================ */
    .events-layer {
      position: absolute;
      top: 28px; /* Below day headers */
      left: 0;
      right: 0;
      display: grid;
      /* Same columns as month-row: label (30px) + 31 days + spacer (10px) */
      grid-template-columns: 30px repeat(31, minmax(var(--cell-width), 1fr)) 10px;
      grid-auto-rows: var(--lane-height);
      gap: var(--lane-gap) 0;
      padding: 2px 0 4px 0;
      pointer-events: none; /* Allow clicks to pass through to day headers */
    }
    
    /* ============================================
       Event Segment - Spans columns using CSS Grid
       ============================================ */
    .event-segment {
      pointer-events: auto;
      /* grid-column and grid-row set via inline style */
      background-color: rgba(90, 159, 212, 0.3);
      color: #1d1d1f;
      font-size: var(--event-text-size);
            font-weight: 500;
      padding: 1px 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
      line-height: 1.3;
      border-radius: 6px;
      margin: 0 1px;
            display: flex;
            align-items: center;
            transition: opacity 0.2s;
          }
          
    .event-segment:hover {
            opacity: 0.8;
          }
          
    /* Continuation styling for multi-month events */
    .event-segment.continues-left {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: 0;
    }
    
    .event-segment.continues-right {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      margin-right: 0;
    }
    
    /* ============================================
       Loading & Error States
       ============================================ */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #86868b;
      font-size: 14px;
    }
    
    .api-unavailable {
            display: flex;
            flex-direction: column;
            align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
      text-align: center;
    }
    
    .api-unavailable-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .api-unavailable-title {
      font-size: 18px;
      font-weight: 600;
      color: #1d1d1f;
      margin-bottom: 8px;
    }
    
    .api-unavailable-message {
      font-size: 14px;
      color: #86868b;
      max-width: 400px;
      line-height: 1.5;
    }
    
    /* ============================================
       Event Modal Dialog
       ============================================ */
    .event-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }
    
    .event-modal-overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    
    .event-modal {
      background: #ffffff;
      border-radius: 12px;
      width: 340px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transform: scale(0.95);
      transition: transform 0.2s;
    }
    
    .event-modal-overlay.visible .event-modal {
      transform: scale(1);
    }
    
    .event-modal-header {
      padding: 16px 20px 12px 20px;
      border-bottom: 1px solid #e5e5e7;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .event-modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #1d1d1f;
    }
    
    .event-modal-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #86868b;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 4px;
    }
    
    .event-modal-close:hover {
      background: #f5f5f7;
      color: #1d1d1f;
    }
    
    .event-modal-body {
      padding: 16px 20px;
    }
    
    .event-form-group {
      margin-bottom: 16px;
    }
    
    .event-form-group:last-child {
      margin-bottom: 0;
    }
    
    .event-form-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #86868b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .event-form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #1d1d1f;
      background: #ffffff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    
    .event-form-input:focus {
      outline: none;
      border-color: #FF8800;
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.15);
    }
    
    .event-form-input::placeholder {
      color: #c7c7cc;
    }
    
    .event-form-row {
      display: flex;
      gap: 12px;
    }
    
    .event-form-row .event-form-group {
      flex: 1;
    }
    
    .event-form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #1d1d1f;
      background: #ffffff;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2386868b' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    }
    
    .event-form-select:focus {
      outline: none;
      border-color: #FF8800;
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.15);
    }
    
    .event-modal-footer {
      padding: 12px 20px 16px 20px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      border-top: 1px solid #e5e5e7;
    }
    
    .event-modal-btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background-color 0.15s, opacity 0.15s;
    }
    
    .event-modal-btn-cancel {
      background: #f5f5f7;
      color: #1d1d1f;
    }
    
    .event-modal-btn-cancel:hover {
      background: #e8e8ed;
    }
    
    .event-modal-btn-delete {
      background: #ff3b30;
      color: #ffffff;
    }
    
    .event-modal-btn-delete:hover {
      background: #e0342b;
    }
    
    .event-modal-btn-save {
      background: #FF8800;
      color: #ffffff;
    }
    
    .event-modal-btn-save:hover {
      background: #e67a00;
    }
    
    .event-modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Dummy event for drag creation */
    .event-segment.dummy-event {
      background-color: rgba(0, 122, 255, 0.4) !important;
      color: #ffffff !important;
      pointer-events: none;
      animation: pulse-dummy 1s ease-in-out infinite;
    }
    
    @keyframes pulse-dummy {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    /* Calendar source group headers */
    .calendar-source-header {
      padding: 8px 12px 4px 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #86868b;
      background: #f5f5f7;
      border-bottom: 1px solid #e5e5e7;
      margin-top: 4px;
    }
    
    .calendar-source-header:first-of-type {
      margin-top: 0;
    }
    
    /* Optgroup styling for select dropdown */
    .event-form-select optgroup {
      font-weight: 600;
      font-style: normal;
      color: #86868b;
      background: #f5f5f7;
    }
    
    .event-form-select option {
      font-weight: 400;
      color: #1d1d1f;
      background: #ffffff;
      padding: 4px 8px;
    }
    
    /* ============================================
       Dark Mode Support
       ============================================ */
          @media (prefers-color-scheme: dark) {
            body {
              background: #1c1c1e;
              color: #f5f5f7;
            }
            
            .controls {
        background: rgba(28, 28, 30, 0.85);
        border-bottom-color: rgba(56, 56, 58, 0.8);
            }
            
            .year-button {
        color: #98989d;
            }
            
            .year-button:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f5f5f7;
            }
            
            .year-button:active {
        background: rgba(255, 255, 255, 0.15);
            }
            
            .year-display {
              color: #f5f5f7;
            }
            
      .calendar-filter-button,
      .settings-button {
        background: transparent;
              color: #98989d;
            }

      .calendar-filter-button:hover,
      .settings-button:hover {
              background: #2c2c2e;
              color: #f5f5f7;
            }

      .calendar-filter-badge {
        background: #FF7700;
      }
            
      .calendar-filter-dropdown,
      .settings-dropdown {
              background: #2c2c2e;
              border-color: #38383a;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            }
            
            .calendar-filter-item:hover {
              background-color: #38383a;
            }
            
            .calendar-filter-item-label {
              color: #f5f5f7;
            }

            .calendar-filter-disabled-note {
              color: #86868b;
            }

            .calendar-filter-action-item {
              border-bottom-color: #38383a;
              color: #FF7700;
            }
            
            .calendar-filter-action-item:hover {
              background-color: #38383a;
            }
            
      .settings-slider {
        background: #38383a;
      }
      
      .settings-slider::-webkit-slider-thumb {
        background: #FF7700;
        border-color: #2c2c2e;
      }
      
      .settings-checkbox-label {
              color: #f5f5f7;
            }
            
      .layout-button,
      .first-day-button {
        background: #2c2c2e;
        border-color: #38383a;
        color: #f5f5f7;
      }
      
      .layout-button:hover,
      .first-day-button:hover {
        background: #38383a;
        border-color: #48484a;
      }
      
      .layout-button.active,
      .first-day-button.active {
        background: #FF7700;
        border-color: #FF7700;
        color: #ffffff;
      }
            
            .month-row {
              border-bottom-color: #38383a;
            }
            
            .month-label {
              color: #f5f5f7;
        background: #2a3440;
        border-right-color: #38383a;
            }
            
      .day-header:hover,
      .day-header.hovered {
              background-color: #2c2c2e;
            }
            
      .day-header.weekend {
        background-color: #252527;
      }
      
      .day-header.weekend:hover {
        background-color: #2a2a2c;
      }
      
      .day-header.today .day-number {
        color: #FF7700;
      }
      
      .day-header.today .day-name {
        color: #FF7700;
            }
            
            .day-number {
              color: #f5f5f7;
            }
            
            .day-name {
              color: #98989d;
            }
            
      .weekday-header-row {
        background: rgba(28, 28, 30, 0.95);
        border-bottom-color: #38383a;
      }
      
      .weekday-header {
        background: #2c2c2e;
        border-bottom-color: #38383a;
        color: #f5f5f7;
      }
            
      .api-unavailable-title {
        color: #f5f5f7;
      }
      
      .api-unavailable-message {
        color: #98989d;
            }
            
      /* Event Modal - Dark Mode */
      .event-modal-overlay {
        background: rgba(0, 0, 0, 0.6);
      }
      
      .event-modal {
        background: #2c2c2e;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .event-modal-header {
        border-bottom-color: #38383a;
      }
      
      .event-modal-title {
        color: #f5f5f7;
      }
      
      .event-modal-close {
        color: #98989d;
      }
      
      .event-modal-close:hover {
        background: #38383a;
        color: #f5f5f7;
      }
      
      .event-form-label {
        color: #98989d;
      }
      
      .event-form-input,
      .event-form-select {
        background: #1c1c1e;
        border-color: #38383a;
        color: #f5f5f7;
      }
      
      .event-form-input:focus,
      .event-form-select:focus {
        border-color: #FF7700;
        box-shadow: 0 0 0 3px rgba(255, 119, 0, 0.2);
      }
      
      .event-form-input::placeholder {
        color: #636366;
      }
      
      .event-modal-footer {
        border-top-color: #38383a;
      }
      
      .event-modal-btn-cancel {
        background: #38383a;
        color: #f5f5f7;
      }
      
      .event-modal-btn-cancel:hover {
        background: #48484a;
      }
      
      .event-modal-btn-save {
        background: #FF7700;
      }
      
      .event-modal-btn-save:hover {
        background: #e66a00;
      }
      
      /* Calendar source headers - Dark Mode */
      .calendar-source-header {
        background: #2c2c2e;
        border-bottom-color: #38383a;
        color: #98989d;
      }
      
      .event-form-select optgroup {
        background: #2c2c2e;
        color: #98989d;
      }
      
      .event-form-select option {
        background: #1c1c1e;
        color: #f5f5f7;
      }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <div class="year-navigation">
            <button class="year-button" id="yearPrev">‹</button>
            <div class="year-display" id="yearDisplay">${currentYear}</div>
            <button class="year-button" id="yearNext">›</button>
          </div>
    <div class="controls-right">
      <div class="event-filter" id="eventFilterContainer">
        <button class="event-filter-toggle" id="eventFilterToggle" title="Filter events (⌘F)">
          <i class="fa-solid fa-magnifying-glass event-filter-icon"></i>
        </button>
        <input type="text" id="eventFilterInput" class="event-filter-input" placeholder="Filter events...">
        <button class="event-filter-clear" id="eventFilterClear" title="Clear filter">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="calendar-filter">
        <button class="calendar-filter-button" id="calendarFilterButton" onclick="toggleCalendarDropdown(event)" title="Filter calendars">
          <i class="far fa-calendar calendar-filter-icon"></i>
          <span class="calendar-filter-badge" id="calendarFilterBadge"></span>
        </button>
        <div class="calendar-filter-dropdown" id="calendarFilterDropdown"></div>
          </div>
      <div class="settings-container">
        <button class="settings-button" id="settingsButton" onclick="toggleSettingsDropdown(event)" title="Display">
          <i class="far fa-sliders settings-icon"></i>
          <span>Display</span>
        </button>
        <div class="settings-dropdown" id="settingsDropdown">
          <div class="settings-section">
            <div class="settings-label">Layout</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="layout-button" id="layoutDateGrid" data-layout="dateGrid">
                <i class="far fa-th" style="margin-right: 4px;"></i>
                Date Grid
              </button>
              <button class="layout-button" id="layoutFixedWeek" data-layout="fixedWeek">
                <i class="far fa-calendar-week" style="margin-right: 4px;"></i>
                Fixed Week
              </button>
            </div>
          </div>
          <div class="settings-section" id="firstDayOfWeekSection" style="display: none;">
            <div class="settings-label">First Day of Week</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="first-day-button" id="firstDaySunday" data-day="0">
                Sunday
              </button>
              <button class="first-day-button" id="firstDayMonday" data-day="1">
                Monday
              </button>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Cell Width</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="cellWidthSlider" min="30" max="300" value="35" step="5">
              <div class="settings-value" id="cellWidthValue">35px</div>
          </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Event Text Size</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="eventTextSizeSlider" min="7" max="14" value="10" step="1">
              <div class="settings-value" id="eventTextSizeValue">10px</div>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Maximum Event Rows</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="maxEventRowsSlider" min="3" max="15" value="7" step="1">
              <div class="settings-value" id="maxEventRowsValue">7</div>
            </div>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="obfuscateCheckbox">
              <span class="settings-checkbox-label">Obfuscate event text</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="hideSingleDayEventsCheckbox">
              <span class="settings-checkbox-label">Hide single-day events</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="showOnlyAllDayEventsCheckbox">
              <span class="settings-checkbox-label">Show only all-day events</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="dynamicRowHeightCheckbox">
              <span class="settings-checkbox-label">Dynamic row height</span>
            </label>
          </div>
        </div>
            </div>
          </div>
        </div>
        <div class="calendar-wrapper">
    <div class="calendar-container" id="calendarContainer">
      <div class="loading">Loading calendar events...</div>
    </div>
        </div>
        
<script>
    // ============================================
    // State Management
    // ============================================

    ${createCalendarEditorBridge.toString()}
    ${installCalendarEventEditor.toString()}
    const eventEditor = installCalendarEventEditor(createCalendarEditorBridge({
      calendars: function() { return writableCalendars; },
      refresh: async function(data, original) {
        // Invalidate every loaded month for a series; a moved event also invalidates its old range.
        const dates = [data && data.date, data && data.endDate, original && (original.date || original.startDate), original && original.endDate].filter(Boolean).map(function(value) { return new Date(value).getTime(); });
        const recurring = (original && original.isRecurring) || (data && data.recurrenceRules && data.recurrenceRules.length);
        const start = recurring ? new Date(displayYear - 1, 0, 1) : new Date(Math.min.apply(null, dates));
        const end = recurring ? new Date(displayYear + 1, 11, 31) : new Date(Math.max.apply(null, dates));
        await forceReloadEventsForMonths(start, end);
 },
      onClose: function() { editingEvent = null; removeDummyEvent(); },
      onRefreshError: function(error) { console.error('Event saved, but refreshing the calendar failed:', error); }
    }));
          let displayYear = ${currentYear};
    let rawEvents = []; // Raw events from API
    let normalizedEvents = []; // Events with dayOfYear indices and lanes
    let selectedCalendars = new Set();
    let calendarInfoMap = new Map();
    let loadedYearRange = null;
    let calendarDropdownOpen = false;
    let settingsDropdownOpen = false;
    let layoutMode = 'dateGrid'; // 'dateGrid' or 'fixedWeek'
    let firstDayOfWeek = 0; // 0 = Sunday, 1 = Monday
    
    // Event creation/editing state
    let isDragging = false;
    let dragStartDate = null;
    let dragEndDate = null;
    let dragStartMonth = null;
    let dummyEventElement = null;
    let editingEvent = null; // null for new event, CalendarItem for editing
    let writableCalendars = []; // Calendars user can write to
    
    // ============================================
    // Dropdown Toggle Functions
    // ============================================
    function toggleCalendarDropdown(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const dropdown = document.getElementById('calendarFilterDropdown');
      calendarDropdownOpen = !calendarDropdownOpen;
      dropdown.style.display = calendarDropdownOpen ? 'block' : 'none';
      if (calendarDropdownOpen) closeSettingsDropdown();
    }
    
    function closeCalendarDropdown() {
      calendarDropdownOpen = false;
      const dropdown = document.getElementById('calendarFilterDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
    
    function toggleSettingsDropdown(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const dropdown = document.getElementById('settingsDropdown');
      settingsDropdownOpen = !settingsDropdownOpen;
      dropdown.style.display = settingsDropdownOpen ? 'block' : 'none';
      if (settingsDropdownOpen) closeCalendarDropdown();
    }
    
    function closeSettingsDropdown() {
      settingsDropdownOpen = false;
      const dropdown = document.getElementById('settingsDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
    
    document.addEventListener('click', (e) => {
      const calendarButton = document.getElementById('calendarFilterButton');
      const calendarDropdown = document.getElementById('calendarFilterDropdown');
      const settingsButton = document.getElementById('settingsButton');
      const settingsDropdown = document.getElementById('settingsDropdown');
      
      if (calendarButton && calendarDropdown && 
          !calendarButton.contains(e.target) && !calendarDropdown.contains(e.target)) {
        closeCalendarDropdown();
      }
      if (settingsButton && settingsDropdown && 
          !settingsButton.contains(e.target) && !settingsDropdown.contains(e.target)) {
        closeSettingsDropdown();
      }
    });
    
    // ============================================
    // Utility Functions
    // ============================================
    
          function obfuscateText(text) {
            if (!text) return text;
            const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            return text.split('').map(char => {
        if (!/[a-zA-Z0-9]/.test(char)) return char;
              if (/[a-zA-Z]/.test(char)) {
                const isUpperCase = char === char.toUpperCase();
                const randomLetter = letters[Math.floor(Math.random() * letters.length)];
                return isUpperCase ? randomLetter.toUpperCase() : randomLetter.toLowerCase();
              }
              if (/[0-9]/.test(char)) {
                return numbers[Math.floor(Math.random() * numbers.length)];
              }
              return char;
            }).join('');
          }
          
    function getDayOfYear(date) {
      const start = new Date(date.getFullYear(), 0, 0);
      const diff = date - start;
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    }
    
    function getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }
    
    function isToday(date) {
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }
    
    function isDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    function colorWithOpacity(hex, alpha) {
      if (!hex) return 'rgba(90, 159, 212, 0.3)';
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
    }
    
    function getTextColorForBackground(hex, alpha) {
      if (!hex) return '#1d1d1f';
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      // Blend with background
      const bgR = isDarkMode() ? 28 : 255;
      const bgG = isDarkMode() ? 28 : 255;
      const bgB = isDarkMode() ? 30 : 255;
      const effectiveR = r * alpha + bgR * (1 - alpha);
      const effectiveG = g * alpha + bgG * (1 - alpha);
      const effectiveB = b * alpha + bgB * (1 - alpha);
      const luminance = (0.299 * effectiveR + 0.587 * effectiveG + 0.114 * effectiveB) / 255;
      
      if (luminance < 0.5) {
        return '#FFFFFF';
      }
      // Darken the original color for text
      const darkenFactor = 0.5;
      const textR = Math.max(0, Math.floor(r * (1 - darkenFactor)));
      const textG = Math.max(0, Math.floor(g * (1 - darkenFactor)));
      const textB = Math.max(0, Math.floor(b * (1 - darkenFactor)));
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return '#' + toHex(textR) + toHex(textG) + toHex(textB);
    }
    
    function openNote(date, inSplitView = false, inNewWindow = false) {
      if (!date) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = \`\${year}-\${month}-\${day}\`;
      let url = \`noteplan://x-callback-url/openNote?noteDate=\${dateStr}&view=daily&timeframe=day\`;
      if (inNewWindow) {
        url += '&subWindow=yes';
      } else if (inSplitView) {
        url += '&splitView=yes&reuseSplitView=yes';
      }
      // Use hidden link click to trigger xcallback URL (WebView workaround)
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(function() {
        document.body.removeChild(link);
      }, 100);
    }
    
    // ============================================
    // Event Normalization & Lane Assignment
    // ============================================
    
    /**
     * Normalizes events to a layout-friendly form with day indices
     * @param {Array} events - Raw events from API
     * @param {number} year - The display year
     * @returns {Array} Normalized events with startIndex, endIndex, duration
     */
    function normalizeEvents(events, year) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      return events.map((event, idx) => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(new Date(event.endDate).getTime() - 1);
        
        // Clamp to year boundaries for display purposes
        const displayStart = startDate < yearStart ? yearStart : startDate;
        const displayEnd = endDate > yearEnd ? yearEnd : endDate;
        
        // Calculate day-of-year indices (0-based, 0 = Jan 1)
        const startIndex = getDayOfYear(displayStart);
        const endIndex = getDayOfYear(displayEnd);
        const duration = endIndex - startIndex + 1;
        
        return {
          id: idx,
          eventId: event.id, // Original event ID from calendar API
          title: event.title,
          startDate: startDate,
          endDate: new Date(event.endDate),
          displayStart: displayStart,
          displayEnd: displayEnd,
          startIndex: startIndex,
          endIndex: endIndex,
          duration: duration,
          color: event.color,
          calendarTitle: event.calendarTitle,
          lane: -1 // Will be assigned
        };
      });
    }
    
    /**
     * Assigns lanes to events using greedy first-fit algorithm
     * Sort: start ascending, then duration descending (longer events first)
     * @param {Array} events - Normalized events
     * @returns {Array} Events with lane assignments
     */
    function assignLanes(events) {
      if (!events || events.length === 0) return [];
      
      // Sort: start ascending, duration descending, then by id for stability
      const sorted = [...events].sort((a, b) => {
        if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
        if (b.duration !== a.duration) return b.duration - a.duration;
        return a.id - b.id;
      });
      
      // lanesEnd[i] = last occupied day index in lane i
      const lanesEnd = [];
      
      for (const event of sorted) {
        // Find first lane where this event fits (no overlap)
        let lane = lanesEnd.findIndex(endIndex => endIndex < event.startIndex);
        
        if (lane === -1) {
          // No existing lane has space, create new lane
          lane = lanesEnd.length;
          lanesEnd.push(-1);
        }
        
        event.lane = lane;
        lanesEnd[lane] = event.endIndex;
      }
      
      return sorted;
    }
    
    /**
     * Creates per-month segments from events
     * Each segment represents the portion of an event within a single month
     * @param {Array} events - Events with lane assignments
     * @param {number} year - Display year
     * @returns {Array} Segments grouped by month
     */
    function createMonthSegments(events, year) {
      const segmentsByMonth = Array.from({ length: 12 }, () => []);
      
      for (const event of events) {
        // Determine which months this event touches
        const startMonth = event.displayStart.getMonth();
        const endMonth = event.displayEnd.getMonth();
        
        for (let month = startMonth; month <= endMonth; month++) {
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0); // Last day of month
          
          // Segment boundaries within this month
          const segStart = event.displayStart > monthStart ? event.displayStart : monthStart;
          const segEnd = event.displayEnd < monthEnd ? event.displayEnd : monthEnd;
          
          const startDayOfMonth = segStart.getDate(); // 1-31
          const endDayOfMonth = segEnd.getDate(); // 1-31
          
          const segment = {
            eventId: event.eventId, // Original calendar API event ID
            title: event.title,
            color: event.color,
            lane: event.lane,
            month: month,
            startDay: startDayOfMonth,
            endDay: endDayOfMonth,
            continuesLeft: segStart > event.displayStart,
            continuesRight: segEnd < event.displayEnd,
            // Only show title on first segment of each event
            showTitle: month === startMonth,
            // Original event data for editing
            originalStartDate: event.startDate,
            originalEndDate: event.endDate,
            calendarTitle: event.calendarTitle
          };
          
          segmentsByMonth[month].push(segment);
        }
      }
      
      return segmentsByMonth;
    }
    
    /**
     * Calculates max lane used per month (for sizing)
     * @param {Array} segmentsByMonth - Segments grouped by month
     * @returns {Array} Max lane index per month
     */
    function getMaxLanesPerMonth(segmentsByMonth) {
      return segmentsByMonth.map(segments => {
        if (segments.length === 0) return 0;
        return Math.max(...segments.map(s => s.lane)) + 1;
      });
    }
    
    function getGlobalMaxLanes(maxLanesPerMonth) {
      // Get user-defined maximum event rows from slider
      const maxEventRowsSlider = document.getElementById('maxEventRowsSlider');
      let userMaxRows = 7; // Default
      
      if (maxEventRowsSlider) {
        userMaxRows = parseInt(maxEventRowsSlider.value) || 7;
      } else {
        // Fallback to localStorage if slider not yet initialized
        const saved = localStorage.getItem('calendarMaxEventRows');
        if (saved) {
          userMaxRows = parseInt(saved) || 7;
        }
      }
      
      // Always use the user's maximum for consistent height across all months
      // This ensures all months have the same height regardless of event count
      // If there are more events than the user's maximum, some events won't be visible
      // If there are fewer events, the extra space will be empty
      return userMaxRows;
    }
    
    // ============================================
    // Calendar API Functions
    // ============================================
    
    let loadingMonths = new Set();
    let loadedMonths = new Set();
    
    // Force reload events for specific months (used after adding/updating/deleting events)
    async function forceReloadEventsForMonths(startDate, endDate) {
      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();
      const endMonth = endDate.getMonth();
      const endYear = endDate.getFullYear();
      
      // Clear cache for affected months
      let currentYear = startYear;
      let currentMonth = startMonth;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const monthKey = currentYear + '-' + currentMonth;
        loadedMonths.delete(monthKey);
        loadingMonths.delete(monthKey);
        
        // Also remove events from rawEvents for this month so they can be re-added
        rawEvents = rawEvents.filter(e => {
          const eventDate = new Date(e.startDate);
          return !(eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth);
        });
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      // Reload affected months
      currentYear = startYear;
      currentMonth = startMonth;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const events = await loadEventsForMonth(currentYear, currentMonth);
        if (events.length > 0) {
          const existingIds = new Set(rawEvents.map(e => [e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
          const newEvents = events.filter(e => !existingIds.has([e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
          rawEvents = [...rawEvents, ...newEvents];
        }
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      // Update display
      updateCalendarDisplay();
    }
    
    async function loadEventsForMonth(year, month) {
      const monthKey = \`\${year}-\${month}\`;
      if (loadingMonths.has(monthKey) || loadedMonths.has(monthKey)) {
              return [];
            }
      
      loadingMonths.add(monthKey);
      
      try {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        
        const events = await Calendar.eventsBetween(startDate, endDate, "");
        
        const eventsList = [];
        if (events && Array.isArray(events)) {
          events.forEach((event) => {
            if (event.date) {
              const eventDate = new Date(event.date);
              const eventEndDate = event.endDate ? new Date(event.endDate) : eventDate;
              eventsList.push({
                ...event,
                id: event.id, // Store the event ID for editing/deleting
                title: event.title || "Event",
                startDate: eventDate.toISOString(),
                endDate: eventEndDate.toISOString(),
                calendarTitle: event.calendar || "",
                color: event.color || "#5A9FD4",
                isAllDay: event.isAllDay || false,
                isRecurring: event.isRecurring || false,
                notes: event.notes || "",
                url: event.url || "",
                availability: event.availability || 0
              });
            }
          });
        }
        
        loadedMonths.add(monthKey);
        loadingMonths.delete(monthKey);
        return eventsList;
      } catch (error) {
        console.error(\`Error loading events for \${year}-\${month + 1}:\`, error);
        loadingMonths.delete(monthKey);
        return [];
      }
    }
    
    async function loadCalendarEventsProgressively(year) {
      const startYear = year - 1;
      const endYear = year + 1;
      
      if (!loadedYearRange || loadedYearRange.start !== startYear || loadedYearRange.end !== endYear) {
        loadedMonths.clear();
        rawEvents = [];
        loadedYearRange = { start: startYear, end: endYear };
      }
      
      // Load current year first
      for (let month = 0; month < 12; month++) {
        const events = await loadEventsForMonth(year, month);
        if (events.length > 0) {
          const existingIds = new Set(rawEvents.map(e => [e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
          const newEvents = events.filter(e => !existingIds.has([e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
          rawEvents = [...rawEvents, ...newEvents];
          updateCalendarDisplay();
        }
      }
      
      // Then adjacent years
      for (let y of [year - 1, year + 1]) {
        for (let month = 0; month < 12; month++) {
          const events = await loadEventsForMonth(y, month);
          if (events.length > 0) {
            const existingIds = new Set(rawEvents.map(e => [e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
            const newEvents = events.filter(e => !existingIds.has([e.calendarID || e.calendarTitle, e.id, e.startDate].join('|')));
            rawEvents = [...rawEvents, ...newEvents];
            updateCalendarDisplay();
          }
        }
      }
    }
    
    async function loadAvailableCalendars() {
      try {
        const calendars = await Calendar.availableCalendars({});
        return calendars || [];
      } catch (error) {
        console.error('Error loading calendars:', error);
        return [];
      }
    }
    
    // ============================================
    // Calendar Filter Functions
    // ============================================
    
    function updateToggleAllButton() {
      const toggleAllItem = document.getElementById('toggleAllCalendars');
      if (!toggleAllItem) return;

      // Only consider enabled calendars
      const enabledCalendars = Array.from(calendarInfoMap.entries())
        .filter(([_, info]) => info.isEnabled)
        .map(([title, _]) => title);
      const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(cal => selectedCalendars.has(cal));
      toggleAllItem.textContent = allSelected ? 'Unselect All' : 'Select All';
    }
    
    async function populateCalendarFilter() {
      try {
        const calendars = await loadAvailableCalendars();
        const calendarFilterDropdown = document.getElementById('calendarFilterDropdown');
            calendarFilterDropdown.innerHTML = '';
            
            calendarInfoMap = new Map();
            calendars.forEach(cal => {
          calendarInfoMap.set(cal.title, {
            name: cal.title,
            color: cal.color || "#5A9FD4",
            isEnabled: cal.isEnabled !== false
          });
            });
            
            // Load saved selection from localStorage or default to all selected
            const savedSelection = localStorage.getItem('calendarFilterSelection');
            if (savedSelection) {
              try {
                const saved = JSON.parse(savedSelection);
                // Use saved selection exactly as-is to preserve user's explicit choices
                selectedCalendars = new Set(saved);
                // Filter out any calendars that no longer exist in the system
                const existingCalendarTitles = new Set(calendars.map(cal => cal.title));
                selectedCalendars = new Set([...selectedCalendars].filter(title => existingCalendarTitles.has(title)));
                // Don't add missing calendars back - they were either unchecked or are new
                // User can manually check new calendars if they want to see them
              } catch (e) {
                // If parsing fails, default to all selected
                selectedCalendars = new Set(calendars.map(cal => cal.title));
              }
            } else {
              // No saved selection, default to all selected
              selectedCalendars = new Set(calendars.map(cal => cal.title));
            }
            
            // Add toggle "Select All" / "Unselect All" action item at the top
            const toggleAllItem = document.createElement('div');
            toggleAllItem.className = 'calendar-filter-action-item';
            toggleAllItem.id = 'toggleAllCalendars';
            
            // Set initial text content directly (only consider enabled calendars)
            const enabledCalendars = calendars.filter(cal => cal.isEnabled !== false);
            const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(cal => selectedCalendars.has(cal.title));
            toggleAllItem.textContent = allSelected ? 'Unselect All' : 'Select All';

            toggleAllItem.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const enabledCals = calendars.filter(cal => cal.isEnabled !== false);
              const allSel = enabledCals.length > 0 && enabledCals.every(cal => selectedCalendars.has(cal.title));

              if (allSel) {
                // Unselect all calendars
                selectedCalendars.clear();
                const checkboxes = calendarFilterDropdown.querySelectorAll('.calendar-filter-checkbox:not(:disabled)');
                checkboxes.forEach(checkbox => {
                  checkbox.checked = false;
                });
              } else {
                // Select all enabled calendars
                enabledCals.forEach(cal => {
                  selectedCalendars.add(cal.title);
                });
                const checkboxes = calendarFilterDropdown.querySelectorAll('.calendar-filter-checkbox:not(:disabled)');
                checkboxes.forEach(checkbox => {
                  checkbox.checked = true;
                });
              }

              // Save and update display
              const selectionArray = Array.from(selectedCalendars);
              localStorage.setItem('calendarFilterSelection', JSON.stringify(selectionArray));
              updateToggleAllButton();
              updateCalendarFilterDisplay();
              updateCalendarDisplay();
            });
            
            // Append the toggle button first
            calendarFilterDropdown.appendChild(toggleAllItem);
            
            // Initialize the button text after it's in the DOM
            updateToggleAllButton();
            
            // Group calendars by source
            const calendarsBySource = {};
            calendars.forEach(calendar => {
              const source = calendar.source || 'Other';
              if (!calendarsBySource[source]) {
                calendarsBySource[source] = [];
              }
              calendarsBySource[source].push(calendar);
            });
            
            // Sort sources alphabetically, but put "iCloud" first if present
            const sortedSources = Object.keys(calendarsBySource).sort((a, b) => {
              if (a === 'iCloud') return -1;
              if (b === 'iCloud') return 1;
              return a.localeCompare(b);
            });
            
            // Render calendars grouped by source
            sortedSources.forEach(source => {
              // Add source header
              const sourceHeader = document.createElement('div');
              sourceHeader.className = 'calendar-source-header';
              sourceHeader.textContent = source;
              calendarFilterDropdown.appendChild(sourceHeader);
              
              // Add calendars for this source
              calendarsBySource[source].forEach(calendar => {
                const isDisabled = calendar.isEnabled === false;
                const item = document.createElement('div');
                item.className = 'calendar-filter-item' + (isDisabled ? ' disabled' : '');

                const colorDot = document.createElement('div');
                colorDot.className = 'calendar-filter-color-dot';
                colorDot.style.backgroundColor = calendar.color || "#5A9FD4";

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'calendar-filter-checkbox';
                checkbox.value = calendar.title;
                checkbox.checked = selectedCalendars.has(calendar.title) && !isDisabled;
                checkbox.disabled = isDisabled;

                const label = document.createElement('span');
                label.className = 'calendar-filter-item-label';
                label.textContent = calendar.title;

                item.appendChild(checkbox);
                item.appendChild(colorDot);
                item.appendChild(label);

                // Add "disabled" note for calendars disabled in NotePlan settings
                if (isDisabled) {
                  const note = document.createElement('span');
                  note.className = 'calendar-filter-disabled-note';
                  note.textContent = 'off';
                  note.title = 'Disabled in NotePlan Settings';
                  item.appendChild(note);
                }

                if (!isDisabled) {
                  checkbox.addEventListener('change', handleCalendarFilterChange);

                  item.addEventListener('click', (e) => {
                    if (e.target === checkbox) return;
                    e.preventDefault();
                    e.stopPropagation();
                    // Toggle checkbox state
                    checkbox.checked = !checkbox.checked;
                    // Create a proper event-like object with the updated checked state
                    const syntheticEvent = {
                      target: {
                        value: checkbox.value,
                        checked: checkbox.checked
                      }
                    };
                    handleCalendarFilterChange(syntheticEvent);
                  });
                }

                calendarFilterDropdown.appendChild(item);
              });
            });
            
            // Ensure toggle button is properly initialized after all calendars are added
            updateToggleAllButton();
            updateCalendarFilterDisplay();
      } catch (error) {
        console.error('Error populating calendar filter:', error);
      }
    }
    
          function handleCalendarFilterChange(e) {
            const calendarName = e.target.value;
            const isChecked = e.target.checked;
            
            if (isChecked) {
              selectedCalendars.add(calendarName);
            } else {
              selectedCalendars.delete(calendarName);
            }
            
            // Save to localStorage
            const selectionArray = Array.from(selectedCalendars);
            localStorage.setItem('calendarFilterSelection', JSON.stringify(selectionArray));

            updateToggleAllButton();
            updateCalendarFilterDisplay();
            updateCalendarDisplay();
          }
          
          function updateCalendarFilterDisplay() {
            // Only count enabled calendars
            const enabledCalendars = Array.from(calendarInfoMap.entries())
              .filter(([_, info]) => info.isEnabled)
              .map(([title, _]) => title);
            const totalCount = enabledCalendars.length;
            const selectedCount = enabledCalendars.filter(cal => selectedCalendars.has(cal)).length;
            const badge = document.getElementById('calendarFilterBadge');
            const filterBtn = document.getElementById('calendarFilterButton');

            if (!badge) return;

            // Show badge with selected count, hide if all selected
            if (selectedCount === totalCount && selectedCount > 0) {
              badge.classList.add('all-selected');
              badge.textContent = '';
              if (filterBtn) filterBtn.title = 'All ' + totalCount + ' calendars selected';
            } else {
              badge.classList.remove('all-selected');
              badge.textContent = selectedCount;
              if (filterBtn) filterBtn.title = selectedCount + ' of ' + totalCount + ' calendars';
            }
          }
    
    // ============================================
    // Calendar Rendering
    // ============================================
    
    /**
     * Updates the font size of all event segments
     */
    function updateEventTextSize(size) {
      // Update CSS variable
      document.documentElement.style.setProperty('--event-text-size', size + 'px');
      
      // Update all existing event segments directly
      const eventSegments = document.querySelectorAll('.event-segment');
      eventSegments.forEach(segment => {
        segment.style.fontSize = size + 'px';
      });
    }
    
    function getFilteredEvents() {
      // If no calendars are selected, show no events
      if (selectedCalendars.size === 0) {
        return [];
      }
      
      const hideSingleDayEventsCheckbox = document.getElementById('hideSingleDayEventsCheckbox');
      const hideSingleDayEvents = hideSingleDayEventsCheckbox?.checked || false;

      const showOnlyAllDayEventsCheckbox = document.getElementById('showOnlyAllDayEventsCheckbox');
      const showOnlyAllDayEvents = showOnlyAllDayEventsCheckbox?.checked || false;

      return rawEvents.filter(event => {
        // Filter by selected calendars
        if (!selectedCalendars.has(event.calendarTitle)) {
          return false;
        }
        // Filter by date range
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(new Date(event.endDate).getTime() - 1);
        const yearStart = new Date(displayYear, 0, 1);
        const yearEnd = new Date(displayYear, 11, 31, 23, 59, 59);
        if (!(eventStart <= yearEnd && eventEnd >= yearStart)) {
          return false;
        }
        // Filter out single-day events if option is enabled
        if (hideSingleDayEvents) {
          const startDateOnly = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
          const endDateOnly = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
          const isSingleDay = startDateOnly.getTime() === endDateOnly.getTime();
          if (isSingleDay) {
            return false;
          }
        }
        // Filter out non-all-day events if option is enabled
        // Detect all-day events: either has isAllDay flag or starts/ends at midnight
        if (showOnlyAllDayEvents) {
          const isAllDay = event.isAllDay || (
            eventStart.getHours() === 0 && eventStart.getMinutes() === 0 &&
            eventEnd.getHours() === 0 && eventEnd.getMinutes() === 0
          );
          if (!isAllDay) return false;
        }
        return true;
      });
    }
    
    function renderCalendar() {
      const container = document.getElementById('calendarContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      const cellWidthSlider = document.getElementById('cellWidthSlider');
      const currentWidth = parseInt(cellWidthSlider?.value || 35);
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      // Reorder day names based on firstDayOfWeek
      const orderedDayNames = firstDayOfWeek === 1 
        ? ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
        : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      
      if (layoutMode === 'fixedWeek') {
        renderFixedWeekLayout(container, currentWidth, monthNames, orderedDayNames, dayNames);
      } else {
        renderDateGridLayout(container, currentWidth, monthNames, dayNames);
      }
    }
    
    function renderDateGridLayout(container, currentWidth, monthNames, dayNames) {
      for (let month = 0; month < 12; month++) {
        const row = document.createElement('div');
        row.className = 'month-row';
        row.dataset.month = month;
        row.style.setProperty('--cell-width', currentWidth + 'px');
        
        // Month label
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthNames[month];
        row.appendChild(monthLabel);
        
        // Day headers
        const daysInMonth = getDaysInMonth(displayYear, month);
        
        for (let day = 1; day <= 31; day++) {
          const dayHeader = document.createElement('div');
          dayHeader.className = 'day-header';
          dayHeader.style.gridColumn = day + 1; // +1 for label column
          dayHeader.style.gridRow = 1;
          
          if (day <= daysInMonth) {
            const date = new Date(displayYear, month, day);
            const dayOfWeek = date.getDay();
            
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              dayHeader.classList.add('weekend');
            }
            
            if (isToday(date)) {
              dayHeader.classList.add('today');
            }
            
            const dayNumber = document.createElement('span');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            
            const dayName = document.createElement('span');
            dayName.className = 'day-name';
            dayName.textContent = dayNames[dayOfWeek];
            
            dayHeader.appendChild(dayNumber);
            dayHeader.appendChild(dayName);
            
            // Store day and month data on the header for hover/click handling
            dayHeader.dataset.day = day;
            dayHeader.dataset.month = month;
            
            dayHeader.addEventListener('click', (event) => {
              if (event.metaKey) {
                // Command+click opens note in new window
                openNote(date, false, true);
              } else if (event.altKey) {
                // Option+click opens note in split view
                openNote(date, true, false);
              } else {
                // Normal click creates event
                const clickedDate = new Date(displayYear, month, day);
                openEventModal(clickedDate, clickedDate, null);
              }
            });
          } else {
            dayHeader.classList.add('empty');
          }
          
          row.appendChild(dayHeader);
        }
        
        // Spacer cell at the end (for scrollbar space)
        const spacerCell = document.createElement('div');
        spacerCell.className = 'day-header spacer';
        spacerCell.style.gridColumn = 33; // 1 (label) + 31 (days) + 1 (spacer) = 33
        spacerCell.style.gridRow = 1;
        row.appendChild(spacerCell);
        
        // Events layer (will be populated separately)
        const eventsLayer = document.createElement('div');
        eventsLayer.className = 'events-layer';
        eventsLayer.id = \`events-layer-\${month}\`;
        // Explicitly set grid template for Date Grid (31 day columns)
        eventsLayer.style.gridTemplateColumns = \`30px repeat(31, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Add drag-to-create event handlers
        const currentMonth = month;
        eventsLayer.addEventListener('mousedown', (e) => handleEventsLayerMouseDown(e, currentMonth));
        eventsLayer.addEventListener('mousemove', (e) => {
          handleEventsLayerMouseMove(e, currentMonth);
          handleEventsLayerHover(e, currentMonth, row);
        });
        eventsLayer.addEventListener('mouseup', (e) => handleEventsLayerMouseUp(e, currentMonth));
        eventsLayer.addEventListener('mouseleave', () => clearDayHeaderHover(row));
        eventsLayer.style.pointerEvents = 'auto';
        
        row.appendChild(eventsLayer);
        
        container.appendChild(row);
      }
      
      // Update min-width for horizontal scroll (label + 31 days + spacer)
      const minWidth = 30 + (31 * currentWidth) + 10;
      container.style.minWidth = minWidth + 'px';
    }
    
    function renderFixedWeekLayout(container, currentWidth, monthNames, orderedDayNames, dayNames) {
      // Fixed Week layout: 37 columns (5 weeks + 2 days) with repeating weekday headers
      // This accommodates any month (max 31 days starting on any weekday)
      const totalColumns = 37; // 5 weeks * 7 + 2 = 37
      
      // Create single weekday header row at the top
      const headerRow = document.createElement('div');
      headerRow.className = 'weekday-header-row';
      headerRow.style.setProperty('--cell-width', currentWidth + 'px');
      headerRow.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
      headerRow.style.display = 'grid';
      // Border is set via CSS to support dark mode
      
      // Empty cell for month label column
      const labelSpacer = document.createElement('div');
      labelSpacer.className = 'weekday-header-spacer';
      headerRow.appendChild(labelSpacer);
      
      // Repeating weekday headers (37 columns)
      for (let col = 0; col < totalColumns; col++) {
        const weekdayIndex = col % 7;
        const weekdayHeader = document.createElement('div');
        weekdayHeader.className = 'weekday-header';
        weekdayHeader.style.gridColumn = col + 2; // +1 for label, +1 for 1-indexed
        weekdayHeader.textContent = orderedDayNames[weekdayIndex];
        headerRow.appendChild(weekdayHeader);
      }
      
      // Spacer at the end
      const endSpacer = document.createElement('div');
      endSpacer.className = 'weekday-header-spacer';
      endSpacer.style.gridColumn = totalColumns + 2;
      headerRow.appendChild(endSpacer);
      
      container.appendChild(headerRow);
      
      // Render month rows
      for (let month = 0; month < 12; month++) {
        const row = document.createElement('div');
        row.className = 'month-row';
        row.dataset.month = month;
        row.style.setProperty('--cell-width', currentWidth + 'px');
        // Grid: label (30px) + 37 day columns + spacer (10px)
        row.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Month label
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthNames[month];
        row.appendChild(monthLabel);
        
        // Find the starting weekday of day 1 of this month
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let startWeekday = firstDayOfMonth.getDay();
        // Adjust for firstDayOfWeek setting
        if (firstDayOfWeek === 1) {
          startWeekday = (startWeekday + 6) % 7; // Convert Sunday=0 to Monday=0
        }
        
        const daysInMonth = getDaysInMonth(displayYear, month);
        
        // Add empty cells before day 1
        for (let emptyCol = 0; emptyCol < startWeekday; emptyCol++) {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'day-header empty';
          emptyCell.style.gridColumn = emptyCol + 2; // +1 for label, +1 for 1-indexed
          emptyCell.style.gridRow = 1;
          row.appendChild(emptyCell);
        }
        
        // Add day cells starting at the correct column
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(displayYear, month, day);
          const col = startWeekday + day - 1; // Column position (0-indexed)
          
          const dayCell = document.createElement('div');
          dayCell.className = 'day-header';
          dayCell.style.gridColumn = col + 2; // +1 for label, +1 for 1-indexed
          dayCell.style.gridRow = 1;
          
          const originalDayOfWeek = date.getDay();
          
          if (originalDayOfWeek === 0 || originalDayOfWeek === 6) {
            dayCell.classList.add('weekend');
          }
          
          if (isToday(date)) {
            dayCell.classList.add('today');
          }
          
          const dayNumber = document.createElement('span');
          dayNumber.className = 'day-number';
          dayNumber.textContent = day;
          
          const dayName = document.createElement('span');
          dayName.className = 'day-name';
          dayName.textContent = dayNames[originalDayOfWeek];
          
          dayCell.appendChild(dayNumber);
          dayCell.appendChild(dayName);
          
          // Store day and month data on the cell for hover/click handling
          dayCell.dataset.day = day;
          dayCell.dataset.month = month;
          
          dayCell.addEventListener('click', (event) => {
            if (event.metaKey) {
              // Command+click opens note in new window
              openNote(date, false, true);
            } else if (event.altKey) {
              // Option+click opens note in split view
              openNote(date, true, false);
            } else {
              // Normal click creates event
              const clickedDate = new Date(displayYear, month, day);
              openEventModal(clickedDate, clickedDate, null);
            }
          });
          
          row.appendChild(dayCell);
        }
        
        // Add empty cells after the last day (fill remaining columns)
        const lastColumn = startWeekday + daysInMonth;
        for (let emptyCol = lastColumn; emptyCol < totalColumns; emptyCol++) {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'day-header empty';
          emptyCell.style.gridColumn = emptyCol + 2;
          emptyCell.style.gridRow = 1;
          row.appendChild(emptyCell);
        }
        
        // Spacer cell
        const spacerCell = document.createElement('div');
        spacerCell.className = 'day-header spacer';
        spacerCell.style.gridColumn = totalColumns + 2;
        spacerCell.style.gridRow = 1;
        row.appendChild(spacerCell);
        
        // Events layer
        const eventsLayer = document.createElement('div');
        eventsLayer.className = 'events-layer';
        eventsLayer.id = \`events-layer-\${month}\`;
        eventsLayer.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Add drag-to-create event handlers
        const currentMonth = month;
        eventsLayer.addEventListener('mousedown', (e) => handleEventsLayerMouseDown(e, currentMonth));
        eventsLayer.addEventListener('mousemove', (e) => {
          handleEventsLayerMouseMove(e, currentMonth);
          handleEventsLayerHover(e, currentMonth, row);
        });
        eventsLayer.addEventListener('mouseup', (e) => handleEventsLayerMouseUp(e, currentMonth));
        eventsLayer.addEventListener('mouseleave', () => clearDayHeaderHover(row));
        eventsLayer.style.pointerEvents = 'auto';
        
        row.appendChild(eventsLayer);
        
        container.appendChild(row);
      }
      
      // Update min-width for horizontal scroll
      const minWidth = 30 + (totalColumns * currentWidth) + 10;
      container.style.minWidth = minWidth + 'px';
    }
    
    function renderEventSegments(segmentsByMonth, maxLanesPerMonth) {
      const shouldObfuscate = document.getElementById('obfuscateCheckbox')?.checked || false;
      const alpha = isDarkMode() ? 0.35 : 0.35;
      const dynamicRowHeight = document.getElementById('dynamicRowHeightCheckbox')?.checked || false;

      // Calculate global maximum lanes across all months to ensure consistent height
      const globalMaxLanes = getGlobalMaxLanes(maxLanesPerMonth);

      // Calculate height constants
      const laneHeight = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-height')) || 16;
      const laneGap = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-gap')) || 2;
      const headerHeight = 28; // Day headers

      for (let month = 0; month < 12; month++) {
        const eventsLayer = document.getElementById(\`events-layer-\${month}\`);
        if (!eventsLayer) continue;

        eventsLayer.innerHTML = '';

        const segments = segmentsByMonth[month];

        // Calculate lanes for this month: use per-month lanes if dynamic, otherwise global
        let monthLanes;
        if (dynamicRowHeight) {
          // Use actual lanes for this month, minimum 1 for clickability
          monthLanes = Math.max(1, Math.min(maxLanesPerMonth[month] || 0, globalMaxLanes));
        } else {
          monthLanes = globalMaxLanes;
        }

        const eventsHeight = monthLanes * (laneHeight + laneGap) + 8;
        const monthHeight = headerHeight + eventsHeight;

        eventsLayer.style.minHeight = (monthLanes * (laneHeight + laneGap) + 4) + 'px';

        // Set height for month row
        const monthRow = eventsLayer.parentElement;
        if (monthRow) {
          monthRow.style.minHeight = monthHeight + 'px';
          monthRow.style.height = dynamicRowHeight ? 'auto' : monthHeight + 'px';
        }

        // For Fixed Week layout, calculate the weekday offset for this month
        let weekdayOffset = 0;
        if (layoutMode === 'fixedWeek') {
          const firstDayOfMonth = new Date(displayYear, month, 1);
          weekdayOffset = firstDayOfMonth.getDay();
          // Adjust for firstDayOfWeek setting
          if (firstDayOfWeek === 1) {
            weekdayOffset = (weekdayOffset + 6) % 7;
          }
        }
        
        for (const segment of segments) {
          // Filter out events in lanes beyond the user's maximum
          // Lane is 0-indexed, so if max is 4, we show lanes 0, 1, 2, 3 (4 total)
          if (segment.lane >= globalMaxLanes) {
            continue; // Skip this segment
          }
          
          const segmentEl = document.createElement('div');
          segmentEl.className = 'event-segment';
          
          if (segment.continuesLeft) {
            segmentEl.classList.add('continues-left');
          }
          if (segment.continuesRight) {
            segmentEl.classList.add('continues-right');
          }
          
          // CSS Grid positioning
          // For Date Grid: day 1 = column 2 (after label column)
          // For Fixed Week: day 1 = column (weekdayOffset + 2) because of the offset
          let startCol, endCol;
          if (layoutMode === 'fixedWeek') {
            // In Fixed Week, columns are shifted by the weekday offset
            startCol = segment.startDay + weekdayOffset + 1; // +1 for label column
            endCol = segment.endDay + weekdayOffset + 2; // +2 because grid-column-end is exclusive
          } else {
            // Date Grid: simple day-based positioning
            startCol = segment.startDay + 1; // +1 for label column
            endCol = segment.endDay + 2; // +2 because grid-column-end is exclusive
          }
          
          segmentEl.style.gridColumn = \`\${startCol} / \${endCol}\`;
          segmentEl.style.gridRow = segment.lane + 1; // 1-indexed
          
          // Colors
          const bgColor = colorWithOpacity(segment.color, alpha);
          const textColor = getTextColorForBackground(segment.color, alpha);
          segmentEl.style.backgroundColor = bgColor;
          segmentEl.style.color = textColor;
          
          // Font size - use CSS variable (will be applied via CSS)
          // The CSS variable is already set, but we ensure it's applied
          const eventTextSize = getComputedStyle(document.documentElement).getPropertyValue('--event-text-size') || '10px';
          segmentEl.style.fontSize = eventTextSize;
          
          // Title (only on first segment of multi-segment events)
          if (segment.showTitle) {
            const displayText = shouldObfuscate ? obfuscateText(segment.title) : segment.title;
            segmentEl.textContent = displayText;
          }
          segmentEl.title = segment.title; // Tooltip
          
          // Add click handler for editing
          segmentEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // Find the original event data to edit
            const eventData = {
              id: segment.eventId,
              title: segment.title,
              startDate: segment.originalStartDate,
              endDate: segment.originalEndDate,
              calendarTitle: segment.calendarTitle,
              isAllDay: true
            };
            handleEventSegmentClick(e, eventData);
          });
          
          eventsLayer.appendChild(segmentEl);
        }
      }
    }
    
    function updateCalendarDisplay() {
      // Get filtered events
      const filteredEvents = getFilteredEvents();
      
      // Normalize events
      const normalized = normalizeEvents(filteredEvents, displayYear);
      
      // Assign lanes globally
      const withLanes = assignLanes(normalized);
      
      // Create per-month segments
      const segmentsByMonth = createMonthSegments(withLanes, displayYear);
      
      // Get max lanes per month
      const maxLanesPerMonth = getMaxLanesPerMonth(segmentsByMonth);
      
      // Render event segments
      renderEventSegments(segmentsByMonth, maxLanesPerMonth);
    }
    
    function updateGridColumns(width) {
      const rows = document.querySelectorAll('.month-row');
      rows.forEach(row => {
        row.style.setProperty('--cell-width', width + 'px');
      });
      
      const minWidth = 30 + (31 * width) + 10;
      const container = document.getElementById('calendarContainer');
      if (container) {
        container.style.minWidth = minWidth + 'px';
      }
    }
    
    function changeYear(delta) {
      displayYear += delta;
      document.getElementById('yearDisplay').textContent = displayYear;
      
      renderCalendar();
      
      const needsReload = !loadedYearRange || 
                         displayYear < loadedYearRange.start || 
                         displayYear > loadedYearRange.end;
      
      if (needsReload) {
        loadCalendarEventsProgressively(displayYear);
                      } else {
        updateCalendarDisplay();
      }
    }
    
    // ============================================
    // Event Creation/Editing Modal Functions
    // ============================================
    
    function openEventModal(startDate, endDate, existingEvent = null) {
      editingEvent = existingEvent;
      void eventEditor.open({ start: startDate, end: endDate, event: existingEvent });
    }

    // ============================================
    // Drag-to-Create Event Functions
    // ============================================
    
    function createDummyEvent(month, startDay, endDay) {
      removeDummyEvent();
      
      const eventsLayer = document.getElementById(\`events-layer-\${month}\`);
      if (!eventsLayer) return;
      
      const dummy = document.createElement('div');
      dummy.className = 'event-segment dummy-event';
      dummy.textContent = 'New Event';
      
      // Calculate column positions based on layout mode
      let startCol, endCol;
      if (layoutMode === 'fixedWeek') {
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let weekdayOffset = firstDayOfMonth.getDay();
        if (firstDayOfWeek === 1) {
          weekdayOffset = (weekdayOffset + 6) % 7;
        }
        startCol = startDay + weekdayOffset + 1;
        endCol = endDay + weekdayOffset + 2;
      } else {
        startCol = startDay + 1;
        endCol = endDay + 2;
      }
      
      dummy.style.gridColumn = \`\${startCol} / \${endCol}\`;
      dummy.style.gridRow = '1';
      
      eventsLayer.appendChild(dummy);
      dummyEventElement = dummy;
    }
    
    function removeDummyEvent() {
      if (dummyEventElement && dummyEventElement.parentNode) {
        dummyEventElement.parentNode.removeChild(dummyEventElement);
      }
      dummyEventElement = null;
    }
    
    function handleEventsLayerMouseDown(event, month) {
      // Don't start drag if clicking on an existing event
      if (event.target.classList.contains('event-segment') && !event.target.classList.contains('dummy-event')) {
        return;
      }

      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);

      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        return;
      }

      const clickedDate = new Date(displayYear, month, dayCell.day);

      // Handle modifier keys to open notes instead of creating events
      if (event.metaKey) {
        openNote(clickedDate, false, true);
        event.preventDefault();
        return;
      } else if (event.altKey) {
        openNote(clickedDate, true, false);
        event.preventDefault();
        return;
      }

      isDragging = true;
      dragStartMonth = month;
      dragStartDate = clickedDate;
      dragEndDate = clickedDate;

      createDummyEvent(month, dayCell.day, dayCell.day);

      event.preventDefault();
    }
    
    function handleEventsLayerMouseMove(event, month) {
      if (!isDragging || dragStartMonth !== month) return;
      
      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);
      
      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        return;
      }
      
      dragEndDate = new Date(displayYear, month, dayCell.day);
      
      // Update dummy event to span from start to current position
      const startDay = Math.min(dragStartDate.getDate(), dragEndDate.getDate());
      const endDay = Math.max(dragStartDate.getDate(), dragEndDate.getDate());
      
      createDummyEvent(month, startDay, endDay);
    }
    
    function handleEventsLayerMouseUp(event, month) {
      if (!isDragging) return;
      
      isDragging = false;
      
      // Ensure dates are in correct order
      let startDate = dragStartDate;
      let endDate = dragEndDate;
      if (endDate < startDate) {
        [startDate, endDate] = [endDate, startDate];
      }
      
      // Open modal with the selected date range
      openEventModal(startDate, endDate, null);
    }
    
    function handleEventsLayerHover(event, month, row) {
      // Don't update hover when dragging
      if (isDragging) return;
      
      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);
      
      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        clearDayHeaderHover(row);
        return;
      }
      
      // Find the day header with matching day number
      const dayHeaders = row.querySelectorAll('.day-header');
      dayHeaders.forEach(header => {
        if (header.dataset.day === String(dayCell.day) && header.dataset.month === String(month)) {
          header.classList.add('hovered');
        } else {
          header.classList.remove('hovered');
        }
      });
    }
    
    function clearDayHeaderHover(row) {
      const dayHeaders = row.querySelectorAll('.day-header.hovered');
      dayHeaders.forEach(header => {
        header.classList.remove('hovered');
      });
    }
    
    function getDayCellFromPosition(event, eventsLayer, month) {
      const rect = eventsLayer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      
      const labelWidth = 30; // Month label width
      const spacerWidth = 10; // Spacer at the end
      
      // Calculate actual cell width from container width
      // Grid: labelWidth + N columns + spacerWidth = total width
      const numColumns = layoutMode === 'fixedWeek' ? 37 : 31;
      const availableWidth = rect.width - labelWidth - spacerWidth;
      const cellWidth = availableWidth / numColumns;
      
      // Calculate which column was clicked (0-indexed)
      const clickedColumn = Math.floor((x - labelWidth) / cellWidth);
      
      if (layoutMode === 'fixedWeek') {
        // For fixed week, we need to convert column back to day
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let weekdayOffset = firstDayOfMonth.getDay();
        if (firstDayOfWeek === 1) {
          weekdayOffset = (weekdayOffset + 6) % 7;
        }
        // Column 0 = weekdayOffset day 1, so day = column - weekdayOffset + 1
        const day = clickedColumn - weekdayOffset + 1;
        return { day };
      } else {
        // Date Grid: column 0 = day 1
        return { day: clickedColumn + 1 };
      }
    }
    
    async function handleEventSegmentClick(event, eventData) {
      event.stopPropagation();
      const original = rawEvents.find(function(item) {
        return item.id === eventData.id && new Date(item.startDate).getTime() === new Date(eventData.startDate).getTime();
      });
      if (original) openEventModal(new Date(original.startDate), new Date(original.endDate), original);
    }

    async function loadWritableCalendars() {
      try {
        const allCalendars = await Calendar.availableCalendars({ writeOnly: true, enabledOnly: true });
        // Filter to only writable calendars (extra safety)
        writableCalendars = (allCalendars || []).filter(cal => cal.isWritable !== false);
      } catch (error) {
        console.error('Failed to load writable calendars:', error);
        writableCalendars = [];
      }
    }
    
    function setupEventModalListeners() {
      // Global mouse up to handle drag end outside events layer
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          // If we ended outside, still open the modal with current selection
          if (dragStartDate && dragEndDate) {
            let startDate = dragStartDate;
            let endDate = dragEndDate;
            if (endDate < startDate) {
              [startDate, endDate] = [endDate, startDate];
            }
            openEventModal(startDate, endDate, null);
          }
        }
      });
    }
    
    // ============================================
    // Layout Helper Functions
    // ============================================
    
    function updateLayoutButtons() {
      const dateGridBtn = document.getElementById('layoutDateGrid');
      const fixedWeekBtn = document.getElementById('layoutFixedWeek');
      const firstDaySection = document.getElementById('firstDayOfWeekSection');
      
      if (dateGridBtn) {
        dateGridBtn.classList.toggle('active', layoutMode === 'dateGrid');
      }
      if (fixedWeekBtn) {
        fixedWeekBtn.classList.toggle('active', layoutMode === 'fixedWeek');
      }
      if (firstDaySection) {
        firstDaySection.style.display = layoutMode === 'fixedWeek' ? 'block' : 'none';
      }
    }
    
    function updateFirstDayButtons() {
      const sundayBtn = document.getElementById('firstDaySunday');
      const mondayBtn = document.getElementById('firstDayMonday');
      
      if (sundayBtn) {
        sundayBtn.classList.toggle('active', firstDayOfWeek === 0);
      }
      if (mondayBtn) {
        mondayBtn.classList.toggle('active', firstDayOfWeek === 1);
      }
    }
    
    // ============================================
    // Event Filter
    // ============================================
    let filterText = '';

    function initEventFilter() {
      const input = document.getElementById('eventFilterInput');
      const clearBtn = document.getElementById('eventFilterClear');
      const toggle = document.getElementById('eventFilterToggle');
      const container = document.getElementById('eventFilterContainer');

      if (!input || !container) return;

      // Track if user is interacting within the container (for blur handling)
      let isInteractingWithFilter = false;

      container.addEventListener('mousedown', function() {
        isInteractingWithFilter = true;
      });

      function expandFilter() {
        container.classList.add('expanded');
        input.focus();
      }

      function collapseFilter() {
        if (!input.value.trim()) {
          container.classList.remove('expanded');
        }
      }

      // Toggle button toggles filter (expand/collapse)
      if (toggle) {
        toggle.addEventListener('click', function(e) {
          e.stopPropagation();
          if (container.classList.contains('expanded')) {
            // Already expanded - collapse it and clear
            input.value = '';
            filterText = '';
            container.classList.remove('has-value');
            container.classList.remove('expanded');
            applyEventFilter();
          } else {
            expandFilter();
          }
        });
      }

      // Cmd+F / Ctrl+F to expand and focus
      document.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault();
          expandFilter();
        }
      });

      input.addEventListener('input', function() {
        filterText = this.value.trim().toLowerCase();

        // Toggle has-value class for clear button visibility
        container.classList.toggle('has-value', this.value.length > 0);

        applyEventFilter();
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          this.value = '';
          filterText = '';
          container.classList.remove('has-value');
          container.classList.remove('expanded');
          applyEventFilter();
          this.blur();
        }
      });

      // Collapse on blur if empty and user isn't interacting with filter
      input.addEventListener('blur', function() {
        setTimeout(function() {
          if (isInteractingWithFilter) {
            isInteractingWithFilter = false; // Reset for next interaction
            return;
          }
          collapseFilter();
        }, 150);
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          input.value = '';
          filterText = '';
          container.classList.remove('has-value');
          applyEventFilter();
          input.focus();
        });
      }
    }

    function applyEventFilter() {
      // Find all event elements in the linear calendar (uses event-segment class)
      const eventElements = document.querySelectorAll('.event-segment:not(.dummy-event)');

      eventElements.forEach(function(el) {
        const eventTitle = (el.title || el.textContent || '').toLowerCase();
        const matches = !filterText || eventTitle.includes(filterText);

        if (matches) {
          el.style.visibility = '';
          el.style.opacity = '';
        } else {
          // Use visibility hidden to maintain layout
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
        }
      });
    }

    // ============================================
    // Initialization
    // ============================================

    async function initialize() {
      const cellWidthSlider = document.getElementById('cellWidthSlider');
      const cellWidthValue = document.getElementById('cellWidthValue');
      const eventTextSizeSlider = document.getElementById('eventTextSizeSlider');
      const eventTextSizeValue = document.getElementById('eventTextSizeValue');
      const maxEventRowsSlider = document.getElementById('maxEventRowsSlider');
      const maxEventRowsValue = document.getElementById('maxEventRowsValue');
      const obfuscateCheckbox = document.getElementById('obfuscateCheckbox');
      
      // Load saved settings from localStorage
      const savedWidth = localStorage.getItem('calendarCellWidth');
      const initialWidth = savedWidth ? parseInt(savedWidth) : 35;
      cellWidthSlider.value = initialWidth;
      cellWidthValue.textContent = initialWidth + 'px';
      document.documentElement.style.setProperty('--cell-width', initialWidth + 'px');
      
      const savedTextSize = localStorage.getItem('calendarEventTextSize');
      const initialTextSize = savedTextSize ? parseInt(savedTextSize) : 10;
      eventTextSizeSlider.value = initialTextSize;
      eventTextSizeValue.textContent = initialTextSize + 'px';
      document.documentElement.style.setProperty('--event-text-size', initialTextSize + 'px');
      
      const savedMaxRows = localStorage.getItem('calendarMaxEventRows');
      const initialMaxRows = savedMaxRows ? parseInt(savedMaxRows) : 7;
      maxEventRowsSlider.value = initialMaxRows;
      maxEventRowsValue.textContent = initialMaxRows;
      
      const savedObfuscate = localStorage.getItem('calendarObfuscateText');
      obfuscateCheckbox.checked = savedObfuscate === 'true';
      
      const hideSingleDayEventsCheckbox = document.getElementById('hideSingleDayEventsCheckbox');
      const savedHideSingleDay = localStorage.getItem('calendarHideSingleDayEvents');
      // Default: unchecked (show single-day events by default)
      hideSingleDayEventsCheckbox.checked = savedHideSingleDay === 'true';

      const showOnlyAllDayEventsCheckbox = document.getElementById('showOnlyAllDayEventsCheckbox');
      const savedShowOnlyAllDay = localStorage.getItem('calendarShowOnlyAllDayEvents');
      // Default: unchecked (show all events by default)
      showOnlyAllDayEventsCheckbox.checked = savedShowOnlyAllDay === 'true';

      const dynamicRowHeightCheckbox = document.getElementById('dynamicRowHeightCheckbox');
      const savedDynamicRowHeight = localStorage.getItem('calendarDynamicRowHeight');
      // Default: unchecked (fixed height by default)
      dynamicRowHeightCheckbox.checked = savedDynamicRowHeight === 'true';

      // Load layout mode and first day of week
      const savedLayoutMode = localStorage.getItem('calendarLayoutMode');
      if (savedLayoutMode === 'fixedWeek' || savedLayoutMode === 'dateGrid') {
        layoutMode = savedLayoutMode;
      }
      
      const savedFirstDay = localStorage.getItem('calendarFirstDayOfWeek');
      if (savedFirstDay === '0' || savedFirstDay === '1') {
        firstDayOfWeek = parseInt(savedFirstDay);
      }
      
      // Update layout button states
      updateLayoutButtons();
      updateFirstDayButtons();

      // Event filter initialization
      initEventFilter();

      // Event listeners for layout buttons
      document.getElementById('layoutDateGrid').addEventListener('click', () => {
        layoutMode = 'dateGrid';
        localStorage.setItem('calendarLayoutMode', layoutMode);
        updateLayoutButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      document.getElementById('layoutFixedWeek').addEventListener('click', () => {
        layoutMode = 'fixedWeek';
        localStorage.setItem('calendarLayoutMode', layoutMode);
        updateLayoutButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      // Event listeners for first day of week buttons
      document.getElementById('firstDaySunday').addEventListener('click', () => {
        firstDayOfWeek = 0;
        localStorage.setItem('calendarFirstDayOfWeek', firstDayOfWeek.toString());
        updateFirstDayButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      document.getElementById('firstDayMonday').addEventListener('click', () => {
        firstDayOfWeek = 1;
        localStorage.setItem('calendarFirstDayOfWeek', firstDayOfWeek.toString());
        updateFirstDayButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      // Event listeners
      cellWidthSlider.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        document.documentElement.style.setProperty('--cell-width', width + 'px');
        cellWidthValue.textContent = width + 'px';
        localStorage.setItem('calendarCellWidth', width.toString());
        updateGridColumns(width);
      });
      
      eventTextSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        eventTextSizeValue.textContent = size + 'px';
        localStorage.setItem('calendarEventTextSize', size.toString());
        document.documentElement.style.setProperty('--event-text-size', size + 'px');
        // Update all existing event segments with new text size
        updateEventTextSize(size);
        updateCalendarDisplay();
      });
      
      maxEventRowsSlider.addEventListener('input', (e) => {
        const maxRows = parseInt(e.target.value);
        maxEventRowsValue.textContent = maxRows;
        localStorage.setItem('calendarMaxEventRows', maxRows.toString());
        // Update calendar display to apply new maximum height
        updateCalendarDisplay();
      });
      
      obfuscateCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarObfuscateText', e.target.checked.toString());
        updateCalendarDisplay();
      });
      
      hideSingleDayEventsCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarHideSingleDayEvents', e.target.checked.toString());
        updateCalendarDisplay();
      });

      showOnlyAllDayEventsCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarShowOnlyAllDayEvents', e.target.checked.toString());
        updateCalendarDisplay();
      });

      dynamicRowHeightCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarDynamicRowHeight', e.target.checked.toString());
        updateCalendarDisplay();
      });

      document.getElementById('yearPrev').addEventListener('click', () => changeYear(-1));
      document.getElementById('yearNext').addEventListener('click', () => changeYear(1));

      // Listen for dark mode changes to update event label colors
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        updateCalendarDisplay();
      });

      // Setup event modal listeners
      setupEventModalListeners();
      
      // Load writable calendars for event creation
      await loadWritableCalendars();
      
      // Render initial calendar
      renderCalendar();
      
      // Load calendars for filter
      await populateCalendarFilter();
      
      // Load events progressively
      loadCalendarEventsProgressively(displayYear);
    }
    
    function showAPIUnavailableMessage() {
      const container = document.getElementById('calendarContainer');
      container.innerHTML = \`
        <div class="api-unavailable">
          <div class="api-unavailable-icon">📅</div>
          <div class="api-unavailable-title">Calendar API Not Available</div>
          <div class="api-unavailable-message">
            This plugin requires a newer version of NotePlan with the integrated Calendar API.
            Please update NotePlan to the latest version to use this feature.
          </div>
        </div>
      \`;
    }
    
    function checkBridgeAndInitialize() {
      // Check if bridge is ready and Calendar API is available
      if (typeof Calendar !== 'undefined') {
        initialize();
      } else {
        showAPIUnavailableMessage();
      }
    }
    
    // Initialize when bridge is ready
    // The bridge sets window.__notePlanBridgeReady and dispatches 'notePlanBridgeReady' event
    if (typeof Calendar !== 'undefined') {
      // Bridge already ready
      initialize();
    } else {
      // Wait for bridge ready event
      window.addEventListener('notePlanBridgeReady', () => {
        checkBridgeAndInitialize();
      }, { once: true });
      
      // Fallback: check after a delay in case event was missed
      setTimeout(() => {
        if (typeof Calendar === 'undefined') {
          showAPIUnavailableMessage();
        } else {
          // Bridge became available, initialize
          initialize();
        }
      }, 2000);
    }
        </script>
      </body>
</html>`
}

/**
 * Plugin initialization - called by NotePlan when the plugin loads
 * Checks for updates in the background
 */
function init() {
  try {
    // Check for plugin updates silently in the background
    // Parameters: (pluginIDs, showPromptIfSuccessful, showProgressPrompt, showFailedPrompt)
    DataStore.installOrUpdatePluginsByID(['emetzger.LinearCalendar'], false, false, false);
  } catch (error) {
    // Silently ignore update check failures
  }
}

/**
 * Called after the plugin is updated or installed
 * Can be used for settings migrations or user notifications
 */
function onUpdateOrInstall() {
  // Plugin updated successfully
}
