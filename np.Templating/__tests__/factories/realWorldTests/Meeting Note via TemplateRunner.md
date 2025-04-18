---
title: Meeting Note via TemplateRunner
type: ignore
note: "format eventStart (the start) and eventEnd (the end) using moment: [Format - momentjs.com](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/)"
note2: "discussion about how this works [Discord](https://discord.com/channels/763107030223290449/1047174253495201872/1052630286292230154)"
---
```javascript
const eventInfoString = `eventTitle=${eventTitle};eventNotes=${eventNotes};eventLink=${eventLink};calendarItemLink=${calendarItemLink};eventAttendees=${eventAttendees};eventAttendeeNames=${eventAttendeeNames};eventLocation=${eventLocation};eventCalendar=${eventCalendar};eventStart=${eventDate("YYYY-MM-DD HH:MM")};eventEnd=${eventEndDate("YYYY-MM-DD HH:MM")}`.replace("\n"," ")
await DataStore.invokePluginCommandByName("templateRunner","np.Templating",["xxx meeting output",true,eventInfoString])
```