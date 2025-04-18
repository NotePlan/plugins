---
title: Weekly Monday Note (quick note)
type: ignore
folder: _TEST
dateForm: YY[w]WW DDMMM
monday: <%= prompt('monday',"Enter a monday in form YYYY-MM-DD") %>
newNoteTitle: <%- date.format("YY[w]WW DDMMM", `${monday}`) %>
---
# <%- date.format("YY[w]WW DDMMM", monday) %>
<% const newWeek = date.businessAdd(5,`${monday}`) -%>
Next week: [[<%= date.format(dateForm,newWeek) %>]]

Variables for debugging:
dateForm: <%- dateForm %>
entered date (monday): <%- monday %>
newWeek (should be monday+1 week): <%- newWeek %>



