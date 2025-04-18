---
title: Template Tester
type: ignore
tags: migrated-template
---
# Template Tester
---
```javascript
Code here
```
* a star todo
- [ ] a dash bracket todo (hides the bracket)

## selection:
Insert the text that was selected when the template was invoked:
<%- selection() %>

## Today:
8601 date the hard way:
- <%- legacyDate({locale: 'sv-SE', dateStyle: 'short'}) %>
Formatted:
- naked: <%- formattedDateTime('%Y-%m-%d %I:%M:%S %P') %>
- object: `<%- formattedDateTime({format:'%Y-%m-%d %I:%M:%S %P'}) %>` 
- <%- formattedDateTime({format: '%A, %B %d, %Y'}) %>
8601 the easy way:
- <%- date8601() %>

week span:
- <%- weekDates() %>
- <%- weekDates({weekStartsOn:0, format:`%Y-%m-%d`}) %>
- <%- weekDates({weekStartsOn:1, format:`%Y-%m-%d`}) %>

Prompt user for a variable:
- <%- prompt(meetingName) %>
weather:
- <%- web.weather() %> 
quote:
- <%- web.quote() %> 
affirmation:
- <%- web.affirmation() %>
advice:
- <%- web.advice() %>

---
Events:
<%- listTodaysEvents({template:"- *|START|*-*|END|*: *|TITLE|*",allday_template:"- *|TITLE|*"}) %> ---
Matching events:
<%- listMatchingEvents() %> -- (requires configuration)