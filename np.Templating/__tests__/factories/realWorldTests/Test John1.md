---
title: Test (John1)
type:  ignore
description: Template used for discussion on discord
dateForm: YY[w]W DDMMM
monday: <%- prompt('monday','Enter a monday in form YYYY-MM-DD') %>
---
# <%- date.format(`${dateForm}`, `${monday}`) %>
<% const newWeek = date.businessAdd(5,`${monday}`,'YYYY-MM-DD') -%>
<% const lastWeek = date.businessSubtract(5,`${monday}`,'YYYY-MM-DD') -%>
[[<%= date.format(`${dateForm}`,`${lastWeek}`) %>]] ⬅️ ➡️ [[<%= date.format(`${dateForm}`,`${newWeek}`) %>]]    🗓 [[<%= date.format('YYMM', `${monday}`) %> <%= date.format('MMMM', `${monday}`) %>]]  [[<%= date.format('YYYY', `${monday}`) %>]]

# 22w29 18Jul
[[22w28 11Jul]] ⬅️ ➡️ [[22w30 25Jul]]    🗓 [[2207 July]]  [[2022]]

