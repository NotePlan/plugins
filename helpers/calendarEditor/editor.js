/* eslint-env browser */
/**
 * Shared, dependency-free event editor for NotePlan's standalone calendar plugins.
 * Run `node scripts/calendar-editor/build.js` after editing this file.
 * Bridge calls are injected by the host. Never assume an arbitrary property is a capability.
 */
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

if (typeof module !== 'undefined') module.exports = { installCalendarEventEditor }
