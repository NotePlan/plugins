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
    field('repeat').closest('.ce-row').hidden = !recurrence
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
 * Calendar Plugin
 * Apple Calendar-style view with Year, Month, Week, and Day views
 * Uses the Calendar API bridge from within HTML views
 */

/**
 * Main function to show the calendar view
 */
async function showCalendar() {
  try {
    HTMLView.showInMainWindow(getCalendarHTML(), "Calendar", {
      splitView: false,
      icon: "calendar",
      iconColor: "red-500",
    })
  } catch (error) {
    // Error handled silently
  }
}

/**
 * chrono-node v2.9.0 - Natural language date parser
 * Embedded for offline use. Source: https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/+esm
 * MIT License - https://github.com/wanasit/chrono
 */

/**
 * chrono-node v2.9.0 - Natural language date parser
 * Embedded for offline use. Source: https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/+esm
 * MIT License - https://github.com/wanasit/chrono
 */
function getCalendarHTML() {
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

    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f5f7;
      --bg-tertiary: #fafafa;
      --text-primary: #1d1d1f;
      --text-secondary: #86868b;
      --text-muted: #aeaeb2;
      --border-color: #e5e5e7;
      --accent-color: #FF8800;
      --accent-light: rgba(255, 136, 0, 0.1);
      --hover-bg: rgba(0, 0, 0, 0.04);
      --active-bg: rgba(0, 0, 0, 0.08);
      --hour-height: 60px;
      --time-column-width: 56px;
      --header-height: 44px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1c1c1e;
        --bg-secondary: #2c2c2e;
        --bg-tertiary: #232325;
        --text-primary: #f5f5f7;
        --text-secondary: #98989d;
        --text-muted: #636366;
        --border-color: #38383a;
        --accent-color: #FF7700;
        --accent-light: rgba(255, 119, 0, 0.1);
        --hover-bg: rgba(255, 255, 255, 0.08);
        --active-bg: rgba(255, 255, 255, 0.12);
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ============================================
       Header / Navigation
       ============================================ */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
      height: var(--header-height);
    }

    .nav-buttons {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .nav-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      color: var(--text-secondary);
      transition: all 0.15s;
    }

    .nav-btn:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .nav-btn:active {
      background: var(--active-bg);
    }

    .today-circle-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      padding: 0;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      top: 1px;
    }

    .today-circle-btn::after {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--text-secondary);
      border-radius: 50%;
      transition: background 0.15s;
    }

    .today-circle-btn:hover {
      background: var(--hover-bg);
    }

    .today-circle-btn:hover::after {
      background: var(--accent-color);
    }

    .today-circle-btn:active {
      background: var(--active-bg);
    }

    .nav-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      min-width: 180px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    /* View Switcher */
    .view-switcher {
      display: flex;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 2px;
    }

    .view-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .view-btn:hover {
      color: var(--text-primary);
    }

    .view-btn.active {
      background: var(--bg-primary);
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    /* Quick Add - Collapsible */
    .quick-add-container {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .quick-add-toggle {
      width: 28px;
      height: 28px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
      order: 1;
    }

    .quick-add-toggle:hover {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: white;
    }

    .quick-add-expanded {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow: hidden;
      max-width: 0;
      opacity: 0;
      transition: max-width 0.25s ease, opacity 0.2s ease;
    }

    .quick-add-container.expanded .quick-add-expanded {
      max-width: 300px;
      opacity: 1;
    }

    .quick-add-input {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 13px;
      width: 160px;
      background: var(--bg-primary);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .quick-add-input:focus {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.1);
    }

    .quick-add-input::placeholder {
      color: var(--text-muted);
      font-size: 12px;
    }

    /* Quick Add Calendar Selector - Compact */
    .quick-add-calendar-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 6px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      cursor: pointer;
      transition: all 0.15s;
      font-size: 12px;
      color: var(--text-primary);
      white-space: nowrap;
      box-sizing: border-box;
    }

    .quick-add-calendar-btn:hover {
      background: var(--hover-bg);
      border-color: var(--text-muted);
    }

    .quick-add-cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .quick-add-cal-name {
      display: none;
    }

    .quick-add-cal-arrow {
      font-size: 10px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .quick-add-calendar-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
      min-width: 180px;
    }

    .quick-add-calendar-dropdown.visible {
      display: block;
    }

    .quick-add-calendar-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .quick-add-calendar-option:hover {
      background: var(--hover-bg);
    }

    .quick-add-calendar-option.selected {
      background: var(--accent-light);
    }

    .quick-add-calendar-option .cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .quick-add-calendar-option .cal-name {
      font-size: 13px;
      color: var(--text-primary);
    }

    /* Calendar Source Headers */
    .calendar-source-header {
      padding: 8px 12px 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 1px solid var(--border-color);
    }

    .calendar-source-header:first-child {
      border-top: none;
    }

    /* Calendar Filter Dropdown */
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
      background: var(--hover-bg);
    }

    .event-filter-icon {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .event-filter.expanded .event-filter-icon,
    .event-filter.has-value .event-filter-icon {
      color: var(--accent-color);
    }

    .event-filter-input {
      border: none;
      background: var(--bg-secondary);
      color: var(--text-primary);
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
      color: var(--text-muted);
      font-size: 12px;
    }

    .event-filter-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 0;
      height: 18px;
      border: none;
      background: var(--bg-tertiary);
      color: var(--text-muted);
      border-radius: 50%;
      cursor: pointer;
      font-size: 10px;
      flex-shrink: 0;
      opacity: 0;
      overflow: hidden;
      transition: width 0.15s ease, opacity 0.15s ease, margin 0.15s ease;
    }

    .event-filter-clear:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .event-filter.expanded.has-value .event-filter-clear {
      width: 18px;
      opacity: 1;
      margin-left: 4px;
    }

    /* Calendar Filter */
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
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      outline: none;
      position: relative;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .calendar-filter-button:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .calendar-filter-icon {
      font-size: 14px;
    }

    .calendar-filter-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: var(--accent-color);
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

    .calendar-filter-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 250px;
      max-width: 350px;
      max-height: 300px;
      overflow-y: auto;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      display: none;
      padding: 4px 0;
    }

    .calendar-filter-dropdown.visible {
      display: block;
    }

    .calendar-filter-action-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.15s;
      border-bottom: 1px solid var(--border-color);
      font-size: 13px;
      font-weight: 500;
      color: var(--accent-color);
    }

    .calendar-filter-action-item:hover {
      background: var(--hover-bg);
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
      background: var(--hover-bg);
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
      accent-color: var(--accent-color);
    }

    .calendar-filter-item-label {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary);
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
      color: var(--text-muted);
      margin-left: auto;
      font-style: normal;
    }

    /* ============================================
       Main Calendar Container
       ============================================ */
    .calendar-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ============================================
       Month View
       ============================================ */
    .month-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .weekday-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .weekday-cell {
      padding: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .month-weeks {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .week-row {
      flex: 1;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--border-color);
      overflow: hidden;
    }

    .week-day-numbers {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex-shrink: 0;
    }

    .day-number-cell {
      padding: 4px 6px;
      cursor: pointer;
      transition: background 0.15s;
      border-right: 1px solid var(--border-color);
    }

    .day-number-cell:last-child {
      border-right: none;
    }

    .day-number-cell:hover {
      background: var(--hover-bg);
    }

    .day-number-cell.other-month {
      background: var(--bg-tertiary);
    }

    .day-number-cell.other-month .day-num {
      color: var(--text-muted);
    }

    .day-num {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .day-number-cell.today .day-num {
      background: var(--accent-color);
      color: white;
      border-radius: 50%;
    }

    /* Per-column content grid */
    .week-days-content {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex: 1;
      min-height: 0;
    }

    .day-column {
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    /* Use pseudo-element for border so events can appear above it */
    .day-column::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: 1px;
      background: var(--border-color);
      pointer-events: none;
      z-index: 0;
    }

    .day-column:last-child::after {
      display: none;
    }

    .day-column.other-month {
      background: var(--bg-tertiary);
    }

    .day-column:hover {
      background: var(--hover-bg);
    }

    .day-column.other-month:hover {
      background: var(--hover-bg);
    }

    /* Multi-day event slots within each column */
    .multi-day-slots {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }

    .event-slot {
      height: 18px;
      padding: 0 6px;
      margin: 1px 4px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
      box-sizing: border-box;
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      line-height: 1;
    }

    .event-slot:hover {
      opacity: 0.8;
    }

    .event-slot.empty {
      background: transparent !important;
      cursor: default;
    }

    .event-slot.hide-title {
      color: transparent;
    }

    /* Visual continuity - overlap borders for spanning effect */
    .event-slot.continues-left {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;
      padding-left: 7px;
    }

    .event-slot.continues-right {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      margin-right: -1px;
      padding-right: 7px;
    }

    /* Single-day events area */
    .single-day-events {
      padding: 2px 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      flex: 1;
      cursor: pointer;
    }

    .event-chip {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      flex-shrink: 0;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .event-chip:hover {
      opacity: 0.8;
    }

    /* Timed events: color bar on left, no background */
    .event-chip.timed {
      background: transparent !important;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
    }

    .event-chip.timed .event-color-bar {
      width: 3px;
      height: 14px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .event-chip.timed .event-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 400;
    }

    .event-chip.timed .event-time {
      font-size: 10px;
      color: var(--text-secondary);
      flex-shrink: 0;
      font-weight: 400;
    }

    .event-chip.timed:hover {
      background: var(--hover-bg) !important;
    }

    /* All-day events keep colored background */
    .event-chip.all-day {
      font-weight: 500;
    }

    .more-events {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 2px 4px;
      flex-shrink: 0;
      cursor: pointer;
    }

    .more-events:hover {
      color: var(--text-primary);
    }

    /* ============================================
       Week View
       ============================================ */
    .week-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .week-header {
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .week-header-spacer {
      border-right: 1px solid var(--border-color);
    }

    .week-header-day {
      padding: 8px;
      text-align: center;
      border-right: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
      overflow: hidden;
      min-width: 0;
    }

    .week-header-day:hover {
      background: var(--hover-bg);
    }

    .week-header-day.today {
      background: var(--accent-light);
    }

    .week-day-name {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .week-day-number {
      font-size: 20px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .week-header-day.today .week-day-number {
      color: var(--accent-color);
    }

    /* All-day section */
    .all-day-section {
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      min-height: 28px;
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .all-day-label {
      padding: 4px 8px;
      font-size: 10px;
      color: var(--text-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      align-items: center;
    }

    .all-day-column {
      border-right: 1px solid var(--border-color);
      padding: 2px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      min-width: 0;
    }

    /* Time grid */
    .week-body {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      position: relative;
    }

    .time-column {
      border-right: 1px solid var(--border-color);
    }

    .time-slot-label {
      height: var(--hour-height);
      padding: 0 8px;
      font-size: 10px;
      color: var(--text-secondary);
      text-align: right;
      position: relative;
      top: -6px;
    }

    .day-column {
      /* border handled by ::after pseudo-element in base .day-column */
      position: relative;
      overflow: hidden;
      min-width: 0;
    }

    .hour-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px solid var(--border-color);
    }

    .half-hour-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px dashed var(--border-color);
      opacity: 0.5;
    }

    .current-time-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent-color);
      z-index: 10;
    }

    .current-time-line::before {
      content: '';
      position: absolute;
      left: -4px;
      top: -3px;
      width: 8px;
      height: 8px;
      background: var(--accent-color);
      border-radius: 50%;
    }

    .timed-event {
      position: absolute;
      left: 2px;
      right: 2px;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 500;
      overflow: hidden;
      cursor: pointer;
      z-index: 5;
      transition: opacity 0.15s;
    }

    .timed-event:hover {
      opacity: 0.85;
    }

    .timed-event-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .timed-event-time {
      font-size: 10px;
      opacity: 0.8;
    }

    /* ============================================
       Day View
       ============================================ */
    .day-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .day-view .week-header {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    .day-view .all-day-section {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    .day-view .week-body {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    /* ============================================
       Year View
       ============================================ */
    .year-view {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .year-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .mini-month {
      cursor: pointer;
      transition: transform 0.15s;
    }

    .mini-month:hover {
      transform: scale(1.02);
    }

    .mini-month-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
      text-align: center;
    }

    .mini-month-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .mini-weekday {
      font-size: 9px;
      font-weight: 600;
      color: var(--text-muted);
      text-align: center;
      padding: 4px 0;
    }

    .mini-day {
      font-size: 11px;
      text-align: center;
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      position: relative;
    }

    .mini-day-number {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .mini-day.other-month {
      color: var(--text-muted);
    }

    .mini-day.today .mini-day-number {
      background: var(--accent-color);
      color: white;
      font-weight: 600;
    }

    .mini-day.has-events::after {
      content: '';
      display: block;
      width: 4px;
      height: 4px;
      background: var(--accent-color);
      border-radius: 50%;
      margin-top: 1px;
    }

    .mini-day.today.has-events::after {
      background: white;
    }

    /* ============================================
       Event Modal
       ============================================ */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-overlay.visible {
      display: flex;
    }

    .modal {
      background: var(--bg-primary);
      border-radius: 12px;
      width: 380px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .modal-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-close {
      background: transparent;
      border: none;
      font-size: 20px;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      line-height: 1;
    }

    .modal-close:hover {
      color: var(--text-primary);
    }

    .modal-body {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 15px;
      background: var(--bg-primary);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s;
    }

    .form-input:focus {
      border-color: var(--accent-color);
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .form-row .form-group {
      flex: 1;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-row input {
      width: 18px;
      height: 18px;
      accent-color: var(--accent-color);
    }

    .checkbox-row label {
      font-size: 14px;
      color: var(--text-primary);
    }

    .modal-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
    }

    .btn-delete {
      background: transparent;
      color: #FF3B30;
    }

    .btn-delete:hover {
      background: rgba(255, 59, 48, 0.1);
    }

    .btn-cancel {
      background: var(--bg-secondary);
      color: var(--text-primary);
      margin-left: auto;
    }

    .btn-cancel:hover {
      background: var(--active-bg);
    }

    .btn-save {
      background: var(--accent-color);
      color: white;
    }

    .btn-save:hover {
      opacity: 0.9;
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      text-align: center;
      padding: 40px;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ============================================
       Responsive Styles
       ============================================ */

    /* Medium screens - start shrinking toolbar items */
    @media (max-width: 1100px) {
      .quick-add-input {
        width: 140px;
      }

      .event-filter.expanded .event-filter-input {
        width: 120px;
        max-width: 120px;
      }
    }

    /* Smaller medium screens - wrap to second row */
    @media (max-width: 950px) {
      .header {
        flex-wrap: wrap;
        height: auto;
        gap: 8px;
      }

      .nav-title {
        flex: 1;
      }

      .header-right {
        width: 100%;
        order: 3;
        flex-wrap: wrap;
        gap: 8px;
      }

      .quick-add-container.expanded .quick-add-expanded {
        max-width: 250px;
      }

      .quick-add-input {
        width: 140px;
      }

      .event-filter {
        flex: 0 0 auto;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }
    }

    /* Tablet and below */
    @media (max-width: 768px) {
      :root {
        --time-column-width: 48px;
      }

      .header {
        flex-wrap: wrap;
        height: auto;
        padding: 8px;
        gap: 8px;
      }

      .nav-title {
        font-size: 15px;
        min-width: auto;
        flex: 1;
      }

      .header-right {
        width: 100%;
        justify-content: space-between;
        order: 3;
      }

      .quick-add-container.expanded .quick-add-expanded {
        max-width: 220px;
      }

      .quick-add-input {
        width: 120px;
      }

      .view-btn {
        padding: 5px 8px;
        font-size: 12px;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }

      /* Year view adjustments */
      .year-view {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 12px !important;
        padding: 12px !important;
      }

      .mini-calendar {
        padding: 8px !important;
      }

      .mini-month-title {
        font-size: 13px !important;
      }

      .mini-day {
        width: 28px !important;
        height: 28px !important;
        font-size: 11px !important;
      }

      /* Month view adjustments */
      .month-view {
        font-size: 12px;
      }

      .weekday-cell {
        padding: 6px 2px !important;
        font-size: 11px !important;
      }

      .day-column {
        min-height: 70px !important;
      }

      .day-number-cell {
        font-size: 12px !important;
      }

      .event-chip {
        font-size: 10px !important;
        padding: 1px 4px !important;
      }

      .event-chip.timed .event-color-bar {
        width: 2px !important;
        height: 12px !important;
      }

      .event-chip.timed .event-time {
        font-size: 9px !important;
      }

      /* Week view adjustments */
      .week-header .day-header {
        padding: 6px 2px !important;
        font-size: 11px !important;
      }

      .day-header .day-number {
        width: 28px !important;
        height: 28px !important;
        font-size: 13px !important;
      }

      .event-slot {
        font-size: 10px !important;
        height: 16px !important;
        padding: 1px 4px !important;
      }

      .timed-event {
        font-size: 10px !important;
        padding: 2px 4px !important;
      }

      /* Day view adjustments */
      .day-view-header {
        padding: 8px !important;
      }

      .day-view-title {
        font-size: 18px !important;
      }

      /* Modal adjustments */
      .modal {
        width: 95% !important;
        max-width: none !important;
        margin: 10px;
      }

      .form-row {
        flex-direction: column !important;
        gap: 12px !important;
      }

      .form-row .form-group {
        width: 100% !important;
      }
    }

    /* iPad specific adjustments */
    @media (min-width: 481px) and (max-width: 1024px) {
      .header {
        padding: 10px 12px;
      }

      .nav-btn, .today-circle-btn {
        width: 36px;
        height: 36px;
        font-size: 18px;
      }

      .nav-title {
        font-size: 17px;
      }

      .view-btn {
        padding: 8px 12px;
        font-size: 14px;
      }

      .quick-add-input {
        padding: 8px 12px;
        font-size: 15px;
      }

      .quick-add-calendar-btn {
        height: 34px;
        padding: 0 10px;
        font-size: 14px;
      }

      .quick-add-toggle {
        width: 34px;
        height: 34px;
        font-size: 14px;
      }

      .calendar-filter-button,
      .event-filter-toggle {
        width: 34px;
        height: 34px;
      }

      /* Month view event sizing for iPad */
      .event-slot {
        height: 20px !important;
        font-size: 12px !important;
      }

      .event-chip {
        font-size: 11px !important;
        padding: 2px 6px !important;
      }

      .day-column {
        min-height: 85px !important;
      }
    }

    /* Mobile phones */
    @media (max-width: 480px) {
      .header {
        padding: 6px;
      }

      .nav-buttons {
        gap: 0;
      }

      .nav-btn, .today-circle-btn {
        width: 32px;
        height: 32px;
      }

      .nav-title {
        font-size: 14px;
      }

      .header-right {
        flex-wrap: nowrap;
        gap: 6px;
      }

      /* Move quick-add to bottom of screen - always expanded on mobile */
      .quick-add-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border-top: 1px solid var(--border-color);
        padding: 8px;
        padding-bottom: max(8px, env(safe-area-inset-bottom));
        z-index: 100;
        display: flex;
        gap: 6px;
      }

      /* Always show expanded state on mobile */
      .quick-add-expanded {
        max-width: none !important;
        opacity: 1 !important;
        flex: 1;
      }

      .quick-add-toggle {
        order: 0;
        width: 40px;
        height: 40px;
      }

      .calendar-container {
        padding-bottom: 60px !important;
      }

      .quick-add-input {
        font-size: 16px;
        padding: 10px 12px;
        flex: 1;
        width: auto !important;
      }

      .quick-add-input::placeholder {
        font-size: 13px;
      }

      .quick-add-calendar-btn {
        padding: 6px 10px;
        max-width: 80px;
        height: 40px;
      }

      .quick-add-cal-arrow {
        display: none;
      }

      .quick-add-calendar-dropdown {
        bottom: 100%;
        top: auto;
        margin-bottom: 4px;
        margin-top: 0;
      }

      .view-switcher {
        order: 1;
      }

      .view-btn {
        padding: 6px 6px;
        font-size: 11px;
      }

      .event-filter {
        order: 2;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }

      .calendar-filter {
        order: 3;
      }

      /* Year view - single column on small phones */
      .year-view {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
        padding: 8px !important;
      }

      /* Month view - remove vertical dividers, keep horizontal */
      .day-column::after {
        display: none !important;
      }

      .day-number-cell {
        border-right: none !important;
      }

      .day-column {
        min-height: 70px !important;
        padding: 2px 0 !important;
      }

      .multi-day-slots {
        margin-top: 1px !important;
      }

      /* Multi-day events - edge to edge, continuous across days */
      .event-slot {
        height: 14px !important;
        font-size: 9px !important;
        padding: 0 3px !important;
        margin: 0 0 1px 0 !important;
        border-radius: 0 !important;
      }

      /* Start of event (no left continuation) */
      .event-slot:not(.continues-left) {
        margin-left: 2px !important;
        border-top-left-radius: 3px !important;
        border-bottom-left-radius: 3px !important;
      }

      /* End of event (no right continuation) */
      .event-slot:not(.continues-right) {
        margin-right: 2px !important;
        border-top-right-radius: 3px !important;
        border-bottom-right-radius: 3px !important;
      }

      .single-day-events {
        gap: 1px !important;
        padding: 0 2px !important;
      }

      .event-chip {
        font-size: 9px !important;
        padding: 0 3px !important;
        height: 14px !important;
        line-height: 14px !important;
      }

      .event-chip.timed .event-color-bar {
        width: 2px !important;
        height: 10px !important;
      }

      .event-chip.timed .event-time {
        display: none !important;
      }

      .more-events {
        font-size: 9px !important;
        padding: 0 3px !important;
      }

      /* Week view - show only 3 days */
      .week-grid {
        display: flex !important;
        overflow-x: auto !important;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
      }

      .week-grid .day-column {
        min-width: 33.33% !important;
        flex-shrink: 0;
        scroll-snap-align: start;
      }

      .week-header {
        display: flex !important;
        overflow-x: auto !important;
      }

      .week-header .day-header {
        min-width: 33.33% !important;
        flex-shrink: 0;
      }

      /* Day view */
      .day-view-header {
        padding: 6px !important;
      }

      .day-view-title {
        font-size: 16px !important;
      }

      .day-view-subtitle {
        font-size: 12px !important;
      }

      /* Modal - full screen on mobile */
      .modal-overlay {
        align-items: flex-end;
      }

      .modal {
        width: 100% !important;
        max-height: 90vh !important;
        border-radius: 16px 16px 0 0 !important;
        margin: 0 !important;
      }

      .modal-header {
        padding: 16px !important;
      }

      .modal-body {
        padding: 0 16px 16px !important;
        max-height: calc(90vh - 120px);
        overflow-y: auto;
      }

      .modal-footer {
        padding: 12px 16px !important;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }

      .form-input, .form-select, .form-textarea {
        font-size: 16px !important; /* Prevents iOS zoom on focus */
      }
    }

    /* Very small phones */
    @media (max-width: 360px) {
      .view-btn {
        padding: 5px 4px;
        font-size: 10px;
      }

      .nav-title {
        font-size: 13px;
      }

      .mini-day {
        width: 24px !important;
        height: 24px !important;
        font-size: 10px !important;
      }
    }

    /* Landscape orientation on mobile */
    @media (max-height: 500px) and (orientation: landscape) {
      .header {
        padding: 4px 8px;
      }

      .modal {
        max-height: 95vh !important;
      }

      .modal-body {
        max-height: calc(95vh - 100px);
      }
    }

    /* Touch device optimizations */
    @media (hover: none) and (pointer: coarse) {
      .nav-btn, .today-circle-btn, .view-btn, .quick-add-toggle, .quick-add-calendar-btn, .calendar-filter-button, .event-filter-toggle {
        min-height: 44px;
        min-width: 44px;
      }

      .nav-btn, .today-circle-btn {
        min-width: 44px;
      }

      .day-column, .day-number-cell, .mini-day {
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* Increase touch target for day/week view timed events */
      .timed-event {
        padding: 6px 8px !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="nav-buttons">
      <button class="nav-btn" id="prevBtn" title="Previous">&#8249;</button>
      <button class="today-circle-btn" id="todayBtn" title="Today"></button>
      <button class="nav-btn" id="nextBtn" title="Next">&#8250;</button>
    </div>
    <div class="nav-title" id="navTitle">January 2026</div>

    <div class="header-right">
      <div class="quick-add-container" id="quickAddContainer">
        <div class="quick-add-expanded">
          <input type="text" id="quickAddInput" class="quick-add-input"
                 placeholder="meeting tomorrow 3pm">
          <button class="quick-add-calendar-btn" id="quickAddCalendarBtn" title="Select calendar">
            <span class="quick-add-cal-dot" id="quickAddCalDot"></span>
            <span class="quick-add-cal-name" id="quickAddCalName">Calendar</span>
            <i class="fa-solid fa-chevron-down quick-add-cal-arrow"></i>
          </button>
        </div>
        <button id="quickAddToggle" class="quick-add-toggle" title="Add event">
          <i class="fa-solid fa-plus"></i>
        </button>
        <div class="quick-add-calendar-dropdown" id="quickAddCalendarDropdown"></div>
      </div>
      <div class="view-switcher">
        <button class="view-btn" data-view="year">Year</button>
        <button class="view-btn active" data-view="month">Month</button>
        <button class="view-btn" data-view="week">Week</button>
        <button class="view-btn" data-view="day">Day</button>
      </div>

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
        <button class="calendar-filter-button" id="filterBtn" title="Filter calendars">
          <i class="far fa-calendar calendar-filter-icon"></i>
          <span class="calendar-filter-badge" id="calendarFilterBadge"></span>
        </button>
        <div class="calendar-filter-dropdown" id="filterDropdown">
          <div class="calendar-filter-action-item" id="toggleAllCalendars">Select All</div>
        </div>
      </div>
    </div>
  </div>

  <div class="calendar-container" id="calendarContainer">
    <div class="loading">Loading calendars...</div>
  </div>

<script>
    // ============================================
    // State Management
    // ============================================

    ${createCalendarEditorBridge.toString()}
    ${installCalendarEventEditor.toString()}
    const eventEditor = installCalendarEventEditor(createCalendarEditorBridge({
      calendars: function() { return state.writableCalendars; },
      refresh: async function(data, original) { await refreshEvents(); },
      onClose: function() { state.editingEvent = null; },
      onRefreshError: function(error) { console.error('Event saved, but refreshing the calendar failed:', error); }
    }));
    const state = {
      currentView: 'month',
      viewDate: new Date(),
      events: [],
      allCalendars: [],
      selectedCalendars: new Set(),
      writableCalendars: [],
      editingEvent: null,
      filterText: '',
      use12HourFormat: false,
      settings: {
        firstDayOfWeek: parseInt(localStorage.getItem('calendar_firstDayOfWeek') || '0')
      }
    };

    // Detect user's time format preference (12h vs 24h) using system locale
    function detectTimeFormat() {
      try {
        const testDate = new Date(2000, 0, 1, 13, 0);  // 1 PM
        const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
        const parts = formatter.formatToParts(testDate);
        return parts.some(function(part) { return part.type === 'dayPeriod'; });
      } catch (e) {
        console.error('Failed to detect time format:', e);
        return false;  // Default to 24-hour format
      }
    }

    const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];

    // ============================================
    // Utility Functions
    // ============================================
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }

    function parseDate(str) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    function formatTime(date) {
      const minutes = String(date.getMinutes()).padStart(2, '0');
      if (state.use12HourFormat) {
        let hours = date.getHours();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;  // Convert 0 to 12 for midnight
        return hours + ':' + minutes + ' ' + period;
      } else {
        const hours = String(date.getHours()).padStart(2, '0');
        return hours + ':' + minutes;
      }
    }

    function parseTime(timeStr, baseDate) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    function isSameDay(d1, d2) {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    }

    function isToday(date) {
      return isSameDay(date, new Date());
    }

    function getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
      return new Date(year, month, 1).getDay();
    }

    function getWeekDates(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day - state.settings.firstDayOfWeek;
      const adjustedDiff = diff < 0 ? diff + 7 : diff;
      d.setDate(d.getDate() - adjustedDiff);

      const dates = [];
      for (let i = 0; i < 7; i++) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }

    function getEventColor(event) {
      // support for event color coding in Calendars by Readdle and Calendar 366 applications
      if (event.notes) {
        const hexMatch = event.notes.match(/@colorHex:(#[0-9A-Fa-f]{6})|\\[!([0-9A-Fa-f]{6})!\\]/);
        if (hexMatch) {
          const color = hexMatch[1] || hexMatch[2];
          const finalColor = color.startsWith('#') ? color : '#' + color;
          return finalColor;
        }
      }
      // event (calendar) color and fallback color
      return event.color || '#5856D6';
    }

    function isDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function parseHexColor(hex) {
      if (!hex) return null;
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }

    function colorWithOpacity(hex, alpha) {
      const rgb = parseHexColor(hex);
      if (!rgb) return 'rgba(90, 159, 212, 0.35)';
      return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
    }

    function getTextColorForBackground(hex, alpha) {
      const rgb = parseHexColor(hex);
      if (!rgb) return isDarkMode() ? '#f5f5f7' : '#1d1d1f';
      const r = rgb.r, g = rgb.g, b = rgb.b;
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
      const toHex = function(n) { return n.toString(16).padStart(2, '0'); };
      return '#' + toHex(textR) + toHex(textG) + toHex(textB);
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function openNote(date, options) {
      if (!date) return;
      options = options || {};
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      let url = 'noteplan://x-callback-url/openNote?noteDate=' + dateStr + '&view=daily&timeframe=day';

      if (options.newWindow) {
        url += '&subWindow=yes';
      } else if (options.splitView) {
        url += '&splitView=yes&reuseSplitView=yes';
      }

      // Use hidden link click workaround for WebView URL schemes
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
    // Calendar API Functions
    // ============================================
    async function loadCalendars() {
      try {
        state.allCalendars = await Calendar.availableCalendars({}) || [];
        state.writableCalendars = await Calendar.availableCalendars({ writeOnly: true, enabledOnly: true }) || [];

        const saved = localStorage.getItem('calendar_selectedCalendars');
        if (saved) {
          const savedArray = JSON.parse(saved);
          state.selectedCalendars = new Set(
            state.allCalendars
              .filter(function(c) { return savedArray.includes(c.title); })
              .map(function(c) { return c.title; })
          );
        } else {
          state.selectedCalendars = new Set(state.allCalendars.map(function(c) { return c.title; }));
        }

        populateCalendarFilter();
      } catch (error) {
        console.error('Failed to load calendars:', error);
        state.allCalendars = [];
        state.writableCalendars = [];
      }
    }

    async function loadEventsForRange(startDate, endDate) {
      try {
        const events = await Calendar.eventsBetween(startDate, endDate, "") || [];
        state.events = events.filter(function(e) { return state.selectedCalendars.has(e.calendar); });
      } catch (error) {
        console.error('Failed to load events:', error);
        state.events = [];
      }
    }

    function getViewDateRange() {
      const year = state.viewDate.getFullYear();
      const month = state.viewDate.getMonth();

      switch (state.currentView) {
        case 'year':
          return {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59)
          };
        case 'month':
          const firstDay = getFirstDayOfMonth(year, month);
          const paddingDays = (firstDay - state.settings.firstDayOfWeek + 7) % 7;
          const start = new Date(year, month, 1 - paddingDays);
          const end = new Date(year, month + 1, 7);
          return { start: start, end: end };
        case 'week':
          const weekDates = getWeekDates(state.viewDate);
          return {
            start: weekDates[0],
            end: new Date(weekDates[6].getTime() + 24 * 60 * 60 * 1000 - 1)
          };
        case 'day':
          const dayStart = new Date(year, month, state.viewDate.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
          return { start: dayStart, end: dayEnd };
        default:
          return { start: new Date(), end: new Date() };
      }
    }

    async function refreshEvents() {
      const range = getViewDateRange();
      await loadEventsForRange(range.start, range.end);
      render();
    }

    // ============================================
    // Event CRUD
    // ============================================
    async function createEvent(eventData) {
      const eventObject = {
        title: eventData.title,
        date: eventData.start,
        endDate: eventData.end,
        type: 'event',
        isAllDay: eventData.isAllDay,
        calendar: eventData.calendar,
        isCompleted: false,
        notes: eventData.notes || '',
        url: '',
        availability: 0
      };

      try {
        const result = await Calendar.add(eventObject);
        if (!result) return null;
        await refreshEvents();
        return result;
      } catch (error) {
        console.error('Failed to create event:', error);
        return null;
      }
    }

    // ============================================
    // Navigation Functions
    // ============================================
    function navigatePrevious() {
      switch (state.currentView) {
        case 'year':
          state.viewDate.setFullYear(state.viewDate.getFullYear() - 1);
          break;
        case 'month':
          state.viewDate.setMonth(state.viewDate.getMonth() - 1);
          break;
        case 'week':
          state.viewDate.setDate(state.viewDate.getDate() - 7);
          break;
        case 'day':
          state.viewDate.setDate(state.viewDate.getDate() - 1);
          break;
      }
      refreshEvents();
    }

    function navigateNext() {
      switch (state.currentView) {
        case 'year':
          state.viewDate.setFullYear(state.viewDate.getFullYear() + 1);
          break;
        case 'month':
          state.viewDate.setMonth(state.viewDate.getMonth() + 1);
          break;
        case 'week':
          state.viewDate.setDate(state.viewDate.getDate() + 7);
          break;
        case 'day':
          state.viewDate.setDate(state.viewDate.getDate() + 1);
          break;
      }
      refreshEvents();
    }

    function navigateToday() {
      state.viewDate = new Date();
      refreshEvents();
    }

    function switchView(view) {
      state.currentView = view;
      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.view === view);
      });
      refreshEvents();
    }

    function getNavigationTitle() {
      const d = state.viewDate;
      switch (state.currentView) {
        case 'year':
          return d.getFullYear().toString();
        case 'month':
          return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
        case 'week':
          const weekDates = getWeekDates(d);
          const start = weekDates[0];
          const end = weekDates[6];
          if (start.getMonth() === end.getMonth()) {
            return MONTH_NAMES[start.getMonth()] + ' ' + start.getDate() + '-' + end.getDate() + ', ' + start.getFullYear();
          } else {
            return MONTH_NAMES[start.getMonth()].substr(0, 3) + ' ' + start.getDate() + ' - ' +
                   MONTH_NAMES[end.getMonth()].substr(0, 3) + ' ' + end.getDate() + ', ' + end.getFullYear();
          }
        case 'day':
          return WEEKDAY_NAMES[d.getDay()] + ', ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        default:
          return '';
      }
    }

    // ============================================
    // Calendar Filter Functions
    // ============================================
    function populateCalendarFilter() {
      const dropdown = document.getElementById('filterDropdown');
      const existingItems = dropdown.querySelectorAll('.calendar-filter-item, .calendar-source-header');
      existingItems.forEach(function(el) { el.remove(); });

      const bySource = {};
      state.allCalendars.forEach(function(cal) {
        const source = cal.source || 'Other';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(cal);
      });

      const sources = Object.keys(bySource).sort(function(a, b) {
        if (a === 'iCloud') return -1;
        if (b === 'iCloud') return 1;
        return a.localeCompare(b);
      });

      sources.forEach(function(source) {
        // Add source header
        const header = document.createElement('div');
        header.className = 'calendar-source-header';
        header.textContent = source;
        dropdown.appendChild(header);

        bySource[source].forEach(function(cal) {
          const item = document.createElement('div');
          const isDisabled = cal.isEnabled === false;
          item.className = 'calendar-filter-item' + (isDisabled ? ' disabled' : '');

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'calendar-filter-checkbox';
          checkbox.dataset.calendar = cal.title;
          checkbox.checked = state.selectedCalendars.has(cal.title) && !isDisabled;
          checkbox.disabled = isDisabled;

          const colorDot = document.createElement('div');
          colorDot.className = 'calendar-filter-color-dot';
          colorDot.style.backgroundColor = cal.color || '#5856D6';

          const label = document.createElement('span');
          label.className = 'calendar-filter-item-label';
          label.textContent = cal.title;

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
            checkbox.addEventListener('change', function(e) {
              if (e.target.checked) {
                state.selectedCalendars.add(cal.title);
              } else {
                state.selectedCalendars.delete(cal.title);
              }
              saveCalendarSelection();
              updateToggleAllText();
              updateCalendarFilterText();
              refreshEvents();
            });
          }

          dropdown.appendChild(item);
        });
      });

      updateToggleAllText();
      updateCalendarFilterText();
    }

    function updateToggleAllText() {
      const toggleBtn = document.getElementById('toggleAllCalendars');
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(function(c) { return state.selectedCalendars.has(c.title); });
      toggleBtn.textContent = allSelected ? 'Unselect All' : 'Select All';
    }

    function updateCalendarFilterText() {
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const selectedCount = enabledCalendars.filter(function(c) { return state.selectedCalendars.has(c.title); }).length;
      const totalCount = enabledCalendars.length;
      const badge = document.getElementById('calendarFilterBadge');
      const filterBtn = document.getElementById('filterBtn');

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

    function toggleAllCalendars() {
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(function(c) { return state.selectedCalendars.has(c.title); });

      if (allSelected) {
        state.selectedCalendars.clear();
      } else {
        enabledCalendars.forEach(function(c) { state.selectedCalendars.add(c.title); });
      }

      document.querySelectorAll('.calendar-filter-checkbox:not(:disabled)').forEach(function(cb) {
        cb.checked = state.selectedCalendars.has(cb.dataset.calendar);
      });

      saveCalendarSelection();
      updateToggleAllText();
      updateCalendarFilterText();
      refreshEvents();
    }

    function saveCalendarSelection() {
      localStorage.setItem('calendar_selectedCalendars', JSON.stringify(Array.from(state.selectedCalendars)));
    }

    // ============================================
    // Event Modal Functions
    // ============================================
    function openEventModal(options) {
      options = options || {};
      state.editingEvent = options.event || null;
      void eventEditor.open({ event: options.event, start: options.date, isAllDay: options.isAllDay });
    }

    // ============================================
    // Render Functions
    // ============================================
    function render() {
      document.getElementById('navTitle').textContent = getNavigationTitle();

      const container = document.getElementById('calendarContainer');

      switch (state.currentView) {
        case 'year':
          container.innerHTML = renderYearView();
          attachYearViewListeners();
          break;
        case 'month':
          container.innerHTML = renderMonthView();
          attachMonthViewListeners();
          break;
        case 'week':
          container.innerHTML = renderWeekView();
          attachWeekViewListeners();
          scrollToCurrentTime();
          break;
        case 'day':
          container.innerHTML = renderDayView();
          attachDayViewListeners();
          scrollToCurrentTime();
          break;
      }
    }

    // ============================================
    // Year View
    // ============================================
    function renderYearView() {
      const year = state.viewDate.getFullYear();
      let html = '<div class="year-view"><div class="year-grid">';

      for (let month = 0; month < 12; month++) {
        html += renderMiniMonth(year, month);
      }

      html += '</div></div>';
      return html;
    }

    function renderMiniMonth(year, month) {
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInMonth = getDaysInMonth(year, month);
      const today = new Date();

      const monthEvents = state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        return eventStart <= monthEnd && eventEnd > monthStart;
      });

      const daysWithEvents = new Set();
      monthEvents.forEach(function(e) {
        const start = new Date(e.date || e.startDate);
        const end = new Date(new Date(e.endDate).getTime() - 1);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getMonth() === month && d.getFullYear() === year) {
            daysWithEvents.add(d.getDate());
          }
        }
      });

      let html = '<div class="mini-month" data-month="' + month + '">';
      html += '<div class="mini-month-title">' + MONTH_NAMES[month] + '</div>';
      html += '<div class="mini-month-grid">';

      for (let i = 0; i < 7; i++) {
        const dayIndex = (i + state.settings.firstDayOfWeek) % 7;
        html += '<div class="mini-weekday">' + WEEKDAY_NAMES[dayIndex].substr(0, 1) + '</div>';
      }

      const startOffset = (firstDay - state.settings.firstDayOfWeek + 7) % 7;

      for (let i = 0; i < startOffset; i++) {
        html += '<div class="mini-day other-month"><span class="mini-day-number"></span></div>';
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isTodayDate = isSameDay(date, today);
        const hasEvents = daysWithEvents.has(day);

        let classes = 'mini-day';
        if (isTodayDate) classes += ' today';
        if (hasEvents) classes += ' has-events';

        html += '<div class="' + classes + '" data-date="' + formatDate(date) + '"><span class="mini-day-number">' + day + '</span></div>';
      }

      html += '</div></div>';
      return html;
    }

    function attachYearViewListeners() {
      document.querySelectorAll('.mini-day[data-date]').forEach(function(dayEl) {
        dayEl.addEventListener('click', function(e) {
          e.stopPropagation();
          const date = parseDate(dayEl.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('month');
          }
        });
      });

      document.querySelectorAll('.mini-month').forEach(function(miniMonth) {
        miniMonth.addEventListener('click', function(e) {
          if (e.target.closest('.mini-day[data-date]')) return;
          const month = parseInt(miniMonth.dataset.month);
          state.viewDate.setMonth(month);
          switchView('month');
        });
      });
    }

    // ============================================
    // Month View
    // ============================================
    function renderMonthView() {
      const year = state.viewDate.getFullYear();
      const month = state.viewDate.getMonth();

      let html = '<div class="month-view">';

      html += '<div class="weekday-header">';
      for (let i = 0; i < 7; i++) {
        const dayIndex = (i + state.settings.firstDayOfWeek) % 7;
        html += '<div class="weekday-cell">' + WEEKDAY_NAMES[dayIndex] + '</div>';
      }
      html += '</div>';

      // Get all weeks for this month view
      const weeks = getWeeksInMonthView(year, month);

      html += '<div class="month-weeks">';
      weeks.forEach(function(weekDates) {
        html += renderWeekRow(weekDates, month);
      });
      html += '</div>';

      html += '</div>';
      return html;
    }

    function getWeeksInMonthView(year, month) {
      const weeks = [];
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInMonth = getDaysInMonth(year, month);

      const startOffset = (firstDay - state.settings.firstDayOfWeek + 7) % 7;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevMonthYear = month === 0 ? year - 1 : year;
      const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);

      // Build all dates for the month view
      const allDates = [];

      // Previous month padding
      for (let i = startOffset - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        allDates.push(new Date(prevMonthYear, prevMonth, day));
      }

      // Current month
      for (let day = 1; day <= daysInMonth; day++) {
        allDates.push(new Date(year, month, day));
      }

      // Next month padding
      const totalCells = startOffset + daysInMonth;
      const remainingCells = (7 - (totalCells % 7)) % 7 + (totalCells <= 35 ? 7 : 0);
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextMonthYear = month === 11 ? year + 1 : year;

      for (let day = 1; day <= remainingCells; day++) {
        allDates.push(new Date(nextMonthYear, nextMonth, day));
      }

      // Group into weeks
      for (let i = 0; i < allDates.length; i += 7) {
        weeks.push(allDates.slice(i, i + 7));
      }

      return weeks;
    }

    function renderWeekRow(weekDates, currentMonth) {
      const weekStart = new Date(weekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);

      // Get all events for this week
      const weekEvents = getEventsForDateRange(weekStart, weekEnd);

      // Separate multi-day and single-day events
      const multiDayEvents = [];
      const singleDayEventsByDate = {};

      weekEvents.forEach(function(event) {
        const eventStart = new Date(event.date || event.startDate);
        const eventEnd = new Date(event.endDate);
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);

        if (eventEnd.getTime() > eventStart.getTime()) {
          multiDayEvents.push(event);
        } else {
          const dateKey = formatDate(eventStart);
          if (!singleDayEventsByDate[dateKey]) singleDayEventsByDate[dateKey] = [];
          singleDayEventsByDate[dateKey].push(event);
        }
      });

      // Assign lanes to multi-day events and build per-column layout
      const columnLayout = buildColumnLayout(multiDayEvents, weekDates);

      let html = '<div class="week-row">';

      // Day numbers row
      html += '<div class="week-day-numbers">';
      weekDates.forEach(function(date) {
        const isOtherMonth = date.getMonth() !== currentMonth;
        const isTodayDate = isToday(date);
        let classes = 'day-number-cell';
        if (isOtherMonth) classes += ' other-month';
        if (isTodayDate) classes += ' today';
        html += '<div class="' + classes + '" data-date="' + formatDate(date) + '">';
        html += '<span class="day-num">' + date.getDate() + '</span>';
        html += '</div>';
      });
      html += '</div>';

      // Per-column content area
      html += '<div class="week-days-content">';
      weekDates.forEach(function(date, colIndex) {
        const dateKey = formatDate(date);
        const isOtherMonth = date.getMonth() !== currentMonth;
        const dayEvents = singleDayEventsByDate[dateKey] || [];
        const colData = columnLayout.columns[colIndex];

        // Check if column has any events (single-day or multi-day)
        const hasMultiDayEvents = colData.slots.some(function(slot) { return !slot.empty; });
        const hasEvents = dayEvents.length > 0 || hasMultiDayEvents;

        let columnClasses = 'day-column';
        if (isOtherMonth) columnClasses += ' other-month';
        if (hasEvents) columnClasses += ' has-events';

        html += '<div class="' + columnClasses + '" data-date="' + dateKey + '">';

        // Multi-day event slots for this column
        if (colData.slots.length > 0) {
          html += '<div class="multi-day-slots">';
          colData.slots.forEach(function(slot) {
            if (slot.empty) {
              // Empty slot to maintain lane alignment
              html += '<div class="event-slot empty"></div>';
            } else {
              const color = getEventColor(slot.event);
              const bgColor = colorWithOpacity(color, 0.35);
              const textColor = slot.showTitle ? getTextColorForBackground(color, 0.35) : 'transparent';

              let slotClasses = 'event-slot';
              if (slot.continuesLeft) slotClasses += ' continues-left';
              if (slot.continuesRight) slotClasses += ' continues-right';

              html += '<div class="' + slotClasses + '" data-event-id="' + escapeHtml(slot.event.id) + '" data-event-start="' + new Date(slot.event.date || slot.event.startDate).toISOString() + '" ' +
                      'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                      escapeHtml(slot.event.title || 'No Title') + '</div>';
            }
          });
          html += '</div>';
        }

        // Single-day events - render all, CSS will handle overflow
        html += '<div class="single-day-events" data-total-events="' + dayEvents.length + '">';
        dayEvents.forEach(function(event) {
          const color = getEventColor(event);
          const isAllDay = event.isAllDay;

          if (isAllDay) {
            // All-day events: colored background
            const bgColor = colorWithOpacity(color, 0.35);
            const textColor = getTextColorForBackground(color, 0.35);
            html += '<div class="event-chip all-day" data-event-id="' + escapeHtml(event.id) + '" data-event-start="' + new Date(event.date || event.startDate).toISOString() + '" ' +
                    'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                    escapeHtml(event.title || 'No Title') + '</div>';
          } else {
            // Timed events: left color bar + title + time
            const eventDate = new Date(event.date || event.startDate);
            const timeStr = formatTime(eventDate);
            html += '<div class="event-chip timed" data-event-id="' + escapeHtml(event.id) + '" data-event-start="' + new Date(event.date || event.startDate).toISOString() + '">' +
                    '<span class="event-color-bar" style="background: ' + color + ';"></span>' +
                    '<span class="event-title">' + escapeHtml(event.title || 'No Title') + '</span>' +
                    '<span class="event-time">' + timeStr + '</span>' +
                    '</div>';
          }
        });
        // More indicator - will be updated after render based on visible events
        if (dayEvents.length > 0) {
          html += '<div class="more-events" style="display:none;"></div>';
        }
        html += '</div>';

        html += '</div>'; // close day-column
      });
      html += '</div>'; // close week-days-content

      html += '</div>';
      return html;
    }

    function getEventsForDateRange(startDate, endDate) {
      return state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        return eventStart <= endDate && eventEnd > startDate;
      }).sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        if (aStart.getTime() !== bStart.getTime()) return aStart - bStart;
        // Longer events first
        const aDuration = new Date(a.endDate).getTime() - aStart.getTime();
        const bDuration = new Date(b.endDate).getTime() - bStart.getTime();
        return bDuration - aDuration;
      });
    }

    function buildColumnLayout(events, weekDates) {
      // Initialize result with 7 columns
      const result = {
        columns: weekDates.map(function() {
          return { slots: [] };
        }),
        maxLanes: 0
      };

      if (events.length === 0) return result;

      const weekStart = new Date(weekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);
      const dayMs = 24 * 60 * 60 * 1000;

      // First pass: assign lanes to events
      const eventInfos = [];
      const lanes = []; // lanes[laneIndex] = array of { startCol, endCol }

      events.forEach(function(event) {
        const eventStart = new Date(event.date || event.startDate);
        var eventEnd = new Date(event.endDate);
        eventStart.setHours(0, 0, 0, 0);

        // For all-day events, endDate is often exclusive (day after event ends)
        eventEnd.setTime(eventEnd.getTime() - 1);
        eventEnd.setHours(0, 0, 0, 0);

        // Ensure end is not before start
        if (eventEnd.getTime() < eventStart.getTime()) {
          eventEnd = new Date(eventStart.getTime());
        }

        // Clamp to week boundaries
        const visibleStart = new Date(Math.max(eventStart.getTime(), weekStart.getTime()));
        const visibleEnd = new Date(Math.min(eventEnd.getTime(), weekEnd.getTime()));

        // Calculate column positions (0-6)
        const startCol = Math.floor((visibleStart.getTime() - weekStart.getTime()) / dayMs);
        const endCol = Math.floor((visibleEnd.getTime() - weekStart.getTime()) / dayMs);

        const continuesLeft = eventStart.getTime() < weekStart.getTime();
        const continuesRight = eventEnd.getTime() > weekEnd.getTime();

        // Find a lane where this event fits
        let laneIndex = 0;
        while (true) {
          if (!lanes[laneIndex]) lanes[laneIndex] = [];

          const canFit = lanes[laneIndex].every(function(existing) {
            return endCol < existing.startCol || startCol > existing.endCol;
          });

          if (canFit) {
            lanes[laneIndex].push({ startCol: startCol, endCol: endCol });
            eventInfos.push({
              event: event,
              lane: laneIndex,
              startCol: startCol,
              endCol: endCol,
              continuesLeft: continuesLeft,
              continuesRight: continuesRight
            });
            break;
          }
          laneIndex++;
        }
      });

      result.maxLanes = lanes.length;

      // Second pass: build per-column slot data
      // For each column, determine which lanes have events and create slots
      for (let col = 0; col < 7; col++) {
        // Find the max lane for this specific column
        let maxLaneForCol = -1;
        eventInfos.forEach(function(info) {
          if (col >= info.startCol && col <= info.endCol) {
            if (info.lane > maxLaneForCol) maxLaneForCol = info.lane;
          }
        });

        // Create slots for lanes 0 to maxLaneForCol
        for (let lane = 0; lane <= maxLaneForCol; lane++) {
          // Find if there's an event in this lane for this column
          const eventInfo = eventInfos.find(function(info) {
            return info.lane === lane && col >= info.startCol && col <= info.endCol;
          });

          if (eventInfo) {
            result.columns[col].slots.push({
              event: eventInfo.event,
              lane: lane,
              showTitle: col === eventInfo.startCol, // Show title at start of each week
              continuesLeft: col > eventInfo.startCol || eventInfo.continuesLeft,
              continuesRight: col < eventInfo.endCol || eventInfo.continuesRight,
              empty: false
            });
          } else {
            // Empty slot to maintain lane alignment
            result.columns[col].slots.push({
              lane: lane,
              empty: true
            });
          }
        }
      }

      return result;
    }

    function getEventsForDay(date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        return eventStart <= dayEnd && eventEnd > dayStart;
      }).sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        return aStart - bStart;
      });
    }

    function adjustMoreIndicators() {
      // After render, calculate available height and hide events that don't fit
      document.querySelectorAll('.single-day-events').forEach(function(container) {
        const totalEvents = parseInt(container.dataset.totalEvents) || 0;
        if (totalEvents === 0) return;

        const chips = Array.from(container.querySelectorAll('.event-chip'));
        const moreEl = container.querySelector('.more-events');
        if (!moreEl || chips.length === 0) return;

        // Hide everything first to get accurate container size
        chips.forEach(function(chip) { chip.style.display = 'none'; });
        moreEl.style.display = 'none';

        // Get available height from parent day-column
        const dayColumn = container.closest('.day-column');
        if (!dayColumn) return;

        const dayColumnRect = dayColumn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Available height for single-day events
        const availableHeight = dayColumnRect.bottom - containerRect.top - 4; // 4px padding

        if (availableHeight <= 0) return;

        // Measure chip height by showing first one temporarily
        chips[0].style.display = '';
        const chipHeight = chips[0].offsetHeight + 2; // +2 for gap
        chips[0].style.display = 'none';

        if (chipHeight <= 0) return;

        // Calculate how many events fit
        const moreElHeight = 18; // Height reserved for "+X more"
        let visibleCount = 0;

        for (let i = 0; i < chips.length; i++) {
          const heightWithThisChip = (i + 1) * chipHeight;
          const needsMoreIndicator = i < chips.length - 1;
          const heightNeeded = heightWithThisChip + (needsMoreIndicator ? moreElHeight : 0);

          if (heightNeeded <= availableHeight) {
            visibleCount++;
          } else {
            break;
          }
        }

        // Ensure at least 1 event shows if there's any space
        if (visibleCount === 0 && availableHeight >= chipHeight) {
          visibleCount = 1;
        }

        // Show visible events
        chips.forEach(function(chip, index) {
          chip.style.display = index < visibleCount ? '' : 'none';
        });

        // Show "+X more" if there are hidden events
        const hiddenCount = totalEvents - visibleCount;
        if (hiddenCount > 0) {
          moreEl.textContent = '+' + hiddenCount + ' more';
          moreEl.style.display = '';
        }
      });
    }

    function attachMonthViewListeners() {
      // Adjust "+X more" indicators after layout is complete
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          adjustMoreIndicators();
        });
      });

      // Day number cells - for navigation
      document.querySelectorAll('.day-number-cell').forEach(function(cell) {
        cell.addEventListener('click', function(e) {
          const date = parseDate(cell.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('day');
          }
        });
      });

      // Day columns - for creating events (clicking on empty space)
      document.querySelectorAll('.day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          // Ignore if clicking on an event
          if (e.target.classList.contains('event-chip') ||
              e.target.classList.contains('event-slot')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            openEventModal({ date: date });
          }
        });
      });

      // Event slots (multi-day) and chips (single-day)
      document.querySelectorAll('.event-slot:not(.empty), .event-chip').forEach(function(el) {
        el.addEventListener('click', async function(e) {
          e.stopPropagation();
          const eventId = el.dataset.eventId;
          try {
            const event = state.events.find(function(item) {
              return item.id === eventId && new Date(item.date || item.startDate).toISOString() === el.dataset.eventStart;
            });
            if (event) {
              openEventModal({ event: event });
            }
          } catch (error) {
            // Error handled silently
          }
        });
      });
    }

    // ============================================
    // Week View
    // ============================================
    function renderWeekView() {
      const weekDates = getWeekDates(state.viewDate);
      const today = new Date();

      let html = '<div class="week-view">';

      html += '<div class="week-header">';
      html += '<div class="week-header-spacer"></div>';

      weekDates.forEach(function(date) {
        const isTodayDate = isSameDay(date, today);
        html += '<div class="week-header-day' + (isTodayDate ? ' today' : '') + '" data-date="' + formatDate(date) + '">';
        html += '<div class="week-day-name">' + WEEKDAY_NAMES[date.getDay()] + '</div>';
        html += '<div class="week-day-number">' + date.getDate() + '</div>';
        html += '</div>';
      });
      html += '</div>';

      html += '<div class="all-day-section">';
      html += '<div class="all-day-label">All-day</div>';

      weekDates.forEach(function(date) {
        const allDayEvents = getEventsForDay(date).filter(function(e) { return e.isAllDay; });
        html += '<div class="all-day-column" data-date="' + formatDate(date) + '">';
        allDayEvents.forEach(function(event) {
          const color = getEventColor(event);
          const bgColor = colorWithOpacity(color, 0.35);
          const textColor = getTextColorForBackground(color, 0.35);
          html += '<div class="event-chip" data-event-id="' + escapeHtml(event.id) + '" data-event-start="' + new Date(event.date || event.startDate).toISOString() + '" ' +
                  'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                  escapeHtml(event.title || 'No Title') + '</div>';
        });
        html += '</div>';
      });
      html += '</div>';

      html += '<div class="week-body">';

      html += '<div class="time-column">';
      for (let hour = 0; hour < 24; hour++) {
        const label = hour === 0 ? '12 AM' : hour < 12 ? hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM';
        html += '<div class="time-slot-label">' + label + '</div>';
      }
      html += '</div>';

      weekDates.forEach(function(date) {
        html += renderDayColumn(date);
      });

      html += '</div></div>';
      return html;
    }

    function renderDayColumn(date) {
      const timedEvents = getEventsForDay(date).filter(function(e) { return !e.isAllDay; });
      const today = new Date();
      const isTodayDate = isSameDay(date, today);

      let html = '<div class="day-column" data-date="' + formatDate(date) + '">';

      for (let hour = 0; hour < 24; hour++) {
        html += '<div class="hour-line" style="top: ' + (hour * 60) + 'px;"></div>';
        html += '<div class="half-hour-line" style="top: ' + (hour * 60 + 30) + 'px;"></div>';
      }

      if (isTodayDate) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        html += '<div class="current-time-line" style="top: ' + minutes + 'px;"></div>';
      }

      const layoutEvents = layoutOverlappingEvents(timedEvents);
      layoutEvents.forEach(function(event) {
        const start = new Date(event.date || event.startDate);
        const end = new Date(event.endDate);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = Math.max(endMinutes - startMinutes, 30);

        const color = getEventColor(event);
        const bgColor = colorWithOpacity(color, 0.35);
        const textColor = getTextColorForBackground(color, 0.35);
        const width = (100 / event.totalColumns) - 1;
        const left = event.column * (100 / event.totalColumns);

        html += '<div class="timed-event" data-event-id="' + escapeHtml(event.id) + '" data-event-start="' + new Date(event.date || event.startDate).toISOString() + '" ' +
                'style="top: ' + startMinutes + 'px; height: ' + duration + 'px; ' +
                'background: ' + bgColor + '; color: ' + textColor + '; ' +
                'width: ' + width + '%; left: ' + left + '%;">';
        html += '<div class="timed-event-title">' + escapeHtml(event.title || 'No Title') + '</div>';
        if (duration >= 45) {
          html += '<div class="timed-event-time">' + formatTime(start) + ' - ' + formatTime(end) + '</div>';
        }
        html += '</div>';
      });

      html += '</div>';
      return html;
    }

    function layoutOverlappingEvents(events) {
      if (events.length === 0) return [];

      const sorted = events.slice().sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        return aStart - bStart;
      });

      const groups = [];
      let currentGroup = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const event = sorted[i];
        const eventStart = new Date(event.date || event.startDate);

        const overlaps = currentGroup.some(function(e) {
          const eEnd = new Date(e.endDate);
          return eventStart < eEnd;
        });

        if (overlaps) {
          currentGroup.push(event);
        } else {
          groups.push(currentGroup);
          currentGroup = [event];
        }
      }
      groups.push(currentGroup);

      const result = [];
      groups.forEach(function(group) {
        const columns = [];
        group.forEach(function(event) {
          const eventStart = new Date(event.date || event.startDate);

          let column = 0;
          while (columns[column] && new Date(columns[column].endDate) > eventStart) {
            column++;
          }

          columns[column] = event;
          const eventCopy = Object.assign({}, event);
          eventCopy.column = column;
          eventCopy.totalColumns = group.length;
          result.push(eventCopy);
        });
      });

      return result;
    }

    function attachWeekViewListeners() {
      document.querySelectorAll('.week-header-day').forEach(function(header) {
        header.addEventListener('click', function(e) {
          const date = parseDate(header.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('day');
          }
        });
      });

      document.querySelectorAll('.day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          if (e.target.classList.contains('timed-event')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            const rect = column.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hourHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 60;
            const minutes = Math.max(0, Math.min(1425, Math.floor(y / hourHeight * 4) * 15));
            date.setHours(0, minutes, 0, 0);
            openEventModal({ date: date, isAllDay: false });
          }
        });
      });

      document.querySelectorAll('.all-day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          if (e.target.classList.contains('event-chip')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            openEventModal({ date: date });
          }
        });
      });

      document.querySelectorAll('.event-chip, .timed-event').forEach(function(el) {
        el.addEventListener('click', async function(e) {
          e.stopPropagation();
          const eventId = el.dataset.eventId;
          try {
            const event = state.events.find(function(item) {
              return item.id === eventId && new Date(item.date || item.startDate).toISOString() === el.dataset.eventStart;
            });
            if (event) {
              openEventModal({ event: event });
            }
          } catch (error) {
            // Error handled silently
          }
        });
      });
    }

    function scrollToCurrentTime() {
      const weekBody = document.querySelector('.week-body');
      if (weekBody) {
        const now = new Date();
        const scrollTo = Math.max(0, (now.getHours() - 1) * 60);
        weekBody.scrollTop = scrollTo;
      }
    }

    // ============================================
    // Day View
    // ============================================
    function renderDayView() {
      const date = state.viewDate;
      const today = new Date();
      const isTodayDate = isSameDay(date, today);

      let html = '<div class="day-view">';

      html += '<div class="week-header">';
      html += '<div class="week-header-spacer"></div>';
      html += '<div class="week-header-day' + (isTodayDate ? ' today' : '') + '" data-date="' + formatDate(date) + '">';
      html += '<div class="week-day-name">' + WEEKDAY_NAMES[date.getDay()] + '</div>';
      html += '<div class="week-day-number">' + date.getDate() + '</div>';
      html += '</div>';
      html += '</div>';

      const allDayEvents = getEventsForDay(date).filter(function(e) { return e.isAllDay; });
      html += '<div class="all-day-section">';
      html += '<div class="all-day-label">All-day</div>';
      html += '<div class="all-day-column" data-date="' + formatDate(date) + '">';
      allDayEvents.forEach(function(event) {
        const color = getEventColor(event);
        const bgColor = colorWithOpacity(color, 0.35);
        const textColor = getTextColorForBackground(color, 0.35);
        html += '<div class="event-chip" data-event-id="' + escapeHtml(event.id) + '" data-event-start="' + new Date(event.date || event.startDate).toISOString() + '" ' +
                'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                escapeHtml(event.title || 'No Title') + '</div>';
      });
      html += '</div></div>';

      html += '<div class="week-body">';

      html += '<div class="time-column">';
      for (let hour = 0; hour < 24; hour++) {
        const label = hour === 0 ? '12 AM' : hour < 12 ? hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM';
        html += '<div class="time-slot-label">' + label + '</div>';
      }
      html += '</div>';

      html += renderDayColumn(date);

      html += '</div></div>';
      return html;
    }

    function attachDayViewListeners() {
      attachWeekViewListeners();
    }

    // ============================================
    // Event Filter
    // ============================================
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
            state.filterText = '';
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
        state.filterText = this.value.trim().toLowerCase();

        // Toggle has-value class for clear button visibility
        container.classList.toggle('has-value', this.value.length > 0);

        applyEventFilter();
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          this.value = '';
          state.filterText = '';
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
          state.filterText = '';
          container.classList.remove('has-value');
          applyEventFilter();
          input.focus();
        });
      }
    }

    function applyEventFilter() {
      const filterText = state.filterText;

      // Find all event elements
      const eventElements = document.querySelectorAll('.event-slot:not(.empty), .event-chip, .timed-event');

      eventElements.forEach(function(el) {
        const eventTitle = (el.textContent || '').toLowerCase();
        const matches = !filterText || eventTitle.includes(filterText);

        if (matches) {
          el.style.display = '';
          el.style.visibility = '';
        } else {
          // Use visibility hidden to maintain layout for multi-day events
          if (el.classList.contains('event-slot')) {
            el.style.visibility = 'hidden';
          } else {
            el.style.display = 'none';
          }
        }
      });

      // Update more indicators after filtering
      if (state.currentView === 'month') {
        updateMoreIndicatorsAfterFilter();
      }
    }

    function updateMoreIndicatorsAfterFilter() {
      document.querySelectorAll('.more-events').forEach(function(indicator) {
        const dayColumn = indicator.closest('.day-column');
        if (!dayColumn) return;

        const visibleChips = dayColumn.querySelectorAll('.event-chip:not([style*="display: none"])');
        const hiddenCount = dayColumn.querySelectorAll('.event-chip[style*="display: none"]').length;

        // Update or hide the more indicator based on visible events
        const totalHidden = parseInt(indicator.dataset.originalCount || '0') - hiddenCount;
        if (totalHidden > 0 && !state.filterText) {
          indicator.textContent = '+' + totalHidden + ' more';
          indicator.style.display = '';
        } else {
          indicator.style.display = 'none';
        }
      });
    }

    // ============================================
    // Quick Add (Natural Language Event Input)
    // ============================================
    let pendingQuickAddEvent = null;
    let isQuickAddProcessing = false;
    let selectedQuickAddCalendar = null;

    function initQuickAdd() {
      const input = document.getElementById('quickAddInput');
      const toggle = document.getElementById('quickAddToggle');
      const container = document.getElementById('quickAddContainer');
      const calBtn = document.getElementById('quickAddCalendarBtn');

      if (!input || !container) return;

      // Initialize calendar selector
      initQuickAddCalendarSelector();

      // Track if user is interacting within the container (for blur handling)
      let isInteractingWithContainer = false;

      container.addEventListener('mousedown', function() {
        isInteractingWithContainer = true;
      });

      function expandQuickAdd() {
        container.classList.add('expanded');
        input.focus();
      }

      function collapseQuickAdd() {
        if (!input.value.trim()) {
          container.classList.remove('expanded');
          hideQuickAddCalendarDropdown();
        }
      }

      async function submitQuickAdd() {
        if (input.value.trim() && !isQuickAddProcessing) {
          isQuickAddProcessing = true;
          try {
            await handleQuickAdd(input.value.trim());
            // Only collapse if event was created (input is cleared by createQuickAddEvent)
            if (!input.value.trim()) {
              container.classList.remove('expanded');
            }
          } finally {
            isQuickAddProcessing = false;
          }
        }
      }

      // Toggle button: expand if collapsed, collapse if expanded (empty), submit if expanded with value
      if (toggle) {
        toggle.addEventListener('click', async function(e) {
          e.stopPropagation();
          if (container.classList.contains('expanded')) {
            if (input.value.trim()) {
              // Has content - submit it
              await submitQuickAdd();
            } else {
              // Empty - collapse it
              container.classList.remove('expanded');
              hideQuickAddCalendarDropdown();
            }
          } else {
            expandQuickAdd();
          }
        });
      }

      input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          await submitQuickAdd();
        } else if (e.key === 'Escape') {
          this.value = '';
          hideQuickAddCalendarDropdown();
          container.classList.remove('expanded');
          this.blur();
        }
      });

      // Collapse on blur if empty and focus left the container
      input.addEventListener('blur', function() {
        setTimeout(function() {
          // Don't collapse if user is interacting with the container
          // (e.g., clicked the toggle button or calendar selector)
          if (isInteractingWithContainer) {
            isInteractingWithContainer = false; // Reset for next interaction
            return;
          }
          collapseQuickAdd();
        }, 200);
      });

      // Calendar selector button
      if (calBtn) {
        calBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleQuickAddCalendarDropdown();
        });
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.quick-add-container')) {
          hideQuickAddCalendarDropdown();
          collapseQuickAdd();
        }
      });
    }

    function initQuickAddCalendarSelector() {
      // Filter to only truly writable calendars (same filter as populateQuickAddCalendarDropdown)
      const calendars = state.writableCalendars.filter(function(cal) {
        if (cal.isWritable === false) return false;
        return true;
      });
      if (calendars.length === 0) return;

      // Try to restore saved calendar
      const savedCalendarTitle = localStorage.getItem('calendar_quickAddCalendar');
      let defaultCalendar = null;

      if (savedCalendarTitle) {
        defaultCalendar = calendars.find(function(c) { return c.title === savedCalendarTitle; });
      }

      // If no saved or saved not found, use first calendar
      if (!defaultCalendar) {
        defaultCalendar = calendars[0];
      }

      selectQuickAddCalendar(defaultCalendar);
      populateQuickAddCalendarDropdown();
    }

    function selectQuickAddCalendar(calendar) {
      selectedQuickAddCalendar = calendar;

      // Update UI
      const dot = document.getElementById('quickAddCalDot');
      const name = document.getElementById('quickAddCalName');

      if (dot && calendar) {
        dot.style.background = calendar.color;
      }
      if (name && calendar) {
        name.textContent = calendar.title;
      }

      // Save to localStorage
      if (calendar) {
        localStorage.setItem('calendar_quickAddCalendar', calendar.title);
      }

      // Update dropdown selection
      document.querySelectorAll('.quick-add-calendar-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.calendarTitle === calendar.title);
      });
    }

    function populateQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (!dropdown) return;

      dropdown.innerHTML = '';

      // Filter to only truly writable calendars (double-check isWritable property)
      const writableOnly = state.writableCalendars.filter(function(cal) {
        // Exclude calendars that are explicitly marked as not writable
        // or have "Holidays" in the name (subscribed calendars)
        if (cal.isWritable === false) return false;
        return true;
      });

      // Group calendars by source
      const bySource = {};
      writableOnly.forEach(function(cal) {
        const source = cal.source || 'Other';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(cal);
      });

      // Render grouped calendars
      Object.keys(bySource).sort().forEach(function(source) {
        // Source header
        const header = document.createElement('div');
        header.className = 'calendar-source-header';
        header.textContent = source;
        dropdown.appendChild(header);

        // Calendars in this source
        bySource[source].forEach(function(cal) {
          const option = document.createElement('div');
          option.className = 'quick-add-calendar-option';
          option.dataset.calendarTitle = cal.title;

          if (selectedQuickAddCalendar && selectedQuickAddCalendar.title === cal.title) {
            option.classList.add('selected');
          }

          const dot = document.createElement('span');
          dot.className = 'cal-dot';
          dot.style.background = cal.color;

          const name = document.createElement('span');
          name.className = 'cal-name';
          name.textContent = cal.title;

          option.appendChild(dot);
          option.appendChild(name);

          option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectQuickAddCalendar(cal);
            hideQuickAddCalendarDropdown();
          });

          dropdown.appendChild(option);
        });
      });
    }

    function toggleQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (dropdown) {
        dropdown.classList.toggle('visible');
      }
    }

    function hideQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (dropdown) {
        dropdown.classList.remove('visible');
      }
    }

    async function handleQuickAdd(inputText) {
      // Try to use NotePlan's Calendar.parseDateText API
      if (typeof Calendar === 'undefined' || typeof Calendar.parseDateText !== 'function') {
        // Fallback to simple parsing
        var parseResult = simpleParseDate(inputText);
        if (!parseResult) {
          showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
          return;
        }

        pendingQuickAddEvent = {
          title: parseResult.title,
          date: parseResult.date,
          endDate: parseResult.endDate,
          isAllDay: parseResult.isAllDay
        };
      } else {
        // Use NotePlan's native parser
        try {
          var results = await Calendar.parseDateText(inputText);

          // API returns an array of parsed date results
          if (!results || !Array.isArray(results) || results.length === 0 || !results[0].start) {
            showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
            return;
          }

          var parsed = results[0];
          var startDate = new Date(parsed.start);
          var endDate = parsed.end ? new Date(parsed.end) : new Date(startDate.getTime() + 60 * 60 * 1000);

          // Extract title by removing the parsed date text from input
          var title = inputText;
          if (parsed.text) {
            title = inputText.replace(parsed.text, '').trim();
            title = title.replace(/^(on|at|for)\s+/i, '').trim();
            title = title.replace(/\s+(on|at|for)$/i, '').trim();
          }
          if (!title) title = 'New Event';

          // Check if it's an all-day event
          var isAllDay = parsed.isAllDay || false;

          // If end equals start, add 1 hour duration
          if (endDate.getTime() === startDate.getTime()) {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          }

          pendingQuickAddEvent = {
            title: title,
            date: startDate,
            endDate: endDate,
            isAllDay: isAllDay
          };
        } catch (err) {
          showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
          return;
        }
      }

      // Use pre-selected calendar
      if (!selectedQuickAddCalendar) {
        showQuickAddError('No calendar selected');
        return;
      }

      await createQuickAddEvent(selectedQuickAddCalendar.title);
    }

    // Simple fallback date parser
    function simpleParseDate(input) {
      var now = new Date();
      var result = { date: null, endDate: null, title: '', isAllDay: false };
      var text = input.toLowerCase();

      // Extract time first (e.g., "at 3pm", "at 15:00", "3pm", "11 am")
      var timeMatch = text.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      var hours = null;
      var minutes = 0;

      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        var ampm = timeMatch[3];

        if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        }

        // Remove time from text for title extraction
        text = text.replace(timeMatch[0], ' ').trim();
      }

      // Parse date keywords
      var targetDate = new Date(now);
      var dateFound = false;

      if (text.includes('today')) {
        dateFound = true;
        text = text.replace('today', ' ').trim();
      } else if (text.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
        dateFound = true;
        text = text.replace('tomorrow', ' ').trim();
      } else if (text.includes('yesterday')) {
        targetDate.setDate(targetDate.getDate() - 1);
        dateFound = true;
        text = text.replace('yesterday', ' ').trim();
      } else {
        // Check for "next [weekday]"
        var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var nextMatch = text.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
        if (nextMatch) {
          var targetDay = weekdays.indexOf(nextMatch[1].toLowerCase());
          var daysUntil = (targetDay - now.getDay() + 7) % 7;
          if (daysUntil === 0) daysUntil = 7;
          targetDate.setDate(targetDate.getDate() + daysUntil);
          dateFound = true;
          text = text.replace(nextMatch[0], ' ').trim();
        } else {
          // Check for just weekday name
          for (var i = 0; i < weekdays.length; i++) {
            if (text.includes(weekdays[i])) {
              var daysUntilDay = (i - now.getDay() + 7) % 7;
              if (daysUntilDay === 0) daysUntilDay = 7;
              targetDate.setDate(targetDate.getDate() + daysUntilDay);
              dateFound = true;
              text = text.replace(weekdays[i], ' ').trim();
              break;
            }
          }
        }
      }

      // If no date found but time found, assume today
      if (!dateFound && hours !== null) {
        dateFound = true;
      }

      if (!dateFound) {
        return null;
      }

      // Set time
      if (hours !== null) {
        targetDate.setHours(hours, minutes, 0, 0);
        result.isAllDay = false;
        result.endDate = new Date(targetDate.getTime() + 60 * 60 * 1000); // 1 hour duration
      } else {
        targetDate.setHours(0, 0, 0, 0);
        result.isAllDay = true;
        result.endDate = new Date(targetDate);
        result.endDate.setHours(23, 59, 59, 999);
      }

      result.date = targetDate;

      // Clean up title
      var title = text.replace(/\s+/g, ' ').trim();
      title = title.replace(/^(on|at|for)\s+/i, '').trim();
      title = title.replace(/\s+(on|at|for)$/i, '').trim();
      result.title = title || 'New Event';

      return result;
    }

    async function createQuickAddEvent(calendarTitle) {
      if (!pendingQuickAddEvent) return;

      // Save data locally before clearing pending state
      const eventData = {
        title: pendingQuickAddEvent.title,
        start: pendingQuickAddEvent.date,
        end: pendingQuickAddEvent.endDate,
        isAllDay: pendingQuickAddEvent.isAllDay,
        calendar: calendarTitle
      };
      const navigateToDate = new Date(pendingQuickAddEvent.date);

      // Clear UI state first
      document.getElementById('quickAddInput').value = '';
      hideQuickAddCalendarDropdown();

      // Navigate to the event's date
      state.viewDate = navigateToDate;

      // Use existing createEvent function for consistency
      const result = await createEvent(eventData);
      if (!result) {
        showQuickAddError('Failed to create event');
      }
    }

    function showQuickAddError(message) {
      alert(message);
    }

    // ============================================
    // Initialization
    // ============================================
    async function initialize() {
      // Detect user's time format preference (12h vs 24h)
      state.use12HourFormat = detectTimeFormat();

      await loadCalendars();
      await refreshEvents();
      initQuickAdd();

      document.getElementById('prevBtn').addEventListener('click', navigatePrevious);
      document.getElementById('nextBtn').addEventListener('click', navigateNext);
      document.getElementById('todayBtn').addEventListener('click', navigateToday);

      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchView(btn.dataset.view); });
      });

      document.getElementById('filterBtn').addEventListener('click', function() {
        document.getElementById('filterDropdown').classList.toggle('visible');
      });

      document.getElementById('toggleAllCalendars').addEventListener('click', toggleAllCalendars);

      // Event filter handlers
      initEventFilter();

      document.addEventListener('click', function(e) {
        if (!e.target.closest('.calendar-filter')) {
          document.getElementById('filterDropdown').classList.remove('visible');
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') document.getElementById('filterDropdown').classList.remove('visible');
      });

      setInterval(function() {
        if (state.currentView === 'week' || state.currentView === 'day') {
          const line = document.querySelector('.current-time-line');
          if (line) {
            const now = new Date();
            const minutes = now.getHours() * 60 + now.getMinutes();
            line.style.top = minutes + 'px';
          }
        }
      }, 60000);

      // Recalculate event visibility on resize
      let resizeTimeout;
      window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
          if (state.currentView === 'month') {
            adjustMoreIndicators();
          }
        }, 150);
      });

      // Re-render when color scheme changes (light/dark mode)
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        switchView(state.currentView);
      });
    }

    if (typeof Calendar !== 'undefined') {
      initialize();
    } else {
      window.addEventListener('notePlanBridgeReady', function() {
        if (typeof Calendar !== 'undefined') {
          initialize();
        } else {
          document.getElementById('calendarContainer').innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-state-icon">📅</div>' +
            '<div>Calendar API not available</div>' +
            '</div>';
        }
      }, { once: true });

      setTimeout(function() {
        if (typeof Calendar === 'undefined') {
          document.getElementById('calendarContainer').innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-state-icon">📅</div>' +
            '<div>Calendar API not available</div>' +
            '</div>';
        }
      }, 2000);
    }
  </script>
</body>
</html>`;
}

/**
 * Plugin initialization - called by NotePlan when the plugin loads
 * Checks for updates in the background
 */
function init() {
  try {
    // Check for plugin updates silently in the background
    // Parameters: (pluginIDs, showPromptIfSuccessful, showProgressPrompt, showFailedPrompt)
    DataStore.installOrUpdatePluginsByID(['emetzger.Calendar'], false, false, false);
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
