---
title: Test John1 QTN
type: ignore
description: Template used for discussion on discord @John1 
folder: _TEST
dateForm: YY[w]W DDMMM
monday: <%= prompt('monday',"Enter a monday in form:YYYY-MM-DD") %>
newNoteTitle: <%- date.format(`${dateForm}`, `${monday}`) %>
---
<% const newWeek = date.businessAdd(5,`${monday}`,'YYYY-MM-DD') -%>
<% const lastWeek = date.businessSubtract(5,`${monday}`,'YYYY-MM-DD') -%>
[[<%= date.format(`${dateForm}`,`${lastWeek}`) %>]] ⬅️ ➡️ [[<%= date.format(`${dateForm}`,`${newWeek}`) %>]]    🗓 [[<%= date.format('YYMM', `${monday}`) %> <%= date.format('MMMM', `${monday}`) %>]]  [[<%= date.format('YYYY', `${monday}`) %>]]
---