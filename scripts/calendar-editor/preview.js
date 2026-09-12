/* eslint-env node */
// Synthetic data only. No NotePlan API access or changes to real calendars.
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const output = process.argv[2] || '/tmp/calendar-editor-preview'
fs.mkdirSync(output, { recursive: true })
for (const [plugin, filename] of [
  ['emetzger.Calendar', 'calendar.html'],
  ['emetzger.LinearCalendar', 'linear.html'],
]) {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../', plugin, 'script.js'), 'utf8'), context)
  let html = context.getCalendarHTML(2026)
  const mock = `<script>
    const previewEvent = {id:'preview',title:'Product design review',date:'2026-09-14T09:00:00',endDate:'2026-09-14T10:00:00',originalStartDate:'2026-09-14T09:00:00',type:'event',calendar:'Work',calendarID:'work',isAllDay:false,isCalendarWritable:true,isRecurring:true,recurrenceRules:[{frequency:'weekly',interval:2,daysOfWeek:[{dayOfWeek:2,weekNumber:0},{dayOfWeek:4,weekNumber:0}],occurrenceCount:12}],alertOffsets:[-600],notes:'Review the next release and agree on follow-ups.',location:'Studio · 2nd floor',url:'https://example.com/agenda',availability:0,color:'#d96512'};
    window.Calendar={availableCalendars:async()=>[{id:'work',title:'Work',source:'iCloud',color:'#d96512',isWritable:true,isEnabled:true},{id:'personal',title:'Personal',source:'iCloud',color:'#4488bb',isWritable:true,isEnabled:true}],eventsBetween:async()=>[previewEvent],eventEditorCapabilities:async()=>({version:1}),eventForEditing:async()=>({...previewEvent}),eventByID:async()=>({...previewEvent}),saveEvent:async(data)=>({...data,id:'preview'}),removeEvent:async()=>true};
    window.NotePlan={environment:async()=>({}),openURL:async()=>{}};
  </script>`
  html = html.replace('</head>', `${mock}</head>`)
  const show =
    filename === 'calendar.html'
      ? 'state.viewDate=new Date(2026,8,14);openEventModal({event:previewEvent});'
      : 'openEventModal(new Date(previewEvent.date),new Date(previewEvent.endDate),previewEvent);'
  const newEvent = filename === 'calendar.html'
    ? 'state.viewDate=new Date(2026,8,14);openEventModal({date:new Date(2026,8,14,14,15),isAllDay:false});'
    : 'openEventModal(new Date(2026,8,14),new Date(2026,8,14));'
  html = html.replace('</body>', `<script>setTimeout(function(){if(new URLSearchParams(location.search).has('new')){${newEvent}}else{${show}}},600);</script></body>`)
  fs.writeFileSync(path.join(output, filename.replace('.html', '-dark.html')), html.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, '@media all'))
  fs.writeFileSync(path.join(output, filename), html)
}
console.log(output)
