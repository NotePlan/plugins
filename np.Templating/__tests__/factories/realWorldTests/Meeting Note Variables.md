---
title: ⭐️ Templates Tags - Meeting Note Variables
type: ignore
---

Templating docs: [Introduction | np.Templating](https://nptemplating-docs.netlify.app/docs/intro/)

Include frontmatter in template: [Discord](https://discord.com/channels/763107030223290449/963950027946999828/1030875570805944460)
```
￼ ￼title: YAML
type: empty-note
hr: ---
folder: <select>
￼---
<%- hr %>
title: <%- prompt('başlık') %>
zettel-ID: <%- date.now('YYYYMMDDHHmmss') %>
source: 
author: @
tags: #<%- prompt('tag') %>
backlinks: [[]]
<%- hr %> ```


```
<%- prompt('sleepScore','How much did you sleep?') -%>
<% await DataStore.invokePluginCommandByName("quick add line under heading","jgclark.QuickCapture", ["Sleep Note","Daily Sleeps",`${np.date.now("YYYY-DD")}: ${sleepScore}`]) %>

```

Here's an example of what you can now do with Events Helpers plugin. With this line in my 'Daily Notes Template':
```
<%- events({format:"*|START|* *|EVENTLINK|*  *|with ATTENDEES|*", allday_format:"- *|TITLE|*", includeHeadings:true}) %>  
``` 

```
<%- events( {format:"### [*|START|*] *|TITLE|*\n- \n*****\n", includeHeadings:false} ) %>


```
<%- progressUpdate({ interval: 'wtd', heading: 'Weeks\' Progress'}) %>
<%- progressUpdate({ interval: 'mtd', heading: 'Month\'s Progress'}) %>

Save new template link to clipboard (maybe doesn't work because you're on the wrong note):
```
The [[title-wiki-link]] version:
<% Clipboard.string = `[[${Editor.note.title}]]` -%>

The prettier [link](url) version:
<% Clipboard.string = `[link](noteplan://x-callback-url/openNote?filename=${encodeURIComponent(Editor.note.filename)})` -%>
```

MeetingNote with lightweight CRM (links to the names of the attendees)
```
title: TEST Meeting Note w/ Email Link
type: meeting-note
documentation: https://help.noteplan.co/article/134-meeting-notes
￼
# <%- eventTitle %> - <%- eventDate('MMM Do YY') %>
**Event:**  <%- calendarItemLink %>
**Attendees:** 
<% const emails = eventAttendees.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) -%>
<% const uniqueEmails = [...(new Set(emails))].join(",") -%>
<% const uniqueLinks = [...(new Set(eventAttendeeNames.split(", ")))].join("]],[[") -%>
[[<%- uniqueLinks -%>]] 
→ [✉️ Email All Attendees](mailto:<%- uniqueEmails %>?subject=<%- encodeURIComponent(eventTitle) %>)
```


```
￼
title: Readwise
openNoteTitle: <TODAY>
location: replace
writeUnderHeading: "Quotes to Remember"
type: ignore
￼
<% const authToken = 'drr3XZIGG3zN0k21ZS46bVOkm9ofubI1MIfgZlDUV7g7ZPUJl5' -%>
<% let url = "https://readwise.io/api/v2/highlights?page_size=1&page=" + Math.floor(Math.random() * 1000) -%>
<% const rwHResult = await fetch(url, { method: 'GET', contentType: 'application/json', headers: { 'Authorization': 'Token ' + authToken } }) -%>
<% var rwHParsed = null -%>
<% try { -%>
<% rwHParsed = JSON.parse(rwHResult) -%>
<% } catch (error) { -%>
<%   console.log(`${error.toString()}\n\n${url}\n\n${rwHResult}`) -%>
<% }	<% var rwBParsed = null -%>
<% try { -%>
<% rwBParsed = JSON.parse(rwBResult) -%>
<% } catch (error) { -%>
<%   console.log(`${error.toString()}\n\n${url}\n\n${rwBResult}`) -%>
<% } -%>
<% const rwAuthor = !rwBParsed?.author ? "(unknown author)" : "-- " + rwBParsed.author -%>
> <%- rwText %> <%- rwAuthor -%>  
> [refresh](￼) <%# MAKE SURE THERE ARE NO LINE RETURNS AFTER THIS -%>
```

JIRA example:
```---
title: Jira tickets
type: empty-note 
￼
<% /* apiToken is user_email:jira_acess_token base64 encoded */ -%>
<% const apiToken = 'APITOKEN' -%>
<% const jiraURL = "https://ORGJIRA.atlassian.net/"-%>
<%
const re = await fetch(jiraURL + "rest/api/3/search?jql=assignee=currentuser()&fields=id,key,status", {
	method: 'GET',
	contentType: 'application/json',
	headers: {
		'Authorization': 'Basic ' + apiToken
	}
})
-%>
<% const parsed = JSON.parse(re) -%>
## Jira Tickets
### In Progress
<%- parsed == undefined ? "Your  API token is invalid ": parsed.issues.filter(item =>  item.fields.status.name ===  "In Progress").map(item => "* [" + item.key + "]" + "(" + jiraURL + "browse/" + item.key +")") .join("\n") -%>

### Todo
<%- parsed == undefined ? "Your  API token is invalid ": parsed.issues.filter(item =>  item.fields.status.name ===  "To Do").map(item => "- [" + item.key + "]" + "(" + jiraURL + "browse/" + item.key +")") .join("\n") -%>
```

```
￼
title: Standard Meeting Note
folder: 30 - Resources/30.2 - Quick Notes/Meetings
type: meeting-note
￼
Frontmatter options:

Use title: Your template title to name your template.
Use folder: /path/to/folder to define a specific folder for the new meeting note.
Use folder: <select> to show a prompt where you can select a folder.
Use folder: <current> to use the same folder where the currently opened note is located.
Use append: note title to append the template content to an existing note (will be created if it doesn't exist).
Use prepend: note title to prepend the template content to an existing note (will be created if it doesn't exist).
Use append: <select> or prepend: <select> to show a prompt where you can select the note.
Use append: <current> or prepend: <current> to append the meeting note to the currently opened note.
Make sure to add type: meeting-note to your Frontmatter. NotePlan uses this to filter your templates and shows only the relevant ones at the right places.

eventTitle = The title of the selected calendar event.
eventAttendees = Comma separated list of all attendees of this event (names or emails).
calendarItemLink = The link to this event, this has to be added to link a note to an event.
eventDate('MMM Do YY') = The date of the event, you can modify the format of the date.
eventEndDate('MMM Do YY') = The end date of the event, you can modify the format of the date.
eventLink = URL which is optionally added to events, like the link to the zoom call.
eventNotes = The text inside the notes field of the event.
eventLocation = Location of the event.
eventCalendar = Calendar name of the event.
```
# Example:
```
# <%- eventTitle %> - <%- eventDate('MMM Do YY') %>
**Event:**  <%- calendarItemLink %>
**Link:** <%- eventLink %>
**Attendees:** <%- eventAttendees %>
**Event Notes:** 
> <%- eventNotes %>
```
￼

Include "email attendees" link:

```
<% const emails = eventAttendees.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) -%>
<% const uniqueEmails = [...(new Set(emails))].join(",") -%>
[eMail Attendees](mailto:<%- uniqueEmails %>?subject=<%- encodeURIComponent(eventTitle) %>)
```