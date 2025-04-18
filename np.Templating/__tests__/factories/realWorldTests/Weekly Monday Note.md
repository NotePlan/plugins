---
title: Weekly Monday Note
type: ignore 
dateForm: YY[w]WW DDMMM
monday: <%= prompt('monday',"Enter a monday in form YYYY-MM-DD") %>
---
# <%- date.format(dateForm, monday) %>
<% const newWeek = date.businessAdd(5,`${monday}`) -%>
Next week: [[<%= date.format(dateForm,newWeek) %>]]

Variables for debugging:
dateForm: <%- dateForm %>
entered date (monday): <%- monday %>
newWeek (should be monday+1 week): <%- newWeek %>



